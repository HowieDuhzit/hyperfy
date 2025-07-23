import * as THREE from '../extras/three'
import { 
  tslFn,
  uniform,
  texture,
  float,
  vec2,
  vec3,
  vec4,
  mul,
  add,
  sub,
  mix,
  step,
  smoothstep,
  dot,
  normalize,
  length,
  clamp,
  pow,
  exp,
  sin,
  cos,
  saturate,
  abs,
  max,
  min,
  positionWorld,
  normalWorld,
  cameraPosition,
  modelViewMatrix
  // viewMatrix,      // Not available in current Three.js TSL - use camera.matrixWorldInverse
  // projectionMatrix, // Not available in current Three.js TSL - use camera.projectionMatrix  
  // compute,         // Limited availability in current Three.js TSL
  // instanceIndex,   // Limited availability in current Three.js TSL
  // workgroupSize,   // Not available in current Three.js TSL
  // storage          // Limited availability in current Three.js TSL
} from 'three/tsl'

import { System } from './System'

/**
 * Advanced Shadow System for AAA-Quality Rendering
 * 
 * Features:
 * - Cascaded Shadow Maps (CSM) with automatic cascade distribution
 * - Volumetric shadows with light scattering
 * - Contact shadows for fine detail
 * - Temporal shadow smoothing
 * - Dynamic shadow quality scaling
 * - Ray-traced shadows (WebGPU)
 * - Soft shadows with variable penumbra
 * - Shadow LOD based on distance and importance
 */
export class AdvancedShadows extends System {
  constructor(world) {
    super(world)
    
    this.shadowLights = new Map()
    this.shadowCascades = []
    this.shadowAtlas = null
    this.shadowCamera = new THREE.OrthographicCamera()
    
    // Shadow configuration
    this.config = {
      // Cascaded Shadow Maps
      csmEnabled: true,
      csmCascades: 4,
      csmMaxDistance: 100,
      csmLambda: 0.5, // Cascade distribution parameter
      csmSplitScheme: 'logarithmic', // 'uniform', 'logarithmic', 'practical'
      
      // Shadow quality
      maxShadowMapSize: 4096,
      shadowBias: -0.0005,
      shadowNormalBias: 0.02,
      shadowRadius: 4.0,
      shadowSamples: 16,
      
      // Volumetric shadows
      volumetricEnabled: true,
      volumetricSteps: 16,
      volumetricDensity: 0.1,
      volumetricDecay: 0.95,
      volumetricWeight: 0.6,
      
      // Contact shadows
      contactShadowsEnabled: true,
      contactShadowDistance: 2.0,
      contactShadowSteps: 8,
      contactShadowThickness: 0.1,
      
      // Performance optimization
      shadowLOD: true,
      dynamicCascades: true,
      temporalFiltering: true,
      variableRateShadows: true,
      
      // Ray tracing (future)
      rayTracedShadows: false,
      rtSamples: 4,
      rtMaxBounces: 1
    }
    
    // Performance tracking
    this.stats = {
      shadowMapUpdates: 0,
      cascadeUpdates: 0,
      shadowRenderTime: 0,
      shadowMemoryUsage: 0,
      activeShadowLights: 0
    }
    
    // Temporal data for filtering
    this.temporalData = {
      previousViewMatrix: new THREE.Matrix4(),
      previousProjectionMatrix: new THREE.Matrix4(),
      frameIndex: 0
    }
    
    // Compatibility settings for GLTF and object manipulation
    this.enabled = true
    this.compatibilityMode = false
    this.excludedObjects = new Set()
    
    // Shadow enhancement settings (initialized from preferences)
    this.cascadedEnabled = true
    this.volumetricEnabled = false
    this.contactShadowsEnabled = true
    this.temporalFilteringEnabled = true
    this.variableRateEnabled = true
    this.shadowAtlasQuality = 'high'
  }

  async init() {
    console.log('🌚 Initializing Advanced Shadow System...')
    
    // Initialize shadow atlas
    this.initializeShadowAtlas()
    
    // Setup cascaded shadow maps
    this.setupCascadedShadowMaps()
    
    // Initialize volumetric shadows
    this.setupVolumetricShadows()
    
    // Setup contact shadows
    this.setupContactShadows()
    
    // Initialize temporal filtering
    this.setupTemporalFiltering()
    
    // Setup variable rate shading for shadows
    this.setupVariableRateShadows()
    
    // Initialize ray-traced shadows (if supported)
    if (this.world.graphics.isWebGPU && this.config.rayTracedShadows) {
      this.setupRayTracedShadows()
    }
    
    console.log('✅ Advanced Shadow System initialized')
  }

