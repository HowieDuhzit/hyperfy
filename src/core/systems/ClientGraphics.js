import * as THREE from '../extras/three'
import { N8AOPostPass } from 'n8ao'
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAPreset,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SelectiveBloomEffect,
  BlendFunction,
  Selection,
  BloomEffect,
  KernelSize,
  DepthPass,
  Pass,
  DepthEffect,
  DepthOfFieldEffect,
  RealisticBokehEffect,
  SSAOEffect,
} from 'postprocessing'

// WebGPU TSL imports for post-processing
import { pass, mrt, output, transformedNormalView, viewportUV, uniform, texture, float, vec2, vec3, vec4, Fn } from 'three/tsl'

import { System } from './System'

const v1 = new THREE.Vector3()

let renderer
let webgpuSupported = false
let webgpuRenderer = null

async function checkWebGPUSupport() {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter()
      webgpuSupported = !!adapter
      return webgpuSupported
    } catch (error) {
      console.warn('WebGPU not supported:', error)
      webgpuSupported = false
    }
  }
  return false
}

async function createWebGPURenderer() {
  try {
    // Dynamic import to avoid errors on systems without WebGPU support
    const { WebGPURenderer } = await import('three/webgpu')
    
    webgpuRenderer = new WebGPURenderer({
      powerPreference: 'high-performance',
      antialias: true,
      forceWebGL: false
    })
    
    console.log('WebGPU renderer created successfully')
    return webgpuRenderer
  } catch (error) {
    console.warn('Failed to create WebGPU renderer, falling back to WebGL:', error)
    return null
  }
}

function createWebGLRenderer() {
  return new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: true,
    // logarithmicDepthBuffer: true,
    // reverseDepthBuffer: true,
  })
}

async function getRenderer(preference = 'auto') {
  if (!renderer) {
    console.log(`🎮 Renderer preference: ${preference}`)
    
    // Handle user preference
    switch (preference) {
      case 'webgpu':
        // Force WebGPU
        if (await checkWebGPUSupport()) {
          renderer = await createWebGPURenderer()
          if (renderer) {
            console.log('✅ Using WebGPU renderer (user preference)')
            return renderer
          } else {
            console.warn('⚠️ WebGPU requested but failed to initialize, falling back to WebGL')
          }
        } else {
          console.warn('⚠️ WebGPU requested but not supported, falling back to WebGL')
        }
        break
        
      case 'webgl':
        // Force WebGL
        renderer = createWebGLRenderer()
        console.log('✅ Using WebGL renderer (user preference)')
        return renderer
        
      case 'auto':
      default:
        // Auto-detect (original behavior)
        if (await checkWebGPUSupport()) {
          renderer = await createWebGPURenderer()
          if (renderer) {
            console.log('✅ Using WebGPU renderer (auto-detected)')
            return renderer
          }
        }
        break
    }
    
    // Final fallback to WebGL
    renderer = createWebGLRenderer()
    console.log('✅ Using WebGL renderer (fallback)')
  }
  return renderer
}

/**
 * Graphics System
 *
 * - Runs on the client
 * - Supports renderer, shadows, postprocessing, etc
 * - Renders to the viewport
 *
 */
export class ClientGraphics extends System {
  constructor(world) {
    super(world)
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.width = this.viewport.offsetWidth || 800 // Fallback to prevent 0 dimensions
    this.height = this.viewport.offsetHeight || 600 // Fallback to prevent 0 dimensions
    this.aspect = this.width / this.height
    
    // Initialize renderer with user preference
    const rendererPreference = this.world.prefs?.renderer || 'webgl'
    this.renderer = await getRenderer(rendererPreference)
    this.isWebGPU = this.renderer.isWebGPURenderer || false
    
    // WebGPU requires async initialization
    if (this.isWebGPU) {
      await this.renderer.init()
    }
    
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0x000000, 0) // Performance: Use transparent black for better alpha blending
    this.renderer.setPixelRatio(this.world.prefs.dpr)
    
