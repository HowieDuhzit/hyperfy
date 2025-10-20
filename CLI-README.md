# Hyperfy P2P CLI - Complete Guide

Simple command-line tools to deploy and manage Hyperfy P2P virtual worlds 🌍

## 🚀 Ultra-Quick Start

```bash
# One command to rule them all
./hyperfy-p2p.sh setup && ./hyperfy-p2p.sh start
```

**That's it!** Your decentralized 3D world is running at `http://localhost:3000` ✨

## 📋 Available CLI Tools

### 1. Shell Wrapper (Recommended)
Simple bash script - easiest to use:
```bash
./hyperfy-p2p.sh <command>
```

### 2. Node.js CLI
Full-featured CLI tool:
```bash
npx hyperfy-p2p <command>
./bin/hyperfy-p2p <command>
```

### 3. npm Scripts
When working inside the project:
```bash
npm run p2p:<command>
```

## 🛠️ Commands Reference

### Essential Commands

| Command | Shell Wrapper | Node CLI | npm Script | Description |
|---------|---------------|----------|------------|-------------|
| **Setup** | `./hyperfy-p2p.sh setup` | `npx hyperfy-p2p init` | `npm run p2p:init` | Initialize P2P environment |
| **Start** | `./hyperfy-p2p.sh start` | `npx hyperfy-p2p start` | `npm run p2p:start` | Start production server |
| **Develop** | `./hyperfy-p2p.sh dev` | `npx hyperfy-p2p dev` | `npm run p2p:dev` | Start development mode |
| **Test** | `./hyperfy-p2p.sh test` | `npx hyperfy-p2p test` | `npm run p2p:test` | Validate P2P system |
| **Status** | `./hyperfy-p2p.sh status` | `npx hyperfy-p2p status` | `npm run p2p:status` | Show system status |

### Individual Services

| Service | Shell Wrapper | Node CLI | npm Script | Description |
|---------|---------------|----------|------------|-------------|
| **Bridge** | `./hyperfy-p2p.sh bridge` | `npx hyperfy-p2p bridge` | `npm run p2p:bridge` | Start P2P bridge only |
| **Server** | `./hyperfy-p2p.sh server` | `npx hyperfy-p2p server` | - | Start Hyperfy server only |
| **Client** | `./hyperfy-p2p.sh client` | `npx hyperfy-p2p client` | `npm run p2p:client` | Show client P2P instructions |

## 🔧 What Each Command Does

### `setup` / `init`
- ✅ Checks Node.js version (requires 18+)
- 📦 Installs dependencies if needed
- ⚙️ Creates/updates `.env` file with P2P settings:
  ```
  HYPERFY_STORAGE_TYPE=hyperdrive
  HYPERFY_ASSETS_TYPE=hyperdrive
  ```
- 🧪 Runs validation tests

### `start`
- 🌉 Starts P2P bridge service on `ws://localhost:3001`
- 🏗️ Builds the application for production
- 🖥️ Starts Hyperfy server on `http://localhost:3000`

### `dev`
- 🌉 Starts P2P bridge service 
- 🛠️ Starts development server with hot reload
- 🔄 Auto-rebuilds on code changes

### `test` / `validate`
- 🧪 Tests Hypercore/Hyperdrive storage
- 🌐 Tests P2P asset loading
- 📊 Validates system integration

### `status`
- 📊 Shows P2P configuration status
- 🔍 Lists running services
- 📁 Shows data directory information

## 🌐 Client P2P Setup

After starting the server, enable P2P assets in your browser:

1. Open `http://localhost:3000`
2. Open DevTools Console (F12)  
3. Run these commands:
   ```javascript
   localStorage.setItem('hyperfy_use_loader_v2', 'true')
   localStorage.setItem('hyperfy_assets_type', 'hyperdrive')
   location.reload()
   ```

Or use: `./hyperfy-p2p.sh client` to see these instructions anytime.

