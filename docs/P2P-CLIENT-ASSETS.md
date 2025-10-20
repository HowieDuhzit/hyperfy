# P2P Client Asset Loading System

This document describes Hyperfy's peer-to-peer client asset loading system, which allows browser clients to load 3D models, textures, and other assets directly from the Hyperdrive P2P network instead of traditional HTTP servers.

## Overview

The P2P client asset loading system consists of several components:

1. **ClientLoaderV2** - Enhanced asset loader with P2P support
2. **BrowserHyperdrive** - Browser-compatible Hyperdrive client
3. **HyperdriveBridge** - WebSocket bridge service for browser access
4. **Enhanced World.resolveURL()** - URL resolution for hyperdrive:// URLs

## Architecture

```
┌─────────────────┐    WebSocket    ┌──────────────────┐    Hyperdrive    ┌─────────────────┐
│ Browser Client  │ ←──────────────→ │ Bridge Service   │ ←────────────────→ │ P2P Network     │
│ (ClientLoaderV2)│                 │ (HyperdriveBridge)│                   │ (Asset Storage) │
└─────────────────┘                 └──────────────────┘                   └─────────────────┘
```

### Browser Client (ClientLoaderV2)

The enhanced client loader supports both HTTP and hyperdrive:// URLs:

- **Feature Detection** - Automatically detects P2P capability
- **URL Resolution** - Handles both `asset://` and `hyperdrive://` protocols
- **Fallback Support** - Falls back to HTTP if P2P fails
- **Caching** - Maintains asset cache across transport types

### Bridge Service (HyperdriveBridge)

A WebSocket service that bridges browser clients to Hyperdrive:

- **WebSocket Server** - Listens on port 3001 by default
- **Drive Management** - Manages multiple Hyperdrive instances
- **File Operations** - Supports get, put, list operations
- **Base64 Encoding** - Handles binary data transport over WebSocket

### URL Schemes

The system supports multiple URL schemes:

```javascript
// Traditional HTTP assets
'asset://models/building.glb' → 'http://localhost:3000/assets/models/building.glb'

// P2P Hyperdrive assets (when enabled)
'asset://models/building.glb' → 'hyperdrive://abc123.../models/building.glb'

// Direct Hyperdrive URLs
'hyperdrive://abc123def456.../path/to/asset.glb'
```

## Configuration

### Enable P2P Assets

Set localStorage flags in browser:

```javascript
// Enable ClientLoaderV2
localStorage.setItem('hyperfy_use_loader_v2', 'true')

// Enable P2P asset resolution
localStorage.setItem('hyperfy_assets_type', 'hyperdrive')
```

Or set environment variables:

```bash
# For server-side configuration
export HYPERFY_ASSETS_TYPE=hyperdrive
```

### Bridge Service Configuration

```javascript
const bridge = new HyperdriveBridge({
  port: 3001,                    // WebSocket port
  corestore: './world/corestore' // Hyperdrive storage path
})
```

## Usage

### Start Bridge Service

```bash
# Start bridge service
npm run bridge

# Or manually
node src/core/services/HyperdriveBridge.js
```

### Client Integration

The client automatically detects and uses P2P loading:

```javascript
// This will use P2P if enabled, HTTP otherwise
const model = await world.loader.load('model', 'asset://buildings/house.glb')
const texture = await world.loader.load('texture', 'asset://materials/brick.jpg')
```

### Server Integration

The server automatically provides hyperdrive:// URLs when P2P is enabled:

```javascript
// Server upload endpoint automatically uses appropriate storage
app.post('/api/upload', async (req, reply) => {
  const assetPath = await world.assets.store(filename, buffer, mimeType)
  const assetUrl = await world.assets.getUrl(assetPath) // Returns hyperdrive:// if enabled
  reply.send({ url: assetUrl })
})
```

## Development & Testing

### Run Test Suite

```bash
# Run comprehensive P2P asset test
npm run test:p2p-assets
```

This will:
1. Start a bridge service on port 3001
2. Create test assets in Hyperdrive
3. Validate storage and retrieval
4. Keep bridge running for manual browser testing

### Manual Browser Testing

1. Start the test environment:
   ```bash
   npm run test:p2p-assets
   ```

2. In another terminal, start Hyperfy:
   ```bash
   npm run dev
   ```

3. Open browser to `http://localhost:3000`

4. Enable P2P in browser console:
   ```javascript
   localStorage.setItem('hyperfy_use_loader_v2', 'true')
   localStorage.setItem('hyperfy_assets_type', 'hyperdrive')
   ```

5. Upload or load assets - they should use P2P transport

