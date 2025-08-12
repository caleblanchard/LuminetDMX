const fs = require('fs');
const path = require('path');

class FileDatabase {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
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

  loadCollection(collection, defaultData = []) {
    const filePath = this.getFilePath(collection);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        console.log(`Loaded ${collection}: ${parsed.length} items`);
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

  saveCollection(collection, data) {
    const filePath = this.getFilePath(collection);
    try {
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf8');
      console.log(`Saved ${collection}: ${data.length} items`);
      return true;
    } catch (error) {
      console.error(`Error saving ${collection}:`, error);
      return false;
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
}

module.exports = FileDatabase;