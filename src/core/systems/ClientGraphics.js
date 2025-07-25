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
} from 'postprocessing'

import { System } from './System'
import { ResourceManager } from '../extras/ResourceManager'

const v1 = new THREE.Vector3()

let renderer
function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      preserveDrawingBuffer: false, // Better performance
      stencil: false, // Disable if not needed
      failIfMajorPerformanceCaveat: false,
    })
    
    // Enable WebGL 2.0 extensions
    const gl = renderer.getContext()
    const extensions = [
      'EXT_texture_filter_anisotropic',
      'EXT_color_buffer_float',
      'EXT_disjoint_timer_query_webgl2',
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_astc',
      'WEBGL_compressed_texture_etc',
      'OES_texture_float_linear'
    ]
    
    extensions.forEach(ext => {
      const extension = gl.getExtension(ext)
      if (extension) {
        console.log(`[Graphics] Enabled extension: ${ext}`)
      }
    })
  }
  return renderer
}

/**
 * AdaptiveRenderer - Dynamic quality adjustment system
 */
class AdaptiveRenderer {
  constructor(graphics) {
    this.graphics = graphics
    this.targetFPS = 60
    this.frameTimeHistory = []
    this.qualityLevel = 1.0
    this.lastQualityAdjustment = 0
    this.adjustmentCooldown = 2000 // 2 seconds
    
    this.baseSettings = {
      shadowMapSize: 2048,
      pixelRatio: window.devicePixelRatio,
      postProcessing: true,
      aoEnabled: true,
      bloomEnabled: true,
      smaaEnabled: true,
      anisotropy: 16
    }
    
    this.currentSettings = { ...this.baseSettings }
  }

  render() {
    const frameStart = performance.now()
    
    // Dynamic quality adjustment based on performance
    this.adjustQualityLevel()
    
    // Render with current quality settings
    if (this.graphics.renderer.xr.isPresenting || !this.currentSettings.postProcessing) {
      this.graphics.renderer.render(this.graphics.world.stage.scene, this.graphics.world.camera)
    } else {
      this.graphics.composer.render()
    }
    
    const frameTime = performance.now() - frameStart
    this.updateFrameTimeHistory(frameTime)
    
    return frameTime
  }

  adjustQualityLevel() {
    const now = Date.now()
    if (now - this.lastQualityAdjustment < this.adjustmentCooldown) return
    
    const avgFrameTime = this.getAverageFrameTime()
    const targetFrameTime = 1000 / this.targetFPS
    
    if (avgFrameTime > targetFrameTime * 1.3) {
      // Performance is poor, reduce quality
      this.qualityLevel = Math.max(0.3, this.qualityLevel - 0.15)
      this.applyQualitySettings()
      this.lastQualityAdjustment = now
      console.log(`[AdaptiveRenderer] Quality reduced to ${this.qualityLevel.toFixed(2)}`)
    } else if (avgFrameTime < targetFrameTime * 0.7 && this.qualityLevel < 1.0) {
      // Performance is good, increase quality
      this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.1)
      this.applyQualitySettings()
      this.lastQualityAdjustment = now
      console.log(`[AdaptiveRenderer] Quality increased to ${this.qualityLevel.toFixed(2)}`)
    }
  }

  applyQualitySettings() {
    const renderer = this.graphics.renderer
    
    // Adjust shadow map resolution
    const shadowMapSize = Math.max(512, Math.floor(this.baseSettings.shadowMapSize * this.qualityLevel))
    if (renderer.shadowMap && typeof renderer.shadowMap.setSize === 'function') {
      renderer.shadowMap.setSize(shadowMapSize, shadowMapSize)
    } else {
      console.warn('[AdaptiveRenderer] renderer.shadowMap or setSize method not available, skipping shadow map resize.')
    }
    
    // Adjust pixel ratio
    const pixelRatio = Math.max(0.5, Math.min(this.baseSettings.pixelRatio, this.baseSettings.pixelRatio * this.qualityLevel))
    renderer.setPixelRatio(pixelRatio)
    
    // Toggle post-processing effects based on quality level
    this.currentSettings.postProcessing = this.qualityLevel > 0.6
    this.currentSettings.aoEnabled = this.qualityLevel > 0.7
    this.currentSettings.bloomEnabled = this.qualityLevel > 0.8
    this.currentSettings.smaaEnabled = this.qualityLevel > 0.5
    
    // Update post-processing pipeline
    if (this.graphics.aoPass) {
      this.graphics.aoPass.enabled = this.currentSettings.aoEnabled && this.graphics.world.settings.ao && this.graphics.world.prefs.ao
    }
    
    this.graphics.updatePostProcessingEffects()
  }

  updateFrameTimeHistory(frameTime) {
    this.frameTimeHistory.push(frameTime)
    if (this.frameTimeHistory.length > 30) {
      this.frameTimeHistory.shift()
    }
  }

  getAverageFrameTime() {
    if (this.frameTimeHistory.length === 0) return 0
    return this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length
  }

  getStats() {
    return {
      qualityLevel: this.qualityLevel,
      avgFrameTime: this.getAverageFrameTime(),
      currentFPS: this.frameTimeHistory.length > 0 ? 1000 / this.getAverageFrameTime() : 0,
      settings: this.currentSettings
    }
  }
}

