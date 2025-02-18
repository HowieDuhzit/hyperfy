# Input Handling System Documentation

The Hyperfy engine implements a sophisticated input handling system with priority-based control management, supporting keyboard, mouse, touch, and cyberpunk-themed interactions. The system integrates with the [Player System](/docs/core/player/README.md), [UI System](/docs/core/ui/README.md), and [Physics System](/docs/core/physics/README.md).

## Core Components

### Control System
Part of the [Entity Component System](/docs/core/ecs/README.md):
```javascript
class ClientControls extends System {
  constructor(world) {
    this.controls = []           // Priority-ordered control bindings
    this.isUserGesture = false
    this.pointer = {
      locked: false,
      coords: Vector3,          // Normalized [0,1]
      position: Vector3,        // Screen pixels
      delta: Vector3           // Movement delta
    }
    this.touches = new Map()    // Touch tracking
  }
}
```

## Priority System
Used by [Player System](/docs/core/player/README.md), [UI System](/docs/core/ui/README.md), and other systems.

### Control Priorities
```javascript
const ControlPriorities = {
  PLAYER: 0,    // Base player controls
  EDITOR: 1,    // Editor functionality
  ENTITY: 2,    // Entity manipulation
  APP: 3,       // Application controls
  ACTION: 4     // High-priority actions
}
```

## Input Types
Provides input handling for all [UI System](/docs/core/ui/README.md) components and [Player System](/docs/core/player/README.md) controls.

### Keyboard Input
```javascript
// Key Press Handling
onKeyDown(e) {
  if (e.repeat) return
  for (const control of this.controls) {
    control.api.buttons[code] = true
    control.api.pressed[code] = true
    const consume = control.options.onPress?.(code)
    if (consume) break
  }
}
```

### Mouse Input
Integrates with the [UI System](/docs/core/ui/README.md) for interaction:
```javascript
// Mouse Button Constants
const LMB = 1  // Left Mouse Button
const RMB = 2  // Right Mouse Button

// Mouse Movement
onPointerMove(e) {
  pointer.coords.x = offsetX / width
  pointer.coords.y = offsetY / height
  pointer.delta.x += e.movementX
  pointer.delta.y += e.movementY
}
```

### Touch Input
Provides mobile support for the [UI System](/docs/core/ui/README.md):
```javascript
// Touch Tracking
onTouchStart(e) {
  const touch = {
    id: touch.identifier,
    position: new Vector3(),
    delta: new Vector3(),
    prevPosition: new Vector3()
  }
}
```

## Control Binding
Used by the [Player System](/docs/core/player/README.md) for movement and camera control.

### Binding Interface
```javascript
bind(options = {}) {
  return {
    buttons: {},        // Current button states
    pressed: {},        // Just pressed buttons
    released: {},       // Just released buttons
    pointer: {
      coords: Vector3,  // Normalized position
      position: Vector3,// Screen position
      delta: Vector3,   // Movement delta
      locked: false,    // Pointer lock state
      lock(), unlock() // Lock controls
    },
    camera: {
      position: Vector3,
      quaternion: Quaternion,
      rotation: Euler,
      zoom: Number,
      claim(), unclaim()
    }
  }
}
```

## Cyberpunk Features

### Neural Interface
- Brain-computer interface simulation
- Neural feedback visualization
- Synaptic response tracking

### HoloControls™
```javascript
// Holographic Input
component.setHoloInput({
  gestureTracking: true,
  neuralSync: 0.8,
  feedbackIntensity: 0.6
})
```

### CyberTouch™
```javascript
// Haptic Feedback
control.haptics.trigger({
  intensity: 0.7,
  duration: 100,
  pattern: 'neural-pulse'
})
```

## Event System

### Event Flow
1. Input Detection
2. Priority Check
3. Event Propagation
4. Optional Consumption
5. Neural Feedback

### Event Types
```javascript
// Input Events
{
  onPress: (code) => boolean,    // Button press
  onRelease: (code) => boolean,  // Button release
  onPointer: () => boolean,      // Pointer movement
  onScroll: () => boolean,       // Scroll input
  onTouch: (info) => boolean     // Touch input
}
```

## Integration Examples

### Player Controls
```javascript
const control = world.controls.bind({
  priority: ControlPriorities.PLAYER,
  onPress: code => {
    if (code === 'MouseRight') {
      control.pointer.lock()
    }
  },
  onRelease: code => {
    if (code === 'MouseRight') {
      control.pointer.unlock()
    }
  }
})
```

### Editor Controls
```javascript
const control = world.controls.bind({
  priority: ControlPriorities.EDITOR,
  onPress: code => {
    if (code === 'KeyE') {
      this.activateEditor()
    }
  }
})
```

### Touch Controls
```javascript
// Virtual Joystick
onTouch: touch => {
  if (touch.position.x < screen.width / 2) {
    this.stick = {
      center: touch.position.clone(),
      touch
    }
  }
}
```

## Best Practices

### Input Management
1. **Priority Handling**
   - Use appropriate priority levels
   - Handle input consumption correctly
   - Maintain clear control hierarchy

2. **Event Processing**
   - Batch input processing
   - Handle multi-touch properly
   - Clean up event listeners

3. **Performance**
   - Optimize event handlers
   - Minimize pointer events
   - Use efficient data structures

### User Experience
1. **Responsiveness**
   - Immediate feedback
   - Smooth animations
   - Predictive input

2. **Cross-platform**
   - Handle multiple input types
   - Adapt to device capabilities
   - Provide fallbacks

3. **Cyberpunk Integration**
   - Neural feedback effects
   - Holographic interactions
   - Tech-inspired visuals

## Technical Implementation

### Input State Management
```javascript
class InputState {
  constructor() {
    this.pressed = new Set()
    this.held = new Set()
    this.released = new Set()
    this.timestamp = performance.now()
  }
  
  update() {
    this.released.clear()
    this.pressed.clear()
  }
}
```

### Pointer Lock
```javascript
async lockPointer() {
  this.pointer.shouldLock = true
  try {
    await viewport.requestPointerLock()
    return true
  } catch (err) {
    return false
  }
}
```

### Touch Processing
```javascript
processTouchInput(touch) {
  const currentX = touch.clientX
  const currentY = touch.clientY
  const delta = {
    x: currentX - touch.prevX,
    y: currentY - touch.prevY
  }
  return { position: [currentX, currentY], delta }
}
``` 