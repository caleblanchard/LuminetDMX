const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const FileDatabase = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// CORS configuration - restrict to known origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:4200', 'http://localhost:80'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('Origin not allowed by CORS'));
    }
    return callback(null, origin);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimit.ipKeyGenerator,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

// Apply rate limiting to all requests
app.use(limiter);

// Strict rate limiting for DMX control endpoints
const dmxLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // limit each IP to 20 requests per 10 seconds
  message: { error: 'DMX control rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimit.ipKeyGenerator,
  handler: (req, res) => {
    res.status(429).json({ error: 'DMX control rate limit exceeded. Try again later.' });
  }
});

// Apply strict rate limiting to DMX endpoints
app.use('/api/dmx', dmxLimiter);
app.use('/api/virtual-console', dmxLimiter);

app.use(express.json());

// Limit JSON payload size to prevent memory exhaustion
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Load and serve Swagger documentation
const swaggerPaths = [
  path.join(__dirname, '../swagger.yaml'),  // Development
  path.join(__dirname, 'swagger.yaml')      // Container
];

let swaggerDocument;
let swaggerFound = false;

for (const swaggerPath of swaggerPaths) {
  try {
    if (fs.existsSync(swaggerPath)) {
      swaggerDocument = YAML.load(swaggerPath);
      swaggerFound = true;
      console.log('Loaded swagger.yaml from:', swaggerPath);
      break;
    }
  } catch (error) {
    console.warn(`Failed to load swagger from ${swaggerPath}:`, error.message);
  }
}

if (!swaggerFound) {
  console.warn('Could not find swagger.yaml, using fallback documentation');
  swaggerDocument = {
    openapi: '3.0.3',
    info: {
      title: 'LuminetDMX API',
      version: '1.0.0',
      description: 'API documentation not available. Please refer to API.md for documentation.'
    },
    paths: {}
  };
}

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'LuminetDMX API Documentation',
  customfavIcon: '/favicon.ico',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// Initialize database
const dataDir = process.env.DATA_DIR || './data';
const db = new FileDatabase(dataDir);

let artnetSocket = null;
let universeConfig = db.loadUniverseConfig();
let fixtureTemplates = db.find('fixture_templates');
let patches = db.find('patches');
let groups = db.find('groups');
let presets = db.find('presets');
let dmxValues = db.loadDmxValues();
let virtualConsoleLayout = db.loadVirtualConsoleLayout();
let virtualConsoleStates = db.loadVirtualConsoleStates();

console.log('Database initialized:', {
  templates: fixtureTemplates.length,
  patches: patches.length,
  groups: groups.length,
  presets: presets.length,
  dmxChannelsSet: dmxValues.filter(v => v > 0).length
});

// Helper functions for address management
function getUsedAddresses(universe) {
  const usedRanges = [];
  const targetUniverse = typeof universe === 'string' ? parseInt(universe) : universe;
  const relevantPatches = patches.filter(p => {
    const patchUniverse = typeof p.universe === 'string' ? parseInt(p.universe) : p.universe;
    return patchUniverse === targetUniverse;
  });
  
  relevantPatches.forEach(patch => {
    const template = fixtureTemplates.find(t => t.id === patch.templateId);
    if (template) {
      usedRanges.push({
        start: patch.startAddress,
        end: patch.startAddress + template.channelCount - 1,
        patchId: patch.id
      });
    }
  });
  
  return usedRanges;
}

function hasAddressConflict(universe, startAddress, channelCount, excludePatchId = null) {
  const usedRanges = getUsedAddresses(universe);
  const endAddress = startAddress + channelCount - 1;
  
  return usedRanges.some(range => {
    if (excludePatchId && range.patchId === excludePatchId) return false;
    return !(endAddress < range.start || startAddress > range.end);
  });
}

function findNextAvailableAddress(universe, channelCount, startFrom = 1) {
  for (let address = startFrom; address <= 513 - channelCount; address++) {
    if (!hasAddressConflict(universe, address, channelCount)) {
      return address;
    }
  }
  return null;
}