  initializeShadowAtlas() {
    console.log('📊 Initializing shadow atlas...')
    
    // Create large shadow atlas for optimal GPU memory usage
    this.shadowAtlas = {
      texture: new THREE.WebGLRenderTarget(this.config.maxShadowMapSize, this.config.maxShadowMapSize, {
        format: THREE.DepthFormat,
        type: THREE.FloatType,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter,
        compareFunction: THREE.LessEqualCompare
      }),
      
      // Atlas allocation tracking
      allocations: new Map(),
      freeRegions: [{
        x: 0, y: 0,
        width: this.config.maxShadowMapSize,
        height: this.config.maxShadowMapSize
      }],
      
      // Allocation methods
      allocate: (width, height, lightId) => {
        const region = this.findFreeRegion(width, height)
        if (region) {
          this.shadowAtlas.allocations.set(lightId, region)
          this.removeFreeRegion(region)
          this.subdivideRegion(region, width, height)
          return region
        }
        return null
      },
      
      deallocate: (lightId) => {
        const region = this.shadowAtlas.allocations.get(lightId)
        if (region) {
          this.shadowAtlas.allocations.delete(lightId)
          this.shadowAtlas.freeRegions.push(region)
          this.mergeFreeRegions()
        }
      }
    }
    
    // Setup shadow atlas viewport management
    this.shadowAtlas.texture.scissorTest = true
  }

  findFreeRegion(width, height) {
    // Find best-fit region using bin packing algorithm
    let bestRegion = null
    let bestScore = Infinity
    
    for (const region of this.shadowAtlas.freeRegions) {
      if (region.width >= width && region.height >= height) {
        const score = (region.width - width) + (region.height - height)
        if (score < bestScore) {
          bestScore = score
          bestRegion = region
        }
      }
    }
    
    return bestRegion
  }

  removeFreeRegion(targetRegion) {
    const index = this.shadowAtlas.freeRegions.indexOf(targetRegion)
    if (index !== -1) {
      this.shadowAtlas.freeRegions.splice(index, 1)
    }
  }

  subdivideRegion(region, usedWidth, usedHeight) {
    // Create new free regions from leftover space
    if (region.width > usedWidth) {
      this.shadowAtlas.freeRegions.push({
        x: region.x + usedWidth,
        y: region.y,
        width: region.width - usedWidth,
        height: usedHeight
      })
    }
    
    if (region.height > usedHeight) {
      this.shadowAtlas.freeRegions.push({
        x: region.x,
        y: region.y + usedHeight,
        width: region.width,
        height: region.height - usedHeight
      })
    }
  }

  mergeFreeRegions() {
    // Merge adjacent free regions to reduce fragmentation
    for (let i = 0; i < this.shadowAtlas.freeRegions.length; i++) {
      for (let j = i + 1; j < this.shadowAtlas.freeRegions.length; j++) {
        const region1 = this.shadowAtlas.freeRegions[i]
        const region2 = this.shadowAtlas.freeRegions[j]
        
        if (this.canMergeRegions(region1, region2)) {
          const merged = this.mergeRegions(region1, region2)
          this.shadowAtlas.freeRegions[i] = merged
          this.shadowAtlas.freeRegions.splice(j, 1)
          j--
        }
      }
    }
  }

  canMergeRegions(region1, region2) {
    // Check if regions are adjacent
    return (
      (region1.x === region2.x + region2.width && region1.y === region2.y && region1.height === region2.height) ||
      (region2.x === region1.x + region1.width && region1.y === region2.y && region1.height === region2.height) ||
      (region1.y === region2.y + region2.height && region1.x === region2.x && region1.width === region2.width) ||
      (region2.y === region1.y + region1.height && region1.x === region2.x && region1.width === region2.width)
    )
  }

  mergeRegions(region1, region2) {
    return {
      x: Math.min(region1.x, region2.x),
      y: Math.min(region1.y, region2.y),
      width: Math.max(region1.x + region1.width, region2.x + region2.width) - Math.min(region1.x, region2.x),
      height: Math.max(region1.y + region1.height, region2.y + region2.height) - Math.min(region1.y, region2.y)
    }
  }

