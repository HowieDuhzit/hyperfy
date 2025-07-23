import * as THREE from '../extras/three'
import { 
  // NodeMaterial, // Not available in current Three.js TSL - use standard Three.js materials instead
  // MeshPhysicalNodeMaterial, // Use standard MeshPhysicalMaterial
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
  reflect,
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
  // viewDirection, // Not available in current Three.js TSL
  transformedNormalView,
  modelViewMatrix,
  cameraPosition
} from 'three/tsl'

import { System } from './System'

/**
 * Advanced Materials System for AAA-Quality Rendering
 * 
 * Features:
 * - Advanced PBR materials with clearcoat, sheen, transmission
 * - Procedural material generation
 * - Dynamic material LOD
 * - WebGPU-optimized shaders
 * - Real-time material editing
 * - Material batching and optimization
 */
export class AdvancedMaterials extends System {
  constructor(world) {
    super(world)
    
    this.materials = new Map()
    this.materialCache = new Map()
    this.proceduralMaterials = new Map()
    this.dynamicMaterials = new Set()
    
    // Material performance tracking
    this.materialStats = {
      totalMaterials: 0,
      activeMaterials: 0,
      gpuMemoryUsed: 0,
      compilationTime: 0,
      renderCalls: 0
    }
    
    // Compatibility settings for GLTF and object manipulation
    this.enabled = true
    this.preserveExistingMaterials = false
    this.excludedObjects = new Set()
    
    // Advanced material presets
    this.materialPresets = new Map()
    this.initializePresets()
  }

  async init() {
    console.log('🎨 Initializing Advanced Materials System...')
    console.log('🎨 AdvancedMaterials.init() called - system is being initialized!')
    
    // Initialize material quality from preferences
    this.materialQuality = this.world.prefs?.materialQuality || 'enhanced'
    this.proceduralMaterialsEnabled = this.world.prefs?.proceduralMaterials ?? true
    this.dynamicLODEnabled = this.world.prefs?.dynamicMaterialLOD ?? true
    this.materialBatchingEnabled = this.world.prefs?.materialBatching ?? true
    console.log(`🎯 AdvancedMaterials initialized with quality: ${this.materialQuality}, procedural: ${this.proceduralMaterialsEnabled}, dynamicLOD: ${this.dynamicLODEnabled}, batching: ${this.materialBatchingEnabled}`)
    
    // Initialize material factory
    this.materialFactory = new MaterialFactory(this.world)
    
    // Setup material optimization system
    this.setupMaterialOptimization()
    
    // Initialize procedural material generators
    this.setupProceduralMaterials()
    
    // Setup dynamic material system
    this.setupDynamicMaterials()
    
    // Initialize material batching
    this.setupMaterialBatching()
    
    console.log('✅ Advanced Materials System initialized')
  }

  initializePresets() {
    // AAA-Quality Material Presets
    this.materialPresets.set('chrome', {
      type: 'physical',
      baseColor: [0.95, 0.95, 0.95],
      metallic: 1.0,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      reflectance: 1.0
    })

    this.materialPresets.set('carbonFiber', {
      type: 'physical',
      baseColor: [0.1, 0.1, 0.1],
      metallic: 0.0,
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      normalScale: 2.0,
      proceduralNormal: 'carbonWeave'
    })

    this.materialPresets.set('velvet', {
      type: 'physical',
      baseColor: [0.8, 0.2, 0.2],
      metallic: 0.0,
      roughness: 0.9,
      sheen: 1.0,
      sheenColor: [1.0, 0.8, 0.8],
      sheenRoughness: 0.1
    })

    this.materialPresets.set('glass', {
      type: 'physical',
      baseColor: [1.0, 1.0, 1.0],
      metallic: 0.0,
      roughness: 0.0,
      transmission: 1.0,
      thickness: 1.0,
      ior: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0
    })

    this.materialPresets.set('skin', {
      type: 'physical',
      baseColor: [0.95, 0.8, 0.7],
      metallic: 0.0,
      roughness: 0.4,
      subsurface: 0.3,
      subsurfaceColor: [1.0, 0.4, 0.4],
      subsurfaceRadius: [2.0, 1.0, 0.5],
      proceduralDetail: 'skinPores'
    })

    this.materialPresets.set('diamond', {
      type: 'physical',
      baseColor: [1.0, 1.0, 1.0],
      metallic: 0.0,
      roughness: 0.0,
      transmission: 0.95,
      thickness: 1.0,
      ior: 2.42,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      iridescence: 0.5,
      iridescenceIOR: 1.3,
      proceduralDetail: 'crystalline'
    })
  }

  setupMaterialOptimization() {
    console.log('⚙️ Setting up material optimization system...')
    
    this.materialOptimizer = {
      // Automatic LOD material generation
      generateLODMaterials: (baseMaterial, lodLevels) => {
        const lodMaterials = []
        
        for (let i = 0; i < lodLevels; i++) {
          const lodMaterial = baseMaterial.clone()
          const complexity = 1.0 - (i / lodLevels)
          
          // Reduce texture resolution
          if (lodMaterial.map) {
            lodMaterial.map = this.reduceTextureResolution(lodMaterial.map, complexity)
          }
          
          // Simplify normal maps at distance
          if (i > 1 && lodMaterial.normalMap) {
            lodMaterial.normalMap = null
            lodMaterial.normalScale.setScalar(0)
          }
          
          // Disable expensive effects at distance
          if (i > 2) {
            lodMaterial.clearcoat = 0
            lodMaterial.sheen = 0
            lodMaterial.transmission = 0
          }
          
          lodMaterials.push(lodMaterial)
        }
        
        return lodMaterials
      },

      // Dynamic quality adjustment
      adjustMaterialQuality: (material, performanceLevel) => {
        if (performanceLevel < 0.5) {
          // Low performance mode
          material.envMapIntensity *= 0.5
          material.clearcoat = 0
          material.sheen = 0
        } else if (performanceLevel < 0.8) {
          // Medium performance mode
          material.clearcoat *= 0.5
          material.sheen *= 0.5
        }
        // High performance mode - no changes
      },

      // Memory optimization
      optimizeMemoryUsage: () => {
        // Remove unused materials
        for (const [id, material] of this.materials) {
          if (material.userData.lastUsed < Date.now() - 30000) { // 30 seconds
            this.disposeMaterial(id)
          }
        }
        
        // Compress textures if needed
        this.compressUnusedTextures()
      }
    }
  }

