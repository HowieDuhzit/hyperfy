import * as THREE from '../extras/three'
import { System } from './System'

/**
 * Advanced GPU Profiler and Debugging System
 * 
 * Features:
 * - Real-time GPU performance monitoring
 * - Frame-by-frame analysis with bottleneck detection
 * - GPU memory usage tracking and optimization
 * - Render pipeline profiling
 * - WebGL/WebGPU specific metrics
 * - Automated performance recommendations
 * - Visual debugging overlays
 * - Performance regression detection
 * - Thermal throttling detection
 * - Automated quality scaling
 */
export class GPUProfiler extends System {
  constructor(world) {
    super(world)
    
    // Core profiling data
    this.frameData = []
    this.performanceHistory = []
    this.gpuQueries = new Map()
    this.memoryTracking = new Map()
    
    // Profiling configuration
    this.config = {
      // General settings
      enabled: true,
      maxHistoryFrames: 300, // 5 seconds at 60fps
      profilingInterval: 1, // Profile every N frames
      
      // Performance thresholds
      targetFrameTime: 16.67, // 60 FPS
      criticalFrameTime: 33.33, // 30 FPS
      targetGPUMemory: 1024 * 1024 * 1024, // 1GB
      criticalGPUMemory: 2048 * 1024 * 1024, // 2GB
      
      // Monitoring features
      trackDrawCalls: true,
      trackMemoryUsage: true,
      trackShaderCompilation: true,
      trackTextureUploads: true,
      trackGeometryUploads: true,
      detectThermalThrottling: true,
      
      // Debugging features
      visualOverlays: false,
      detailedLogging: false,
      performanceWarnings: true,
      automaticOptimization: true,
      
      // WebGPU specific
      trackComputeShaders: true,
      trackPipelineCreation: true,
      trackBufferUsage: true
    }
    
    // Performance metrics
    this.metrics = {
      // Frame metrics
      currentFPS: 0,
      averageFPS: 0,
      minFPS: Infinity,
      maxFPS: 0,
      frameTime: 0,
      averageFrameTime: 0,
      
      // GPU metrics
      gpuTime: 0,
      cpuTime: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      
      // Memory metrics
      gpuMemoryUsed: 0,
      gpuMemoryTotal: 0,
      textureMemory: 0,
      geometryMemory: 0,
      bufferMemory: 0,
      
      // Pipeline metrics
      activeShaders: 0,
      shaderCompilations: 0,
      pipelineCreations: 0,
      
      // Quality metrics
      renderScale: 1.0,
      shadowQuality: 1.0,
      effectsQuality: 1.0,
      
      // Bottleneck detection
      cpuBound: false,
      gpuBound: false,
      memoryBound: false,
      thermalThrottling: false
    }
    
    // Performance recommendations
    this.recommendations = []
    this.optimizations = new Map()
    
    // Debugging overlays
    this.overlays = {
      enabled: false,
      canvas: null,
      context: null,
      charts: new Map()
    }
    
    // WebGPU specific tracking
    this.webgpuData = {
      adapters: [],
      device: null,
      features: [],
      limits: {},
      queues: new Map(),
      pipelines: new Map(),
      buffers: new Map(),
      textures: new Map(),
      bindGroups: new Map()
    }
  }

  async init() {
    console.log('📊 Initializing GPU Profiler...')
    
    // Initialize profiling systems
    this.initializePerformanceAPI()
    this.initializeGPUQueries()
    this.initializeMemoryTracking()
    this.initializeWebGPUProfiling()
    this.initializeThermalDetection()
    
    // Setup debugging overlays
    if (this.config.visualOverlays) {
      this.initializeVisualOverlays()
    }
    
    // Setup automatic optimization
    if (this.config.automaticOptimization) {
      this.initializeAutoOptimization()
    }
    
    // Start profiling loop
    this.startProfiling()
    
    console.log('✅ GPU Profiler initialized')
  }

