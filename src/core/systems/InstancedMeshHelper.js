import * as THREE from '../extras/three'
import { System } from './System'

/**
 * Instanced Mesh Helper System
 * 
 * Handles proper synchronization between individual objects and their
 * instanced/batched representations during manipulation and updates.
 * 
 * Fixes issues like:
 * - Partial mesh movement during object manipulation
 * - Instanced mesh desynchronization
 * - Material conflicts with batched objects
 */
export class InstancedMeshHelper extends System {
  constructor(world) {
    super(world)
    
    // Track instanced meshes and their entity mappings
    this.instanceMappings = new Map() // instancedMesh -> Map(instanceIndex -> entity)
    this.entityMappings = new Map()   // entity -> Set(instancedMesh info)
    this.manipulatedEntities = new Set()
    
    // Performance tracking
    this.updateCount = 0
    this.lastUpdateTime = 0
  }

  init() {
    console.log('🔗 Initializing Instanced Mesh Helper System...')
    
    // Listen for builder events
    this.world.on('build-mode', this.onBuildModeChange.bind(this))
    
    // Hook into entity manipulation events
    if (this.world.builder) {
      this.world.builder.on('select', this.onEntitySelect.bind(this))
    }
  }

  start() {
    // Start monitoring loop
    this.monitorInstancedMeshes()
  }

  /**
   * Monitor and sync instanced meshes with their entities
   */
  monitorInstancedMeshes() {
    this.world.stage.scene.traverse((object) => {
      if (object.isInstancedMesh || object.isBatchedMesh) {
        this.registerInstancedMesh(object)
      }
    })
  }

  /**
   * Register an instanced mesh for monitoring
   */
  registerInstancedMesh(instancedMesh) {
    if (this.instanceMappings.has(instancedMesh)) return
    
    // Create mapping for this instanced mesh
    const instanceMap = new Map()
    this.instanceMappings.set(instancedMesh, instanceMap)
    
    // Try to find the associated model data
    const modelId = instancedMesh.userData.modelId
    if (modelId && this.world.stage.models.has(modelId)) {
      const model = this.world.stage.models.get(modelId)
      
      // Map each instance to its entity
      for (let i = 0; i < model.items.length; i++) {
        const item = model.items[i]
        if (item.node && item.node.ctx && item.node.ctx.entity) {
          const entity = item.node.ctx.entity
          instanceMap.set(i, entity)
          
          // Add reverse mapping
          if (!this.entityMappings.has(entity)) {
            this.entityMappings.set(entity, new Set())
          }
          this.entityMappings.get(entity).add({
            mesh: instancedMesh,
            index: i,
            model: model
          })
        }
      }
    }
  }

  /**
   * Handle entity selection events
   */
  onEntitySelect(entity) {
    // Clear previous manipulated entity highlighting
    for (const prevEntity of this.manipulatedEntities) {
      this.restoreEntityHighlight(prevEntity)
    }
    this.manipulatedEntities.clear()
    
    if (entity) {
      this.manipulatedEntities.add(entity)
      this.highlightEntity(entity)
      
      // Mark entity as being manipulated
      entity.userData.isManipulating = true
    }
  }

  /**
   * Handle build mode changes
   */
  onBuildModeChange(enabled) {
    if (!enabled) {
      // Clear all manipulation states
      for (const entity of this.manipulatedEntities) {
        this.restoreEntityHighlight(entity)
        entity.userData.isManipulating = false
      }
      this.manipulatedEntities.clear()
    }
  }

  /**
   * Highlight a manipulated entity in all its instances
   */
  highlightEntity(entity) {
    const instances = this.entityMappings.get(entity)
    if (!instances) return
    
    const highlightColor = new THREE.Color(0.5, 1.0, 0.5) // Light green
    
    for (const instanceInfo of instances) {
      const { mesh, index } = instanceInfo
      
      // Store original color if not already stored
      if (!entity.userData.originalInstanceColors) {
        entity.userData.originalInstanceColors = new Map()
      }
      
      if (mesh.isInstancedMesh && mesh.instanceColor) {
        const originalColor = new THREE.Color()
        mesh.getColorAt(index, originalColor)
        entity.userData.originalInstanceColors.set(`${mesh.uuid}_${index}`, originalColor)
        
        mesh.setColorAt(index, highlightColor)
        mesh.instanceColor.needsUpdate = true
      } else if (mesh.isBatchedMesh && mesh.setColorAt) {
        // BatchedMesh color handling
        const originalColor = new THREE.Color()
        if (mesh.getColorAt) {
          mesh.getColorAt(index, originalColor)
        } else {
          originalColor.set(0xffffff) // Default white
        }
        entity.userData.originalInstanceColors.set(`${mesh.uuid}_${index}`, originalColor)
        
        mesh.setColorAt(index, highlightColor)
        if (mesh._colorsTexture) {
          mesh._colorsTexture.needsUpdate = true
        }
      }
    }
  }

