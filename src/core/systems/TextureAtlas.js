import * as THREE from '../extras/three'
import { System } from './System'

/**
 * Texture Atlas System
 * 
 * Automatically combines multiple textures into larger atlas textures to:
 * - Reduce texture binding overhead
 * - Improve batching efficiency
 * - Reduce memory fragmentation
 * - Support automatic UV coordinate remapping
 */
export class TextureAtlas extends System {
  constructor(world) {
    super(world)
    
    this.atlases = new Map() // atlasId -> AtlasData
    this.textureToAtlas = new Map() // originalTexture -> { atlas, uvTransform }
    this.pendingTextures = new Set()
    this.materialUpdates = new Set()
    
    // Atlas configuration
    this.settings = {
      enabled: true,
      maxAtlasSize: 4096, // Maximum atlas texture size
      minAtlasSize: 512, // Minimum atlas texture size
      padding: 2, // Padding between textures in atlas
      powerOfTwo: true, // Force atlas to be power-of-two sizes
      autoUpdate: true, // Automatically update atlases
      compressionFormat: null, // Target compression format (KTX2, etc.)
      updateFrequency: 30 // Update every N frames
    }
    
    this.frameCounter = 0
    
    // Texture packer - implements a simple bin packing algorithm
    this.packer = new TexturePacker()
    
    // Performance tracking
    this.stats = {
      totalAtlases: 0,
      totalTextures: 0,
      atlasedTextures: 0,
      savedBindings: 0,
      memoryUsage: 0,
      packingEfficiency: 0,
      lastUpdateTime: 0
    }
  }

  init(options) {
    // Initialize texture compression support if available
    this.initializeCompression()
  }

  async initializeCompression() {
    try {
      // Check for KTX2 compression support
      if (this.world.graphics?.renderer) {
        const renderer = this.world.graphics.renderer
        
        // Try to import KTX2Loader
        const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js')
        
        this.ktx2Loader = new KTX2Loader()
        this.ktx2Loader.setTranscoderPath('/libs/basis/')
        this.ktx2Loader.detectSupport(renderer)
        
        console.log('KTX2 texture compression support enabled')
      }
    } catch (error) {
      console.warn('KTX2 loader not available:', error)
    }
  }

  /**
   * Add a texture to be atlased
   */
  addTexture(texture, options = {}) {
    if (!texture || !texture.isTexture) {
      console.warn('TextureAtlas: Invalid texture provided')
      return null
    }

    // Skip if texture is already atlased
    if (this.textureToAtlas.has(texture.uuid)) {
      return this.textureToAtlas.get(texture.uuid)
    }

    const textureInfo = {
      texture,
      priority: options.priority || 0,
      category: options.category || 'default', // Group similar textures
      forceAtlas: options.forceAtlas || null, // Force into specific atlas
      preserveAspect: options.preserveAspect !== false,
      minSize: options.minSize || 32,
      maxSize: options.maxSize || 1024,
      uuid: texture.uuid,
      width: texture.image?.width || 256,
      height: texture.image?.height || 256,
      format: texture.format,
      type: texture.type,
      generateMipmaps: texture.generateMipmaps,
      wrapS: texture.wrapS,
      wrapT: texture.wrapT,
      magFilter: texture.magFilter,
      minFilter: texture.minFilter
    }

    this.pendingTextures.add(textureInfo)
    this.stats.totalTextures++
    
    if (this.settings.autoUpdate) {
      this.scheduleAtlasUpdate()
    }

    return textureInfo
  }

  /**
   * Remove a texture from atlasing
   */
  removeTexture(texture) {
    const uuid = texture.uuid || texture
    const atlasData = this.textureToAtlas.get(uuid)
    
    if (atlasData) {
      // Mark space as free in the atlas
      const atlas = this.atlases.get(atlasData.atlasId)
      if (atlas) {
        atlas.freeSpaces.push(atlasData.bounds)
        atlas.needsUpdate = true
      }
      
      this.textureToAtlas.delete(uuid)
      this.stats.atlasedTextures--
    }

    // Remove from pending if it exists
    for (const pending of this.pendingTextures) {
      if (pending.uuid === uuid) {
        this.pendingTextures.delete(pending)
        this.stats.totalTextures--
        break
      }
    }
  }

