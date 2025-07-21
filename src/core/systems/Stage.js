import * as THREE from '../extras/three'
import { isNumber } from 'lodash-es'

import { System } from './System'
import { LooseOctree } from '../extras/LooseOctree'

const vec2 = new THREE.Vector2()

/**
 * Stage System
 *
 * - Runs on both the server and client.
 * - Allows inserting meshes etc into the world, and providing a handle back.
 * - Automatically handles instancing/batching.
 * - This is a logical scene graph, no rendering etc is handled here.
 *
 */
export class Stage extends System {
  constructor(world) {
    super(world)
    this.scene = new THREE.Scene()
    this.models = new Map() // id -> Model
    this.octree = new LooseOctree({
      scene: this.scene,
      center: new THREE.Vector3(0, 0, 0),
      size: 10,
    })
    this.defaultMaterial = null
    this.raycaster = new THREE.Raycaster()
    this.raycaster.firstHitOnly = true
    this.raycastHits = []
    this.maskNone = new THREE.Layers()
    this.maskNone.enableAll()
    this.dirtyNodes = new Set()
    
    // Frustum culling support
    this.frustum = new THREE.Frustum()
    this.cameraMatrix = new THREE.Matrix4()
    this.visibleObjects = []
    this.frustumCullingEnabled = true
    
    // Performance tracking
    this.stats = {
      totalObjects: 0,
      visibleObjects: 0,
      culledObjects: 0,
      lastCullTime: 0
    }
  }

  init({ viewport }) {
    this.viewport = viewport
    this.scene.add(this.world.rig)
  }

  update(delta) {
    // Perform frustum culling if enabled
    if (this.frustumCullingEnabled) {
      this.performFrustumCulling()
    }
    
    this.models.forEach(model => model.clean())
  }
  
  performFrustumCulling() {
    const startTime = performance.now()
    
    // Update frustum from camera
    this.cameraMatrix.multiplyMatrices(
      this.world.camera.projectionMatrix, 
      this.world.camera.matrixWorldInverse
    )
    this.frustum.setFromProjectionMatrix(this.cameraMatrix)
    
    // Reset stats
    this.stats.totalObjects = 0
    this.stats.visibleObjects = 0
    this.stats.culledObjects = 0
    
    // Use octree for coarse culling, then frustum for fine culling
    this.visibleObjects.length = 0
    this.octree.frustumCull(this.frustum, this.visibleObjects)
    
    // Update models based on culling results
    this.models.forEach(model => {
      model.updateVisibility(this.visibleObjects)
    })
    
    // Update performance stats
    this.stats.visibleObjects = this.visibleObjects.length
    this.stats.lastCullTime = performance.now() - startTime
  }

  postUpdate() {
    this.clean() // after update all matrices should be up to date for next step
  }

  postLateUpdate() {
    this.clean() // after lateUpdate all matrices should be up to date for next step
  }

  getDefaultMaterial() {
    if (!this.defaultMaterial) {
      this.defaultMaterial = this.createMaterial()
    }
    return this.defaultMaterial
  }

  clean() {
    for (const node of this.dirtyNodes) {
      node.clean()
    }
    this.dirtyNodes.clear()
  }

  insert(options) {
    if (options.linked) {
      return this.insertLinked(options)
    } else {
      return this.insertSingle(options)
    }
  }

  insertLinked({ geometry, material, castShadow, receiveShadow, node, matrix }) {
    // Enhanced batching: Use geometry and material hashes for better merging
    const geometryHash = this.getGeometryHash(geometry)
    const materialHash = this.getMaterialHash(material)
    const id = `${geometryHash}/${materialHash}/${castShadow}/${receiveShadow}`
    
    if (!this.models.has(id)) {
      const model = new Model(this, geometry, material, castShadow, receiveShadow)
      this.models.set(id, model)
    }
    return this.models.get(id).create(node, matrix)
  }

  getGeometryHash(geometry) {
    // Create a more stable hash based on geometry properties rather than UUID
    if (geometry._hyperfyHash) return geometry._hyperfyHash
    
    const attributes = geometry.attributes
    let hash = ''
    
    // Hash vertex count and key attributes
    if (attributes.position) hash += `pos:${attributes.position.count}`
    if (attributes.normal) hash += `norm:${attributes.normal.count}`
    if (attributes.uv) hash += `uv:${attributes.uv.count}`
    if (geometry.index) hash += `idx:${geometry.index.count}`
    
    // Include geometry type information
    hash += `type:${geometry.type || 'BufferGeometry'}`
    
    geometry._hyperfyHash = hash
    return hash
  }

