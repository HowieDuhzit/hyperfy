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

  broadcast() {
    this.world.emit('ui', { ...this.state })
  }

    destroy() {
    this.control?.release()
    this.control = null
  }
}