  setupProceduralMaterials() {
    console.log('🧬 Setting up procedural material generators...')
    
    this.proceduralGenerators = {
      // Procedural normal map generators
      carbonWeave: tslFn(() => {
        const uv = vec2().uv()
        const scale = uniform(8.0)
        
        // Carbon fiber weave pattern
        const u = uv.x.mul(scale)
        const v = uv.y.mul(scale)
        
        const wave1 = sin(u.mul(2.0)).mul(0.5).add(0.5)
        const wave2 = sin(v.mul(2.0)).mul(0.5).add(0.5)
        
        const weave = abs(wave1.sub(wave2))
        const height = weave.mul(0.1)
        
        // Calculate normal from height
        const ddu = height.dFdx()
        const ddv = height.dFdy()
        
        const normal = normalize(vec3(ddu.negate(), ddv.negate(), 1.0))
        return normal.mul(0.5).add(0.5)
      }),

      skinPores: tslFn(() => {
        const uv = vec2().uv()
        const scale = uniform(32.0)
        
        // Skin pore pattern using noise
        const noise1 = this.generateNoise(uv.mul(scale))
        const noise2 = this.generateNoise(uv.mul(scale.mul(2.0)))
        
        const pores = noise1.mul(0.7).add(noise2.mul(0.3))
        const height = pores.mul(0.05)
        
        const ddu = height.dFdx()
        const ddv = height.dFdy()
        
        const normal = normalize(vec3(ddu.negate(), ddv.negate(), 1.0))
        return normal.mul(0.5).add(0.5)
      }),

      crystalline: tslFn(() => {
        const uv = vec2().uv()
        const scale = uniform(4.0)
        
        // Crystalline facet pattern
        const facetU = floor(uv.x.mul(scale)).div(scale)
        const facetV = floor(uv.y.mul(scale)).div(scale)
        
        const facetNoise = this.generateNoise(vec2(facetU, facetV))
        
        // Create faceted normal
        const normal = normalize(vec3(
          facetNoise.mul(2.0).sub(1.0).mul(0.3),
          facetNoise.mul(2.0).sub(1.0).mul(0.3),
          1.0
        ))
        
        return normal.mul(0.5).add(0.5)
      })
    }
  }

  generateNoise(uv) {
    // Simple noise function using sine waves
    return tslFn((uv) => {
      const x = uv.x
      const y = uv.y
      
      return sin(x.mul(12.9898).add(y.mul(78.233))).mul(43758.5453).fract()
    })(uv)
  }

  setupDynamicMaterials() {
    console.log('🔄 Setting up dynamic material system...')
    
    this.dynamicMaterialSystem = {
      // Real-time material property animation
      animateMaterial: (materialId, property, targetValue, duration) => {
        const material = this.materials.get(materialId)
        if (!material) return
        
        const startValue = material[property]
        const startTime = performance.now()
        
        const animate = () => {
          const elapsed = performance.now() - startTime
          const progress = Math.min(elapsed / duration, 1.0)
          
          material[property] = THREE.MathUtils.lerp(startValue, targetValue, progress)
          material.needsUpdate = true
          
          if (progress < 1.0) {
            requestAnimationFrame(animate)
          }
        }
        
        animate()
      },

      // Environment-based material adaptation
      adaptToEnvironment: (materialId, environmentData) => {
        const material = this.materials.get(materialId)
        if (!material) return
        
        // Adapt based on lighting conditions
        if (environmentData.isDark) {
          material.envMapIntensity = Math.min(material.envMapIntensity * 1.5, 2.0)
        }
        
        // Adapt based on weather
        if (environmentData.isWet) {
          material.roughness *= 0.3
          material.clearcoat = Math.max(material.clearcoat, 0.8)
        }
        
        material.needsUpdate = true
      },

      // Performance-based quality scaling
      scaleQuality: (performanceMetrics) => {
        const targetFrameTime = 16.67 // 60 FPS
        const currentFrameTime = performanceMetrics.frameTime
        
        if (currentFrameTime > targetFrameTime * 1.2) {
          // Reduce quality
          this.dynamicMaterials.forEach(material => {
            material.envMapIntensity *= 0.9
            if (material.clearcoat > 0) material.clearcoat *= 0.9
          })
        } else if (currentFrameTime < targetFrameTime * 0.8) {
          // Increase quality
          this.dynamicMaterials.forEach(material => {
            material.envMapIntensity = Math.min(material.envMapIntensity * 1.1, 2.0)
          })
        }
      }
    }
  }