  getMaterialHash(material) {
    // Create a hash based on material properties for better batching
    if (material._hyperfyHash) return material._hyperfyHash
    
    let hash = material.type || 'Material'
    
    // Include key material properties that affect rendering
    if (material.color) hash += `col:${material.color.getHex()}`
    if (material.map) hash += `map:${material.map.uuid}`
    if (material.normalMap) hash += `norm:${material.normalMap.uuid}`
    if (material.roughness !== undefined) hash += `rough:${material.roughness}`
    if (material.metalness !== undefined) hash += `metal:${material.metalness}`
    if (material.transparent !== undefined) hash += `trans:${material.transparent}`
    if (material.alphaTest !== undefined) hash += `alpha:${material.alphaTest}`
    
    material._hyperfyHash = hash
    return hash
  }

  insertSingle({ geometry, material, castShadow, receiveShadow, node, matrix }) {
    material = this.createMaterial({ raw: material })
    const mesh = new THREE.Mesh(geometry, material.raw)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    mesh.matrixWorld.copy(matrix)
    mesh.matrixAutoUpdate = false
    mesh.matrixWorldAutoUpdate = false
    const sItem = {
      matrix,
      geometry,
      material: material.raw,
      getEntity: () => node.ctx.entity,
      node,
    }
    this.scene.add(mesh)
    this.octree.insert(sItem)
    return {
      material: material.proxy,
      move: matrix => {
        mesh.matrixWorld.copy(matrix)
        this.octree.move(sItem)
      },
      destroy: () => {
        this.scene.remove(mesh)
        this.octree.remove(sItem)
      },
    }
  }

  createMaterial(options = {}) {
    const self = this
    const material = {}
    let raw
    if (options.raw) {
      raw = options.raw.clone()
      raw.onBeforeCompile = options.raw.onBeforeCompile
    } else if (options.unlit) {
      raw = new THREE.MeshBasicMaterial({
        color: options.color || 'white',
      })
    } else {
      raw = new THREE.MeshStandardMaterial({
        color: options.color || 'white',
        metalness: isNumber(options.metalness) ? options.metalness : 0,
        roughness: isNumber(options.roughness) ? options.roughness : 1,
      })
    }
    raw.shadowSide = THREE.BackSide // fix csm shadow banding
    const textures = []
    if (raw.map) {
      raw.map = raw.map.clone()
      textures.push(raw.map)
    }
    if (raw.emissiveMap) {
      raw.emissiveMap = raw.emissiveMap.clone()
      textures.push(raw.emissiveMap)
    }
    if (raw.normalMap) {
      raw.normalMap = raw.normalMap.clone()
      textures.push(raw.normalMap)
    }
    if (raw.bumpMap) {
      raw.bumpMap = raw.bumpMap.clone()
      textures.push(raw.bumpMap)
    }
    if (raw.roughnessMap) {
      raw.roughnessMap = raw.roughnessMap.clone()
      textures.push(raw.roughnessMap)
    }
    if (raw.metalnessMap) {
      raw.metalnessMap = raw.metalnessMap.clone()
      textures.push(raw.metalnessMap)
    }
    this.world.setupMaterial(raw)
    const proxy = {
      get id() {
        return raw.uuid
      },
      get textureX() {
        return textures[0]?.offset.x
      },
      set textureX(val) {
        for (const tex of textures) {
          tex.offset.x = val
        }
        raw.needsUpdate = true
      },
      get textureY() {
        return textures[0]?.offset.y
      },
      set textureY(val) {
        for (const tex of textures) {
          tex.offset.y = val
        }
        raw.needsUpdate = true
      },
      get color() {
        return raw.color
      },
      set color(val) {
        if (typeof val !== 'string') {
          throw new Error('[material] color must be a string (e.g. "red", "#ff0000", "rgb(255,0,0)")')
        }
        raw.color.set(val)
        raw.needsUpdate = true
      },
      get emissiveIntensity() {
        return raw.emissiveIntensity
      },
      set emissiveIntensity(value) {
        if (!isNumber(value)) {
          throw new Error('[material] emissiveIntensity not a number')
        }
        raw.emissiveIntensity = value
        raw.needsUpdate = true
      },
      get fog() {
        return raw.fog
      },
      set fog(value) {
        raw.fog = value
        raw.needsUpdate = true
      },
      // TODO: not yet
      // clone() {
      //   return self.createMaterial(options).proxy
      // },
      get _ref() {
        if (world._allowMaterial) return material
      },
    }
    material.raw = raw
    material.proxy = proxy
    return material
  }