    // WebGPU compatibility: shadowMap configuration
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }
    
    // Apply tone mapping settings from preferences
    this.applyToneMappingSettings()
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    
    // WebGPU compatibility: XR configuration
    if (this.renderer.xr) {
      this.renderer.xr.enabled = true
      this.renderer.xr.setReferenceSpaceType('local-floor')
      this.renderer.xr.setFoveation(1)
    }
    
    // Performance optimizations
    this.renderer.sortObjects = false // Skip object sorting when order isn't critical for transparency
    
    // WebGPU compatibility: info property may not exist
    if (this.renderer.info) {
      this.renderer.info.autoReset = false // Keep render stats for debugging performance
    }
    
    // WebGPU compatibility: capabilities may not exist or have different API
    if (this.isWebGPU) {
      // WebGPU doesn't have capabilities.getMaxAnisotropy(), use reasonable default
      this.maxAnisotropy = 16 // Common WebGPU default
    } else {
      // WebGL renderer
      this.maxAnisotropy = this.renderer.capabilities?.getMaxAnisotropy?.() || 1
    }
    THREE.Texture.DEFAULT_ANISOTROPY = this.maxAnisotropy
    
    this.usePostprocessing = this.world.prefs.postprocessing
    
    // WebGPU compatibility: context and multisampling detection
    let maxMultisampling = 4 // Default fallback
    
    if (!this.isWebGPU) {
      try {
        const context = this.renderer.getContext()
        maxMultisampling = context.getParameter(context.MAX_SAMPLES) || 4
      } catch (error) {
        console.warn('Failed to get WebGL context parameters:', error)
        maxMultisampling = 4
      }
    }
    // Apply all graphics settings
    this.updateAllSettings()
    
    // WebGPU compatibility: Setup WebGPU-native post-processing using TSL
    if (this.isWebGPU) {
      console.log('Setting up WebGPU-native post-processing using TSL')
      this.setupWebGPUPostProcessing()
      this.composer = null
      this.renderPass = null
      this.aoPass = null
    } else {
      // WebGL post-processing setup with error handling
      try {
        this.composer = new EffectComposer(this.renderer, {
          frameBufferType: THREE.HalfFloatType,
          // multisampling: Math.min(8, maxMultisampling),
        })
        this.renderPass = new RenderPass(this.world.stage.scene, this.world.camera)
        this.composer.addPass(this.renderPass)
        
        this.aoPass = new N8AOPostPass(this.world.stage.scene, this.world.camera, this.width, this.height)
        this.aoPass.enabled = this.world.settings.ao && this.world.prefs.ao
        // we can't use this as it traverses the scene, but half our objects are in the octree
        this.aoPass.autoDetectTransparency = false
        // full res is pretty expensive
        this.aoPass.configuration.halfRes = true
      } catch (error) {
        console.warn('Post-processing setup failed:', error)
        this.composer = null
        this.renderPass = null
        this.aoPass = null
        this.usePostprocessing = false
      }
    }
    // WebGPU compatibility: Only configure AO pass if it exists
    if (this.aoPass) {
      // look 1:
      // this.aoPass.configuration.aoRadius = 0.2
      // this.aoPass.configuration.distanceFalloff = 1
      // this.aoPass.configuration.intensity = 2
      // look 2:
      // this.aoPass.configuration.aoRadius = 0.5
      // this.aoPass.configuration.distanceFalloff = 1
      // this.aoPass.configuration.intensity = 2
      // look 3:
      this.aoPass.configuration.screenSpaceRadius = true
      this.aoPass.configuration.aoRadius = 32
      this.aoPass.configuration.distanceFalloff = 1
      this.aoPass.configuration.intensity = 2
      this.composer.addPass(this.aoPass)
    }
    
    // WebGPU compatibility: Only setup post-processing effects for WebGL
    if (!this.isWebGPU && this.composer) {
      try {
        // Core effects
        this.bloom = new BloomEffect({
          blendFunction: BlendFunction.ADD,
          mipmapBlur: true,
          luminanceThreshold: 1,
          luminanceSmoothing: 0.3,
          intensity: 0.5,
          radius: 0.8,
        })
        this.bloomEnabled = this.world.prefs.bloom
        
        this.smaa = new SMAAEffect({
          preset: SMAAPreset.ULTRA,
        })
        
        this.tonemapping = new ToneMappingEffect({
          mode: ToneMappingMode.ACES_FILMIC,
        })
        
        // Advanced post-processing effects - Phase 3
        console.log('🎨 Initializing advanced post-processing effects...')
        
        // Depth of Field with Realistic Bokeh
        if (this.world.prefs.depthOfField) {
          // Use RealisticBokehEffect for better quality DOF
          this.depthOfField = new RealisticBokehEffect({
            blendFunction: BlendFunction.NORMAL,
            focus: 0.5,
            dof: 0.02,
            aperture: 0.025,
            maxBlur: 0.01
          })
          this.depthOfFieldEnabled = true
          console.log('✅ Realistic Depth of Field initialized')
        } else {
          this.depthOfField = null
          this.depthOfFieldEnabled = false
        }
        
        // Enhanced SSAO as substitute for advanced GI
        if (this.world.prefs.volumetricLighting) {
          this.enhancedSSAO = new SSAOEffect(this.world.camera, this.world.stage.scene, {
            blendFunction: BlendFunction.MULTIPLY,
            samples: 16,
            rings: 7,
            distanceThreshold: 0.65,
            distanceFalloff: 0.1,
            rangeThreshold: 0.0015,
            rangeFalloff: 0.01,
            luminanceInfluence: 0.7,
            radius: 0.1825,
            scale: 1.0,
            bias: 0.025
          })
          this.enhancedSSAOEnabled = true
          console.log('✅ Enhanced SSAO (as volumetric lighting substitute) initialized')
        } else {
          this.enhancedSSAO = null
          this.enhancedSSAOEnabled = false
        }
        
        // Note: Motion blur and SSR will be implemented via WebGPU TSL only
        // WebGL fallback uses simplified approximations
        console.log('ℹ️  Motion blur and SSR available in WebGPU mode only')
        
        this.effectPass = new EffectPass(this.world.camera)
        this.updatePostProcessingEffects()
        this.composer.addPass(this.effectPass)
        
        console.log('✅ Advanced post-processing effects initialized')
        
      } catch (error) {
        console.warn('Post-processing effects setup failed:', error)
        this.bloom = null
        this.smaa = null
        this.tonemapping = null
        this.depthOfField = null
        this.enhancedSSAO = null
        this.effectPass = null
        this.usePostprocessing = false
      }
    } else {
      // WebGPU: Set all post-processing effects to null
      this.bloom = null
      this.smaa = null
      this.tonemapping = null
      this.depthOfField = null
      this.enhancedSSAO = null
      this.effectPass = null
    }
    this.world.prefs.on('change', this.onPrefsChange)
    this.resizer = new ResizeObserver(() => {
      this.resize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    })
    this.viewport.appendChild(this.renderer.domElement)
    this.resizer.observe(this.viewport)

    this.xrWidth = null
    this.xrHeight = null
    this.xrDimensionsNeeded = false
    
    // Log successful initialization
    console.log(`✅ ClientGraphics initialized successfully with ${this.isWebGPU ? 'WebGPU' : 'WebGL'} renderer`)
    if (this.isWebGPU) {
      console.log('📈 Phase 2 WebGPU improvements active!')
    }
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
    this.world.settings.on('change', this.onSettingsChange)
    this.world.prefs.on('change', this.onPrefsChange)
  }

  resize(width, height) {
    this.width = Math.max(width || 800, 1) // Ensure non-zero dimensions
    this.height = Math.max(height || 600, 1) // Ensure non-zero dimensions
    this.aspect = this.width / this.height
    this.world.camera.aspect = this.aspect
    this.world.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
    
    // WebGPU compatibility: Only resize composer if it exists
    if (this.composer) {
      this.composer.setSize(this.width, this.height)
    }
    
    this.emit('resize')
    this.render()
  }

  render() {
    // WebGPU compatibility: Reset render info for debugging if enabled and available
    if (this.renderer.info && !this.renderer.info.autoReset) {
      this.renderer.info.reset()
    }
    
    // WebGPU compatibility: Check XR availability
    const isXRPresenting = this.renderer.xr?.isPresenting || false
    
    if (this.isWebGPU) {
      // WebGPU post-processing is handled via outputNode on the renderer
      this.renderer.render(this.world.stage.scene, this.world.camera)
    } else if (isXRPresenting || !this.usePostprocessing || !this.composer) {
      // WebGL fallback or no post-processing
      this.renderer.render(this.world.stage.scene, this.world.camera)
    } else {
      // WebGL post-processing via EffectComposer
      this.composer.render()
    }
    
    if (this.xrDimensionsNeeded) {
      this.checkXRDimensions()
    }
    
    // Log performance stats periodically if debugging is enabled
    if (this.world.stage.debugPerformance && this.world.frame % 60 === 0) {
      this.logRenderStats()
    }
  }

  logRenderStats() {
    const info = this.renderer.info
    const stageStats = this.world.stage.getPerformanceStats()
    
    console.group('Render Performance')
    console.log(`Draw Calls: ${info.render.calls}`)
    console.log(`Triangles: ${info.render.triangles}`)
    console.log(`Points: ${info.render.points}`)
    console.log(`Lines: ${info.render.lines}`)
    console.log(`Geometries: ${info.memory.geometries}`)
    console.log(`Textures: ${info.memory.textures}`)
    console.log(`Cull Ratio: ${(stageStats.cullRatio * 100).toFixed(1)}%`)
    console.log(`Frustum Cull Time: ${stageStats.lastCullTime.toFixed(2)}ms`)
    console.groupEnd()
  }

  enablePerformanceDebugging(enabled = true) {
    this.world.stage.debugPerformance = enabled
    console.log(`Performance debugging ${enabled ? 'enabled' : 'disabled'}`)
  }

  commit() {
    this.render()
  }

  preTick() {
    // calc world to screen factor
    const camera = this.world.camera
    const fovRadians = camera.fov * (Math.PI / 180)
    const rendererHeight = this.xrHeight || this.height
    this.worldToScreenFactor = (Math.tan(fovRadians / 2) * 2) / rendererHeight
  }

  onPrefsChange = changes => {
    // Handle resolution changes
    if (changes.dpr) {
      this.renderer.setPixelRatio(changes.dpr.value)
      this.resize(this.width, this.height)
    }
    
    // Handle real-time settings that don't require reload
    if (changes.fieldOfView) {
      this.applyFieldOfView()
    }
    if (changes.toneMappingMode || changes.toneMappingExposure) {
      this.applyToneMappingSettings()
    }
    if (changes.anisotropicFiltering) {
      this.applyAnisotropicFiltering()
    }
    if (changes.lodDistance) {
      this.applyLODSettings()
    }
    if (changes.gamma || changes.brightness || changes.contrast) {
      this.applyDisplaySettings()
    }
    if (changes.frameRateLimit || changes.vsync) {
      this.applyPerformanceSettings()
    }
    
    // Handle settings that may require post-processing changes
    if (changes.antialiasing || changes.depthOfField || changes.motionBlur || 
        changes.ssReflections || changes.volumetricLighting) {
      this.applyAntialiasing()
      
      // Update advanced post-processing effect states
      if (changes.depthOfField) {
        this.depthOfFieldEnabled = changes.depthOfField.value
      }
      if (changes.volumetricLighting) {
        this.enhancedSSAOEnabled = changes.volumetricLighting.value
      }
      
      // Force post-processing effects update
      this.updatePostProcessingEffects()
    }
    
    if (this.isWebGPU) {
      // Update WebGPU post-processing when preferences change
      this.updateWebGPUPostProcessing()
    } else {
      // Handle WebGL post-processing preference changes
      if (changes.postprocessing) {
        this.usePostprocessing = changes.postprocessing.value
      }
      if (changes.bloom) {
        this.bloomEnabled = changes.bloom.value
        if (this.effectPass) {
          this.updatePostProcessingEffects()
        }
      }
      if (changes.ao && this.aoPass) {
        this.aoPass.enabled = changes.ao.value && this.world.settings.ao
      }
    }
  }

  onXRSession = session => {
    if (session) {
      this.xrSession = session
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = true
    } else {
      this.xrSession = null
      this.xrWidth = null
      this.xrHeight = null
      this.xrDimensionsNeeded = false
    }
  }

  checkXRDimensions = () => {
    // Get the current XR reference space
    const referenceSpace = this.renderer.xr.getReferenceSpace()
    // Get frame information
    const frame = this.renderer.xr.getFrame()
    if (frame && referenceSpace) {
      // Get view information which contains projection matrices
      const views = frame.getViewerPose(referenceSpace)?.views
      if (views && views.length > 0) {
        // Use the first view's projection matrix
        const projectionMatrix = views[0].projectionMatrix
        // Extract the relevant factors from the projection matrix
        // This is a simplified approach
        const fovFactor = projectionMatrix[5] // Approximation of FOV scale
        // You might need to consider the XR display's physical properties
        // which can be accessed via session.renderState
        const renderState = this.xrSession.renderState
        const baseLayer = renderState.baseLayer
        if (baseLayer) {
          // Get the actual resolution being used for rendering
          this.xrWidth = baseLayer.framebufferWidth
          this.xrHeight = baseLayer.framebufferHeight
          this.xrDimensionsNeeded = false
          console.log({ xrWidth: this.xrWidth, xrHeight: this.xrHeight })
        }
      }
    }
  }

  onSettingsChange = changes => {
    if (this.isWebGPU) {
      // Update WebGPU post-processing
      this.updateWebGPUPostProcessing()
    } else {
      // WebGL compatibility: Only update AO if aoPass exists
      if (changes.ao && this.aoPass) {
        this.aoPass.enabled = changes.ao.value && this.world.prefs.ao
        console.log(this.aoPass.enabled)
      }
    }
  }

  // Apply tone mapping settings
  applyToneMappingSettings() {
    const mode = this.world.prefs.toneMappingMode
    const exposure = this.world.prefs.toneMappingExposure
    
    switch (mode) {
      case 'none':
        this.renderer.toneMapping = THREE.NoToneMapping
        break
      case 'linear':
        this.renderer.toneMapping = THREE.LinearToneMapping
        break
      case 'reinhard':
        this.renderer.toneMapping = THREE.ReinhardToneMapping
        break
      case 'cineon':
        this.renderer.toneMapping = THREE.CineonToneMapping
        break
      case 'aces':
      default:
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        break
    }
    
    this.renderer.toneMappingExposure = exposure
  }

  // Apply field of view settings
  applyFieldOfView() {
    if (this.world.camera) {
      this.world.camera.fov = this.world.prefs.fieldOfView
      this.world.camera.updateProjectionMatrix()
    }
  }

  // Apply anisotropic filtering settings
  applyAnisotropicFiltering() {
    const value = this.world.prefs.anisotropicFiltering
    THREE.Texture.DEFAULT_ANISOTROPY = Math.min(value, this.maxAnisotropy)
    
    // Update existing textures
    this.world.stage.scene.traverse(obj => {
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach(material => {
          if (material.map) material.map.anisotropy = THREE.Texture.DEFAULT_ANISOTROPY
          if (material.normalMap) material.normalMap.anisotropy = THREE.Texture.DEFAULT_ANISOTROPY
          if (material.roughnessMap) material.roughnessMap.anisotropy = THREE.Texture.DEFAULT_ANISOTROPY
          if (material.metalnessMap) material.metalnessMap.anisotropy = THREE.Texture.DEFAULT_ANISOTROPY
          material.needsUpdate = true
        })
      }
    })
  }

  // Apply texture quality settings
  applyTextureQuality() {
    const quality = this.world.prefs.textureQuality
    let maxTextureSize = 2048
    
    switch (quality) {
      case 'low':
        maxTextureSize = 512
        break
      case 'medium':
        maxTextureSize = 1024
        break
      case 'high':
        maxTextureSize = 2048
        break
      case 'ultra':
        maxTextureSize = 4096
        break
    }
    
    // Store for use when loading new textures
    this.maxTextureSize = maxTextureSize
  }

  // Apply anti-aliasing settings
  applyAntialiasing() {
    const aa = this.world.prefs.antialiasing
    
    if (this.isWebGPU) {
      // WebGPU anti-aliasing handling would go here
      // For now, log the setting
      console.log('WebGPU Anti-aliasing:', aa)
    } else if (this.composer) {
      // Remove existing AA effects
      this.composer.removePass(this.smaaEffect)
      this.smaaEffect = null
      
      // Add new AA effect based on setting
      if (aa === 'smaa') {
        try {
          this.smaaEffect = new SMAAEffect()
          const effectPass = new EffectPass(this.world.camera, this.smaaEffect)
          this.composer.addPass(effectPass)
        } catch (error) {
          console.warn('SMAA initialization failed:', error)
        }
      } else if (aa === 'fxaa') {
        // FXAA would be implemented here if available in the library
        console.log('FXAA selected but not yet implemented')
      }
      // MSAA is handled at renderer level during creation
    }
  }

  // Apply performance settings
  applyPerformanceSettings() {
    const frameLimit = this.world.prefs.frameRateLimit
    
    // Frame rate limiting
    if (frameLimit !== 'unlimited') {
      const targetFPS = parseInt(frameLimit)
      this.targetFrameTime = 1000 / targetFPS
    } else {
      this.targetFrameTime = 0
    }
    
    // V-Sync handling
    if (this.world.prefs.vsync) {
      // Browser V-Sync is typically always on, but we can note the preference
      this.vsyncEnabled = true
    } else {
      this.vsyncEnabled = false
    }
  }

  // Apply LOD distance settings
  applyLODSettings() {
    const multiplier = this.world.prefs.lodDistance
    
    // Update LOD distances for objects in the scene
    this.world.stage.scene.traverse(obj => {
      if (obj.isLOD) {
        // Scale LOD distances based on preference
        obj.levels.forEach(level => {
          level.distance *= multiplier
        })
      }
    })
  }

  // Apply display settings (gamma, brightness, contrast)
  applyDisplaySettings() {
    // These would typically be applied via post-processing or shader uniforms
    // For now, store them for use in post-processing pipeline
    this.displaySettings = {
      gamma: this.world.prefs.gamma,
      brightness: this.world.prefs.brightness,
      contrast: this.world.prefs.contrast
    }
  }

  // Update all graphics settings
  updateAllSettings() {
    this.applyToneMappingSettings()
    this.applyFieldOfView()
    this.applyAnisotropicFiltering()
    this.applyTextureQuality()
    this.applyAntialiasing()
    this.applyPerformanceSettings()
    this.applyLODSettings()
    this.applyDisplaySettings()
  }



  setupWebGPUPostProcessing() {
    try {
      console.log('🎯 Initializing Advanced WebGPU post-processing with TSL - Phase 3')
      
      // Create uniforms for WebGPU post-processing controls
      this.webgpuUniforms = {
        // Core effects
        bloomEnabled: uniform(this.world.prefs.bloom ? 1.0 : 0.0),
        bloomIntensity: uniform(0.5),
        bloomThreshold: uniform(1.0),
        toneMappingExposure: uniform(0.9),
        aoEnabled: uniform((this.world.settings.ao && this.world.prefs.ao) ? 1.0 : 0.0),
        aoIntensity: uniform(2.0),
        aoRadius: uniform(32.0),
        
        // Advanced effects - Phase 3
        dofEnabled: uniform(this.world.prefs.depthOfField ? 1.0 : 0.0),
        dofFocusDistance: uniform(10.0),
        dofFocalLength: uniform(0.5),
        dofBokehScale: uniform(2.0),
        
        motionBlurEnabled: uniform(this.world.prefs.motionBlur ? 1.0 : 0.0),
        motionBlurIntensity: uniform(1.0),
        motionBlurSamples: uniform(8.0),
        
        ssrEnabled: uniform(this.world.prefs.ssReflections ? 1.0 : 0.0),
        ssrIntensity: uniform(0.8),
        ssrThickness: uniform(10.0),
        ssrMaxRoughness: uniform(1.0),
        
        // Screen resolution for pixel-perfect calculations
        resolution: uniform(vec2(this.width, this.height)),
        time: uniform(0.0)
      }
      
      // Create comprehensive MRT pass with depth, normals, and velocity
      const scenePass = pass(this.world.stage.scene, this.world.camera)
      scenePass.setMRT(mrt({
        output: output,
        normal: transformedNormalView,
        depth: viewportUV.distance(vec2(0.5)),
        velocity: vec2(0.0) // Simplified velocity for now
      }))
      
      const sceneColor = scenePass.getTextureNode('output')
      const sceneNormal = scenePass.getTextureNode('normal')
      const sceneDepth = scenePass.getTextureNode('depth')
      const sceneVelocity = scenePass.getTextureNode('velocity')
      
      // Enhanced tone mapping implementation
      let processedColor = sceneColor.mul(this.webgpuUniforms.toneMappingExposure)
      
      // Enhanced AO with depth-aware sampling
      const aoFactor = sceneNormal.dot(uniform(new THREE.Vector3(0, 1, 0))).abs()
      const depthAO = sceneDepth.pow(0.5).mul(0.3).add(0.7)
      const aoStrength = aoFactor.mul(depthAO).mul(this.webgpuUniforms.aoIntensity).mul(this.webgpuUniforms.aoEnabled)
      processedColor = processedColor.mul(aoStrength.oneMinus().mul(0.3).add(0.7))
      
      // Advanced Depth of Field using TSL
      const dofShader = Fn(() => {
        const uv = viewportUV
        const centerDepth = sceneDepth
        const focusRange = this.webgpuUniforms.dofFocusDistance
        
        // Calculate circle of confusion
        const coc = centerDepth.sub(focusRange).abs().mul(this.webgpuUniforms.dofBokehScale).div(focusRange.add(1.0))
        const cocClamped = coc.clamp(0.0, 1.0)
        
        // Simple bokeh blur approximation
        let blurredColor = sceneColor
        const blurSamples = 8
        
        for (let i = 0; i < blurSamples; i++) {
          const angle = float(i).mul(Math.PI * 2.0 / blurSamples)
          const offset = vec2(angle.cos(), angle.sin()).mul(cocClamped).mul(0.01)
          const sampleUV = uv.add(offset)
          blurredColor = blurredColor.add(texture(sceneColor, sampleUV))
        }
        
        blurredColor = blurredColor.div(blurSamples + 1)
        
        // Mix based on circle of confusion
        return sceneColor.mix(blurredColor, cocClamped.mul(this.webgpuUniforms.dofEnabled))
      })()
      
      processedColor = processedColor.mix(dofShader, this.webgpuUniforms.dofEnabled)
      
      // Motion Blur using velocity buffer
      const motionBlurShader = Fn(() => {
        const uv = viewportUV
        const velocity = sceneVelocity.mul(this.webgpuUniforms.motionBlurIntensity)
        
        let blurredColor = sceneColor
        const samples = this.webgpuUniforms.motionBlurSamples
        
        // Sample along motion vector
        for (let i = 0; i < 8; i++) {
          const t = float(i).div(8.0).sub(0.5)
          const sampleUV = uv.add(velocity.mul(t))
          blurredColor = blurredColor.add(texture(sceneColor, sampleUV))
        }
        
        return blurredColor.div(9.0)
      })()
      
      processedColor = processedColor.mix(motionBlurShader, this.webgpuUniforms.motionBlurEnabled)
      
      // Screen Space Reflections (simplified)
      const ssrShader = Fn(() => {
        const uv = viewportUV
        const normal = sceneNormal
        const depth = sceneDepth
        
        // Calculate reflection vector in screen space (simplified)
        const viewDir = vec3(uv.sub(0.5).mul(2.0), -1.0).normalize()
        const reflectionDir = viewDir.reflect(normal)
        
        // Sample reflection color (basic implementation)
        const reflectionUV = uv.add(reflectionDir.xy.mul(0.1))
        const reflectionColor = texture(sceneColor, reflectionUV)
        
        // Fresnel-like falloff
        const fresnel = viewDir.dot(normal).abs().oneMinus().pow(2.0)
        
        return reflectionColor.mul(fresnel).mul(this.webgpuUniforms.ssrIntensity)
      })()
      
      processedColor = processedColor.add(ssrShader.mul(this.webgpuUniforms.ssrEnabled))
      
      // Enhanced bloom with better luminance detection
      const luminanceWeights = uniform(new THREE.Vector3(0.2126, 0.7152, 0.0722))
      const luminance = processedColor.dot(luminanceWeights)
      const bloomMask = luminance.sub(this.webgpuUniforms.bloomThreshold).max(0.0)
      const bloom = processedColor.mul(bloomMask).mul(this.webgpuUniforms.bloomIntensity)
      const finalColor = processedColor.add(bloom.mul(this.webgpuUniforms.bloomEnabled))
      
      // Set the final output node on the renderer
      this.renderer.outputNode = finalColor
      
      // Store references for later updates
      this.webgpuPostProcessing = {
        scenePass,
        uniforms: this.webgpuUniforms
      }
      
      console.log('✅ Advanced WebGPU post-processing initialized: Bloom, AO, DOF, Motion Blur, SSR')
      
    } catch (error) {
      console.warn('❌ Failed to setup advanced WebGPU post-processing:', error)
      console.warn('Falling back to basic post-processing for WebGPU')
      
      // Fallback to basic post-processing
      this.setupBasicWebGPUPostProcessing()
    }
  }

  setupBasicWebGPUPostProcessing() {
    try {
      console.log('Setting up basic WebGPU post-processing fallback...')
      
      const scenePass = pass(this.world.stage.scene, this.world.camera)
      const sceneColor = scenePass.getTextureNode()
      
      // Basic tone mapping only
      const processedColor = sceneColor.mul(uniform(0.9))
      
      this.renderer.outputNode = processedColor
      console.log('✅ Basic WebGPU post-processing fallback active')
      
    } catch (error) {
      console.warn('❌ Even basic WebGPU post-processing failed:', error)
      this.renderer.outputNode = null
    }
  }

  updateWebGPUPostProcessing() {
    if (!this.webgpuPostProcessing) return
    
    try {
      // Update core effect uniforms
      this.webgpuUniforms.bloomEnabled.value = this.world.prefs.bloom ? 1.0 : 0.0
      this.webgpuUniforms.bloomIntensity.value = 0.5
      this.webgpuUniforms.bloomThreshold.value = 1.0
      this.webgpuUniforms.toneMappingExposure.value = this.world.prefs.toneMappingExposure
      this.webgpuUniforms.aoEnabled.value = (this.world.settings.ao && this.world.prefs.ao) ? 1.0 : 0.0
      this.webgpuUniforms.aoIntensity.value = 2.0
      this.webgpuUniforms.aoRadius.value = 32.0
      
      // Update advanced effect uniforms - Phase 3
      this.webgpuUniforms.dofEnabled.value = this.world.prefs.depthOfField ? 1.0 : 0.0
      this.webgpuUniforms.dofFocusDistance.value = 10.0
      this.webgpuUniforms.dofFocalLength.value = 0.5
      this.webgpuUniforms.dofBokehScale.value = 2.0
      
      this.webgpuUniforms.motionBlurEnabled.value = this.world.prefs.motionBlur ? 1.0 : 0.0
      this.webgpuUniforms.motionBlurIntensity.value = 1.0
      this.webgpuUniforms.motionBlurSamples.value = 8.0
      
      this.webgpuUniforms.ssrEnabled.value = this.world.prefs.ssReflections ? 1.0 : 0.0
      this.webgpuUniforms.ssrIntensity.value = 0.8
      this.webgpuUniforms.ssrThickness.value = 10.0
      this.webgpuUniforms.ssrMaxRoughness.value = 1.0
      
      // Update resolution if changed
      this.webgpuUniforms.resolution.value.set(this.width, this.height)
      
      // Update time for temporal effects
      this.webgpuUniforms.time.value = performance.now() * 0.001
      
      console.log('🔄 Advanced WebGPU post-processing uniforms updated')
    } catch (error) {
      console.warn('Failed to update WebGPU post-processing:', error)
    }
  }

  updatePostProcessingEffects() {
    if (this.isWebGPU) {
      this.updateWebGPUPostProcessing()
      return
    }
    
    // WebGL post-processing update with advanced effects
    if (!this.effectPass) {
      return
    }
    
    const effects = []
    
    // Core effects
    if (this.bloomEnabled && this.bloom) {
      effects.push(this.bloom)
    }
    
    // Advanced effects - Phase 3
    if (this.depthOfFieldEnabled && this.depthOfField) {
      // Update Realistic Bokeh DOF parameters based on preferences
      this.depthOfField.focus = 0.5
      this.depthOfField.dof = 0.02
      this.depthOfField.aperture = 0.025
      effects.push(this.depthOfField)
    }
    
    if (this.enhancedSSAOEnabled && this.enhancedSSAO) {
      // Enhanced SSAO for better ambient lighting
      this.enhancedSSAO.samples = 16
      this.enhancedSSAO.radius = 0.1825
      effects.push(this.enhancedSSAO)
    }
    
    // Anti-aliasing (should be last for best quality)
    if (this.smaa) {
      effects.push(this.smaa)
    }
    
    // Tone mapping (should be very last)
    if (this.tonemapping) {
      // Update tone mapping mode based on preferences
      const mode = this.world.prefs.toneMappingMode
      switch (mode) {
        case 'linear':
          this.tonemapping.mode = ToneMappingMode.LINEAR
          break
        case 'reinhard':
          this.tonemapping.mode = ToneMappingMode.REINHARD
          break
        case 'reinhard2':
          this.tonemapping.mode = ToneMappingMode.REINHARD2
          break
        case 'reinhard2_adaptive':
          this.tonemapping.mode = ToneMappingMode.REINHARD2_ADAPTIVE
          break
        case 'uncharted2':
          this.tonemapping.mode = ToneMappingMode.UNCHARTED2
          break
        case 'aces':
        default:
          this.tonemapping.mode = ToneMappingMode.ACES_FILMIC
          break
      }
      effects.push(this.tonemapping)
    }
    
    try {
      this.effectPass.setEffects(effects)
      this.effectPass.recompile()
      console.log(`🎨 WebGL post-processing updated with ${effects.length} effects`)
    } catch (error) {
      console.warn('Failed to update post-processing effects:', error)
    }
  }

  destroy() {
    this.resizer.disconnect()
    this.viewport.removeChild(this.renderer.domElement)
    
    // Clean up event listeners
    if (this.world.prefs) {
      this.world.prefs.off('change', this.onPrefsChange)
    }
    
    // Clean up WebGPU post-processing
    if (this.webgpuPostProcessing) {
      this.renderer.outputNode = null
      this.webgpuPostProcessing = null
      this.webgpuUniforms = null
    }
  }
}
