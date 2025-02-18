# App Entity Documentation

The App entity is a specialized entity type in Hyperfy that represents interactive applications within the world. It provides functionality for node management, event handling, and application lifecycle management.

## Core Features

### Application States
```javascript
const Modes = {
  ACTIVE: 'active',    // Normal running state
  MOVING: 'moving',    // Being relocated
  LOADING: 'loading',  // Loading resources
  CRASHED: 'crashed'   // Error state
}
```

### Node Management
The App entity manages a collection of 3D nodes:
```javascript
class App extends Entity {
  constructor(world, data, local) {
    this.nodes = new Map()         // All nodes
    this.worldNodes = new Set()    // Nodes in world
    this.hotEvents = 0             // Active event count
    this.worldListeners = new Map() // World event listeners
    this.listeners = {}            // App event listeners
    this.eventQueue = []           // Pending events
  }
}
```

## Core Functionality

### Node Creation
```javascript
createNode(name) {
  const node = createNode({ name })
  this.nodes.set(node.id, node)
  return node
}
```

### Application Lifecycle

#### Building
```javascript
async build(crashed) {
  // Load blueprint
  // Create nodes
  // Setup event handlers
  // Initialize state
}
```

#### Cleanup
```javascript
unbuild() {
  // Remove nodes
  // Clear listeners
  // Clean up resources
}
```

### Update Cycle
```javascript
// Physics update
fixedUpdate(delta) {
  // Update physics state
}

// Main update
update(delta) {
  // Update application logic
}

// Post-update
lateUpdate(delta) {
  // Handle deferred updates
}
```

## Event System

### Event Handling
```javascript
// Add event listener
on(name, callback) {
  if (!this.listeners[name]) {
    this.listeners[name] = new Set()
  }
  this.listeners[name].add(callback)
}

// Remove event listener
off(name, callback) {
  this.listeners[name]?.delete(callback)
}

// Emit event
emit(name, ...args) {
  this.listeners[name]?.forEach(cb => cb(...args))
}
```

### World Events
```javascript
// Listen to world events
onWorldEvent(name, callback) {
  // Register world event listener
}

// Remove world event listener
offWorldEvent(name, callback) {
  // Unregister world event listener
}
```

## Network Integration

### Remote Events
```javascript
onEvent(version, name, data, socketId) {
  // Handle networked events
}

// Send network event
send(name, data, ignoreSocketId) {
  // Broadcast event to network
}
```

### Resource Fetching
```javascript
fetch = async (url, options = {}) => {
  // Secure resource fetching
  // Handle authentication
  // Cache management
}
```

## World Integration

### World Proxy
Provides safe access to world functionality:
```javascript
getWorldProxy() {
  return {
    get networkId() {},      // Network identifier
    get isServer() {},       // Server check
    get isClient() {},       // Client check
    add(node) {},           // Add node to world
    remove(node) {},        // Remove node from world
    attach(node) {},        // Attach to world
    getTime() {},          // World time
    chat(msg, broadcast) {} // World chat
  }
}
```

### App Proxy
Provides app-specific functionality:
```javascript
getAppProxy() {
  return {
    get instanceId() {},     // Unique instance ID
    get version() {},        // App version
    get state() {},         // App state
    create(name) {},        // Create nodes
    control(options) {},    // Control settings
    configure(fn) {}        // Configuration
  }
}
```

## Best Practices

### Performance
1. **Node Management**
   - Batch node operations
   - Clean up unused nodes
   - Optimize node hierarchy

2. **Event Handling**
   - Use appropriate event types
   - Clean up listeners
   - Batch event processing

3. **Resource Management**
   - Cache resources efficiently
   - Handle loading states
   - Clean up on unbuild

### Architecture
1. **State Management**
   - Keep state minimal
   - Use appropriate modes
   - Handle transitions gracefully

2. **Error Handling**
   - Graceful crash handling
   - Resource cleanup
   - Error reporting

## Integration with HyperfoneOS

The App entity supports the cyberpunk theme through:
- Holographic app interfaces
- Digital transition effects
- Neon app boundaries
- Tech-inspired visuals

## Technical Details

### App Properties
```javascript
class AppData {
  constructor(options) {
    this.instanceId = options.id    // Instance identifier
    this.version = options.version  // App version
    this.state = options.state      // Current state
    this.mode = Modes.LOADING       // App mode
    this.position = options.position // World position
    this.rotation = options.rotation // World rotation
  }
}
```

### Event Types
- `fixedUpdate` - Physics updates
- `update` - Main logic updates
- `lateUpdate` - Post-processing
- Custom events for app-specific functionality 