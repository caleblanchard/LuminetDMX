# LuminetDMX Data Persistence

LuminetDMX uses a file-based JSON database to persist all configuration data across restarts.

## Data Storage

All data is stored in JSON files within the `/backend/data/` directory:

- `fixture_templates.json` - Fixture template definitions
- `patches.json` - Lighting patch configurations  
- `groups.json` - Fixture group definitions
- `dmx_values.json` - Current DMX channel values
- `universe_config.json` - Art-Net universe and broadcast settings

## Docker Configuration

### Production Mode
Uses the standard `docker-compose.yml` with a named Docker volume:

```bash
docker-compose up -d
```

The `luminet-data` volume persists data between container restarts and updates.

### Development Mode
Uses `docker-compose.dev.yml` with local directory mounting:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This mounts `./backend/data` locally for easy access and debugging.

### Local Development
When running locally without Docker:

```bash
cd backend
node server.js
```

Data is stored in `./backend/data/` by default. You can override this with:

```bash
DATA_DIR=/custom/path node server.js
```

## Data Backup

To backup your configuration:

```bash
# Copy the entire data directory
cp -r backend/data/ backup_$(date +%Y%m%d)/

# Or backup from Docker volume
docker run --rm -v luminet-data:/data -v $(pwd):/backup alpine tar czf /backup/luminet_backup.tar.gz -C /data .
```

## Data Recovery

To restore from backup:

```bash
# Local restore
cp -r backup_20231201/* backend/data/

# Docker volume restore  
docker run --rm -v luminet-data:/data -v $(pwd):/backup alpine tar xzf /backup/luminet_backup.tar.gz -C /data
```

## Initial Setup

The application automatically creates default empty configurations on first run if no data files exist. No manual database setup is required.