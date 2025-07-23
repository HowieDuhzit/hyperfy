import { isBoolean, isNumber } from 'lodash-es'

import { System } from './System'
import { storage } from '../storage'
import { isTouch } from '../../client/utils'

/**
 * Client Prefs System
 *
 */
export class ClientPrefs extends System {
  constructor(world) {
    super(world)

    const isQuest = /OculusBrowser/.test(navigator.userAgent)

    const data = storage.get('prefs', {})

    // v2: reset ui scale for new mobile default (0.9)
    if (!data.v) {
      data.v = 2
      data.ui = null
    }
    // v3: reset shadows for new mobile default (med)
    if (data.v < 3) {
      data.v = 3
      data.shadows = null
    }
    // v4: reset shadows for new defaults (low or med)
    if (data.v < 4) {
      data.v = 4
      data.shadows = null
    }
    // v5: add renderer preference
    if (data.v < 5) {
      data.v = 5
      data.renderer = null
    }
    // v6: add AAA graphics settings
    if (data.v < 6) {
      data.v = 6
      data.antialiasing = null
      data.textureQuality = null
      data.anisotropicFiltering = null
      data.fieldOfView = null
      data.depthOfField = null
      data.motionBlur = null
      data.ssReflections = null
      data.volumetricLighting = null
      data.lodDistance = null
      data.vsync = null
      data.frameRateLimit = null
      data.toneMappingMode = null
      data.toneMappingExposure = null
      data.gamma = null
      data.brightness = null
      data.contrast = null
    }
    
    // v7: add AAA WebGPU advanced features
    if (data.v < 7) {
      data.v = 7
      // Advanced Materials
      data.materialQuality = null
      data.proceduralMaterials = null
      data.dynamicMaterialLOD = null
      data.materialBatching = null
      
      // Advanced Shadows  
      data.cascadedShadowMaps = null
      data.volumetricShadows = null
      data.contactShadows = null
      data.temporalShadowFiltering = null
      data.variableRateShadows = null
      data.shadowAtlasQuality = null
      
      // Advanced Post-Processing
      data.ssgi = null
      data.taa = null
      data.temporalUpsampling = null
      
      // GPU Profiler & Performance
      data.gpuProfilerOverlay = null
      data.autoOptimization = null
      data.performanceWarnings = null
      data.thermalThrottlingDetection = null
      
      // Compute Shaders
      data.gpuDrivenCulling = null
      data.gpuParticleSimulation = null
      data.gpuLODSelection = null
      
      // Ray Tracing (Future)
      data.rayTracedReflections = null
      data.rayTracedGlobalIllumination = null
      data.rayTracedShadows = null
    }

    // Basic settings
    this.ui = isNumber(data.ui) ? data.ui : isTouch ? 0.9 : 1
    this.actions = isBoolean(data.actions) ? data.actions : true
    this.stats = isBoolean(data.stats) ? data.stats : false
    
    // Display settings
    this.dpr = isNumber(data.dpr) ? data.dpr : 1
    this.fieldOfView = isNumber(data.fieldOfView) ? data.fieldOfView : 75
    this.gamma = isNumber(data.gamma) ? data.gamma : 2.2
    this.brightness = isNumber(data.brightness) ? data.brightness : 1.0
    this.contrast = isNumber(data.contrast) ? data.contrast : 1.0
    
    // Rendering settings
    this.renderer = data.renderer ? data.renderer : 'webgl' // auto, webgpu, webgl
    this.shadows = data.shadows ? data.shadows : isTouch ? 'low' : 'med' // none, low=1, med=2048cascade, high=4096cascade
    this.antialiasing = data.antialiasing ? data.antialiasing : isTouch ? 'fxaa' : 'smaa' // none, fxaa, smaa, taa, msaa2x, msaa4x, msaa8x
    this.textureQuality = data.textureQuality ? data.textureQuality : isTouch ? 'medium' : 'high' // low, medium, high, ultra
    this.anisotropicFiltering = isNumber(data.anisotropicFiltering) ? data.anisotropicFiltering : 4 // 1, 2, 4, 8, 16
    this.lodDistance = isNumber(data.lodDistance) ? data.lodDistance : 1.0 // 0.5-2.0
    
    // Post-processing settings
    this.postprocessing = isBoolean(data.postprocessing) ? data.postprocessing : true
    this.bloom = isBoolean(data.bloom) ? data.bloom : true
    this.ao = isBoolean(data.ao) ? data.ao : true
    this.depthOfField = isBoolean(data.depthOfField) ? data.depthOfField : false
    this.motionBlur = isBoolean(data.motionBlur) ? data.motionBlur : false
    this.ssReflections = isBoolean(data.ssReflections) ? data.ssReflections : false
    this.volumetricLighting = isBoolean(data.volumetricLighting) ? data.volumetricLighting : false
    
    // Performance settings
    this.vsync = isBoolean(data.vsync) ? data.vsync : true
    this.frameRateLimit = data.frameRateLimit ? data.frameRateLimit : 'unlimited' // 30, 60, 120, 144, unlimited
    this.resolutionScale = isNumber(data.resolutionScale) ? data.resolutionScale : 1.0 // 0.5-2.0 for performance scaling
    
    // Tone mapping settings
    this.toneMappingMode = data.toneMappingMode ? data.toneMappingMode : 'aces' // none, linear, reinhard, cineon, aces
    this.toneMappingExposure = isNumber(data.toneMappingExposure) ? data.toneMappingExposure : 1.0
    
    // Audio settings
    this.music = isNumber(data.music) ? data.music : 1
    this.sfx = isNumber(data.sfx) ? data.sfx : 1
    this.voice = isNumber(data.voice) ? data.voice : 1
    
    // AAA WebGPU Advanced Features
    // Advanced Materials
    this.materialQuality = data.materialQuality ? data.materialQuality : 'enhanced' // standard, enhanced, aaa, ultra
    this.proceduralMaterials = isBoolean(data.proceduralMaterials) ? data.proceduralMaterials : true
    this.dynamicMaterialLOD = isBoolean(data.dynamicMaterialLOD) ? data.dynamicMaterialLOD : true
    this.materialBatching = isBoolean(data.materialBatching) ? data.materialBatching : true
    
    // Advanced Shadows
    this.cascadedShadowMaps = isBoolean(data.cascadedShadowMaps) ? data.cascadedShadowMaps : true
    this.volumetricShadows = isBoolean(data.volumetricShadows) ? data.volumetricShadows : false
    this.contactShadows = isBoolean(data.contactShadows) ? data.contactShadows : true
    this.temporalShadowFiltering = isBoolean(data.temporalShadowFiltering) ? data.temporalShadowFiltering : true
    this.variableRateShadows = isBoolean(data.variableRateShadows) ? data.variableRateShadows : true
    this.shadowAtlasQuality = data.shadowAtlasQuality ? data.shadowAtlasQuality : 'high' // low, medium, high, ultra
    
    // Advanced Post-Processing
    this.ssgi = isBoolean(data.ssgi) ? data.ssgi : false // Screen Space Global Illumination
    this.taa = isBoolean(data.taa) ? data.taa : true // Temporal Anti-Aliasing
    this.temporalUpsampling = isBoolean(data.temporalUpsampling) ? data.temporalUpsampling : false // DLSS-like
    
    // GPU Profiler & Performance
    this.gpuProfilerOverlay = isBoolean(data.gpuProfilerOverlay) ? data.gpuProfilerOverlay : false
    this.autoOptimization = isBoolean(data.autoOptimization) ? data.autoOptimization : true
    this.performanceWarnings = isBoolean(data.performanceWarnings) ? data.performanceWarnings : true
    this.thermalThrottlingDetection = isBoolean(data.thermalThrottlingDetection) ? data.thermalThrottlingDetection : true
    
    // Compute Shaders (GPU-Driven)
    this.gpuDrivenCulling = isBoolean(data.gpuDrivenCulling) ? data.gpuDrivenCulling : true
    this.gpuParticleSimulation = isBoolean(data.gpuParticleSimulation) ? data.gpuParticleSimulation : true
    this.gpuLODSelection = isBoolean(data.gpuLODSelection) ? data.gpuLODSelection : true
    
    // Ray Tracing (Future Features)
    this.rayTracedReflections = isBoolean(data.rayTracedReflections) ? data.rayTracedReflections : false
    this.rayTracedGlobalIllumination = isBoolean(data.rayTracedGlobalIllumination) ? data.rayTracedGlobalIllumination : false
    this.rayTracedShadows = isBoolean(data.rayTracedShadows) ? data.rayTracedShadows : false
    
    this.v = data.v

    this.changes = null
  }

