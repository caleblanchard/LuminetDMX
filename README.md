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

3. Access the application:
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:3000

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

## Architecture

### Backend (Node.js)

- **Express.js**: REST API server
- **WebSocket**: Real-time communication
- **Art-Net**: DMX over Art-Net protocol implementation
- **In-memory storage**: Fast access to fixture data and DMX values

### Frontend (Angular)

- **Angular 16**: Modern web framework
- **Standalone Components**: Modular architecture
- **Responsive Design**: Mobile-first approach
- **Real-time Updates**: WebSocket integration

## API Endpoints

### Fixture Templates
- `GET /api/fixture-templates` - List all templates
- `POST /api/fixture-templates` - Create new template
- `PUT /api/fixture-templates/:id` - Update template
- `DELETE /api/fixture-templates/:id` - Delete template

### Patches
- `GET /api/patches` - List all patches
- `POST /api/patches` - Create new patch
- `PUT /api/patches/:id` - Update patch
- `DELETE /api/patches/:id` - Delete patch

### Groups
- `GET /api/groups` - List all groups
- `POST /api/groups` - Create new group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### DMX Control
- `POST /api/dmx/set-channel` - Set single channel value
- `POST /api/dmx/set-multiple` - Set multiple channel values
- `GET /api/dmx/values` - Get current DMX values

### Configuration
- `GET /api/universe-config` - Get Art-Net configuration
- `POST /api/universe-config` - Update Art-Net configuration

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

LuminetDMX broadcasts standard Art-Net packets on UDP port 6454. Configure your lighting equipment to receive Art-Net data from the server's IP address.

### Common Art-Net Settings:
- **Universe**: 0-32767 (typically 0-15 for most equipment)
- **Broadcast IP**: 255.255.255.255 (subnet broadcast) or specific device IP
- **Protocol**: Art-Net 4
- **Refresh Rate**: 44 Hz (recommended)

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