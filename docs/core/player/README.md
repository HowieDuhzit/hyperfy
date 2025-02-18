# Player Entity System Documentation

The Hyperfy engine implements a sophisticated player entity system with support for local and remote players, physics-based movement, and cyberpunk-themed customization. The system integrates with the [Input System](/docs/core/input/README.md), [Physics System](/docs/core/physics/README.md), [Networking System](/docs/core/networking/README.md), and [Asset Management System](/docs/core/assets/README.md).

## Core Components

### Player Entity
The Player Entity extends the base [Entity Component System](/docs/core/ecs/README.md):
```javascript
class Player extends Entity {
  constructor(world, data, local) {
    this.isPlayer = true
    this.player = data.owner === network.id
      ? new PlayerLocal(this)
      : new PlayerRemote(this)
  }
}
```

### Local Player
Integrates with the [Physics System](/docs/core/physics/README.md) for movement:
```javascript
class PlayerLocal {
  constructor(entity) {
    this.mass = 1
    this.gravity = 20
    this.jumpHeight = 1.5
    this.capsuleRadius = 0.3
    this.capsuleHeight = 1.6
    
    // Movement state
    this.grounded = false
    this.jumping = false
    this.falling = false
    this.moving = false
    this.running = false
  }
}
```

## Physics Integration
See the [Physics System Documentation](/docs/core/physics/README.md) for more details on collision and physics simulation.

### Character Controller
Uses PhysX integration from the [Physics System](/docs/core/physics/README.md):
```javascript
// Capsule Collider Setup
initCapsule() {
  const radius = this.capsuleRadius
  const height = this.capsuleHeight
  const halfHeight = (height - radius * 2) / 2
  
  // Physics material
  this.material = physics.createMaterial(0, 0, 0)
  
  // Collision shape
  const geometry = new PxCapsuleGeometry(
    radius, 
    halfHeight
  )
}
```

### Movement System
Integrates with the [Input System](/docs/core/input/README.md) for controls:
```javascript
// Movement Processing
fixedUpdate(delta) {
  // Ground detection
  this.updateGroundState()
  
  // Movement force
  if (this.moving) {
    const moveSpeed = this.running ? 8 : 4
    const moveForce = this.moveDir
      .multiplyScalar(moveSpeed * 10)
      .applyQuaternion(slopeRotation)
  }
  
  // Jump mechanics
  if (this.grounded && this.control.buttons.Space) {
    const jumpVelocity = Math.sqrt(
      2 * this.effectiveGravity * this.jumpHeight
    )
  }
}
```

## Input Handling
See the [Input System Documentation](/docs/core/input/README.md) for detailed information about control binding and input processing.

### Control Binding
Uses the priority-based control system from [Input System](/docs/core/input/README.md):
```javascript
initControl() {
  this.control = world.controls.bind({
    priority: ControlPriorities.PLAYER,
    
    // Mouse look
    onPress: code => {
      if (code === 'MouseRight') {
        this.control.pointer.lock()
      }
    },
    
    // Touch controls
    onTouch: touch => {
      if (touch.position.x < screen.width/2) {
        this.initVirtualJoystick(touch)
      }
    }
  })
}
```

### Movement Controls
```javascript
// Keyboard input
if (control.buttons.KeyW) moveDir.z -= 1
if (control.buttons.KeyS) moveDir.z += 1
if (control.buttons.KeyA) moveDir.x -= 1
if (control.buttons.KeyD) moveDir.x += 1

// Virtual joystick
const stickX = (touchX - center.x) / MAX_DISTANCE
const stickY = (touchY - center.y) / MAX_DISTANCE
moveDir.set(stickX, 0, stickY)
```

## Network Synchronization
Integrates with the [Networking System](/docs/core/networking/README.md) for multiplayer support.

