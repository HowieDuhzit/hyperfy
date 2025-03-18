import { bindRotations } from '../extras/bindRotations'
import { buttons, codeToProp, propToCode } from '../extras/buttons'
import * as THREE from '../extras/three'
import { System } from './System'
import { GamepadManager, GAMEPAD_BUTTON, GAMEPAD_AXIS } from '../extras/Gamepad'

const LMB = 1 // bitmask
const RMB = 2 // bitmask
const MMB = 4 // bitmask - middle mouse button
const MouseLeft = 'mouseLeft'
const MouseRight = 'mouseRight'
const MouseMiddle = 'mouseMiddle'
const HandednessLeft = 'left'
const HandednessRight = 'right'

let actionIds = 0

/**
 * Control System
 *
 * - runs on the client
 * - provides a layered priority control system for both input and output
 *
 */

const controlTypes = {
  // key: createButton,
  mouseLeft: createButton,
  mouseRight: createButton,
  mouseMiddle: createButton,
  touchStick: createVector,
  scrollDelta: createValue,
  pointer: createPointer,
  screen: createScreen,
  camera: createCamera,
  xrLeftStick: createVector,
  xrLeftBtn1: createButton,
  xrLeftBtn2: createButton,
  xrRightStick: createVector,
  xrRightBtn1: createButton,
  xrRightBtn2: createButton,
  // Add gamepad control types
  gamepadLeftStick: createVector,
  gamepadRightStick: createVector,
  gamepadA: createButton,
  gamepadB: createButton,
  gamepadX: createButton,
  gamepadY: createButton,
  gamepadL1: createButton,
  gamepadR1: createButton,
  gamepadL2: createButton,
  gamepadR2: createButton,
  gamepadSelect: createButton,
  gamepadStart: createButton,
  gamepadL3: createButton,
  gamepadR3: createButton,
  gamepadDPadUp: createButton,
  gamepadDPadDown: createButton,
  gamepadDPadLeft: createButton,
  gamepadDPadRight: createButton,
  // Add movement controls
  moveForward: createVector,
  moveBackward: createVector,
  moveLeft: createVector,
  moveRight: createVector,
  jump: createButton,
  sprint: createButton,
  crouch: createButton,
  toggleBuildMode: createButton
}

export class ClientControls extends System {
  constructor(world) {
    super(world)
    this.controls = []
    this.actions = []
    this.buttonsDown = new Set()
    this.mouseButtonsDown = 0
    this.isUserGesture = false
    this.isMac = /Mac/.test(navigator.platform)
    this.pointer = {
      locked: false,
      shouldLock: false,
      coords: new THREE.Vector3(), // [0,0] to [1,1]
      position: new THREE.Vector3(), // [0,0] to [viewportWidth,viewportHeight]
      delta: new THREE.Vector3(), // position delta (pixels)
    }
    this.touches = new Map() // id -> { id, position, delta, prevPosition }
    this.screen = {
      width: 0,
      height: 0,
    }
    this.scroll = {
      delta: 0,
    }
    this.xrSession = null
    this.mmbDown = false
    this.middleMouseLocked = false
    this.activeInputDevice = 'keyboard' // Track active input device
    this.lastGamepadActivity = 0 // Track last gamepad activity
    this.gamepadInactivityTimeout = 1000 // Switch back to keyboard after 1 second of no gamepad input
    this.buildModeEnabled = false // Track build mode state
    this.xButtonDown = false // Track X button state
    this.yButtonDown = false // Track Y button state
    this.bButtonDown = false // Track B button state
    this.dpadLeftDown = false
    this.dpadRightDown = false

    // Initialize keybinds
    this.initKeybinds()

    // Initialize gamepad manager
    this.gamepadManager = new GamepadManager()
    this.gamepadManager.on('connect', this.onGamepadConnect.bind(this))
    this.gamepadManager.on('disconnect', this.onGamepadDisconnect.bind(this))
    this.gamepadManager.on('button', this.onGamepadButton.bind(this))
    this.gamepadManager.on('axes', this.onGamepadAxes.bind(this))

    // Define event handlers as class methods first
    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    this.onPointerDown = this.onPointerDown.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerLeave = this.onPointerLeave.bind(this)
    this.onWheel = this.onWheel.bind(this)
    this.onContextMenu = this.onContextMenu.bind(this)
    this.onVisibilityChange = this.onVisibilityChange.bind(this)
    this.onPointerLockChange = this.onPointerLockChange.bind(this)
    this.onTouchStart = this.onTouchStart.bind(this)
    this.onTouchMove = this.onTouchMove.bind(this)
    this.onTouchEnd = this.onTouchEnd.bind(this)
    this.onResize = this.onResize.bind(this)
    this.onBlur = this.onBlur.bind(this)
    this.onXRSession = this.onXRSession.bind(this)
    this.onWindowPointerUp = this.onWindowPointerUp.bind(this)

    // Add document-level event listeners that don't depend on viewport
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    document.body.addEventListener('contextmenu', this.onContextMenu)
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
    this.world.on('build-mode', this.onBuildModeChange.bind(this))
  }

