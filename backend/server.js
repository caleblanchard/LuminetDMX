const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const { v4: uuidv4 } = require('uuid');
const FileDatabase = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

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
  // Ensure universe is treated as a number for comparison
  const targetUniverse = typeof universe === 'string' ? parseInt(universe) : universe;
  const relevantPatches = patches.filter(p => {
    const patchUniverse = typeof p.universe === 'string' ? parseInt(p.universe) : p.universe;
    return patchUniverse === targetUniverse;
  });
  
  console.log(`Getting used addresses for universe ${universe} (parsed: ${targetUniverse}):`, {
    totalPatches: patches.length,
    relevantPatches: relevantPatches.length,
    relevantPatchData: relevantPatches.map(p => ({ 
      name: p.name, 
      universe: p.universe, 
      universeType: typeof p.universe,
      startAddress: p.startAddress 
    }))
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
  
  console.log(`Used address ranges for universe ${universe}:`, usedRanges);
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
  
  console.log(`Finding addresses for ${quantity} fixtures starting at ${startAddress} in universe ${universe}`);
  
  for (let i = 0; i < quantity; i++) {
    // Check if current address has a conflict
    const hasConflict = hasAddressConflict(universe, currentAddress, template.channelCount);
    console.log(`Checking address ${currentAddress}-${currentAddress + template.channelCount - 1}: conflict = ${hasConflict}`);
    
    if (hasConflict) {
      return { 
        error: `Address conflict at channels ${currentAddress}-${currentAddress + template.channelCount - 1}. Cannot place ${quantity} fixtures starting from address ${startAddress}.`,
        availableAddresses: addresses
      };
    }
    
    // Check if we would exceed the DMX limit
    if (currentAddress + template.channelCount - 1 > 512) {
      return {
        error: `Would exceed DMX channel limit (512). Cannot place fixture at address ${currentAddress}.`,
        availableAddresses: addresses
      };
    }
    
    addresses.push(currentAddress);
    currentAddress += template.channelCount;
  }
  
  console.log(`Successfully found addresses: ${addresses}`);
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
    
    // Bind to a random port first, then set broadcast
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
  
  // Art-Net header: "Art-Net\0"
  packet.write('Art-Net\0', 0, 8, 'ascii');
  
  // OpCode for ArtDMX: 0x5000 (little-endian)
  packet.writeUInt16LE(0x5000, 8);
  
  // Protocol version: 14 (0x000e)
  packet.writeUInt16BE(14, 10);
  
  // Sequence: 0 (no sequence)
  packet.writeUInt8(0, 12);
  
  // Physical input port: 0
  packet.writeUInt8(0, 13);
  
  // Universe (subnet + universe)
  packet.writeUInt16LE(universe, 14);
  
  // Data length: 512 (high byte first)
  packet.writeUInt16BE(512, 16);
  
  // DMX data (512 channels)
  for (let i = 0; i < 512; i++) {
    packet.writeUInt8(dmxData[i] || 0, 18 + i);
  }
  
  return packet;
}

function broadcastDMX() {
  console.log('Broadcasting DMX data:', {
    universe: universeConfig.universe,
    broadcastIP: universeConfig.broadcastIP,
    nonZeroChannels: dmxValues.filter(v => v > 0).length
  });
  
  if (artnetSocket) {
    try {
      const packet = createArtNetPacket(universeConfig.universe, dmxValues);
      
      // Log packet details for debugging
      console.log('Art-Net packet details:', {
        size: packet.length,
        header: packet.toString('ascii', 0, 8),
        opcode: '0x' + packet.readUInt16LE(8).toString(16),
        universe: packet.readUInt16LE(14),
        dataLength: packet.readUInt16BE(16)
      });
      
      // Send to Art-Net port
      artnetSocket.send(packet, 6454, universeConfig.broadcastIP, (error) => {
        if (error) {
          console.error('Failed to send Art-Net packet:', error);
        } else {
          console.log('Art-Net packet sent successfully to', universeConfig.broadcastIP + ':6454');
        }
      });
      
      // Also send to test port 6455 for debugging
      artnetSocket.send(packet, 6455, universeConfig.broadcastIP, (error) => {
        if (!error) {
          console.log('Debug packet also sent to port 6455');
        }
      });
      
    } catch (error) {
      console.error('Failed to create/send Art-Net packet:', error);
    }
  } else {
    console.warn('Art-Net socket not initialized, cannot send data');
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

// Apply a set of channel values with optional fade
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

app.get('/api/fixture-templates', (req, res) => {
  res.json(fixtureTemplates);
});

app.post('/api/fixture-templates', (req, res) => {
  const template = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  const savedTemplate = db.insert('fixture_templates', template);
  fixtureTemplates = db.find('fixture_templates');
  res.json(savedTemplate);
});

app.put('/api/fixture-templates/:id', (req, res) => {
  const updatedTemplate = db.update('fixture_templates', req.params.id, req.body);
  if (!updatedTemplate) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  fixtureTemplates = db.find('fixture_templates');
  res.json(updatedTemplate);
});

app.delete('/api/fixture-templates/:id', (req, res) => {
  const deleted = db.delete('fixture_templates', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  fixtureTemplates = db.find('fixture_templates');
  res.json({ message: 'Template deleted' });
});

app.get('/api/patches', (req, res) => {
  res.json(patches);
});

app.post('/api/patches', (req, res) => {
  const template = fixtureTemplates.find(t => t.id === req.body.templateId);
  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  // Check for address conflicts
  if (hasAddressConflict(req.body.universe, req.body.startAddress, template.channelCount)) {
    return res.status(400).json({ 
      error: `Address conflict: Channels ${req.body.startAddress}-${req.body.startAddress + template.channelCount - 1} are already in use`
    });
  }

  const patch = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  const savedPatch = db.insert('patches', patch);
  patches = db.find('patches');
  res.json(savedPatch);
});

app.put('/api/patches/:id', (req, res) => {
  const existingPatch = patches.find(p => p.id === req.params.id);
  if (!existingPatch) {
    return res.status(404).json({ error: 'Patch not found' });
  }

  // If updating template or address, check for conflicts
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

  const updatedPatch = db.update('patches', req.params.id, req.body);
  patches = db.find('patches');
  res.json(updatedPatch);
});

app.delete('/api/patches/:id', (req, res) => {
  const deleted = db.delete('patches', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Patch not found' });
  }
  
  patches = db.find('patches');
  res.json({ message: 'Patch deleted' });
});

// Bulk patch creation endpoint
app.post('/api/patches/bulk', (req, res) => {
  const { templateId, universe, quantity, baseName, startAddress } = req.body;
  
  if (!templateId || universe === undefined || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'Missing required fields: templateId, universe, quantity' });
  }

  const template = fixtureTemplates.find(t => t.id === templateId);
  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  // Find available addresses
  const addressResult = findAvailableAddresses(universe, templateId, quantity, startAddress);
  if (addressResult.error) {
    return res.status(400).json(addressResult);
  }

  // Create patches
  const createdPatches = [];
  const timestamp = new Date().toISOString();
  
  addressResult.addresses.forEach((address, index) => {
    const patchName = baseName ? `${baseName} ${index + 1}` : `${template.name} ${index + 1}`;
    const patch = {
      id: uuidv4(),
      name: patchName,
      templateId,
      universe,
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

// Address availability check endpoint
app.post('/api/patches/check-addresses', (req, res) => {
  const { templateId, universe, quantity, startAddress } = req.body;
  
  console.log('Address availability check request:', { templateId, universe, quantity, startAddress });
  
  const template = fixtureTemplates.find(t => t.id === templateId);
  if (!template) {
    return res.status(400).json({ error: 'Template not found' });
  }

  const addressResult = findAvailableAddresses(universe, templateId, quantity, startAddress);
  console.log('Address availability result:', addressResult);
  
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

// Get used addresses for a universe
app.get('/api/patches/used-addresses/:universe', (req, res) => {
  const universe = parseInt(req.params.universe);
  const usedRanges = getUsedAddresses(universe);
  res.json({ usedRanges });
});

app.get('/api/groups', (req, res) => {
  res.json(groups);
});

app.post('/api/groups', (req, res) => {
  const group = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  const savedGroup = db.insert('groups', group);
  groups = db.find('groups');
  res.json(savedGroup);
});

app.put('/api/groups/:id', (req, res) => {
  const updatedGroup = db.update('groups', req.params.id, req.body);
  if (!updatedGroup) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  groups = db.find('groups');
  res.json(updatedGroup);
});

app.delete('/api/groups/:id', (req, res) => {
  const deleted = db.delete('groups', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  groups = db.find('groups');
  res.json({ message: 'Group deleted' });
});

// Preset endpoints
app.get('/api/presets', (req, res) => {
  res.json(presets);
});

app.post('/api/presets', (req, res) => {
  const preset = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  const savedPreset = db.insert('presets', preset);
  presets = db.find('presets');
  res.json(savedPreset);
});

app.put('/api/presets/:id', (req, res) => {
  const updatedPreset = db.update('presets', req.params.id, {
    ...req.body,
    updatedAt: new Date().toISOString()
  });
  if (!updatedPreset) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  
  presets = db.find('presets');
  res.json(updatedPreset);
});

app.delete('/api/presets/:id', (req, res) => {
  const deleted = db.delete('presets', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  
  presets = db.find('presets');
  res.json({ message: 'Preset deleted' });
});

// Apply preset endpoint
app.post('/api/presets/:id/apply', (req, res) => {
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

// Clear a preset (set its channels to 0) with optional fade
app.post('/api/presets/:id/clear', (req, res) => {
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

app.get('/api/universe-config', (req, res) => {
  res.json(universeConfig);
});

app.post('/api/universe-config', (req, res) => {
  universeConfig = { ...universeConfig, ...req.body };
  db.saveUniverseConfig(universeConfig);
  initializeArtnet();
  res.json(universeConfig);
});

app.post('/api/dmx/set-channel', (req, res) => {
  const { channel, value } = req.body;
  
  console.log(`Setting DMX channel ${channel} to value ${value}`);
  
  if (channel < 1 || channel > 512 || value < 0 || value > 255) {
    console.error('Invalid channel or value:', { channel, value });
    return res.status(400).json({ error: 'Invalid channel or value' });
  }
  
  dmxValues[channel - 1] = value;
  db.saveDmxValues(dmxValues);
  broadcastDMX();
  res.json({ channel, value });
});

app.post('/api/dmx/set-multiple', (req, res) => {
  const { channels } = req.body;
  
  for (const { channel, value } of channels) {
    if (channel >= 1 && channel <= 512 && value >= 0 && value <= 255) {
      dmxValues[channel - 1] = value;
    }
  }
  
  db.saveDmxValues(dmxValues);
  broadcastDMX();
  res.json({ message: 'Channels updated' });
});

app.get('/api/dmx/values', (req, res) => {
  res.json(dmxValues);
});

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

initializeArtnet();

// Serve built frontend from /app/public if present
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  // Static assets
  app.use(express.static(publicDir));

  // SPA fallback for non-API routes
  app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LuminetDMX Backend running on port ${PORT}`);
});