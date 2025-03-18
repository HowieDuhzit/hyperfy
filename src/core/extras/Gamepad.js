// Gamepad button mappings for different controller types
export const GAMEPAD_BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  SELECT: 8,
  START: 9,
  L3: 10, // Left stick press
  R3: 11, // Right stick press
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15
}

export const GAMEPAD_AXIS = {
  LEFT_STICK_X: 0,
  LEFT_STICK_Y: 1,
  RIGHT_STICK_X: 2,
  RIGHT_STICK_Y: 3
}

// Controller type identifiers
export const CONTROLLER_TYPE = {
  XBOX: 'xbox',
  PS4: 'ps4',
  PS5: 'ps5',
  SWITCH_PRO: 'switch_pro',
  GENERIC: 'generic'
}

// Controller type detection patterns
const CONTROLLER_PATTERNS = {
  [CONTROLLER_TYPE.XBOX]: /xbox|xinput/i,
  [CONTROLLER_TYPE.PS4]: /054c.*054c/i,
  [CONTROLLER_TYPE.PS5]: /054c.*0ce6/i,
  [CONTROLLER_TYPE.SWITCH_PRO]: /057e.*2009/i,
}

// Button icon mappings for different controller types
export const BUTTON_ICONS = {
  [CONTROLLER_TYPE.XBOX]: {
    A: '/icons/xbox/a.png',
    B: '/icons/xbox/b.png',
    X: '/icons/xbox/x.png',
    Y: '/icons/xbox/y.png',
    L1: '/icons/xbox/lb.png',
    R1: '/icons/xbox/rb.png',
    L2: '/icons/xbox/lt.png',
    R2: '/icons/xbox/rt.png',
    L3: '/icons/xbox/ls.png',
    R3: '/icons/xbox/rs.png',
    SELECT: '/icons/xbox/select.png',
    START: '/icons/xbox/start.png',
    DPAD_UP: '/icons/xbox/dpad_up.png',
    DPAD_DOWN: '/icons/xbox/dpad_down.png',
    DPAD_LEFT: '/icons/xbox/dpad_left.png',
    DPAD_RIGHT: '/icons/xbox/dpad_right.png'
  },
  [CONTROLLER_TYPE.PS4]: {
    A: '/icons/ps4/cross.png',
    B: '/icons/ps4/circle.png',
    X: '/icons/ps4/square.png',
    Y: '/icons/ps4/triangle.png',
    L1: '/icons/ps4/l1.png',
    R1: '/icons/ps4/r1.png',
    L2: '/icons/ps4/l2.png',
    R2: '/icons/ps4/r2.png',
    L3: '/icons/ps4/l3.png',
    R3: '/icons/ps4/r3.png',
    SELECT: '/icons/ps4/share.png',
    START: '/icons/ps4/options.png',
    DPAD_UP: '/icons/ps4/dpad_up.png',
    DPAD_DOWN: '/icons/ps4/dpad_down.png',
    DPAD_LEFT: '/icons/ps4/dpad_left.png',
    DPAD_RIGHT: '/icons/ps4/dpad_right.png'
  },
  [CONTROLLER_TYPE.PS5]: {
    A: '/icons/ps5/cross.png',
    B: '/icons/ps5/circle.png',
    X: '/icons/ps5/square.png',
    Y: '/icons/ps5/triangle.png',
    L1: '/icons/ps5/l1.png',
    R1: '/icons/ps5/r1.png',
    L2: '/icons/ps5/l2.png',
    R2: '/icons/ps5/r2.png',
    L3: '/icons/ps5/l3.png',
    R3: '/icons/ps5/r3.png',
    SELECT: '/icons/ps5/create.png',
    START: '/icons/ps5/options.png',
    DPAD_UP: '/icons/ps5/dpad_up.png',
    DPAD_DOWN: '/icons/ps5/dpad_down.png',
    DPAD_LEFT: '/icons/ps5/dpad_left.png',
    DPAD_RIGHT: '/icons/ps5/dpad_right.png'
  },
  [CONTROLLER_TYPE.SWITCH_PRO]: {
    A: '/icons/switch/b.png',
    B: '/icons/switch/a.png',
    X: '/icons/switch/y.png',
    Y: '/icons/switch/x.png',
    L1: '/icons/switch/l.png',
    R1: '/icons/switch/r.png',
    L2: '/icons/switch/zl.png',
    R2: '/icons/switch/zr.png',
    L3: '/icons/switch/ls.png',
    R3: '/icons/switch/rs.png',
    SELECT: '/icons/switch/minus.png',
    START: '/icons/switch/plus.png',
    DPAD_UP: '/icons/switch/dpad_up.png',
    DPAD_DOWN: '/icons/switch/dpad_down.png',
    DPAD_LEFT: '/icons/switch/dpad_left.png',
    DPAD_RIGHT: '/icons/switch/dpad_right.png'
  }
}

