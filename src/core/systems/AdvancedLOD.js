import * as THREE from '../extras/three'
import { System } from './System'

/**
 * Advanced LOD System
 * 
 * Provides automatic level-of-detail switching based on distance from camera.
 * Supports multiple LOD strategies:
 * - Geometric LOD (different mesh resolutions)
 * - Material LOD (shader complexity reduction)
 * - Texture LOD (texture resolution scaling)
 * - Animation LOD (reduced animation quality)
 */
export class AdvancedLOD extends System {
  constructor(world) {
    super(world)
    
    this.lodObjects = new Map() // object -> LODConfig
    this.lodGroups = new Map() // groupId -> LODGroup
    this.geometryCache = new Map() // geometry -> simplified versions
    this.materialCache = new Map() // material -> LOD versions
    
    // LOD configuration
    this.settings = {
      enabled: true,
      updateFrequency: 5, // Update LOD every N frames
      hysteresis: 1.1, // Prevent LOD flickering
      maxLODLevels: 4,
      distanceMultiplier: 1.0
    }
    
    this.frameCounter = 0
    this.pendingUpdates = new Set()
    
    // Performance tracking
    this.stats = {
      totalLODObjects: 0,
      lodSwitches: 0,
      geometrySimplifications: 0,
      materialDowngrades: 0,
      lastUpdateTime: 0
    }
  }

  init(options) {
    // Initialize geometry simplification tools
    this.initializeSimplificationTools()
  }

  initializeSimplificationTools() {
    // Cache commonly used simplified geometries
    this.createCommonLODGeometries()
  }

  createCommonLODGeometries() {
    // Create simplified versions of common geometries
    const commonGeometries = [
      { name: 'box', generator: (detail) => new THREE.BoxGeometry(1, 1, 1, detail, detail, detail) },
      { name: 'sphere', generator: (detail) => new THREE.SphereGeometry(1, detail * 8, detail * 6) },
      { name: 'cylinder', generator: (detail) => new THREE.CylinderGeometry(1, 1, 1, detail * 8) },
      { name: 'plane', generator: (detail) => new THREE.PlaneGeometry(1, 1, detail, detail) }
    ]

    for (const geom of commonGeometries) {
      const lodVersions = []
      
      // Create LOD levels: high, medium, low, very low
      const detailLevels = [8, 4, 2, 1]
      
      for (let i = 0; i < detailLevels.length; i++) {
        const geometry = geom.generator(detailLevels[i])
        geometry.computeBoundsTree()
        lodVersions.push(geometry)
      }
      
      this.geometryCache.set(geom.name, lodVersions)
    }
  }

  /**
   * Register an object for automatic LOD management
   */
  addLODObject(object, config = {}) {
    if (!object.isObject3D) {
      console.warn('AdvancedLOD: Can only add Object3D instances')
      return
    }

    const lodConfig = {
      object,
      enabled: config.enabled !== false,
      type: config.type || 'auto', // 'auto', 'geometric', 'material', 'custom'
      distances: config.distances || [50, 150, 300, 500],
      lodLevels: [],
      currentLOD: 0,
      lastLOD: -1,
      groupId: config.groupId || null,
      customLODFunction: config.customLODFunction || null,
      
      // Performance settings
      geometricLOD: config.geometricLOD !== false,
      materialLOD: config.materialLOD !== false,
      textureLOD: config.textureLOD !== false,
      animationLOD: config.animationLOD !== false,
      
      // Hysteresis settings
      hysteresisUp: config.hysteresisUp || this.settings.hysteresis,
      hysteresisDown: config.hysteresisDown || (1 / this.settings.hysteresis)
    }

    // Auto-detect LOD type and create LOD levels
    this.setupLODLevels(lodConfig)
    
    this.lodObjects.set(object.uuid, lodConfig)
    this.stats.totalLODObjects++
    
    // Add to group if specified
    if (lodConfig.groupId) {
      this.addToLODGroup(lodConfig.groupId, object.uuid)
    }

    return lodConfig
  }