  preFixedUpdate() {
    if (!this.changes) return
    this.emit('change', this.changes)
    this.changes = null
  }

  modify(key, value) {
    if (this[key] === value) return
    const prev = this[key]
    this[key] = value
    if (!this.changes) this.changes = {}
    if (!this.changes[key]) this.changes[key] = { prev, value: null }
    this.changes[key].value = value
    this.persist()
  }

  async persist() {
    // a small delay to ensure prefs that crash dont persist (eg old iOS with UHD shadows etc)
    await new Promise(resolve => setTimeout(resolve, 2000))
    storage.set('prefs', {
      // Basic settings
      ui: this.ui,
      actions: this.actions,
      stats: this.stats,
      
      // Display settings
      dpr: this.dpr,
      fieldOfView: this.fieldOfView,
      gamma: this.gamma,
      brightness: this.brightness,
      contrast: this.contrast,
      
      // Rendering settings
      renderer: this.renderer,
      shadows: this.shadows,
      antialiasing: this.antialiasing,
      textureQuality: this.textureQuality,
      anisotropicFiltering: this.anisotropicFiltering,
      lodDistance: this.lodDistance,
      
      // Post-processing settings
      postprocessing: this.postprocessing,
      bloom: this.bloom,
      ao: this.ao,
      depthOfField: this.depthOfField,
      motionBlur: this.motionBlur,
      ssReflections: this.ssReflections,
      volumetricLighting: this.volumetricLighting,
      
      // Performance settings
      vsync: this.vsync,
      frameRateLimit: this.frameRateLimit,
      resolutionScale: this.resolutionScale,
      
      // Tone mapping settings
      toneMappingMode: this.toneMappingMode,
      toneMappingExposure: this.toneMappingExposure,
      
      // Audio settings
      music: this.music,
      sfx: this.sfx,
      voice: this.voice,
      
      // AAA WebGPU Advanced Features
      // Advanced Materials
      materialQuality: this.materialQuality,
      proceduralMaterials: this.proceduralMaterials,
      dynamicMaterialLOD: this.dynamicMaterialLOD,
      materialBatching: this.materialBatching,
      
      // Advanced Shadows
      cascadedShadowMaps: this.cascadedShadowMaps,
      volumetricShadows: this.volumetricShadows,
      contactShadows: this.contactShadows,
      temporalShadowFiltering: this.temporalShadowFiltering,
      variableRateShadows: this.variableRateShadows,
      shadowAtlasQuality: this.shadowAtlasQuality,
      
      // Advanced Post-Processing
      ssgi: this.ssgi,
      taa: this.taa,
      temporalUpsampling: this.temporalUpsampling,
      
      // GPU Profiler & Performance
      gpuProfilerOverlay: this.gpuProfilerOverlay,
      autoOptimization: this.autoOptimization,
      performanceWarnings: this.performanceWarnings,
      thermalThrottlingDetection: this.thermalThrottlingDetection,
      
      // Compute Shaders (GPU-Driven)
      gpuDrivenCulling: this.gpuDrivenCulling,
      gpuParticleSimulation: this.gpuParticleSimulation,
      gpuLODSelection: this.gpuLODSelection,
      
      // Ray Tracing (Future Features)
      rayTracedReflections: this.rayTracedReflections,
      rayTracedGlobalIllumination: this.rayTracedGlobalIllumination,
      rayTracedShadows: this.rayTracedShadows,
      
      v: this.v,
    })
  }

