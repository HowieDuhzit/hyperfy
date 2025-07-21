import * as THREE from '../extras/three'
import { System } from './System'

/**
 * Batched Mesh System
 * 
 * Uses Three.js BatchedMesh for advanced instancing with dynamic geometry support.
 * Provides better performance than InstancedMesh for complex scenes with:
 * - Dynamic geometry changes
 * - Per-instance material variations
 * - Better culling support
 * - More flexible instance management
 */
export class BatchedMeshSystem extends System {
  constructor(world) {
    super(world)
    
    this.batchedMeshes = new Map() // id -> BatchedMeshData
    this.geometryGroups = new Map() // geometryId -> Set of batchedMeshIds
    this.materialGroups = new Map() // materialId -> Set of batchedMeshIds
    this.instancePool = new Map() // batchedMeshId -> InstancePool
    
    // Configuration
    this.settings = {
      enabled: true,
      maxInstancesPerBatch: 1000, // Maximum instances per BatchedMesh
      autoOptimize: true, // Automatically optimize batches
      dynamicUpdate: true, // Allow dynamic updates
      frustumCulling: true, // Enable per-instance frustum culling
      updateFrequency: 10 // Update batches every N frames
    }
    
    this.frameCounter = 0
    this.pendingUpdates = new Set()
    
    // Performance tracking
    this.stats = {
      totalBatches: 0,
      totalInstances: 0,
      activeInstances: 0,
      culledInstances: 0,
      drawCalls: 0,
      lastUpdateTime: 0,
      memoryUsage: 0
    }
  }

  init(options) {
    // Check if BatchedMesh is available
    if (!THREE.BatchedMesh) {
      console.warn('BatchedMeshSystem: THREE.BatchedMesh not available, falling back to InstancedMesh')
      this.settings.enabled = false
      return
    }
    
    console.log('BatchedMesh system initialized')
  }