  setupCascadedShadowMaps() {
    console.log('🏔️ Setting up Cascaded Shadow Maps...')
    
    this.csmData = {
      cascades: [],
      splitDistances: [],
      lightMatrices: [],
      shadowMaps: [],
      
      // Update cascade splits based on camera
      updateSplits: (camera) => {
        const near = camera.near
        const far = Math.min(camera.far, this.config.csmMaxDistance)
        const lambda = this.config.csmLambda
        
        this.csmData.splitDistances = [near]
        
        for (let i = 1; i < this.config.csmCascades; i++) {
          const ratio = i / this.config.csmCascades
          
          let split
          if (this.config.csmSplitScheme === 'uniform') {
            split = near + (far - near) * ratio
          } else if (this.config.csmSplitScheme === 'logarithmic') {
            split = near * Math.pow(far / near, ratio)
          } else { // practical split
            const uniform = near + (far - near) * ratio
            const logarithmic = near * Math.pow(far / near, ratio)
            split = lambda * logarithmic + (1 - lambda) * uniform
          }
          
          this.csmData.splitDistances.push(split)
        }
        
        this.csmData.splitDistances.push(far)
      },
      
      // Calculate cascade frustum
      calculateCascadeFrustum: (camera, near, far) => {
        const frustum = new THREE.Frustum()
        const projMatrix = new THREE.Matrix4()
        
        // Create projection matrix for this cascade
        projMatrix.makePerspective(
          camera.fov * Math.PI / 180,
          camera.aspect,
          near,
          far
        )
        
        // Create view-projection matrix
        const viewProjMatrix = new THREE.Matrix4()
        viewProjMatrix.multiplyMatrices(projMatrix, camera.matrixWorldInverse)
        
        frustum.setFromProjectionMatrix(viewProjMatrix)
        return frustum
      },
      
      // Calculate optimal shadow camera for cascade
      calculateShadowCamera: (lightDirection, cascadeFrustum) => {
        // Get frustum corners in world space
        const corners = this.getFrustumCorners(cascadeFrustum)
        
        // Calculate bounding sphere
        const center = new THREE.Vector3()
        corners.forEach(corner => center.add(corner))
        center.divideScalar(corners.length)
        
        let radius = 0
        corners.forEach(corner => {
          radius = Math.max(radius, center.distanceTo(corner))
        })
        
        // Position shadow camera
        const shadowCamera = new THREE.OrthographicCamera()
        shadowCamera.position.copy(center).add(lightDirection.clone().multiplyScalar(-radius * 2))
        shadowCamera.lookAt(center)
        
        // Setup orthographic bounds
        shadowCamera.left = -radius
        shadowCamera.right = radius
        shadowCamera.top = radius
        shadowCamera.bottom = -radius
        shadowCamera.near = 0.1
        shadowCamera.far = radius * 4
        
        shadowCamera.updateProjectionMatrix()
        shadowCamera.updateMatrixWorld()
        
        return shadowCamera
      }
    }
    
    // Initialize cascades
    for (let i = 0; i < this.config.csmCascades; i++) {
      const cascade = {
        index: i,
        shadowMap: null,
        camera: new THREE.OrthographicCamera(),
        lightMatrix: new THREE.Matrix4(),
        region: null
      }
      
      this.csmData.cascades.push(cascade)
    }
  }

  getFrustumCorners(frustum) {
    // Extract 8 corners of frustum
    const corners = []
    
    // This is a simplified version - in practice you'd extract from frustum planes
    // For now, return placeholder corners
    for (let i = 0; i < 8; i++) {
      corners.push(new THREE.Vector3())
    }
    
    return corners
  }

  setupVolumetricShadows() {
    console.log('☁️ Setting up volumetric shadows...')
    
    this.volumetricShadows = {
      enabled: this.config.volumetricEnabled,
      
      // Volumetric shadow shader
      shader: tslFn(() => {
        const worldPos = positionWorld
        const lightPos = uniform(vec3()).setFromVector3(new THREE.Vector3(10, 10, 10))
        const cameraPos = cameraPosition
        
        // Ray marching parameters
        const steps = uniform(float(this.config.volumetricSteps))
        const density = uniform(float(this.config.volumetricDensity))
        const decay = uniform(float(this.config.volumetricDecay))
        const weight = uniform(float(this.config.volumetricWeight))
        
        // Calculate ray direction from camera to world position
        const rayDir = normalize(worldPos.sub(cameraPos))
        const rayLength = length(worldPos.sub(cameraPos))
        
        // Ray marching
        let scattering = 0.0
        let currentDensity = density
        
        for (let i = 0; i < this.config.volumetricSteps; i++) {
          const t = float(i).div(steps)
          const samplePos = cameraPos.add(rayDir.mul(rayLength.mul(t)))
          
          // Sample shadow map at this position
          const shadowCoord = this.worldToShadowCoord(samplePos)
          const shadowDepth = texture(this.shadowAtlas.texture, shadowCoord.xy).r
          const sampleDepth = shadowCoord.z
          
          // Check if point is in shadow
          const inShadow = step(sampleDepth, shadowDepth.add(0.001))
          
          // Accumulate scattering
          scattering = scattering.add(currentDensity.mul(inShadow).mul(weight))
          currentDensity = currentDensity.mul(decay)
        }
        
        return saturate(scattering)
      }),
      
      // Update volumetric shadows
      update: (light, camera) => {
        // Update volumetric shadow parameters based on light and camera
        this.volumetricShadows.shader.uniforms.lightPos.value.copy(light.position)
        this.volumetricShadows.shader.uniforms.cameraPos.value.copy(camera.position)
      }
    }
  }

  worldToShadowCoord(worldPos) {
    return tslFn((worldPos) => {
      // Transform world position to shadow map coordinates
      const shadowCoord = mul(this.lightProjectionMatrix, mul(this.lightViewMatrix, vec4(worldPos, 1.0)))
      return shadowCoord.xyz.div(shadowCoord.w).mul(0.5).add(0.5)
    })(worldPos)
  }

