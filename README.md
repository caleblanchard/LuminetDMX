# LuminetDMX

A modern web-based DMX over Art-Net lighting console built with Node.js and Angular.

## Features

- **Fixture Template Management**: Create and manage reusable fixture definitions with channel mappings
- **Lighting Patches**: Assign fixture templates to specific DMX addresses and universes
- **Grouping System**: Organize fixtures into groups for synchronized control
- **Virtual Fader Console**: Web-based faders for direct DMX channel control
- **Art-Net Integration**: Broadcast DMX data over Art-Net protocol
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: WebSocket-based live DMX value monitoring
- **Docker Support**: Easy deployment with Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Modern web browser

### Running with Docker

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd LuminetDMX
   ```

2. Start the application:
   ```bash
   docker-compose up -d
   ```

3. Access the application — the single container serves the UI, REST API, and WebSocket together:
   - App + API: http://localhost (container port 3000, mapped to 80)
   - REST API: http://localhost/api
   - WebSocket: ws://localhost/ws
   - Note: the dev compose file (`docker-compose.dev.yml`) maps container port 3000 to host port 3000 instead → http://localhost:3000

### Development Setup

#### Backend Development

```bash
cd backend
npm install
npm run dev
```

#### Frontend Development

```bash
cd frontend
npm install
npm start
```

The dev server runs on http://localhost:4200 and proxies `/api/**` and `/ws` to the backend at http://localhost:3000 (see `proxy.conf.json`), so run the backend first.

## Architecture

### Backend (Node.js)

- **Express.js**: REST API server
- **WebSocket**: Real-time communication
- **Art-Net**: DMX over Art-Net protocol implementation
- **File-based persistence**: Fixture data and DMX values cached in memory and saved to JSON files in `backend/data/` (see `DATA_PERSISTENCE.md`)

### Frontend (Angular)

- **Angular 18**: Modern web framework
- **Standalone Components**: Modular architecture
- **Responsive Design**: Mobile-first approach
- **Real-time Updates**: WebSocket integration

## API Endpoints

> Full interactive documentation is served at `/api/docs` (Swagger UI) and detailed in [`API.md`](API.md). The list below covers every REST route.

### Fixture Templates
- `GET /api/fixture-templates` - List all templates
- `POST /api/fixture-templates` - Create new template
- `PUT /api/fixture-templates/:id` - Update template
- `DELETE /api/fixture-templates/:id` - Delete template

### Patches
- `GET /api/patches` - List all patches
- `POST /api/patches` - Create new patch (template + universe + start address)
- `PUT /api/patches/:id` - Update patch
- `DELETE /api/patches/:id` - Delete patch
- `POST /api/patches/bulk` - Create multiple patches at once, auto-assigning available addresses
- `POST /api/patches/check-addresses` - Dry-run: check whether a run of fixtures fits (no changes made)
- `GET /api/patches/used-addresses/:universe` - Get DMX address ranges already in use in a universe

### Groups
- `GET /api/groups` - List all groups
- `POST /api/groups` - Create new group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Presets
- `GET /api/presets` - List all presets
- `POST /api/presets` - Create new preset
- `PUT /api/presets/:id` - Update preset
- `DELETE /api/presets/:id` - Delete preset
- `POST /api/presets/:id/apply` - Apply a preset's channel values to the live DMX output (optional fade)
- `POST /api/presets/:id/clear` - Clear a preset's channels back to 0 (optional fade)

### DMX Control
- `POST /api/dmx/set-channel` - Set a single channel (1-512, value 0-255)
- `POST /api/dmx/set-multiple` - Set multiple channel values (optional `fadeMs`)
- `GET /api/dmx/values` - Get all 512 current DMX values
- `POST /api/dmx/blackout` - Set all channels to 0 (optional `fadeMs`)
- `POST /api/dmx/clear-all` - Alias of blackout (optional `fadeMs`)

### Virtual Console
- `POST /api/virtual-console/button/trigger` - External webhook: broadcast a button `activate`/`deactivate`/`toggle` to the console over WebSocket
- `GET /api/virtual-console/layout` - Get the saved button/fader layout
- `POST /api/virtual-console/layout` - Save the button/fader layout
- `GET /api/virtual-console/states` - Get the saved button/fader states
- `POST /api/virtual-console/states` - Save the button/fader states

### Configuration
- `GET /api/universe-config` - Get Art-Net configuration
- `POST /api/universe-config` - Update Art-Net configuration (universe, broadcast IP) and re-initialize the socket

### WebSocket
- `ws://<host>/ws` - Real-time DMX value and virtual-console updates (server → client)

## Usage Guide

### 1. Create Fixture Templates

Navigate to the Fixtures section to create templates for your lighting equipment:
- Define fixture name, manufacturer, and model
- Specify channel count and individual channel definitions
- Set channel types (dimmer, color, position, gobo, other)

### 2. Configure Patches

In the Patches section, assign your fixture templates to DMX addresses:
- Select a fixture template
- Set the starting DMX address
- Configure the universe number

### 3. Create Groups

Organize multiple fixtures into groups for easier control:
- Select fixtures to include in the group
- Assign a color for visual identification
- Use group master faders for synchronized control

### 4. Use the Console

The Console provides two control modes:
- **Individual Mode**: Direct control of all 512 DMX channels
- **Group Mode**: Control fixtures by groups with master faders

### 5. Configure Art-Net

In Settings, configure your Art-Net output:
- Set the universe number (0-32767)
- Configure the broadcast IP address
- Test the connection to your lighting equipment

## Art-Net Configuration

LuminetDMX broadcasts standard Art-Net packets on UDP port 6454 (plus a debug copy on 6455). Configure your lighting equipment to receive Art-Net data from the server's IP address.

### Common Art-Net Settings:
- **Universe**: 0-32767 (typically 0-15 for most equipment)
- **Broadcast IP**: 255.255.255.255 (subnet broadcast) or specific device IP
- **Protocol**: Art-Net 4
- **Refresh**: Event-driven — packets are sent when DMX values change (fades step at ~33 Hz)

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues, feature requests, or questions, please create an issue on the GitHub repository.