function findAvailableAddresses(universe, templateId, quantity, startAddress = 1) {
  const template = fixtureTemplates.find(t => t.id === templateId);
  if (!template) return null;
  
  const addresses = [];
  let currentAddress = startAddress;
  
  for (let i = 0; i < quantity; i++) {
    const hasConflict = hasAddressConflict(universe, currentAddress, template.channelCount);
    
    if (hasConflict) {
      return { 
        error: `Address conflict at channels ${currentAddress}-${currentAddress + template.channelCount - 1}. Cannot place ${quantity} fixtures starting from address ${startAddress}.`,
        availableAddresses: addresses
      };
    }
    
    if (currentAddress + template.channelCount - 1 > 512) {
      return {
        error: `Would exceed DMX channel limit (512). Cannot place fixture at address ${currentAddress}.`,
        availableAddresses: addresses
      };
    }
    
    addresses.push(currentAddress);
    currentAddress += template.channelCount;
  }
  
  return { addresses };
}

function initializeArtnet() {
  console.log('Initializing Art-Net with config:', universeConfig);
  
  if (artnetSocket) {
    console.log('Closing existing Art-Net socket');
    artnetSocket.close();
  }
  
  try {
    artnetSocket = dgram.createSocket('udp4');
    
    artnetSocket.bind(() => {
      const isBroadcast = universeConfig.broadcastIP.endsWith('.255');
      if (isBroadcast) {
        try {
          artnetSocket.setBroadcast(true);
          console.log('Art-Net UDP socket created with broadcast enabled');
        } catch (err) {
          console.warn('Could not enable broadcast, using unicast only');
        }
      } else {
        console.log('Art-Net UDP socket created for unicast');
      }
    });
  } catch (error) {
    console.error('Failed to initialize Art-Net socket:', error);
  }
}

function createArtNetPacket(universe, dmxData) {
  const packet = Buffer.alloc(530);
  
  packet.write('Art-Net\0', 0, 8, 'ascii');
  packet.writeUInt16LE(0x5000, 8);
  packet.writeUInt16BE(14, 10);
  packet.writeUInt8(0, 12);
  packet.writeUInt8(0, 13);
  packet.writeUInt16LE(universe, 14);
  packet.writeUInt16BE(512, 16);
  
  for (let i = 0; i < 512; i++) {
    packet.writeUInt8(dmxData[i] || 0, 18 + i);
  }
  
  return packet;
}

function broadcastDMX() {
  if (artnetSocket) {
    try {
      const packet = createArtNetPacket(universeConfig.universe, dmxValues);
      
      artnetSocket.send(packet, 6454, universeConfig.broadcastIP, (error) => {
        if (error) {
          console.error('Failed to send Art-Net packet:', error);
        }
      });
      
      artnetSocket.send(packet, 6455, universeConfig.broadcastIP, (error) => {
        if (!error) {
          console.log('Debug packet also sent to port 6455');
        }
      });
      
    } catch (error) {
      console.error('Failed to create/send Art-Net packet:', error);
    }
  }
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'dmx_update',
        data: dmxValues
      }));
    }
  });
}

function applyChannelValuesWithFade(channelTargets, fadeMs = 0) {
  if (!Array.isArray(channelTargets) || channelTargets.length === 0) return;
  const clampedTargets = channelTargets.map(({ channel, value }) => ({
    channel: Math.max(1, Math.min(512, channel)),
    value: Math.max(0, Math.min(255, Math.round(value)))
  }));

  if (!fadeMs || fadeMs <= 0) {
    clampedTargets.forEach(({ channel, value }) => {
      dmxValues[channel - 1] = value;
    });
    db.saveDmxValues(dmxValues);
    broadcastDMX();
    return;
  }

  const startValues = clampedTargets.map(({ channel }) => dmxValues[channel - 1] || 0);
  const endValues = clampedTargets.map(({ value }) => value);
  const channels = clampedTargets.map(({ channel }) => channel);
  const tickMs = 30;
  const steps = Math.max(1, Math.floor(fadeMs / tickMs));
  let step = 0;

  const intervalId = setInterval(() => {
    step += 1;
    const t = step / steps;
    channels.forEach((channel, idx) => {
      const start = startValues[idx];
      const end = endValues[idx];
      const value = Math.round(start + (end - start) * t);
      dmxValues[channel - 1] = value;
    });
    db.saveDmxValues(dmxValues);
    broadcastDMX();

    if (step >= steps) {
      clearInterval(intervalId);
    }
  }, tickMs);
}