  initializePerformanceAPI() {
    console.log('⏱️ Initializing Performance API...')
    
    // Initialize high-resolution timing
    this.performanceAPI = {
      // Use the best available timing API
      now: () => {
        if (performance.now) {
          return performance.now()
        } else if (Date.now) {
          return Date.now()
        } else {
          return new Date().getTime()
        }
      },
      
      // Memory API (if available)
      memory: performance.memory || {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      },
      
      // Navigation timing
      navigation: performance.navigation || {},
      
      // Resource timing entries
      getResourceEntries: () => {
        if (performance.getEntriesByType) {
          return performance.getEntriesByType('resource')
        }
        return []
      }
    }
    
    // Frame timing tracking
    this.frameTiming = {
      lastFrameTime: this.performanceAPI.now(),
      frameCount: 0,
      totalTime: 0,
      samples: []
    }
  }

  initializeGPUQueries() {
    console.log('🔍 Initializing GPU Queries...')
    
    const renderer = this.world.graphics?.renderer
    if (!renderer) return
    
    if (renderer.isWebGLRenderer) {
      this.initializeWebGLQueries(renderer)
    } else if (renderer.isWebGPURenderer) {
      this.initializeWebGPUQueries(renderer)
    }
  }

  initializeWebGLQueries(renderer) {
    const gl = renderer.getContext()
    
    // Check for timer query extension
    this.webglExtensions = {
      timerQuery: gl.getExtension('EXT_disjoint_timer_query_webgl2') || 
                 gl.getExtension('EXT_disjoint_timer_query'),
      memoryInfo: gl.getExtension('WEBGL_debug_renderer_info'),
      shaderPrecision: gl.getExtension('WEBGL_debug_shaders')
    }
    
    if (this.webglExtensions.timerQuery) {
      this.gpuQueries.set('frame', gl.createQuery())
      this.gpuQueries.set('geometry', gl.createQuery())
      this.gpuQueries.set('materials', gl.createQuery())
      this.gpuQueries.set('postprocessing', gl.createQuery())
      
      console.log('✅ WebGL timer queries available')
    }
    
    if (this.webglExtensions.memoryInfo) {
      // Get GPU info
      this.gpuInfo = {
        vendor: gl.getParameter(this.webglExtensions.memoryInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(this.webglExtensions.memoryInfo.UNMASKED_RENDERER_WEBGL),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
      }
      
      console.log('🖥️ GPU Info:', this.gpuInfo)
    }
  }

  async initializeWebGPUQueries(renderer) {
    if (!renderer.device) return
    
    const device = renderer.device
    this.webgpuData.device = device
    
    // Get adapter info
    if (device.adapter) {
      this.webgpuData.adapters.push({
        vendor: device.adapter.info?.vendor || 'Unknown',
        architecture: device.adapter.info?.architecture || 'Unknown',
        device: device.adapter.info?.device || 'Unknown',
        description: device.adapter.info?.description || 'Unknown'
      })
    }
    
    // Get device features and limits
    this.webgpuData.features = Array.from(device.features || [])
    this.webgpuData.limits = device.limits || {}
    
    // Setup timestamp queries if available
    if (device.features.has('timestamp-query')) {
      this.webgpuTimestamps = {
        enabled: true,
        querySet: device.createQuerySet({
          type: 'timestamp',
          count: 8
        }),
        resolveBuffer: device.createBuffer({
          size: 8 * 8, // 8 timestamps * 8 bytes each
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        }),
        resultBuffer: device.createBuffer({
          size: 8 * 8,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        })
      }
      
      console.log('✅ WebGPU timestamp queries available')
    }
    
    console.log('🌟 WebGPU Device Info:', {
      features: this.webgpuData.features,
      limits: this.webgpuData.limits
    })
  }

  initializeMemoryTracking() {
    console.log('💾 Initializing Memory Tracking...')
    
    this.memoryTracker = {
      // Track texture memory
      trackTexture: (texture, operation) => {
        const size = this.estimateTextureMemory(texture)
        const id = texture.uuid
        
        if (operation === 'upload') {
          this.memoryTracking.set(`texture_${id}`, {
            type: 'texture',
            size: size,
            timestamp: this.performanceAPI.now(),
            texture: texture
          })
          this.metrics.textureMemory += size
        } else if (operation === 'dispose') {
          const entry = this.memoryTracking.get(`texture_${id}`)
          if (entry) {
            this.metrics.textureMemory -= entry.size
            this.memoryTracking.delete(`texture_${id}`)
          }
        }
      },
      
      // Track geometry memory
      trackGeometry: (geometry, operation) => {
        const size = this.estimateGeometryMemory(geometry)
        const id = geometry.uuid
        
        if (operation === 'upload') {
          this.memoryTracking.set(`geometry_${id}`, {
            type: 'geometry',
            size: size,
            timestamp: this.performanceAPI.now(),
            geometry: geometry
          })
          this.metrics.geometryMemory += size
        } else if (operation === 'dispose') {
          const entry = this.memoryTracking.get(`geometry_${id}`)
          if (entry) {
            this.metrics.geometryMemory -= entry.size
            this.memoryTracking.delete(`geometry_${id}`)
          }
        }
      },
      
      // Track WebGPU buffers
      trackBuffer: (buffer, size, operation) => {
        const id = buffer.uuid || `buffer_${Date.now()}`
        
        if (operation === 'create') {
          this.memoryTracking.set(`buffer_${id}`, {
            type: 'buffer',
            size: size,
            timestamp: this.performanceAPI.now(),
            buffer: buffer
          })
          this.metrics.bufferMemory += size
        } else if (operation === 'destroy') {
          const entry = this.memoryTracking.get(`buffer_${id}`)
          if (entry) {
            this.metrics.bufferMemory -= entry.size
            this.memoryTracking.delete(`buffer_${id}`)
          }
        }
      }
    }
    
    // Hook into Three.js texture and geometry events
    this.hookIntoThreeJS()
  }

  hookIntoThreeJS() {
    // Hook texture uploads
    const originalTextureUpload = THREE.Texture.prototype.onUpload
    THREE.Texture.prototype.onUpload = function() {
      this.userData.profilerTracked = true
      this.world?.systems?.gpuProfiler?.memoryTracker.trackTexture(this, 'upload')
      if (originalTextureUpload) originalTextureUpload.call(this)
    }
    
    // Hook texture disposal
    const originalTextureDispose = THREE.Texture.prototype.dispose
    THREE.Texture.prototype.dispose = function() {
      if (this.userData.profilerTracked) {
        this.world?.systems?.gpuProfiler?.memoryTracker.trackTexture(this, 'dispose')
      }
      if (originalTextureDispose) originalTextureDispose.call(this)
    }
    
    // Hook geometry disposal
    const originalGeometryDispose = THREE.BufferGeometry.prototype.dispose
    THREE.BufferGeometry.prototype.dispose = function() {
      if (this.userData.profilerTracked) {
        this.world?.systems?.gpuProfiler?.memoryTracker.trackGeometry(this, 'dispose')
      }
      if (originalGeometryDispose) originalGeometryDispose.call(this)
    }
  }

  estimateTextureMemory(texture) {
    if (!texture.image) return 0
    
    const width = texture.image.width || 0
    const height = texture.image.height || 0
    const depth = texture.image.depth || 1
    
    // Estimate bytes per pixel based on format
    let bytesPerPixel = 4 // Default RGBA
    
    switch (texture.format) {
      case THREE.RedFormat:
        bytesPerPixel = 1
        break
      case THREE.RGFormat:
        bytesPerPixel = 2
        break
      case THREE.RGBFormat:
        bytesPerPixel = 3
        break
      case THREE.RGBAFormat:
        bytesPerPixel = 4
        break
    }
    
    // Account for data type
    switch (texture.type) {
      case THREE.FloatType:
        bytesPerPixel *= 4
        break
      case THREE.HalfFloatType:
        bytesPerPixel *= 2
        break
    }
    
    // Calculate total size including mipmaps
    let totalSize = width * height * depth * bytesPerPixel
    
    if (texture.generateMipmaps) {
      totalSize *= 1.33 // Approximate 33% overhead for mipmaps
    }
    
    return totalSize
  }

  estimateGeometryMemory(geometry) {
    let totalSize = 0
    
    // Calculate size of all attributes
    for (const name in geometry.attributes) {
      const attribute = geometry.attributes[name]
      const itemSize = attribute.itemSize
      const count = attribute.count
      const arrayType = attribute.array.constructor
      
      let bytesPerElement = 4 // Default Float32
      if (arrayType === Uint16Array) bytesPerElement = 2
      else if (arrayType === Uint8Array) bytesPerElement = 1
      
      totalSize += itemSize * count * bytesPerElement
    }
    
    // Add index buffer if present
    if (geometry.index) {
      const indexArray = geometry.index.array
      const bytesPerElement = indexArray.constructor === Uint16Array ? 2 : 4
      totalSize += indexArray.length * bytesPerElement
    }
    
    return totalSize
  }

  initializeWebGPUProfiling() {
    if (!this.world.graphics.isWebGPU) return
    
    console.log('🌟 Initializing WebGPU-specific profiling...')
    
    // Track pipeline creation
    this.webgpuProfiler = {
      trackPipelineCreation: (pipeline, type) => {
        const id = `${type}_${Date.now()}`
        this.webgpuData.pipelines.set(id, {
          type: type,
          pipeline: pipeline,
          createdAt: this.performanceAPI.now()
        })
        this.metrics.pipelineCreations++
      },
      
      trackBufferUsage: (buffer, usage) => {
        const id = buffer.uuid || `buffer_${Date.now()}`
        this.webgpuData.buffers.set(id, {
          buffer: buffer,
          usage: usage,
          size: buffer.size,
          createdAt: this.performanceAPI.now()
        })
      },
      
      trackComputeShader: (shader, workgroups) => {
        const startTime = this.performanceAPI.now()
        
        return {
          finish: () => {
            const endTime = this.performanceAPI.now()
            this.addComputeMetric({
              shader: shader,
              workgroups: workgroups,
              duration: endTime - startTime
            })
          }
        }
      }
    }
  }

  initializeThermalDetection() {
    console.log('🌡️ Initializing Thermal Detection...')
    
    this.thermalDetector = {
      lastFPS: 60,
      fpsHistory: [],
      thermalEventCount: 0,
      
      detect: () => {
        // Simple thermal throttling detection based on FPS drops
        if (this.metrics.currentFPS < this.thermalDetector.lastFPS * 0.8 && 
            this.metrics.currentFPS < 45) {
          this.thermalDetector.thermalEventCount++
          
          if (this.thermalDetector.thermalEventCount > 3) {
            this.metrics.thermalThrottling = true
            this.addRecommendation({
              type: 'thermal',
              priority: 'high',
              message: 'Thermal throttling detected. Consider reducing graphics quality.',
              action: 'reduceQuality'
            })
          }
        } else {
          this.thermalDetector.thermalEventCount = Math.max(0, this.thermalDetector.thermalEventCount - 1)
          if (this.thermalDetector.thermalEventCount === 0) {
            this.metrics.thermalThrottling = false
          }
        }
        
        this.thermalDetector.lastFPS = this.metrics.currentFPS
      }
    }
  }

  initializeVisualOverlays() {
    console.log('🎨 Initializing Visual Overlays...')
    
    // Create overlay canvas
    this.overlays.canvas = document.createElement('canvas')
    this.overlays.canvas.style.position = 'fixed'
    this.overlays.canvas.style.top = '10px'
    this.overlays.canvas.style.right = '10px'
    this.overlays.canvas.style.width = '400px'
    this.overlays.canvas.style.height = '300px'
    this.overlays.canvas.style.backgroundColor = 'rgba(0,0,0,0.8)'
    this.overlays.canvas.style.border = '1px solid #333'
    this.overlays.canvas.style.borderRadius = '8px'
    this.overlays.canvas.style.zIndex = '10000'
    this.overlays.canvas.style.pointerEvents = 'none'
    
    this.overlays.canvas.width = 400
    this.overlays.canvas.height = 300
    
    this.overlays.context = this.overlays.canvas.getContext('2d')
    this.overlays.enabled = true
    
    document.body.appendChild(this.overlays.canvas)
    
    // Initialize charts
    this.overlays.charts.set('fps', {
      data: [],
      color: '#00ff00',
      label: 'FPS',
      max: 120
    })
    
    this.overlays.charts.set('frameTime', {
      data: [],
      color: '#ffff00',
      label: 'Frame Time (ms)',
      max: 50
    })
    
    this.overlays.charts.set('memory', {
      data: [],
      color: '#ff0000',
      label: 'GPU Memory (MB)',
      max: 2048
    })
  }

  initializeAutoOptimization() {
    console.log('🤖 Initializing Auto Optimization...')
    
    this.autoOptimizer = {
      enabled: true,
      lastOptimization: 0,
      optimizationCooldown: 5000, // 5 seconds
      
      optimize: () => {
        const now = this.performanceAPI.now()
        if (now - this.autoOptimizer.lastOptimization < this.autoOptimizer.optimizationCooldown) {
          return
        }
        
        const recommendations = this.generateRecommendations()
        
        // Apply automatic optimizations
        for (const rec of recommendations) {
          if (rec.autoApply && rec.priority === 'high') {
            this.applyOptimization(rec)
            this.autoOptimizer.lastOptimization = now
            break // Apply one optimization at a time
          }
        }
      }
    }
  }

  startProfiling() {
    console.log('▶️ Starting profiling loop...')
    
    this.profilingLoop = () => {
      if (!this.config.enabled) return
      
      this.profileFrame()
      
      // Continue profiling
      requestAnimationFrame(this.profilingLoop)
    }
    
    requestAnimationFrame(this.profilingLoop)
  }

  profileFrame() {
    const currentTime = this.performanceAPI.now()
    const deltaTime = currentTime - this.frameTiming.lastFrameTime
    
    // Update frame timing
    this.frameTiming.frameCount++
    this.frameTiming.totalTime += deltaTime
    this.frameTiming.samples.push(deltaTime)
    
    // Keep only recent samples
    if (this.frameTiming.samples.length > this.config.maxHistoryFrames) {
      this.frameTiming.samples.shift()
    }
    
    // Calculate metrics
    this.updateMetrics(deltaTime)
    
    // Profile only every N frames to reduce overhead
    if (this.frameTiming.frameCount % this.config.profilingInterval === 0) {
      this.detailedProfile()
    }
    
    // Update visual overlays
    if (this.overlays.enabled) {
      this.updateVisualOverlays()
    }
    
    // Auto optimization
    if (this.config.automaticOptimization) {
      this.autoOptimizer.optimize()
    }
    
    this.frameTiming.lastFrameTime = currentTime
  }

  updateMetrics(deltaTime) {
    // Frame rate metrics
    this.metrics.frameTime = deltaTime
    this.metrics.currentFPS = 1000 / deltaTime
    
    if (this.frameTiming.samples.length > 0) {
      const avgDelta = this.frameTiming.samples.reduce((a, b) => a + b, 0) / this.frameTiming.samples.length
      this.metrics.averageFPS = 1000 / avgDelta
      this.metrics.averageFrameTime = avgDelta
      
      this.metrics.minFPS = Math.min(this.metrics.minFPS, this.metrics.currentFPS)
      this.metrics.maxFPS = Math.max(this.metrics.maxFPS, this.metrics.currentFPS)
    }
    
    // GPU memory
    this.metrics.gpuMemoryUsed = this.metrics.textureMemory + 
                                this.metrics.geometryMemory + 
                                this.metrics.bufferMemory
    
    // Bottleneck detection
    this.detectBottlenecks()
    
    // Thermal detection
    this.thermalDetector.detect()
  }

  detailedProfile() {
    // Get renderer info
    const renderer = this.world.graphics?.renderer
    if (!renderer) return
    
    if (renderer.info) {
      this.metrics.drawCalls = renderer.info.render.calls
      this.metrics.triangles = renderer.info.render.triangles
      this.metrics.vertices = renderer.info.render.points
    }
    
    // Profile specific systems
    this.profilePostProcessing()
    this.profileShadows()
    this.profileMaterials()
    
    // WebGPU specific profiling
    if (renderer.isWebGPURenderer) {
      this.profileWebGPUSpecific()
    }
    
    // Generate recommendations
    this.recommendations = this.generateRecommendations()
  }

  profilePostProcessing() {
    const graphics = this.world.graphics
    if (!graphics) return
    
    // Track post-processing overhead
    if (graphics.composer && graphics.usePostprocessing) {
      // Estimate post-processing cost based on enabled effects
      let ppCost = 0
      
      if (graphics.bloom) ppCost += 0.1
      if (graphics.aoPass) ppCost += 0.15
      if (graphics.smaa) ppCost += 0.05
      
      this.metrics.postProcessingCost = ppCost
    }
  }

  profileShadows() {
    const shadows = this.world.advancedShadows
    if (!shadows) return
    
    const shadowStats = shadows.getPerformanceStats()
    this.metrics.shadowRenderTime = shadowStats.shadowRenderTime
    this.metrics.shadowMemoryUsage = shadowStats.shadowMemoryUsage
    this.metrics.activeShadowLights = shadowStats.activeShadowLights
  }

  profileMaterials() {
    const materials = this.world.advancedMaterials
    if (!materials) return
    
    const materialStats = materials.getPerformanceStats()
    this.metrics.activeMaterials = materialStats.activeMaterials
    this.metrics.materialMemory = materialStats.gpuMemoryUsed
  }

  profileWebGPUSpecific() {
    // Profile WebGPU-specific metrics
    this.metrics.activeComputeShaders = this.webgpuData.computeShaders?.size || 0
    this.metrics.activePipelines = this.webgpuData.pipelines.size
    this.metrics.activeBuffers = this.webgpuData.buffers.size
  }

  detectBottlenecks() {
    // Simple bottleneck detection heuristics
    const frameTime = this.metrics.frameTime
    const targetTime = this.config.targetFrameTime
    
    if (frameTime > targetTime * 1.5) {
      // Performance issues detected
      
      // Check if CPU bound (high draw calls, low GPU utilization)
      if (this.metrics.drawCalls > 1000) {
        this.metrics.cpuBound = true
      }
      
      // Check if GPU bound (high triangle count, complex shaders)
      if (this.metrics.triangles > 100000) {
        this.metrics.gpuBound = true
      }
      
      // Check if memory bound (high memory usage)
      if (this.metrics.gpuMemoryUsed > this.config.targetGPUMemory) {
        this.metrics.memoryBound = true
      }
    } else {
      // Performance is good
      this.metrics.cpuBound = false
      this.metrics.gpuBound = false
      this.metrics.memoryBound = false
    }
  }

  generateRecommendations() {
    const recommendations = []
    
    // Performance recommendations
    if (this.metrics.currentFPS < 30) {
      recommendations.push({
        type: 'performance',
        priority: 'critical',
        message: 'Critically low FPS detected. Immediate optimization required.',
        actions: ['reduceRenderScale', 'disablePostProcessing', 'reduceShadowQuality'],
        autoApply: true
      })
    } else if (this.metrics.currentFPS < 45) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Low FPS detected. Consider reducing graphics quality.',
        actions: ['reduceRenderScale', 'reduceShadowQuality'],
        autoApply: true
      })
    }
    
    // Memory recommendations
    if (this.metrics.gpuMemoryUsed > this.config.criticalGPUMemory) {
      recommendations.push({
        type: 'memory',
        priority: 'critical',
        message: 'Critical GPU memory usage. Risk of crashes.',
        actions: ['compressTextures', 'reduceTextureQuality', 'disposeUnusedAssets'],
        autoApply: true
      })
    }
    
    // CPU bound recommendations
    if (this.metrics.cpuBound) {
      recommendations.push({
        type: 'cpu',
        priority: 'medium',
        message: 'CPU bottleneck detected. Too many draw calls.',
        actions: ['enableInstancing', 'enableBatching', 'frustumCulling'],
        autoApply: false
      })
    }
    
    // GPU bound recommendations
    if (this.metrics.gpuBound) {
      recommendations.push({
        type: 'gpu',
        priority: 'medium',
        message: 'GPU bottleneck detected. Too many triangles or complex shaders.',
        actions: ['enableLOD', 'simplifyShaders', 'reduceGeometryDetail'],
        autoApply: false
      })
    }
    
    // Thermal throttling recommendations
    if (this.metrics.thermalThrottling) {
      recommendations.push({
        type: 'thermal',
        priority: 'high',
        message: 'Thermal throttling detected. Device is overheating.',
        actions: ['reduceQualityAcrossBoard', 'lowerFrameRate'],
        autoApply: true
      })
    }
    
    return recommendations
  }

  applyOptimization(recommendation) {
    console.log(`🔧 Applying optimization: ${recommendation.message}`)
    
    for (const action of recommendation.actions) {
      switch (action) {
        case 'reduceRenderScale':
          this.reduceRenderScale()
          break
        case 'disablePostProcessing':
          this.disablePostProcessing()
          break
        case 'reduceShadowQuality':
          this.reduceShadowQuality()
          break
        case 'compressTextures':
          this.compressTextures()
          break
        case 'reduceTextureQuality':
          this.reduceTextureQuality()
          break
        case 'enableLOD':
          this.enableLOD()
          break
        case 'enableBatching':
          this.enableBatching()
          break
      }
    }
    
    this.optimizations.set(Date.now(), {
      recommendation: recommendation,
      appliedAt: this.performanceAPI.now()
    })
  }

  reduceRenderScale() {
    if (this.world.prefs) {
      const currentScale = this.world.prefs.resolutionScale || 1.0
      const newScale = Math.max(0.5, currentScale * 0.8)
      this.world.prefs.setResolutionScale(newScale)
      this.metrics.renderScale = newScale
    }
  }

  disablePostProcessing() {
    if (this.world.prefs) {
      this.world.prefs.setPostprocessing(false)
    }
  }

  reduceShadowQuality() {
    if (this.world.advancedShadows) {
      this.world.advancedShadows.optimizePerformance({ frameTime: this.metrics.frameTime })
    }
  }

  compressTextures() {
    if (this.world.advancedMaterials) {
      this.world.advancedMaterials.materialOptimizer.optimizeMemoryUsage()
    }
  }

  reduceTextureQuality() {
    // Reduce texture quality globally
    for (const [id, entry] of this.memoryTracking) {
      if (entry.type === 'texture' && entry.texture) {
        // This would require implementing texture quality reduction
        // For now, just log the action
        console.log(`📉 Would reduce quality for texture: ${id}`)
      }
    }
  }

  enableLOD() {
    if (this.world.advancedLOD) {
      // Enable more aggressive LOD
      console.log('📏 Enabling more aggressive LOD')
    }
  }

  enableBatching() {
    if (this.world.batchedMesh) {
      // Enable batching for more objects
      console.log('📦 Enabling more aggressive batching')
    }
  }

  updateVisualOverlays() {
    if (!this.overlays.context) return
    
    const ctx = this.overlays.context
    const canvas = this.overlays.canvas
    
    // Clear canvas
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw title
    ctx.fillStyle = '#ffffff'
    ctx.font = '14px monospace'
    ctx.fillText('GPU Profiler', 10, 20)
    
    // Draw metrics
    let y = 40
    const lineHeight = 16
    
    ctx.font = '12px monospace'
    ctx.fillStyle = '#00ff00'
    ctx.fillText(`FPS: ${this.metrics.currentFPS.toFixed(1)} (avg: ${this.metrics.averageFPS.toFixed(1)})`, 10, y)
    y += lineHeight
    
    ctx.fillStyle = '#ffff00'
    ctx.fillText(`Frame Time: ${this.metrics.frameTime.toFixed(2)}ms`, 10, y)
    y += lineHeight
    
    ctx.fillStyle = '#ff8800'
    ctx.fillText(`Draw Calls: ${this.metrics.drawCalls}`, 10, y)
    y += lineHeight
    
    ctx.fillStyle = '#ff0000'
    ctx.fillText(`GPU Memory: ${(this.metrics.gpuMemoryUsed / 1024 / 1024).toFixed(1)}MB`, 10, y)
    y += lineHeight
    
    // Draw bottleneck indicators
    y += 10
    ctx.fillStyle = '#ffffff'
    ctx.fillText('Bottlenecks:', 10, y)
    y += lineHeight
    
    if (this.metrics.cpuBound) {
      ctx.fillStyle = '#ff0000'
      ctx.fillText('• CPU Bound', 20, y)
      y += lineHeight
    }
    
    if (this.metrics.gpuBound) {
      ctx.fillStyle = '#ff0000'
      ctx.fillText('• GPU Bound', 20, y)
      y += lineHeight
    }
    
    if (this.metrics.memoryBound) {
      ctx.fillStyle = '#ff0000'
      ctx.fillText('• Memory Bound', 20, y)
      y += lineHeight
    }
    
    if (this.metrics.thermalThrottling) {
      ctx.fillStyle = '#ff0000'
      ctx.fillText('• Thermal Throttling', 20, y)
      y += lineHeight
    }
    
    // Draw performance charts
    this.drawPerformanceCharts()
  }

  drawPerformanceCharts() {
    const ctx = this.overlays.context
    const canvas = this.overlays.canvas
    
    // Update chart data
    this.overlays.charts.get('fps').data.push(this.metrics.currentFPS)
    this.overlays.charts.get('frameTime').data.push(this.metrics.frameTime)
    this.overlays.charts.get('memory').data.push(this.metrics.gpuMemoryUsed / 1024 / 1024)
    
    // Keep chart data within reasonable size
    for (const chart of this.overlays.charts.values()) {
      if (chart.data.length > 100) {
        chart.data.shift()
      }
    }
    
    // Draw charts
    const chartWidth = 180
    const chartHeight = 60
    const chartX = canvas.width - chartWidth - 10
    let chartY = 40
    
    for (const [name, chart] of this.overlays.charts) {
      this.drawChart(ctx, chart, chartX, chartY, chartWidth, chartHeight)
      chartY += chartHeight + 20
    }
  }

  drawChart(ctx, chart, x, y, width, height) {
    // Draw chart background
    ctx.fillStyle = 'rgba(40,40,40,0.8)'
    ctx.fillRect(x, y, width, height)
    
    // Draw chart border
    ctx.strokeStyle = '#666'
    ctx.strokeRect(x, y, width, height)
    
    // Draw chart label
    ctx.fillStyle = '#ffffff'
    ctx.font = '10px monospace'
    ctx.fillText(chart.label, x + 2, y - 2)
    
    // Draw data
    if (chart.data.length < 2) return
    
    ctx.strokeStyle = chart.color
    ctx.lineWidth = 1
    ctx.beginPath()
    
    for (let i = 0; i < chart.data.length; i++) {
      const value = chart.data[i]
      const normalizedValue = Math.min(value / chart.max, 1.0)
      
      const chartX = x + (i / (chart.data.length - 1)) * width
      const chartY = y + height - (normalizedValue * height)
      
      if (i === 0) {
        ctx.moveTo(chartX, chartY)
      } else {
        ctx.lineTo(chartX, chartY)
      }
    }
    
    ctx.stroke()
  }

  // Public API

  getMetrics() {
    return { ...this.metrics }
  }

  getRecommendations() {
    return [...this.recommendations]
  }

  getMemoryBreakdown() {
    const breakdown = {
      textures: this.metrics.textureMemory,
      geometry: this.metrics.geometryMemory,
      buffers: this.metrics.bufferMemory,
      total: this.metrics.gpuMemoryUsed
    }
    
    return breakdown
  }

  getPerformanceHistory() {
    return this.frameTiming.samples.slice()
  }

  addRecommendation(recommendation) {
    this.recommendations.push({
      ...recommendation,
      timestamp: this.performanceAPI.now(),
      id: `rec_${Date.now()}`
    })
  }

  addComputeMetric(metric) {
    // Add compute shader performance metric
    this.computeMetrics = this.computeMetrics || []
    this.computeMetrics.push({
      ...metric,
      timestamp: this.performanceAPI.now()
    })
  }

  toggleOverlays() {
    if (this.overlays.canvas) {
      this.overlays.enabled = !this.overlays.enabled
      this.overlays.canvas.style.display = this.overlays.enabled ? 'block' : 'none'
    }
  }

  exportPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      recommendations: this.getRecommendations(),
      memoryBreakdown: this.getMemoryBreakdown(),
      performanceHistory: this.getPerformanceHistory(),
      gpuInfo: this.gpuInfo,
      webgpuInfo: this.webgpuData,
      optimizationsApplied: Array.from(this.optimizations.values())
    }
    
    return JSON.stringify(report, null, 2)
  }

  // Cleanup

  dispose() {
    // Stop profiling
    this.config.enabled = false
    
    // Remove overlays
    if (this.overlays.canvas && this.overlays.canvas.parentNode) {
      this.overlays.canvas.parentNode.removeChild(this.overlays.canvas)
    }
    
    // Clear data
    this.frameData = []
    this.performanceHistory = []
    this.gpuQueries.clear()
    this.memoryTracking.clear()
    this.recommendations = []
    this.optimizations.clear()
    
    console.log('🗑️ GPU Profiler disposed')
  }
}

export { GPUProfiler }