  removeLODObject(object) {
    const uuid = object.uuid || object
    const config = this.lodObjects.get(uuid)
    
    if (config) {
      // Clean up LOD levels
      config.lodLevels.forEach(level => {
        if (level.mesh && level.mesh.parent) {
          level.mesh.parent.remove(level.mesh)
        }
      })
      
      this.lodObjects.delete(uuid)
      this.stats.totalLODObjects--
      
      // Remove from groups
      if (config.groupId) {
        this.removeFromLODGroup(config.groupId, uuid)
      }
    }
  }

  setupLODLevels(config) {
    const object = config.object
    
    if (config.type === 'custom' && config.customLODFunction) {
      config.lodLevels = config.customLODFunction(object, config.distances)
      return
    }

    // Auto-setup based on object type
    if (object.isMesh) {
      this.setupMeshLOD(config)
    } else if (object.isGroup) {
      this.setupGroupLOD(config)
    } else {
      this.setupGenericLOD(config)
    }
  }

  setupMeshLOD(config) {
    const mesh = config.object
    const originalGeometry = mesh.geometry
    const originalMaterial = mesh.material
    
    config.lodLevels = []
    
    for (let i = 0; i < config.distances.length; i++) {
      const level = {
        distance: config.distances[i],
        geometry: null,
        material: null,
        mesh: null,
        visible: i === 0
      }

      // Create geometry LOD
      if (config.geometricLOD) {
        level.geometry = this.createGeometricLOD(originalGeometry, i)
      } else {
        level.geometry = originalGeometry
      }

      // Create material LOD
      if (config.materialLOD) {
        level.material = this.createMaterialLOD(originalMaterial, i)
      } else {
        level.material = originalMaterial
      }

      // Create mesh for this LOD level
      level.mesh = new THREE.Mesh(level.geometry, level.material)
      level.mesh.copy(mesh)
      level.mesh.visible = level.visible
      level.mesh.userData.lodLevel = i
      
      // Add to parent
      if (mesh.parent) {
        mesh.parent.add(level.mesh)
      }

      config.lodLevels.push(level)
    }
    
    // Hide original mesh
    mesh.visible = false
  }

  setupGroupLOD(config) {
    // For groups, create simplified versions by reducing child count
    const group = config.object
    const children = group.children.slice()
    
    config.lodLevels = []
    
    for (let i = 0; i < config.distances.length; i++) {
      const level = {
        distance: config.distances[i],
        childrenCount: Math.max(1, Math.ceil(children.length * (1 - i * 0.3))),
        visible: i === 0
      }
      
      config.lodLevels.push(level)
    }
  }

  setupGenericLOD(config) {
    // Generic LOD just controls visibility
    config.lodLevels = config.distances.map((distance, i) => ({
      distance,
      visible: i === 0
    }))
  }

  createGeometricLOD(geometry, lodLevel) {
    if (!geometry.isBufferGeometry) return geometry
    
    // Try to get from cache first
    const cacheKey = `${geometry.uuid}_lod${lodLevel}`
    if (this.geometryCache.has(cacheKey)) {
      return this.geometryCache.get(cacheKey)
    }

    let simplified = geometry
    
    try {
      // Use Three.js geometry utilities for simplification
      if (lodLevel > 0) {
        simplified = this.simplifyGeometry(geometry, lodLevel)
      }
      
      this.geometryCache.set(cacheKey, simplified)
      this.stats.geometrySimplifications++
      
    } catch (error) {
      console.warn('AdvancedLOD: Failed to create geometric LOD:', error)
      simplified = geometry
    }
    
    return simplified
  }