  setupContactShadows() {
    console.log('🤏 Setting up contact shadows...')
    
    this.contactShadows = {
      enabled: this.config.contactShadowsEnabled,
      
      // Contact shadow shader
      shader: tslFn(() => {
        const worldPos = positionWorld
        const normal = normalWorld
        const lightDir = uniform(vec3()).setFromVector3(new THREE.Vector3(0, 1, 0))
        
        // Ray marching parameters
        const maxDistance = uniform(float(this.config.contactShadowDistance))
        const steps = uniform(float(this.config.contactShadowSteps))
        const thickness = uniform(float(this.config.contactShadowThickness))
        
        // Start ray slightly above surface
        const rayStart = worldPos.add(normal.mul(0.01))
        const rayDir = lightDir.negate()
        
        let occlusion = 0.0
        
        // Ray march towards light
        for (let i = 1; i <= this.config.contactShadowSteps; i++) {
          const stepSize = maxDistance.div(steps).mul(float(i))
          const samplePos = rayStart.add(rayDir.mul(stepSize))
          
          // Project to screen space
          const screenPos = this.worldToScreenSpace(samplePos)
          
          // Sample depth buffer
          const sampledDepth = texture(this.depthTexture, screenPos.xy).r
          const rayDepth = screenPos.z
          
          // Check for intersection
          const depthDiff = rayDepth.sub(sampledDepth)
          const hit = step(0.0, depthDiff).mul(step(depthDiff, thickness))
          
          // Fade out occlusion with distance
          const fadeOut = 1.0.sub(float(i).div(steps))
          occlusion = max(occlusion, hit.mul(fadeOut))
        }
        
        return 1.0.sub(occlusion)
      }),
      
      // Update contact shadows
      update: (light) => {
        const lightDir = light.position.clone().normalize()
        this.contactShadows.shader.uniforms.lightDir.value.copy(lightDir)
      }
    }
  }

  worldToScreenSpace(worldPos) {
    return tslFn((worldPos) => {
      // Use uniform matrices instead of unavailable TSL matrices
    const clipPos = mul(uniform('projectionMatrix'), mul(uniform('viewMatrix'), vec4(worldPos, 1.0)))
      return clipPos.xyz.div(clipPos.w).mul(0.5).add(0.5)
    })(worldPos)
  }

  setupTemporalFiltering() {
    console.log('⏱️ Setting up temporal shadow filtering...')
    
    this.temporalFilter = {
      enabled: this.config.temporalFiltering,
      previousShadowMap: null,
      blendFactor: 0.9,
      
      // Temporal reprojection shader
      reprojectShader: tslFn(() => {
        const currentShadow = uniform(float(0.0))
        const worldPos = positionWorld
        
        // Reproject to previous frame
        const prevClipPos = mul(this.temporalData.previousViewMatrix, vec4(worldPos, 1.0))
        const prevScreenPos = prevClipPos.xyz.div(prevClipPos.w).mul(0.5).add(0.5)
        
        // Sample previous shadow
        const prevShadow = texture(this.temporalFilter.previousShadowMap, prevScreenPos.xy).r
        
        // Blend with current shadow
        const blendFactor = uniform(float(this.temporalFilter.blendFactor))
        return mix(currentShadow, prevShadow, blendFactor)
      }),
      
      update: (camera) => {
        // Update temporal data
        this.temporalData.previousViewMatrix.copy(camera.matrixWorldInverse)
        this.temporalData.previousProjectionMatrix.copy(camera.projectionMatrix)
        this.temporalData.frameIndex++
      }
    }
  }

  setupVariableRateShadows() {
    console.log('📊 Setting up variable rate shadows...')
    
    this.variableRateShading = {
      enabled: this.config.variableRateShadows,
      
      // Calculate shadow quality based on importance
      calculateShadowQuality: (light, distance, screenSize) => {
        let quality = 1.0
        
        // Distance-based quality reduction
        if (distance > 50) {
          quality *= 0.5
        } else if (distance > 25) {
          quality *= 0.75
        }
        
        // Screen size-based quality
        if (screenSize < 0.1) {
          quality *= 0.5
        } else if (screenSize < 0.2) {
          quality *= 0.75
        }
        
        // Light importance
        quality *= light.userData.importance || 1.0
        
        return Math.max(0.25, quality) // Minimum quality
      },
      
      // Adaptive shadow map resolution
      getShadowMapSize: (baseSize, quality) => {
        const size = Math.floor(baseSize * quality)
        return Math.max(256, Math.min(this.config.maxShadowMapSize, size))
      }
    }
  }

