import * as THREE from '../extras/three'
import { 
  NodeMaterial,
  MeshPhysicalNodeMaterial,
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
  viewDirection,
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
    
    // Advanced material presets
    this.materialPresets = new Map()
    this.initializePresets()
  }

  async init() {
    console.log('🎨 Initializing Advanced Materials System...')
    
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
    const material = new NodeMaterial()
    
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