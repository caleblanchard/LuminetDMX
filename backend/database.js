const fs = require('fs');
const path = require('path');

class FileDatabase {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
    
    // Cache for collections to avoid reloading from disk
    this.cache = {
      fixture_templates: null,
      patches: null,
      groups: null,
      presets: null
    };
    
    // Lock file for write operations
    this.lockFile = path.join(this.dataDir, '.lock');
    this.writeQueue = [];
    this.isWriting = false;
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      console.log(`Creating data directory: ${this.dataDir}`);
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  // Load collection from cache or disk
  loadCollection(collection, defaultData = []) {
    // Return from cache if available
    if (this.cache[collection] !== null) {
      return this.cache[collection];
    }
    
    const filePath = this.getFilePath(collection);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        console.log(`Loaded ${collection}: ${parsed.length} items`);
        // Cache the data
        this.cache[collection] = parsed;
        return parsed;
      } else {
        console.log(`No existing data file for ${collection}, using defaults`);
        this.saveCollection(collection, defaultData);
        return defaultData;
      }
    } catch (error) {
      console.error(`Error loading ${collection}:`, error);
      return defaultData;
    }
  }

  // Save collection to disk and invalidate cache
  saveCollection(collection, data) {
    const filePath = this.getFilePath(collection);
    try {
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      console.log(`Saved ${collection}: ${data.length} items`);
      // Invalidate cache
      this.cache[collection] = null;
      return true;
    } catch (error) {
      console.error(`Error saving ${collection}:`, error);
      return false;
    }
  }

  // Acquire lock for write operations
  async acquireLock() {
    const maxAttempts = 10;
    const delay = 100;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        if (!fs.existsSync(this.lockFile)) {
          fs.writeFileSync(this.lockFile, process.pid.toString(), 'utf8');
          return true;
        }
        // Check if lock is stale (process not running)
        const pid = fs.readFileSync(this.lockFile, 'utf8');
        try {
          process.kill(parseInt(pid), 0);
        } catch (e) {
          // Process doesn't exist, remove stale lock
          fs.unlinkSync(this.lockFile);
          continue;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  // Release lock
  releaseLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        const pid = fs.readFileSync(this.lockFile, 'utf8');
        if (parseInt(pid) === process.pid) {
          fs.unlinkSync(this.lockFile);
        }
      }
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  // Queue write operations to prevent corruption
  async queueWrite(operation) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }
    
    this.isWriting = true;
    const { operation, resolve, reject } = this.writeQueue.shift();
    
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isWriting = false;
      setImmediate(() => this.processQueue());
    }
  }

  // CRUD operations
  find(collection, filter = {}) {
    const data = this.loadCollection(collection);
    if (Object.keys(filter).length === 0) return data;
    
    return data.filter(item => {
      return Object.keys(filter).every(key => item[key] === filter[key]);
    });
  }

  findById(collection, id) {
    const data = this.loadCollection(collection);
    return data.find(item => item.id === id);
  }

  insert(collection, item) {
    const data = this.loadCollection(collection);
    data.push(item);
    this.saveCollection(collection, data);
    return item;
  }

  update(collection, id, updates) {
    const data = this.loadCollection(collection);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates };
    this.saveCollection(collection, data);
    return data[index];
  }

  delete(collection, id) {
    const data = this.loadCollection(collection);
    const index = data.findIndex(item => item.id === id);
    
    if (index === -1) return false;
    
    const deleted = data.splice(index, 1)[0];
    this.saveCollection(collection, data);
    return deleted;
  }

  // Special method for DMX values
  loadDmxValues() {
    const filePath = this.getFilePath('dmx_values');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        console.log('Loaded DMX values from file');
        return parsed;
      } else {
        const defaultValues = new Array(512).fill(0);
        this.saveDmxValues(defaultValues);
        console.log('Created default DMX values');
        return defaultValues;
      }
    } catch (error) {
      console.error('Error loading DMX values:', error);
      return new Array(512).fill(0);
    }
  }

  saveDmxValues(values) {
    const filePath = this.getFilePath('dmx_values');
    try {
      const jsonData = JSON.stringify(values, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving DMX values:', error);
      return false;
    }
  }

  // Universe config methods
  loadUniverseConfig() {
    const filePath = this.getFilePath('universe_config');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        console.log('Loaded universe config from file');
        return parsed;
      } else {
        const defaultConfig = {
          universe: 0,
          broadcastIP: '255.255.255.255'
        };
        this.saveUniverseConfig(defaultConfig);
        console.log('Created default universe config');
        return defaultConfig;
      }
    } catch (error) {
      console.error('Error loading universe config:', error);
      return {
        universe: 0,
        broadcastIP: '255.255.255.255'
      };
    }
  }

  saveUniverseConfig(config) {
    const filePath = this.getFilePath('universe_config');
    try {
      const jsonData = JSON.stringify(config, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      console.log('Saved universe config');
      return true;
    } catch (error) {
      console.error('Error saving universe config:', error);
      return false;
    }
  }

  // Virtual console layout and states persistence
  loadVirtualConsoleLayout() {
    const filePath = this.getFilePath('virtual_console_layout');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed;
      } else {
        const defaultLayout = { buttons: [], faders: [] };
        this.saveVirtualConsoleLayout(defaultLayout);
        return defaultLayout;
      }
    } catch (error) {
      console.error('Error loading virtual console layout:', error);
      return { buttons: [], faders: [] };
    }
  }

  saveVirtualConsoleLayout(layout) {
    const filePath = this.getFilePath('virtual_console_layout');
    try {
      const jsonData = JSON.stringify(layout, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving virtual console layout:', error);
      return false;
    }
  }

  loadVirtualConsoleStates() {
    const filePath = this.getFilePath('virtual_console_states');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        return parsed;
      } else {
        const defaultStates = { buttons: {}, faders: {} };
        this.saveVirtualConsoleStates(defaultStates);
        return defaultStates;
      }
    } catch (error) {
      console.error('Error loading virtual console states:', error);
      return { buttons: {}, faders: {} };
    }
  }

  saveVirtualConsoleStates(states) {
    const filePath = this.getFilePath('virtual_console_states');
    try {
      const jsonData = JSON.stringify(states, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving virtual console states:', error);
      return false;
    }
  }
}

module.exports = FileDatabase;