  /**
   * Restore original highlighting for an entity
   */
  restoreEntityHighlight(entity) {
    const instances = this.entityMappings.get(entity)
    if (!instances) return
    
    const originalColors = entity.userData.originalInstanceColors
    if (!originalColors) return
    
    for (const instanceInfo of instances) {
      const { mesh, index } = instanceInfo
      const colorKey = `${mesh.uuid}_${index}`
      const originalColor = originalColors.get(colorKey)
      
      if (originalColor) {
        if (mesh.isInstancedMesh && mesh.instanceColor) {
          mesh.setColorAt(index, originalColor)
          mesh.instanceColor.needsUpdate = true
        } else if (mesh.isBatchedMesh && mesh.setColorAt) {
          mesh.setColorAt(index, originalColor)
          if (mesh._colorsTexture) {
            mesh._colorsTexture.needsUpdate = true
          }
        }
      }
    }
    
    // Clear stored colors
    delete entity.userData.originalInstanceColors
  }

  /**
   * Update instanced mesh matrices for manipulated entities
   */
  update(delta) {
    const startTime = performance.now()
    let updatedCount = 0
    
    // Update transforms for manipulated entities
    for (const entity of this.manipulatedEntities) {
      if (this.updateEntityInstances(entity)) {
        updatedCount++
      }
    }
    
    this.updateCount += updatedCount
    this.lastUpdateTime = performance.now() - startTime
    
    // Performance logging (throttled)
    if (updatedCount > 0 && this.world.frame % 60 === 0) {
      console.log(`InstancedMeshHelper: Updated ${updatedCount} entities in ${this.lastUpdateTime.toFixed(2)}ms`)
    }
  }

  /**
   * Update all instances of a specific entity
   */
  updateEntityInstances(entity) {
    const instances = this.entityMappings.get(entity)
    if (!instances) return false
    
    let updated = false
    
    for (const instanceInfo of instances) {
      const { mesh, index, model } = instanceInfo
      
      // Update transform matrix
      const entityMatrix = entity.root.matrixWorld
      
      if (mesh.isInstancedMesh) {
        mesh.setMatrixAt(index, entityMatrix)
        mesh.instanceMatrix.needsUpdate = true
        updated = true
      } else if (mesh.isBatchedMesh) {
        mesh.setMatrixAt(index, entityMatrix)
        if (mesh._matricesTexture) {
          mesh._matricesTexture.needsUpdate = true
        }
        updated = true
      }
      
      // Update model item matrix reference
      if (model && model.items[index]) {
        model.items[index].matrix.copy(entityMatrix)
      }
    }
    
    return updated
  }

  /**
   * Force update all registered instanced meshes
   */
  forceUpdateAll() {
    for (const [instancedMesh, instanceMap] of this.instanceMappings) {
      for (const [index, entity] of instanceMap) {
        this.updateEntityInstances(entity)
      }
    }
  }

  /**
   * Get statistics about instanced mesh management
   */
  getStats() {
    return {
      trackedMeshes: this.instanceMappings.size,
      trackedEntities: this.entityMappings.size,
      manipulatedEntities: this.manipulatedEntities.size,
      totalUpdates: this.updateCount,
      lastUpdateTime: this.lastUpdateTime
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Clear all manipulated states
    for (const entity of this.manipulatedEntities) {
      this.restoreEntityHighlight(entity)
      entity.userData.isManipulating = false
    }
    
    this.instanceMappings.clear()
    this.entityMappings.clear()
    this.manipulatedEntities.clear()
    
    console.log('🗑️ Instanced Mesh Helper disposed')
  }
} 