### Debug Output

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('hyperfy_debug_assets', 'true')
```

Look for console messages like:
```
Loading P2P asset: /models/building.glb from drive: abc123...
Successfully loaded P2P asset: building.glb (2.1 MB)
```

## API Reference

### ClientLoaderV2

Extended asset loader with P2P support:

```javascript
const loader = new ClientLoaderV2(world)

// Check P2P capability
loader.isP2PEnabled() // Returns boolean

// Load assets (automatically chooses transport)
await loader.load('model', 'asset://building.glb')
await loader.load('texture', 'hyperdrive://abc123.../texture.jpg')
```

### BrowserHyperdrive

Browser-compatible Hyperdrive client:

```javascript
import { hyperdriveRegistry } from './utils/BrowserHyperdrive.js'

// Get drive instance
const drive = await hyperdriveRegistry.get('abc123def456...')

// File operations
const buffer = await drive.get('/path/to/file.glb')
await drive.put('/path/to/file.glb', buffer)
const files = await drive.list('/models/')
```

### HyperdriveBridge

WebSocket bridge service:

```javascript
import { HyperdriveBridge } from './services/HyperdriveBridge.js'

const bridge = new HyperdriveBridge({ port: 3001 })
await bridge.start()
```

## Performance Considerations

### Asset Caching

Both HTTP and P2P assets are cached:
- **Memory Cache** - Parsed assets (textures, models)
- **File Cache** - Raw file objects
- **Transport Cache** - Hyperdrive connections

### Fallback Strategy

The system gracefully degrades:
1. Try P2P loading via bridge
2. If bridge unavailable, fall back to HTTP
3. If HTTP fails, show error

### Network Efficiency

- **Incremental Loading** - Assets load on-demand
- **Connection Reuse** - Bridge connections are persistent
- **Compression** - WebSocket deflate for bridge transport

## Troubleshooting

### Common Issues

**Bridge Connection Failed**
```
Error: Failed to connect to bridge at ws://localhost:3001
```
- Ensure bridge service is running: `npm run bridge`
- Check firewall settings
- Verify port 3001 is available

**Asset Not Found**
```
Error: File not found in hyperdrive
```
- Verify asset was uploaded via P2P-enabled server
- Check hyperdrive key matches
- Try HTTP fallback

**WebSocket Errors**
```
Error: WebSocket connection closed
```
- Bridge service may have crashed
- Network connectivity issues
- Restart bridge service

### Debug Commands

```bash
# Test bridge connectivity
curl -v http://localhost:3001

# List hyperdrive contents
node -e "
const drive = require('./src/server/storage/HyperdriveAssetStorage.js')
const storage = new drive.HyperdriveAssetStorage()
await storage.list('/').then(console.log)
"

# Check asset URLs
node -e "
const { AssetFactory } = require('./src/server/storage/AssetFactory.js')
const factory = new AssetFactory()
console.log('P2P Enabled:', factory.isP2PEnabled())
"
```

## Migration Guide

### From HTTP to P2P Assets

1. **Enable P2P** - Set environment/localStorage flags
2. **Start Bridge** - Run bridge service alongside server
3. **Upload Assets** - New uploads automatically use P2P
4. **Client Testing** - Verify browser loading works
5. **Gradual Rollout** - Use feature flags for rollback

### Backwards Compatibility

The system maintains full backwards compatibility:
- Existing HTTP assets continue to work
- Mixed deployments supported
- No breaking changes to API

## Security Considerations

### WebSocket Security

- Bridge service runs on localhost by default
- Consider authentication for production deployments
- Use WSS (secure WebSocket) in production

### Asset Verification

- Assets are content-addressed by hash
- Hyperdrive provides cryptographic verification
- Bridge validates asset integrity

### Network Isolation

- P2P network is isolated per world/project
- Assets cannot leak between worlds
- Encryption provided by Hypercore protocol

## Future Enhancements

### Planned Features

- **Direct P2P** - Native browser P2P without bridge
- **Asset Preloading** - Intelligent prefetch strategies  
- **Metrics** - Performance and usage analytics
- **CDN Hybrid** - Mix P2P and CDN delivery

### Performance Optimizations

- **Asset Bundling** - Group related assets
- **Delta Updates** - Incremental asset changes
- **Smart Caching** - Predictive asset loading
- **Bandwidth Management** - Adaptive quality levels

## Contributing

When working on the P2P asset system:

1. **Test Both Transports** - Verify HTTP and P2P paths
2. **Handle Failures** - Ensure graceful degradation
3. **Document Changes** - Update this document
4. **Performance Testing** - Benchmark large assets
5. **Browser Compatibility** - Test multiple browsers

## Related Documentation

- [P2P Storage System](./P2P-STORAGE.md)
- [Asset Management](./ASSETS.md)
- [Hyperfy Architecture](../README.md)
- [Development Setup](../WARP.md)