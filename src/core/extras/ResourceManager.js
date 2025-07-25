import * as THREE from './three'

/**
 * ResourceManager - Advanced WebGL resource management
 * 
 * Features:
 * - Texture pooling and reuse
 * - Geometry instancing optimization
 * - Memory tracking and cleanup
 * - Shader program caching
 * - Automatic resource disposal
 */
export class ResourceManager {
  constructor(renderer) {
    this.renderer = renderer
    this.texturePool = new Map()
    this.geometryPool = new Map()
    this.materialPool = new Map()
    this.shaderCache = new Map()
    
    // Memory tracking
    this.memoryUsage = {
      textures: 0,
      geometries: 0,
      materials: 0,
      total: 0
    }
    
    // Resource disposal queue
    this.disposalQueue = []
    this.disposalTimer = null
    
    // Performance settings
    this.maxTextureMemory = 256 * 1024 * 1024 // 256MB
    this.maxPoolSize = 1000
    this.cleanupInterval = 5000 // 5 seconds
    
    this.setupCleanupTimer()
  }

  /**
   * Get or create a texture with pooling
   */
  getTexture(url, options = {}) {
    const key = this.getTextureKey(url, options)
    
    if (this.texturePool.has(key)) {
      const pooledTexture = this.texturePool.get(key)
      pooledTexture.refCount++
      return pooledTexture.texture
    }

    const texture = new THREE.TextureLoader().load(url, 
      // onLoad
      (texture) => {
        this.trackTextureMemory(texture, 1)
      },
      // onProgress
      undefined,
      // onError
      (error) => {
        console.error(`[ResourceManager] Failed to load texture: ${url}`, error)
      }
    )

    // Apply options
    Object.assign(texture, options)

    const poolEntry = {
      texture,
      refCount: 1,
      lastUsed: Date.now(),
      memorySize: 0
    }

    this.texturePool.set(key, poolEntry)
    return texture
  }

  /**
   * Release a texture reference
   */
  releaseTexture(url, options = {}) {
    const key = this.getTextureKey(url, options)
    const poolEntry = this.texturePool.get(key)
    
    if (poolEntry) {
      poolEntry.refCount--
      poolEntry.lastUsed = Date.now()
      
      if (poolEntry.refCount <= 0) {
        // Schedule for disposal
        this.scheduleDisposal('texture', key, poolEntry)
      }
    }
  }

  /**
   * Get or create geometry with instancing optimization
   */
  getGeometry(type, params, maxInstances = 100) {
    const key = this.getGeometryKey(type, params)
    
    if (this.geometryPool.has(key)) {
      return this.geometryPool.get(key).geometry
    }

    const geometry = this.createGeometry(type, params)
    
    // Prepare for instancing
    if (maxInstances > 1) {
      geometry.maxInstancedCount = maxInstances
    }

    // Compute bounds tree for ray casting optimization
    geometry.computeBoundsTree()

    const poolEntry = {
      geometry,
      refCount: 1,
      lastUsed: Date.now(),
      instances: 0,
      maxInstances
    }

    this.geometryPool.set(key, poolEntry)
    this.trackGeometryMemory(geometry, 1)
    
    return geometry
  }

  /**
   * Create optimized instanced material
   */
  createInstancedMaterial(baseMaterial, maxInstances) {
    const key = `instanced_${baseMaterial.uuid}_${maxInstances}`
    
    if (this.materialPool.has(key)) {
      return this.materialPool.get(key).material
    }

    const material = baseMaterial.clone()
    
    // Enable instancing attributes
    material.defines = material.defines || {}
    material.defines.USE_INSTANCING = ''
    
    // Add instance attributes to vertex shader
    if (material.isShaderMaterial || material.isRawShaderMaterial) {
      material.vertexShader = this.addInstanceAttributesToShader(material.vertexShader)
    }

    const poolEntry = {
      material,
      refCount: 1,
      lastUsed: Date.now()
    }

    this.materialPool.set(key, poolEntry)
    return material
  }

  /**
   * Batch similar draw calls together
   */
  batchDrawCalls(objects) {
    // Group objects by material and geometry
    const batches = new Map()
    
    for (const object of objects) {
      if (!object.geometry || !object.material) continue
      
      const key = `${object.geometry.uuid}_${object.material.uuid}`
      
      if (!batches.has(key)) {
        batches.set(key, {
          geometry: object.geometry,
          material: object.material,
          instances: []
        })
      }
      
      batches.get(key).instances.push(object)
    }

    // Create instanced meshes for batches with multiple objects
    const optimizedObjects = []
    
    for (const [key, batch] of batches) {
      if (batch.instances.length > 1) {
        const instancedMesh = new THREE.InstancedMesh(
          batch.geometry,
          batch.material,
          batch.instances.length
        )
        
        // Set instance matrices
        batch.instances.forEach((instance, i) => {
          instancedMesh.setMatrixAt(i, instance.matrixWorld)
        })
        
        instancedMesh.instanceMatrix.needsUpdate = true
        optimizedObjects.push(instancedMesh)
      } else {
        optimizedObjects.push(batch.instances[0])
      }
    }

    return optimizedObjects
  }

  /**
   * Optimize shader compilation with caching
   */
  getOptimizedShader(material) {
    const key = this.getShaderKey(material)
    
    if (this.shaderCache.has(key)) {
      return this.shaderCache.get(key)
    }

    // Pre-compile shader
    const shader = this.renderer.compile(material, this.renderer.scene, this.renderer.camera)
    this.shaderCache.set(key, shader)
    
    return shader
  }