  onBuildModeChange = (enabled) => {
    this.buildModeEnabled = enabled
    
    // Handle build mode state change based on input device
    if (enabled) {
      // Ensure builder is enabled when build mode is activated
      if (this.world.builder) {
        this.world.builder.enabled = true
      }
      
      if (this.activeInputDevice === 'gamepad') {
        // For gamepad, lock pointer for reticle control
        this.lockPointer()
      }
      // For keyboard/mouse, leave pointer unlocked for cursor control
    } else {
      // Ensure builder is disabled when build mode is deactivated
      if (this.world.builder) {
        this.world.builder.enabled = false
      }
      
      // When exiting build mode, restore normal state
      if (this.activeInputDevice === 'gamepad') {
        this.lockPointer()
      } else {
        this.unlockPointer()
      }
    }
  }

  // Update the input device change handler
  onInputDeviceChange(device) {
    const previousDevice = this.activeInputDevice
    this.activeInputDevice = device
    this.world.emit('input-device-changed', device)

    // Handle transition between input devices
    if (this.buildModeEnabled) {
      if (device === 'gamepad') {
        // Switching to gamepad
        this.lockPointer()
        
        // Center the cursor
        if (this.viewport) {
          const rect = this.viewport.getBoundingClientRect()
          this.pointer.coords.x = 0.5
          this.pointer.coords.y = 0.5
          this.pointer.position.x = rect.width / 2
          this.pointer.position.y = rect.height / 2
        }

        // If we have a selected item, update its position to the reticle
        if (this.world.builder?.selected) {
          const hit = this.world.builder.getHitAtReticle(this.world.builder.selected, true)
          if (hit) {
            this.world.builder.selected.root.position.copy(hit.point)
          }
        }
      } else if (previousDevice === 'gamepad') {
        // Switching from gamepad to keyboard/mouse
        this.unlockPointer()
        
        // If we have a selected item, ensure it follows the mouse position
        if (this.world.builder?.selected) {
          const hit = this.world.builder.getHitAtPointer(this.world.builder.selected, true)
          if (hit) {
            this.world.builder.selected.root.position.copy(hit.point)
          }
        }
      }
    }
  }