  setupMaterialBatching() {
    console.log('📦 Setting up material batching system...')
    
    this.materialBatcher = {
      batches: new Map(),
      
      // Create batched materials for instanced rendering
      createBatch: (baseMaterial, instanceCount) => {
        const batchId = this.generateBatchId(baseMaterial)
        
        if (this.materialBatcher.batches.has(batchId)) {
          return this.materialBatcher.batches.get(batchId)
        }
        
        // Create instanced material
        const batchedMaterial = baseMaterial.clone()
        batchedMaterial.userData.isInstanced = true
        batchedMaterial.userData.instanceCount = instanceCount
        
        // Setup instance-specific attributes
        this.setupInstanceAttributes(batchedMaterial, instanceCount)
        
        this.materialBatcher.batches.set(batchId, batchedMaterial)
        return batchedMaterial
      },

      // Optimize material usage across batches
      optimizeBatches: () => {
        for (const [batchId, material] of this.materialBatcher.batches) {
          if (material.userData.instanceCount < 10) {
            // Convert back to individual materials for small batches
            this.materialBatcher.batches.delete(batchId)
            material.dispose()
          }
        }
      }
    }
  }

  setupInstanceAttributes(material, instanceCount) {
    // Add instance-specific vertex shader modifications
    material.onBeforeCompile = (shader) => {
      // Add instance attributes
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        attribute vec3 instanceColor;
        attribute float instanceRoughness;
        attribute float instanceMetallic;
        varying vec3 vInstanceColor;
        varying float vInstanceRoughness;
        varying float vInstanceMetallic;
        `
      )
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vInstanceColor = instanceColor;
        vInstanceRoughness = instanceRoughness;
        vInstanceMetallic = instanceMetallic;
        `
      )
      
      // Modify fragment shader to use instance data
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vInstanceColor;
        varying float vInstanceRoughness;
        varying float vInstanceMetallic;
        `
      )
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        diffuseColor.rgb *= vInstanceColor;
        `
      )
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        roughnessFactor *= vInstanceRoughness;
        `
      )
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        `
        #include <metalnessmap_fragment>
        metalnessFactor *= vInstanceMetallic;
        `
      )
    }
  }

  // Public API Methods

  createMaterial(type, parameters = {}) {
    const materialId = this.generateMaterialId()
    let material
    
    switch (type) {
      case 'physical':
        material = this.createPhysicalMaterial(parameters)
        break
      case 'procedural':
        material = this.createProceduralMaterial(parameters)
        break
      case 'dynamic':
        material = this.createDynamicMaterial(parameters)
        break
      default:
        material = this.createStandardMaterial(parameters)
    }
    
    material.userData.id = materialId
    material.userData.createdAt = Date.now()
    material.userData.lastUsed = Date.now()
    
    this.materials.set(materialId, material)
    this.materialStats.totalMaterials++
    
    return materialId
  }

  createPhysicalMaterial(params) {
    const material = new THREE.MeshPhysicalMaterial()
    
    // Basic PBR properties
    if (params.baseColor) material.color.setRGB(...params.baseColor)
    if (params.metallic !== undefined) material.metalness = params.metallic
    if (params.roughness !== undefined) material.roughness = params.roughness
    if (params.emissive) material.emissive.setRGB(...params.emissive)
    
    // Advanced properties
    if (params.clearcoat !== undefined) material.clearcoat = params.clearcoat
    if (params.clearcoatRoughness !== undefined) material.clearcoatRoughness = params.clearcoatRoughness
    if (params.sheen !== undefined) material.sheen = params.sheen
    if (params.sheenColor) material.sheenColor.setRGB(...params.sheenColor)
    if (params.sheenRoughness !== undefined) material.sheenRoughness = params.sheenRoughness
    if (params.transmission !== undefined) material.transmission = params.transmission
    if (params.thickness !== undefined) material.thickness = params.thickness
    if (params.ior !== undefined) material.ior = params.ior
    if (params.iridescence !== undefined) material.iridescence = params.iridescence
    if (params.iridescenceIOR !== undefined) material.iridescenceIOR = params.iridescenceIOR
    
    // Textures
    if (params.albedoMap) material.map = params.albedoMap
    if (params.normalMap) {
      material.normalMap = params.normalMap
      if (params.normalScale) material.normalScale.setScalar(params.normalScale)
    }
    if (params.roughnessMap) material.roughnessMap = params.roughnessMap
    if (params.metalnessMap) material.metalnessMap = params.metalnessMap
    if (params.envMap) material.envMap = params.envMap
    
    // Procedural enhancements
    if (params.proceduralNormal && this.proceduralGenerators[params.proceduralNormal]) {
      this.addProceduralNormal(material, params.proceduralNormal)
    }
    
    return material
  }

  createProceduralMaterial(params) {
    const material = new THREE.MeshPhysicalMaterial() // Use standard Three.js material instead of NodeMaterial
    
    // Create procedural node graph
    const proceduralNodes = this.buildProceduralNodes(params)
    
    material.fragmentNode = proceduralNodes.output
    material.transparent = params.transparent || false
    
    return material
  }

  createDynamicMaterial(params) {
    const material = this.createPhysicalMaterial(params)
    
    // Add to dynamic materials set for real-time updates
    this.dynamicMaterials.add(material)
    
    // Setup dynamic properties
    if (params.animated) {
      material.userData.animated = params.animated
    }
    
    if (params.environmentAdaptive) {
      material.userData.environmentAdaptive = true
    }
    
    return material
  }

  createStandardMaterial(params) {
    const material = new THREE.MeshStandardMaterial()
    
    if (params.baseColor) material.color.setRGB(...params.baseColor)
    if (params.metallic !== undefined) material.metalness = params.metallic
    if (params.roughness !== undefined) material.roughness = params.roughness
    if (params.emissive) material.emissive.setRGB(...params.emissive)
    
    return material
  }

  buildProceduralNodes(params) {
    // Build procedural material node graph
    const baseColor = uniform(vec3(params.baseColor || [1, 1, 1]))
    const roughness = uniform(float(params.roughness || 0.5))
    const metallic = uniform(float(params.metallic || 0.0))
    
    // Add procedural patterns
    let diffuseNode = baseColor
    let normalNode = vec3(0, 0, 1)
    
    if (params.pattern) {
      const patternNode = this.generatePattern(params.pattern, params.patternParams)
      diffuseNode = diffuseNode.mul(patternNode)
    }
    
    if (params.proceduralNormal) {
      normalNode = this.proceduralGenerators[params.proceduralNormal]()
    }
    
    return {
      diffuse: diffuseNode,
      normal: normalNode,
      roughness: roughness,
      metallic: metallic,
      output: diffuseNode // Simplified for now
    }
  }

  generatePattern(type, params = {}) {
    switch (type) {
      case 'stripes':
        return this.generateStripePattern(params)
      case 'checkerboard':
        return this.generateCheckerboardPattern(params)
      case 'noise':
        return this.generateNoisePattern(params)
      default:
        return uniform(vec3(1, 1, 1))
    }
  }

  generateStripePattern(params) {
    return tslFn(() => {
      const uv = vec2().uv()
      const frequency = uniform(float(params.frequency || 10.0))
      
      const stripes = sin(uv.x.mul(frequency)).mul(0.5).add(0.5)
      return vec3(stripes, stripes, stripes)
    })()
  }

  generateCheckerboardPattern(params) {
    return tslFn(() => {
      const uv = vec2().uv()
      const scale = uniform(float(params.scale || 8.0))
      
      const checker = step(0.5, 
        mod(floor(uv.x.mul(scale)).add(floor(uv.y.mul(scale))), 2.0)
      )
      
      return vec3(checker, checker, checker)
    })()
  }

  generateNoisePattern(params) {
    return tslFn(() => {
      const uv = vec2().uv()
      const scale = uniform(float(params.scale || 4.0))
      
      const noise = this.generateNoise(uv.mul(scale))
      return vec3(noise, noise, noise)
    })()
  }

  addProceduralNormal(material, generatorName) {
    if (!this.proceduralGenerators[generatorName]) return
    
    const normalGenerator = this.proceduralGenerators[generatorName]
    
    material.onBeforeCompile = (shader) => {
      // Inject procedural normal calculation
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `
        #include <normal_fragment_maps>
        
