# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Quick Commands

### Development
```bash
# Full development (builds both server and client, starts with hot reload)
npm run dev

# Production build
npm run build

# Start production server (after building)
npm run start

# Clean world storage and assets (removes unused blueprints and assets)
npm run world:clean
```

### Code Quality
```bash
# Lint JavaScript/JSX files
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format code with Prettier
npm run format

# Run both lint and format checks
npm run check
```

### Individual Builds
```bash
# Build only client (world-client.js)
npm run client:build
npm run client:dev    # with watch mode

# Build only viewer component
npm run viewer:build
npm run viewer:dev    # with watch mode
```

### Pear Desktop App
```bash
# Run as Pear desktop app (requires building first)
npm run build && npm run pear:dev

# Stage for production
npm run pear:stage

# Seed to Pear network
npm run pear:seed

# Release to production channel
npm run pear:release
```

## Architecture Overview

Hyperfy is a 3D virtual world engine with a sophisticated Entity Component System (ECS) architecture:

### Core Structure
- **`src/core/`** - Shared game engine code (client/server)
  - `World.js` - Main ECS world class with fixed timestep physics loop
  - `systems/` - ECS systems (Apps, Physics, Entities, Scripts, etc.)
  - `createClientWorld.js/createServerWorld.js` - World factory functions
- **`src/server/`** - Fastify-based Node.js server with WebSocket support  
- **`src/client/`** - Browser client with Three.js rendering
- **`scripts/`** - ESBuild-based build system with hot reload

### World Systems Architecture

The `World` class manages multiple systems in a specific tick order:
1. **Apps** - App lifecycle and script execution
2. **Anchors** - Spatial positioning system  
3. **Events** - Event handling and messaging
4. **Scripts** - JavaScript execution sandbox (SES-based)
5. **Entities** - Entity management and networking
6. **Physics** - PhysX-based physics simulation (server-side)
7. **Stage** - Scene graph and rendering

### Build Pipeline

The build system uses ESBuild with custom plugins:
- **Server**: Bundles to `build/index.js` with external dependencies, includes PhysX WASM
- **Client**: Bundles with hash-based filenames, injects into HTML template
- **Development**: Concurrent builds with file watching and auto-restart

### World Storage

Each world instance requires:
- `.env` file (copy from `.env.example`)
- SQLite database (`world/db.sqlite`) for entities, blueprints, users
- Asset storage (`world/assets/`) for uploaded 3D models, scripts, textures
- JSON storage file (`world/storage.json`) for world state

## Pear Desktop App (Phase 1 - COMPLETED)

Hyperfy can now run as a Pear desktop app! This provides a native-feeling desktop experience while still connecting to your existing HTTP/WebSocket backend.

### What's Changed:
- Added `src/client/boot.js` - New boot entry point that works with both web and Pear runtime
- Modified `package.json` - Added Pear configuration and scripts
- Created `index.html` - Pear-compatible entry point that loads Hyperfy
- Build process now includes boot.js in the client bundle

### Running the Pear App:
1. Build the client: `npm run build`
2. Run in Pear: `npm run pear:dev`

The app connects to localhost:3000 by default (configurable in package.json pear.links).

### Next Steps (Phase 2):
- ✅ **Phase 2.A COMPLETE**: Transport interface abstraction layer
- ✅ **Phase 2.B COMPLETE**: Hyperswarm P2P transport implementation
- ✅ **Phase 2.C COMPLETE**: Bridge service for gradual migration
- ✅ **Phase 2.D COMPLETE**: Replace database/files with Hypercore + Hyperbee storage  
- ✅ **Phase 2.E COMPLETE**: Replace HTTP assets with Hyperdrive distribution
- ⏳ Add ed25519 identity and ACL-based permissions

## Transport Layer (Phase 2.A - COMPLETED)

Hyperfy now has a clean transport abstraction that supports both WebSocket and P2P transports:

### Files Added:
- `src/core/transport/Transport.js` - Base transport interface with message type constants
- `src/core/transport/WSTransport.js` - WebSocket transport adapter
- `src/core/transport/SwarmTransport.js` - Hyperswarm P2P transport (skeleton)
- `src/core/transport/TransportFactory.js` - Factory for creating transports with feature flags
- `src/core/systems/ClientNetworkV2.js` - Updated network system using transport interface

### Feature Flags:

You can control which transport to use:
```bash
# Force WebSocket (default)
localStorage.setItem('hyperfy_transport_type', 'websocket')

# Force P2P (when implemented)
localStorage.setItem('hyperfy_transport_type', 'hyperswarm')

# Environment variable
HYPERFY_TRANSPORT_TYPE=websocket
```

### Message Types:

Replaced magic numbers with named constants:
```js
import { MESSAGE_TYPES } from './transport/Transport'

// Before: send(10, data)
// After:  send(MESSAGE_TYPES.SNAPSHOT, data)
```

## Hyperswarm P2P Transport (Phase 2.B - COMPLETED)

Full peer-to-peer networking implementation using Hyperswarm:

### Features:
- **Encrypted Communications**: All peer connections wrapped with Secretstream (Noise protocol)
- **NAT Traversal**: Automatic hole punching via HyperDHT
- **Topic-based Discovery**: Deterministic world topics derived from world IDs
- **Message Protocol**: Structured headers `[version, msgType, schema] + JSON payload`
- **Connection Management**: Automatic peer lifecycle with heartbeat and cleanup
- **Metrics Collection**: RTT, throughput, peer count tracking

### Files Added:
- `src/core/transport/SwarmTransport.js` (462 lines) - Complete P2P implementation
- `src/core/transport/BridgeService.js` (314 lines) - Migration bridge

### Usage:
```js
// Enable P2P transport
localStorage.setItem('hyperfy_transport_type', 'hyperswarm')

// Or via environment
HYPERFY_TRANSPORT_TYPE=hyperswarm
```

## Bridge Service (Phase 2.C - COMPLETED)

Seamless migration path from WebSocket to P2P:

### Bridge Features:
- **Bidirectional Relay**: Messages flow between WebSocket server and P2P swarm
- **Message Filtering**: Prevents feedback loops and unnecessary traffic
- **Metrics Tracking**: Monitor relay performance and message counts
- **Standalone Operation**: Can run as separate service for testing

### Running the Bridge:
```bash
# Standalone bridge service
node src/core/transport/BridgeService.js --ws-url ws://localhost:3000/ws --world-id myworld

# Or programmatically
import { createBridge } from './transport/BridgeService.js'
const bridge = await createBridge({
  wsUrl: 'ws://localhost:3000/ws',
  worldId: 'myworld'
})
```

## P2P Storage Layer (Phase 2.D - COMPLETED)

Decentralized world state storage using Hypercore and Hyperbee:

### Storage Architecture:
- **Storage Interface**: Common API for both file-based and P2P storage
- **FileStorage**: Backward-compatible file-based storage with JSON serialization
- **HypercoreStorage**: P2P storage using Hypercore append-only logs and Hyperbee indexing
- **StorageFactory**: Creates storage instances based on configuration and feature flags
- **Migration Support**: Tools for seamless data migration between storage types

### Files Added:
- `src/core/storage/Storage.js` (114 lines) - Storage interface with events
- `src/core/storage/FileStorage.js` (265 lines) - File-based storage implementation
- `src/core/storage/HypercoreStorage.js` (443 lines) - P2P storage with Hypercore/Hyperbee
- `src/core/storage/StorageFactory.js` (269 lines) - Factory with migration tools
- `src/core/systems/ServerNetworkV2.js` (522 lines) - Updated network system using storage abstraction
- `src/server/indexV2.js` (268 lines) - Updated server with storage factory integration

### P2P Storage Features:
- **Append-Only Logs**: Hypercore provides versioned, cryptographically secure data storage
- **Indexed Queries**: Hyperbee enables efficient key-value operations with range queries
- **Real-Time Sync**: Automatic replication and sync between peers
- **Multi-Writer Support**: Multiple peers can write to separate hypercores and sync changes
- **Conflict Resolution**: Built-in handling of concurrent modifications
- **Metrics & Monitoring**: Track operations, peer count, and sync events

### Usage:
```bash
# Enable P2P storage
HYPERFY_STORAGE_TYPE=hypercore npm run dev

# Or via client localStorage
localStorage.setItem('hyperfy_storage_type', 'hypercore')

# Migration between storage types
curl -X POST http://localhost:3000/api/migrate-storage \
  -H "Content-Type: application/json" \
  -d '{"targetType": "hypercore", "dryRun": true}'
```

## P2P Asset System (Phase 2.E - COMPLETED)

Decentralized asset distribution using Hyperdrive for P2P file sharing:

### Asset Architecture:
- **AssetStorage Interface**: Common API for both HTTP and P2P asset delivery
- **HttpAssetStorage**: Backward-compatible HTTP file-based asset system
- **HyperdriveAssetStorage**: P2P asset storage using Hyperdrive distributed file system
- **AssetFactory**: Creates asset storage instances based on configuration and feature flags
- **Migration Support**: Tools for seamless asset migration between HTTP and P2P systems