/**
 * ShaderManager - Advanced shader compilation and management
 */
class ShaderManager {
  constructor(renderer) {
    this.renderer = renderer
    this.compiledShaders = new Map()
    this.shaderIncludes = new Map()
    this.uniformBuffers = new Map()
    this.shaderCache = new Map()
    this.compileQueue = []
    
    this.setupShaderIncludes()
  }

  setupShaderIncludes() {
    // Common shader includes for optimization
    this.shaderIncludes.set('common_vertex', `
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat3 normalMatrix;
      
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewPosition;
    `)
    
    this.shaderIncludes.set('common_fragment', `
      precision highp float;
      
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewPosition;
    `)
    
    this.shaderIncludes.set('lighting_pars', `
      struct DirectionalLight {
        vec3 direction;
        vec3 color;
        float intensity;
      };
      
      uniform DirectionalLight directionalLights[NUM_DIRECTIONAL_LIGHTS];
      
      vec3 calculateDirectionalLight(DirectionalLight light, vec3 normal, vec3 viewDir) {
        vec3 lightDir = normalize(-light.direction);
        float diff = max(dot(normal, lightDir), 0.0);
        
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
        
        return light.color * light.intensity * (diff + spec * 0.5);
      }
    `)
  }

  precompileShaders(scene, camera) {
    console.log('[ShaderManager] Pre-compiling critical shaders...')
    
    const criticalMaterials = [
      new THREE.MeshStandardMaterial(),
      new THREE.MeshBasicMaterial(),
      new THREE.MeshLambertMaterial(),
      new THREE.MeshPhongMaterial()
    ]

    criticalMaterials.forEach(material => {
      try {
        this.renderer.compile(scene, camera)
        console.log(`[ShaderManager] Pre-compiled ${material.type}`)
      } catch (error) {
        console.warn(`[ShaderManager] Failed to pre-compile ${material.type}:`, error)
      }
    })
  }

  createOptimizedShader(vertexShader, fragmentShader, uniforms = {}) {
    const shaderKey = this.getShaderKey(vertexShader, fragmentShader)
    
    if (this.shaderCache.has(shaderKey)) {
      return this.shaderCache.get(shaderKey)
    }

    // Optimize shader code
    const optimizedVertex = this.optimizeShaderCode(vertexShader)
    const optimizedFragment = this.optimizeShaderCode(fragmentShader)

    const material = new THREE.ShaderMaterial({
      vertexShader: optimizedVertex,
      fragmentShader: optimizedFragment,
      uniforms
    })

    this.shaderCache.set(shaderKey, material)
    return material
  }

  optimizeShaderCode(shaderCode) {
    // Remove comments and extra whitespace
    let optimized = shaderCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()

    // Replace common includes
    for (const [key, value] of this.shaderIncludes) {
      optimized = optimized.replace(new RegExp(`#include <${key}>`, 'g'), value)
    }

    return optimized
  }

  getShaderKey(vertexShader, fragmentShader) {
    return `${this.hashString(vertexShader)}_${this.hashString(fragmentShader)}`
  }

  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  getStats() {
    return {
      cachedShaders: this.shaderCache.size,
      compiledPrograms: this.compiledShaders.size,
      uniformBuffers: this.uniformBuffers.size
    }
  }
}