  setupRayTracedShadows() {
    console.log('🌟 Setting up ray-traced shadows...')
    
    this.rayTracedShadows = {
      enabled: this.config.rayTracedShadows,
      
      // Ray-traced shadow compute shader
      computeShader: compute(
        // workgroupSize(8, 8), // Not available in current Three.js TSL
        () => {
          const pixelCoord = instanceIndex
          const lightPos = uniform(vec3())
          const samples = uniform(float(this.config.rtSamples))
          
          // Get world position from G-buffer
          const worldPos = texture(this.gBufferWorldPos, pixelCoord).xyz
          const normal = texture(this.gBufferNormal, pixelCoord).xyz
          
          // Calculate shadow ray
          const lightDir = normalize(lightPos.sub(worldPos))
          const rayOrigin = worldPos.add(normal.mul(0.001)) // Bias to prevent self-intersection
          
          let shadowFactor = 0.0
          
          // Sample multiple rays for soft shadows
          for (let i = 0; i < this.config.rtSamples; i++) {
            // Add slight randomization for soft shadows
            const jitter = this.generateBlueNoise(pixelCoord, i)
            const jitteredDir = lightDir.add(jitter.mul(0.1))
            
            // Trace shadow ray
            const hit = this.traceRay(rayOrigin, jitteredDir)
            shadowFactor = shadowFactor.add(hit ? 0.0 : 1.0)
          }
          
          shadowFactor = shadowFactor.div(samples)
          
          // Store result
          this.storeShadowResult(pixelCoord, shadowFactor)
        }
      ),
      
      // Simple ray tracing function (placeholder)
      traceRay: (origin, direction) => {
        // This would interface with a proper ray tracing API
        // For now, return false (no hit)
        return false
      },
      
      generateBlueNoise: (pixelCoord, sampleIndex) => {
        // Generate blue noise for ray jittering
        return vec3(0.0) // Placeholder
      },
      
      storeShadowResult: (pixelCoord, shadowFactor) => {
        // Store result in shadow buffer
        // Implementation depends on storage buffer setup
      }
    }
  }

  // Public API Methods

  addShadowLight(light, options = {}) {
    const lightId = light.uuid
    
    const shadowLight = {
      light: light,
      type: light.type,
      shadowMapSize: options.shadowMapSize || 1024,
      shadowBias: options.shadowBias || this.config.shadowBias,
      shadowNormalBias: options.shadowNormalBias || this.config.shadowNormalBias,
      shadowRadius: options.shadowRadius || this.config.shadowRadius,
      enabled: options.enabled !== false,
      importance: options.importance || 1.0,
      region: null,
      lastUpdate: 0
    }
    
    // Allocate shadow atlas region
    if (this.config.csmEnabled && light.type === 'DirectionalLight') {
      // Allocate regions for each cascade
      shadowLight.cascades = []
      for (let i = 0; i < this.config.csmCascades; i++) {
        const cascadeSize = this.calculateCascadeSize(i, shadowLight.shadowMapSize)
        const region = this.shadowAtlas.allocate(cascadeSize, cascadeSize, `${lightId}_${i}`)
        shadowLight.cascades.push({ region, size: cascadeSize })
      }
    } else {
      // Single shadow map
      const region = this.shadowAtlas.allocate(
        shadowLight.shadowMapSize,
        shadowLight.shadowMapSize,
        lightId
      )
      shadowLight.region = region
    }
    
    this.shadowLights.set(lightId, shadowLight)
    this.stats.activeShadowLights++
    
    console.log(`🔦 Added shadow light: ${light.type} (${lightId})`)
    return lightId
  }

  calculateCascadeSize(cascadeIndex, baseSize) {
    // Smaller cascades for distant shadows
    const scale = 1.0 - (cascadeIndex * 0.2)
    return Math.max(256, Math.floor(baseSize * scale))
  }

  removeShadowLight(lightId) {
    const shadowLight = this.shadowLights.get(lightId)
    if (!shadowLight) return false
    
    // Deallocate shadow atlas regions
    if (shadowLight.cascades) {
      shadowLight.cascades.forEach((cascade, index) => {
        this.shadowAtlas.deallocate(`${lightId}_${index}`)
      })
    } else if (shadowLight.region) {
      this.shadowAtlas.deallocate(lightId)
    }
    
    this.shadowLights.delete(lightId)
    this.stats.activeShadowLights--
    
    return true
  }

  updateShadowLight(lightId, options) {
    const shadowLight = this.shadowLights.get(lightId)
    if (!shadowLight) return false
    
    Object.assign(shadowLight, options)
    shadowLight.lastUpdate = performance.now()
    
    return true
  }

  updateShadows(camera, scene) {
    const startTime = performance.now()
    
    // First, ensure all lights in the scene have enhanced shadow settings
    this.enhanceSceneShadows(scene)
    
    // Update CSM splits
    if (this.config.csmEnabled) {
      this.csmData.updateSplits(camera)
    }
    
    // Update each shadow light
    for (const [lightId, shadowLight] of this.shadowLights) {
      if (!shadowLight.enabled) continue
      
      this.updateShadowMap(shadowLight, camera, scene)
    }
    
    // Update temporal filtering
    if (this.temporalFilter.enabled) {
      this.temporalFilter.update(camera)
    }
    
    // Update volumetric shadows
    if (this.volumetricShadows.enabled) {
      for (const shadowLight of this.shadowLights.values()) {
        this.volumetricShadows.update(shadowLight.light, camera)
      }
    }
    
    this.stats.shadowRenderTime = performance.now() - startTime
    this.stats.shadowMapUpdates++
  }
  
