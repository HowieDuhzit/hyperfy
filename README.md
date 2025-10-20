# Hyperfy ⚡️

## Overview

<div align="center">
  <img src="overview.png" alt="Hyperfy Ecosystem" width="100%" />
</div>

## 🧬 Features

- Standalone persistent world
- Host them on your own domain
- Connect via Hyperfy for portable avatars
- Realtime content creation in-world
- Realtime coding in-world (for devs)
- Fully interactive and interoperable app format
- Highly extensible

## 🦹‍♀️ Use Cases

- Live events
- Storefronts
- Podcasts
- Gaming
- Social

## 🚀 Quick Start

### Prerequisites

- Node 22.11.0+ (eg via nvm)

### Install

```bash
git clone https://github.com/hyperfy-xyz/hyperfy.git my-world
cd my-world
cp .env.example .env
npm install
npm run dev
```

### 🚀 Ultra-Quick P2P Start

**Want P2P? One command does it all:**

```bash
./hyperfy-p2p.sh setup && ./hyperfy-p2p.sh start
```

This gives you:
- ✅ Peer-to-peer world state (Hypercore + Hyperbee)
- ✅ Distributed asset loading (Hyperdrive)  
- ✅ WebSocket bridge for browser P2P support
- ✅ Complete decentralized virtual world!

**CLI Options:**
```bash
./hyperfy-p2p.sh setup    # Initialize P2P environment
./hyperfy-p2p.sh dev      # Development mode with hot reload  
./hyperfy-p2p.sh start    # Production P2P deployment
./hyperfy-p2p.sh test     # Validate P2P system
./hyperfy-p2p.sh status   # Show system status
```

📖 **Full CLI Documentation:** [CLI-QUICKSTART.md](./CLI-QUICKSTART.md) | [CLI-README.md](./CLI-README.md)

## 🌱 Alpha

This project is still in alpha as we transition all of our [reference platform](https://github.com/hyperfy-xyz/hyperfy-ref) code into fully self hostable worlds.
Most features are already here in this repo but still need to be connected up to work with self hosting in mind.
Note that APIs are highly likely to change during this time.