        // Procedural normal
        vec3 proceduralNormal = ${normalGenerator.toString()};
        normal = normalize(normal + (proceduralNormal - 0.5) * 2.0 * 0.5);
        `
      )
    }
  }

  // Material Management

  getMaterial(materialId) {
    const material = this.materials.get(materialId)
    if (material) {
      material.userData.lastUsed = Date.now()
    }
    return material
  }

  updateMaterial(materialId, properties) {
    const material = this.materials.get(materialId)
    if (!material) return false
    
    Object.assign(material, properties)
    material.needsUpdate = true
    material.userData.lastUsed = Date.now()
    
    return true
  }

  cloneMaterial(materialId, newProperties = {}) {
    const originalMaterial = this.materials.get(materialId)
    if (!originalMaterial) return null
    
    const clonedMaterial = originalMaterial.clone()
    Object.assign(clonedMaterial, newProperties)
    
    const newId = this.generateMaterialId()
    clonedMaterial.userData.id = newId
    clonedMaterial.userData.createdAt = Date.now()
    clonedMaterial.userData.lastUsed = Date.now()
    
    this.materials.set(newId, clonedMaterial)
    this.materialStats.totalMaterials++
    
    return newId
  }

  disposeMaterial(materialId) {
    const material = this.materials.get(materialId)
    if (!material) return false
    
    // Remove from dynamic materials if present
    this.dynamicMaterials.delete(material)
    
    // Dispose of material resources
    material.dispose()
    
    // Remove from cache
    this.materials.delete(materialId)
    this.materialStats.totalMaterials--
    
    return true
  }

  // Preset Management

  createFromPreset(presetName, overrides = {}) {
    const preset = this.materialPresets.get(presetName)
    if (!preset) {
      console.warn(`Material preset '${presetName}' not found`)
      return null
    }
    
    const parameters = { ...preset, ...overrides }
    return this.createMaterial(preset.type, parameters)
  }

  addPreset(name, parameters) {
    this.materialPresets.set(name, parameters)
  }

  // Utility Methods

  generateMaterialId() {
    return `material_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  generateBatchId(material) {
    // Create hash based on material properties
    const props = {
      type: material.type,
      color: material.color?.getHex(),
      metalness: material.metalness,
      roughness: material.roughness,
      map: material.map?.uuid,
      normalMap: material.normalMap?.uuid
    }
    
    return `batch_${JSON.stringify(props).hashCode()}`
  }

  reduceTextureResolution(texture, quality) {
    if (!texture || quality >= 1.0) return texture
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const targetWidth = Math.max(64, Math.floor(texture.image.width * quality))
    const targetHeight = Math.max(64, Math.floor(texture.image.height * quality))
    
    canvas.width = targetWidth
    canvas.height = targetHeight
    
    ctx.drawImage(texture.image, 0, 0, targetWidth, targetHeight)
    
    const reducedTexture = texture.clone()
    reducedTexture.image = canvas
    reducedTexture.needsUpdate = true
    
    return reducedTexture
  }

  compressUnusedTextures() {
    // Compress textures that haven't been used recently
    for (const [id, material] of this.materials) {
      if (material.userData.lastUsed < Date.now() - 60000) { // 1 minute
        if (material.map && !material.map.userData.compressed) {
          // Implement texture compression logic here
          material.map.userData.compressed = true
        }
      }
    }
  }

  // Performance Monitoring