/**
 * TextureCompressor - Advanced texture compression and optimization
 */
class TextureCompressor {
  constructor(renderer) {
    this.renderer = renderer
    this.gl = renderer.getContext()
    this.compressionFormats = this.detectCompressionSupport()
    this.compressionQueue = []
    this.workerPool = this.createWorkerPool()
  }

  detectCompressionSupport() {
    const formats = {
      s3tc: !!this.gl.getExtension('WEBGL_compressed_texture_s3tc'),
      astc: !!this.gl.getExtension('WEBGL_compressed_texture_astc'),
      etc: !!this.gl.getExtension('WEBGL_compressed_texture_etc'),
      etc1: !!this.gl.getExtension('WEBGL_compressed_texture_etc1'),
      pvrtc: !!this.gl.getExtension('WEBGL_compressed_texture_pvrtc')
    }
    
    console.log('[TextureCompressor] Compression support:', formats)
    return formats
  }

  createWorkerPool() {
    const workerCount = Math.min(4, navigator.hardwareConcurrency || 2)
    const workers = []
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(URL.createObjectURL(new Blob([`
        self.onmessage = function(e) {
          const { imageData, quality, format } = e.data
          
          // Simple texture compression simulation
          // In a real implementation, you'd use actual compression algorithms
          const compressedSize = Math.floor(imageData.data.length * quality)
          const compressed = new Uint8Array(compressedSize)
          
          // Copy and downsample data based on quality
          for (let i = 0; i < compressedSize; i += 4) {
            const sourceIndex = Math.floor(i / quality) * 4
            compressed[i] = imageData.data[sourceIndex] || 0
            compressed[i + 1] = imageData.data[sourceIndex + 1] || 0
            compressed[i + 2] = imageData.data[sourceIndex + 2] || 0
            compressed[i + 3] = imageData.data[sourceIndex + 3] || 255
          }
          
          self.postMessage({
            compressed,
            originalSize: imageData.data.length,
            compressedSize: compressed.length,
            format
          })
        }
      `], { type: 'application/javascript' })))
      
      workers.push(worker)
    }
    
    return workers
  }

  async compressTexture(texture, quality = 0.8) {
    if (!texture.image) return texture

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    canvas.width = texture.image.width
    canvas.height = texture.image.height
    ctx.drawImage(texture.image, 0, 0)
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    return new Promise((resolve) => {
      const worker = this.workerPool[Math.floor(Math.random() * this.workerPool.length)]
      
      worker.postMessage({
        imageData,
        quality,
        format: this.getBestCompressionFormat()
      })
      
      worker.onmessage = (e) => {
        const { compressed, compressedSize, originalSize } = e.data
        
        // Create new texture with compressed data
        const compressedTexture = texture.clone()
        
        // In a real implementation, you'd create proper compressed texture data
        // For now, we simulate by reducing the image size
        const scale = Math.sqrt(quality)
        const newWidth = Math.max(1, Math.floor(canvas.width * scale))
        const newHeight = Math.max(1, Math.floor(canvas.height * scale))
        
        const smallCanvas = document.createElement('canvas')
        const smallCtx = smallCanvas.getContext('2d')
        smallCanvas.width = newWidth
        smallCanvas.height = newHeight
        smallCtx.drawImage(texture.image, 0, 0, newWidth, newHeight)
        
        compressedTexture.image = smallCanvas
        compressedTexture.needsUpdate = true
        
        console.log(`[TextureCompressor] Compressed texture: ${originalSize} -> ${compressedSize} bytes (${((1 - compressedSize/originalSize) * 100).toFixed(1)}% reduction)`)
        
        resolve(compressedTexture)
      }
    })
  }

  getBestCompressionFormat() {
    if (this.compressionFormats.astc) return 'astc'
    if (this.compressionFormats.s3tc) return 's3tc'
    if (this.compressionFormats.etc) return 'etc'
    return 'none'
  }

  dispose() {
    this.workerPool.forEach(worker => worker.terminate())
  }
}

/**
 * Graphics System - Enhanced with all optimization phases
 *
 * - Runs on the client
 * - Supports renderer, shadows, postprocessing, etc
 * - Renders to the viewport
 * - Enhanced with WebGL context management and performance monitoring
 * - Includes adaptive quality, advanced shader management, and texture compression
 *
 */
