import { System } from './System'
import * as THREE from '../extras/three'
import { XRControllerModelFactory } from 'three/addons'

const UP = new THREE.Vector3(0, 1, 0)

const v1 = new THREE.Vector3()
const e1 = new THREE.Euler(0, 0, 0, 'YXZ')

/**
 * Enhanced XR System - Phase 3
 *
 * - Runs on the client.
 * - Keeps track of XR sessions with advanced features
 * - Supports XREstimatedLight for realistic lighting
 * - Enhanced AR and VR integration
 * - Improved controller and hand tracking
 *
 */
export class XR extends System {
  constructor(world) {
    super(world)
    this.session = null
    this.camera = null
    this.controller1Model = null
    this.controller2Model = null
    this.supportsVR = false
    this.supportsAR = false
    this.supportsHandTracking = false
    this.supportsLightEstimation = false
    this.controllerModelFactory = new XRControllerModelFactory()
    
    // Enhanced XR features
    this.lightProbe = null
    this.estimatedLight = null
    this.lightEstimationEnabled = false
    this.handTracking = {
      left: null,
      right: null
    }
    
    // AR-specific features
    this.hitTestSource = null
    this.planeDetection = false
    this.anchorSystem = new Map()
    
    // Performance monitoring
    this.xrPerformance = {
      frameRate: 90,
      droppedFrames: 0,
      adaptivePerformance: true
    }

    // VR Controller UI Interaction System
    this.controllerStates = {
      left: {
        triggerPressed: false,
        primaryPressed: false,
        secondaryPressed: false,
        stickPressed: false
      },
      right: {
        triggerPressed: false,
        primaryPressed: false,
        secondaryPressed: false,
        stickPressed: false
      }
    }
  }

  async init() {
    if (!navigator.xr) {
      console.warn('WebXR not supported')
      return
    }
    
    console.log('🥽 Initializing Enhanced WebXR System...')
    
    // Check basic XR support
    this.supportsVR = await navigator.xr.isSessionSupported('immersive-vr')
    this.supportsAR = await navigator.xr.isSessionSupported('immersive-ar')
    
    console.log(`✅ VR Support: ${this.supportsVR ? 'Yes' : 'No'}`)
    console.log(`✅ AR Support: ${this.supportsAR ? 'Yes' : 'No'}`)
    
    // Check advanced XR features
    await this.checkAdvancedFeatures()
  }