### Files Added:
- `src/core/assets/AssetStorage.js` (140 lines) - Asset storage interface with events
- `src/core/assets/HttpAssetStorage.js` (428 lines) - HTTP-based asset implementation
- `src/core/assets/HyperdriveAssetStorage.js` (599 lines) - P2P asset storage with Hyperdrive
- `src/core/assets/AssetFactory.js` (305 lines) - Factory with migration tools

### P2P Asset Features:
- **Distributed Storage**: Hyperdrive provides distributed file storage across peers
- **Content Addressing**: Assets identified by cryptographic hashes for integrity
- **Real-Time Replication**: Automatic asset sharing and sync between peers
- **Metadata Management**: Rich asset metadata with type detection and statistics
- **Migration Tools**: Seamless migration from HTTP to P2P asset delivery
- **Event System**: Asset change notifications for UI updates
- **URL Compatibility**: Support for both HTTP URLs and hyperdrive:// protocol

### Usage:
```bash
# Enable P2P assets
HYPERFY_ASSETS_TYPE=hyperdrive npm run dev

# Or via client localStorage
localStorage.setItem('hyperfy_assets_type', 'hyperdrive')

# Assets are automatically replicated across P2P network
# Client can load from: hyperdrive://key/assets/filename.ext
```

## Environment Setup

### Prerequisites
- Node.js 22.11.0 (specified in `.nvmrc` - use exact version for consistency)
- SQLite database support
- npm (package manager)

### Initial Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Create world directory structure (auto-created on first run)
# - world/db.sqlite (SQLite database)
# - world/assets/ (uploaded assets)
# - world/storage.json (world state)
```

### Environment Variables
Key variables from `.env.example`:
```bash
WORLD=world              # World folder to run
PORT=3000               # Server port
JWT_SECRET=hyper        # Token signing secret
ADMIN_CODE=             # Admin access code (empty = everyone is admin)
SAVE_INTERVAL=60        # Auto-save interval in seconds

# Client-facing URLs (PUBLIC_ prefix)
PUBLIC_WS_URL=ws://localhost:3000/ws
PUBLIC_API_URL=http://localhost:3000/api
PUBLIC_ASSETS_URL=http://localhost:3000/assets
```

## Docker Support

```bash
# Build and run with Docker
docker build -t hyperfydemo .
docker run -d -p 3000:3000 \
  -v "$(pwd)/src:/app/src" \
  -v "$(pwd)/world:/app/world" \
  -v "$(pwd)/.env:/app/.env" \
  hyperfydemo

# Health check endpoint
curl http://localhost:3000/health

# Status endpoint (shows connected users and uptime)
curl http://localhost:3000/status
```

## CI/CD

The project uses GitHub Actions for Docker image building:
- **Workflow**: `.github/workflows/docker.yml`
- **Triggers**: Push to `SS` branch or version tags (`v*.*.*`)
- **Output**: Multi-platform Docker images (amd64/arm64) pushed to GitHub Container Registry
- **Registry**: `ghcr.io/hyperfy-xyz/hyperfy`

### Reproduce CI Locally
```bash
# Build Docker image locally
docker build -t hyperfy-local .

# Run with same build args as CI
docker build --build-arg COMMIT_HASH=$(git rev-parse HEAD) -t hyperfy-local .
```

## Development Patterns

### Hot Reloading
- Server restarts automatically on code changes in dev mode
- Client rebuilds and browser refreshes automatically
- World state persists between server restarts

### Script Development
Apps use a secure JavaScript execution environment with globals:
- `app` - App instance API
- `world` - World state access  
- `props` - App properties
- Three.js math classes (`Vector3`, `Quaternion`, etc.)

### Asset Management
- Upload via `/api/upload` endpoint
- Assets referenced with `asset://` URLs
- Automatic cleanup of unused assets with `npm run world:clean`

## Testing and Quality

No test framework is currently configured. The project uses:
- ESLint for code linting (React + ES2021 rules)
- Prettier for code formatting
- Manual testing through the 3D world interface

### Running Single Tests

Currently no automated tests are configured. Testing is done manually by:
1. Starting the development server with `npm run dev`
2. Opening `http://localhost:3000` in browser
3. Testing 3D world interactions and app functionality

## Key Files

- `src/core/World.js` - Main ECS world implementation
- `src/server/index.js` - Fastify server entry point
- `scripts/build.mjs` - Main build script
- `package.json` - All available npm scripts
- `.env.example` - Required environment variables
- `docs/` - Creator documentation for 3D artists and developers

## Admin Commands

In-world chat commands (requires ADMIN_CODE if set):
- `/admin <code>` - Become admin
- `/spawn set` - Set spawn point to current position
- `/spawn clear` - Reset spawn to origin
- `/name <name>` - Change player name
- `/chat clear` - Clear chat history