  // Basic settings
  setUI(value) {
    this.modify('ui', value)
  }

  setActions(value) {
    this.modify('actions', value)
  }

  setStats(value) {
    this.modify('stats', value)
  }

  // Display settings
  setDPR(value) {
    this.modify('dpr', value)
  }

  setFieldOfView(value) {
    this.modify('fieldOfView', value)
  }

  setGamma(value) {
    this.modify('gamma', value)
  }

  setBrightness(value) {
    this.modify('brightness', value)
  }

  setContrast(value) {
    this.modify('contrast', value)
  }

  // Rendering settings
  setRenderer(value) {
    this.modify('renderer', value)
  }

  setShadows(value) {
    this.modify('shadows', value)
  }

  setAntialiasing(value) {
    this.modify('antialiasing', value)
  }

  setTextureQuality(value) {
    this.modify('textureQuality', value)
  }

  setAnisotropicFiltering(value) {
    this.modify('anisotropicFiltering', value)
  }

  setLODDistance(value) {
    this.modify('lodDistance', value)
  }

  // Post-processing settings
  setPostprocessing(value) {
    this.modify('postprocessing', value)
  }

  setBloom(value) {
    this.modify('bloom', value)
  }

  setAO(value) {
    this.modify('ao', value)
  }

  setDepthOfField(value) {
    this.modify('depthOfField', value)
  }