// Deadzone for analog sticks to prevent drift
const STICK_DEADZONE = 0.1

export class GamepadManager {
  constructor() {
    this.gamepads = new Map()
    this.listeners = new Map()
    this.connected = false
    this.controllerType = CONTROLLER_TYPE.GENERIC
    this.overrideType = null // For manual override in settings
    
    // Bind event handlers
    this.handleGamepadConnected = this.handleGamepadConnected.bind(this)
    this.handleGamepadDisconnected = this.handleGamepadDisconnected.bind(this)
    
    // Add event listeners
    window.addEventListener('gamepadconnected', this.handleGamepadConnected)
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected)
  }

  detectControllerType(gamepad) {
    if (this.overrideType) return this.overrideType
    
    const id = gamepad.id.toLowerCase()
    for (const [type, pattern] of Object.entries(CONTROLLER_PATTERNS)) {
      if (pattern.test(id)) {
        return type
      }
    }
    return CONTROLLER_TYPE.GENERIC
  }

  setControllerTypeOverride(type) {
    this.overrideType = type
    // Re-detect type for all connected gamepads
    for (const gamepad of this.gamepads.values()) {
      if (gamepad) {
        this.controllerType = this.detectControllerType(gamepad)
        this.emit('controllerType', this.controllerType)
      }
    }
  }

  getButtonIcon(buttonIndex) {
    const buttonName = Object.entries(GAMEPAD_BUTTON).find(([_, value]) => value === buttonIndex)?.[0]
    if (!buttonName) return null
    
    const icons = BUTTON_ICONS[this.controllerType]
    return icons ? icons[buttonName] : null
  }

  // Add hasGamepad method
  hasGamepad(index) {
    return this.gamepads.has(index) && this.gamepads.get(index) !== null
  }

  handleGamepadConnected(event) {
    const gamepad = event.gamepad
    this.gamepads.set(gamepad.index, gamepad)
    this.connected = true
    this.controllerType = this.detectControllerType(gamepad)
    this.emit('connect', gamepad)
    this.emit('controllerType', this.controllerType)
  }

  handleGamepadDisconnected(event) {
    const gamepad = event.gamepad
    this.gamepads.delete(gamepad.index)
    this.connected = this.gamepads.size > 0
    this.emit('disconnect', gamepad)
  }

  update() {
    // Get the latest gamepad states
    const gamepads = navigator.getGamepads()
    
    for (const gamepad of gamepads) {
      if (!gamepad) continue
      
      // Update our stored gamepad state
      this.gamepads.set(gamepad.index, gamepad)
      
      // Process buttons
      gamepad.buttons.forEach((button, index) => {
        if (button.pressed) {
          this.emit('button', { index, gamepad, pressed: true })
        }
      })
      
      // Process axes
      const axes = gamepad.axes.map(axis => {
        // Apply deadzone
        return Math.abs(axis) < STICK_DEADZONE ? 0 : axis
      })
      
      this.emit('axes', { gamepad, axes })
    }
  }

  // Event emitter functionality
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        callback(data)
      }
    }
  }

  // Helper methods for getting gamepad state
  getButton(gamepadIndex, buttonIndex) {
    const gamepad = this.gamepads.get(gamepadIndex)
    if (!gamepad) return false
    return gamepad.buttons[buttonIndex]?.pressed || false
  }

  getAxis(gamepadIndex, axisIndex) {
    const gamepad = this.gamepads.get(gamepadIndex)
    if (!gamepad) return 0
    const value = gamepad.axes[axisIndex] || 0
    return Math.abs(value) < STICK_DEADZONE ? 0 : value
  }

  getStick(gamepadIndex, isRight = false) {
    const xAxis = isRight ? GAMEPAD_AXIS.RIGHT_STICK_X : GAMEPAD_AXIS.LEFT_STICK_X
    const yAxis = isRight ? GAMEPAD_AXIS.RIGHT_STICK_Y : GAMEPAD_AXIS.LEFT_STICK_Y
    
    return {
      x: this.getAxis(gamepadIndex, xAxis),
      y: this.getAxis(gamepadIndex, yAxis)
    }
  }

  destroy() {
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected)
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected)
    this.listeners.clear()
    this.gamepads.clear()
  }
} 