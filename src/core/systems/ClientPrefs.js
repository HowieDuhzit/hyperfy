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
    this.renderer = data.renderer ? data.renderer : 'auto' // auto, webgpu, webgl
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
    
    // Tone mapping settings
    this.toneMappingMode = data.toneMappingMode ? data.toneMappingMode : 'aces' // none, linear, reinhard, cineon, aces
    this.toneMappingExposure = isNumber(data.toneMappingExposure) ? data.toneMappingExposure : 1.0
    
    // Audio settings
    this.music = isNumber(data.music) ? data.music : 1
    this.sfx = isNumber(data.sfx) ? data.sfx : 1
    this.voice = isNumber(data.voice) ? data.voice : 1
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
      
      // Tone mapping settings
      toneMappingMode: this.toneMappingMode,
      toneMappingExposure: this.toneMappingExposure,
      
      // Audio settings
      music: this.music,
      sfx: this.sfx,
      voice: this.voice,
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

  destroy() {
    // ...
  }
}