  /**
   * Create a new batched mesh
   */
  createBatchedMesh(geometry, material, options = {}) {
    if (!this.settings.enabled) {
      return null
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const maxInstances = options.maxInstances || this.settings.maxInstancesPerBatch
    
    try {
      // Create BatchedMesh
      const batchedMesh = new THREE.BatchedMesh(maxInstances, geometry, material)
      batchedMesh.userData.batchId = batchId
      batchedMesh.userData.isHyperfyBatch = true
      
      // Configure batched mesh
      batchedMesh.castShadow = options.castShadow !== false
      batchedMesh.receiveShadow = options.receiveShadow !== false
      batchedMesh.frustumCulled = this.settings.frustumCulling
      
      // Create batch data
      const batchData = {
        id: batchId,
        mesh: batchedMesh,
        geometry: geometry,
        material: material,
        maxInstances,
        activeInstances: 0,
        instances: new Map(), // instanceId -> InstanceData
        freeSlots: [],
        needsUpdate: false,
        bounds: new THREE.Box3(),
        
        // Options
        category: options.category || 'default',
        priority: options.priority || 0,
        autoSort: options.autoSort !== false,
        
        // Performance tracking
        lastUsed: Date.now(),
        culledCount: 0
      }
      
      this.batchedMeshes.set(batchId, batchData)
      this.stats.totalBatches++
      
      // Add to world scene
      this.world.stage.scene.add(batchedMesh)
      
      // Group by geometry and material for optimization
      this.addToGeometryGroup(geometry.uuid, batchId)
      this.addToMaterialGroup(material.uuid, batchId)
      
      console.log(`Created batched mesh ${batchId} with capacity for ${maxInstances} instances`)
      
      return batchData
      
    } catch (error) {
      console.error('Failed to create BatchedMesh:', error)
      return null
    }
  }

  /**
   * Add an instance to a batched mesh
   */
  addInstance(batchId, transform, options = {}) {
    const batchData = this.batchedMeshes.get(batchId)
    if (!batchData) {
      console.warn(`BatchedMeshSystem: Batch ${batchId} not found`)
      return null
    }

    if (batchData.activeInstances >= batchData.maxInstances) {
      console.warn(`BatchedMeshSystem: Batch ${batchId} is at maximum capacity`)
      return null
    }

    // Get instance slot
    let instanceId
    if (batchData.freeSlots.length > 0) {
      instanceId = batchData.freeSlots.pop()
    } else {
      instanceId = batchData.activeInstances
    }

    // Create instance data
    const instanceData = {
      id: instanceId,
      batchId,
      matrix: transform.clone(),
      visible: options.visible !== false,
      color: options.color || new THREE.Color(1, 1, 1),
      userData: options.userData || {},
      
      // Culling data
      bounds: new THREE.Box3(),
      lastCullFrame: 0,
      culled: false,
      
      // Animation data
      targetMatrix: null,
      animationSpeed: options.animationSpeed || 1,
      
      // Performance tracking
      lastUpdate: Date.now()
    }

    // Calculate bounds for this instance
    this.calculateInstanceBounds(instanceData, batchData)

    // Set transforms in BatchedMesh
    batchData.mesh.setMatrixAt(instanceId, instanceData.matrix)
    batchData.mesh.setColorAt(instanceId, instanceData.color)
    batchData.mesh.setVisibleAt(instanceId, instanceData.visible)

    // Store instance data
    batchData.instances.set(instanceId, instanceData)
    batchData.activeInstances++
    batchData.needsUpdate = true
    batchData.lastUsed = Date.now()
    
    // Update global stats
    this.stats.totalInstances++
    this.stats.activeInstances++

    return instanceData
  }

  /**
   * Remove an instance from a batched mesh
   */
  removeInstance(batchId, instanceId) {
    const batchData = this.batchedMeshes.get(batchId)
    if (!batchData) return false

    const instanceData = batchData.instances.get(instanceId)
    if (!instanceData) return false

    // Mark as invisible and add to free slots
    batchData.mesh.setVisibleAt(instanceId, false)
    batchData.instances.delete(instanceId)
    batchData.freeSlots.push(instanceId)
    batchData.activeInstances--
    batchData.needsUpdate = true

    // Update global stats
    this.stats.totalInstances--
    this.stats.activeInstances--

    return true
  }

  /**
   * Update an instance transform
   */
  updateInstance(batchId, instanceId, newTransform, options = {}) {
    const batchData = this.batchedMeshes.get(batchId)
    if (!batchData) return false

    const instanceData = batchData.instances.get(instanceId)
    if (!instanceData) return false

    // Update transform
    instanceData.matrix.copy(newTransform)
    batchData.mesh.setMatrixAt(instanceId, instanceData.matrix)

    // Update color if provided
    if (options.color) {
      instanceData.color.copy(options.color)
      batchData.mesh.setColorAt(instanceId, instanceData.color)
    }

    // Update visibility if provided
    if (options.visible !== undefined) {
      instanceData.visible = options.visible
      batchData.mesh.setVisibleAt(instanceId, instanceData.visible)
    }

    // Recalculate bounds
    this.calculateInstanceBounds(instanceData, batchData)

    instanceData.lastUpdate = Date.now()
    batchData.needsUpdate = true

    return true
  }

  calculateInstanceBounds(instanceData, batchData) {
    // Transform geometry bounds by instance matrix
    const geometryBounds = batchData.geometry.boundingBox
    if (!geometryBounds) {
      batchData.geometry.computeBoundingBox()
    }
    
    instanceData.bounds.copy(batchData.geometry.boundingBox)
    instanceData.bounds.applyMatrix4(instanceData.matrix)
  }

  update(delta) {
    if (!this.settings.enabled) return

    this.frameCounter++
    
    // Update batched meshes periodically
    if (this.frameCounter % this.settings.updateFrequency === 0) {
      this.updateBatchedMeshes()
    }

    // Perform frustum culling if enabled
    if (this.settings.frustumCulling && this.world.camera) {
      this.performFrustumCulling()
    }
  }

  updateBatchedMeshes() {
    const startTime = performance.now()
    let updatedCount = 0

    for (const [batchId, batchData] of this.batchedMeshes) {
      if (batchData.needsUpdate) {
        this.updateBatchedMesh(batchData)
        updatedCount++
      }
    }

    // Perform optimizations if enabled
    if (this.settings.autoOptimize) {
      this.optimizeBatches()
    }

    this.stats.lastUpdateTime = performance.now() - startTime
    
    if (updatedCount > 0) {
      console.log(`Updated ${updatedCount} batched meshes in ${this.stats.lastUpdateTime.toFixed(2)}ms`)
    }
  }

  updateBatchedMesh(batchData) {
    try {
      // Update the BatchedMesh
      batchData.mesh.computeBoundingBox()
      batchData.mesh.computeBoundingSphere()
      
      // Update overall bounds
      batchData.bounds.makeEmpty()
      for (const instanceData of batchData.instances.values()) {
        if (instanceData.visible && !instanceData.culled) {
          batchData.bounds.union(instanceData.bounds)
        }
      }
      
      batchData.needsUpdate = false
      
    } catch (error) {
      console.warn(`Failed to update batched mesh ${batchData.id}:`, error)
    }
  }

  performFrustumCulling() {
    if (!this.world.stage.frustum) return

    const frustum = this.world.stage.frustum
    let culledCount = 0
    let visibleCount = 0

    for (const [batchId, batchData] of this.batchedMeshes) {
      batchData.culledCount = 0
      
      for (const [instanceId, instanceData] of batchData.instances) {
        const wasCulled = instanceData.culled
        const isVisible = frustum.intersectsBox(instanceData.bounds)
        
        instanceData.culled = !isVisible
        instanceData.lastCullFrame = this.world.frame

        if (instanceData.culled !== wasCulled) {
          // Update visibility in BatchedMesh
          batchData.mesh.setVisibleAt(instanceId, instanceData.visible && !instanceData.culled)
          batchData.needsUpdate = true
        }

        if (instanceData.culled) {
          culledCount++
          batchData.culledCount++
        } else {
          visibleCount++
        }
      }
    }

    // Update stats
    this.stats.culledInstances = culledCount
    this.stats.activeInstances = visibleCount
  }

  optimizeBatches() {
    // Remove empty or underutilized batches
    const batchesToRemove = []
    const currentTime = Date.now()

    for (const [batchId, batchData] of this.batchedMeshes) {
      // Remove empty batches that haven't been used recently
      if (batchData.activeInstances === 0 && 
          currentTime - batchData.lastUsed > 60000) { // 1 minute
        batchesToRemove.push(batchId)
      }
      
      // Consider merging small batches
      else if (batchData.activeInstances < batchData.maxInstances * 0.2) {
        this.considerBatchMerging(batchData)
      }
    }

    // Remove unused batches
    for (const batchId of batchesToRemove) {
      this.removeBatch(batchId)
    }
  }

  considerBatchMerging(underutilizedBatch) {
    // Find compatible batches that could be merged
    const compatibleBatches = []
    
    for (const [otherId, otherBatch] of this.batchedMeshes) {
      if (otherId === underutilizedBatch.id) continue
      
      // Check if batches are compatible for merging
      if (this.areBatchesCompatible(underutilizedBatch, otherBatch) &&
          otherBatch.activeInstances + underutilizedBatch.activeInstances <= otherBatch.maxInstances) {
        compatibleBatches.push(otherBatch)
      }
    }

    // Merge with the best candidate
    if (compatibleBatches.length > 0) {
      const targetBatch = compatibleBatches[0] // Simple selection, could be improved
      this.mergeBatches(underutilizedBatch, targetBatch)
    }
  }

  areBatchesCompatible(batch1, batch2) {
    return batch1.geometry.uuid === batch2.geometry.uuid &&
           batch1.material.uuid === batch2.material.uuid &&
           batch1.category === batch2.category
  }

  mergeBatches(sourceBatch, targetBatch) {
    console.log(`Merging batch ${sourceBatch.id} into ${targetBatch.id}`)
    
    // Move all instances from source to target
    for (const [instanceId, instanceData] of sourceBatch.instances) {
      const newInstanceData = {
        ...instanceData,
        batchId: targetBatch.id
      }
      
      // Add to target batch
      this.addInstanceToBatch(targetBatch, newInstanceData)
    }
    
    // Remove source batch
    this.removeBatch(sourceBatch.id)
  }

  addInstanceToBatch(batchData, instanceData) {
    if (batchData.activeInstances >= batchData.maxInstances) return false

    let newInstanceId
    if (batchData.freeSlots.length > 0) {
      newInstanceId = batchData.freeSlots.pop()
    } else {
      newInstanceId = batchData.activeInstances
    }

    instanceData.id = newInstanceId
    instanceData.batchId = batchData.id

    batchData.mesh.setMatrixAt(newInstanceId, instanceData.matrix)
    batchData.mesh.setColorAt(newInstanceId, instanceData.color)
    batchData.mesh.setVisibleAt(newInstanceId, instanceData.visible)

    batchData.instances.set(newInstanceId, instanceData)
    batchData.activeInstances++
    batchData.needsUpdate = true

    return true
  }

  removeBatch(batchId) {
    const batchData = this.batchedMeshes.get(batchId)
    if (!batchData) return false

    // Remove from scene
    this.world.stage.scene.remove(batchData.mesh)
    
    // Clean up geometry and material groups
    this.removeFromGeometryGroup(batchData.geometry.uuid, batchId)
    this.removeFromMaterialGroup(batchData.material.uuid, batchId)
    
    // Update stats
    this.stats.totalBatches--
    this.stats.totalInstances -= batchData.activeInstances
    this.stats.activeInstances -= batchData.activeInstances
    
    // Remove from collections
    this.batchedMeshes.delete(batchId)
    
    console.log(`Removed batch ${batchId}`)
    return true
  }

  // Group management
  addToGeometryGroup(geometryId, batchId) {
    if (!this.geometryGroups.has(geometryId)) {
      this.geometryGroups.set(geometryId, new Set())
    }
    this.geometryGroups.get(geometryId).add(batchId)
  }

  removeFromGeometryGroup(geometryId, batchId) {
    const group = this.geometryGroups.get(geometryId)
    if (group) {
      group.delete(batchId)
      if (group.size === 0) {
        this.geometryGroups.delete(geometryId)
      }
    }
  }

  addToMaterialGroup(materialId, batchId) {
    if (!this.materialGroups.has(materialId)) {
      this.materialGroups.set(materialId, new Set())
    }
    this.materialGroups.get(materialId).add(batchId)
  }

  removeFromMaterialGroup(materialId, batchId) {
    const group = this.materialGroups.get(materialId)
    if (group) {
      group.delete(batchId)
      if (group.size === 0) {
        this.materialGroups.delete(materialId)
      }
    }
  }

  // Performance monitoring
  getPerformanceStats() {
    // Calculate memory usage
    let memoryUsage = 0
    for (const batchData of this.batchedMeshes.values()) {
      memoryUsage += this.calculateBatchMemoryUsage(batchData)
    }
    this.stats.memoryUsage = memoryUsage

    return {
      ...this.stats,
      enabled: this.settings.enabled,
      batchCount: this.batchedMeshes.size,
      averageInstancesPerBatch: this.stats.totalBatches > 0 ? 
        (this.stats.totalInstances / this.stats.totalBatches).toFixed(1) : 0,
      cullRatio: this.stats.totalInstances > 0 ? 
        (this.stats.culledInstances / this.stats.totalInstances) : 0,
      memoryUsageMB: (memoryUsage / 1024 / 1024).toFixed(2)
    }
  }

  calculateBatchMemoryUsage(batchData) {
    // Rough estimation of memory usage
    const geometryMemory = this.estimateGeometryMemory(batchData.geometry)
    const materialMemory = this.estimateMaterialMemory(batchData.material)
    const instanceMemory = batchData.maxInstances * 64 // ~64 bytes per instance
    
    return geometryMemory + materialMemory + instanceMemory
  }

  estimateGeometryMemory(geometry) {
    let memory = 0
    for (const attribute of Object.values(geometry.attributes)) {
      memory += attribute.array.byteLength
    }
    if (geometry.index) {
      memory += geometry.index.array.byteLength
    }
    return memory
  }

  estimateMaterialMemory(material) {
    // Very rough estimation
    let memory = 1024 // Base material size
    
    const textureProperties = ['map', 'normalMap', 'roughnessMap', 'metalnessMap']
    for (const prop of textureProperties) {
      if (material[prop] && material[prop].image) {
        const image = material[prop].image
        memory += (image.width || 256) * (image.height || 256) * 4 // RGBA
      }
    }
    
    return memory
  }

  logPerformanceStats() {
    const stats = this.getPerformanceStats()
    console.group('BatchedMesh System Performance Stats')
    console.log(`Total Batches: ${stats.batchCount}`)
    console.log(`Total Instances: ${stats.totalInstances}`)
    console.log(`Active Instances: ${stats.activeInstances}`)
    console.log(`Culled Instances: ${stats.culledInstances}`)
    console.log(`Average Instances per Batch: ${stats.averageInstancesPerBatch}`)
    console.log(`Cull Ratio: ${(stats.cullRatio * 100).toFixed(1)}%`)
    console.log(`Memory Usage: ${stats.memoryUsageMB}MB`)
    console.log(`Last Update Time: ${stats.lastUpdateTime.toFixed(2)}ms`)
    console.log(`Enabled: ${stats.enabled}`)
    console.groupEnd()
  }

  // Configuration
  setSettings(newSettings) {
    Object.assign(this.settings, newSettings)
    console.log('BatchedMesh system settings updated:', this.settings)
  }

  enable(enabled = true) {
    this.settings.enabled = enabled
    console.log(`BatchedMesh system ${enabled ? 'enabled' : 'disabled'}`)
  }

  destroy() {
    // Clean up all batches
    for (const [batchId] of this.batchedMeshes) {
      this.removeBatch(batchId)
    }
    
    this.geometryGroups.clear()
    this.materialGroups.clear()
    this.instancePool.clear()
  }
} 