## 📁 File Structure

```
hyperfy/
├── bin/hyperfy-p2p          # Node.js CLI tool
├── hyperfy-p2p.sh           # Shell wrapper script  
├── CLI-QUICKSTART.md        # Quick reference guide
├── CLI-README.md            # This comprehensive guide
├── package.json             # Includes bin entry and npm scripts
└── world/                   # Data directory
    ├── hyperdrive/          # P2P storage data
    ├── assets/              # Uploaded assets
    └── db.sqlite            # World database
```

## 🚧 System Requirements

- **Node.js**: 18.0.0 or higher (22.11.0 recommended)
- **npm**: 10.0.0 or higher
- **OS**: Linux, macOS, or Windows
- **Ports**: 3000 (server), 3001 (bridge)

## 🔍 Troubleshooting

### Common Issues

**"Command not found"**
```bash
# Make scripts executable
chmod +x hyperfy-p2p.sh
chmod +x bin/hyperfy-p2p
```

**"Port already in use"**
```bash
# Check what's using the ports
lsof -i :3000  # Server port
lsof -i :3001  # Bridge port

# Kill processes if needed
sudo kill -9 <PID>
```

**"Node.js version too old"**
```bash
# Install Node.js 18+ from https://nodejs.org
# Or use a version manager like nvm
```

**"Dependencies missing"**
```bash
# CLI handles this automatically, but manual install:
npm install
```

### Debug Commands

```bash
# Validate P2P system
./hyperfy-p2p.sh test

# Show detailed status
./hyperfy-p2p.sh status  

# Test individual components
npm run test:p2p-simple
npm run test:p2p-assets
npm run test:p2p-integration
```

## 🔐 Security Notes

- P2P data is stored in `world/hyperdrive/` directory
- Keys and secrets are auto-generated on first run
- Bridge service only runs locally (no external access)
- All P2P connections use cryptographic verification

## 🌟 Production Deployment

For production servers:

```bash
# Complete setup and start
./hyperfy-p2p.sh setup
./hyperfy-p2p.sh start

# Or one-liner
./hyperfy-p2p.sh setup && ./hyperfy-p2p.sh start
```

The system will:
- Build optimized production bundles
- Start services as background processes
- Handle graceful shutdown on SIGTERM
- Maintain persistent P2P storage

## 🎯 Examples

### Basic Development Workflow
```bash
git clone <hyperfy-repo>
cd hyperfy
./hyperfy-p2p.sh setup
./hyperfy-p2p.sh dev
# Open http://localhost:3000 and enable P2P assets
```

### Production Server Setup
```bash
./hyperfy-p2p.sh setup
./hyperfy-p2p.sh start
# Server running on http://localhost:3000
```

### Testing P2P Features
```bash
./hyperfy-p2p.sh setup
./hyperfy-p2p.sh test
# Validates entire P2P system
```

### Individual Service Management
```bash
# Start only bridge (for debugging)
./hyperfy-p2p.sh bridge

# In another terminal, start only server
./hyperfy-p2p.sh server
```

## 📚 Next Steps

1. **Upload Assets**: Drag & drop 3D models in the world editor
2. **Share World**: Send your world ID to friends for P2P connection
3. **Create Apps**: Build interactive 3D applications
4. **Scale Up**: Deploy to production servers with persistent storage

## 💡 Tips

- Use `dev` mode for active development (hot reload)
- Use `start` for production deployment
- Check `status` if services aren't responding
- Run `test` after system changes to validate setup
- The shell wrapper has prettier output and error handling

---

**🎉 You're ready to build decentralized virtual worlds!** 

For more advanced configuration, see the main Hyperfy documentation.

## Support

- 🐛 Issues: Create GitHub issues for bugs
- 💬 Questions: Join the Hyperfy Discord community  
- 📖 Docs: Check the main README for detailed information
- 🔧 CLI Help: Run any command with `help` to see usage