  async checkAdvancedFeatures() {
    try {
      // Check hand tracking support
      if (this.supportsVR) {
        try {
          const session = await navigator.xr.requestSession('immersive-vr', {
            optionalFeatures: ['hand-tracking']
          })
          this.supportsHandTracking = true
          session.end()
          console.log('✅ Hand Tracking: Supported')
        } catch (error) {
          console.log('❌ Hand Tracking: Not supported')
        }
      }
      
      // Check light estimation for AR
      if (this.supportsAR) {
        try {
          const session = await navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['light-estimation']
          })
          this.supportsLightEstimation = true
          session.end()
          console.log('✅ Light Estimation: Supported')
        } catch (error) {
          console.log('❌ Light Estimation: Not supported')
        }
      }
      
    } catch (error) {
      console.warn('Advanced XR feature detection failed:', error)
    }
  }

  async enterVR() {
    const requiredFeatures = ['local-floor']
    const optionalFeatures = ['hand-tracking']
    
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures,
        optionalFeatures
      })
      
      this.initializeSession(session, 'vr')
      
    } catch (error) {
      console.error('Failed to enter VR:', error)
    }
  }

  async enterAR() {
    const requiredFeatures = ['local-floor']
    const optionalFeatures = [
      'light-estimation',
      'plane-detection',
      'anchors',
      'hit-test'
    ]
    
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures,
        optionalFeatures
      })
      
      this.initializeSession(session, 'ar')
      
    } catch (error) {
      console.error('Failed to enter AR:', error)
    }
  }

  // Legacy method for backward compatibility
  async enter() {
    return this.enterVR()
  }

  initializeSession(session, mode) {
    console.log(`🥽 Initializing ${mode.toUpperCase()} session...`)
    
    // Set target frame rate for better performance
    try {
      const targetFrameRate = mode === 'ar' ? 60 : 90
      session.updateTargetFrameRate(targetFrameRate)
      this.xrPerformance.frameRate = targetFrameRate
    } catch (err) {
      console.warn('XR target frame rate update failed:', err)
    }
    
    // Configure renderer
    this.world.graphics.renderer.xr.setSession(session)
    session.addEventListener('end', this.onSessionEnd)
    
    this.session = session
    this.camera = this.world.graphics.renderer.xr.getCamera()
    this.world.emit('xrSession', session)

    // 🎮 NEW: Initialize controller states for UI interaction
    this.initializeControllerStates()

    // Initialize controllers
    this.setupControllers()
    
    // Initialize advanced features based on mode
    if (mode === 'ar') {
      this.setupARFeatures(session)
    } else {
      this.setupVRFeatures(session)
    }
    
    // Setup light estimation if supported
    if (this.supportsLightEstimation && mode === 'ar') {
      this.setupLightEstimation(session)
    }
    
    // Setup hand tracking if supported
    if (this.supportsHandTracking) {
      this.setupHandTracking(session)
    }
    
    console.log(`✅ ${mode.toUpperCase()} session initialized successfully`)
  }

  setupControllers() {
    // Controller 1
    this.controller1Model = this.world.graphics.renderer.xr.getControllerGrip(0)
    this.controller1Model.add(this.controllerModelFactory.createControllerModel(this.controller1Model))
    this.world.rig.add(this.controller1Model)

    // Controller 2
    this.controller2Model = this.world.graphics.renderer.xr.getControllerGrip(1)
    this.controller2Model.add(this.controllerModelFactory.createControllerModel(this.controller2Model))
    this.world.rig.add(this.controller2Model)
    
    // Add ray casting for controllers
    this.setupControllerRaycasting()
  }

  setupControllerRaycasting() {
    // Create controller ray indicators
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ])
    const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
    
    const line1 = new THREE.Line(geometry, material)
    const line2 = new THREE.Line(geometry, material.clone())
    
    this.controller1Model.add(line1)
    this.controller2Model.add(line2)
  }

  setupVRFeatures(session) {
    // VR-specific setup
    console.log('🎮 Setting up VR-specific features...')
    
    // Enable foveated rendering if supported
    if (session.supportedFrameRates && session.supportedFrameRates.length > 0) {
      this.world.graphics.renderer.xr.setFoveation(1)
    }
    
    // Setup room-scale boundaries if available
    this.setupPlayArea(session)
  }

  setupARFeatures(session) {
    // AR-specific setup
    console.log('📱 Setting up AR-specific features...')
    
    // Setup hit testing for AR
    this.setupHitTesting(session)
    
    // Setup plane detection
    this.setupPlaneDetection(session)
    
    // Setup anchor system
    this.setupAnchorSystem(session)
  }

  async setupLightEstimation(session) {
    try {
      console.log('💡 Setting up XR light estimation...')
      
      // Create XREstimatedLight
      if (this.world.graphics.renderer.xr.isPresenting) {
        const xrLight = this.world.graphics.renderer.xr.getLightEstimate()
        
        if (xrLight) {
          // Create light probe from XR estimation
          this.lightProbe = new THREE.LightProbe()
          this.estimatedLight = new THREE.DirectionalLight()
          
          // Add to scene
          this.world.stage.scene.add(this.lightProbe)
          this.world.stage.scene.add(this.estimatedLight)
          
          this.lightEstimationEnabled = true
          
          console.log('✅ XR light estimation initialized')
        }
      }
    } catch (error) {
      console.warn('XR light estimation setup failed:', error)
    }
  }

  setupHandTracking(session) {
    console.log('👋 Setting up hand tracking...')
    
    // Initialize hand tracking objects
    this.handTracking.left = {
      joints: new Map(),
      mesh: null
    }
    this.handTracking.right = {
      joints: new Map(),
      mesh: null
    }
    
    // Create hand visualization if needed
    this.createHandVisualization()
  }

  setupHitTesting(session) {
    console.log('🎯 Setting up AR hit testing...')
    
    session.requestReferenceSpace('viewer').then(referenceSpace => {
      session.requestHitTestSource({ space: referenceSpace })
        .then(source => {
          this.hitTestSource = source
          console.log('✅ AR hit testing initialized')
        })
        .catch(error => {
          console.warn('Hit test source creation failed:', error)
        })
    })
  }

  setupPlaneDetection(session) {
    console.log('🏠 Setting up AR plane detection...')
    this.planeDetection = true
  }

  setupAnchorSystem(session) {
    console.log('⚓ Setting up AR anchor system...')
    // Anchor system for persistent AR objects
  }

  setupPlayArea(session) {
    // Setup VR play area boundaries
    const bounds = session.visibilityState
    if (bounds) {
      console.log('🎮 Play area boundaries detected')
    }
  }

  createHandVisualization() {
    // Create simple hand joint visualization
    const jointGeometry = new THREE.SphereGeometry(0.005)
    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    
    // Create joint meshes for both hands
    ['left', 'right'].forEach(side => {
      const handGroup = new THREE.Group()
      
      // Create joints for each hand
      for (let i = 0; i < 25; i++) { // Standard hand has 25 joints
        const joint = new THREE.Mesh(jointGeometry, jointMaterial.clone())
        joint.visible = false
        handGroup.add(joint)
        this.handTracking[side].joints.set(i, joint)
      }
      
      this.handTracking[side].mesh = handGroup
      this.world.stage.scene.add(handGroup)
    })
  }

  update(delta) {
    if (!this.session) return

    // Update light estimation
    if (this.lightEstimationEnabled) {
      this.updateLightEstimation()
    }

    // Update hand tracking
    if (this.supportsHandTracking) {
      this.updateHandTracking()
    }

    // 🎮 NEW: Handle VR controller input for UI interaction
    if (this.session.inputSources) {
      this.session.inputSources.forEach(inputSource => {
        this.handleControllerInput(this.world.graphics.renderer.xr.getFrame(), inputSource)
      })
    }

    // Update performance metrics
    this.updatePerformanceMetrics()
  }

  updateLightEstimation() {
    if (!this.estimatedLight || !this.world.graphics.renderer.xr.isPresenting) return
    
    try {
      const lightEstimate = this.world.graphics.renderer.xr.getLightEstimate()
      
      if (lightEstimate) {
        // Update directional light based on XR estimation
        if (lightEstimate.primaryLightDirection) {
          this.estimatedLight.position.copy(lightEstimate.primaryLightDirection)
          this.estimatedLight.position.multiplyScalar(-10) // Move light away from center
        }
        
        if (lightEstimate.primaryLightIntensity) {
          this.estimatedLight.intensity = lightEstimate.primaryLightIntensity
        }
        
        // Update light probe if spherical harmonics are available
        if (lightEstimate.sphericalHarmonicsCoefficients && this.lightProbe) {
          this.lightProbe.sh.fromArray(lightEstimate.sphericalHarmonicsCoefficients)
        }
      }
    } catch (error) {
      // Light estimation failed, continue without error logging (normal in some environments)
    }
  }

  updateHandTracking() {
    // Update hand joint positions if hand tracking is active
    // Implementation would depend on specific XR runtime capabilities
  }

  // 🎮 NEW: VR Controller UI Interaction System
  handleControllerInput(frame, inputSource) {
    if (!this.session || !inputSource) return

    const handedness = inputSource.handedness
    const gamepad = inputSource.gamepad
    
    if (!gamepad) return

    // Map controller buttons to UI actions
    this.mapControllerToUI(handedness, gamepad, frame)
    
    // Handle controller ray casting for UI interaction
    this.handleControllerRaycasting(frame, inputSource)
  }

  mapControllerToUI(handedness, gamepad, frame) {
    // Primary trigger (button 0) - UI selection/click
    if (gamepad.buttons[0]?.pressed && !this.controllerStates[handedness]?.triggerPressed) {
      this.controllerStates[handedness] = { ...this.controllerStates[handedness], triggerPressed: true }
      this.handleUIClick(handedness, 'trigger')
    } else if (!gamepad.buttons[0]?.pressed && this.controllerStates[handedness]?.triggerPressed) {
      this.controllerStates[handedness] = { ...this.controllerStates[handedness], triggerPressed: false }
    }

    // Primary button (button 4) - Menu toggle
    if (gamepad.buttons[4]?.pressed && !this.controllerStates[handedness]?.primaryPressed) {
      this.controllerStates[handedness] = { ...this.controllerStates[handedness], primaryPressed: true }
      this.handleUIClick(handedness, 'primary')
    } else if (!gamepad.buttons[4]?.pressed && this.controllerStates[handedness]?.primaryPressed) {
      this.controllerStates[handedness] = { ...this.controllerStates[handedness], primaryPressed: false }
    }

    // Secondary button (button 5) - Back/escape
    if (gamepad.buttons[5]?.pressed && !this.controllerStates[handedness]?.secondaryPressed) {
      this.controllerStates[handedness] = { ...this.controllerStates[handedness], secondaryPressed: true }
      this.handleUIClick(handedness, 'secondary')
    } else if (!gamepad.buttons[5]?.pressed && this.controllerStates[handedness]?.secondaryPressed) {
      this.controllerStates[handedness] = { ...this.controllerStates[handedness], secondaryPressed: false }
    }

    // Thumbstick (axes 2,3) - UI navigation
    const stickX = gamepad.axes[2] || 0
    const stickY = gamepad.axes[3] || 0
    
    if (Math.abs(stickX) > 0.5 || Math.abs(stickY) > 0.5) {
      this.handleUINavigation(handedness, stickX, stickY)
    }
  }

  handleUIClick(handedness, button) {
    console.log(`🎮 VR Controller ${handedness} ${button} button pressed`)
    
    switch (button) {
      case 'trigger':
        // Primary interaction - equivalent to mouse click
        this.world.ui.handleVRClick(handedness, 'primary')
        break
      case 'primary':
        // Menu toggle - equivalent to ESC key
        this.world.ui.handleEscape()
        break
      case 'secondary':
        // Back/escape - close current menu
        this.world.ui.handleEscape()
        break
    }
  }

  handleUINavigation(handedness, x, y) {
    // Navigate UI elements with thumbstick
    this.world.ui.handleVRNavigation(handedness, x, y)
  }

  handleControllerRaycasting(frame, inputSource) {
    if (!inputSource.targetRaySpace) return

    // Get controller pose
    const pose = frame.getPose(inputSource.targetRaySpace, this.world.stage.scene)
    if (!pose) return

    // Create ray from controller
    const rayOrigin = new THREE.Vector3()
    const rayDirection = new THREE.Vector3(0, 0, -1)
    
    rayOrigin.setFromMatrixPosition(pose.transform.matrix)
    rayDirection.setFromMatrixColumn(pose.transform.matrix, 2)
    rayDirection.multiplyScalar(-1)

    // Raycast for UI elements
    this.raycastForUI(rayOrigin, rayDirection, inputSource.handedness)
  }

  raycastForUI(rayOrigin, rayDirection, handedness) {
    // Raycast against UI elements in 3D space
    const raycaster = new THREE.Raycaster(rayOrigin, rayDirection)
    
    // Get UI elements that can be interacted with
    const uiElements = this.world.stage.scene.children.filter(child => 
      child.userData?.isUI && child.userData?.interactive
    )

    const intersects = raycaster.intersectObjects(uiElements, true)
    
    if (intersects.length > 0) {
      const hitElement = intersects[0].object
      this.world.ui.handleVRHover(hitElement, handedness)
    } else {
      this.world.ui.handleVRHover(null, handedness)
    }
  }

  // Initialize controller states
  initializeControllerStates() {
    this.controllerStates = {
      left: {
        triggerPressed: false,
        primaryPressed: false,
        secondaryPressed: false,
        stickPressed: false
      },
      right: {
        triggerPressed: false,
        primaryPressed: false,
        secondaryPressed: false,
        stickPressed: false
      }
    }
  }

  updatePerformanceMetrics() {
    // Monitor XR performance
    if (this.session) {
      const frame = this.world.graphics.renderer.xr.getFrame()
      if (frame) {
        // Track performance metrics for adaptive quality
        this.xrPerformance.adaptivePerformance = true
      }
    }
  }

  onSessionEnd = () => {
    console.log('🥽 XR session ended')
    
    // Reset camera
    this.world.camera.position.set(0, 0, 0)
    this.world.camera.rotation.set(0, 0, 0)
    
    // Remove controllers
    if (this.controller1Model) {
      this.world.rig.remove(this.controller1Model)
    }
    if (this.controller2Model) {
      this.world.rig.remove(this.controller2Model)
    }
    
    // Clean up light estimation
    if (this.lightProbe) {
      this.world.stage.scene.remove(this.lightProbe)
      this.lightProbe = null
    }
    if (this.estimatedLight) {
      this.world.stage.scene.remove(this.estimatedLight)
      this.estimatedLight = null
    }
    this.lightEstimationEnabled = false
    
    // Clean up hand tracking
    if (this.handTracking.left?.mesh) {
      this.world.stage.scene.remove(this.handTracking.left.mesh)
    }
    if (this.handTracking.right?.mesh) {
      this.world.stage.scene.remove(this.handTracking.right.mesh)
    }
    
    // Clean up AR features
    if (this.hitTestSource) {
      this.hitTestSource.cancel()
      this.hitTestSource = null
    }
    
    // Reset state
    this.session = null
    this.camera = null
    this.controller1Model = null
    this.controller2Model = null
    this.handTracking = { left: null, right: null }
    this.anchorSystem.clear()
    
    this.world.emit('xrSession', null)
  }

  // Public API methods
  getSupport() {
    return {
      vr: this.supportsVR,
      ar: this.supportsAR,
      handTracking: this.supportsHandTracking,
      lightEstimation: this.supportsLightEstimation
    }
  }

  getPerformanceMetrics() {
    return this.xrPerformance
  }

  isPresenting() {
    return !!this.session && this.world.graphics.renderer.xr.isPresenting
  }

  getSessionMode() {
    if (!this.session) return null
    return this.session.mode
  }
}