  simplifyGeometry(geometry, lodLevel) {
    // Implement geometry simplification
    const simplificationRatio = 1 - (lodLevel * 0.3) // Reduce by 30% per level
    
    if (geometry.index) {
      // For indexed geometry, reduce triangle count
      const indexCount = Math.floor(geometry.index.count * simplificationRatio)
      const newIndex = new THREE.BufferAttribute(
        geometry.index.array.slice(0, indexCount),
        geometry.index.itemSize
      )
      
      const simplifiedGeometry = geometry.clone()
      simplifiedGeometry.setIndex(newIndex)
      simplifiedGeometry.computeBoundsTree()
      
      return simplifiedGeometry
    } else {
      // For non-indexed geometry, reduce vertex count
      const vertexCount = Math.floor(geometry.attributes.position.count * simplificationRatio)
      const simplifiedGeometry = new THREE.BufferGeometry()
      
      for (const attributeName in geometry.attributes) {
        const attribute = geometry.attributes[attributeName]
        const newArray = attribute.array.slice(0, vertexCount * attribute.itemSize)
        simplifiedGeometry.setAttribute(
          attributeName,
          new THREE.BufferAttribute(newArray, attribute.itemSize)
        )
      }
      
      simplifiedGeometry.computeBoundsTree()
      return simplifiedGeometry
    }
  }