// Input validation middleware
const { body, param, validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

// Sanitize string inputs
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim();
}

// Fixture Templates
app.get('/api/fixture-templates', (req, res) => {
  res.json(fixtureTemplates);
});

app.post('/api/fixture-templates', [
  body('name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('manufacturer').trim().optional().isLength({ max: 100 }).escape(),
  body('model').trim().optional().isLength({ max: 100 }).escape(),
  body('channelCount').isInt({ min: 1, max: 512 }),
  body('channels').optional().isArray()
], validateRequest, (req, res) => {
  const template = {
    id: uuidv4(),
    name: sanitizeString(req.body.name),
    manufacturer: req.body.manufacturer ? sanitizeString(req.body.manufacturer) : undefined,
    model: req.body.model ? sanitizeString(req.body.model) : undefined,
    channelCount: req.body.channelCount,
    channels: req.body.channels || [],
    createdAt: new Date().toISOString()
  };
  const savedTemplate = db.insert('fixture_templates', template);
  fixtureTemplates = db.find('fixture_templates');
  res.json(savedTemplate);
});

app.put('/api/fixture-templates/:id', [
  param('id').isUUID()
], validateRequest, (req, res) => {
  const updatedTemplate = db.update('fixture_templates', req.params.id, {
    ...req.body,
    name: req.body.name ? sanitizeString(req.body.name) : undefined,
    manufacturer: req.body.manufacturer ? sanitizeString(req.body.manufacturer) : undefined,
    model: req.body.model ? sanitizeString(req.body.model) : undefined,
    updatedAt: new Date().toISOString()
  });
  if (!updatedTemplate) {
    return res.status(404).json({ error: 'Template not found' });
  }
  fixtureTemplates = db.find('fixture_templates');
  res.json(updatedTemplate);
});

app.delete('/api/fixture-templates/:id', [
  param('id').isUUID()
], validateRequest, (req, res) => {
  const deleted = db.delete('fixture_templates', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Template not found' });
  }
  fixtureTemplates = db.find('fixture_templates');
  res.json({ message: 'Template deleted' });
});

// Patches
app.get('/api/patches', (req, res) => {
  res.json(patches);
});

app.post('/api/patches', [
  body('name').optional().trim().isLength({ max: 100 }).escape(),
  body('templateId').isUUID(),
  body('universe').isInt({ min: 0, max: 32767 }),
  body('startAddress').isInt({ min: 1, max: 512 })
], validateRequest, (req, res) => {
  const template = fixtureTemplates.find(t => t.id === req.body.templateId);
  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  if (hasAddressConflict(req.body.universe, req.body.startAddress, template.channelCount)) {
    return res.status(400).json({ 
      error: `Address conflict: Channels ${req.body.startAddress}-${req.body.startAddress + template.channelCount - 1} are already in use`
    });
  }

  const patch = {
    id: uuidv4(),
    name: req.body.name ? sanitizeString(req.body.name) : undefined,
    templateId: req.body.templateId,
    universe: req.body.universe,
    startAddress: req.body.startAddress,
    createdAt: new Date().toISOString()
  };
  const savedPatch = db.insert('patches', patch);
  patches = db.find('patches');
  res.json(savedPatch);
});

app.put('/api/patches/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ max: 100 }).escape(),
  body('templateId').optional().isUUID(),
  body('universe').optional().isInt({ min: 0, max: 32767 }),
  body('startAddress').optional().isInt({ min: 1, max: 512 })
], validateRequest, (req, res) => {
  const existingPatch = patches.find(p => p.id === req.params.id);
  if (!existingPatch) {
    return res.status(404).json({ error: 'Patch not found' });
  }

  if (req.body.templateId || req.body.startAddress !== undefined || req.body.universe !== undefined) {
    const templateId = req.body.templateId || existingPatch.templateId;
    const startAddress = req.body.startAddress !== undefined ? req.body.startAddress : existingPatch.startAddress;
    const universe = req.body.universe !== undefined ? req.body.universe : existingPatch.universe;
    
    const template = fixtureTemplates.find(t => t.id === templateId);
    if (!template) {
      return res.status(400).json({ error: 'Template not found' });
    }

    if (hasAddressConflict(universe, startAddress, template.channelCount, req.params.id)) {
      return res.status(400).json({ 
        error: `Address conflict: Channels ${startAddress}-${startAddress + template.channelCount - 1} are already in use`
      });
    }
  }

  const updatedPatch = db.update('patches', req.params.id, {
    ...req.body,
    name: req.body.name ? sanitizeString(req.body.name) : undefined,
    updatedAt: new Date().toISOString()
  });
  patches = db.find('patches');
  res.json(updatedPatch);
});