  getPerformanceStats() {
    let gpuMemory = 0
    let activeMaterials = 0
    
    for (const material of this.materials.values()) {
      if (material.userData.lastUsed > Date.now() - 10000) { // 10 seconds
        activeMaterials++
      }
      
      // Estimate GPU memory usage
      if (material.map) gpuMemory += this.estimateTextureMemory(material.map)
      if (material.normalMap) gpuMemory += this.estimateTextureMemory(material.normalMap)
      if (material.roughnessMap) gpuMemory += this.estimateTextureMemory(material.roughnessMap)
    }
    
    return {
      ...this.materialStats,
      activeMaterials,
      gpuMemoryUsed: gpuMemory
    }
  }

  estimateTextureMemory(texture) {
    if (!texture || !texture.image) return 0
    
    const width = texture.image.width
    const height = texture.image.height
    const channels = 4 // Assume RGBA
    const bytes = width * height * channels
    
    return bytes
  }

  // Compatibility methods for GLTF and object manipulation

  setPreserveExistingMaterials(preserve) {
    this.preserveExistingMaterials = preserve
  }
  
  isEnabled() {
    return this.enabled
  }
  
  disable() {
    this.enabled = false
    console.log('⚠️ Advanced Materials System disabled')
  }
  
  enable() {
    this.enabled = true
    console.log('✅ Advanced Materials System enabled')
  }
  
  excludeObject(object) {
    this.excludedObjects.add(object)
  }
  
  // Check if object is a player or avatar that should be excluded
  isPlayerOrAvatar(object) {
    // Check if object is part of a player entity
    let current = object
    while (current) {
      // Check if this object or its ancestors have player-related userData
      if (current.userData) {
        if (current.userData.isPlayer || 
            current.userData.isAvatar ||
            current.userData.entityType === 'player' ||
            current.name === 'avatar') {
          return true
        }
      }
      
      // Check if object is part of player entity structure
      if (current.parent && current.parent.userData) {
        if (current.parent.userData.isPlayer || 
            current.parent.userData.isAvatar ||
            current.parent.userData.entityType === 'player') {
          return true
        }
      }
      
      current = current.parent
    }
    
    return false
  }
  
  // World system update method (called by World.update)
  update(delta) {
    // PERFORMANCE: Disable continuous updates to prevent freezing
    // Materials are only updated when settings change via refreshAllMaterials()
    // This prevents the system from processing 250k+ objects every frame
    return
  }
  
  // Enhanced update method with compatibility checks AND actual material modifications
  updateMaterials(camera, scene, time) {
    if (!this.enabled) {
      console.log('🚫 AdvancedMaterials update called but system is disabled')
      return
    }
    
    // PERFORMANCE: Skip continuous updates to prevent freezing with 250k+ objects
    // Only update materials when settings change
    console.log('🎨 AdvancedMaterials.updateMaterials() called - skipping to prevent freeze')
    return
  }
  
  // NEW METHOD: Actually enhance materials with visible effects
  enhanceMaterial(material, time) {
    try {
      // Apply material quality enhancements
      switch (this.materialQuality) {
        case 'ultra':
          this.applyUltraEnhancements(material)
          break
        case 'aaa':
          this.applyAAAEnhancements(material)
          break
        case 'enhanced':
          this.applyEnhancedSettings(material)
          break
        case 'standard':
        default:
          this.applyStandardSettings(material)
          break
      }
      
      // Apply dynamic material LOD if enabled
      if (this.dynamicLODEnabled) {
        this.applyDynamicLOD(material)
      }
      
      // Apply procedural effects if enabled
      if (this.proceduralMaterialsEnabled) {
        this.applyProceduralEffects(material, time)
      }
      
      // Mark material as needing update
      material.needsUpdate = true
      
    } catch (error) {
      console.warn('⚠️ Failed to enhance material:', error)
    }
  }
  