  /**
   * Memory-aware texture compression
   */
  compressTexture(texture) {
    if (!texture.image) return texture

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const { width, height } = texture.image
    
    // Determine optimal size based on memory constraints
    let scale = 1
    const currentMemory = width * height * 4
    
    if (this.memoryUsage.textures > this.maxTextureMemory * 0.8) {
      scale = 0.5 // Reduce texture size when near memory limit
    }
    
    const newWidth = Math.max(1, Math.floor(width * scale))
    const newHeight = Math.max(1, Math.floor(height * scale))
    
    canvas.width = newWidth
    canvas.height = newHeight
    
    ctx.drawImage(texture.image, 0, 0, newWidth, newHeight)
    
    texture.image = canvas
    texture.needsUpdate = true
    
    return texture
  }

  /**
   * Automatic cleanup of unused resources
   */
  setupCleanupTimer() {
    this.disposalTimer = setInterval(() => {
      this.cleanupUnusedResources()
    }, this.cleanupInterval)
  }

  cleanupUnusedResources() {
    const now = Date.now()
    const maxAge = 30000 // 30 seconds
    
    // Clean up textures
    for (const [key, entry] of this.texturePool) {
      if (entry.refCount <= 0 && (now - entry.lastUsed) > maxAge) {
        this.disposeTexture(entry.texture)
        this.texturePool.delete(key)
      }
    }
    
    // Clean up geometries
    for (const [key, entry] of this.geometryPool) {
      if (entry.refCount <= 0 && (now - entry.lastUsed) > maxAge) {
        entry.geometry.dispose()
        this.geometryPool.delete(key)
      }
    }
    
    // Clean up materials
    for (const [key, entry] of this.materialPool) {
      if (entry.refCount <= 0 && (now - entry.lastUsed) > maxAge) {
        entry.material.dispose()
        this.materialPool.delete(key)
      }
    }
    
    this.updateMemoryUsage()
  }

  /**
   * Track texture memory usage
   */
  trackTextureMemory(texture, delta) {
    if (texture.image) {
      const bytes = texture.image.width * texture.image.height * 4 * delta
      this.memoryUsage.textures += bytes
      this.memoryUsage.total += bytes
      
      // Find pooled entry and update its memory size
      for (const entry of this.texturePool.values()) {
        if (entry.texture === texture) {
          entry.memorySize = bytes
          break
        }
      }
    }
  }

  /**
   * Track geometry memory usage
   */
  trackGeometryMemory(geometry, delta) {
    let bytes = 0
    
    if (geometry.attributes) {
      for (const attribute of Object.values(geometry.attributes)) {
        bytes += attribute.array.byteLength
      }
    }
    
    if (geometry.index) {
      bytes += geometry.index.array.byteLength
    }
    
    this.memoryUsage.geometries += bytes * delta
    this.memoryUsage.total += bytes * delta
  }

  updateMemoryUsage() {
    // Recalculate actual memory usage
    let textureMemory = 0
    let geometryMemory = 0
    
    for (const entry of this.texturePool.values()) {
      textureMemory += entry.memorySize
    }
    
    this.memoryUsage.textures = textureMemory
    this.memoryUsage.total = textureMemory + this.memoryUsage.geometries
    
    // Log memory usage if high
    if (this.memoryUsage.total > this.maxTextureMemory * 0.9) {
      console.warn(`[ResourceManager] High memory usage: ${(this.memoryUsage.total / 1024 / 1024).toFixed(2)}MB`)
    }
  }

  // Helper methods
  getTextureKey(url, options) {
    return `${url}_${JSON.stringify(options)}`
  }

  getGeometryKey(type, params) {
    return `${type}_${JSON.stringify(params)}`
  }

  getShaderKey(material) {
    return `${material.type}_${material.uuid}_${JSON.stringify(material.defines || {})}`
  }

  createGeometry(type, params) {
    switch (type) {
      case 'box':
        return new THREE.BoxGeometry(...params)
      case 'sphere':
        return new THREE.SphereGeometry(...params)
      case 'plane':
        return new THREE.PlaneGeometry(...params)
      case 'cylinder':
        return new THREE.CylinderGeometry(...params)
      default:
        throw new Error(`Unknown geometry type: ${type}`)
    }
  }

  addInstanceAttributesToShader(vertexShader) {
    // Add instancing support to vertex shader
    const instancedShader = vertexShader.replace(
      '#include <common>',
      `#include <common>
      #ifdef USE_INSTANCING
        attribute mat4 instanceMatrix;
      #endif`
    ).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
      #endif`
    )
    
    return instancedShader
  }

  scheduleDisposal(type, key, entry) {
    this.disposalQueue.push({ type, key, entry, timestamp: Date.now() })
  }

  disposeTexture(texture) {
    if (texture) {
      this.trackTextureMemory(texture, -1)
      texture.dispose()
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      textures: {
        count: this.texturePool.size,
        memory: this.memoryUsage.textures
      },
      geometries: {
        count: this.geometryPool.size,
        memory: this.memoryUsage.geometries
      },
      materials: {
        count: this.materialPool.size
      },
      total: this.memoryUsage.total,
      limit: this.maxTextureMemory
    }
  }

  /**
   * Force cleanup of all resources
   */
  dispose() {
    // Clear timer
    if (this.disposalTimer) {
      clearInterval(this.disposalTimer)
    }
    
    // Dispose all textures
    for (const entry of this.texturePool.values()) {
      this.disposeTexture(entry.texture)
    }
    
    // Dispose all geometries
    for (const entry of this.geometryPool.values()) {
      entry.geometry.dispose()
    }
    
    // Dispose all materials
    for (const entry of this.materialPool.values()) {
      entry.material.dispose()
    }
    
    // Clear all pools
    this.texturePool.clear()
    this.geometryPool.clear()
    this.materialPool.clear()
    this.shaderCache.clear()
    
    console.log('[ResourceManager] All resources disposed')
  }
} 