app.delete('/api/patches/:id', [
  param('id').isUUID()
], validateRequest, (req, res) => {
  const deleted = db.delete('patches', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Patch not found' });
  }
  patches = db.find('patches');
  res.json({ message: 'Patch deleted' });
});

app.post('/api/patches/bulk', [
  body('templateId').isUUID(),
  body('universe').isInt({ min: 0, max: 32767 }),
  body('quantity').isInt({ min: 1, max: 512 }),
  body('baseName').optional().trim().isLength({ max: 100 }).escape(),
  body('startAddress').optional().isInt({ min: 1, max: 512 })
], validateRequest, (req, res) => {
  const template = fixtureTemplates.find(t => t.id === req.body.templateId);
  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  const addressResult = findAvailableAddresses(req.body.universe, req.body.templateId, req.body.quantity, req.body.startAddress);
  if (addressResult.error) {
    return res.status(400).json(addressResult);
  }

  const createdPatches = [];
  const timestamp = new Date().toISOString();

  addressResult.addresses.forEach((address, index) => {
    const patchName = req.body.baseName ? `${sanitizeString(req.body.baseName)} ${index + 1}` : `${template.name} ${index + 1}`;
    const patch = {
      id: uuidv4(),
      name: patchName,
      templateId: req.body.templateId,
      universe: req.body.universe,
      startAddress: address,
      createdAt: timestamp
    };
    const savedPatch = db.insert('patches', patch);
    createdPatches.push(savedPatch);
  });

  patches = db.find('patches');
  res.json({ 
    message: `Created ${createdPatches.length} patches`,
    patches: createdPatches 
  });
});

app.post('/api/patches/check-addresses', [
  body('templateId').isUUID(),
  body('universe').isInt({ min: 0, max: 32767 }),
  body('quantity').isInt({ min: 1, max: 512 }),
  body('startAddress').optional().isInt({ min: 1, max: 512 })
], validateRequest, (req, res) => {
  const template = fixtureTemplates.find(t => t.id === req.body.templateId);
  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  const addressResult = findAvailableAddresses(req.body.universe, req.body.templateId, req.body.quantity, req.body.startAddress);

  if (addressResult.error) {
    return res.status(200).json({
      canFit: false,
      ...addressResult
    });
  }

  return res.json({
    canFit: true,
    addresses: addressResult.addresses,
    channelsPerFixture: template.channelCount,
    totalChannels: addressResult.addresses.length * template.channelCount
  });
});

app.get('/api/patches/used-addresses/:universe', [
  param('universe').isInt({ min: 0, max: 32767 })
], validateRequest, (req, res) => {
  const universe = parseInt(req.params.universe);
  const usedRanges = getUsedAddresses(universe);
  res.json({ usedRanges });
});

// Groups
app.get('/api/groups', (req, res) => {
  res.json(groups);
});

