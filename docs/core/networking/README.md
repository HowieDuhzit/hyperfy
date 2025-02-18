# Networking & Multiplayer System Documentation

The Hyperfy engine implements a robust client-server networking architecture optimized for real-time multiplayer experiences with a cyberpunk aesthetic. The system integrates with the [Player System](/docs/core/player/README.md), [Physics System](/docs/core/physics/README.md), [Asset System](/docs/core/assets/README.md), and [Entity Component System](/docs/core/ecs/README.md).

## Core Components

### Server Network
Part of the [Entity Component System](/docs/core/ecs/README.md):
```javascript
class ServerNetwork extends System {
  constructor(world) {
    this.sockets = new Map()        // Active connections
    this.dirtyBlueprints = new Set() // Modified blueprints
    this.dirtyApps = new Set()      // Modified apps
    this.isServer = true
  }
}
```

### Client Network
Integrates with the [Player System](/docs/core/player/README.md) for state updates:
```javascript
class ClientNetwork extends System {
  constructor(world) {
    this.ws = null           // WebSocket connection
    this.apiUrl = null       // API endpoint
    this.id = null           // Client ID
    this.isClient = true
  }
}
```

## Network Architecture

### Connection Flow
Integrates with the [Asset System](/docs/core/assets/README.md) for initial state:
1. Client initiates WebSocket connection
2. Server authenticates and creates Socket instance
3. Server sends initial world snapshot
4. Bi-directional real-time communication begins

### State Synchronization
Syncs with [Physics System](/docs/core/physics/README.md) and [Player System](/docs/core/player/README.md):
```javascript
// Server to Client Sync
socket.send('snapshot', {
  id: socket.id,
  chat: world.chat.serialize(),
  blueprints: world.blueprints.serialize(),
  entities: world.entities.serialize(),
  authToken
})

// Client State Updates
network.send('entityModified', {
  id: entityId,
  position: newPosition,
  quaternion: newRotation
})
```

## Core Features

### Real-time Communication
Optimized for [Physics System](/docs/core/physics/README.md) synchronization:
- WebSocket-based messaging
- Binary packet encoding
- Reliable delivery
- Connection health monitoring

### Entity Synchronization
Integrates with [Entity Component System](/docs/core/ecs/README.md):
```javascript
// Entity Events
onEntityAdded(socket, data)
onEntityModified(socket, data)
onEntityRemoved(socket, id)
onEntityEvent(socket, [id, version, name, data])
```

### Blueprint Management
Uses [Asset System](/docs/core/assets/README.md) for resource management:
```javascript
// Blueprint Sync
onBlueprintAdded(socket, blueprint)
onBlueprintModified(socket, data)
dirtyBlueprints.add(blueprintId)
```

### Player Management
Integrates with [Player System](/docs/core/player/README.md):
```javascript
// Player Spawning
socket.player = world.entities.add({
  id: uuid(),
  type: 'player',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  owner: socket.id,
  user
})
```

## Cyberpunk Network Features

### Neon Protocol
- Glowing packet trails
- Digital distortion effects
- Tech-inspired UI feedback

### HoloSync™
- Holographic state preview
- Quantum entanglement visualization
- Neural network latency compensation

### CyberSecure™
```javascript
// Secure Authentication
const authToken = await createJWT({ userId: user.id })
socket.send('snapshot', { authToken })

// Role Management
if (hasRole(user.roles, 'admin')) {
  // Grant admin access
}
```

## Performance Optimization

### Network Efficiency
1. **Packet Optimization**
   - Binary encoding
   - Delta compression
   - Prioritized updates

2. **State Management**
   - Dirty checking
   - Batch updates
   - Partial syncs

3. **Resource Management**
   - Connection pooling
   - Memory optimization
   - Garbage collection

### Best Practices

#### Server-side
1. **Authority**
   - Validate all client actions
   - Maintain source of truth
   - Handle conflicts

2. **State Management**
   - Regular state saves
   - Conflict resolution
   - Data consistency

3. **Security**
   - Authentication
   - Authorization
   - Rate limiting

#### Client-side
1. **State Handling**
   - Local prediction
   - State reconciliation
   - Smooth interpolation

2. **Connection Management**
   - Auto-reconnection
   - State recovery
   - Offline handling

## Technical Implementation

### Packet System
```javascript
// Binary Packet Format
[method: string, data: any] = readPacket(buffer)
buffer = writePacket(method, data)
```

### Socket Management
```javascript
class Socket {
  constructor({ ws, network }) {
    this.alive = true
    this.closed = false
    this.disconnected = false
  }
  
  // Health monitoring
  ping() {
    this.alive = false
    this.ws.ping()
  }
  
  // Message handling
  send(name, data) {
    const packet = writePacket(name, data)
    this.ws.send(packet)
  }
}
```

### Save System
```javascript
async save() {
  // Save blueprints
  for (const id of this.dirtyBlueprints) {
    await this.db('blueprints').upsert(blueprint)
  }
  
  // Save app entities
  for (const id of this.dirtyApps) {
    await this.db('entities').upsert(entity)
  }
}
```

## Integration Examples

### Entity Synchronization
```javascript
// Server broadcasts entity update
network.send('entityModified', {
  id: entity.id,
  position: entity.position,
  quaternion: entity.quaternion
})

// Client receives and applies update
onEntityModified(data) {
  const entity = world.entities.get(data.id)
  entity.modify(data)
}
```

### Chat System
```javascript
// Send chat message
network.send('chatAdded', {
  id: uuid(),
  from: player.name,
  body: message,
  createdAt: timestamp
})

// Receive chat message
onChatAdded(msg) {
  world.chat.add(msg, false)
}
```

### Blueprint System
```javascript
// Modify blueprint
network.send('blueprintModified', {
  id: blueprint.id,
  version: blueprint.version + 1,
  data: newData
})

// Handle conflicts
if (data.version > blueprint.version) {
  world.blueprints.modify(data)
} else {
  socket.send('blueprintModified', blueprint)
}
``` 