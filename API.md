# LuminetDMX API Documentation

LuminetDMX provides a comprehensive REST API for external integrations, allowing you to control lighting systems from external applications, automation systems, or custom scripts.

## Base URL

When running locally: `http://localhost:3000/api`
When running in container: `http://your-container-host:3000/api`

## Authentication

Currently, the API does not require authentication. Ensure your deployment is properly secured if exposing to external networks.

## Content Type

All POST/PUT requests should use `Content-Type: application/json`.

## Quick Start Examples

### Trigger a Preset
```bash
# Apply preset with ID "preset-123" with a 2-second fade
curl -X POST http://localhost:3000/api/presets/preset-123/apply \
  -H "Content-Type: application/json" \
  -d '{"fadeMs": 2000}'
```

### Trigger a Virtual Console Button
```bash
# Activate virtual console button with ID "button-456"
curl -X POST http://localhost:3000/api/virtual-console/button/trigger \
  -H "Content-Type: application/json" \
  -d '{"buttonId": "button-456", "action": "activate", "fadeMs": 1500}'
```

### Set Individual DMX Channels
```bash
# Set multiple DMX channels with fade
curl -X POST http://localhost:3000/api/dmx/set-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [
      {"channel": 1, "value": 255},
      {"channel": 2, "value": 128},
      {"channel": 3, "value": 0}
    ],
    "fadeMs": 3000
  }'
```

## API Endpoints

### Presets

#### Get All Presets
```
GET /api/presets
```

**Response:**
```json
[
  {
    "id": "preset-123",
    "name": "Stage Wash",
    "description": "Basic stage wash lighting",
    "fadeMs": 1000,
    "channelValues": [
      {"channel": 1, "value": 255, "patchId": "patch-1", "patchName": "Front Wash"},
      {"channel": 2, "value": 200, "patchId": "patch-2", "patchName": "Side Light"}
    ],
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

#### Apply Preset
```
POST /api/presets/{presetId}/apply
```

**Body:**
```json
{
  "fadeMs": 2000  // Optional: Override preset's default fade duration
}
```

**Response:**
```json
{
  "message": "Applied preset \"Stage Wash\"",
  "channelsUpdated": 12,
  "fadeMs": 2000
}
```

#### Clear Preset
```
POST /api/presets/{presetId}/clear
```

**Body:**
```json
{
  "fadeMs": 1500  // Optional: Override preset's default fade duration
}
```

Fades all channels in the preset to zero.

### Virtual Console Buttons

#### Trigger Button
```
POST /api/virtual-console/button/trigger
```

**Body:**
```json
{
  "buttonId": "button-456",     // Required: Virtual console button ID
  "action": "activate",         // Required: "activate", "deactivate", or "toggle"
  "fadeMs": 1500               // Optional: Override button's fade duration
}
```

**Actions:**
- `activate`: Turn button on (if not already on)
- `deactivate`: Turn button off (if not already off)
- `toggle`: Switch button state (on→off or off→on)

**Response:**
```json
{
  "message": "Button activate signal sent",
  "buttonId": "button-456",
  "action": "activate",
  "fadeMs": 1500
}
```

**Note:** This endpoint sends a WebSocket message to the virtual console frontend, which then handles the button state change and preset application.

### DMX Control

#### Set Single Channel
```
POST /api/dmx/set-channel
```

**Body:**
```json
{
  "channel": 1,     // DMX channel (1-512)
  "value": 255      // DMX value (0-255)
}
```

#### Set Multiple Channels
```
POST /api/dmx/set-multiple
```

**Body:**
```json
{
  "channels": [
    {"channel": 1, "value": 255},
    {"channel": 2, "value": 128},
    {"channel": 3, "value": 0}
  ],
  "fadeMs": 2000      // Optional: Fade duration in milliseconds
}
```

**Response:**
```json
{
  "message": "Channels updated with fade",
  "fadeMs": 2000
}
```

#### Get Current DMX Values
```
GET /api/dmx/values
```

**Response:**
```json
[0, 255, 128, 0, 0, ...]  // Array of 512 DMX values (0-255)
```

#### Blackout
```
POST /api/dmx/blackout
```

**Body:**
```json
{
  "fadeMs": 3000      // Optional: Fade duration for blackout
}
```

Sets all 512 DMX channels to 0.

### System Information

#### Get Groups
```
GET /api/groups
```

Returns all lighting groups for reference.

#### Get Patches
```
GET /api/patches
```

Returns all fixture patches for understanding channel assignments.

#### Get Fixture Templates
```
GET /api/fixture-templates
```

Returns all fixture definitions for understanding channel layouts.

## WebSocket Integration

Connect to WebSocket for real-time updates: `ws://localhost:3000/ws`

### WebSocket Message Types

#### DMX Updates
```json
{
  "type": "dmx_update",
  "data": [0, 255, 128, ...]  // Current DMX values
}
```

#### Virtual Console Button Triggers
```json
{
  "type": "virtual_console_button_trigger",
  "data": {
    "buttonId": "button-456",
    "action": "activate",
    "fadeMs": 1500,
    "timestamp": 1642234567890
  }
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

Error responses include descriptive messages:
```json
{
  "error": "Address conflict: Channels 1-8 are already in use"
}
```

## Integration Examples

### Python Example
```python
import requests
import json