  scheduleAtlasUpdate() {
    if (this.updateScheduled) return
    
    this.updateScheduled = true
    
    // Use requestIdleCallback if available for better performance
    const callback = () => {
      this.updateAtlases()
      this.updateScheduled = false
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(callback, { timeout: 100 })
    } else {
      setTimeout(callback, 16) // ~60fps
    }
  }

  update(delta) {
    if (!this.settings.enabled) return
    
    // Update atlases periodically
    this.frameCounter++
    if (this.frameCounter % this.settings.updateFrequency === 0) {
      this.processAtlasUpdates()
    }
  }

  processAtlasUpdates() {
    if (this.pendingTextures.size > 0) {
      this.updateAtlases()
    }
    
    if (this.materialUpdates.size > 0) {
      this.updateMaterials()
    }
  }

  async updateAtlases() {
    if (!this.settings.enabled || this.pendingTextures.size === 0) return
    
    const startTime = performance.now()
    
    // Group textures by category and properties
    const textureGroups = this.groupTexturesByCompatibility()
    
    // Process each group
    for (const [groupKey, textures] of textureGroups) {
      await this.packTextureGroup(groupKey, textures)
    }
    
    // Clear pending textures
    this.pendingTextures.clear()
    
    // Update performance stats
    this.stats.lastUpdateTime = performance.now() - startTime
    this.updatePerformanceStats()
  }

  groupTexturesByCompatibility() {
    const groups = new Map()
    
    for (const textureInfo of this.pendingTextures) {
      // Create a compatibility key based on format, type, and filtering
      const compatKey = `${textureInfo.category}_${textureInfo.format}_${textureInfo.type}_${textureInfo.wrapS}_${textureInfo.wrapT}_${textureInfo.magFilter}_${textureInfo.minFilter}`
      
      if (!groups.has(compatKey)) {
        groups.set(compatKey, [])
      }
      
      groups.get(compatKey).push(textureInfo)
    }
    
    return groups
  }