app.post('/api/groups', [
  body('name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('fixtureIds').optional().isArray(),
  body('color').optional().isLength({ max: 20 }).escape()
], validateRequest, (req, res) => {
  const group = {
    id: uuidv4(),
    name: sanitizeString(req.body.name),
    fixtureIds: req.body.fixtureIds || [],
    color: req.body.color || '#007bff',
    createdAt: new Date().toISOString()
  };
  const savedGroup = db.insert('groups', group);
  groups = db.find('groups');
  res.json(savedGroup);
});

app.put('/api/groups/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ max: 100 }).escape(),
  body('fixtureIds').optional().isArray(),
  body('color').optional().isLength({ max: 20 }).escape()
], validateRequest, (req, res) => {
  const updatedGroup = db.update('groups', req.params.id, {
    ...req.body,
    name: req.body.name ? sanitizeString(req.body.name) : undefined,
    color: req.body.color || undefined,
    updatedAt: new Date().toISOString()
  });
  if (!updatedGroup) {
    return res.status(404).json({ error: 'Group not found' });
  }
  groups = db.find('groups');
  res.json(updatedGroup);
});

app.delete('/api/groups/:id', [
  param('id').isUUID()
], validateRequest, (req, res) => {
  const deleted = db.delete('groups', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Group not found' });
  }
  groups = db.find('groups');
  res.json({ message: 'Group deleted' });
});

// Presets
app.get('/api/presets', (req, res) => {
  res.json(presets);
});

app.post('/api/presets', [
  body('name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('channelValues').isArray({ min: 1 }),
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const preset = {
    id: uuidv4(),
    name: sanitizeString(req.body.name),
    channelValues: req.body.channelValues.filter(cv => 
      cv.channel >= 1 && cv.channel <= 512 && 
      cv.value >= 0 && cv.value <= 255
    ),
    fadeMs: req.body.fadeMs || 0,
    createdAt: new Date().toISOString()
  };
  const savedPreset = db.insert('presets', preset);
  presets = db.find('presets');
  res.json(savedPreset);
});

app.put('/api/presets/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ max: 100 }).escape(),
  body('channelValues').optional().isArray(),
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const updatedPreset = db.update('presets', req.params.id, {
    ...req.body,
    name: req.body.name ? sanitizeString(req.body.name) : undefined,
    channelValues: req.body.channelValues ? req.body.channelValues.filter(cv => 
      cv.channel >= 1 && cv.channel <= 512 && 
      cv.value >= 0 && cv.value <= 255
    ) : undefined,
    updatedAt: new Date().toISOString()
  });
  if (!updatedPreset) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  presets = db.find('presets');
  res.json(updatedPreset);
});