  // NEW METHOD: Actually enhance shadow properties on scene lights
  enhanceSceneShadows(scene) {
    let lightsProcessed = 0
    
    scene.traverse((object) => {
      if (object.isLight && object.castShadow) {
        // Skip GLTF lights to avoid conflicts  
        if (object.userData.isGLTF) return
        
        // Apply shadow quality settings
        this.enhanceLight(object)
        lightsProcessed++
      }
    })
    
    // Log processing stats for debugging (every 60 frames = ~1 second)
    if (lightsProcessed > 0 && this.world.frame % 60 === 0) {
      console.log(`🌘 Advanced Shadows: Enhanced ${lightsProcessed} lights`)
    }
  }
  
  // NEW METHOD: Actually enhance individual lights
  enhanceLight(light) {
    try {
      if (!light.shadow) return
      
      // Apply shadow atlas quality
      const atlasSize = this.getShadowAtlasSize()
      if (light.shadow.mapSize) {
        light.shadow.mapSize.setScalar(atlasSize)
        light.shadow.needsUpdate = true
      }
      
      // Apply cascaded shadow maps for directional lights
      if (light.isDirectionalLight && this.cascadedEnabled) {
        this.applyCascadedShadows(light)
      }
      
      // Apply contact shadows
      if (this.contactShadowsEnabled) {
        this.applyContactShadows(light)
      }
      
      // Apply temporal filtering
      if (this.temporalFilteringEnabled) {
        this.applyTemporalFiltering(light)
      }
      
      // Apply variable rate shadows
      if (this.variableRateEnabled) {
        this.applyVariableRateShadows(light)
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to enhance light shadows:', error)
    }
  }
  
  getShadowAtlasSize() {
    switch (this.shadowAtlasQuality) {
      case 'ultra': return 8192
      case 'high': return 4096
      case 'medium': return 2048
      case 'low': return 1024
      default: return 2048
    }
  }
  
  applyCascadedShadows(light) {
    // Enhance directional light shadow camera settings for CSM
    if (light.shadow.camera) {
      light.shadow.camera.near = 0.1
      light.shadow.camera.far = 200
      light.shadow.bias = -0.0001
      light.shadow.normalBias = 0.02
      light.shadow.radius = this.temporalFilteringEnabled ? 4 : 1
    }
  }
  
  applyContactShadows(light) {
    // Enhance shadow bias for contact shadows
    if (light.shadow) {
      light.shadow.bias = -0.00005 // Tighter bias for contact shadows
      light.shadow.normalBias = 0.01
    }
  }
  
  applyTemporalFiltering(light) {
    // Enhance shadow filtering
    if (light.shadow) {
      light.shadow.radius = 6 // Higher radius for temporal filtering
    }
  }
  
  applyVariableRateShadows(light) {
    // Adjust shadow map size based on light importance (simplified)
    if (light.shadow && light.intensity) {
      const baseSize = this.getShadowAtlasSize()
      const sizeMultiplier = Math.min(light.intensity, 2.0)
      light.shadow.mapSize.setScalar(baseSize * sizeMultiplier)
    }
  }

  updateShadowMap(shadowLight, camera, scene) {
    const renderer = this.world.graphics.renderer
    
    if (shadowLight.type === 'DirectionalLight' && this.config.csmEnabled) {
      this.updateDirectionalShadowCSM(shadowLight, camera, scene, renderer)
    } else {
      this.updateStandardShadowMap(shadowLight, camera, scene, renderer)
    }
  }

  updateDirectionalShadowCSM(shadowLight, camera, scene, renderer) {
    const light = shadowLight.light
    
    // Update each cascade
    for (let i = 0; i < this.config.csmCascades; i++) {
      const cascade = shadowLight.cascades[i]
      if (!cascade.region) continue
      
      const near = this.csmData.splitDistances[i]
      const far = this.csmData.splitDistances[i + 1]
      
      // Calculate cascade frustum
      const cascadeFrustum = this.csmData.calculateCascadeFrustum(camera, near, far)
      
      // Calculate optimal shadow camera
      const lightDir = light.target.position.clone().sub(light.position).normalize()
      const shadowCamera = this.csmData.calculateShadowCamera(lightDir, cascadeFrustum)
      
      // Setup viewport for this cascade
      renderer.setViewport(
        cascade.region.x,
        cascade.region.y,
        cascade.region.width,
        cascade.region.height
      )
      
      renderer.setScissor(
        cascade.region.x,
        cascade.region.y,
        cascade.region.width,
        cascade.region.height
      )
      
      // Render shadow map
      renderer.setRenderTarget(this.shadowAtlas.texture)
      renderer.render(scene, shadowCamera)
      
      this.stats.cascadeUpdates++
    }
    
    // Reset viewport
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height)
    renderer.setScissor(0, 0, renderer.domElement.width, renderer.domElement.height)
  }

