export class Control {
  constructor() {
    this.entries = {}
    this.addButton('toggleBuildMode', {
      onPress: () => {
        // Toggle build mode when either keyboard Tab or gamepad Select is pressed
        this.toggleBuildMode?.()
      }
    })
    
    // Add other buttons and controls
    this.addButton('jump')
    this.addButton('sprint')
    this.addButton('crouch')
    this.addButton('moveForward', { value: 0 })
    this.addButton('moveBackward', { value: 0 })
    this.addButton('moveLeft', { value: 0 })
    this.addButton('moveRight', { value: 0 })
  }

  addButton(name, options = {}) {
    const button = {
      $button: true,
      name,
      down: false,
      pressed: false,
      released: false,
      value: 0,
      ...options
    }
    this.entries[name] = button
    return button
  }

  onButtonPress(prop) {
    const button = this.entries[prop]
    if (button) {
      button.pressed = true
      button.down = true
      button.onPress?.()
      return button.capture
    }
    return false
  }

  onButtonRelease(prop) {
    const button = this.entries[prop]
    if (button) {
      button.down = false
      button.released = true
      button.onRelease?.()
    }
  }
} 