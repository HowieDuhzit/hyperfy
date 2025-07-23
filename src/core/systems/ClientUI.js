import { isBoolean } from 'lodash-es'
import { ControlPriorities } from '../extras/ControlPriorities'
import { System } from './System'
import { thickness } from 'three/src/nodes/TSL.js'

const appPanes = ['app', 'script', 'nodes', 'meta']

export class ClientUI extends System {
  constructor(world) {
    super(world)
    console.log('🔥🔥🔥 ClientUI CONSTRUCTOR CALLED!!! 🔥🔥🔥')
    this.state = {
      visible: true,
      active: false,
      app: null,
      pane: null,
      reticleSuppressors: 0,
    }
    this.lastAppPane = 'app'
    this.control = null
  }

  start() {
    console.log('🚨 ClientUI STARTED - ESC handler is active! Timestamp:', Date.now())
    this.control = this.world.controls.bind({ priority: ControlPriorities.CORE_UI })
  }

  update() {
    if (this.control.escape.pressed) {
      console.log('🚨🚨🚨 ESC KEY DETECTED!!! 🚨🚨🚨')
      this.handleEscape()
    }
    if (
      this.control.keyZ.pressed &&
      !this.control.metaLeft.down &&
      !this.control.controlLeft.down &&
      !this.control.shiftLeft.down
    ) {
      this.state.visible = !this.state.visible
      this.broadcast()
    }
    // Remove automatic UI state management - let ESC handler control it explicitly
  }

  togglePane(pane) {
    if (pane === null || this.state.pane === pane) {
      this.state.pane = null
      this.state.active = false
    } else {
      this.state.pane = pane
      this.state.active = true
      if (appPanes.includes(pane)) {
        this.lastAppPane = pane
      }
    }
    this.broadcast()
  }

  toggleVisible(value) {
    value = isBoolean(value) ? value : !this.state.visible
    if (this.state.visible === value) return
    this.state.visible = value
    this.broadcast()
  }

  setApp(app) {
    this.state.app = app
    this.state.pane = app ? this.lastAppPane : null
    this.state.active = !!app
    this.broadcast()
  }

  suppressReticle() {
    this.state.reticleSuppressors++
    let released
    this.broadcast()
    return () => {
      if (released) return
      this.state.reticleSuppressors--
      this.broadcast()
      released = true
    }
  }

  confirm(options) {
    const promise = new Promise(resolve => {
      options.confirm = () => {
        this.world.emit('confirm', null)
        resolve(true)
      }
      options.cancel = () => {
        this.world.emit('confirm', null)
        resolve(false)
      }
    })
    this.world.emit('confirm', options)
    return promise
  }

  handleEscape() {
    console.log('ESC - Current state:', { 
      pane: this.state.pane, 
      app: this.state.app, 
      pointerLocked: this.control?.pointer?.locked 
    })
    
    // If any menu is open, close it and lock cursor
    if (this.state.pane || this.state.app) {
      console.log('Closing menu/app and locking cursor')
      this.state.pane = null
      this.state.app = null
      this.state.active = false
      this.control.pointer.lock()
      this.broadcast()
      return
    }
    
    // Otherwise, open main menu and unlock cursor
    console.log('Opening main menu and unlocking cursor')
    this.state.pane = 'prefs'
    this.state.active = true
    this.control.pointer.unlock()
    this.broadcast()
  }

  // 🎮 NEW: VR UI Interaction Methods
  handleVRClick(handedness, action) {
    console.log(`🎮 VR ${handedness} controller ${action} click`)
    
    // Handle VR controller clicks for UI interaction
    switch (action) {
      case 'primary':
        // Primary trigger - equivalent to mouse click
        this.handleVRPrimaryClick(handedness)
        break
      case 'secondary':
        // Secondary button - equivalent to right click
        this.handleVRSecondaryClick(handedness)
        break
    }
  }

  handleVRNavigation(handedness, x, y) {
    // Handle VR controller thumbstick navigation
    console.log(`🎮 VR ${handedness} navigation: ${x.toFixed(2)}, ${y.toFixed(2)}`)
    
    // Navigate UI elements based on thumbstick input
    if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
      this.navigateUIElements(handedness, x, y)
    }
  }

  handleVRHover(element, handedness) {
    // Handle VR controller raycast hover over UI elements
    if (element) {
      console.log(`🎮 VR ${handedness} hovering over:`, element.name || element.type)
      
      // Add hover effect to UI element
      element.dispatchEvent(new CustomEvent('vrHover', {
        bubbles: true,
        detail: { handedness, element }
      }))
    }
  }

  handleVRPrimaryClick(handedness) {
    // Handle primary trigger click in VR
    if (this.state.pane || this.state.app) {
      // If menu is open, close it
      this.handleEscape()
    } else {
      // If no menu is open, open main menu
      this.state.pane = 'prefs'
      this.state.active = true
      this.broadcast()
    }
  }

  handleVRSecondaryClick(handedness) {
    // Handle secondary button click in VR
    this.handleEscape()
  }

  navigateUIElements(handedness, x, y) {
    // Navigate through UI elements using thumbstick
    const currentElement = this.getCurrentUIElement()
    if (!currentElement) return

    // Find next/previous element based on thumbstick direction
    const nextElement = this.findNextUIElement(currentElement, x, y)
    if (nextElement) {
      this.focusUIElement(nextElement)
    }
  }

  getCurrentUIElement() {
    // Get currently focused UI element
    return document.activeElement
  }

  findNextUIElement(currentElement, x, y) {
    // Find next UI element based on navigation direction
    const uiElements = document.querySelectorAll('[data-ui], .ui-element')
    const currentIndex = Array.from(uiElements).indexOf(currentElement)
    
    if (currentIndex === -1) return uiElements[0]
    
    let nextIndex = currentIndex
    
    if (Math.abs(x) > Math.abs(y)) {
      // Horizontal navigation
      if (x > 0) {
        nextIndex = (currentIndex + 1) % uiElements.length
      } else {
        nextIndex = currentIndex === 0 ? uiElements.length - 1 : currentIndex - 1
      }
    } else {
      // Vertical navigation
      if (y > 0) {
        nextIndex = (currentIndex + 1) % uiElements.length
      } else {
        nextIndex = currentIndex === 0 ? uiElements.length - 1 : currentIndex - 1
      }
    }
    
    return uiElements[nextIndex]
  }

  focusUIElement(element) {
    // Focus a UI element
    if (element && element.focus) {
      element.focus()
      
      // Add visual feedback for VR focus
      element.dispatchEvent(new CustomEvent('vrFocus', {
        bubbles: true,
        detail: { element }
      }))
    }
  }

  broadcast() {
    this.world.emit('ui', { ...this.state })
  }

    destroy() {
    this.control?.release()
    this.control = null
  }
}

