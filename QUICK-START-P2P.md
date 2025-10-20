# Hyperfy P2P - Quick Start Guide

## 🚀 Get Started with P2P in 5 Minutes

### Prerequisites
- Node.js 22.11.0 (use `nvm use` to match `.nvmrc`)
- npm 10.0.0+
- 10GB+ free disk space

### 1. Clone and Install
```bash
git clone https://github.com/hyperfy-xyz/hyperfy.git
cd hyperfy
git checkout p2p  # Use P2P branch
npm install
```

### 2. Configure P2P Environment
```bash
# Copy environment file
cp .env.example .env

# Edit .env to enable P2P
echo "HYPERFY_STORAGE_TYPE=hyperdrive" >> .env
echo "HYPERFY_ASSETS_TYPE=hyperdrive" >> .env
```

### 3. Test P2P System
```bash
# Validate P2P components
npm run test:p2p-simple

# Expected output: ✅ 13/13 tests passing
```

### 4. Start P2P Services
```bash
# Terminal 1: Start bridge service for browser clients
npm run bridge

# Terminal 2: Start Hyperfy server
npm run dev
```

### 5. Enable P2P in Browser
Open `http://localhost:3000` and run in browser console:
```javascript
// Enable P2P asset loading
localStorage.setItem('hyperfy_use_loader_v2', 'true')
localStorage.setItem('hyperfy_assets_type', 'hyperdrive')

// Refresh page to activate P2P
location.reload()
```

## 🎯 Verify P2P is Working

### Check Asset Loading
Upload any 3D model or image - you should see in browser console:
```
Loading P2P asset: /models/building.glb from drive: abc123...
Successfully loaded P2P asset: building.glb (2.1 MB)
```

### Check World Storage
Your world data is now stored in P2P network:
- World state: `./world/hyperdrive/` (Hypercore + Hyperbee)
- Assets: `./world/hyperdrive-assets/` (Hyperdrive)

### Monitor P2P Network
```bash
# View P2P status
npm run demo:p2p-production
```

## 🔧 Configuration Options

### Server Environment Variables
```bash
HYPERFY_STORAGE_TYPE=hyperdrive    # Enable P2P world storage
HYPERFY_ASSETS_TYPE=hyperdrive     # Enable P2P asset distribution
HYPERFY_BRIDGE_PORT=3001           # WebSocket bridge port
HYPERFY_WORLD_ID=myworld           # Unique world identifier
```

### Client Feature Flags
```javascript
// Core P2P settings
localStorage.setItem('hyperfy_use_loader_v2', 'true')
localStorage.setItem('hyperfy_assets_type', 'hyperdrive')

// Debug logging
localStorage.setItem('hyperfy_debug_assets', 'true')
```

## 📊 Available Commands

### P2P Services
- `npm run bridge` - Start WebSocket bridge for browser P2P
- `npm run demo:p2p-production` - Full P2P system demonstration

### Testing
- `npm run test:p2p-simple` - Quick component validation
- `npm run test:p2p-integration` - Full system integration
- `npm run test:p2p-assets` - Asset loading validation

### Development
- `npm run dev` - Development server with hot reload
- `npm run build` - Production build
- `npm run start` - Production server

## 🛠️ Troubleshooting

### Assets not loading via P2P?
```bash
# Check bridge service
npm run bridge

# Verify feature flags in browser console
console.log(localStorage.getItem('hyperfy_use_loader_v2'))
console.log(localStorage.getItem('hyperfy_assets_type'))
```

### World state not syncing?
```bash
# Validate P2P storage
npm run test:p2p-simple

# Check environment variables
echo $HYPERFY_STORAGE_TYPE
echo $HYPERFY_ASSETS_TYPE
```

### Bridge connection failed?
```bash
# Check if port 3001 is available
netstat -tlnp | grep :3001

# Restart bridge service
npm run bridge
```

## 🎉 You're Now Running P2P Hyperfy!

Your Hyperfy instance now operates as a decentralized virtual world platform:
- **World state** distributed via P2P (Hypercore + Hyperbee)
- **Assets** served via P2P network (Hyperdrive)
- **Browser clients** connect via WebSocket bridge
- **Automatic fallback** to HTTP when P2P unavailable

## 📚 Next Steps

1. **Read Documentation**: `docs/P2P-CLIENT-ASSETS.md`
2. **Explore Architecture**: `HYPERFY-P2P-COMPLETE.md`
3. **Production Setup**: Configure monitoring and backup
4. **Community**: Share your P2P worlds with others!

---

**🌍 Welcome to the decentralized metaverse!**