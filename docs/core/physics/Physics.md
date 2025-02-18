# Physics System Documentation

The Physics system in Hyperfy provides physics simulation and collision detection using PhysX. It runs on both server and client, handling colliders, physics simulation, and fixed timestep interpolation.

## Core Features

### Physics Engine Integration
- Built on NVIDIA PhysX
- Cross-platform physics simulation
- Fixed timestep interpolation
- Contact event handling

## Implementation

### System Initialization
```javascript
class Physics extends System {
  async init({ loadPhysX }) {
    // Initialize PhysX
    const info = await loadPhysX()
    this.physics = PHYSX.CreatePhysics(
      this.version, 
      this.foundation, 
      this.tolerances
    )
    
    // Setup default material
    this.defaultMaterial = this.physics.createMaterial(
      0.2,  // static friction
      0.2,  // dynamic friction
      0.2   // restitution
    )
  }
}
```

### Contact Detection

The system provides comprehensive contact detection:

```javascript
// Contact result structure
const _raycastHit = {
  actor: null,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: null
}

// Sweep result structure
const _sweepHit = {
  actor: null,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: null
}
```

## Core Functionality

### Collision Detection

#### Raycast
```javascript
raycast(origin, direction, maxDistance, layerMask) {
  // Performs raycasting against physics objects
  // Returns hit information including:
  // - Hit point
  // - Surface normal
  // - Distance
  // - Hit actor
}
```

#### Sweep Tests
```javascript
sweep(geometry, origin, direction, maxDistance, layerMask) {
  // Performs sweep tests with geometry
  // Used for continuous collision detection
  // Returns sweep hit information
}
```

#### Overlap Tests
```javascript
overlap(geometry, origin, layerMask) {
  // Checks for overlapping geometries
  // Used for trigger volumes and areas
}
```

### Contact Events

The system provides detailed contact information through events:

```javascript
// Contact event data
class ContactsResult {
  constructor() {
    this.points = []      // Contact points
    this.normals = []     // Surface normals
    this.impulses = []    // Contact impulses
    this.count = 0        // Number of contacts
  }
}
```

#### Event Types
- `onContactStart` - Called when objects begin touching
- `onContactEnd` - Called when objects stop touching
- `onTriggerEnter` - Called when entering trigger volumes
- `onTriggerExit` - Called when exiting trigger volumes

## Integration with Three.js

### Transform Synchronization
```javascript
setGlobalPose(actor, matrix) {
  // Synchronizes Three.js and PhysX transforms
  // Ensures visual and physical representations match
}
```

### Physics Materials
```javascript
createMaterial(staticFriction, dynamicFriction, restitution) {
  // Creates physics materials that can be applied to colliders
  // Controls friction and bounce properties
}
```

## Best Practices

### Performance
1. **Collision Layers**
   - Use appropriate collision masks
   - Optimize collision pairs
   - Utilize broad-phase optimization

2. **Physics Steps**
   - Configure appropriate fixed timestep
   - Balance accuracy vs performance
   - Use interpolation for smooth visuals

3. **Memory Management**
   - Clean up physics actors
   - Reuse physics materials
   - Pool common objects

### Stability
1. **Collision Detection**
   - Use continuous collision detection for fast objects
   - Configure appropriate collision margins
   - Handle edge cases gracefully

2. **Forces and Constraints**
   - Apply reasonable force limits
   - Use stable constraint configurations
   - Avoid unstable physical setups

## Integration with HyperfoneOS

The physics system supports the cyberpunk theme through:
- Holographic collision effects
- Neon impact particles
- Energy field simulations
- Sci-fi force fields

## Technical Details

### Physics Actor Properties
```javascript
class PhysicsActor {
  constructor(options) {
    this.geometry = options.geometry
    this.material = options.material
    this.mass = options.mass ?? 0
    this.isTrigger = options.isTrigger ?? false
    this.contactedHandles = new Set()
  }
}
```

### Update Cycle
1. `preFixedUpdate` - Prepare for physics step
2. `postFixedUpdate` - Apply physics results
3. `preUpdate` - Interpolate transforms
4. Transform synchronization

### Contact Processing
```javascript
onContact(pairHeader, pairs, count) {
  // Process contact pairs
  // Extract contact points
  // Trigger contact events
  // Update contact state
}
``` 