app.delete('/api/presets/:id', [
  param('id').isUUID()
], validateRequest, (req, res) => {
  const deleted = db.delete('presets', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  presets = db.find('presets');
  res.json({ message: 'Preset deleted' });
});

app.post('/api/presets/:id/apply', [
  param('id').isUUID(),
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const preset = presets.find(p => p.id === req.params.id);
  if (!preset) {
    return res.status(404).json({ error: 'Preset not found' });
  }

  const requestedFade = typeof req.body?.fadeMs === 'number' ? req.body.fadeMs : undefined;
  const fadeMs = requestedFade ?? preset.fadeMs ?? 0;

  const targets = preset.channelValues
    .filter(cv => cv.channel >= 1 && cv.channel <= 512)
    .map(cv => ({ channel: cv.channel, value: cv.value }));

  applyChannelValuesWithFade(targets, fadeMs);

  res.json({ 
    message: `Applied preset "${preset.name}"`,
    channelsUpdated: targets.length,
    fadeMs
  });
});

app.post('/api/presets/:id/clear', [
  param('id').isUUID(),
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const preset = presets.find(p => p.id === req.params.id);
  if (!preset) {
    return res.status(404).json({ error: 'Preset not found' });
  }

  const requestedFade = typeof req.body?.fadeMs === 'number' ? req.body.fadeMs : undefined;
  const fadeMs = requestedFade ?? preset.fadeMs ?? 0;

  const targets = preset.channelValues
    .filter(cv => cv.channel >= 1 && cv.channel <= 512)
    .map(cv => ({ channel: cv.channel, value: 0 }));

  applyChannelValuesWithFade(targets, fadeMs);

  res.json({ 
    message: `Cleared preset "${preset.name}"`,
    channelsUpdated: targets.length,
    fadeMs
  });
});

// DMX Control
app.post('/api/dmx/set-channel', [
  body('channel').isInt({ min: 1, max: 512 }),
  body('value').isInt({ min: 0, max: 255 })
], validateRequest, (req, res) => {
  dmxValues[req.body.channel - 1] = req.body.value;
  db.saveDmxValues(dmxValues);
  broadcastDMX();
  res.json({ channel: req.body.channel, value: req.body.value });
});

app.post('/api/dmx/set-multiple', [
  body('channels').isArray({ min: 1, max: 512 }),
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const validChannels = req.body.channels.filter(({ channel, value }) => 
    channel >= 1 && channel <= 512 && value >= 0 && value <= 255
  );

  if (validChannels.length === 0) {
    return res.status(400).json({ error: 'No valid channels provided' });
  }

  if (req.body.fadeMs && req.body.fadeMs > 0) {
    const targets = validChannels.map(({ channel, value }) => ({ channel, value }));
    applyChannelValuesWithFade(targets, req.body.fadeMs);
    res.json({ message: 'Channels updated with fade', fadeMs: req.body.fadeMs });
  } else {
    for (const { channel, value } of validChannels) {
      dmxValues[channel - 1] = value;
    }
    db.saveDmxValues(dmxValues);
    broadcastDMX();
    res.json({ message: 'Channels updated' });
  }
});

app.get('/api/dmx/values', (req, res) => {
  res.json(dmxValues);
});

app.post('/api/dmx/blackout', [
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const requestedFade = typeof req.body?.fadeMs === 'number' ? req.body.fadeMs : 0;
  const targets = dmxValues
    .map((value, idx) => ({ channel: idx + 1, value: 0 }))
    .filter(({ channel }) => channel >= 1 && channel <= 512);

  applyChannelValuesWithFade(targets, requestedFade);
  res.json({ message: 'Blackout initiated', fadeMs: requestedFade });
});

app.post('/api/dmx/clear-all', [
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const requestedFade = typeof req.body?.fadeMs === 'number' ? req.body.fadeMs : 0;
  const targets = dmxValues
    .map((value, idx) => ({ channel: idx + 1, value: 0 }))
    .filter(({ channel }) => channel >= 1 && channel <= 512);

  applyChannelValuesWithFade(targets, requestedFade);
  res.json({ message: 'Clear all initiated', fadeMs: requestedFade });
});

// Virtual Console
app.post('/api/virtual-console/button/trigger', [
  body('buttonId').trim().isLength({ min: 1, max: 100 }).escape(),
  body('action').isIn(['activate', 'deactivate', 'toggle']),
  body('fadeMs').optional().isInt({ min: 0, max: 60000 })
], validateRequest, (req, res) => {
  const message = {
    type: 'virtual_console_button_trigger',
    data: {
      buttonId: req.body.buttonId,
      action: req.body.action,
      fadeMs: req.body.fadeMs || undefined,
      timestamp: Date.now()
    }
  };

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });

  res.json({ 
    message: `Button ${req.body.action} signal sent`,
    buttonId: req.body.buttonId,
    action: req.body.action,
    fadeMs: req.body.fadeMs || undefined
  });
});

app.get('/api/virtual-console/layout', (req, res) => {
  return res.json(virtualConsoleLayout);
});

app.post('/api/virtual-console/layout', [
  body('buttons').isArray(),
  body('faders').isArray()
], validateRequest, (req, res) => {
  virtualConsoleLayout = req.body;
  db.saveVirtualConsoleLayout(virtualConsoleLayout);
  return res.json({ message: 'Layout saved' });
});

app.get('/api/virtual-console/states', (req, res) => {
  return res.json(virtualConsoleStates);
});

app.post('/api/virtual-console/states', [
  body('buttons').isObject(),
  body('faders').isObject()
], validateRequest, (req, res) => {
  virtualConsoleStates = req.body;
  db.saveVirtualConsoleStates(virtualConsoleStates);
  return res.json({ message: 'States saved' });
});

// WebSocket authentication
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.send(JSON.stringify({
    type: 'connection_established',
    data: { message: 'Connected to LuminetDMX' }
  }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize Art-Net
initializeArtnet();

// Serve built frontend
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LuminetDMX Backend running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});