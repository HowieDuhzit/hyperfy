# Hyperfy P2P CLI - Quick Start

The easiest way to run Hyperfy in P2P mode! ✨

## One-Command Setup

```bash
# Complete P2P setup and start
npx hyperfy-p2p init && npx hyperfy-p2p start
```

That's it! Your P2P virtual world is now running at `http://localhost:3000` 🎉

## Quick Commands

```bash
# Initialize P2P environment (first time only)
npx hyperfy-p2p init

# Start P2P services (production)
npx hyperfy-p2p start

# Start in development mode (with hot reload)
npx hyperfy-p2p dev

# Test the P2P system
npx hyperfy-p2p test

# Show system status
npx hyperfy-p2p status
```

## What Happens Behind the Scenes

When you run `npx hyperfy-p2p init`:
1. ✅ Checks Node.js version (requires 18+)
2. 📦 Installs dependencies if needed
3. ⚙️ Sets up `.env` file with P2P configuration
4. 🧪 Validates the P2P system works

When you run `npx hyperfy-p2p start`:
1. 🌉 Starts the P2P bridge service (WebSocket ↔ Hyperswarm)
2. 🖥️ Builds and starts the main Hyperfy server
3. 🌐 Your world is available at `http://localhost:3000`

## Enable P2P Assets in Browser

After starting the server, enable P2P asset loading:

1. Open `http://localhost:3000` in your browser
2. Open DevTools Console (F12)
3. Run these commands:
   ```javascript
   localStorage.setItem('hyperfy_use_loader_v2', 'true')
   localStorage.setItem('hyperfy_assets_type', 'hyperdrive')
   location.reload()
   ```

Assets will now load via P2P! 🚀

## Individual Services

```bash
# Start only the P2P bridge
npx hyperfy-p2p bridge

# Start only the Hyperfy server
npx hyperfy-p2p server

# Show client setup instructions
npx hyperfy-p2p client

# Show detailed status
npx hyperfy-p2p status
```

## Alternative: Using npm Scripts

If you prefer npm scripts (when inside the project directory):

```bash
npm run p2p:init    # Same as: npx hyperfy-p2p init
npm run p2p:start   # Same as: npx hyperfy-p2p start  
npm run p2p:dev     # Same as: npx hyperfy-p2p dev
npm run p2p:test    # Same as: npx hyperfy-p2p test
npm run p2p:status  # Same as: npx hyperfy-p2p status
```

## Troubleshooting

**Bridge won't start?**
- Check if port 3001 is available
- Run `npx hyperfy-p2p test` to validate setup

**Server won't start?**
- Check if port 3000 is available  
- Ensure `.env` file exists with correct settings

**Need help?**
```bash
npx hyperfy-p2p help
```

## Next Steps

1. Create 3D objects and apps in your world
2. Upload assets - they'll be distributed via P2P!
3. Share your world ID with friends to connect peer-to-peer
4. Check the main docs for advanced configuration

---

**That's it!** You're now running a fully decentralized 3D virtual world 🌍✨