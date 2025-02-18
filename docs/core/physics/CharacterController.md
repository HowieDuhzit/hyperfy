# Character Controller System Documentation

The Character Controller system in Hyperfy provides physics-based character movement using PhysX's character controller system. It handles player collision detection, movement, and interaction with the physics world.

## Core Features

### Controller Manager
- PhysX character controller integration
- Custom collision filtering
- Player-specific physics handling
- Capsule-based collision detection

## Implementation

### Controller Setup
```javascript
class Physics extends System {
  setupControllerManager() {
    // Initialize controller manager
    this.controllerManager = PHYSX.PxTopLevelFunctions.prototype
      .CreateControllerManager(this.scene)
    
    // Setup collision filters
    this.controllerFilters = new PHYSX.PxControllerFilters()
    this.controllerFilters.mFilterData = new PHYSX.PxFilterData(
      Layers.player.group,
      Layers.player.mask,
      0,
      0
    )
  }
}
```

### Collision Filtering

The system implements custom collision filtering for characters:

```javascript
// Filter callback implementation
const filterCallback = new PHYSX.PxQueryFilterCallbackImpl()
filterCallback.simplePreFilter = (filterDataPtr, shapePtr, actor) => {
  // Check collision layer compatibility
  if (filterData.word0 & shapeFilterData.word1 && 
      shapeFilterData.word0 & filterData.word1) {
    return PHYSX.PxQueryHitType.eBLOCK
  }
  return PHYSX.PxQueryHitType.eNONE
}
```

## Core Functionality

### Character Movement

#### Controller Types
- Capsule Controller - Standard humanoid characters
- Box Controller - Special case characters
- Custom Controller - Advanced movement types

#### Movement Features
- Gravity and ground detection
- Step handling and slopes
- Collision resolution
- Kinematic movement

### Collision Handling

#### Character-Character Collision
```javascript
const cctFilterCallback = new PHYSX.PxControllerFilterCallbackImpl()
cctFilterCallback.filter = (aPtr, bPtr) => {
  // Handle character-to-character collision
  return true  // Enable all character collisions
}
```

#### Layer-Based Filtering
- Player-specific collision layers
- Environment interaction layers
- Trigger volume handling

## Integration with Game Systems

### Player Movement
```javascript
// Example player movement update
function updatePlayerMovement(delta, movement) {
  const flags = controller.move(
    movement,          // Desired movement vector
    minimumDistance,   // Minimum movement distance
    delta,            // Time step
    filters,          // Collision filters
    obstacles         // Obstacle set
  )
  
  return flags  // Returns collision state
}
```

### Ground Detection
```javascript
// Ground check implementation
function isGrounded() {
  return controller.getActor().isGrounded()
}
```

## Best Practices

### Performance
1. **Collision Optimization**
   - Use appropriate collision shapes
   - Optimize filter callbacks
   - Minimize dynamic collisions

2. **Movement Updates**
   - Use fixed timestep updates
   - Batch movement checks
   - Cache collision results

3. **Memory Management**
   - Reuse filter objects
   - Pool common data structures
   - Clean up controllers properly

### Stability
1. **Collision Response**
   - Handle edge cases gracefully
   - Prevent tunneling
   - Manage steep slopes

2. **Movement Parameters**
   - Configure appropriate step heights
   - Set reasonable movement speeds
   - Handle variable time steps

## Integration with HyperfoneOS

The character controller supports the cyberpunk theme:
- Holographic character bounds
- Energy shield collisions
- Neon trail effects
- Sci-fi movement effects

## Technical Details

### Controller Properties
```javascript
class CharacterController {
  constructor(options) {
    this.height = options.height
    this.radius = options.radius
    this.stepOffset = options.stepOffset
    this.slopeLimit = options.slopeLimit
    this.contactOffset = options.contactOffset
  }
}
```

### Update Cycle
1. Pre-movement update
2. Apply movement and forces
3. Resolve collisions
4. Post-movement update

### Collision Response
```javascript
// Collision flags handling
function handleCollisionFlags(flags) {
  const isGrounded = flags & PxControllerFlag.eCOLLISION_DOWN
  const hitCeiling = flags & PxControllerFlag.eCOLLISION_UP
  const hitSides = flags & PxControllerFlag.eCOLLISION_SIDES
  
  // Handle different collision states
} 