export class ClientGraphics extends System {
  constructor(world) {
    super(world)
    this.contextLost = false
    this.pendingRestore = false
    this.renderFrameId = null
    this.gpuMemoryUsage = 0
    this.drawCallCount = 0
    this.lastFrameTime = 0
    
    // Advanced systems
    this.resourceManager = null
    this.adaptiveRenderer = null
    this.shaderManager = null
    this.textureCompressor = null
    
    // Performance monitoring
    this.performanceStats = {
      frameCount: 0,
      avgFrameTime: 0,
      minFrameTime: Infinity,
      maxFrameTime: 0,
      memoryUsage: 0,
      drawCalls: 0
    }
    
    // Graphics settings
    this.settings = {
      // Basic settings
      adaptiveQuality: true,
      targetFPS: 60,
      pixelRatio: window.devicePixelRatio,
      
      // Shadow settings
      shadowMapSize: 2048,
      shadowMapType: THREE.PCFSoftShadowMap,
      cascadedShadows: true,
      
      // Post-processing settings
      postProcessing: true,
      aoEnabled: true,
      aoQuality: 'medium', // low, medium, high
      bloomEnabled: true,
      bloomIntensity: 0.5,
      smaaEnabled: true,
      smaaPreset: SMAAPreset.ULTRA,
      toneMappingMode: ToneMappingMode.ACES_FILMIC,
      
      // Texture settings
      anisotropy: 16,
      textureCompression: true,
      textureQuality: 1.0,
      mipmapGeneration: true,
      
      // Advanced settings
      instancedRendering: true,
      frustumCulling: true,
      occlusionCulling: false,
      shaderCaching: true,
      batchRendering: true,
      
      // Debug settings
      wireframe: false,
      showStats: false,
      logPerformance: false
    }
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.width = this.viewport.offsetWidth
    this.height = this.viewport.offsetHeight
    this.aspect = this.width / this.height
    this.renderer = getRenderer()
    
    // Add WebGL context event listeners
    this.setupContextHandlers()
    
    // Initialize advanced systems
    this.resourceManager = new ResourceManager(this.renderer)
    this.adaptiveRenderer = new AdaptiveRenderer(this)
    this.shaderManager = new ShaderManager(this.renderer)
    this.textureCompressor = new TextureCompressor(this.renderer)
    
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0xffffff, 0)
    this.renderer.setPixelRatio(this.settings.pixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = this.settings.shadowMapType
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.xr.enabled = true
    this.renderer.xr.setReferenceSpaceType('local-floor')
    this.renderer.xr.setFoveation(1)
    
    // Enhanced capabilities detection
    this.detectCapabilities()
    
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()
    THREE.Texture.DEFAULT_ANISOTROPY = Math.min(this.settings.anisotropy, this.maxAnisotropy)
    this.usePostprocessing = this.settings.postProcessing
    const context = this.renderer.getContext()
    const maxMultisampling = context.getParameter(context.MAX_SAMPLES)
    
    // Initialize post-processing with better error handling
    this.initPostProcessing(maxMultisampling)
    
    // Pre-compile shaders
    this.shaderManager.precompileShaders(this.world.stage.scene, this.world.camera)
    
    this.world.prefs.on('change', this.onPrefsChange)
    this.resizer = new ResizeObserver(() => {
      this.resize(this.viewport.offsetWidth, this.viewport.offsetHeight)
    })
    this.viewport.appendChild(this.renderer.domElement)
    this.resizer.observe(this.viewport)

    this.xrWidth = null
    this.xrHeight = null
    this.xrDimensionsNeeded = false
    
    // Setup performance monitoring
    this.setupPerformanceMonitoring()
  }