# LuminetDMX API client
class LuminetDMXClient:
    def __init__(self, base_url="http://localhost:3000/api"):
        self.base_url = base_url
    
    def apply_preset(self, preset_id, fade_ms=None):
        """Apply a lighting preset with optional fade"""
        url = f"{self.base_url}/presets/{preset_id}/apply"
        data = {}
        if fade_ms:
            data["fadeMs"] = fade_ms
        
        response = requests.post(url, json=data)
        return response.json()
    
    def trigger_button(self, button_id, action="toggle", fade_ms=None):
        """Trigger a virtual console button"""
        url = f"{self.base_url}/virtual-console/button/trigger"
        data = {
            "buttonId": button_id,
            "action": action
        }
        if fade_ms:
            data["fadeMs"] = fade_ms
        
        response = requests.post(url, json=data)
        return response.json()
    
    def set_channels(self, channels, fade_ms=None):
        """Set multiple DMX channels"""
        url = f"{self.base_url}/dmx/set-multiple"
        data = {"channels": channels}
        if fade_ms:
            data["fadeMs"] = fade_ms
        
        response = requests.post(url, json=data)
        return response.json()

# Usage example
client = LuminetDMXClient()

# Apply a preset with 3-second fade
client.apply_preset("my-preset-id", fade_ms=3000)

# Activate a virtual console button
client.trigger_button("my-button-id", "activate", fade_ms=1500)

# Set specific channels
client.set_channels([
    {"channel": 1, "value": 255},
    {"channel": 2, "value": 128}
], fade_ms=2000)
```

### Node.js Example
```javascript
const axios = require('axios');

class LuminetDMXClient {
    constructor(baseUrl = 'http://localhost:3000/api') {
        this.baseUrl = baseUrl;
    }
    
    async applyPreset(presetId, fadeMs = null) {
        const data = fadeMs ? { fadeMs } : {};
        const response = await axios.post(`${this.baseUrl}/presets/${presetId}/apply`, data);
        return response.data;
    }
    
    async triggerButton(buttonId, action = 'toggle', fadeMs = null) {
        const data = { buttonId, action };
        if (fadeMs) data.fadeMs = fadeMs;
        
        const response = await axios.post(`${this.baseUrl}/virtual-console/button/trigger`, data);
        return response.data;
    }
    
    async setChannels(channels, fadeMs = null) {
        const data = { channels };
        if (fadeMs) data.fadeMs = fadeMs;
        
        const response = await axios.post(`${this.baseUrl}/dmx/set-multiple`, data);
        return response.data;
    }
}

// Usage
const client = new LuminetDMXClient();

// Apply preset
await client.applyPreset('preset-123', 2000);

// Trigger virtual console button
await client.triggerButton('button-456', 'activate', 1500);
```

### cURL Examples
```bash
# Get all presets
curl -X GET http://localhost:3000/api/presets

# Apply preset with fade
curl -X POST http://localhost:3000/api/presets/preset-123/apply \
  -H "Content-Type: application/json" \
  -d '{"fadeMs": 2000}'

# Activate virtual console button
curl -X POST http://localhost:3000/api/virtual-console/button/trigger \
  -H "Content-Type: application/json" \
  -d '{"buttonId": "button-456", "action": "activate"}'

# Set DMX channels
curl -X POST http://localhost:3000/api/dmx/set-multiple \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [
      {"channel": 1, "value": 255},
      {"channel": 2, "value": 128}
    ],
    "fadeMs": 1000
  }'

# Blackout with fade
curl -X POST http://localhost:3000/api/dmx/blackout \
  -H "Content-Type: application/json" \
  -d '{"fadeMs": 3000}'
```

## Finding Button and Preset IDs

### Get Button IDs
Virtual console button IDs are generated when buttons are created in the web interface. To find them:

1. Open the virtual console in your web browser
2. Open browser developer tools (F12)
3. In the console, run: `localStorage.getItem('virtualConsoleLayout')`
4. This will show all buttons with their IDs and configurations

### Get Preset IDs
```bash
curl -X GET http://localhost:3000/api/presets
```

This returns all presets with their IDs and channel configurations.

## Best Practices

1. **Fade Durations**: Use reasonable fade times (100-5000ms) to avoid overwhelming the system
2. **Rate Limiting**: Don't send commands faster than every 50ms to ensure smooth operation
3. **Error Handling**: Always check response status codes and handle errors gracefully
4. **WebSocket**: Consider using WebSocket for real-time feedback on lighting state changes
5. **Testing**: Use the web interface to test configurations before automating with external applications

## Troubleshooting

### Common Issues

1. **Button ID not found**: Ensure the virtual console button exists and check the ID
2. **Connection refused**: Verify the LuminetDMX backend is running and accessible
3. **Fade not working**: Check that fadeMs is a positive number and the system isn't overloaded
4. **Channels not responding**: Verify Art-Net configuration and network connectivity

### Debug Mode

Enable debug logging in the LuminetDMX settings to see detailed API operation logs in the browser console.