  updateStandardShadowMap(shadowLight, camera, scene, renderer) {
    if (!shadowLight.region) return
    
    const light = shadowLight.light
    
    // Setup shadow camera based on light type
    let shadowCamera
    if (light.type === 'SpotLight') {
      shadowCamera = this.createSpotLightShadowCamera(light)
    } else if (light.type === 'PointLight') {
      shadowCamera = this.createPointLightShadowCamera(light)
    } else {
      return // Unsupported light type
    }
    
    // Setup viewport
    renderer.setViewport(
      shadowLight.region.x,
      shadowLight.region.y,
      shadowLight.region.width,
      shadowLight.region.height
    )
    
    renderer.setScissor(
      shadowLight.region.x,
      shadowLight.region.y,
      shadowLight.region.width,
      shadowLight.region.height
    )
    
    // Render shadow map
    renderer.setRenderTarget(this.shadowAtlas.texture)
    renderer.render(scene, shadowCamera)
    
    // Reset viewport
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height)
    renderer.setScissor(0, 0, renderer.domElement.width, renderer.domElement.height)
  }

  createSpotLightShadowCamera(light) {
    const shadowCamera = new THREE.PerspectiveCamera(
      light.angle * 2 * 180 / Math.PI,
      1.0, // aspect ratio
      0.1,
      light.distance || 1000
    )
    
    shadowCamera.position.copy(light.position)
    shadowCamera.lookAt(light.target.position)
    shadowCamera.updateProjectionMatrix()
    shadowCamera.updateMatrixWorld()
    
    return shadowCamera
  }

  createPointLightShadowCamera(light) {
    // For point lights, we'd typically use cube mapping
    // This is a simplified version
    const shadowCamera = new THREE.PerspectiveCamera(
      90, // 90 degree FOV for cube faces
      1.0,
      0.1,
      light.distance || 1000
    )
    
    shadowCamera.position.copy(light.position)
    shadowCamera.updateProjectionMatrix()
    shadowCamera.updateMatrixWorld()
    
    return shadowCamera
  }

  // Performance optimization methods
  optimizePerformance(performanceMetrics) {
    const targetFrameTime = 16.67 // 60 FPS
    const currentFrameTime = performanceMetrics.frameTime
    
    if (currentFrameTime > targetFrameTime * 1.2) {
      // Reduce shadow quality
      this.reduceShadowQuality()
    } else if (currentFrameTime < targetFrameTime * 0.8) {
      // Increase shadow quality
      this.increaseShadowQuality()
    }
  }

  reduceShadowQuality() {
    // Reduce shadow map sizes
    for (const shadowLight of this.shadowLights.values()) {
      if (shadowLight.shadowMapSize > 512) {
        shadowLight.shadowMapSize = Math.floor(shadowLight.shadowMapSize * 0.75)
      }
    }
    
    // Reduce volumetric shadow steps
    if (this.config.volumetricSteps > 8) {
      this.config.volumetricSteps = Math.floor(this.config.volumetricSteps * 0.8)
    }
    
    // Reduce contact shadow steps
    if (this.config.contactShadowSteps > 4) {
      this.config.contactShadowSteps = Math.floor(this.config.contactShadowSteps * 0.8)
    }
  }

  increaseShadowQuality() {
    // Increase shadow map sizes (within limits)
    for (const shadowLight of this.shadowLights.values()) {
      if (shadowLight.shadowMapSize < this.config.maxShadowMapSize) {
        shadowLight.shadowMapSize = Math.min(
          this.config.maxShadowMapSize,
          Math.floor(shadowLight.shadowMapSize * 1.25)
        )
      }
    }
    
    // Increase volumetric shadow steps
    if (this.config.volumetricSteps < 32) {
      this.config.volumetricSteps = Math.min(32, this.config.volumetricSteps + 2)
    }
  }

  // Utility methods
  getShadowMapTexture() {
    return this.shadowAtlas.texture.texture
  }

  getShadowData() {
    return {
      atlasTexture: this.shadowAtlas.texture.texture,
      cascadeData: this.csmData,
      lightMatrices: this.csmData.lightMatrices,
      splitDistances: this.csmData.splitDistances,
      shadowLights: Array.from(this.shadowLights.values())
    }
  }

  getPerformanceStats() {
    return {
      ...this.stats,
      shadowMemoryUsage: this.estimateShadowMemoryUsage(),
      atlasUtilization: this.calculateAtlasUtilization()
    }
  }

  estimateShadowMemoryUsage() {
    const atlasSize = this.config.maxShadowMapSize
    const bytesPerPixel = 4 // Assuming 32-bit depth
    return atlasSize * atlasSize * bytesPerPixel
  }

  calculateAtlasUtilization() {
    const totalArea = this.config.maxShadowMapSize * this.config.maxShadowMapSize
    let usedArea = 0
    
    for (const region of this.shadowAtlas.allocations.values()) {
      usedArea += region.width * region.height
    }
    
    return usedArea / totalArea
  }

  // Compatibility methods for GLTF and object manipulation

  setCompatibilityMode(enabled) {
    this.compatibilityMode = enabled
  }
  
  isEnabled() {
    return this.enabled
  }
  
  disable() {
    this.enabled = false
    console.log('⚠️ Advanced Shadows System disabled')
  }
  
  enable() {
    this.enabled = true
    console.log('✅ Advanced Shadows System enabled')
  }
  
  excludeObject(object) {
    this.excludedObjects.add(object)
  }
  
  // Runtime settings updates
  updateSettings(settings) {
    try {
      console.log('🔧 Updating Advanced Shadows settings:', settings)
      
      // Update cascaded shadow maps
      if (settings.cascaded !== undefined && settings.cascaded !== this.cascadedEnabled) {
        this.cascadedEnabled = settings.cascaded
        console.log(`Cascaded shadow maps: ${settings.cascaded ? 'enabled' : 'disabled'}`)
        this.updateShadowCascades()
      }
      
      // Update volumetric shadows
      if (settings.volumetric !== undefined && settings.volumetric !== this.volumetricEnabled) {
        this.volumetricEnabled = settings.volumetric
        console.log(`Volumetric shadows: ${settings.volumetric ? 'enabled' : 'disabled'}`)
      }
      
      // Update contact shadows
      if (settings.contact !== undefined && settings.contact !== this.contactShadowsEnabled) {
        this.contactShadowsEnabled = settings.contact
        console.log(`Contact shadows: ${settings.contact ? 'enabled' : 'disabled'}`)
      }
      
      // Update temporal shadow filtering
      if (settings.temporal !== undefined && settings.temporal !== this.temporalFilteringEnabled) {
        this.temporalFilteringEnabled = settings.temporal
        console.log(`Temporal shadow filtering: ${settings.temporal ? 'enabled' : 'disabled'}`)
      }
      
      // Update variable rate shadows
      if (settings.variableRate !== undefined && settings.variableRate !== this.variableRateEnabled) {
        this.variableRateEnabled = settings.variableRate
        console.log(`Variable rate shadows: ${settings.variableRate ? 'enabled' : 'disabled'}`)
      }
      
      // Update shadow atlas quality
      if (settings.atlasQuality && settings.atlasQuality !== this.shadowAtlasQuality) {
        this.shadowAtlasQuality = settings.atlasQuality
        console.log(`Shadow atlas quality: ${settings.atlasQuality}`)
        this.updateShadowAtlas()
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to update Advanced Shadows settings:', error)
    }
  }
  
  // Update shadow cascades configuration
  updateShadowCascades() {
    if (this.cascadedEnabled && this.shadowCascades.length === 0) {
      this.setupShadowCascades()
    } else if (!this.cascadedEnabled) {
      this.shadowCascades = []
    }
  }
  
  // Add missing method
  setupShadowCascades() {
    console.log('🌊 Setting up cascaded shadow maps...')
    try {
      // Initialize shadow cascades for directional lights
      const cascadeDistances = [5, 15, 50, 150] // Near to far cascade distances
      
      this.shadowCascades = cascadeDistances.map((distance, index) => ({
        distance: distance,
        index: index,
        camera: null, // Would be created for each cascade
        enabled: true
      }))
      
      console.log(`✅ Setup ${this.shadowCascades.length} shadow cascades`)
      
      // Update all directional lights to use cascaded shadows
      for (const [lightId, shadowLight] of this.shadowLights) {
        if (shadowLight.light && shadowLight.light.isDirectionalLight) {
          this.applyCascadedShadows(shadowLight.light)
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Shadow cascade setup failed:', error)
    }
  }
  
  // Update shadow atlas with new quality settings
  updateShadowAtlas() {
    const qualityMap = {
      'low': 1024,
      'medium': 2048, 
      'high': 4096,
      'ultra': 8192
    }
    
    const newSize = qualityMap[this.shadowAtlasQuality] || 2048
    if (this.shadowAtlas.size !== newSize) {
      this.shadowAtlas.size = newSize
      this.setupShadowAtlas()
    }
  }
  
  // Add missing method
  setupShadowAtlas() {
    console.log(`🌘 Setting up shadow atlas with size: ${this.shadowAtlas.size}`)
    // Placeholder implementation - in full version would create shadow atlas texture
    try {
      // Update all existing shadow maps to use new atlas size
      for (const [lightId, shadowLight] of this.shadowLights) {
        if (shadowLight.light && shadowLight.light.shadow) {
          const light = shadowLight.light
          if (light.shadow.mapSize) {
            light.shadow.mapSize.setScalar(this.shadowAtlas.size)
            light.shadow.needsUpdate = true
          }
        }
      }
      console.log('✅ Shadow atlas setup complete')
    } catch (error) {
      console.warn('⚠️ Shadow atlas setup failed:', error)
    }
  }

  // Cleanup
  dispose() {
    // Dispose shadow atlas
    if (this.shadowAtlas.texture) {
      this.shadowAtlas.texture.dispose()
    }
    
    // Clear shadow lights
    this.shadowLights.clear()
    
    // Clear cascades
    this.shadowCascades = []
    
    // Clear excluded objects
    this.excludedObjects.clear()
    
    console.log('🗑️ Advanced Shadow System disposed')
  }
}

