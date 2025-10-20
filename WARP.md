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