  setMotionBlur(value) {
    this.modify('motionBlur', value)
  }

  setSSReflections(value) {
    this.modify('ssReflections', value)
  }

  setVolumetricLighting(value) {
    this.modify('volumetricLighting', value)
  }

  // Performance settings
  setVSync(value) {
    this.modify('vsync', value)
  }

  setFrameRateLimit(value) {
    this.modify('frameRateLimit', value)
  }
  
  setResolutionScale(value) {
    this.modify('resolutionScale', value)
  }

  // Tone mapping settings
  setToneMappingMode(value) {
    this.modify('toneMappingMode', value)
  }

  setToneMappingExposure(value) {
    this.modify('toneMappingExposure', value)
  }

  // Audio settings
  setMusic(value) {
    this.modify('music', value)
  }

  setSFX(value) {
    this.modify('sfx', value)
  }

  setVoice(value) {
    this.modify('voice', value)
  }

  // AAA WebGPU Advanced Features
  // Advanced Materials settings
  setMaterialQuality(value) {
    this.modify('materialQuality', value)
  }

  setProceduralMaterials(value) {
    this.modify('proceduralMaterials', value)
  }

  setDynamicMaterialLOD(value) {
    this.modify('dynamicMaterialLOD', value)
  }

  setMaterialBatching(value) {
    this.modify('materialBatching', value)
  }

  // Advanced Shadows settings
  setCascadedShadowMaps(value) {
    this.modify('cascadedShadowMaps', value)
  }

  setVolumetricShadows(value) {
    this.modify('volumetricShadows', value)
  }

  setContactShadows(value) {
    this.modify('contactShadows', value)
  }

  setTemporalShadowFiltering(value) {
    this.modify('temporalShadowFiltering', value)
  }

  setVariableRateShadows(value) {
    this.modify('variableRateShadows', value)
  }

  setShadowAtlasQuality(value) {
    this.modify('shadowAtlasQuality', value)
  }

  // Advanced Post-Processing settings
  setSSGI(value) {
    this.modify('ssgi', value)
  }

  setTAA(value) {
    this.modify('taa', value)
  }

  setTemporalUpsampling(value) {
    this.modify('temporalUpsampling', value)
  }

  // GPU Profiler & Performance settings
  setGPUProfilerOverlay(value) {
    this.modify('gpuProfilerOverlay', value)
  }

  setAutoOptimization(value) {
    this.modify('autoOptimization', value)
  }

  setPerformanceWarnings(value) {
    this.modify('performanceWarnings', value)
  }

  setThermalThrottlingDetection(value) {
    this.modify('thermalThrottlingDetection', value)
  }

  // Compute Shaders (GPU-Driven) settings
  setGPUDrivenCulling(value) {
    this.modify('gpuDrivenCulling', value)
  }

  setGPUParticleSimulation(value) {
    this.modify('gpuParticleSimulation', value)
  }

  setGPULODSelection(value) {
    this.modify('gpuLODSelection', value)
  }

  // Ray Tracing (Future Features) settings
  setRayTracedReflections(value) {
    this.modify('rayTracedReflections', value)
  }

  setRayTracedGlobalIllumination(value) {
    this.modify('rayTracedGlobalIllumination', value)
  }

  setRayTracedShadows(value) {
    this.modify('rayTracedShadows', value)
  }

  destroy() {
    // ...
  }
}