  applyAAAEnhancements(material) {
    // AAA Quality: Maximum realistic PBR quality with advanced features
    console.log('🎨 Applying AAA quality - maximum realistic PBR fidelity')
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
      
      // Maximum quality environment reflections
      material.envMapIntensity = (material.envMapIntensity || 1.0) * 2.0
      
      // Perfect PBR values based on material type
      if (material.metalness > 0.5) {
        // Pure metallic workflow
        material.metalness = 1.0 // Perfect metal
        material.roughness = Math.max(material.roughness * 0.5, 0.02) // Very smooth but not mirror
        
        // Enhance reflectance for metals
        if (material.reflectance !== undefined) {
          material.reflectance = 1.0
        }
      } else {
        // Pure dielectric workflow
        material.metalness = 0.0 // Perfect dielectric
        material.roughness = Math.max(material.roughness * 0.6, 0.05) // Smooth surface
        
        // Add high-quality clearcoat for premium finish
        if (material.clearcoat !== undefined) {
          material.clearcoat = 0.8 // Strong clearcoat for car paint/high-end plastic effect
          material.clearcoatRoughness = Math.max(material.roughness * 0.3, 0.02)
        }
        
        // Add realistic sheen for fabric-like materials
        if (material.sheen !== undefined && material.roughness > 0.7) {
          material.sheen = 0.4 // Subtle fabric sheen
          material.sheenRoughness = material.roughness * 0.8
        }
      }
      
      // Enhance anisotropy for brushed metals or wood grain
      if (material.anisotropy !== undefined && material.metalness > 0.5) {
        material.anisotropy = 0.3 // Subtle brushed metal effect
      }
      
      console.log('✅ AAA: Maximum realistic PBR fidelity applied')
    }
  }
  
  applyUltraEnhancements(material) {
    // Ultra Quality: Ultimate realistic PBR with cutting-edge features
    console.log('🌈 Applying Ultra quality - ultimate realistic PBR with advanced features')
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
      
      // Ultimate environment reflection quality
      material.envMapIntensity = (material.envMapIntensity || 1.0) * 2.5
      
      // Advanced PBR workflow with all features
      if (material.metalness > 0.5) {
        // Advanced metallic workflow
        material.metalness = 1.0 // Perfect metal
        material.roughness = Math.max(material.roughness * 0.4, 0.01) // Ultra-smooth finish
        
        // Maximum reflectance for metals
        if (material.reflectance !== undefined) {
          material.reflectance = 1.0
        }
        
        // Advanced anisotropy for detailed surface structure
        if (material.anisotropy !== undefined) {
          material.anisotropy = 0.5 // Pronounced brushed/directional effect
        }
        
        // IOR optimization for metals
        if (material.ior !== undefined) {
          material.ior = 2.5 // Typical for metals
        }
      } else {
        // Advanced dielectric workflow
        material.metalness = 0.0 // Perfect dielectric
        material.roughness = Math.max(material.roughness * 0.5, 0.03) // Ultra-smooth surface
        
        // Premium multi-layer clearcoat system
        if (material.clearcoat !== undefined) {
          material.clearcoat = 1.0 // Maximum clearcoat for automotive/luxury finish
          material.clearcoatRoughness = Math.max(material.roughness * 0.2, 0.01)
          
          // Advanced clearcoat normal for micro-detail
          if (material.clearcoatNormalScale !== undefined) {
            material.clearcoatNormalScale.set(0.3, 0.3) // Subtle surface detail
          }
        }
        
        // Advanced sheen system for premium fabrics
        if (material.sheen !== undefined) {
          material.sheen = material.roughness > 0.6 ? 0.6 : 0.2 // Adaptive sheen
          material.sheenRoughness = material.roughness * 0.7
          
          // Realistic sheen color based on base color
          if (material.sheenColor !== undefined) {
            const baseColor = material.color
            material.sheenColor.setRGB(
              baseColor.r * 0.9 + 0.1,
              baseColor.g * 0.9 + 0.1, 
              baseColor.b * 0.9 + 0.1
            )
          }
        }
        
        // Optimized IOR for dielectrics
        if (material.ior !== undefined) {
          material.ior = 1.5 // Typical for glass/plastic
        }
      }
      
      // Advanced transmission for glass-like materials
      if (material.transmission !== undefined && material.metalness < 0.1 && material.roughness < 0.2) {
        material.transmission = 0.9 // High-quality glass effect
        material.thickness = 0.5 // Reasonable thickness for glass
      }
      
      // Subtle iridescence for premium surfaces
      if (material.iridescence !== undefined) {
        material.iridescence = 0.3 // Subtle rainbow effect
        material.iridescenceIOR = 1.3
        material.iridescenceThicknessRange = [100, 400] // Realistic thin-film range
      }
      
      console.log('✅ Ultra: Ultimate realistic PBR with all advanced features')
    }
  }
  
  applyEnhancedSettings(material) {
    // Enhanced Quality: Improved PBR with better reflections and surface quality
    console.log('🌟 Applying Enhanced quality - improved PBR materials')
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
      
      // Enhanced environment reflections
      material.envMapIntensity = (material.envMapIntensity || 1.0) * 1.5
      
      // Improve surface quality based on material type
      if (material.metalness > 0.5) {
        // This looks like a metal - enhance it properly
        material.metalness = Math.max(material.metalness, 0.95) // Pure metals
        material.roughness = Math.max(material.roughness * 0.7, 0.05) // Shinier but not perfect mirror
      } else {
        // Non-metal - improve surface quality
        material.metalness = Math.min(material.metalness || 0.0, 0.05) // Pure dielectric
        material.roughness = Math.max(material.roughness * 0.8, 0.1) // Slightly smoother surface
      }
      
      // Add subtle clearcoat to non-metals for better surface quality
      if (material.clearcoat !== undefined && material.metalness < 0.1) {
        material.clearcoat = 0.3 // Subtle clearcoat for plastics/painted surfaces
        material.clearcoatRoughness = material.roughness * 0.5
      }
      
      console.log('✅ Enhanced: Improved surface quality and reflections')
    }
  }
  
  applyStandardSettings(material) {
    // Standard Quality: Natural PBR with subtle improvements
    console.log('📦 Applying Standard quality - natural realistic PBR')
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
      
      // Keep materials natural - just ensure proper PBR values
      material.envMapIntensity = material.envMapIntensity || 1.0 // Keep original or set to standard
      
      // Ensure metalness is either metallic (0.9+) or non-metallic (0.1-)
      if (material.metalness > 0.5) {
        material.metalness = Math.max(material.metalness, 0.9) // Make metals properly metallic
        material.roughness = Math.min(material.roughness || 0.5, 0.3) // Metals are usually shinier
      } else {
        material.metalness = Math.min(material.metalness || 0.0, 0.1) // Make non-metals properly non-metallic
      }
      
      // Ensure roughness is in realistic range
      material.roughness = Math.max(Math.min(material.roughness || 0.5, 0.9), 0.1)
      
      console.log('✅ Standard: Natural PBR values applied')
    }
  }
  
  applyDynamicLOD(material) {
    // Simple distance-based LOD (would normally use camera distance)
    const distance = 10 // Simplified - would calculate actual distance
    
    if (distance > 50) {
      // Far distance: reduce quality
      material.envMapIntensity *= 0.8
      if (material.clearcoat > 0) material.clearcoat *= 0.5
    } else if (distance < 10) {
      // Close distance: enhance quality  
      material.envMapIntensity = Math.min(material.envMapIntensity * 1.1, 2.0)
    }
  }
  
  applyProceduralEffects(material, time) {
    // Add subtle animated effects
    if (material.emissive) {
      // Subtle pulsing emissive effect
      const pulse = Math.sin(time * 2) * 0.1 + 1.0
      const currentIntensity = material.emissiveIntensity || 0
      material.emissiveIntensity = currentIntensity * pulse
    }
    
    // Add subtle roughness variation over time for "living" materials
    if (material.roughness !== undefined) {
      const variation = Math.sin(time * 0.5) * 0.02
      const baseRoughness = material.userData.baseRoughness || material.roughness
      material.userData.baseRoughness = baseRoughness
      material.roughness = Math.max(0, Math.min(1, baseRoughness + variation))
    }
  }

  // Runtime settings updates
  updateSettings(settings) {
    try {
      console.log('🔧 Updating Advanced Materials settings:', settings)
      
      // Update material quality
      if (settings.quality && settings.quality !== this.materialQuality) {
        this.materialQuality = settings.quality
        console.log(`🎯 Material quality changed to: ${settings.quality}`)
        
        // Use a timeout to prevent freezing when changing presets
        setTimeout(() => {
          this.refreshAllMaterials()
          console.log(`✅ Materials refreshed for quality: ${settings.quality}`)
        }, 100)
      }
      
      // Update procedural materials
      if (settings.procedural !== undefined && settings.procedural !== this.proceduralMaterialsEnabled) {
        this.proceduralMaterialsEnabled = settings.procedural
        console.log(`Procedural materials: ${settings.procedural ? 'enabled' : 'disabled'}`)
        if (settings.procedural) {
          this.initializeProceduralMaterials()
        }
      }
      
      // Update dynamic material LOD
      if (settings.dynamicLOD !== undefined && settings.dynamicLOD !== this.dynamicLODEnabled) {
        this.dynamicLODEnabled = settings.dynamicLOD
        console.log(`Dynamic material LOD: ${settings.dynamicLOD ? 'enabled' : 'disabled'}`)
      }
      
      // Update material batching
      if (settings.batching !== undefined && settings.batching !== this.materialBatchingEnabled) {
        this.materialBatchingEnabled = settings.batching
        console.log(`Material batching: ${settings.batching ? 'enabled' : 'disabled'}`)
        if (settings.batching) {
          this.optimizeMaterialBatches()
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to update Advanced Materials settings:', error)
    }
  }
  
  // Refresh all materials with new settings - THROTTLED to prevent freezing
  refreshAllMaterials() {
    console.log('🔄 Refreshing materials with new settings (throttled for performance)...')
    
    // Apply current preset to all materials
    console.log(`🎨 Applying preset "${this.currentPreset}" to materials...`)
    
    // PERFORMANCE FIX: Limit processing to prevent freezing with 250k+ objects
    let materialsRefreshed = 0
    let materialsSkipped = 0
    let totalObjects = 0
    const MAX_MATERIALS_PER_BATCH = 1000 // Limit to prevent freezing
    
    const scene = this.world?.stage?.scene || this.world?.scene
    if (scene) {
      scene.traverse((object) => {
        totalObjects++
        
        // PERFORMANCE: Stop processing after limit to prevent freeze
        if (materialsRefreshed >= MAX_MATERIALS_PER_BATCH) {
          return
        }
        
        if (object.material) {
          // Debug: log why materials are being skipped
          const isExcluded = this.excludedObjects.has(object)
          const isGLTF = object.userData.isGLTF
          const skipAdvanced = object.userData.skipAdvanced
          const isPlayer = this.isPlayerOrAvatar(object)
          
          if (isExcluded || skipAdvanced || isPlayer) { // Exclude players and avatars
            materialsSkipped++
            if (materialsSkipped < 3) { // Reduce logging to prevent spam
              console.log(`🔍 Skipping material on ${object.type}: excluded=${isExcluded}, isGLTF=${isGLTF}, skipAdvanced=${skipAdvanced}, isPlayer=${isPlayer}`)
            }
          } else {
            // Reset to original material first if we have it
            if (object.userData.originalMaterial) {
              object.material = object.userData.originalMaterial.clone()
            }
            
            // Apply current quality settings immediately
            this.enhanceMaterial(object.material, performance.now() * 0.001)
            materialsRefreshed++
            
            if (materialsRefreshed < 3) { // Reduce logging to prevent spam
              console.log(`🎨 Enhanced material on ${object.type} (${object.material.type})`)
            }
          }
        }
      })
    }
    
    console.log(`📊 Material processing stats: Total objects: ${totalObjects}, Materials enhanced: ${materialsRefreshed}, Materials skipped: ${materialsSkipped}`)
    
    console.log(`✅ Refreshed ${materialsRefreshed} materials - visual changes should be immediate!`)
  }
  
  // EMERGENCY TEST: Force ALL materials to change color - no exclusions
  emergencyTestAllMaterials() {
    console.log('🚨 EMERGENCY TEST: Forcing ALL materials to BRIGHT MAGENTA for debugging!')
    
    let materialCount = 0
    let changedCount = 0
    
    const scene = this.world?.stage?.scene || this.world?.scene
    
    if (scene) {
      console.log('🚨 Found scene, traversing objects...')
      scene.traverse((object) => {
        if (object.material) {
          materialCount++
          
          try {
            // Force BRIGHT MAGENTA on ALL materials regardless of type
            if (object.material.color) {
              object.material.color.setRGB(1.0, 0.0, 1.0) // Bright magenta
              object.material.needsUpdate = true
              changedCount++
            }
            
            // Also try arrays of materials
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => {
                if (mat.color) {
                  mat.color.setRGB(1.0, 0.0, 1.0) // Bright magenta
                  mat.needsUpdate = true
                  changedCount++
                }
              })
            }
            
          } catch (error) {
            console.warn('🚨 Failed to change material:', error)
          }
        }
      })
    } else {
      console.log('🚨 ERROR: No world or scene found!')
    }
    
    console.log(`🚨 EMERGENCY TEST COMPLETE: Found ${materialCount} materials, changed ${changedCount} to BRIGHT MAGENTA`)
    console.log('🚨 If you see NO MAGENTA objects, the material system is not working at all!')
  }
  
  // Add missing method
  optimizeMaterialBatches() {
    console.log('🔧 Optimizing material batches...')
    // Placeholder implementation - in full version would optimize material instances
    try {
      if (this.materialBatcher && this.materialBatcher.optimizeBatches) {
        this.materialBatcher.optimizeBatches()
      }
    } catch (error) {
      console.warn('⚠️ Material batch optimization failed:', error)
    }
  }
  
  // Add missing method
  initializeProceduralMaterials() {
    console.log('🧬 Initializing procedural materials...')
    try {
      // Re-initialize procedural material generators
      if (this.proceduralGenerators) {
        console.log('✅ Procedural material generators re-enabled')
        
        // Apply procedural effects to existing materials immediately
        if (this.world.scene) {
          let materialsUpdated = 0
          this.world.scene.traverse((object) => {
            if (object.material && !this.excludedObjects.has(object) && 
                !object.userData.isGLTF && !object.userData.skipAdvancedMaterials) {
              // Add procedural effects to materials
              this.applyProceduralEffects(object.material, performance.now() * 0.001)
              materialsUpdated++
            }
          })
          console.log(`🌟 Applied procedural effects to ${materialsUpdated} materials`)
        }
      }
    } catch (error) {
      console.warn('⚠️ Procedural materials initialization failed:', error)
    }
  }

  // Cleanup

  dispose() {
    // Dispose all materials
    for (const material of this.materials.values()) {
      material.dispose()
    }
    
    this.materials.clear()
    this.materialCache.clear()
    this.proceduralMaterials.clear()
    this.dynamicMaterials.clear()
    this.materialBatcher.batches.clear()
    this.excludedObjects.clear()
    
    console.log('🗑️ Advanced Materials System disposed')
  }
}