  raycastPointer(position, layers = this.maskNone, min = 0, max = Infinity) {
    if (!this.viewport) throw new Error('no viewport')
    const rect = this.viewport.getBoundingClientRect()
    vec2.x = ((position.x - rect.left) / rect.width) * 2 - 1
    vec2.y = -((position.y - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(vec2, this.world.camera)
    this.raycaster.layers = layers
    this.raycaster.near = min
    this.raycaster.far = max
    this.raycastHits.length = 0
    this.octree.raycast(this.raycaster, this.raycastHits)
    return this.raycastHits
  }

  raycastReticle(layers = this.maskNone, min = 0, max = Infinity) {
    if (!this.viewport) throw new Error('no viewport')
    vec2.x = 0
    vec2.y = 0
    this.raycaster.setFromCamera(vec2, this.world.camera)
    this.raycaster.layers = layers
    this.raycaster.near = min
    this.raycaster.far = max
    this.raycastHits.length = 0
    this.octree.raycast(this.raycaster, this.raycastHits)
    return this.raycastHits
  }

  destroy() {
    this.models.clear()
  }

  // Performance monitoring and debugging utilities
  getPerformanceStats() {
    const totalModels = this.models.size
    const totalInstances = Array.from(this.models.values()).reduce((sum, model) => sum + model.items.length, 0)
    
    return {
      ...this.stats,
      totalModels,
      totalInstances,
      averageInstancesPerModel: totalInstances / Math.max(totalModels, 1),
      cullRatio: this.stats.totalObjects > 0 ? this.stats.culledObjects / this.stats.totalObjects : 0
    }
  }

  logPerformanceStats() {
    const stats = this.getPerformanceStats()
    console.group('Hyperfy Stage Performance Stats')
    console.log(`Total Models: ${stats.totalModels}`)
    console.log(`Total Instances: ${stats.totalInstances}`)
    console.log(`Average Instances per Model: ${stats.averageInstancesPerModel.toFixed(2)}`)
    console.log(`Total Objects: ${stats.totalObjects}`)
    console.log(`Visible Objects: ${stats.visibleObjects}`)
    console.log(`Culled Objects: ${stats.culledObjects}`)
    console.log(`Cull Ratio: ${(stats.cullRatio * 100).toFixed(1)}%`)
    console.log(`Last Cull Time: ${stats.lastCullTime.toFixed(2)}ms`)
    console.log(`Frustum Culling: ${this.frustumCullingEnabled ? 'Enabled' : 'Disabled'}`)
    console.groupEnd()
  }

  enableFrustumCulling(enabled = true) {
    this.frustumCullingEnabled = enabled
    console.log(`Frustum culling ${enabled ? 'enabled' : 'disabled'}`)
  }
}

class Model {
  constructor(stage, geometry, material, castShadow, receiveShadow) {
    material = stage.createMaterial({ raw: material })

    this.stage = stage
    this.geometry = geometry
    this.material = material
    this.castShadow = castShadow
    this.receiveShadow = receiveShadow

    if (!this.geometry.boundsTree) this.geometry.computeBoundsTree()

    // this.mesh = mesh.clone()
    // this.mesh.geometry.computeBoundsTree() // three-mesh-bvh
    // // this.mesh.geometry.computeBoundingBox() // spatial octree
    // // this.mesh.geometry.computeBoundingSphere() // spatial octree
    // this.mesh.material.shadowSide = THREE.BackSide // fix csm shadow banding
    // this.mesh.castShadow = true
    // this.mesh.receiveShadow = true
    // this.mesh.matrixAutoUpdate = false
    // this.mesh.matrixWorldAutoUpdate = false

    this.iMesh = new THREE.InstancedMesh(this.geometry, this.material.raw, 10)
    // this.iMesh.name = this.mesh.name
    this.iMesh.castShadow = this.castShadow
    this.iMesh.receiveShadow = this.receiveShadow
    this.iMesh.matrixAutoUpdate = false
    this.iMesh.matrixWorldAutoUpdate = false
    this.iMesh.frustumCulled = false // Disable Three.js frustum culling - we handle it manually
    this.iMesh.getEntity = this.getEntity.bind(this)
    this.items = [] // { matrix, node }
    this.dirty = true
    
    // Performance tracking per model
    this.stats = {
      totalInstances: 0,
      visibleInstances: 0,
      lastUpdateTime: 0
    }
  }

  create(node, matrix) {
    const item = {
      idx: this.items.length,
      node,
      matrix,
      // octree
    }
    this.items.push(item)
    this.iMesh.setMatrixAt(item.idx, item.matrix) // silently fails if too small, gets increased in clean()
    this.dirty = true
    const sItem = {
      matrix,
      geometry: this.geometry,
      material: this.material.raw,
      getEntity: () => this.items[item.idx]?.node.ctx.entity,
      node,
    }
    this.stage.octree.insert(sItem)
    return {
      material: this.material.proxy,
      move: matrix => {
        this.move(item, matrix)
        this.stage.octree.move(sItem)
      },
      destroy: () => {
        this.destroy(item)
        this.stage.octree.remove(sItem)
      },
    }
  }

  move(item, matrix) {
    item.matrix.copy(matrix)
    this.iMesh.setMatrixAt(item.idx, matrix)
    this.dirty = true
  }

  destroy(item) {
    const last = this.items[this.items.length - 1]
    const isOnly = this.items.length === 1
    const isLast = item === last
    if (isOnly) {
      this.items = []
      this.dirty = true
    } else if (isLast) {
      // this is the last instance in the buffer, pop it off the end
      this.items.pop()
      this.dirty = true
    } else {
      // there are other instances after this one in the buffer, swap it with the last one and pop it off the end
      this.iMesh.setMatrixAt(item.idx, last.matrix)
      last.idx = item.idx
      this.items[item.idx] = last
      this.items.pop()
      this.dirty = true
    }
  }

  clean() {
    if (!this.dirty) return
    const size = this.iMesh.instanceMatrix.array.length / 16
    const count = this.items.length
    if (size < this.items.length) {
      const newSize = count + 100
      // console.log('increase', this.mesh.name, 'from', size, 'to', newSize)
      this.iMesh.resize(newSize)
      for (let i = size; i < count; i++) {
        this.iMesh.setMatrixAt(i, this.items[i].matrix)
      }
    }
    this.iMesh.count = count
    if (this.iMesh.parent && !count) {
      this.stage.scene.remove(this.iMesh)
      this.dirty = false
      return
    }
    if (!this.iMesh.parent && count) {
      this.stage.scene.add(this.iMesh)
    }
    this.iMesh.instanceMatrix.needsUpdate = true
    // this.iMesh.computeBoundingSphere()
    this.dirty = false
  }

  updateVisibility(visibleItems) {
    if (!this.stage.frustumCullingEnabled) return
    
    const startTime = performance.now()
    
    // Create a set of visible item nodes for fast lookup
    const visibleNodes = new Set()
    for (const item of visibleItems) {
      if (item.geometry === this.geometry && item.material === this.material.raw) {
        visibleNodes.add(item.node)
      }
    }
    
    // Update instance visibility - pack visible instances to the front
    let visibleCount = 0
    let needsUpdate = false
    
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]
      const isVisible = visibleNodes.has(item.node)
      
      if (isVisible) {
        // Move visible instances to the front of the buffer
        if (visibleCount !== i) {
          this.iMesh.setMatrixAt(visibleCount, item.matrix)
          needsUpdate = true
        }
        visibleCount++
      }
    }
    
    // Only render visible instances
    const prevCount = this.iMesh.count
    this.iMesh.count = visibleCount
    
    // Update stats
    this.stats.totalInstances = this.items.length
    this.stats.visibleInstances = visibleCount
    this.stats.lastUpdateTime = performance.now() - startTime
    
    this.stage.stats.totalObjects += this.items.length
    this.stage.stats.culledObjects += (this.items.length - visibleCount)
    
    // Only update matrix buffer if needed
    if (needsUpdate || prevCount !== visibleCount) {
      this.iMesh.instanceMatrix.needsUpdate = true
    }
  }

  getEntity(instanceId) {
    console.warn('TODO: remove if you dont ever see this')
    return this.items[instanceId]?.node.ctx.entity
  }

  getTriangles() {
    const geometry = this.geometry
    if (geometry.index !== null) {
      return geometry.index.count / 3
    } else {
      return geometry.attributes.position.count / 3
    }
  }
}
