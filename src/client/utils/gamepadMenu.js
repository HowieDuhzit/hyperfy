import { GAMEPAD_BUTTON } from '../../core/extras/Gamepad'

// Constants for menu navigation
const MENU_NAV_REPEAT_DELAY = 200 // ms before repeating navigation
const MENU_NAV_REPEAT_RATE = 100 // ms between repeats

class GamepadMenuNavigator {
  constructor() {
    this.focusedElement = null
    this.lastNavTime = 0
    this.repeatTimer = null
    this.isRepeating = false
    this.currentDirection = null
  }

  // Find all focusable elements in the menu
  getFocusableElements() {
    return Array.from(document.querySelectorAll(
      'button, [role="button"], a, input, select, [tabindex]:not([tabindex="-1"])'
    )).filter(el => {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
  }

  // Get the next focusable element in the specified direction
  getNextFocusableElement(direction) {
    const elements = this.getFocusableElements()
    if (!elements.length) return null

    const currentIndex = elements.indexOf(this.focusedElement || document.activeElement)
    let nextIndex

    switch (direction) {
      case 'up':
      case 'left':
        nextIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1
        break
      case 'down':
      case 'right':
        nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0
        break
      default:
        return null
    }

    return elements[nextIndex]
  }

  // Handle navigation in a specific direction
  navigate(direction) {
    const now = Date.now()
    
    // Start new navigation or handle repeat
    if (!this.isRepeating || this.currentDirection !== direction) {
      this.currentDirection = direction
      this.isRepeating = true
      this.performNavigation(direction)
      this.lastNavTime = now
      
      // Set up repeat timer
      clearTimeout(this.repeatTimer)
      this.repeatTimer = setTimeout(() => {
        this.repeatNavigation()
      }, MENU_NAV_REPEAT_DELAY)
    }
  }

  // Stop navigation repeat
  stopNavigation() {
    this.isRepeating = false
    this.currentDirection = null
    clearTimeout(this.repeatTimer)
  }

  // Perform the actual navigation
  performNavigation(direction) {
    const nextElement = this.getNextFocusableElement(direction)
    if (nextElement) {
      nextElement.focus()
      this.focusedElement = nextElement
    }
  }

  // Handle navigation repeat
  repeatNavigation() {
    if (!this.isRepeating) return
    
    this.performNavigation(this.currentDirection)
    
    this.repeatTimer = setTimeout(() => {
      this.repeatNavigation()
    }, MENU_NAV_REPEAT_RATE)
  }

  // Handle button press
  handleButtonPress(button) {
    if (!this.focusedElement) return

    let parentMenu

    switch (button) {
      case GAMEPAD_BUTTON.A:
        // Simulate click/enter on the focused element
        this.focusedElement.click()
        break
      case GAMEPAD_BUTTON.B:
        // Handle back/cancel - focus parent menu if possible
        parentMenu = this.focusedElement.closest('[role="menu"]')?.parentElement?.querySelector('[role="menuitem"]')
        if (parentMenu) {
          parentMenu.focus()
          this.focusedElement = parentMenu
        }
        break
      case GAMEPAD_BUTTON.DPAD_UP:
        this.navigate('up')
        break
      case GAMEPAD_BUTTON.DPAD_DOWN:
        this.navigate('down')
        break
      case GAMEPAD_BUTTON.DPAD_LEFT:
        this.navigate('left')
        break
      case GAMEPAD_BUTTON.DPAD_RIGHT:
        this.navigate('right')
        break
    }
  }

  // Handle button release
  handleButtonRelease(button) {
    switch (button) {
      case GAMEPAD_BUTTON.DPAD_UP:
      case GAMEPAD_BUTTON.DPAD_DOWN:
      case GAMEPAD_BUTTON.DPAD_LEFT:
      case GAMEPAD_BUTTON.DPAD_RIGHT:
        if (this.currentDirection) {
          this.stopNavigation()
        }
        break
    }
  }

  // Update method to be called in the game loop
  update(gamepadManager) {
    if (!gamepadManager.connected) return

    const gamepad = gamepadManager.gamepads.get(0) // Use first gamepad
    if (!gamepad) return

    // Handle button presses
    gamepad.buttons.forEach((button, index) => {
      if (button.pressed) {
        this.handleButtonPress(index)
      } else if (!button.pressed && button.wasPressed) {
        this.handleButtonRelease(index)
      }
      button.wasPressed = button.pressed
    })
  }
}

// Create and export a singleton instance
export const gamepadMenuNavigator = new GamepadMenuNavigator() 