  async packTextureGroup(groupKey, textures) {
    // Sort textures by priority and size
    textures.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority // Higher priority first
      }
      // Larger textures first for better packing
      return (b.width * b.height) - (a.width * a.height)
    })

    // Try to fit textures into existing atlases first
    const existingAtlas = this.findCompatibleAtlas(groupKey, textures)
    
    if (existingAtlas && this.tryPackIntoAtlas(existingAtlas, textures)) {
      return // Successfully packed into existing atlas
    }

    // Create new atlas
    await this.createNewAtlas(groupKey, textures)
  }

  findCompatibleAtlas(groupKey, textures) {
    for (const [atlasId, atlas] of this.atlases) {
      if (atlas.groupKey === groupKey && atlas.hasCapacity) {
        return atlas
      }
    }
    return null
  }

  tryPackIntoAtlas(atlas, textures) {
    const packedTextures = []
    
    for (const textureInfo of textures) {
      const packedRect = this.packer.pack(
        atlas.packer, 
        textureInfo.width + this.settings.padding * 2, 
        textureInfo.height + this.settings.padding * 2
      )
      
      if (packedRect) {
        packedTextures.push({
          textureInfo,
          rect: packedRect
        })
      } else {
        // Can't fit this texture, stop trying
        break
      }
    }
    
    if (packedTextures.length > 0) {
      // Draw textures into atlas
      this.drawTexturesIntoAtlas(atlas, packedTextures)
      return true
    }
    
    return false
  }

  async createNewAtlas(groupKey, textures) {
    // Determine optimal atlas size
    const totalArea = textures.reduce((sum, t) => sum + (t.width * t.height), 0)
    const estimatedSize = Math.ceil(Math.sqrt(totalArea * 1.5)) // 50% padding for packing inefficiency
    
    let atlasSize = this.settings.minAtlasSize
    while (atlasSize < Math.min(estimatedSize, this.settings.maxAtlasSize)) {
      atlasSize *= 2
    }

    // Create new atlas
    const atlasId = `atlas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const canvas = document.createElement('canvas')
    canvas.width = atlasSize
    canvas.height = atlasSize
    
    const context = canvas.getContext('2d')
    context.fillStyle = 'rgba(0, 0, 0, 0)'
    context.fillRect(0, 0, atlasSize, atlasSize)

    // Create Three.js texture from canvas
    const atlasTexture = new THREE.CanvasTexture(canvas)
    
    // Copy properties from first texture
    const firstTexture = textures[0]
    atlasTexture.format = firstTexture.format
    atlasTexture.type = firstTexture.type
    atlasTexture.wrapS = firstTexture.wrapS
    atlasTexture.wrapT = firstTexture.wrapT
    atlasTexture.magFilter = firstTexture.magFilter
    atlasTexture.minFilter = firstTexture.minFilter
    atlasTexture.generateMipmaps = firstTexture.generateMipmaps

    const atlas = {
      id: atlasId,
      groupKey,
      texture: atlasTexture,
      canvas,
      context,
      size: atlasSize,
      packer: this.packer.createPacker(atlasSize, atlasSize),
      usedArea: 0,
      freeSpaces: [],
      hasCapacity: true,
      needsUpdate: false,
      textures: new Map() // textureUuid -> atlasInfo
    }

    this.atlases.set(atlasId, atlas)
    this.stats.totalAtlases++

    // Pack textures into the new atlas
    this.tryPackIntoAtlas(atlas, textures)
  }

  drawTexturesIntoAtlas(atlas, packedTextures) {
    const context = atlas.context
    let totalArea = 0
    
    for (const { textureInfo, rect } of packedTextures) {
      const texture = textureInfo.texture
      
      if (!texture.image) {
        console.warn('TextureAtlas: Texture has no image data', texture)
        continue
      }

      try {
        // Draw texture into atlas with padding
        const x = rect.x + this.settings.padding
        const y = rect.y + this.settings.padding
        const width = textureInfo.width
        const height = textureInfo.height
        
        context.drawImage(texture.image, x, y, width, height)
        
        // Calculate UV transform
        const uvTransform = {
          offsetX: x / atlas.size,
          offsetY: y / atlas.size,
          scaleX: width / atlas.size,
          scaleY: height / atlas.size
        }
        
        // Store atlas mapping
        const atlasInfo = {
          atlasId: atlas.id,
          atlas: atlas.texture,
          uvTransform,
          bounds: { x, y, width, height }
        }
        
        this.textureToAtlas.set(textureInfo.uuid, atlasInfo)
        atlas.textures.set(textureInfo.uuid, atlasInfo)
        
        totalArea += width * height
        this.stats.atlasedTextures++
        
        // Mark materials for update
        this.markMaterialsForUpdate(textureInfo.texture)
        
      } catch (error) {
        console.warn('TextureAtlas: Failed to draw texture into atlas:', error)
      }
    }
    
    // Update atlas texture
    atlas.texture.needsUpdate = true
    atlas.usedArea += totalArea
    atlas.hasCapacity = (atlas.usedArea / (atlas.size * atlas.size)) < 0.9 // 90% full
    
    console.log(`Packed ${packedTextures.length} textures into atlas ${atlas.id}`)
  }

  markMaterialsForUpdate(originalTexture) {
    // Find all materials using this texture
    this.world.stage.scene.traverse((object) => {
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        
        for (const material of materials) {
          if (this.materialUsesTexture(material, originalTexture)) {
            this.materialUpdates.add(material)
          }
        }
      }
    })
  }

  materialUsesTexture(material, texture) {
    // Check all texture properties of the material
    const textureProperties = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap', 
      'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap',
      'lightMap', 'aoMap', 'envMap'
    ]
    
    for (const prop of textureProperties) {
      if (material[prop] === texture) {
        return true
      }
    }
    
    return false
  }

  updateMaterials() {
    for (const material of this.materialUpdates) {
      this.updateMaterialTextures(material)
    }
    this.materialUpdates.clear()
  }

  updateMaterialTextures(material) {
    const textureProperties = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap', 
      'emissiveMap', 'bumpMap', 'displacementMap', 'alphaMap',
      'lightMap', 'aoMap'
    ]
    
    let updated = false
    
    for (const prop of textureProperties) {
      const texture = material[prop]
      if (!texture) continue
      
      const atlasInfo = this.textureToAtlas.get(texture.uuid)
      if (!atlasInfo) continue
      
      // Replace texture with atlas texture
      material[prop] = atlasInfo.atlas
      
      // Update UV transform
      this.updateMaterialUVTransform(material, prop, atlasInfo.uvTransform)
      
      updated = true
      this.stats.savedBindings++
    }
    
    if (updated) {
      material.needsUpdate = true
    }
  }

  updateMaterialUVTransform(material, textureProp, uvTransform) {
    // Create or update UV transform uniforms for the material
    if (!material.uniforms) {
      material.uniforms = {}
    }
    
    const uniformName = `${textureProp}UVTransform`
    material.uniforms[uniformName] = {
      value: new THREE.Vector4(
        uvTransform.scaleX,
        uvTransform.scaleY, 
        uvTransform.offsetX,
        uvTransform.offsetY
      )
    }
    
    // Add shader code to apply UV transform
    this.addUVTransformToShader(material, textureProp, uniformName)
  }

  addUVTransformToShader(material, textureProp, uniformName) {
    // This would require modifying the material's shader
    // For now, we'll use a simpler approach with texture transform
    const atlasInfo = this.textureToAtlas.get(material[textureProp]?.uuid)
    if (atlasInfo) {
      const texture = material[textureProp]
      texture.offset.set(atlasInfo.uvTransform.offsetX, atlasInfo.uvTransform.offsetY)
      texture.repeat.set(atlasInfo.uvTransform.scaleX, atlasInfo.uvTransform.scaleY)
    }
  }

  // Utility methods
  getAtlasForTexture(texture) {
    const uuid = texture.uuid || texture
    return this.textureToAtlas.get(uuid)
  }

  updatePerformanceStats() {
    let totalMemory = 0
    let totalUsedArea = 0
    let totalAtlasArea = 0
    
    for (const atlas of this.atlases.values()) {
      const atlasMemory = atlas.size * atlas.size * 4 // RGBA
      totalMemory += atlasMemory
      totalUsedArea += atlas.usedArea
      totalAtlasArea += atlas.size * atlas.size
    }
    
    this.stats.memoryUsage = totalMemory
    this.stats.packingEfficiency = totalAtlasArea > 0 ? (totalUsedArea / totalAtlasArea) : 0
  }

  getPerformanceStats() {
    return {
      ...this.stats,
      enabled: this.settings.enabled,
      atlasCount: this.atlases.size,
      pendingTextures: this.pendingTextures.size,
      materialUpdates: this.materialUpdates.size,
      memoryUsageMB: (this.stats.memoryUsage / 1024 / 1024).toFixed(2)
    }
  }

  logPerformanceStats() {
    const stats = this.getPerformanceStats()
    console.group('Texture Atlas Performance Stats')
    console.log(`Total Atlases: ${stats.atlasCount}`)
    console.log(`Total Textures: ${stats.totalTextures}`)
    console.log(`Atlased Textures: ${stats.atlasedTextures}`)
    console.log(`Saved Texture Bindings: ${stats.savedBindings}`)
    console.log(`Memory Usage: ${stats.memoryUsageMB}MB`)
    console.log(`Packing Efficiency: ${(stats.packingEfficiency * 100).toFixed(1)}%`)
    console.log(`Last Update Time: ${stats.lastUpdateTime.toFixed(2)}ms`)
    console.log(`Enabled: ${stats.enabled}`)
    console.groupEnd()
  }

  // Configuration
  setSettings(newSettings) {
    Object.assign(this.settings, newSettings)
    console.log('Texture atlas settings updated:', this.settings)
  }

  enable(enabled = true) {
    this.settings.enabled = enabled
    console.log(`Texture Atlas ${enabled ? 'enabled' : 'disabled'}`)
  }

  destroy() {
    // Clean up all atlases
    for (const atlas of this.atlases.values()) {
      atlas.texture.dispose()
    }
    
    this.atlases.clear()
    this.textureToAtlas.clear()
    this.pendingTextures.clear()
    this.materialUpdates.clear()
  }
}

/**
 * Simple 2D bin packing implementation for texture atlasing
 */
class TexturePacker {
  createPacker(width, height) {
    return {
      root: { x: 0, y: 0, width, height },
      width,
      height
    }
  }

  pack(packer, width, height) {
    const node = this.findNode(packer.root, width, height)
    if (node) {
      return this.splitNode(node, width, height)
    }
    return null
  }

  findNode(root, width, height) {
    if (root.used) {
      return this.findNode(root.right, width, height) || 
             this.findNode(root.down, width, height)
    } else if ((width <= root.width) && (height <= root.height)) {
      return root
    }
    return null
  }

  splitNode(node, width, height) {
    node.used = true
    node.down = { x: node.x, y: node.y + height, width: node.width, height: node.height - height }
    node.right = { x: node.x + width, y: node.y, width: node.width - width, height }
    return { x: node.x, y: node.y, width, height }
  }
} 