  createMaterialLOD(material, lodLevel) {
    if (!material.isMaterial) return material
    
    const cacheKey = `${material.uuid}_lod${lodLevel}`
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey)
    }

    let lodMaterial = material
    
    if (lodLevel > 0) {
      lodMaterial = material.clone()
      
      // Reduce material complexity based on LOD level
      switch (lodLevel) {
        case 1: // Medium LOD
          if (lodMaterial.normalMap) {
            lodMaterial.normalScale.setScalar(0.5)
          }
          break
          
        case 2: // Low LOD
          lodMaterial.normalMap = null
          lodMaterial.roughnessMap = null
          lodMaterial.metalnessMap = null
          break
          
        case 3: // Very Low LOD
          lodMaterial.map = null
          lodMaterial.normalMap = null
          lodMaterial.roughnessMap = null
          lodMaterial.metalnessMap = null
          lodMaterial.emissiveMap = null
          // Use basic material properties only
          break
      }
      
      this.materialCache.set(cacheKey, lodMaterial)
      this.stats.materialDowngrades++
    }
    
    return lodMaterial
  }

  update(delta) {
    if (!this.settings.enabled) return
    
    // Only update LOD every N frames for performance
    this.frameCounter++
    if (this.frameCounter % this.settings.updateFrequency !== 0) return
    
    const startTime = performance.now()
    const cameraPosition = this.world.camera.position
    
    // Update LOD for all registered objects
    for (const [uuid, config] of this.lodObjects) {
      if (!config.enabled || !config.object.visible) continue
      
      this.updateObjectLOD(config, cameraPosition)
    }
    
    this.stats.lastUpdateTime = performance.now() - startTime
  }

  updateObjectLOD(config, cameraPosition) {
    const object = config.object
    const distance = cameraPosition.distanceTo(object.position) * this.settings.distanceMultiplier
    
    // Determine appropriate LOD level
    let targetLOD = 0
    for (let i = 0; i < config.distances.length; i++) {
      const lodDistance = config.distances[i]
      const hysteresis = config.currentLOD > i ? config.hysteresisUp : config.hysteresisDown
      
      if (distance > lodDistance * hysteresis) {
        targetLOD = Math.min(i + 1, config.lodLevels.length - 1)
      } else {
        break
      }
    }
    
    // Apply LOD change if needed
    if (targetLOD !== config.currentLOD) {
      this.applyLODChange(config, targetLOD)
    }
  }

  applyLODChange(config, newLOD) {
    const oldLOD = config.currentLOD
    config.lastLOD = oldLOD
    config.currentLOD = newLOD
    this.stats.lodSwitches++
    
    // Apply mesh-specific LOD changes
    if (config.object.isMesh && config.lodLevels[0].mesh) {
      // Hide old LOD mesh
      if (config.lodLevels[oldLOD] && config.lodLevels[oldLOD].mesh) {
        config.lodLevels[oldLOD].mesh.visible = false
      }
      
      // Show new LOD mesh
      if (config.lodLevels[newLOD] && config.lodLevels[newLOD].mesh) {
        config.lodLevels[newLOD].mesh.visible = true
      }
    }
    
    // Apply group-specific LOD changes
    if (config.object.isGroup) {
      this.applyGroupLOD(config, newLOD)
    }
    
    // Apply custom LOD function if provided
    if (config.customLODFunction) {
      config.customLODFunction(config.object, newLOD, oldLOD)
    }
    
    // Emit LOD change event
    this.world.emit('lodChange', {
      object: config.object,
      oldLOD,
      newLOD,
      distance: this.world.camera.position.distanceTo(config.object.position)
    })
  }

  applyGroupLOD(config, lodLevel) {
    const group = config.object
    const level = config.lodLevels[lodLevel]
    
    if (!level) return
    
    // Show/hide children based on LOD level
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i]
      child.visible = i < level.childrenCount
    }
  }

  // LOD Groups - manage multiple objects together
  addToLODGroup(groupId, objectUuid) {
    if (!this.lodGroups.has(groupId)) {
      this.lodGroups.set(groupId, new Set())
    }
    this.lodGroups.get(groupId).add(objectUuid)
  }

  removeFromLODGroup(groupId, objectUuid) {
    if (this.lodGroups.has(groupId)) {
      this.lodGroups.get(groupId).delete(objectUuid)
      
      if (this.lodGroups.get(groupId).size === 0) {
        this.lodGroups.delete(groupId)
      }
    }
  }

  setLODGroupLevel(groupId, lodLevel) {
    const group = this.lodGroups.get(groupId)
    if (!group) return
    
    for (const uuid of group) {
      const config = this.lodObjects.get(uuid)
      if (config) {
        this.applyLODChange(config, Math.min(lodLevel, config.lodLevels.length - 1))
      }
    }
  }

  // Performance monitoring and debugging
  getPerformanceStats() {
    return {
      ...this.stats,
      activeObjects: this.lodObjects.size,
      groups: this.lodGroups.size,
      enabled: this.settings.enabled,
      geometryCache: this.geometryCache.size,
      materialCache: this.materialCache.size
    }
  }

  logPerformanceStats() {
    const stats = this.getPerformanceStats()
    console.group('Advanced LOD Performance Stats')
    console.log(`Active LOD Objects: ${stats.activeObjects}`)
    console.log(`LOD Groups: ${stats.groups}`)
    console.log(`Total LOD Switches: ${stats.lodSwitches}`)
    console.log(`Geometry Simplifications: ${stats.geometrySimplifications}`)
    console.log(`Material Downgrades: ${stats.materialDowngrades}`)
    console.log(`Last Update Time: ${stats.lastUpdateTime.toFixed(2)}ms`)
    console.log(`Geometry Cache Size: ${stats.geometryCache}`)
    console.log(`Material Cache Size: ${stats.materialCache}`)
    console.log(`Enabled: ${stats.enabled}`)
    console.groupEnd()
  }

  // Configuration methods
  setLODSettings(newSettings) {
    Object.assign(this.settings, newSettings)
    console.log('LOD settings updated:', this.settings)
  }

  enable(enabled = true) {
    this.settings.enabled = enabled
    console.log(`Advanced LOD ${enabled ? 'enabled' : 'disabled'}`)
  }

  destroy() {
    // Clean up all LOD objects
    for (const [uuid, config] of this.lodObjects) {
      this.removeLODObject(uuid)
    }
    
    // Clear caches
    this.geometryCache.clear()
    this.materialCache.clear()
    this.lodGroups.clear()
  }
} 