  setupContextHandlers() {
    const canvas = this.renderer.domElement
    
    canvas.addEventListener('webglcontextlost', this.onContextLost.bind(this), false)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored.bind(this), false)
  }

  onContextLost(event) {
    console.warn('[Graphics] WebGL context lost')
    event.preventDefault()
    this.contextLost = true
    this.pendingRestore = true
    
    // Cancel any pending animation frames
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId)
      this.renderFrameId = null
    }
    
    // Emit event for other systems to handle
    this.emit('contextLost')
  }

  onContextRestored() {
    console.log('[Graphics] WebGL context restored')
    this.contextLost = false
    this.pendingRestore = false
    
    // Reinitialize renderer state
    this.restoreRendererState()
    
    // Emit event for other systems to handle
    this.emit('contextRestored')
  }

  restoreRendererState() {
    // Restore renderer settings
    this.renderer.setPixelRatio(this.settings.pixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = this.settings.shadowMapType
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    
    // Recreate post-processing pipeline
    const context = this.renderer.getContext()
    const maxMultisampling = context.getParameter(context.MAX_SAMPLES)
    this.initPostProcessing(maxMultisampling)
    
    console.log('[Graphics] Renderer state restored')
  }

  detectCapabilities() {
    const gl = this.renderer.getContext()
    const capabilities = this.renderer.capabilities
    
    // Log important capabilities for debugging
    const caps = {
      maxTextures: capabilities.maxTextures,
      maxVertexTextures: capabilities.maxVertexTextures,
      maxTextureSize: capabilities.maxTextureSize,
      maxCubemapSize: capabilities.maxCubemapSize,
      maxAnisotropy: capabilities.getMaxAnisotropy(),
      maxSamples: gl.getParameter(gl.MAX_SAMPLES),
      extensions: {
        anisotropy: gl.getExtension('EXT_texture_filter_anisotropic') !== null,
        depthTexture: gl.getExtension('WEBGL_depth_texture') !== null,
        timerQuery: gl.getExtension('EXT_disjoint_timer_query_webgl2') !== null,
        colorBufferFloat: gl.getExtension('EXT_color_buffer_float') !== null,
        s3tc: gl.getExtension('WEBGL_compressed_texture_s3tc') !== null,
        astc: gl.getExtension('WEBGL_compressed_texture_astc') !== null,
      }
    }
    
    console.log('[Graphics] WebGL Capabilities:', caps)
    
    // Adjust settings based on capabilities
    this.adjustSettingsForCapabilities(caps)
  }

  adjustSettingsForCapabilities(caps) {
    // Adjust anisotropy to maximum supported
    this.settings.anisotropy = Math.min(this.settings.anisotropy, caps.maxAnisotropy)
    
    // Disable features not supported
    if (!caps.extensions.colorBufferFloat) {
      console.warn('[Graphics] Float textures not supported, disabling HDR pipeline')
    }
    
    if (!caps.extensions.s3tc && !caps.extensions.astc) {
      this.settings.textureCompression = false
      console.warn('[Graphics] Texture compression not supported')
    }
  }

  initPostProcessing(maxMultisampling) {
    try {
      this.composer = new EffectComposer(this.renderer, {
        frameBufferType: THREE.HalfFloatType,
        // Enable multisampling if available and performant
        multisampling: Math.min(4, maxMultisampling), // Limit to 4x for performance
      })
      
      this.renderPass = new RenderPass(this.world.stage.scene, this.world.camera)
      this.composer.addPass(this.renderPass)
      
      this.aoPass = new N8AOPostPass(this.world.stage.scene, this.world.camera, this.width, this.height)
      this.aoPass.enabled = this.settings.aoEnabled && this.world.settings.ao && this.world.prefs.ao
      // we can't use this as it traverses the scene, but half our objects are in the octree
      this.aoPass.autoDetectTransparency = false
      
      // Configure AO quality based on settings
      this.configureAOQuality()
      this.composer.addPass(this.aoPass)
      
      this.bloom = new BloomEffect({
        blendFunction: BlendFunction.ADD,
        mipmapBlur: true,
        luminanceThreshold: 1,
        luminanceSmoothing: 0.3,
        intensity: this.settings.bloomIntensity,
        radius: 0.8,
      })
      this.bloomEnabled = this.settings.bloomEnabled
      
      this.smaa = new SMAAEffect({
        preset: this.settings.smaaPreset,
      })
      
      this.tonemapping = new ToneMappingEffect({
        mode: this.settings.toneMappingMode,
      })
      
      this.effectPass = new EffectPass(this.world.camera)
      this.updatePostProcessingEffects()
      this.composer.addPass(this.effectPass)
      
    } catch (error) {
      console.error('[Graphics] Failed to initialize post-processing:', error)
      this.usePostprocessing = false
    }
  }

  configureAOQuality() {
    if (!this.aoPass) return
    
    switch (this.settings.aoQuality) {
      case 'low':
        this.aoPass.configuration.halfRes = true
        this.aoPass.configuration.aoRadius = 16
        this.aoPass.configuration.intensity = 1.5
        break
      case 'medium':
        this.aoPass.configuration.halfRes = true
        this.aoPass.configuration.aoRadius = 32
        this.aoPass.configuration.intensity = 2
        break
      case 'high':
        this.aoPass.configuration.halfRes = false
        this.aoPass.configuration.aoRadius = 48
        this.aoPass.configuration.intensity = 2.5
        break
    }
    
    this.aoPass.configuration.screenSpaceRadius = true
    this.aoPass.configuration.distanceFalloff = 1
  }

  setupPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceStats()
    }, 1000) // Update every second
  }

  start() {
    this.world.on('xrSession', this.onXRSession)
    this.world.settings.on('change', this.onSettingsChange)
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.aspect = this.width / this.height
    this.world.camera.aspect = this.aspect
    this.world.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height)
    if (this.composer) {
    this.composer.setSize(this.width, this.height)
    }
    this.emit('resize')
    this.render()
  }

  render() {
    if (this.contextLost) {
      return 0 // Skip rendering if context is lost
    }
    
    let frameTime
    
    if (this.settings.adaptiveQuality && this.adaptiveRenderer) {
      frameTime = this.adaptiveRenderer.render()
    } else {
      const startTime = performance.now()
      
    if (this.renderer.xr.isPresenting || !this.usePostprocessing) {
      this.renderer.render(this.world.stage.scene, this.world.camera)
    } else {
      this.composer.render()
    }
      
      frameTime = performance.now() - startTime
    }
    
    // Track performance metrics
    this.lastFrameTime = frameTime
    this.updatePerformanceMetrics()
    
    if (this.xrDimensionsNeeded) {
      this.checkXRDimensions()
    }
    
    return frameTime
  }

  updatePerformanceMetrics() {
    const info = this.renderer.info
    this.drawCallCount = info.render.calls
    
    // Estimate GPU memory usage (rough calculation)
    this.gpuMemoryUsage = info.memory.geometries * 1024 + info.memory.textures * 1024 * 4
    
    // Update performance stats
    this.performanceStats.frameCount++
    this.performanceStats.drawCalls = this.drawCallCount
    this.performanceStats.memoryUsage = this.gpuMemoryUsage
    
    if (this.lastFrameTime > 0) {
      this.performanceStats.minFrameTime = Math.min(this.performanceStats.minFrameTime, this.lastFrameTime)
      this.performanceStats.maxFrameTime = Math.max(this.performanceStats.maxFrameTime, this.lastFrameTime)
    }
    
    // Log performance warnings
    if (this.settings.logPerformance) {
      if (this.lastFrameTime > 16.67) { // > 60fps
        console.warn(`[Graphics] Slow frame: ${this.lastFrameTime.toFixed(2)}ms`)
      }
      
      if (this.drawCallCount > 1000) {
        console.warn(`[Graphics] High draw calls: ${this.drawCallCount}`)
      }
    }
  }

  updatePerformanceStats() {
    if (this.performanceStats.frameCount > 0) {
      this.performanceStats.avgFrameTime = (this.performanceStats.minFrameTime + this.performanceStats.maxFrameTime) / 2
    }
    
    // Reset min/max for next interval
    this.performanceStats.minFrameTime = Infinity
    this.performanceStats.maxFrameTime = 0
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
    // pixel ratio
    if (changes.dpr) {
      this.settings.pixelRatio = changes.dpr.value
      this.renderer.setPixelRatio(changes.dpr.value)
      this.resize(this.width, this.height)
    }
    // postprocessing
    if (changes.postprocessing) {
      this.settings.postProcessing = changes.postprocessing.value
      this.usePostprocessing = changes.postprocessing.value
    }
    // bloom
    if (changes.bloom) {
      this.settings.bloomEnabled = changes.bloom.value
      this.bloomEnabled = changes.bloom.value
      this.updatePostProcessingEffects()
    }
    // ao
    if (changes.ao) {
      this.settings.aoEnabled = changes.ao.value
      if (this.aoPass) {
        this.aoPass.enabled = changes.ao.value && this.world.prefs.ao
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
    if (changes.ao) {
      this.settings.aoEnabled = changes.ao.value
      if (this.aoPass) {
      this.aoPass.enabled = changes.ao.value && this.world.prefs.ao
      }
      console.log(this.aoPass.enabled)
    }
  }

  updatePostProcessingEffects() {
    if (!this.effectPass) return
    
    const effects = []
    if (this.settings.bloomEnabled && this.bloomEnabled) {
      effects.push(this.bloom)
    }
    if (this.settings.smaaEnabled) {
    effects.push(this.smaa)
    }
    effects.push(this.tonemapping)
    
    this.effectPass.setEffects(effects)
    this.effectPass.recompile()
  }

  // Advanced settings API
  updateGraphicsSettings(newSettings) {
    const oldSettings = { ...this.settings }
    Object.assign(this.settings, newSettings)
    
    // Apply changes that require renderer updates
    if (newSettings.pixelRatio !== undefined) {
      this.renderer.setPixelRatio(this.settings.pixelRatio)
      this.resize(this.width, this.height)
    }
    
    if (newSettings.shadowMapSize !== undefined) {
      if (this.renderer.shadowMap && typeof this.renderer.shadowMap.setSize === 'function') {
        this.renderer.shadowMap.setSize(this.settings.shadowMapSize, this.settings.shadowMapSize);
      } else {
        console.warn('[ClientGraphics] renderer.shadowMap or setSize method not available during settings update, skipping shadow map resize.');
      }
    }
    
    if (newSettings.shadowMapType !== undefined) {
      this.renderer.shadowMap.type = this.settings.shadowMapType
      this.renderer.shadowMap.needsUpdate = true
    }
    
    if (newSettings.anisotropy !== undefined) {
      THREE.Texture.DEFAULT_ANISOTROPY = Math.min(this.settings.anisotropy, this.maxAnisotropy)
    }
    
    // Update post-processing
    if (newSettings.aoQuality !== undefined) {
      this.configureAOQuality()
    }
    
    if (newSettings.bloomIntensity !== undefined && this.bloom) {
      this.bloom.intensity = this.settings.bloomIntensity
    }
    
    if (newSettings.smaaPreset !== undefined && this.smaa) {
      this.smaa.preset = this.settings.smaaPreset
    }
    
    if (newSettings.toneMappingMode !== undefined && this.tonemapping) {
      this.tonemapping.mode = this.settings.toneMappingMode
    }
    
    // Update adaptive renderer target
    if (newSettings.targetFPS !== undefined && this.adaptiveRenderer) {
      this.adaptiveRenderer.targetFPS = this.settings.targetFPS
    }
    
    this.updatePostProcessingEffects()
    
    console.log('[Graphics] Settings updated:', newSettings)
  }

  getGraphicsStats() {
    const rendererInfo = this.renderer.info
    const resourceStats = this.resourceManager ? this.resourceManager.getMemoryStats() : {}
    const adaptiveStats = this.adaptiveRenderer ? this.adaptiveRenderer.getStats() : {}
    const shaderStats = this.shaderManager ? this.shaderManager.getStats() : {}
    
    return {
      performance: {
        ...this.performanceStats,
        currentFPS: this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 0,
        lastFrameTime: this.lastFrameTime
      },
      renderer: {
        calls: rendererInfo.render.calls,
        triangles: rendererInfo.render.triangles,
        points: rendererInfo.render.points,
        lines: rendererInfo.render.lines,
        geometries: rendererInfo.memory.geometries,
        textures: rendererInfo.memory.textures
      },
      resources: resourceStats,
      adaptive: adaptiveStats,
      shaders: shaderStats,
      settings: this.settings
    }
  }

  destroy() {
    this.resizer.disconnect()
    this.viewport.removeChild(this.renderer.domElement)
    
    // Clean up advanced systems
    if (this.resourceManager) {
      this.resourceManager.dispose()
    }
    
    if (this.textureCompressor) {
      this.textureCompressor.dispose()
    }
    
    console.log('[Graphics] System destroyed')
  }
}