### Remote Player
Uses network synchronization from [Networking System](/docs/core/networking/README.md):
```javascript
class PlayerRemote {
  constructor(entity) {
    this.position = new LerpVector3()
    this.quaternion = new LerpQuaternion()
    this.emote = 'idle'
  }
  
  modify(data) {
    // Position sync
    if (data.p) {
      this.position.pushArray(data.p)
    }
    // Rotation sync
    if (data.q) {
      this.quaternion.pushArray(data.q)
    }
  }
}
```

### State Updates
Uses the network protocol defined in [Networking System](/docs/core/networking/README.md):
```javascript
// Network state transmission
update(delta) {
  this.lastSendAt += delta
  if (this.lastSendAt >= networkRate) {
    network.send('entityModified', {
      id: this.data.id,
      p: this.position.toArray(),
      q: this.quaternion.toArray(),
      e: this.emote
    })
  }
}
```

## Cyberpunk Features
Integrates with the [UI System](/docs/core/ui/README.md) for visual effects and [Asset System](/docs/core/assets/README.md) for resources.

### Neural Link™
```javascript
// Neural interface for movement
setNeuralLink({
  synapticResponse: 0.8,
  neuralLatency: 0.02,
  brainwaveSync: true
})
```

### HoloAvatar™
Uses the [Asset System](/docs/core/assets/README.md) for avatar loading:
```javascript
// Holographic avatar system
applyAvatar() {
  const avatar = await loader.load(
    'avatar',
    this.data.user.avatar || 'asset://cyber-avatar.vrm'
  )
  
  avatar.setHoloEffects({
    neonGlow: true,
    digitalDistortion: 0.2,
    hologramOpacity: 0.8
  })
}
```

### CyberEmotes™
```javascript
// Cyberpunk-themed emotes
const Emotes = {
  IDLE: 'neural-standby',
  WALK: 'cyber-stride',
  RUN: 'quantum-dash',
  FLOAT: 'anti-grav'
}
```

## Best Practices

### Physics Setup
1. **Character Controller**
   - Configure appropriate collision layers
   - Set reasonable movement parameters
   - Handle edge cases properly

2. **Movement Tuning**
   - Balance movement speeds
   - Configure jump heights
   - Adjust ground friction

3. **Collision Handling**
   - Use efficient collision shapes
   - Handle steep slopes gracefully
   - Prevent tunneling issues

### Networking
1. **State Synchronization**
   - Optimize update frequency
   - Use delta compression
   - Handle latency gracefully

2. **Interpolation**
   - Smooth position updates
   - Handle teleports properly
   - Maintain visual quality

3. **Performance**
   - Batch network updates
   - Optimize state size
   - Handle disconnects gracefully

## Technical Implementation

### Player State Machine
```javascript
class PlayerState {
  constructor() {
    this.states = {
      IDLE: 'idle',
      WALKING: 'walking',
      RUNNING: 'running',
      JUMPING: 'jumping',
      FALLING: 'falling'
    }
    
    this.transitions = {
      IDLE: ['WALKING', 'JUMPING'],
      WALKING: ['IDLE', 'RUNNING', 'JUMPING'],
      RUNNING: ['WALKING', 'JUMPING'],
      JUMPING: ['FALLING'],
      FALLING: ['IDLE']
    }
  }
}
```

### Ground Detection
```javascript
updateGroundState() {
  const sweepHit = physics.sweep(
    groundGeometry,
    origin,
    DOWN,
    maxDistance,
    hitMask
  )
  
  if (sweepHit) {
    this.grounded = true
    this.groundNormal.copy(sweepHit.normal)
    this.groundAngle = UP.angleTo(groundNormal)
  }
}
```

### Camera System
```javascript
updateCamera(delta) {
  // Look rotation
  if (pointer.locked) {
    camera.rotation.y += -pointer.delta.x * lookSpeed
    camera.rotation.x += -pointer.delta.y * lookSpeed
  }
  
  // Position following
  camera.position.copy(player.position)
  camera.position.y += eyeHeight
}
``` 