# Entity Component System Documentation

The Hyperfy engine implements a networked Entity Component System (ECS) that runs on both server and client. The system provides entity management, networking synchronization, and component-based architecture.

## Core Components

### Entity System
The main system managing all entities in the world:

```javascript
class Entities extends System {
  constructor(world) {
    this.items = new Map()      // All entities
    this.players = new Map()    // Player entities
    this.hot = new Set()        // Entities requiring frequent updates
    this.removed = []           // Cleanup queue
  }
}
```

### Entity Types
Built-in entity types with specialized functionality:
```javascript
const Types = {
  app: App,           // Application entities
  player: Player      // Player entities
}
```

## Entity Implementation

### Base Entity Class
```javascript
class Entity {
  constructor(world, data, local) {
    this.world = world
    this.data = data
    
    // Network synchronization
    if (local) {
      this.world.network.send('entityAdded', data)
    }
  }
}
```

### Core Features

#### Entity Management
- Creation and destruction
- Type-specific behavior
- Network synchronization
- State management

#### Lifecycle Methods
```javascript
class Entity {
  // State modification
  modify(data) {
    // Handle state changes
  }
  
  // Event handling
  onEvent(name, data, clientId) {
    // Process entity events
  }
  
  // Serialization
  serialize() {
    return this.data
  }
  
  // Cleanup
  destroy(local) {
    if (local) {
      this.world.network.send('entityRemoved', this.data.id)
    }
  }
}
```

## Entity Operations

### Creating Entities
```javascript
// Add new entity
const entity = entities.add({
  type: 'app',
  id: 'unique_id',
  data: { /* entity data */ }
}, true)  // local = true for network sync
```

### Entity Queries
```javascript
// Get entity by ID
const entity = entities.get(id)

// Get player entity
const player = entities.getPlayer(userId)
```

### Entity Updates
```javascript
// Update cycles
entities.fixedUpdate(delta)  // Physics timestep
entities.update(delta)       // Main update
entities.lateUpdate(delta)   // Post-update
```

## Networking Integration

### State Synchronization
- Entity creation/destruction sync
- State modifications broadcast
- Event propagation
- Authority management

### Network Messages
```javascript
// Entity added
network.send('entityAdded', entityData)

// Entity removed
network.send('entityRemoved', entityId)

// Entity modified
network.send('entityModified', modificationData)
```

## Best Practices

### Performance
1. **Entity Management**
   - Use appropriate entity types
   - Clean up destroyed entities
   - Optimize hot entities

2. **State Updates**
   - Batch modifications
   - Minimize network traffic
   - Use efficient serialization

3. **Memory Management**
   - Pool common entities
   - Clean up references
   - Handle circular dependencies

### Architecture
1. **Entity Design**
   - Keep entities focused
   - Use composition over inheritance
   - Follow single responsibility

2. **Network Optimization**
   - Minimize state size
   - Use delta updates
   - Handle latency gracefully

## Integration with HyperfoneOS

The ECS supports the cyberpunk theme through:
- Holographic entity representations
- Digital entity effects
- Cybernetic enhancements
- Neural network visualizations

## Technical Details

### Entity Properties
```javascript
class EntityData {
  constructor(options) {
    this.id = options.id           // Unique identifier
    this.type = options.type       // Entity type
    this.owner = options.owner     // Authority
    this.components = new Map()    // Component storage
  }
}
```

### Update Cycle
1. Fixed update (physics)
2. Main update (logic)
3. Late update (post-processing)
4. Network synchronization

### Hot Entity System
```javascript
// Mark entity as requiring frequent updates
entities.setHot(entity, true)

// Hot update cycle
for (const entity of this.hot) {
  entity.hotUpdate(delta)
}
```

### Serialization
```javascript
// Serialize world state
serialize() {
  return Array.from(this.items.values())
    .map(entity => entity.serialize())
}

// Deserialize world state
deserialize(datas) {
  datas.forEach(data => this.add(data))
}
``` 