  preFixedUpdate() {
    // mouse wheel delta
    for (const control of this.controls) {
      if (control.entries.scrollDelta) {
        control.entries.scrollDelta.value = this.scroll.delta
        if (control.entries.scrollDelta.capture) break
      }
    }

    // Handle keyboard movement for the first control
    const control = this.controls[0]
    if (control) {
      // Ensure movement controls exist
      if (!control.entries.moveRight) control.entries.moveRight = createVector(this, control, 'moveRight')
      if (!control.entries.moveLeft) control.entries.moveLeft = createVector(this, control, 'moveLeft')
      if (!control.entries.moveForward) control.entries.moveForward = createVector(this, control, 'moveForward')
      if (!control.entries.moveBackward) control.entries.moveBackward = createVector(this, control, 'moveBackward')
      if (!control.entries.jump) control.entries.jump = createButton(this, control, 'jump')
      if (!control.entries.sprint) control.entries.sprint = createButton(this, control, 'sprint')
      if (!control.entries.crouch) control.entries.crouch = createButton(this, control, 'crouch')
      if (!control.entries.toggleBuildMode) control.entries.toggleBuildMode = createButton(this, control, 'toggleBuildMode')

      // Handle keyboard movement - ONLY use WASD keys
      control.entries.moveRight.value.x = this.buttonsDown.has('moveRight') ? 1 : 0
      control.entries.moveLeft.value.x = this.buttonsDown.has('moveLeft') ? 1 : 0
      control.entries.moveForward.value.x = this.buttonsDown.has('moveForward') ? 1 : 0
      control.entries.moveBackward.value.x = this.buttonsDown.has('moveBackward') ? 1 : 0
    }

    // xr
    if (this.xrSession) {
      this.xrSession.inputSources?.forEach(src => {
        // left
        if (src.gamepad && src.handedness === HandednessLeft) {
          for (const control of this.controls) {
            if (control.entries.xrLeftStick) {
              control.entries.xrLeftStick.value.x = src.gamepad.axes[2]
              control.entries.xrLeftStick.value.z = src.gamepad.axes[3]
              if (control.entries.xrLeftStick.capture) break
            }
            if (control.entries.xrLeftBtn1) {
              const button = control.entries.xrLeftBtn1
              const down = src.gamepad.buttons[4].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
            if (control.entries.xrLeftBtn2) {
              const button = control.entries.xrLeftBtn2
              const down = src.gamepad.buttons[5].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
          }
        }
        // right
        if (src.gamepad && src.handedness === HandednessRight) {
          for (const control of this.controls) {
            if (control.entries.xrRightStick) {
              control.entries.xrRightStick.value.x = src.gamepad.axes[2]
              control.entries.xrRightStick.value.z = src.gamepad.axes[3]
              if (control.entries.xrRightStick.capture) break
            }
            if (control.entries.xrRightBtn1) {
              const button = control.entries.xrRightBtn1
              const down = src.gamepad.buttons[4].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
            if (control.entries.xrRightBtn2) {
              const button = control.entries.xrRightBtn2
              const down = src.gamepad.buttons[5].pressed
              if (down && !button.down) {
                button.pressed = true
                button.onPress?.()
              }
              if (!down && button.down) {
                button.released = true
                button.onRelease?.()
              }
              button.down = down
            }
          }
        }
      })
    }

    // Update gamepad state
    this.gamepadManager.update()

    // Process gamepad input for each control
    for (const control of this.controls) {
      // Left stick
      if (control.entries.gamepadLeftStick) {
        const stick = this.gamepadManager.getStick(0, false)
        control.entries.gamepadLeftStick.value.x = stick.x
        control.entries.gamepadLeftStick.value.z = stick.y
        if (control.entries.gamepadLeftStick.capture) break
      }

      // Right stick
      if (control.entries.gamepadRightStick) {
        const stick = this.gamepadManager.getStick(0, true)
        control.entries.gamepadRightStick.value.x = stick.x
        control.entries.gamepadRightStick.value.z = stick.y
        if (control.entries.gamepadRightStick.capture) break
      }

      // Buttons - ONLY update D-pad in build mode
      if (this.buildModeEnabled) {
        this.updateGamepadButton(control, 'gamepadDPadUp', GAMEPAD_BUTTON.DPAD_UP)
        this.updateGamepadButton(control, 'gamepadDPadDown', GAMEPAD_BUTTON.DPAD_DOWN)
        this.updateGamepadButton(control, 'gamepadDPadLeft', GAMEPAD_BUTTON.DPAD_LEFT)
        this.updateGamepadButton(control, 'gamepadDPadRight', GAMEPAD_BUTTON.DPAD_RIGHT)
      }

      // Other buttons
      this.updateGamepadButton(control, 'gamepadA', GAMEPAD_BUTTON.A)
      this.updateGamepadButton(control, 'gamepadB', GAMEPAD_BUTTON.B)
      this.updateGamepadButton(control, 'gamepadX', GAMEPAD_BUTTON.X)
      this.updateGamepadButton(control, 'gamepadY', GAMEPAD_BUTTON.Y)
      this.updateGamepadButton(control, 'gamepadL1', GAMEPAD_BUTTON.L1)
      this.updateGamepadButton(control, 'gamepadR1', GAMEPAD_BUTTON.R1)
      this.updateGamepadButton(control, 'gamepadL2', GAMEPAD_BUTTON.L2)
      this.updateGamepadButton(control, 'gamepadR2', GAMEPAD_BUTTON.R2)
      this.updateGamepadButton(control, 'gamepadSelect', GAMEPAD_BUTTON.SELECT)
      this.updateGamepadButton(control, 'gamepadStart', GAMEPAD_BUTTON.START)
      this.updateGamepadButton(control, 'gamepadL3', GAMEPAD_BUTTON.L3)
      this.updateGamepadButton(control, 'gamepadR3', GAMEPAD_BUTTON.R3)
    }

    // Handle gamepad buttons
    if (this.gamepadManager.hasGamepad(0)) {
      const control = this.controls[0]
      if (!control) return // Guard against no controls
      
      // Handle movement with left stick only
      const stick = this.gamepadManager.getStick(0, false)
      if (Math.abs(stick.x) > 0.2 || Math.abs(stick.y) > 0.2) {
        // Only switch to gamepad if significant stick movement
        if (Math.abs(stick.x) > 0.4 || Math.abs(stick.y) > 0.4) {
          this.lastGamepadActivity = Date.now()
          if (this.activeInputDevice !== 'gamepad') {
            this.onInputDeviceChange('gamepad')
          }
        }

        // Handle stick movement - ONLY use analog stick for movement
        if (Math.abs(stick.x) > 0.2) {
          control.entries.moveRight.value.x = Math.max(0, stick.x)
          control.entries.moveLeft.value.x = Math.max(0, -stick.x)
        } else {
          control.entries.moveRight.value.x = 0
          control.entries.moveLeft.value.x = 0
        }
        if (Math.abs(stick.y) > 0.2) {
          control.entries.moveForward.value.x = Math.max(0, -stick.y)
          control.entries.moveBackward.value.x = Math.max(0, stick.y)
        } else {
          control.entries.moveForward.value.x = 0
          control.entries.moveBackward.value.x = 0
        }
      } else {
        // Reset movement values when stick is neutral
        control.entries.moveRight.value.x = 0
        control.entries.moveLeft.value.x = 0
        control.entries.moveForward.value.x = 0
        control.entries.moveBackward.value.x = 0
      }

      // Handle right stick for camera/cursor control
      const rightStick = this.gamepadManager.getStick(0, true)
      if (Math.abs(rightStick.x) > 0.2 || Math.abs(rightStick.y) > 0.2) {
        // Only switch to gamepad if significant stick movement
        if (Math.abs(rightStick.x) > 0.4 || Math.abs(rightStick.y) > 0.4) {
          this.lastGamepadActivity = Date.now()
          if (this.activeInputDevice !== 'gamepad') {
            this.onInputDeviceChange('gamepad')
          }
        }

        // Update camera rotation based on right stick
        if (this.pointer.locked) {
          this.pointer.delta.x += rightStick.x * 20
          this.pointer.delta.y += rightStick.y * 20
        }
      }

      // Always check for Select button to toggle build mode
      this.updateGamepadButton(control, 'toggleBuildMode', GAMEPAD_BUTTON.SELECT)

      // Update other gamepad buttons based on mode
      if (this.buildModeEnabled) {
        // Handle X button for grab/place in build mode
        const xPressed = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.X)
        if (xPressed && !this.xButtonDown) {
          this.xButtonDown = true
          
          // Switch to gamepad mode and lock pointer when X is pressed
          if (this.activeInputDevice !== 'gamepad') {
            this.onInputDeviceChange('gamepad')
          }
          
          // If we have something selected, place it at the reticle position
          // Otherwise try to grab something at the reticle position
          if (this.world.builder?.selected) {
            // Get hit point at reticle for placement
            const hit = this.world.builder.getHitAtReticle(this.world.builder.selected, true)
            if (hit) {
              this.world.builder.select(null)
            }
          } else {
            const entity = this.world.builder?.getEntityAtReticle()
            if (entity?.isApp && !entity.data.pinned) {
              this.world.builder.select(entity)
            }
          }
        } else if (!xPressed && this.xButtonDown) {
          this.xButtonDown = false
        }

        // Handle Y button for inspect in build mode
        const yPressed = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.Y)
        if (yPressed && !this.yButtonDown) {
          this.yButtonDown = true
          
          // Switch to gamepad mode and lock pointer when Y is pressed
          if (this.activeInputDevice !== 'gamepad') {
            this.onInputDeviceChange('gamepad')
          }
          
          // Try to inspect entity at reticle
          const entity = this.world.builder?.getEntityAtReticle()
          if (entity) {
            this.world.builder.select(null)
            this.world.emit('inspect', entity)
          }
        } else if (!yPressed && this.yButtonDown) {
          this.yButtonDown = false
        }

        // Handle B button for delete in build mode
        const bPressed = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.B)
        if (bPressed && !this.bButtonDown) {
          this.bButtonDown = true
          
          // Switch to gamepad mode and lock pointer when B is pressed
          if (this.activeInputDevice !== 'gamepad') {
            this.onInputDeviceChange('gamepad')
          }
          
          // Try to delete entity at reticle or selected entity
          const entity = this.world.builder?.selected || this.world.builder?.getEntityAtReticle()
          if (entity?.isApp && !entity.data.pinned) {
            this.world.builder.select(null)
            entity.destroy(true)
          }
        } else if (!bPressed && this.bButtonDown) {
          this.bButtonDown = false
        }

        // Add R1/L1 button handling for rotation
        this.updateGamepadButton(control, 'gamepadR1', GAMEPAD_BUTTON.R1)
        this.updateGamepadButton(control, 'gamepadL1', GAMEPAD_BUTTON.L1)

        // Only process D-pad buttons in build mode, and NEVER map them to movement
        if (control.entries.gamepadDPadUp) control.entries.gamepadDPadUp.down = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.DPAD_UP)
        if (control.entries.gamepadDPadDown) control.entries.gamepadDPadDown.down = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.DPAD_DOWN)
        if (control.entries.gamepadDPadLeft) control.entries.gamepadDPadLeft.down = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.DPAD_LEFT)
        if (control.entries.gamepadDPadRight) control.entries.gamepadDPadRight.down = this.gamepadManager.getButton(0, GAMEPAD_BUTTON.DPAD_RIGHT)

      } else {
        // Normal mode controls - only use A for jump and L1 for sprint
        this.updateGamepadButton(control, 'jump', GAMEPAD_BUTTON.A)
        this.updateGamepadButton(control, 'sprint', GAMEPAD_BUTTON.L1)
      }
    }
  }

  postLateUpdate() {
    // clear pointer delta
    this.pointer.delta.set(0, 0, 0)
    // clear scroll delta
    this.scroll.delta = 0
    // clear buttons
    for (const control of this.controls) {
      for (const key in control.entries) {
        const value = control.entries[key]
        if (value.$button) {
          value.pressed = false
          value.released = false
        }
      }
    }
    // update camera
    let written
    for (const control of this.controls) {
      const camera = control.entries.camera
      if (camera?.write && !written) {
        this.world.rig.position.copy(camera.position)
        this.world.rig.quaternion.copy(camera.quaternion)
        this.world.camera.position.z = camera.zoom
        written = true
      } else if (camera) {
        camera.position.copy(this.world.rig.position)
        camera.quaternion.copy(this.world.rig.quaternion)
        camera.zoom = this.world.camera.position.z
      }
    }
    // clear touch deltas
    for (const [id, info] of this.touches) {
      info.delta.set(0, 0, 0)
    }
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.screen.width = this.viewport.offsetWidth
    this.screen.height = this.viewport.offsetHeight

    // Add all event listeners that depend on viewport
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onWindowPointerUp)

    this.viewport.addEventListener('pointerdown', this.onPointerDown)
    this.viewport.addEventListener('pointerup', this.onPointerUp)
    this.viewport.addEventListener('touchstart', this.onTouchStart)
    this.viewport.addEventListener('touchmove', this.onTouchMove)
    this.viewport.addEventListener('touchend', this.onTouchEnd)
    this.viewport.addEventListener('touchcancel', this.onTouchEnd)
    this.viewport.addEventListener('wheel', this.onWheel, { passive: false })
  }

  bind(options = {}) {
    const self = this
    const entries = {}
    const control = {
      options,
      entries,
      actions: null,
      api: {
        setActions(value) {
          if (value !== null && !Array.isArray(value)) {
            throw new Error('[control] actions must be null or array')
          }
          control.actions = value
          if (value) {
            for (const action of value) {
              action.id = ++actionIds
            }
          }
          self.buildActions()
        },
        release: () => {
          const idx = this.controls.indexOf(control)
          if (idx === -1) return
          this.controls.splice(idx, 1)
          options.onRelease?.()
        },
      },
    }
    // insert at correct priority level
    // - 0 is lowest priority generally for player controls
    // - apps use higher priority
    // - global systems use highest priority over everything
    const idx = this.controls.findIndex(c => c.options.priority <= options.priority)
    if (idx === -1) {
      this.controls.push(control)
    } else {
      this.controls.splice(idx, 0, control)
    }
    // return proxy api
    return new Proxy(control, {
      get(target, prop) {
        // internal property
        if (prop in target.api) {
          return target.api[prop]
        }
        // existing item
        if (prop in entries) {
          return entries[prop]
        }
        // new button item
        if (buttons.has(prop)) {
          entries[prop] = createButton(self, control, prop)
          return entries[prop]
        }
        // new item based on type
        const createType = controlTypes[prop]
        if (createType) {
          entries[prop] = createType(self, control, prop)
          return entries[prop]
        }
        return undefined
      },
    })
  }

  releaseAllButtons() {
    // release all down buttons because they can get stuck
    for (const control of this.controls) {
      for (const key in control.entries) {
        const value = control.entries[key]
        if (value.$button && value.down) {
          value.released = true
          value.down = false
          value.onRelease?.()
        }
      }
    }
  }

  buildActions() {
    this.actions = []
    for (const control of this.controls) {
      const actions = control.actions
      if (actions) {
        for (const action of actions) {
          // ignore if existing
          const idx = this.actions.findIndex(a => a.type === action.type)
          if (idx !== -1) continue
          this.actions.push(action)
        }
      }
    }
    this.world.emit('actions', this.actions)
  }

  onKeyDown = e => {
    if (e.defaultPrevented) return
    if (e.repeat) return
    if (this.isInputFocused()) return

    // Switch to keyboard input device only on actual keyboard input
    if (this.activeInputDevice !== 'keyboard') {
      this.onInputDeviceChange('keyboard')
    }

    const code = e.code
    if (code === 'Tab') {
      // prevent default focus switching behavior
      e.preventDefault()
    }

    // Get the prop from keybinds or fallback to default mapping
    let prop = null
    for (const [action, binding] of Object.entries(this.keybinds)) {
      if (propToCode[binding] === code) {
        prop = action
        break
      }
    }
    if (!prop) {
      prop = codeToProp[code]
    }

    const text = e.key
    this.buttonsDown.add(prop)
    for (const control of this.controls) {
      const button = control.entries[prop]
      if (button?.$button) {
        button.pressed = true
        button.down = true
        button.onPress?.()
        if (button.capture) break
      }
      const capture = control.onButtonPress?.(prop, text)
      if (capture) break
    }
  }

  onKeyUp = e => {
    if (e.repeat) return
    if (this.isInputFocused()) return
    const code = e.code
    if (code === 'MetaLeft' || code === 'MetaRight') {
      return this.releaseAllButtons()
    }

    // Get the prop from keybinds or fallback to default mapping
    let prop = null
    for (const [action, binding] of Object.entries(this.keybinds)) {
      if (propToCode[binding] === code) {
        prop = action
        break
      }
    }
    if (!prop) {
      prop = codeToProp[code]
    }

    this.buttonsDown.delete(prop)
    for (const control of this.controls) {
      const button = control.entries[prop]
      if (button?.$button && button.down) {
        button.down = false
        button.released = true
        button.onRelease?.()
      }
    }
  }

  onPointerDown = e => {
    if (e.isCoreUI) return
    this.checkPointerChanges(e)
  }

  onPointerMove = e => {
    if (e.isCoreUI) return
    if (!this.viewport) return

    // Switch to keyboard/mouse mode only if there's significant mouse movement
    if (this.activeInputDevice === 'gamepad' && (Math.abs(e.movementX) > 5 || Math.abs(e.movementY) > 5)) {
      this.onInputDeviceChange('keyboard')
    }

    const rect = this.viewport.getBoundingClientRect()
    
    // If using gamepad in build mode, keep cursor centered
    if (this.activeInputDevice === 'gamepad' && this.buildModeEnabled && this.pointer.locked) {
      // Center the cursor
      this.pointer.coords.x = 0.5
      this.pointer.coords.y = 0.5
      this.pointer.position.x = rect.width / 2
      this.pointer.position.y = rect.height / 2

      // If we have a selected item, update its position to match the reticle
      if (this.world.builder?.selected) {
        const hit = this.world.builder.getHitAtReticle(this.world.builder.selected, true)
        if (hit) {
          this.world.builder.selected.root.position.copy(hit.point)
        }
      }
    } else {
      // Normal mouse movement
      const offsetX = e.pageX - rect.left
      const offsetY = e.pageY - rect.top
      this.pointer.coords.x = Math.max(0, Math.min(1, offsetX / rect.width))
      this.pointer.coords.y = Math.max(0, Math.min(1, offsetY / rect.height))
      this.pointer.position.x = offsetX
      this.pointer.position.y = offsetY

      // Only unlock pointer in build mode if using mouse and not holding middle mouse
      if (this.buildModeEnabled && !this.mmbDown && this.pointer.locked && this.activeInputDevice === 'keyboard') {
        this.unlockPointer()
      }
    }
    
    if (this.mmbDown || this.pointer.locked) {
      this.pointer.delta.x += e.movementX
      this.pointer.delta.y += e.movementY
    }
  }

  onPointerUp = e => {
    if (e.isCoreUI) return
    this.checkPointerChanges(e)
  }

  onPointerLeave = e => {
    // Handle pointer leave
  }

  onWheel = e => {
    e.preventDefault()
    // Keep original scroll behavior - don't normalize for camera zoom
    let delta = e.deltaY
    // Invert delta for non-Mac systems
    if (!this.isMac) {
      delta = -delta
    }
    // Only normalize for shift + scroll (building mode)
    if (e.shiftKey) {
      delta = Math.sign(delta)
    }
    this.scroll.delta = delta
  }

  onContextMenu = e => {
    e.preventDefault()
  }

  onVisibilityChange = () => {
    if (document.hidden) {
      this.releaseAllButtons()
    }
  }

  onPointerLockChange = () => {
    const didPointerLock = !!document.pointerLockElement
    if (didPointerLock) {
      this.onPointerLockStart()
    } else {
      this.onPointerLockEnd()
    }
  }

  onTouchStart = e => {
    if (e.isCoreUI) return
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = {
        id: touch.identifier,
        position: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        prevPosition: new THREE.Vector3(touch.clientX, touch.clientY, 0),
        delta: new THREE.Vector3(),
      }
      this.touches.set(info.id, info)
      for (const control of this.controls) {
        const consume = control.options.onTouch?.(info)
        if (consume) break
      }
    }
  }

  onTouchMove = e => {
    if (e.isCoreUI) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = this.touches.get(touch.identifier)
      const currentX = touch.clientX
      const currentY = touch.clientY
      info.delta.x += currentX - info.prevPosition.x
      info.delta.y += currentY - info.prevPosition.y
      info.position.x = currentX
      info.position.y = currentY
      info.prevPosition.x = currentX
      info.prevPosition.y = currentY
    }
  }

  onTouchEnd = e => {
    if (e.isCoreUI) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      const info = this.touches.get(touch.identifier)
      for (const control of this.controls) {
        const consume = control.options.onTouchEnd?.(info)
        if (consume) break
      }
      this.touches.delete(touch.identifier)
    }
  }

  onResize = () => {
    this.screen.width = this.viewport.offsetWidth
    this.screen.height = this.viewport.offsetHeight
  }

  onBlur = () => {
    this.releaseAllButtons()
  }

  onXRSession = session => {
    this.xrSession = session
  }

  isInputFocused() {
    return document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
  }

  onWindowPointerUp = e => {
    if (this.mmbDown && !(e.buttons & MMB)) {
      this.mmbDown = false
      this.buttonsDown.delete(MouseMiddle)
      
      if (this.middleMouseLocked) {
        this.unlockPointer()
        this.middleMouseLocked = false
      }
      
      for (const control of this.controls) {
        const button = control.entries.mouseMiddle
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
  }

  destroy() {
    // Remove document-level event listeners
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    document.body.removeEventListener('contextmenu', this.onContextMenu)

    // Remove window-level event listeners
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onWindowPointerUp)

    // Remove viewport event listeners if viewport exists
    if (this.viewport) {
      this.viewport.removeEventListener('pointerdown', this.onPointerDown)
      this.viewport.removeEventListener('pointerup', this.onPointerUp)
      this.viewport.removeEventListener('touchstart', this.onTouchStart)
      this.viewport.removeEventListener('touchmove', this.onTouchMove)
      this.viewport.removeEventListener('touchend', this.onTouchEnd)
      this.viewport.removeEventListener('touchcancel', this.onTouchEnd)
      this.viewport.removeEventListener('wheel', this.onWheel)
    }
    
    // Clean up gamepad manager
    this.gamepadManager.destroy()
  }

  async lockPointer() {
    this.pointer.shouldLock = true
    try {
      // When using gamepad, center the cursor before locking
      if (this.activeInputDevice === 'gamepad' && this.viewport) {
        const rect = this.viewport.getBoundingClientRect()
        this.pointer.coords.x = 0.5
        this.pointer.coords.y = 0.5
        this.pointer.position.x = rect.width / 2
        this.pointer.position.y = rect.height / 2

        // If we have a selected item, update its position to the reticle
        if (this.world.builder?.selected) {
          const hit = this.world.builder.getHitAtReticle(this.world.builder.selected, true)
          if (hit) {
            this.world.builder.selected.root.position.copy(hit.point)
          }
        }
      }
      
      await this.viewport.requestPointerLock()
      return true
    } catch (err) {
      console.log('pointerlock denied, too quick?')
      return false
    }
  }

  unlockPointer() {
    this.pointer.shouldLock = false
    if (!this.pointer.locked) return
    document.exitPointerLock()
    this.onPointerLockEnd()
  }

  onPointerLockStart() {
    if (this.pointer.locked) return
    this.pointer.locked = true
    this.world.emit('pointer-lock', true)
    // pointerlock is async so if its no longer meant to be locked, exit
    if (!this.pointer.shouldLock) this.unlockPointer()
  }

  onPointerLockEnd() {
    if (!this.pointer.locked) return
    this.pointer.locked = false
    this.world.emit('pointer-lock', false)
  }

  checkPointerChanges(e) {
    // Switch to keyboard/mouse mode on any mouse button interaction
    if (this.activeInputDevice === 'gamepad' && e.buttons !== 0) {
      this.onInputDeviceChange('keyboard')
    }

    const lmb = !!(e.buttons & LMB)
    // left mouse down
    if (!this.lmbDown && lmb) {
      this.lmbDown = true
      this.buttonsDown.add(MouseLeft)
      for (const control of this.controls) {
        const button = control.entries.mouseLeft
        if (button) {
          button.down = true
          button.pressed = true
          button.onPress?.()
          if (button.capture) break
        }
      }
    }
    // left mouse up
    if (this.lmbDown && !lmb) {
      this.lmbDown = false
      this.buttonsDown.delete(MouseLeft)
      for (const control of this.controls) {
        const button = control.entries.mouseLeft
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
    
    const rmb = !!(e.buttons & RMB)
    // right mouse down
    if (!this.rmbDown && rmb) {
      this.rmbDown = true
      this.buttonsDown.add(MouseRight)
      for (const control of this.controls) {
        const button = control.entries.mouseRight
        if (button) {
          button.down = true
          button.pressed = true
          button.onPress?.()
          if (button.capture) break
        }
      }
    }
    // right mouse up
    if (this.rmbDown && !rmb) {
      this.rmbDown = false
      this.buttonsDown.delete(MouseRight)
      for (const control of this.controls) {
        const button = control.entries.mouseRight
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
    
    // Add middle mouse button support
    const mmb = !!(e.buttons & MMB)
    // middle mouse down
    if (!this.mmbDown && mmb) {
      this.mmbDown = true
      this.buttonsDown.add(MouseMiddle)
      
      // If in build mode, lock the pointer when middle mouse is pressed
      if (this.world.builder?.enabled && !this.pointer.locked) {
        this.lockPointer()
        this.middleMouseLocked = true
      }
      
      for (const control of this.controls) {
        const button = control.entries.mouseMiddle
        if (button) {
          button.down = true
          button.pressed = true
          button.onPress?.()
          if (button.capture) break
        }
      }
    }
    // middle mouse up
    if (this.mmbDown && !mmb) {
      this.mmbDown = false
      this.buttonsDown.delete(MouseMiddle)
      
      // If in build mode and we locked with middle mouse button, unlock
      if (this.middleMouseLocked) {
        this.unlockPointer()
        this.middleMouseLocked = false
      }
      
      for (const control of this.controls) {
        const button = control.entries.mouseMiddle
        if (button) {
          button.down = false
          button.released = true
          button.onRelease?.()
        }
      }
    }
  }

  updateGamepadButton(control, buttonName, buttonIndex) {
    if (control.entries[buttonName]) {
      const button = control.entries[buttonName]
      const pressed = this.gamepadManager.getButton(0, buttonIndex)
      
      if (pressed && !button.down) {
        // Switch to gamepad mode only on button press, not release
        this.lastGamepadActivity = Date.now()
        if (this.activeInputDevice !== 'gamepad') {
          this.onInputDeviceChange('gamepad')
        }
        
        button.pressed = true
        button.down = true
        button.onPress?.()

        // Special handling for Select button to toggle build mode
        if (buttonIndex === GAMEPAD_BUTTON.SELECT && buttonName === 'toggleBuildMode') {
          if (this.world.builder) {
            this.world.builder.toggle()
          }
        }
      }
      if (!pressed && button.down) {
        button.released = true
        button.down = false
        button.onRelease?.()
      }

      // Update button state
      button.down = pressed
    }
  }

  onGamepadConnect(gamepad) {
    console.log('Gamepad connected:', gamepad.id)
  }

  onGamepadDisconnect(gamepad) {
    console.log('Gamepad disconnected:', gamepad.id)
    this.releaseAllButtons()
  }

  onGamepadButton(data) {
    // Additional button processing if needed
  }

  onGamepadAxes(data) {
    // Additional axes processing if needed
  }

  initKeybinds() {
    // Load saved keybinds from localStorage
    const savedKeybinds = localStorage.getItem('keybinds')
    this.keybinds = savedKeybinds ? JSON.parse(savedKeybinds) : {}

    // Default keyboard bindings if not set
    if (!this.keybinds.moveForward) this.keybinds.moveForward = 'KeyW'
    if (!this.keybinds.moveLeft) this.keybinds.moveLeft = 'KeyA'
    if (!this.keybinds.moveBackward) this.keybinds.moveBackward = 'KeyS'
    if (!this.keybinds.moveRight) this.keybinds.moveRight = 'KeyD'
    if (!this.keybinds.jump) this.keybinds.jump = 'Space'
    if (!this.keybinds.sprint) this.keybinds.sprint = 'ShiftLeft'
    if (!this.keybinds.crouch) this.keybinds.crouch = 'KeyC'
    if (!this.keybinds.toggleBuildMode) this.keybinds.toggleBuildMode = 'Tab'

    // Default gamepad bindings using GAMEPAD_BUTTON constants
    if (!this.keybinds.gamepadJump) this.keybinds.gamepadJump = GAMEPAD_BUTTON.A
    if (!this.keybinds.gamepadSprint) this.keybinds.gamepadSprint = GAMEPAD_BUTTON.L1
    if (!this.keybinds.gamepadCrouch) this.keybinds.gamepadCrouch = GAMEPAD_BUTTON.B
    if (!this.keybinds.gamepadToggleBuildMode) this.keybinds.gamepadToggleBuildMode = GAMEPAD_BUTTON.SELECT
    if (!this.keybinds.gamepadBuildGrab) this.keybinds.gamepadBuildGrab = GAMEPAD_BUTTON.X
    if (!this.keybinds.gamepadBuildInspect) this.keybinds.gamepadBuildInspect = GAMEPAD_BUTTON.Y
    if (!this.keybinds.gamepadBuildRotateRight) this.keybinds.gamepadBuildRotateRight = GAMEPAD_BUTTON.R1
    if (!this.keybinds.gamepadBuildRotateLeft) this.keybinds.gamepadBuildRotateLeft = GAMEPAD_BUTTON.R2
    if (!this.keybinds.gamepadBuildDelete) this.keybinds.gamepadBuildDelete = GAMEPAD_BUTTON.B

    // Save initialized keybinds
    localStorage.setItem('keybinds', JSON.stringify(this.keybinds))
  }
}

function createButton(controls, control, prop) {
  const down = controls.buttonsDown.has(prop)
  const pressed = down
  const released = false
  return {
    $button: true,
    down,
    pressed,
    released,
    capture: false,
    onPress: null,
    onRelease: null,
  }
}

function createVector(controls, control, prop) {
  return {
    $vector: true,
    value: new THREE.Vector3(),
    capture: false,
  }
}

function createValue(controls, control, prop) {
  return {
    $value: true,
    value: null,
    capture: false,
  }
}

function createPointer(controls, control, prop) {
  const coords = new THREE.Vector3() // [0,0] to [1,1]
  const position = new THREE.Vector3() // [0,0] to [viewportWidth,viewportHeight]
  const delta = new THREE.Vector3() // position delta (pixels)
  return {
    get coords() {
      return coords.copy(controls.pointer.coords)
    },
    get position() {
      return position.copy(controls.pointer.position)
    },
    get delta() {
      return delta.copy(controls.pointer.delta)
    },
    get locked() {
      return controls.pointer.locked
    },
    lock() {
      controls.lockPointer()
    },
    unlock() {
      controls.unlockPointer()
    },
  }
}

function createScreen(controls, control) {
  return {
    $screen: true,
    get width() {
      return controls.screen.width
    },
    get height() {
      return controls.screen.height
    },
  }
}

function createCamera(controls, control) {
  const world = controls.world
  const position = new THREE.Vector3().copy(world.rig.position)
  const quaternion = new THREE.Quaternion().copy(world.rig.quaternion)
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ').copy(world.rig.rotation)
  bindRotations(quaternion, rotation)
  const zoom = world.camera.position.z
  return {
    $camera: true,
    position,
    quaternion,
    rotation,
    zoom,
    write: false,
  }
}