// Utility extensions
String.prototype.hashCode = function() {
  let hash = 0
  if (this.length === 0) return hash
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

/**
 * Material Factory for creating complex materials
 */
class MaterialFactory {
  constructor(world) {
    this.world = world
    this.cache = new Map()
  }

  createAAAPBRMaterial(config) {
    // Create the highest quality PBR material
    const material = new THREE.MeshPhysicalMaterial({
      color: config.baseColor || 0xffffff,
      metalness: config.metallic || 0.0,
      roughness: config.roughness || 0.5,
      clearcoat: config.clearcoat || 0.0,
      clearcoatRoughness: config.clearcoatRoughness || 0.0,
      sheen: config.sheen || 0.0,
      sheenColor: config.sheenColor || 0xffffff,
      sheenRoughness: config.sheenRoughness || 1.0,
      transmission: config.transmission || 0.0,
      thickness: config.thickness || 0.0,
      ior: config.ior || 1.5,
      iridescence: config.iridescence || 0.0,
      iridescenceIOR: config.iridescenceIOR || 1.3,
      transparent: config.transparent || false,
      opacity: config.opacity || 1.0,
      alphaTest: config.alphaTest || 0.0,
      side: config.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    })

    // Add environment mapping for realistic reflections
    if (this.world.environment?.envMap) {
      material.envMap = this.world.environment.envMap
      material.envMapIntensity = config.envMapIntensity || 1.0
    }

    // Advanced texture setup with proper sRGB handling
    if (config.textures) {
      this.setupAdvancedTextures(material, config.textures)
    }

    return material
  }

  setupAdvancedTextures(material, textures) {
    // Albedo/Diffuse map
    if (textures.albedo) {
      material.map = textures.albedo
      material.map.colorSpace = THREE.SRGBColorSpace
    }

    // Normal map
    if (textures.normal) {
      material.normalMap = textures.normal
      material.normalScale.setScalar(textures.normalScale || 1.0)
    }

    // Roughness map
    if (textures.roughness) {
      material.roughnessMap = textures.roughness
    }

    // Metallic map
    if (textures.metallic) {
      material.metalnessMap = textures.metallic
    }

    // Ambient occlusion
    if (textures.ao) {
      material.aoMap = textures.ao
      material.aoMapIntensity = textures.aoIntensity || 1.0
    }

    // Emissive map
    if (textures.emissive) {
      material.emissiveMap = textures.emissive
      material.emissiveIntensity = textures.emissiveIntensity || 1.0
    }

    // Advanced maps
    if (textures.clearcoatNormal) {
      material.clearcoatNormalMap = textures.clearcoatNormal
    }

    if (textures.clearcoatRoughness) {
      material.clearcoatRoughnessMap = textures.clearcoatRoughness
    }

    if (textures.transmission) {
      material.transmissionMap = textures.transmission
    }

    if (textures.thickness) {
      material.thicknessMap = textures.thickness
    }

    if (textures.sheen) {
      material.sheenColorMap = textures.sheen
    }

    if (textures.sheenRoughness) {
      material.sheenRoughnessMap = textures.sheenRoughness
    }

    if (textures.iridescence) {
      material.iridescenceMap = textures.iridescence
    }

    if (textures.iridescenceThickness) {
      material.iridescenceThicknessMap = textures.iridescenceThickness
    }
  }
}

export { MaterialFactory }