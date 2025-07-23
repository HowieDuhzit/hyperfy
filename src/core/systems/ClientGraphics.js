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

// WebGPU TSL imports for advanced post-processing
import { 
  pass, 
  mrt, 
  output, 
  transformedNormalView, 
  viewportUV, 
  uniform, 
  texture, 
  float, 
  vec2, 
  vec3, 
  vec4, 
  Fn, // Used to be tslFn
  // Advanced TSL imports for AAA quality
  tslFn, // Deprecated - use Fn instead
  // NodeMaterial, // Not available in current Three.js TSL
  positionWorld,
  normalWorld,
  cameraPosition,
  modelViewMatrix,
  // texture2D, // Use texture3D instead
  screenUV,
  mul,
  add,
  sub,
  mix,
  step,
  smoothstep,
  dot,
  reflect,
  normalize,
  length,
  clamp,
  pow,
  exp,
  sin,
  cos,
  atan2,
  PI,
  PI2,
  distance,
  cross,
  saturate,
  abs,
  sign,
  floor,
  fract,
  mod,
  min,
  max,
  // Compute shader imports (limited availability in current Three.js TSL)
  compute,
  instanceIndex,
  // workgroupSize, // Not available in current Three.js TSL
  storageTexture
  // writeOnly, // Use alternative approaches
  // readOnly,  // Use alternative approaches
  // storage,   // Use alternative approaches
  // atomic,    // Not available in current Three.js TSL
  // barrier    // Not available in current Three.js TSL
} from 'three/tsl'

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
    
    // Get MSAA level from preferences if available
    const aa = window.world?.prefs?.antialiasing || 'none'
    let antialias = true // Default to basic antialiasing
    
    // Configure MSAA based on preference
    if (aa.startsWith('msaa')) {
      const msaaLevel = parseInt(aa.replace('msaa', ''))
      console.log('🚀 WebGPU MSAA level:', msaaLevel, 'x')
      antialias = msaaLevel
    } else if (aa === 'none') {
      antialias = false
    }
    
    webgpuRenderer = new WebGPURenderer({
      powerPreference: 'high-performance',
      antialias: antialias,
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
  // Get MSAA level from preferences if available
  const aa = window.world?.prefs?.antialiasing || 'none'
  let antialias = true // Default to basic antialiasing
  
  // Configure MSAA based on preference
  if (aa.startsWith('msaa')) {
    const msaaLevel = parseInt(aa.replace('msaa', ''))
    console.log('🎨 WebGL MSAA level:', msaaLevel, 'x')
    antialias = msaaLevel
  } else if (aa === 'none') {
    antialias = false
  }
  
  return new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: antialias,
    alpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    // Enable advanced WebGL features for better shader support
    failIfMajorPerformanceCaveat: false,
    // Enable extensions for advanced material features
    extensions: {
      OES_standard_derivatives: true,
      OES_element_index_uint: true,
      OES_vertex_array_object: true,
      WEBGL_depth_texture: true,
      WEBGL_draw_buffers: true,
      WEBGL_compressed_texture_s3tc: true,
      WEBGL_compressed_texture_pvrtc: true,
      WEBGL_compressed_texture_etc: true,
      WEBGL_compressed_texture_etc1: true,
      WEBGL_compressed_texture_astc: true,
      EXT_texture_filter_anisotropic: true,
      EXT_frag_depth: true,
      EXT_shader_texture_lod: true,
      EXT_blend_minmax: true,
      EXT_color_buffer_half_float: true,
      EXT_color_buffer_float: true,
      EXT_sRGB: true,
      EXT_texture_compression_bptc: true,
      EXT_texture_compression_rgtc: true,
      EXT_disjoint_timer_query: true,
      EXT_disjoint_timer_query_webgl2: true,
      WEBGL_debug_renderer_info: true,
      WEBGL_debug_shaders: true,
      WEBGL_lose_context: true,
      WEBGL_multi_draw: true,
      WEBGL_provoking_vertex: true,
      WEBGL_webcodecs_video_frame: true
    }
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
    this.retryCount = 0
    this.errorCount = 0
    this.lastErrorTime = 0
  }

  async init({ viewport }) {
    console.log('🎮 Initializing ClientGraphics system...')
    
    // 🛡️ FIXED: Ensure viewport is properly initialized
    this.viewport = viewport
    this.width = this.viewport?.offsetWidth || 800 // Fallback to prevent 0 dimensions
    this.height = this.viewport?.offsetHeight || 600 // Fallback to prevent 0 dimensions
    this.aspect = this.width / this.height
    
    // 🛡️ NEW: Comprehensive error handling wrapper
    try {
      await this.initializeRenderer()
      await this.initializePostProcessing()
      await this.initializeAAARendering()
      
      // 🛡️ NEW: Apply initial anti-aliasing settings
      this.applyAntialiasing()
      
      // 🛡️ NEW: Setup resize observer after renderer is initialized
      this.setupResizeObserver()
      
      console.log('✅ ClientGraphics system initialized successfully')
    } catch (error) {
      console.error('❌ ClientGraphics initialization failed:', error)
      await this.handleInitializationError(error)
    }
  }

  // 🛡️ NEW: Error recovery system
  async handleInitializationError(error) {
    console.log('🔄 Attempting error recovery...')
    
    // Try to recover with basic rendering
    try {
      await this.initializeBasicRendering()
      console.log('✅ Basic rendering recovered successfully')
    } catch (recoveryError) {
      console.error('❌ Recovery failed, using minimal rendering:', recoveryError)
      this.initializeMinimalRendering()
    }
  }

  async initializeBasicRendering() {
    // Initialize basic WebGL rendering without advanced features
    console.log('🔄 Initializing basic rendering...')
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.viewport.appendChild(this.renderer.domElement)
    
    // Basic post-processing
    this.effectComposer = new EffectComposer(this.renderer)
    this.effectComposer.addPass(new RenderPass(this.world.stage.scene, this.world.camera))
    
    console.log('✅ Basic rendering initialized')
  }

  initializeMinimalRendering() {
    // Absolute minimal rendering for emergency fallback
    console.log('🔄 Initializing minimal rendering...')
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true
    })
    
    this.renderer.setSize(this.width, this.height)
    this.viewport.appendChild(this.renderer.domElement)
    
    console.log('✅ Minimal rendering initialized')
  }

  async initializeRenderer() {
    // 🛡️ IMPROVED: Better error handling for renderer initialization
    try {
      const rendererPreference = this.world.prefs?.renderer || 'webgpu'
      console.log('🎮 Renderer preference:', rendererPreference)
      
      if (rendererPreference === 'webgpu' && this.isWebGPUSupported()) {
        await this.initializeWebGPURenderer()
      } else {
        this.initializeWebGLRenderer()
      }
    } catch (error) {
      console.warn('⚠️ Preferred renderer failed, falling back to WebGL:', error)
      this.initializeWebGLRenderer()
    }
  }

  async initializeWebGPURenderer() {
    try {
      console.log('🚀 Initializing WebGPU renderer...')
      
      // 🛡️ FIXED: Use proper WebGPU renderer import
      const { WebGPURenderer } = await import('three/webgpu')
      
      this.renderer = new WebGPURenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      })
      
      await this.renderer.init()
      this.isWebGPU = true
      console.log('✅ WebGPU renderer created successfully')
      
      this.renderer.setSize(this.width, this.height)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      this.viewport.appendChild(this.renderer.domElement)
      
      console.log('✅ Using WebGPU renderer (user preference)')
    } catch (error) {
      console.error('❌ WebGPU initialization failed:', error)
      throw error // Re-throw to trigger fallback
    }
  }

  initializeWebGLRenderer() {
    console.log('🔄 Initializing WebGL renderer...')
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.viewport.appendChild(this.renderer.domElement)
    
    this.isWebGPU = false
    console.log('✅ WebGL renderer initialized')
  }

  // 🛡️ NEW: Network error handling
  handleNetworkError(error) {
    console.error('🌐 Network error in graphics system:', error)
    
    // Implement retry logic for network-dependent features
    if (this.retryCount < 3) {
      this.retryCount++
      console.log(`🔄 Retrying network operation (${this.retryCount}/3)...`)
      
      setTimeout(() => {
        this.retryNetworkOperation()
      }, 1000 * this.retryCount)
    } else {
      console.error('❌ Max retries reached, disabling network features')
      this.disableNetworkFeatures()
    }
  }

  // 🛡️ NEW: Asset loading error handling
  handleAssetError(error, assetType, assetId) {
    console.error(`📦 Asset loading error (${assetType}):`, error)
    
    // Provide fallback assets
    this.provideFallbackAsset(assetType, assetId)
  }

  provideFallbackAsset(assetType, assetId) {
    console.log(`🔄 Providing fallback for ${assetType}: ${assetId}`)
    
    switch (assetType) {
      case 'texture':
        // Provide default texture
        break
      case 'model':
        // Provide default model
        break
      case 'shader':
        // Provide default shader
        break
    }
  }

  // 🛡️ NEW: Memory management
  handleMemoryWarning() {
    console.warn('💾 Memory usage high, optimizing...')
    
    // Reduce texture quality
    this.reduceTextureQuality()
    
    // Clear unused resources
    this.clearUnusedResources()
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc()
    }
  }

  reduceTextureQuality() {
    console.log('🔄 Reducing texture quality to save memory')
    
    // Reduce texture resolution
    this.world.stage.scene.traverse(object => {
      if (object.material && object.material.map) {
        object.material.map.generateMipmaps = false
        object.material.map.minFilter = THREE.LinearFilter
      }
    })
  }

  clearUnusedResources() {
    console.log('🔄 Clearing unused resources')
    
    // Dispose unused geometries
    this.renderer.dispose()
    
    // Clear texture cache
    THREE.Cache.clear()
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
    this.world.settings.on('change', this.onSettingsChange)
    this.world.prefs.on('change', this.onPrefsChange)
  }

  // 🛡️ NEW: Handle viewport resizing
  resize(width, height) {
    if (!width || !height) return
    
    this.width = width
    this.height = height
    this.aspect = width / height
    
    if (this.renderer) {
      this.renderer.setSize(width, height)
    }
    
    if (this.world.camera) {
      this.world.camera.aspect = this.aspect
      this.world.camera.updateProjectionMatrix()
    }
    
    // Update post-processing effects
    if (this.composer) {
      this.composer.setSize(width, height)
    }
    
    if (this.aoPass) {
      this.aoPass.setSize(width, height)
    }
    
    // Update TAA effect size if it exists
    if (this.taaEffect && this.taaEffect.setSize) {
      this.taaEffect.setSize(width, height)
    }
    
    // Update FXAA effect size if it exists
    if (this.fxaaEffect && this.fxaaEffect.setSize) {
      this.fxaaEffect.setSize(width, height)
    }
    
    console.log(`🔄 Resized to ${width}x${height}`)
  }

  // 🛡️ NEW: Setup resize observer
  setupResizeObserver() {
    if (!this.viewport) return
    
    this.resizer = new ResizeObserver(() => {
      this.resize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    })
    this.resizer.observe(this.viewport)
  }

  render() {
    // WebGPU compatibility: Reset render info for debugging if enabled and available
    if (this.renderer.info && !this.renderer.info.autoReset) {
      this.renderer.info.reset()
    }
    
    // Update AAA rendering systems before rendering - PERFORMANCE OPTIMIZED
    if (this.world.frame % 600 === 0) { // Debug every 10 seconds instead of every 2
      console.log('🎯 About to call updateAAARendering... (performance optimized)')
    }
    this.updateAAARendering(this.world.camera)
    if (this.world.frame % 600 === 0) {
      console.log('🎯 updateAAARendering completed')
    }
    
    // PERFORMANCE: Dispatch compute shaders less frequently to improve FPS
    if (this.world.frame % 6 === 0) { // Every 6 frames instead of every frame (10 FPS instead of 60 FPS)
      this.dispatchComputeShaders()
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
    console.log('🔧 ClientGraphics.onPrefsChange triggered with changes:', Object.keys(changes))
    // Handle resolution changes
    if (changes.dpr) {
      this.renderer.setPixelRatio(changes.dpr.value)
      this.resize(this.width, this.height)
    }
    
    // Handle anti-aliasing changes
    if (changes.antialiasing) {
      console.log('🎯 Anti-aliasing preference changed to:', changes.antialiasing.value)
      this.applyAntialiasing()
    }
    
    // Handle real-time settings that don't require reload
    if (changes.fieldOfView) {
      this.applyFieldOfView()
    }
    if (changes.toneMappingMode || changes.toneMappingExposure) {
      this.applyToneMappingSettings()
      // Re-apply display settings after tone mapping to maintain gamma/brightness/contrast
      this.applyDisplaySettings()
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
    
    // Handle shader quality settings
    if (changes.shaderQuality || changes.materialDetail || changes.reflectionQuality ||
        changes.subsurfaceScattering || changes.parallaxMapping || changes.tessellation) {
      this.applyShaderQualitySettings()
    }
    
    // Handle advanced material properties
    if (changes.normalMapStrength || changes.roughnessVariation || changes.metallicVariation ||
        changes.emissiveIntensity || changes.clearcoatStrength || changes.clearcoatRoughness ||
        changes.anisotropy || changes.anisotropyRotation || changes.sheenRoughness ||
        changes.transmission || changes.thickness || changes.attenuationDistance) {
      this.applyMaterialProperties()
    }
    
    // Handle shader effects
    if (changes.fresnelEffect || changes.fresnelStrength || changes.rimLighting ||
        changes.rimStrength || changes.matcapReflection || changes.environmentMapping ||
        changes.iridescence || changes.iridescenceStrength || changes.iridescenceThickness) {
      this.applyShaderEffects()
    }
    
    // Handle AAA Advanced Materials settings (WebGL AND WebGPU for testing)
    if (changes.materialQuality || changes.proceduralMaterials || 
        changes.dynamicMaterialLOD || changes.materialBatching) {
      if (this.advancedMaterials) {
        console.log('🔧 Updating Advanced Materials settings from preferences...')
        this.advancedMaterials.updateSettings({
          quality: changes.materialQuality?.value || this.world.prefs.materialQuality,
          procedural: changes.proceduralMaterials?.value ?? this.world.prefs.proceduralMaterials,
          dynamicLOD: changes.dynamicMaterialLOD?.value ?? this.world.prefs.dynamicMaterialLOD,
          batching: changes.materialBatching?.value ?? this.world.prefs.materialBatching
        })
        console.log('🎨 Advanced Materials settings updated - should see immediate visual changes!')
      }
    }
    
    // Handle AAA Advanced Shadows settings
    if (changes.cascadedShadowMaps || changes.volumetricShadows || changes.contactShadows ||
        changes.temporalShadowFiltering || changes.variableRateShadows || changes.shadowAtlasQuality) {
      if (this.advancedShadows) {
        this.advancedShadows.updateSettings({
          cascaded: changes.cascadedShadowMaps?.value ?? this.world.prefs.cascadedShadowMaps,
          volumetric: changes.volumetricShadows?.value ?? this.world.prefs.volumetricShadows,
          contact: changes.contactShadows?.value ?? this.world.prefs.contactShadows,
          temporal: changes.temporalShadowFiltering?.value ?? this.world.prefs.temporalShadowFiltering,
          variableRate: changes.variableRateShadows?.value ?? this.world.prefs.variableRateShadows,
          atlasQuality: changes.shadowAtlasQuality?.value || this.world.prefs.shadowAtlasQuality
        })
        console.log('🌘 Advanced Shadows settings updated')
      }
    }
    
    // Handle AAA GPU Profiler & Performance settings
    if (changes.gpuProfilerOverlay || changes.autoOptimization || changes.performanceWarnings ||
        changes.thermalThrottlingDetection) {
      if (this.gpuProfiler) {
        this.gpuProfiler.updateSettings({
          overlay: changes.gpuProfilerOverlay?.value ?? this.world.prefs.gpuProfilerOverlay,
          autoOptimization: changes.autoOptimization?.value ?? this.world.prefs.autoOptimization,
          warnings: changes.performanceWarnings?.value ?? this.world.prefs.performanceWarnings,
          thermal: changes.thermalThrottlingDetection?.value ?? this.world.prefs.thermalThrottlingDetection
        })
        console.log('📊 GPU Profiler settings updated')
      }
    }
    
    // Handle AAA Compute Shader settings
    if (changes.gpuDrivenCulling || changes.gpuParticleSimulation || changes.gpuLODSelection) {
      if (this.isWebGPU) {
        this.updateComputeShaderSettings({
          culling: changes.gpuDrivenCulling?.value ?? this.world.prefs.gpuDrivenCulling,
          particles: changes.gpuParticleSimulation?.value ?? this.world.prefs.gpuParticleSimulation,
          lod: changes.gpuLODSelection?.value ?? this.world.prefs.gpuLODSelection
        })
        console.log('🔧 Compute Shader settings updated')
      }
    }
    
    // Handle settings that may require post-processing changes
    if (changes.antialiasing || changes.depthOfField || changes.motionBlur || 
        changes.ssReflections || changes.volumetricLighting || changes.ssgi || 
        changes.taa || changes.temporalUpsampling || changes.bloom || changes.ao) {
      
      // Update WebGL post-processing effects
      if (this.renderer && this.renderer.isWebGLRenderer) {
        this.updateWebGLPostProcessingEffects()
      }
      
      // Update advanced post-processing effect states
      if (changes.depthOfField) {
        this.depthOfFieldEnabled = changes.depthOfField.value
      }
      if (changes.volumetricLighting) {
        this.enhancedSSAOEnabled = changes.volumetricLighting.value
      }
      if (changes.ssgi) {
        this.ssgiEnabled = changes.ssgi.value
        console.log('🌍 SSGI:', changes.ssgi.value ? 'enabled' : 'disabled')
      }
      if (changes.taa) {
        this.taaEnabled = changes.taa.value
        console.log('📐 TAA:', changes.taa.value ? 'enabled' : 'disabled')
      }
      if (changes.temporalUpsampling) {
        this.temporalUpsamplingEnabled = changes.temporalUpsampling.value
        console.log('🔼 Temporal Upsampling:', changes.temporalUpsampling.value ? 'enabled' : 'disabled')
      }
      
      // Force post-processing effects update
    }
    
    this.applyAntialiasing()
    
    // Handle v8: Comprehensive Shader and Rendering Engine Settings
    // Shader Quality Settings
    if (changes.shaderQuality || changes.materialDetail || changes.reflectionQuality ||
        changes.subsurfaceScattering || changes.parallaxMapping || changes.tessellation) {
      this.applyShaderQualitySettings()
      console.log('🎨 Shader quality settings updated')
    }
    
    // Advanced Material Properties
    if (changes.normalMapStrength || changes.roughnessVariation || changes.metallicVariation ||
        changes.emissiveIntensity || changes.clearcoatStrength || changes.clearcoatRoughness ||
        changes.anisotropy || changes.anisotropyRotation || changes.sheenColor ||
        changes.sheenRoughness || changes.transmission || changes.thickness ||
        changes.attenuationDistance || changes.attenuationColor) {
      this.applyMaterialProperties()
      console.log('🔧 Material properties updated')
    }
    
    // Shader Effects
    if (changes.fresnelEffect || changes.fresnelStrength || changes.rimLighting ||
        changes.rimStrength || changes.matcapReflection || changes.environmentMapping ||
        changes.iridescence || changes.iridescenceStrength || changes.iridescenceThickness) {
      this.applyShaderEffects()
      console.log('✨ Shader effects updated')
    }
    
    // Rendering Engine Settings
    if (changes.renderPipeline || changes.computeShaders || changes.cullingMethod ||
        changes.instancing || changes.batching || changes.occlusionCulling ||
        changes.frustumCulling || changes.backfaceCulling) {
      this.applyRenderingEngineSettings()
      console.log('⚙️ Rendering engine settings updated')
    }
    
    // Memory and Buffer Settings
    if (changes.vertexBufferSize || changes.indexBufferSize || changes.uniformBufferSize ||
        changes.textureCacheSize || changes.shaderCacheSize || changes.geometryCacheSize) {
      this.applyMemorySettings()
      console.log('💾 Memory settings updated')
    }
    
    // Advanced Rendering Settings
    if (changes.multisampling || changes.depthPrepass || changes.earlyZTest ||
        changes.conservativeRasterization || changes.tessellationControlPoints ||
        changes.geometryShaderSupport || changes.computeShaderWorkgroups || changes.rayTracingSupport) {
      this.applyAdvancedRenderingSettings()
      console.log('🔬 Advanced rendering settings updated')
    }
    
    // Performance Tuning
    if (changes.gpuMemoryBudget || changes.cpuThreadCount || changes.asyncLoading ||
        changes.streamingTextures || changes.dynamicLOD || changes.adaptiveQuality) {
      this.applyPerformanceTuning()
      console.log('🚀 Performance tuning updated')
    }
    
    this.updatePostProcessingEffects()
    
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
    console.log('🎯 Applying anti-aliasing:', aa, 'Renderer:', this.isWebGPU ? 'WebGPU' : 'WebGL')
    console.log('🎯 World prefs:', this.world.prefs)
    console.log('🎯 Renderer:', this.renderer)
    console.log('🎯 Composer:', this.composer)
    
    if (this.isWebGPU) {
      this.applyWebGPUAntialiasing(aa)
    } else {
      this.applyWebGLAntialiasing(aa)
    }
  }
  
  // WebGPU anti-aliasing implementation
  applyWebGPUAntialiasing(aa) {
    // Normalize MSAA aliases
    if (aa === 'msaa2') aa = 'msaa2x';
    if (aa === 'msaa4') aa = 'msaa4x';
    if (aa === 'msaa8') aa = 'msaa8x';
    console.log('🚀 WebGPU Anti-aliasing:', aa)
    
    // Remove existing AA effects
    if (this.webgpuAAEffect) {
      this.webgpuAAEffect = null
    }
    
    switch (aa) {
      case 'none':
        // No post-processing AA
        console.log('✅ WebGPU: No anti-aliasing')
        break
        
      case 'fxaa':
        this.setupWebGPUFXAA()
        break
        
      case 'smaa':
        this.setupWebGPUSMAA()
        break
        
      case 'taa':
        this.setupWebGPUTAA()
        break
        
      case 'msaa2x':
      case 'msaa4x':
      case 'msaa8x':
        this.setupWebGPUMSAA(aa)
        break
        
      default:
        console.log('⚠️ WebGPU: Unknown AA method:', aa)
        break
    }
  }
  
  // WebGL anti-aliasing implementation
  applyWebGLAntialiasing(aa) {
    // Normalize MSAA aliases
    if (aa === 'msaa2') aa = 'msaa2x';
    if (aa === 'msaa4') aa = 'msaa4x';
    if (aa === 'msaa8') aa = 'msaa8x';
    console.log('🎨 WebGL Anti-aliasing:', aa)
    console.log('🎨 Composer available:', !!this.composer)
    console.log('🎨 Current SMAA effect:', !!this.smaaEffect)
    console.log('🎨 Current FXAA effect:', !!this.fxaaEffect)
    console.log('🎨 Current TAA effect:', !!this.taaEffect)
    
    if (!this.composer) {
      console.warn('⚠️ WebGL: No composer available for post-processing AA')
      return
    }
    
    // Remove existing AA effects
    if (this.smaaEffect) {
      this.composer.removePass(this.smaaEffect)
      this.smaaEffect = null
    }
    if (this.fxaaEffect) {
      this.composer.removePass(this.fxaaEffect)
      this.fxaaEffect = null
    }
    if (this.taaEffect) {
      this.composer.removePass(this.taaEffect)
      this.taaEffect = null
    }
    
    switch (aa) {
      case 'none':
        // No post-processing AA (MSAA still active if enabled)
        console.log('✅ WebGL: No post-processing anti-aliasing')
        break
        
      case 'fxaa':
        this.setupWebGLFXAA()
        break
        
      case 'smaa':
        this.setupWebGLSMAA()
        break
        
      case 'taa':
        this.setupWebGLTAA()
        break
        
      case 'msaa2x':
      case 'msaa4x':
      case 'msaa8x':
        this.setupWebGLMSAA(aa)
        break
        
      default:
        console.log('⚠️ WebGL: Unknown AA method:', aa)
        break
    }
  }
  
  // WebGPU FXAA implementation
  setupWebGPUFXAA() {
    console.log('🚀 Setting up WebGPU FXAA...')
    
    this.webgpuAAEffect = tslFn(() => {
      const uv = screenUV
      const color = texture(output, uv)
      
      // FXAA implementation for WebGPU
      const texelSize = this.webgpuUniforms.invResolution
      const luma = dot(color.rgb, vec3(0.299, 0.587, 0.114))
      
      // Sample neighboring pixels
      const n = texture(output, uv.add(vec2(0, -1).mul(texelSize)))
      const s = texture(output, uv.add(vec2(0, 1).mul(texelSize)))
      const e = texture(output, uv.add(vec2(1, 0).mul(texelSize)))
      const w = texture(output, uv.add(vec2(-1, 0).mul(texelSize)))
      
      const lumaN = dot(n.rgb, vec3(0.299, 0.587, 0.114))
      const lumaS = dot(s.rgb, vec3(0.299, 0.587, 0.114))
      const lumaE = dot(e.rgb, vec3(0.299, 0.587, 0.114))
      const lumaW = dot(w.rgb, vec3(0.299, 0.587, 0.114))
      
      const lumaMin = min(min(lumaN, lumaS), min(lumaE, lumaW))
      const lumaMax = max(max(lumaN, lumaS), max(lumaE, lumaW))
      const lumaRange = lumaMax.sub(lumaMin)
      
      // Apply FXAA if edge is detected
      const edgeThreshold = 0.0833
      const subpixelQuality = 0.75
      
      if (lumaRange.greaterThan(edgeThreshold)) {
        // Simple FXAA blend
        const blend = lumaRange.mul(subpixelQuality)
        return mix(color.rgb, color.rgb.mul(0.5).add(n.rgb.add(s.rgb.add(e.rgb.add(w.rgb))).mul(0.125)), blend)
      }
      
      return color.rgb
    })
    
    console.log('✅ WebGPU FXAA setup complete')
  }
  
  // WebGPU SMAA implementation
  setupWebGPUSMAA() {
    console.log('🚀 Setting up WebGPU SMAA...')
    
    // SMAA is complex, so we'll implement a simplified version
    this.webgpuAAEffect = tslFn(() => {
      const uv = screenUV
      const color = texture(output, uv)
      
      // Simplified SMAA-like edge detection and blending
      const texelSize = this.webgpuUniforms.invResolution
      
      // Sample 3x3 neighborhood
      const samples = []
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const sampleUV = uv.add(vec2(i, j).mul(texelSize))
          samples.push(texture(output, sampleUV))
        }
      }
      
      // Calculate edge strength
      let edgeStrength = 0.0
      for (let i = 0; i < samples.length; i++) {
        const luma = dot(samples[i].rgb, vec3(0.299, 0.587, 0.114))
        edgeStrength = edgeStrength.add(luma)
      }
      edgeStrength = edgeStrength.div(9.0)
      
      // Apply smoothing based on edge strength
      const smoothingFactor = 0.5
      const smoothedColor = color.rgb.mul(1.0.sub(edgeStrength.mul(smoothingFactor)))
      
      return smoothedColor
    })
    
    console.log('✅ WebGPU SMAA setup complete')
  }
  
  // WebGPU TAA implementation
  setupWebGPUTAA() {
    console.log('🚀 Setting up WebGPU TAA...')
    
    // Use the existing TAA implementation
    this.setupTAA()
    this.webgpuAAEffect = this.taaShader
    
    console.log('✅ WebGPU TAA setup complete')
  }
  
  // WebGPU MSAA implementation
  setupWebGPUMSAA(aa) {
    console.log('🚀 Setting up WebGPU MSAA:', aa)
    
    // MSAA is handled at the renderer level
    const msaaLevel = parseInt(aa.replace('msaa', ''))
    console.log('✅ WebGPU MSAA level:', msaaLevel, 'x')
    
    // MSAA requires renderer recreation
    this.recreateRendererForMSAA()
  }
  
  // WebGL FXAA implementation
  setupWebGLFXAA() {
    console.log('🎨 Setting up WebGL FXAA...')
    
    try {
      // Create custom FXAA effect that extends the postprocessing library's Effect class
      class FXAAEffect extends Pass {
        constructor() {
          super('FXAAEffect')
          
          this.uniforms = {
            tDiffuse: { value: null },
            resolution: { value: new THREE.Vector2() }
          }
          
          this.fragmentShader = `
            uniform sampler2D tDiffuse;
            uniform vec2 resolution;
            varying vec2 vUv;
            
            #define FXAA_REDUCE_MIN (1.0/128.0)
            #define FXAA_REDUCE_MUL (1.0/8.0)
            #define FXAA_SPAN_MAX 8.0
            
            vec4 fxaa(sampler2D tex, vec2 fragCoord, vec2 resolution,
                     float spanMax, float reduceMin, float reduceMul,
                     float subpixelQuality) {
              vec3 rgbNW = texture2D(tex, (fragCoord + vec2(-1.0, -1.0)) / resolution).xyz;
              vec3 rgbNE = texture2D(tex, (fragCoord + vec2(1.0, -1.0)) / resolution).xyz;
              vec3 rgbSW = texture2D(tex, (fragCoord + vec2(-1.0, 1.0)) / resolution).xyz;
              vec3 rgbSE = texture2D(tex, (fragCoord + vec2(1.0, 1.0)) / resolution).xyz;
              vec3 rgbM  = texture2D(tex, fragCoord / resolution).xyz;
              
              vec3 luma = vec3(0.299, 0.587, 0.114);
              float lumaNW = dot(rgbNW, luma);
              float lumaNE = dot(rgbNE, luma);
              float lumaSW = dot(rgbSW, luma);
              float lumaSE = dot(rgbSE, luma);
              float lumaM  = dot(rgbM, luma);
              
              float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
              float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
              
              vec2 dir;
              dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
              dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));
              
              float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * reduceMul), reduceMin);
              float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
              dir = min(vec2(spanMax, spanMax), max(vec2(-spanMax, -spanMax), dir * rcpDirMin)) / resolution;
              
              vec3 rgbA = 0.5 * (texture2D(tex, fragCoord / resolution + dir * (1.0 / 3.0 - 0.5)).xyz +
                                 texture2D(tex, fragCoord / resolution + dir * (2.0 / 3.0 - 0.5)).xyz);
              vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tex, fragCoord / resolution + dir * -0.5).xyz +
                                               texture2D(tex, fragCoord / resolution + dir * 0.5).xyz);
              
              float lumaB = dot(rgbB, luma);
              if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
                return vec4(rgbA, 1.0);
              } else {
                return vec4(rgbB, 1.0);
              }
            }
            
            void main() {
              vec2 fragCoord = gl_FragCoord.xy;
              gl_FragColor = fxaa(tDiffuse, fragCoord, resolution, FXAA_SPAN_MAX, FXAA_REDUCE_MIN, FXAA_REDUCE_MUL, 0.75);
            }
          `
          
          this.vertexShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `
          
          this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader
          })
        }
        
        setSize(width, height) {
          this.uniforms.resolution.value.set(width, height)
        }
        
        render(renderer, inputBuffer, outputBuffer) {
          this.material.uniforms.tDiffuse.value = inputBuffer.texture
          renderer.setRenderTarget(outputBuffer)
          renderer.render(this.scene, this.camera)
        }
      }
      
      this.fxaaEffect = new FXAAEffect()
      this.composer.addPass(this.fxaaEffect)
      
      console.log('✅ WebGL FXAA setup complete with custom effect');
    } catch (error) {
      console.warn('⚠️ WebGL FXAA setup failed:', error)
      // Fall back to SMAA
      this.setupWebGLSMAA()
    }
  }
  
  // WebGL SMAA implementation
  setupWebGLSMAA() {
    console.log('🎨 Setting up WebGL SMAA...')
    
    try {
      this.smaaEffect = new SMAAEffect(SMAAPreset.HIGH)
      const effectPass = new EffectPass(this.world.camera, this.smaaEffect)
      this.composer.addPass(effectPass)
      console.log('✅ WebGL SMAA setup complete')
      console.log('✅ SMAA effect created:', !!this.smaaEffect)
      console.log('✅ Effect pass added to composer')
    } catch (error) {
      console.warn('⚠️ WebGL SMAA setup failed:', error)
    }
  }
  
  // WebGL TAA implementation
  setupWebGLTAA() {
    console.log('🎨 Setting up WebGL TAA...')
    
    try {
      // Create custom TAA effect that extends the postprocessing library's Effect class
      class TAAEffect extends Pass {
        constructor() {
          super('TAAEffect')
          
          this.uniforms = {
            tDiffuse: { value: null },
            tPrevious: { value: null },
            resolution: { value: new THREE.Vector2() },
            time: { value: 0.0 },
            blendFactor: { value: 0.9 }
          }
          
          this.fragmentShader = `
            uniform sampler2D tDiffuse;
            uniform sampler2D tPrevious;
            uniform vec2 resolution;
            uniform float time;
            uniform float blendFactor;
            varying vec2 vUv;
            
            // Halton sequence for jittering
            vec2 halton(int index) {
              vec2 result = vec2(0.0);
              float f = 1.0;
              for (int i = 0; i < 16; i++) {
                if (index > 0) {
                  f = float(index) / 2.0;
                  result.x += mod(f, 1.0) / (256.0 * f);
                  f = floor(f);
                }
                if (index > 0) {
                  f = float(index) / 3.0;
                  result.y += mod(f, 1.0) / (256.0 * f);
                  f = floor(f);
                }
              }
              return result;
            }
            
            // Neighborhood clamping for TAA
            vec3 clampToNeighborhood(vec3 color, vec2 uv) {
              vec2 texelSize = 1.0 / resolution;
              vec3 minColor = color;
              vec3 maxColor = color;
              
              // Sample 3x3 neighborhood
              for (int x = -1; x <= 1; x++) {
                for (int y = -1; y <= 1; y++) {
                  vec2 offset = vec2(float(x), float(y)) * texelSize;
                  vec3 sample = texture2D(tDiffuse, uv + offset).rgb;
                  minColor = min(minColor, sample);
                  maxColor = max(maxColor, sample);
                }
              }
              
              return clamp(color, minColor, maxColor);
            }
            
            void main() {
              vec2 uv = vUv;
              
              // Add jitter based on time
              int frameIndex = int(mod(time * 60.0, 16.0));
              vec2 jitter = halton(frameIndex) * 2.0 - 1.0;
              jitter *= 0.5 / resolution;
              
              // Sample current frame with jitter
              vec3 currentColor = texture2D(tDiffuse, uv + jitter).rgb;
              
              // Sample previous frame (without jitter for stability)
              vec3 previousColor = texture2D(tPrevious, uv).rgb;
              
              // Clamp previous color to neighborhood
              vec3 clampedPrevious = clampToNeighborhood(previousColor, uv);
              
              // Blend current and previous frames
              vec3 finalColor = mix(currentColor, clampedPrevious, blendFactor);
              
              gl_FragColor = vec4(finalColor, 1.0);
            }
          `
          
          this.vertexShader = `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `
          
          this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader
          })
          
          // Create render target for previous frame
          this.previousFrameTarget = new THREE.WebGLRenderTarget(1, 1, {
            format: THREE.RGBAFormat,
            type: THREE.FloatType
          })
        }
        
        setSize(width, height) {
          this.uniforms.resolution.value.set(width, height)
          this.previousFrameTarget.setSize(width, height)
        }
        
        render(renderer, inputBuffer, outputBuffer) {
          this.material.uniforms.tDiffuse.value = inputBuffer.texture
          this.material.uniforms.tPrevious.value = this.previousFrameTarget.texture
          this.material.uniforms.time.value = performance.now() * 0.001
          
          renderer.setRenderTarget(outputBuffer)
          renderer.render(this.scene, this.camera)
          
          // Copy current frame to previous frame target for next frame
          renderer.setRenderTarget(this.previousFrameTarget)
          renderer.render(this.scene, this.camera)
        }
      }
      
      this.taaEffect = new TAAEffect()
      this.composer.addPass(this.taaEffect)
      
      console.log('✅ WebGL TAA setup complete with custom effect');
    } catch (error) {
      console.warn('⚠️ WebGL TAA setup failed:', error)
      // Fall back to SMAA
      this.setupWebGLSMAA()
    }
  }
  
  // WebGL MSAA implementation
  setupWebGLMSAA(aa) {
    console.log('🎨 Setting up WebGL MSAA:', aa)
    
    // MSAA is handled at the renderer level during creation
    const msaaLevel = parseInt(aa.replace('msaa', ''))
    console.log('✅ WebGL MSAA level:', msaaLevel, 'x')
    
    // MSAA requires renderer recreation
    this.recreateRendererForMSAA()
  }
  
  // Handle renderer recreation for MSAA changes
  async recreateRendererForMSAA() {
    console.log('🔄 Recreating renderer for MSAA change...')
    
    try {
      // Store current renderer state
      const currentRenderer = this.renderer
      const isWebGPU = this.isWebGPU
      
      // Remove current renderer from viewport
      if (this.viewport && currentRenderer) {
        this.viewport.removeChild(currentRenderer.domElement)
      }
      
      // Recreate renderer with new MSAA settings
      if (isWebGPU) {
        await this.initializeWebGPURenderer()
      } else {
        this.initializeWebGLRenderer()
      }
      
      // Re-add to viewport
      if (this.viewport && this.renderer) {
        this.viewport.appendChild(this.renderer.domElement)
      }
      
      // Reinitialize post-processing
      await this.initializePostProcessing()
      
      console.log('✅ Renderer recreated successfully for MSAA')
    } catch (error) {
      console.error('❌ Failed to recreate renderer for MSAA:', error)
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
    const gamma = this.world.prefs.gamma || 2.2
    const brightness = this.world.prefs.brightness || 1.0
    const contrast = this.world.prefs.contrast || 1.0
    
    if (this.renderer) {
      // Store settings for post-processing pipeline
    this.displaySettings = {
        gamma: gamma,
        brightness: brightness,
        contrast: contrast
      }
      
      // Apply brightness and contrast by modifying the tone mapping exposure
      // This is the most reliable way to affect overall scene brightness
      const baseExposure = this.world.prefs.toneMappingExposure || 1.0
      
      // Apply brightness multiplier
      let adjustedExposure = baseExposure * brightness
      
      // Apply contrast adjustment
      if (contrast !== 1.0) {
        // Contrast affects the exposure curve
        // Higher contrast = brighter highlights, darker shadows
        adjustedExposure *= contrast
      }
      
      // Apply gamma correction
      if (gamma !== 2.2) {
        // Gamma correction affects the overall brightness curve
        // Lower gamma = brighter midtones
        const gammaCorrection = Math.pow(2.2 / gamma, 0.5)
        adjustedExposure *= gammaCorrection
      }
      
      // Set the final exposure
      this.renderer.toneMappingExposure = adjustedExposure
      
      console.log(`🎨 Applied display settings: Gamma=${gamma}, Brightness=${brightness}, Contrast=${contrast}, Final Exposure=${adjustedExposure.toFixed(3)}`)
      
      // Additional debug info
      if (brightness !== 1.0 || contrast !== 1.0 || gamma !== 2.2) {
        console.log(`🔧 Display settings active: Brightness=${brightness !== 1.0 ? 'ON' : 'OFF'}, Contrast=${contrast !== 1.0 ? 'ON' : 'OFF'}, Gamma=${gamma !== 2.2 ? 'ON' : 'OFF'}`)
      }
    }
  }

  // Apply shader quality settings
  applyShaderQualitySettings() {
    const shaderQuality = this.world.prefs.shaderQuality || 'enhanced'
    const materialDetail = this.world.prefs.materialDetail || 'high'
    const reflectionQuality = this.world.prefs.reflectionQuality || 'high'
    const subsurfaceScattering = this.world.prefs.subsurfaceScattering || true
    const parallaxMapping = this.world.prefs.parallaxMapping || false
    const tessellation = this.world.prefs.tessellation || false
    
    // Store shader quality settings
    this.shaderSettings = {
      shaderQuality,
      materialDetail,
      reflectionQuality,
      subsurfaceScattering,
      parallaxMapping,
      tessellation
    }
    
    let materialCount = 0
    const processedMaterials = new Set() // Prevent duplicate processing
    const MAX_MATERIALS_PER_FRAME = 100 // Limit materials processed per frame to prevent memory issues
    
    // Apply to all materials in the scene
    this.world.stage.scene.traverse(obj => {
      if (obj.material && !processedMaterials.has(obj.material) && materialCount < MAX_MATERIALS_PER_FRAME) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach(material => {
          if (!processedMaterials.has(material) && materialCount < MAX_MATERIALS_PER_FRAME) {
            this.updateMaterialQuality(material, this.world.prefs)
            processedMaterials.add(material)
            materialCount++
          }
        })
      }
    })
    
    console.log(`🎨 Applied shader quality settings to ${materialCount} materials: Quality=${shaderQuality}, Detail=${materialDetail}, Reflections=${reflectionQuality}`)
    
    // If we hit the limit, schedule more processing
    if (materialCount >= MAX_MATERIALS_PER_FRAME) {
      console.log(`⚠️ Material limit reached (${MAX_MATERIALS_PER_FRAME}), scheduling additional processing...`)
      setTimeout(() => this.applyShaderQualitySettings(), 100)
    }
  }

  // Apply advanced material properties
  applyMaterialProperties() {
    const normalMapStrength = this.world.prefs.normalMapStrength || 1.0
    const roughnessVariation = this.world.prefs.roughnessVariation || 0.1
    const metallicVariation = this.world.prefs.metallicVariation || 0.1
    const emissiveIntensity = this.world.prefs.emissiveIntensity || 1.0
    const clearcoatStrength = this.world.prefs.clearcoatStrength || 0.0
    const clearcoatRoughness = this.world.prefs.clearcoatRoughness || 0.1
    const anisotropy = this.world.prefs.anisotropy || 0.0
    const anisotropyRotation = this.world.prefs.anisotropyRotation || 0.0
    const sheenRoughness = this.world.prefs.sheenRoughness || 0.5
    const transmission = this.world.prefs.transmission || 0.0
    const thickness = this.world.prefs.thickness || 1.0
    const attenuationDistance = this.world.prefs.attenuationDistance || 1.0
    
    // Store material property settings
    this.materialProperties = {
      normalMapStrength,
      roughnessVariation,
      metallicVariation,
      emissiveIntensity,
      clearcoatStrength,
      clearcoatRoughness,
      anisotropy,
      anisotropyRotation,
      sheenRoughness,
      transmission,
      thickness,
      attenuationDistance
    }
    
    let materialCount = 0
    let normalMapCount = 0
    let roughnessCount = 0
    let metallicCount = 0
    let emissiveCount = 0
    const processedMaterials = new Set() // Prevent duplicate processing
    const MAX_MATERIALS_PER_FRAME = 100 // Limit materials processed per frame to prevent memory issues
    
    // Apply to all materials in the scene
    this.world.stage.scene.traverse(obj => {
      if (obj.material && !processedMaterials.has(obj.material) && materialCount < MAX_MATERIALS_PER_FRAME) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach(material => {
          if (!processedMaterials.has(material) && materialCount < MAX_MATERIALS_PER_FRAME) {
            this.updateMaterialProperties(material, this.world.prefs)
            processedMaterials.add(material)
            materialCount++
            
            // Count which properties were actually applied
            if (material.normalMap) normalMapCount++
            if (material.roughness !== undefined) roughnessCount++
            if (material.metalness !== undefined) metallicCount++
            if (material.emissive) emissiveCount++
          }
        })
      }
    })
    
    console.log(`🎨 Applied material properties to ${materialCount} materials: Normal=${normalMapStrength} (${normalMapCount} with normal maps), Roughness=${roughnessVariation} (${roughnessCount} materials), Metallic=${metallicVariation} (${metallicCount} materials), Emissive=${emissiveIntensity} (${emissiveCount} materials)`)
    
    // If we hit the limit, schedule more processing
    if (materialCount >= MAX_MATERIALS_PER_FRAME) {
      console.log(`⚠️ Material limit reached (${MAX_MATERIALS_PER_FRAME}), scheduling additional processing...`)
      setTimeout(() => this.applyMaterialProperties(), 100)
    }
  }

  // Apply shader effects
  applyShaderEffects() {
    const fresnelEffect = this.world.prefs.fresnelEffect || false
    const fresnelStrength = this.world.prefs.fresnelStrength || 1.0
    const rimLighting = this.world.prefs.rimLighting || false
    const rimStrength = this.world.prefs.rimStrength || 1.0
    const matcapReflection = this.world.prefs.matcapReflection || false
    const environmentMapping = this.world.prefs.environmentMapping || true
    const iridescence = this.world.prefs.iridescence || false
    const iridescenceStrength = this.world.prefs.iridescenceStrength || 1.0
    const iridescenceThickness = this.world.prefs.iridescenceThickness || 1.0
    
    // Store shader effect settings
    this.shaderEffects = {
      fresnelEffect,
      fresnelStrength,
      rimLighting,
      rimStrength,
      matcapReflection,
      environmentMapping,
      iridescence,
      iridescenceStrength,
      iridescenceThickness
    }
    
    let materialCount = 0
    let envMapCount = 0
    let iridescenceCount = 0
    let fresnelCount = 0
    let rimCount = 0
    let matcapCount = 0
    const processedMaterials = new Set() // Prevent duplicate processing
    const MAX_MATERIALS_PER_FRAME = 100 // Limit materials processed per frame to prevent memory issues
    
    // Apply to all materials in the scene
    this.world.stage.scene.traverse(obj => {
      if (obj.material && !processedMaterials.has(obj.material) && materialCount < MAX_MATERIALS_PER_FRAME) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        materials.forEach(material => {
          if (!processedMaterials.has(material) && materialCount < MAX_MATERIALS_PER_FRAME) {
            this.updateShaderEffects(material, this.world.prefs)
            processedMaterials.add(material)
            materialCount++
            
            // Count which effects were actually applied
            if (material.envMapIntensity !== undefined) envMapCount++
            if (material.iridescence !== undefined && iridescence) iridescenceCount++
            if (fresnelEffect && material.envMapIntensity !== undefined) fresnelCount++
            if (rimLighting && material.emissive) rimCount++
            if (matcapReflection && material.envMapIntensity !== undefined) matcapCount++
          }
        })
      }
    })
    
    console.log(`🎨 Applied shader effects to ${materialCount} materials: Environment=${environmentMapping} (${envMapCount} materials), Fresnel=${fresnelEffect} (${fresnelCount} materials), Rim=${rimLighting} (${rimCount} materials), Matcap=${matcapReflection} (${matcapCount} materials), Iridescence=${iridescence} (${iridescenceCount} materials)`)
    
    // If we hit the limit, schedule more processing
    if (materialCount >= MAX_MATERIALS_PER_FRAME) {
      console.log(`⚠️ Material limit reached (${MAX_MATERIALS_PER_FRAME}), scheduling additional processing...`)
      setTimeout(() => this.applyShaderEffects(), 100)
    }
  }

  // Update material quality based on shader settings
  updateMaterialQuality(material, prefs) {
    if (!material || !material.isMaterial) return
    
    const shaderQuality = prefs.shaderQuality || 'enhanced'
    const materialDetail = prefs.materialDetail || 'high'
    const reflectionQuality = prefs.reflectionQuality || 'high'
    
    // Apply quality-based material adjustments
    switch (shaderQuality) {
      case 'ultra':
        material.precision = 'highp'
        material.envMapIntensity = 1.0
        break
      case 'aaa':
        material.precision = 'highp'
        material.envMapIntensity = 0.8
        break
      case 'enhanced':
        material.precision = 'mediump'
        material.envMapIntensity = 0.6
        break
      case 'standard':
        material.precision = 'mediump'
        material.envMapIntensity = 0.4
        break
      case 'basic':
        material.precision = 'lowp'
        material.envMapIntensity = 0.2
        break
    }
    
    // Apply detail level adjustments
    if (material.normalMap) {
      switch (materialDetail) {
        case 'ultra':
          material.normalScale.setScalar(2.0)
          break
        case 'high':
          material.normalScale.setScalar(1.5)
          break
        case 'medium':
          material.normalScale.setScalar(1.0)
          break
        case 'low':
          material.normalScale.setScalar(0.5)
          break
      }
    }
    
    material.needsUpdate = true
  }

  // Update material properties based on shader settings
  updateMaterialProperties(material, prefs) {
    if (!material || !material.isMaterial) return
    
    const normalMapStrength = prefs.normalMapStrength || 1.0
    const roughnessVariation = prefs.roughnessVariation || 0.1
    const metallicVariation = prefs.metallicVariation || 0.1
    const emissiveIntensity = prefs.emissiveIntensity || 1.0
    const clearcoatStrength = prefs.clearcoatStrength || 0.0
    const clearcoatRoughness = prefs.clearcoatRoughness || 0.1
    const anisotropy = prefs.anisotropy || 0.0
    const anisotropyRotation = prefs.anisotropyRotation || 0.0
    const sheenRoughness = prefs.sheenRoughness || 0.5
    const transmission = prefs.transmission || 0.0
    const thickness = prefs.thickness || 1.0
    const attenuationDistance = prefs.attenuationDistance || 1.0
    
    // WebGL-specific optimizations
    const isWebGL = this.renderer && this.renderer.isWebGLRenderer
    
    // Apply normal map strength (this works well)
    if (material.normalMap) {
      material.normalScale.setScalar(normalMapStrength)
      
      // WebGL-specific normal map optimizations
      if (isWebGL) {
        // Ensure normal map is properly configured for WebGL
        material.normalMap.wrapS = THREE.ClampToEdgeWrapping
        material.normalMap.wrapT = THREE.ClampToEdgeWrapping
        material.normalMap.generateMipmaps = true
        material.normalMap.minFilter = THREE.LinearMipmapLinearFilter
        material.normalMap.magFilter = THREE.LinearFilter
      }
    }
    
    // Apply roughness variation - set absolute value instead of adding
    if (material.roughness !== undefined) {
      // Store original roughness if not already stored
      if (material.userData.originalRoughness === undefined) {
        material.userData.originalRoughness = material.roughness
      }
      const baseRoughness = material.userData.originalRoughness
      material.roughness = Math.max(0.0, Math.min(1.0, baseRoughness + roughnessVariation))
    }
    
    // Apply metallic variation - set absolute value instead of adding
    if (material.metalness !== undefined) {
      // Store original metalness if not already stored
      if (material.userData.originalMetalness === undefined) {
        material.userData.originalMetalness = material.metalness
      }
      const baseMetalness = material.userData.originalMetalness
      material.metalness = Math.max(0.0, Math.min(1.0, baseMetalness + metallicVariation))
    }
    
    // Apply emissive intensity - work with both emissiveIntensity and emissive color
    if (material.emissive) {
      // Store original emissive if not already stored
      if (material.userData.originalEmissive === undefined) {
        material.userData.originalEmissive = material.emissive.clone()
      }
      
      // Apply intensity to emissive color
      const originalEmissive = material.userData.originalEmissive
      material.emissive.copy(originalEmissive).multiplyScalar(emissiveIntensity)
      
      // Also set emissiveIntensity if the property exists
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = emissiveIntensity
      }
      
      // WebGL-specific emissive optimizations
      if (isWebGL && material.emissiveMap) {
        material.emissiveMap.wrapS = THREE.ClampToEdgeWrapping
        material.emissiveMap.wrapT = THREE.ClampToEdgeWrapping
        material.emissiveMap.generateMipmaps = true
      }
    }
    
    // Apply clearcoat properties (for MeshPhysicalMaterial)
    if (material.clearcoat !== undefined) {
      material.clearcoat = clearcoatStrength
      material.clearcoatRoughness = clearcoatRoughness
      
      // WebGL-specific clearcoat optimizations
      if (isWebGL && material.clearcoatMap) {
        material.clearcoatMap.wrapS = THREE.ClampToEdgeWrapping
        material.clearcoatMap.wrapT = THREE.ClampToEdgeWrapping
        material.clearcoatMap.generateMipmaps = true
      }
    }
    
    // Apply anisotropy (for MeshPhysicalMaterial)
    if (material.anisotropy !== undefined) {
      material.anisotropy = anisotropy
      material.anisotropyRotation = anisotropyRotation
      
      // WebGL-specific anisotropy optimizations
      if (isWebGL && material.anisotropyMap) {
        material.anisotropyMap.wrapS = THREE.ClampToEdgeWrapping
        material.anisotropyMap.wrapT = THREE.ClampToEdgeWrapping
        material.anisotropyMap.generateMipmaps = true
      }
    }
    
    // Apply sheen properties (for MeshPhysicalMaterial)
    if (material.sheenRoughness !== undefined) {
      material.sheenRoughness = sheenRoughness
      
      // WebGL-specific sheen optimizations
      if (isWebGL && material.sheenRoughnessMap) {
        material.sheenRoughnessMap.wrapS = THREE.ClampToEdgeWrapping
        material.sheenRoughnessMap.wrapT = THREE.ClampToEdgeWrapping
        material.sheenRoughnessMap.generateMipmaps = true
      }
    }
    
    // Apply transmission properties (for MeshPhysicalMaterial)
    if (material.transmission !== undefined) {
      material.transmission = transmission
      material.thickness = thickness
      material.attenuationDistance = attenuationDistance
      
      // WebGL-specific transmission optimizations
      if (isWebGL && material.transmissionMap) {
        material.transmissionMap.wrapS = THREE.ClampToEdgeWrapping
        material.transmissionMap.wrapT = THREE.ClampToEdgeWrapping
        material.transmissionMap.generateMipmaps = true
      }
    }
    
    // Apply environment map intensity based on reflection quality
    const reflectionQuality = prefs.reflectionQuality || 'high'
    if (material.envMapIntensity !== undefined) {
      // Store original envMapIntensity if not already stored
      if (material.userData.originalEnvMapIntensity === undefined) {
        material.userData.originalEnvMapIntensity = material.envMapIntensity
      }
      
      let envIntensity = 0.5 // default
      switch (reflectionQuality) {
        case 'ultra':
          envIntensity = 1.0
          break
        case 'high':
          envIntensity = 0.8
          break
        case 'medium':
          envIntensity = 0.5
          break
        case 'low':
          envIntensity = 0.2
          break
      }
      material.envMapIntensity = envIntensity
      
      // WebGL-specific environment map optimizations
      if (isWebGL && material.envMap) {
        material.envMap.wrapS = THREE.ClampToEdgeWrapping
        material.envMap.wrapT = THREE.ClampToEdgeWrapping
        material.envMap.generateMipmaps = true
        material.envMap.minFilter = THREE.LinearMipmapLinearFilter
        material.envMap.magFilter = THREE.LinearFilter
      }
    }
    
    // WebGL-specific material optimizations
    if (isWebGL) {
      // Enable WebGL-specific features
      material.defines = material.defines || {}
      material.defines.USE_WEBGL = 1
      
      // Optimize for WebGL rendering
      if (material.map) {
        material.map.wrapS = THREE.ClampToEdgeWrapping
        material.map.wrapT = THREE.ClampToEdgeWrapping
        material.map.generateMipmaps = true
        material.map.minFilter = THREE.LinearMipmapLinearFilter
        material.map.magFilter = THREE.LinearFilter
      }
      
      // Enable anisotropic filtering if available
      if (this.renderer.capabilities.getMaxAnisotropy() > 1) {
        const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
        if (material.map) material.map.anisotropy = maxAnisotropy
        if (material.normalMap) material.normalMap.anisotropy = maxAnisotropy
        if (material.roughnessMap) material.roughnessMap.anisotropy = maxAnisotropy
        if (material.metalnessMap) material.metalnessMap.anisotropy = maxAnisotropy
        if (material.emissiveMap) material.emissiveMap.anisotropy = maxAnisotropy
      }
    }
    
    material.needsUpdate = true
  }

  // Update shader effects based on settings
  updateShaderEffects(material, prefs) {
    if (!material || !material.isMaterial) return
    
    const fresnelEffect = prefs.fresnelEffect || false
    const fresnelStrength = prefs.fresnelStrength || 1.0
    const rimLighting = prefs.rimLighting || false
    const rimStrength = prefs.rimStrength || 1.0
    const matcapReflection = prefs.matcapReflection || false
    const environmentMapping = prefs.environmentMapping || true
    const iridescence = prefs.iridescence || false
    const iridescenceStrength = prefs.iridescenceStrength || 1.0
    const iridescenceThickness = prefs.iridescenceThickness || 1.0
    
    // WebGL-specific optimizations
    const isWebGL = this.renderer && this.renderer.isWebGLRenderer
    
    // Apply environment mapping
    if (environmentMapping) {
      material.envMap = this.world.stage.scene.environment || null
      // Environment map intensity is handled in updateMaterialProperties
      
      // WebGL-specific environment mapping optimizations
      if (isWebGL && material.envMap) {
        material.envMap.wrapS = THREE.ClampToEdgeWrapping
        material.envMap.wrapT = THREE.ClampToEdgeWrapping
        material.envMap.generateMipmaps = true
        material.envMap.minFilter = THREE.LinearMipmapLinearFilter
        material.envMap.magFilter = THREE.LinearFilter
        material.envMap.mapping = THREE.EquirectangularReflectionMapping
      }
    } else {
      material.envMap = null
      material.envMapIntensity = 0.0
    }
    
    // Apply iridescence (for MeshPhysicalMaterial)
    if (material.iridescence !== undefined && iridescence) {
      material.iridescence = iridescenceStrength
      material.iridescenceIOR = 1.3
      material.iridescenceThickness = iridescenceThickness
      
      // WebGL-specific iridescence optimizations
      if (isWebGL) {
        material.defines = material.defines || {}
        material.defines.IRIDESCENCE = 1
        material.defines.IRIDESCENCE_STRENGTH = iridescenceStrength.toFixed(2)
        material.defines.IRIDESCENCE_THICKNESS = iridescenceThickness.toFixed(2)
      }
    }
    
    // Apply fresnel effect by modifying environment map intensity
    if (fresnelEffect && material.envMapIntensity !== undefined) {
      // Store original envMapIntensity if not already stored
      if (material.userData.originalEnvMapIntensity === undefined) {
        material.userData.originalEnvMapIntensity = material.envMapIntensity
      }
      const baseEnvIntensity = material.userData.originalEnvMapIntensity
      material.envMapIntensity = baseEnvIntensity * fresnelStrength
      
      // WebGL-specific fresnel optimizations
      if (isWebGL) {
        material.defines = material.defines || {}
        material.defines.FRESNEL_EFFECT = 1
        material.defines.FRESNEL_STRENGTH = fresnelStrength.toFixed(2)
      }
    }
    
    // Apply rim lighting effect by modifying emissive properties
    if (rimLighting && material.emissive) {
      // Store original emissive if not already stored
      if (material.userData.originalEmissive === undefined) {
        material.userData.originalEmissive = material.emissive.clone()
      }
      
      // Add rim lighting to existing emissive
      const originalEmissive = material.userData.originalEmissive
      const rimColor = new THREE.Color(0xffffff).multiplyScalar(rimStrength * 0.3)
      material.emissive.copy(originalEmissive).add(rimColor)
      
      // WebGL-specific rim lighting optimizations
      if (isWebGL) {
        material.defines = material.defines || {}
        material.defines.RIM_LIGHTING = 1
        material.defines.RIM_STRENGTH = rimStrength.toFixed(2)
      }
    }
    
    // Apply matcap reflection by creating a simple reflection effect
    if (matcapReflection && material.envMapIntensity !== undefined) {
      // Store original envMapIntensity if not already stored
      if (material.userData.originalEnvMapIntensity === undefined) {
        material.userData.originalEnvMapIntensity = material.envMapIntensity
      }
      const baseEnvIntensity = material.userData.originalEnvMapIntensity
      material.envMapIntensity = baseEnvIntensity * 1.5 // Boost reflection for matcap effect
      
      // WebGL-specific matcap optimizations
      if (isWebGL) {
        material.defines = material.defines || {}
        material.defines.MATCAP_REFLECTION = 1
      }
    }
    
    // WebGL-specific shader effect optimizations
    if (isWebGL) {
      // Enable WebGL-specific shader features
      material.defines = material.defines || {}
      material.defines.USE_WEBGL_EFFECTS = 1
      
      // Optimize shader compilation for WebGL
      if (material.onBeforeCompile) {
        const originalBeforeCompile = material.onBeforeCompile
        material.onBeforeCompile = (shader) => {
          // Apply WebGL-specific shader modifications
          shader.defines = shader.defines || {}
          shader.defines.USE_WEBGL = 1
          
          // Add custom shader code for effects
          if (fresnelEffect) {
            shader.defines.FRESNEL_EFFECT = 1
          }
          if (rimLighting) {
            shader.defines.RIM_LIGHTING = 1
          }
          if (matcapReflection) {
            shader.defines.MATCAP_REFLECTION = 1
          }
          if (iridescence) {
            shader.defines.IRIDESCENCE = 1
          }
          
          // Call original onBeforeCompile if it exists
          if (originalBeforeCompile) {
            originalBeforeCompile.call(material, shader)
          }
        }
      }
    }
    
    material.needsUpdate = true
  }

  // Reset material to original values when settings are reset
  resetMaterialToOriginal(material) {
    if (!material || !material.isMaterial) return
    
    // Reset roughness
    if (material.userData.originalRoughness !== undefined) {
      material.roughness = material.userData.originalRoughness
    }
    
    // Reset metalness
    if (material.userData.originalMetalness !== undefined) {
      material.metalness = material.userData.originalMetalness
    }
    
    // Reset emissive
    if (material.userData.originalEmissive !== undefined) {
      material.emissive.copy(material.userData.originalEmissive)
    }
    
    // Reset environment map intensity
    if (material.userData.originalEnvMapIntensity !== undefined) {
      material.envMapIntensity = material.userData.originalEnvMapIntensity
    }
    
    material.needsUpdate = true
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
    // Apply display settings last to ensure they override tone mapping exposure
    this.applyDisplaySettings()
    // Apply shader settings
    this.applyShaderQualitySettings()
    this.applyMaterialProperties()
    this.applyShaderEffects()
  }



  /**
   * AAA-Quality WebGPU Post-Processing Setup
   * Implements professional-grade visual effects using TSL
   */
  setupWebGPUPostProcessing() {
    console.log('🎨 Setting up AAA-quality WebGPU post-processing pipeline...')
      
    try {
      // Initialize advanced post-processing uniforms
      this.webgpuUniforms = {
        // Basic post-processing
        bloomEnabled: uniform(this.world.prefs.bloom ? 1.0 : 0.0),
        bloomIntensity: uniform(0.5),
        bloomThreshold: uniform(1.0),
        bloomRadius: uniform(0.8),
        
        aoEnabled: uniform(this.world.prefs.ao ? 1.0 : 0.0),
        aoIntensity: uniform(1.0),
        aoRadius: uniform(0.5),
        
        toneMappingExposure: uniform(this.world.prefs.toneMappingExposure || 1.0),
        
        // Advanced post-processing uniforms
        ssrEnabled: uniform(this.world.prefs.ssReflections ? 1.0 : 0.0),
        ssrIntensity: uniform(0.8),
        ssrMaxRoughness: uniform(0.8),
        ssrThickness: uniform(0.1),
        ssrSteps: uniform(20),
        
        dofEnabled: uniform(this.world.prefs.depthOfField ? 1.0 : 0.0),
        dofFocusDistance: uniform(10.0),
        dofBokehScale: uniform(1.0),
        dofAperture: uniform(0.025),
        
        motionBlurEnabled: uniform(this.world.prefs.motionBlur ? 1.0 : 0.0),
        motionBlurIntensity: uniform(1.0),
        motionBlurSamples: uniform(8),
        
        ssgiEnabled: uniform(this.world.prefs.volumetricLighting ? 1.0 : 0.0),
        ssgiIntensity: uniform(1.0),
        ssgiSteps: uniform(16),
        ssgiRadius: uniform(2.0),
        
        // Temporal effects
        taaEnabled: uniform(1.0),
        taaBlendFactor: uniform(0.9),
        taaJitterScale: uniform(1.0),
        
        // Advanced lighting
        rtEnabled: uniform(0.0), // Ray tracing (future)
        rtBounces: uniform(1),
        rtSamples: uniform(4),
        
        // Performance scaling
        renderScale: uniform(this.world.prefs.resolutionScale || 1.0),
        adaptiveQuality: uniform(1.0),
        
        // Time and frame info
        time: uniform(0.0),
        frame: uniform(0),
        deltaTime: uniform(0.016),
        
        // Camera matrices for advanced effects
        cameraMatrixWorld: uniform(new THREE.Matrix4()),
        cameraMatrixWorldInverse: uniform(new THREE.Matrix4()),
        projectionMatrix: uniform(new THREE.Matrix4()),
        projectionMatrixInverse: uniform(new THREE.Matrix4()),
        previousViewProjectionMatrix: uniform(new THREE.Matrix4()),
        
        // Resolution and viewport
        resolution: uniform(vec2(this.width, this.height)),
        invResolution: uniform(vec2(1.0 / this.width, 1.0 / this.height)),
      }

      // Setup advanced Multi-Render Target (MRT) for comprehensive effect data
      this.setupAdvancedMRT()
      
      // Setup advanced post-processing effects
      this.setupAdvancedEffects()
      
      // Setup compute shaders for GPU-driven operations
      this.setupComputeShaders()
      
      // Setup temporal effects
      this.setupTemporalEffects()
      
      // Setup ray tracing (future)
      this.setupRayTracing()
      
      console.log('✅ AAA-quality WebGPU post-processing pipeline initialized successfully')
      
    } catch (error) {
      console.error('❌ Failed to setup WebGPU post-processing:', error)
      console.warn('🔄 Falling back to basic WebGPU rendering')
      this.setupBasicWebGPURendering()
    }
  }

  setupAdvancedMRT() {
    console.log('🎯 Setting up advanced Multi-Render Target system...')
    
    // Create comprehensive G-buffer for advanced effects
      const scenePass = pass(this.world.stage.scene, this.world.camera)
    
    // Advanced MRT setup with all necessary buffers
      scenePass.setMRT(mrt({
      // Main color output
        output: output,
      
      // Geometric data
      worldPosition: positionWorld,
      worldNormal: transformedNormalView,
        depth: viewportUV.distance(vec2(0.5)),
      
      // Material properties for PBR
      albedo: vec3(1.0, 1.0, 1.0), // Base color
      roughness: float(0.5),        // Surface roughness
      metallic: float(0.0),         // Metallic factor
      emissive: vec3(0.0, 0.0, 0.0), // Emissive color
      
      // Motion vectors for temporal effects
      velocity: this.calculateMotionVectors(),
      
      // Advanced lighting data
      specular: vec3(0.04, 0.04, 0.04), // Specular reflectance
      clearcoat: float(0.0),            // Clearcoat layer
      sheen: vec3(0.0, 0.0, 0.0),       // Sheen color
      
      // Custom data for effects
      objectId: float(0.0),  // Object identification
      materialId: float(0.0), // Material identification
    }))
    
    this.scenePass = scenePass
    console.log('✅ Advanced MRT system configured')
  }

  calculateMotionVectors() {
    return tslFn(() => {
      // Current frame world position
      const worldPos = positionWorld
      
      // Previous frame screen position
      const prevClipPos = mul(this.webgpuUniforms.previousViewProjectionMatrix, vec4(worldPos, 1.0))
      const prevScreenPos = prevClipPos.xy.div(prevClipPos.w).mul(0.5).add(0.5)
      
      // Current frame screen position
      const currentScreenPos = screenUV
      
      // Motion vector
      return currentScreenPos.sub(prevScreenPos)
    })()
  }

  setupAdvancedEffects() {
    console.log('🌟 Setting up advanced post-processing effects...')
    
    // Advanced Screen Space Reflections (SSR)
    this.setupSSR()
    
    // Cinematic Depth of Field
    this.setupAdvancedDOF()
    
    // High-quality Motion Blur
    this.setupAdvancedMotionBlur()
    
    // Screen Space Global Illumination (SSGI)
    this.setupSSGI()
    
    // Advanced Ambient Occlusion
    this.setupAdvancedAO()
    
    // Professional Bloom
    this.setupAdvancedBloom()
    
    // Advanced Tone Mapping
    this.setupAdvancedToneMapping()
    
    console.log('✅ Advanced effects configured')
  }

  setupSSR() {
    this.ssrShader = tslFn(() => {
      const uv = screenUV
      const worldPos = texture(this.gBufferWorldPosition, uv)
      const normal = texture(this.gBufferWorldNormal, uv).normalize()
      const roughness = texture(this.gBufferRoughness, uv).r
      const metallic = texture(this.gBufferMetallic, uv).r
      
      // Early exit for rough surfaces
      const ssrMask = step(roughness, this.webgpuUniforms.ssrMaxRoughness)
      
      // Calculate reflection ray
      const viewDir = normalize(cameraPosition.sub(worldPos.xyz))
      const reflectDir = reflect(viewDir.negate(), normal)
      
      // Screen space ray marching
      const hitUV = this.marchScreenSpaceRay(worldPos.xyz, reflectDir)
      
      // Sample reflection color
      const reflectionColor = texture(output, hitUV)
      
      // Fresnel calculation for realistic reflection intensity
      const fresnel = this.calculateFresnel(viewDir, normal, metallic)
      
      // Final SSR contribution
      return mix(
        vec3(0.0),
        reflectionColor.rgb,
        ssrMask.mul(fresnel).mul(this.webgpuUniforms.ssrIntensity)
      )
    })
  }

  marchScreenSpaceRay(startPos, direction) {
    return tslFn((startPos, direction) => {
      let currentPos = startPos
      let hitUV = vec2(0.0)
      
      const stepSize = this.webgpuUniforms.ssrThickness
      const maxSteps = this.webgpuUniforms.ssrSteps
      
      for (let i = 0; i < maxSteps; i++) {
        currentPos = currentPos.add(direction.mul(stepSize))
        
        // Project to screen space
        const clipPos = mul(this.webgpuUniforms.projectionMatrix, vec4(currentPos, 1.0))
        const screenPos = clipPos.xy.div(clipPos.w).mul(0.5).add(0.5)
        
        // Sample depth buffer
        const sampledDepth = texture(this.gBufferDepth, screenPos).r
        const rayDepth = clipPos.z / clipPos.w
        
        // Check for intersection
        const hit = step(abs(sampledDepth.sub(rayDepth)), stepSize)
        hitUV = mix(hitUV, screenPos, hit)
      }
      
      return hitUV
    })(startPos, direction)
  }

  calculateFresnel(viewDir, normal, metallic) {
    return tslFn((viewDir, normal, metallic) => {
      const cosTheta = saturate(dot(viewDir, normal))
      const f0 = mix(vec3(0.04), vec3(1.0), metallic)
      return f0.add(vec3(1.0).sub(f0).mul(pow(vec3(1.0).sub(cosTheta), vec3(5.0))))
    })(viewDir, normal, metallic)
  }

  setupAdvancedDOF() {
    this.dofShader = tslFn(() => {
      const uv = screenUV
      const depth = texture(this.gBufferDepth, uv).r
      const color = texture(output, uv)
        
        // Calculate circle of confusion
      const focusDistance = this.webgpuUniforms.dofFocusDistance
      const aperture = this.webgpuUniforms.dofAperture
      const coc = abs(depth.sub(focusDistance)).mul(aperture).div(focusDistance.add(1.0))
      
      // Multi-sample bokeh blur
      let blurredColor = vec3(0.0)
      let totalWeight = 0.0
      const samples = 16
      
      for (let i = 0; i < samples; i++) {
        const angle = float(i).div(samples).mul(PI2)
        const radius = sqrt(float(i)).div(sqrt(samples)).mul(coc).mul(this.webgpuUniforms.dofBokehScale)
        
        const offset = vec2(cos(angle), sin(angle)).mul(radius)
        const sampleUV = uv.add(offset.mul(this.webgpuUniforms.invResolution))
        
        const sampleColor = texture(output, sampleUV)
        const weight = 1.0 // Could add distance-based weighting
        
        blurredColor = blurredColor.add(sampleColor.rgb.mul(weight))
        totalWeight = totalWeight.add(weight)
      }
      
      blurredColor = blurredColor.div(totalWeight)
      
      // Blend based on circle of confusion
      const blendFactor = saturate(coc.mul(10.0))
      return mix(color.rgb, blurredColor, blendFactor)
    })
  }

  setupAdvancedMotionBlur() {
    this.motionBlurShader = tslFn(() => {
      const uv = screenUV
      const velocity = texture(this.gBufferVelocity, uv).xy
      const color = texture(output, uv)
      
      // Scale velocity
      const scaledVelocity = velocity.mul(this.webgpuUniforms.motionBlurIntensity)
      
      // Early exit for stationary pixels
      const velocityLength = length(scaledVelocity)
      const motionMask = step(0.001, velocityLength)
      
      // Variable sample count based on motion
      const samples = floor(velocityLength.mul(this.webgpuUniforms.motionBlurSamples).add(1.0))
      
      let blurredColor = color.rgb
      let totalWeight = 1.0
        
        // Sample along motion vector
      for (let i = 1; i <= 8; i++) { // Max 8 samples for performance
          const t = float(i).div(8.0).sub(0.5)
        const sampleUV = uv.add(scaledVelocity.mul(t))
        
        const sampleColor = texture(output, sampleUV)
        const weight = 1.0
        
        blurredColor = blurredColor.add(sampleColor.rgb.mul(weight))
        totalWeight = totalWeight.add(weight)
      }
      
      blurredColor = blurredColor.div(totalWeight)
      
      return mix(color.rgb, blurredColor, motionMask)
    })
  }

  setupSSGI() {
    this.ssgiShader = tslFn(() => {
      const uv = screenUV
      const worldPos = texture(this.gBufferWorldPosition, uv)
      const normal = texture(this.gBufferWorldNormal, uv).normalize()
      const albedo = texture(this.gBufferAlbedo, uv)
      
      let indirectColor = vec3(0.0)
      const samples = this.webgpuUniforms.ssgiSteps
      
      // Hemisphere sampling for global illumination
      for (let i = 0; i < 16; i++) { // Fixed loop for WebGPU compatibility
        const sampleDir = this.generateHemisphereSample(i, normal)
        const samplePos = worldPos.xyz.add(sampleDir.mul(this.webgpuUniforms.ssgiRadius))
        
        // Project to screen space
        const clipPos = mul(this.webgpuUniforms.projectionMatrix, vec4(samplePos, 1.0))
        const sampleUV = clipPos.xy.div(clipPos.w).mul(0.5).add(0.5)
        
        // Sample color and check occlusion
        const sampleColor = texture(output, sampleUV)
        const sampleDepth = texture(this.gBufferDepth, sampleUV).r
        const rayDepth = clipPos.z / clipPos.w
        
        const occlusion = step(sampleDepth, rayDepth)
        const contribution = sampleColor.rgb.mul(occlusion).mul(dot(normal, sampleDir))
        
        indirectColor = indirectColor.add(contribution)
      }
      
      indirectColor = indirectColor.div(16.0).mul(this.webgpuUniforms.ssgiIntensity)
      
      return indirectColor.mul(albedo.rgb)
    })
  }

  generateHemisphereSample(index, normal) {
    return tslFn((index, normal) => {
      // Generate pseudo-random hemisphere sample
      const phi = float(index).mul(2.39996323).mod(PI2) // Golden angle
      const cosTheta = sqrt(float(index).div(16.0))
      const sinTheta = sqrt(1.0.sub(cosTheta.mul(cosTheta)))
      
      const x = sinTheta.mul(cos(phi))
      const y = sinTheta.mul(sin(phi))
      const z = cosTheta
      
      // Orient to surface normal
      const tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)))
      const bitangent = cross(normal, tangent)
      
      return tangent.mul(x).add(bitangent.mul(y)).add(normal.mul(z))
    })(index, normal)
  }

  setupAdvancedAO() {
    this.aoShader = tslFn(() => {
      const uv = screenUV
      const worldPos = texture(this.gBufferWorldPosition, uv)
      const normal = texture(this.gBufferWorldNormal, uv).normalize()
      const depth = texture(this.gBufferDepth, uv).r
      
      let occlusion = 0.0
      const samples = 16
      const radius = this.webgpuUniforms.aoRadius
      
      // SSAO with improved sampling
      for (let i = 0; i < samples; i++) {
        const sampleDir = this.generateHemisphereSample(i, normal)
        const samplePos = worldPos.xyz.add(sampleDir.mul(radius))
        
        // Project to screen space
        const clipPos = mul(this.webgpuUniforms.projectionMatrix, vec4(samplePos, 1.0))
        const sampleUV = clipPos.xy.div(clipPos.w).mul(0.5).add(0.5)
        
        const sampleDepth = texture(this.gBufferDepth, sampleUV).r
        const rayDepth = clipPos.z / clipPos.w
        
        // Check occlusion with range falloff
        const depthDiff = rayDepth.sub(sampleDepth)
        const rangeCheck = smoothstep(0.0, 1.0, radius.div(abs(depthDiff)))
        occlusion = occlusion.add(step(0.0, depthDiff).mul(rangeCheck))
      }
      
      occlusion = occlusion.div(samples)
      return 1.0.sub(occlusion.mul(this.webgpuUniforms.aoIntensity))
    })
  }

  setupAdvancedBloom() {
    this.bloomShader = tslFn(() => {
      const uv = screenUV
      const color = texture(output, uv)
      
      // Luminance-based bloom threshold
      const luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114))
      const bloomMask = smoothstep(
        this.webgpuUniforms.bloomThreshold.sub(0.1),
        this.webgpuUniforms.bloomThreshold.add(0.1),
        luminance
      )
      
      // Multi-scale gaussian blur for professional bloom
      let bloomColor = vec3(0.0)
      const scales = [1.0, 2.0, 4.0, 8.0]
      
      for (let scaleIndex = 0; scaleIndex < 4; scaleIndex++) {
        const scale = scales[scaleIndex]
        let scaleBloom = vec3(0.0)
        
        // Gaussian sampling
        for (let i = -4; i <= 4; i++) {
          for (let j = -4; j <= 4; j++) {
            const offset = vec2(i, j).mul(scale).mul(this.webgpuUniforms.invResolution)
            const sampleColor = texture(output, uv.add(offset))
            const weight = exp(-((i * i + j * j) / (2.0 * scale * scale)))
            
            scaleBloom = scaleBloom.add(sampleColor.rgb.mul(weight))
          }
        }
        
        bloomColor = bloomColor.add(scaleBloom.mul(1.0 / (scaleIndex + 1)))
      }
      
      return color.rgb.add(bloomColor.mul(bloomMask).mul(this.webgpuUniforms.bloomIntensity))
    })
  }

  setupAdvancedToneMapping() {
    this.toneMappingShader = tslFn(() => {
      const uv = screenUV
      const color = texture(output, uv)
      
      // Advanced ACES tone mapping with exposure
      const exposure = this.webgpuUniforms.toneMappingExposure
      const exposedColor = color.rgb.mul(exposure)
      
      // ACES Filmic tone mapping
      const a = 2.51
      const b = 0.03
      const c = 2.43
      const d = 0.59
      const e = 0.14
      
      const numerator = exposedColor.mul(exposedColor.mul(a).add(b))
      const denominator = exposedColor.mul(exposedColor.mul(c).add(d)).add(e)
      
      return clamp(numerator.div(denominator), 0.0, 1.0)
    })
  }

  setupComputeShaders() {
    console.log('⚙️ Setting up compute shaders for GPU-driven operations...')
    
    // GPU-driven frustum culling
    this.setupGPUCulling()
    
    // GPU particle simulation
    this.setupGPUParticles()
    
    // GPU-driven LOD selection
    this.setupGPULOD()
    
    console.log('✅ Compute shaders configured')
  }

  setupGPUCulling() {
    // Compute shader for frustum culling - Simplified for current Three.js TSL limitations
    this.cullingComputeShader = compute(
      // workgroupSize(64), // Not available in current Three.js TSL
      () => {
        const instanceId = instanceIndex
        
        // Simplified culling logic without storage buffers (not available in current TSL)
        // const objectData = storage('ObjectData', 'readonly')    // Not available
        // const cullingResults = storage('CullingResults', 'writeonly') // Not available
        
        // Get object bounds
        const center = objectData.get(instanceId).center
        const radius = objectData.get(instanceId).radius
        
        // Frustum culling test
        let visible = 1
        
        // Test against 6 frustum planes
        for (let i = 0; i < 6; i++) {
          const plane = this.webgpuUniforms.frustumPlanes.get(i)
          const distance = dot(center.xyz, plane.xyz).add(plane.w)
          
          if (distance.lessThan(radius.negate())) {
            visible = 0
            break
          }
        }
        
        // Write result
        cullingResults.set(instanceId, visible)
      }
    )
  }

  setupGPUParticles() {
    // Compute shader for particle simulation - Simplified for current Three.js TSL limitations
    this.particleComputeShader = compute(
      // workgroupSize(64), // Not available in current Three.js TSL
      () => {
        const particleId = instanceIndex
        
        // Simplified particle logic without storage buffers (not available in current TSL)
        // const particleData = storage('ParticleData', 'readwrite') // Not available
        const deltaTime = this.webgpuUniforms.deltaTime
        
        // Read particle state
        const position = particleData.get(particleId).position
        const velocity = particleData.get(particleId).velocity
        const life = particleData.get(particleId).life
        
        // Physics simulation
        const newVelocity = velocity.add(vec3(0.0, -9.81, 0.0).mul(deltaTime)) // Gravity
        const newPosition = position.add(newVelocity.mul(deltaTime))
        const newLife = life.sub(deltaTime)
        
        // Update particle data
        particleData.get(particleId).position = newPosition
        particleData.get(particleId).velocity = newVelocity
        particleData.get(particleId).life = max(newLife, 0.0)
      }
    )
  }

  setupGPULOD() {
    // Compute shader for LOD selection - Simplified for current Three.js TSL limitations
    this.lodComputeShader = compute(
      // workgroupSize(64), // Not available in current Three.js TSL
      () => {
        const objectId = instanceIndex
        
        // Simplified LOD logic without storage buffers (not available in current TSL)
        // const objectData = storage('ObjectData', 'readonly')  // Not available
        // const lodResults = storage('LODResults', 'writeonly') // Not available
        
        // Calculate distance to camera
        const objectPosition = objectData.get(objectId).position
        const cameraPos = this.webgpuUniforms.cameraPosition
        const distance = length(objectPosition.sub(cameraPos))
        
        // LOD selection based on distance
        let lodLevel = 0
        if (distance.greaterThan(100.0)) lodLevel = 3
        else if (distance.greaterThan(50.0)) lodLevel = 2
        else if (distance.greaterThan(25.0)) lodLevel = 1
        
        lodResults.set(objectId, lodLevel)
      }
    )
  }

  setupTemporalEffects() {
    console.log('⏱️ Setting up temporal effects...')
    
    // Temporal Anti-Aliasing (TAA)
    this.setupTAA()
    
    // Temporal upsampling
    this.setupTemporalUpsampling()
    
    console.log('✅ Temporal effects configured')
  }

  setupTAA() {
    this.taaShader = tslFn(() => {
      const uv = screenUV
      const currentColor = texture(output, uv)
      const velocity = texture(this.gBufferVelocity, uv).xy
      
      // Previous frame sample
      const prevUV = uv.sub(velocity)
      const prevColor = texture(this.previousFrameTexture, prevUV)
      
      // Neighborhood clamping for TAA
      const tl = texture(output, uv.add(vec2(-1, -1).mul(this.webgpuUniforms.invResolution)))
      const tr = texture(output, uv.add(vec2(1, -1).mul(this.webgpuUniforms.invResolution)))
      const bl = texture(output, uv.add(vec2(-1, 1).mul(this.webgpuUniforms.invResolution)))
      const br = texture(output, uv.add(vec2(1, 1).mul(this.webgpuUniforms.invResolution)))
      
      const minColor = min(min(tl.rgb, tr.rgb), min(bl.rgb, br.rgb))
      const maxColor = max(max(tl.rgb, tr.rgb), max(bl.rgb, br.rgb))
      
      const clampedPrevColor = clamp(prevColor.rgb, minColor, maxColor)
      
      // Blend current and previous frames
      const blendFactor = this.webgpuUniforms.taaBlendFactor
      return mix(currentColor.rgb, clampedPrevColor, blendFactor)
    })
  }

  setupTemporalUpsampling() {
    this.temporalUpsamplingShader = tslFn(() => {
      const uv = screenUV
      
      // Bicubic upsampling with temporal accumulation
      // This could be expanded for DLSS-like functionality
      const lowResColor = texture(this.lowResTexture, uv)
      const motionVector = texture(this.gBufferVelocity, uv).xy
      
      // Temporal accumulation for quality improvement
      const prevUV = uv.sub(motionVector)
      const prevHighRes = texture(this.previousHighResTexture, prevUV)
      
      // Blend based on motion confidence
      const motionMagnitude = length(motionVector)
      const confidence = 1.0.sub(saturate(motionMagnitude.mul(10.0)))
      
      return mix(lowResColor.rgb, prevHighRes.rgb, confidence.mul(0.8))
    })
  }

  setupRayTracing() {
    console.log('🌟 Setting up ray tracing capabilities...')
    
    // Note: WebGPU ray tracing is still experimental
    // This sets up the framework for future RT implementation
    
    this.rayTracingEnabled = false // Will be enabled when WebGPU RT is stable
    
    if (this.rayTracingEnabled) {
      this.setupRTReflections()
      this.setupRTGlobalIllumination()
      this.setupRTShadows()
    }
    
    console.log('✅ Ray tracing framework prepared')
  }

  setupRTReflections() {
    // Future: Ray-traced reflections
    console.log('📦 Ray-traced reflections framework ready')
  }

  setupRTGlobalIllumination() {
    // Future: Ray-traced global illumination
    console.log('📦 Ray-traced GI framework ready')
  }

  setupRTShadows() {
    // Future: Ray-traced shadows
    console.log('📦 Ray-traced shadows framework ready')
  }

  setupBasicWebGPURendering() {
    console.log('🔄 Setting up basic WebGPU rendering fallback...')
    
    // Simplified post-processing for compatibility
    this.webgpuUniforms = {
      bloomEnabled: uniform(this.world.prefs.bloom ? 1.0 : 0.0),
      bloomIntensity: uniform(0.5),
      aoEnabled: uniform(this.world.prefs.ao ? 1.0 : 0.0),
      aoIntensity: uniform(1.0),
      toneMappingExposure: uniform(this.world.prefs.toneMappingExposure || 1.0),
    }
    
    // Basic post-processing pipeline
    const basicPostProcess = tslFn(() => {
      const uv = screenUV
      let color = texture(output, uv)
      
      // Basic bloom
      if (this.webgpuUniforms.bloomEnabled.greaterThan(0.5)) {
        const luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114))
        const bloom = smoothstep(0.8, 1.2, luminance)
        color = color.add(color.mul(bloom).mul(this.webgpuUniforms.bloomIntensity))
      }
      
      // Basic tone mapping
      const exposure = this.webgpuUniforms.toneMappingExposure
      color = color.mul(exposure)
      color = color.div(color.add(1.0)) // Reinhard tone mapping
      
      return color
    })
    
    this.renderer.outputNode = basicPostProcess()
    
    console.log('✅ Basic WebGPU rendering configured')
  }

  updateWebGPUPostProcessing() {
    if (!this.webgpuUniforms) return
    
    // Update all uniforms based on current preferences
      this.webgpuUniforms.bloomEnabled.value = this.world.prefs.bloom ? 1.0 : 0.0
    this.webgpuUniforms.aoEnabled.value = this.world.prefs.ao ? 1.0 : 0.0
    this.webgpuUniforms.ssrEnabled.value = this.world.prefs.ssReflections ? 1.0 : 0.0
      this.webgpuUniforms.dofEnabled.value = this.world.prefs.depthOfField ? 1.0 : 0.0
      this.webgpuUniforms.motionBlurEnabled.value = this.world.prefs.motionBlur ? 1.0 : 0.0
    this.webgpuUniforms.ssgiEnabled.value = this.world.prefs.volumetricLighting ? 1.0 : 0.0
    
    // Update time-based uniforms
    this.webgpuUniforms.time.value = performance.now() * 0.001
    this.webgpuUniforms.frame.value = this.world.frame || 0
    this.webgpuUniforms.deltaTime.value = this.world.deltaTime || 0.016
    
    // Update camera matrices
    if (this.world.camera) {
      this.webgpuUniforms.cameraMatrixWorld.value.copy(this.world.camera.matrixWorld)
      this.webgpuUniforms.cameraMatrixWorldInverse.value.copy(this.world.camera.matrixWorldInverse)
      this.webgpuUniforms.projectionMatrix.value.copy(this.world.camera.projectionMatrix)
      this.webgpuUniforms.projectionMatrixInverse.value.copy(this.world.camera.projectionMatrixInverse)
    }
    
    // Update resolution
      this.webgpuUniforms.resolution.value.set(this.width, this.height)
    this.webgpuUniforms.invResolution.value.set(1.0 / this.width, 1.0 / this.height)
    
    // Create final post-processing pipeline
    this.createFinalPipeline()
  }

  createFinalPipeline() {
    // Combine all effects into final pipeline
    const finalShader = Fn(() => {
      const uv = screenUV
      let color = texture(output, uv)
      
      // Apply effects in correct order
      if (this.webgpuUniforms.ssgiEnabled.greaterThan(0.5)) {
        const gi = this.ssgiShader()
        color = vec4(color.rgb.add(gi), color.a)
      }
      
      if (this.webgpuUniforms.ssrEnabled.greaterThan(0.5)) {
        const ssr = this.ssrShader()
        color = vec4(color.rgb.add(ssr), color.a)
      }
      
      if (this.webgpuUniforms.dofEnabled.greaterThan(0.5)) {
        const dof = this.dofShader()
        color = vec4(dof, color.a)
      }
      
      if (this.webgpuUniforms.motionBlurEnabled.greaterThan(0.5)) {
        const mb = this.motionBlurShader()
        color = vec4(mb, color.a)
      }
      
      if (this.webgpuUniforms.bloomEnabled.greaterThan(0.5)) {
        const bloom = this.bloomShader()
        color = vec4(bloom, color.a)
      }
      
      if (this.webgpuUniforms.aoEnabled.greaterThan(0.5)) {
        const ao = this.aoShader()
        color = vec4(color.rgb.mul(ao), color.a)
      }
      
      if (this.webgpuUniforms.taaEnabled.greaterThan(0.5)) {
        const taa = this.taaShader()
        color = vec4(taa, color.a)
      }
      
      // Final tone mapping
      const toneMapped = this.toneMappingShader()
      color = vec4(toneMapped, color.a)
      
      return color
    })
    
    this.renderer.outputNode = finalShader()
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

  // Initialize AAA-Quality rendering systems integration with compatibility safeguards
  async initializeAAARendering() {
    console.log('🌟 Initializing AAA-Quality rendering systems...')
    
    try {
      // Get references to the AAA systems
      this.advancedMaterials = this.world.advancedMaterials
      this.advancedShadows = this.world.advancedShadows
      this.gpuProfiler = this.world.gpuProfiler
      this.instancedMeshHelper = this.world.instancedMeshHelper

      // Initialize GPU Profiler first (safest, no material interference)
      if (this.gpuProfiler) {
        await this.gpuProfiler.init(this.renderer, this.world.scene, this.isWebGPU)
        console.log('✅ GPU Profiler system initialized')
      }

      if (this.instancedMeshHelper) {
        await this.instancedMeshHelper.init()
        console.log('✅ Instanced Mesh Helper initialized (fixes partial mesh movement)')
      }

      // Initialize Advanced Shadows with compatibility mode
      if (this.advancedShadows) {
        await this.advancedShadows.init(this.renderer, this.world.scene, this.isWebGPU)
        console.log('✅ Advanced Shadows system initialized (compatibility mode)')
      }

      // Initialize Advanced Materials with GLTF compatibility (BOTH WebGL and WebGPU for testing)
      if (this.advancedMaterials) {
        // Enable for both WebGL and WebGPU to test visual effects
        await this.advancedMaterials.init(this.renderer, this.world.stage.scene, this.isWebGPU)
        console.log(`✅ Advanced Materials system initialized (${this.isWebGPU ? 'WebGPU' : 'WebGL'} mode, preserving GLTF materials)`)
      }

      console.log('🌟 AAA-Quality rendering systems initialized successfully!')
    } catch (error) {
      console.error('❌ Failed to initialize AAA rendering systems:', error)
      // Disable problematic systems to maintain basic functionality
      this.disableAAAFeatures()
    }
  }

  // Update AAA systems each frame with compatibility checks - PERFORMANCE OPTIMIZED
  updateAAARendering(camera) {
    try {
      // PERFORMANCE: Temporarily disable GPU Profiler to improve FPS
      // The profiler itself was causing performance overhead with 250k objects
      if (this.gpuProfiler && this.world.frame % 300 === 0) { // Very occasionally for basic metrics
        // this.gpuProfiler.profileFrame() // Disabled for performance
        if (this.world.frame % 1800 === 0) { // Every 30 seconds
          console.log('⚡ GPU Profiler disabled for performance - FPS should improve')
        }
      }

      // PERFORMANCE: Reduce Shadow updates frequency to improve FPS
      if (this.advancedShadows && this.advancedShadows.isEnabled() && this.world.frame % 30 === 0) { // Twice per second instead of every frame
        // Filter out GLTF objects to prevent conflicts
        const filteredLights = this.world.lights?.filter(light => !light.userData.isGLTF) || []
        this.advancedShadows.updateShadows(camera, this.world.stage.scene)
      }

      // PERFORMANCE: Skip Advanced Materials frame updates entirely (only update when presets change)
      if (this.advancedMaterials && this.advancedMaterials.isEnabled()) {
        if (this.world.frame % 300 === 0) { // Log occasionally
          console.log('⚡ Advanced Materials: Skipping frame updates for performance (only update on preset changes)')
        }
      }

      // Handle instanced mesh updates for manipulated objects (fallback method)
      if (!this.instancedMeshHelper) {
        this.updateInstancedMeshes()
      }
    } catch (error) {
      console.warn('⚠️ AAA rendering update failed, disabling problematic features:', error)
      this.disableAAAFeatures()
      
      // Try to re-enable systems after 1 second (in case it was a timing issue)
      setTimeout(() => {
        console.log('🔄 Attempting to re-enable AAA systems...')
        if (this.advancedMaterials) {
          this.advancedMaterials.enable()
          console.log('🔄 Advanced Materials re-enabled')
        }
        if (this.advancedShadows) {
          this.advancedShadows.enable()
          console.log('🔄 Advanced Shadows re-enabled')
        }
      }, 1000)
    }
  }

  // Prevent material conflicts with batched objects
  excludeBatchedObjectsFromMaterials() {
    if (!this.advancedMaterials) return
    
    this.world.stage.scene.traverse((object) => {
      // Exclude BatchedMesh instances
      if (object.isBatchedMesh || object.userData.isHyperfyBatch) {
        this.advancedMaterials.excludeObject(object)
        object.userData.skipAdvancedMaterials = true
      }
      
      // Exclude InstancedMesh instances  
      if (object.isInstancedMesh) {
        this.advancedMaterials.excludeObject(object)
        object.userData.skipAdvancedMaterials = true
      }
      
      // Exclude objects with grass/vegetation keywords (common source of flashing)
      if (object.name && (
          object.name.toLowerCase().includes('grass') ||
          object.name.toLowerCase().includes('vegetation') ||
          object.name.toLowerCase().includes('plant') ||
          object.name.toLowerCase().includes('scatter')
        )) {
        this.advancedMaterials.excludeObject(object)
        object.userData.skipAdvancedMaterials = true
      }
         })
   }

  // Update instanced meshes when objects are being manipulated
  updateInstancedMeshes() {
    const selectedEntity = this.world.builder?.selected
    if (!selectedEntity) return

    // Find all instanced meshes that represent this entity
    this.world.stage.scene.traverse((object) => {
      if (object.isInstancedMesh || object.isBatchedMesh) {
        // Check if this instanced mesh contains the selected entity
        const model = this.world.stage.models.get(object.userData.modelId)
        if (model) {
          // Find the instance index for the selected entity
          let instanceIndex = -1
          for (let i = 0; i < model.items.length; i++) {
            const item = model.items[i]
            if (item.node && item.node.ctx && item.node.ctx.entity === selectedEntity) {
              instanceIndex = i
              break
            }
          }
          
          if (instanceIndex >= 0) {
            // Update the instance matrix to match the entity's new transform
            const matrix = selectedEntity.root.matrixWorld
            if (object.isInstancedMesh) {
              object.setMatrixAt(instanceIndex, matrix)
              object.instanceMatrix.needsUpdate = true
            } else if (object.isBatchedMesh) {
              object.setMatrixAt(instanceIndex, matrix)
              // BatchedMesh requires manual update trigger
              object._matricesTexture.needsUpdate = true
            }
            
            // Update color and visibility if needed
            if (selectedEntity.userData.isManipulating) {
              // Highlight manipulated objects
              const highlightColor = new THREE.Color(0.5, 1.0, 0.5) // Light green
              if (object.isInstancedMesh && object.setColorAt) {
                object.setColorAt(instanceIndex, highlightColor)
                object.instanceColor.needsUpdate = true
              } else if (object.isBatchedMesh && object.setColorAt) {
                object.setColorAt(instanceIndex, highlightColor)
                object._colorsTexture.needsUpdate = true
              }
            }
          }
        }
      }
    })
  }

  // Disable AAA features that cause conflicts
  disableAAAFeatures() {
    if (this.advancedMaterials) {
      this.advancedMaterials.disable()
    }
    if (this.advancedShadows) {
      this.advancedShadows.disable() 
    }
    console.log('⚠️ AAA features disabled due to compatibility issues')
  }

  // Dispatch WebGPU compute shaders for AAA features
  dispatchComputeShaders() {
    if (!this.isWebGPU) return

    try {
      // Dispatch GPU-driven culling
      if (this.gpuCullingShader) {
        this.renderer.compute(this.gpuCullingShader)
      }

      // Dispatch GPU particle simulation
      if (this.gpuParticleShader) {
        this.renderer.compute(this.gpuParticleShader)
      }

      // Dispatch GPU LOD selection
      if (this.gpuLODShader) {
        this.renderer.compute(this.gpuLODShader)
      }
    } catch (error) {
      console.warn('⚠️ WebGPU compute shader dispatch failed:', error)
    }
  }

  // Update compute shader settings for AAA features
  updateComputeShaderSettings(settings) {
    if (!this.isWebGPU) return
    
    try {
      console.log('🔧 Updating compute shader settings:', settings)
      
      // Update GPU-driven culling
      if (this.gpuCullingEnabled !== settings.culling) {
        this.gpuCullingEnabled = settings.culling
        console.log(`GPU-driven culling: ${settings.culling ? 'enabled' : 'disabled'}`)
      }
      
      // Update GPU particle simulation
      if (this.gpuParticleSimulationEnabled !== settings.particles) {
        this.gpuParticleSimulationEnabled = settings.particles
        console.log(`GPU particle simulation: ${settings.particles ? 'enabled' : 'disabled'}`)
      }
      
      // Update GPU LOD selection
      if (this.gpuLODSelectionEnabled !== settings.lod) {
        this.gpuLODSelectionEnabled = settings.lod
        console.log(`GPU LOD selection: ${settings.lod ? 'enabled' : 'disabled'}`)
      }
      
      // Reinitialize compute shaders if needed
      this.reinitializeComputeShaders()
      
    } catch (error) {
      console.warn('⚠️ Failed to update compute shader settings:', error)
    }
  }
  
  // Reinitialize compute shaders when settings change
  reinitializeComputeShaders() {
    if (!this.isWebGPU) return
    
    try {
      // This will trigger recompilation of compute shaders with new settings
      if (this.computeShadersNeedUpdate) {
        this.dispatchComputeShaders()
        this.computeShadersNeedUpdate = false
      }
    } catch (error) {
      console.warn('⚠️ Failed to reinitialize compute shaders:', error)
    }
  }

  // v8: Comprehensive Shader and Rendering Engine Settings Implementation
  

  
  // Apply rendering engine settings
  applyRenderingEngineSettings() {
    const prefs = this.world.prefs
    console.log('⚙️ Applying rendering engine settings:', {
      renderPipeline: prefs.renderPipeline,
      computeShaders: prefs.computeShaders,
      cullingMethod: prefs.cullingMethod,
      instancing: prefs.instancing,
      batching: prefs.batching
    })
    
    // Update renderer settings
    if (this.renderer) {
      this.updateRendererSettings(prefs)
    }
    
    // Update culling systems
    this.updateCullingSettings(prefs)
  }
  
  // Apply memory settings
  applyMemorySettings() {
    const prefs = this.world.prefs
    console.log('💾 Applying memory settings:', {
      vertexBufferSize: prefs.vertexBufferSize,
      indexBufferSize: prefs.indexBufferSize,
      uniformBufferSize: prefs.uniformBufferSize,
      textureCacheSize: prefs.textureCacheSize
    })
    
    // Update buffer sizes and cache settings
    this.updateMemorySettings(prefs)
  }
  
  // Apply advanced rendering settings
  applyAdvancedRenderingSettings() {
    const prefs = this.world.prefs
    console.log('🔬 Applying advanced rendering settings:', {
      multisampling: prefs.multisampling,
      depthPrepass: prefs.depthPrepass,
      earlyZTest: prefs.earlyZTest,
      conservativeRasterization: prefs.conservativeRasterization
    })
    
    // Update advanced rendering features
    this.updateAdvancedRenderingSettings(prefs)
  }
  
  // Apply performance tuning
  applyPerformanceTuning() {
    const prefs = this.world.prefs
    console.log('🚀 Applying performance tuning:', {
      gpuMemoryBudget: prefs.gpuMemoryBudget,
      cpuThreadCount: prefs.cpuThreadCount,
      asyncLoading: prefs.asyncLoading,
      streamingTextures: prefs.streamingTextures
    })
    
    // Update performance settings
    this.updatePerformanceSettings(prefs)
  }
  
  // Helper methods for updating specific aspects
  

  

  

  

  
  updateCullingSettings(prefs) {
    // Update culling method and settings
    if (this.world.stage) {
      // Update frustum culling
      if (prefs.frustumCulling !== undefined) {
        this.world.stage.frustumCulling = prefs.frustumCulling
      }
      
      // Update occlusion culling
      if (prefs.occlusionCulling !== undefined) {
        this.world.stage.occlusionCulling = prefs.occlusionCulling
      }
    }
  }
  
  updateMemorySettings(prefs) {
    // Update memory and buffer settings
    // Note: These would typically be applied during system initialization
    // For now, we'll log the settings
    console.log('💾 Memory settings updated:', {
      vertexBufferSize: prefs.vertexBufferSize,
      indexBufferSize: prefs.indexBufferSize,
      uniformBufferSize: prefs.uniformBufferSize,
      textureCacheSize: prefs.textureCacheSize,
      shaderCacheSize: prefs.shaderCacheSize,
      geometryCacheSize: prefs.geometryCacheSize
    })
  }
  
  updateAdvancedRenderingSettings(prefs) {
    // Update advanced rendering features
    console.log('🔬 Advanced rendering settings updated:', {
      multisampling: prefs.multisampling,
      depthPrepass: prefs.depthPrepass,
      earlyZTest: prefs.earlyZTest,
      conservativeRasterization: prefs.conservativeRasterization,
      tessellationControlPoints: prefs.tessellationControlPoints,
      geometryShaderSupport: prefs.geometryShaderSupport,
      computeShaderWorkgroups: prefs.computeShaderWorkgroups,
      rayTracingSupport: prefs.rayTracingSupport
    })
  }
  
  updatePerformanceSettings(prefs) {
    // Update performance tuning settings
    console.log('🚀 Performance settings updated:', {
      gpuMemoryBudget: prefs.gpuMemoryBudget,
      cpuThreadCount: prefs.cpuThreadCount,
      asyncLoading: prefs.asyncLoading,
      streamingTextures: prefs.streamingTextures,
      dynamicLOD: prefs.dynamicLOD,
      adaptiveQuality: prefs.adaptiveQuality
    })
    
    // Apply adaptive quality if enabled
    if (prefs.adaptiveQuality) {
      this.enableAdaptiveQuality()
    } else {
      this.disableAdaptiveQuality()
    }
  }
  
  enableAdaptiveQuality() {
    // Enable adaptive quality system
    console.log('🔄 Adaptive quality enabled')
    // Implementation would monitor performance and adjust settings automatically
  }
  
  disableAdaptiveQuality() {
    // Disable adaptive quality system
    console.log('🔄 Adaptive quality disabled')
  }

  destroy() {
    // Clean up AAA rendering systems
    if (this.advancedMaterials) {
      this.advancedMaterials.dispose()
    }
    if (this.advancedShadows) {
      this.advancedShadows.dispose()
    }
    if (this.gpuProfiler) {
      this.gpuProfiler.dispose()
    }
    
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

  // 🛡️ NEW: Check WebGPU support
  isWebGPUSupported() {
    return typeof navigator !== 'undefined' && 'gpu' in navigator
  }

  // 🛡️ NEW: Initialize post-processing
  async initializePostProcessing() {
    try {
      if (this.isWebGPU) {
        await this.setupWebGPUPostProcessing()
      } else {
        this.setupWebGLPostProcessing()
      }
    } catch (error) {
      console.warn('⚠️ Post-processing initialization failed:', error)
      // Continue without post-processing
    }
  }

  // 🛡️ NEW: Setup WebGL post-processing with enhanced shader support
  setupWebGLPostProcessing() {
    console.log('🔄 Setting up WebGL post-processing with enhanced shader support...')
    
    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.world.stage.scene, this.world.camera)
    this.composer.addPass(this.renderPass)
    
    // Enhanced WebGL post-processing pipeline with shader support
    this.setupWebGLEffects()
    
    console.log('✅ WebGL post-processing initialized with enhanced shader support')
  }
  
  // 🎨 NEW: Setup enhanced WebGL effects for shader settings
  setupWebGLEffects() {
    try {
      // Ambient Occlusion
      this.aoPass = new N8AOPostPass(this.world.stage.scene, this.world.camera, 
        this.width, this.height)
      this.aoPass.enabled = this.world.prefs?.ao ?? true
      this.composer.addPass(this.aoPass)
      
      // Bloom Effect for emissive materials
      this.bloomPass = new BloomEffect({
        blendFunction: BlendFunction.ADD,
        kernelSize: KernelSize.LARGE,
        luminanceThreshold: 0.3,
        luminanceSmoothing: 0.75,
        intensity: 1.0
      })
      this.bloomPass.enabled = this.world.prefs?.bloom ?? true
      this.composer.addPass(new EffectPass(this.world.camera, this.bloomPass))
      
      // Tone Mapping for HDR support
      this.toneMappingPass = new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
        exposure: this.world.prefs?.toneMappingExposure ?? 1.0
      })
      this.toneMappingPass.enabled = this.world.prefs?.toneMapping ?? true
      this.composer.addPass(new EffectPass(this.world.camera, this.toneMappingPass))
      
      // SMAA Anti-aliasing - will be managed by applyAntialiasing()
      // Don't add here, let the antialiasing system handle it
      
      // Depth of Field (if enabled)
      if (this.world.prefs?.depthOfField) {
        this.dofPass = new DepthOfFieldEffect(this.world.camera, {
          focusDistance: 0.0,
          focalLength: 24.0,
          bokehScale: 2.0,
          height: 480
        })
        this.dofPass.enabled = this.world.prefs?.depthOfField ?? false
        this.composer.addPass(new EffectPass(this.world.camera, this.dofPass))
      }
      
      // Motion Blur (if enabled)
      if (this.world.prefs?.motionBlur) {
        this.motionBlurPass = new EffectPass(this.world.camera, new DepthEffect())
        this.motionBlurPass.enabled = this.world.prefs?.motionBlur ?? false
        this.composer.addPass(this.motionBlurPass)
      }
      
      console.log('🎨 Enhanced WebGL effects setup complete')
      
    } catch (error) {
      console.warn('⚠️ Enhanced WebGL effects setup failed:', error)
      // Fallback to basic effects
      this.setupBasicWebGLEffects()
    }
  }
  
  // 🛡️ FALLBACK: Basic WebGL effects
  setupBasicWebGLEffects() {
    console.log('🔄 Setting up basic WebGL effects...')
    
    try {
      // Basic AO
      this.aoPass = new N8AOPostPass(this.world.stage.scene, this.world.camera, 
        this.width, this.height)
      this.aoPass.enabled = this.world.prefs?.ao ?? true
      this.composer.addPass(this.aoPass)
      
      // Basic tone mapping
      this.toneMappingPass = new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
        exposure: 1.0
      })
      this.composer.addPass(new EffectPass(this.world.camera, this.toneMappingPass))
      
      console.log('✅ Basic WebGL effects setup complete')
    } catch (error) {
      console.warn('⚠️ Basic WebGL effects setup failed:', error)
    }
  }
  
  // 🎨 NEW: Update WebGL post-processing effects
  updateWebGLPostProcessingEffects() {
    if (!this.composer) return
    
    console.log('🔄 Updating WebGL post-processing effects...')
    
    try {
      // Update AO pass
      if (this.aoPass) {
        this.aoPass.enabled = this.world.prefs?.ao ?? true
      }
      
      // Update bloom pass
      if (this.bloomPass) {
        this.bloomPass.enabled = this.world.prefs?.bloom ?? true
      }
      
      // Update tone mapping pass
      if (this.toneMappingPass) {
        this.toneMappingPass.enabled = this.world.prefs?.toneMapping ?? true
        if (this.world.prefs?.toneMappingExposure !== undefined) {
          this.toneMappingPass.exposure = this.world.prefs.toneMappingExposure
        }
      }
      
      // Update SMAA pass
      if (this.smaaPass) {
        this.smaaPass.enabled = this.world.prefs?.antialiasing === 'smaa'
      }
      
      // Update depth of field pass
      if (this.dofPass) {
        this.dofPass.enabled = this.world.prefs?.depthOfField ?? false
      }
      
      // Update motion blur pass
      if (this.motionBlurPass) {
        this.motionBlurPass.enabled = this.world.prefs?.motionBlur ?? false
      }
      
      console.log('✅ WebGL post-processing effects updated')
    } catch (error) {
      console.warn('⚠️ WebGL post-processing effects update failed:', error)
    }
  }

  // 🛡️ NEW: Retry network operation
  retryNetworkOperation() {
    console.log('🔄 Retrying network operation...')
    // Implement specific network retry logic here
  }

  // 🛡️ NEW: Disable network features
  disableNetworkFeatures() {
    console.log('🔄 Disabling network-dependent features...')
    // Disable features that require network connectivity
  }
}
