import { isBoolean } from 'lodash-es'
import { System } from './System'
import * as THREE from '../extras/three'

/**
 * Client Particles System
 *
 * - Runs on the client
 * - Manages particle effects and animations
 * - Uses a WebWorker for performance optimization
 * - Supports debugging and system management
 * - Provides cursor particle effects when hovering over objects
 *
 */

let ids = -1

export class ClientParticles extends System {
  constructor(world) {
    super(world)
    this.worker = null
    this.systems = new Map() // id -> System
    this.cursorSystem = null
    this.cursorMesh = null
    this.cursorMaterial = null
    this.cursorGeometry = null
    this.isHovering = false
    this.lastPointerPosition = new THREE.Vector2()
    this.currentPointerPosition = new THREE.Vector2()
    this.currentHitPoint = new THREE.Vector3()
    this.currentHitNormal = new THREE.Vector3()
  }

  init() {
    this.worker = new Worker('/static/particles.js')
    this.worker.onmessage = this.onMessage
    this.worker.onerror = this.onError

    // Create cursor particle system
    this.initCursorParticles()

    // Bind to pointer events
    this.control = this.world.controls.bind({
      priority: 0, // Highest priority to catch all events
      onPointer: () => {
        // Update pointer positions
        const pointer = this.world.controls.pointer
        this.lastPointerPosition.copy(this.currentPointerPosition)
        this.currentPointerPosition.set(pointer.position.x, pointer.position.y)

        // Check if we're hovering over any objects
        const player = this.world.entities.player
        const hit = player?.pointerState?.hit
        const isHovering = !!hit

        if (hit) {
          // Store hit point and normal
          this.currentHitPoint.copy(hit.point)
          if (hit.normal) {
            this.currentHitNormal.copy(hit.normal)
          } else {
            this.currentHitNormal.set(0, 0, 1)
          }
          console.log('Hit:', {
            point: hit.point.toArray(),
            normal: hit.normal?.toArray() || [0, 0, 1],
            node: hit.node?.name || 'unnamed'
          })
        }

        if (isHovering !== this.isHovering) {
          console.log('Hover state changed:', isHovering)
          this.isHovering = isHovering
          // Update particle system
          if (this.cursorSystem) {
            this.worker.postMessage({
              op: 'update',
              systemId: this.cursorSystem.id,
              emitting: isHovering,
              delta: 0
            })
          }
        }
      }
    })
  }

  initCursorParticles() {
    // Create particle material with cyberpunk style
    this.cursorMaterial = new THREE.PointsMaterial({
      size: 0.05, // Much smaller size for world space
      blending: THREE.AdditiveBlending,
      transparent: true,
      vertexColors: true,
      depthWrite: false
    })

    // Create particle geometry
    this.cursorGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(1000 * 3) // x,y,z for each particle
    const colors = new Float32Array(1000 * 3) // r,g,b for each particle
    this.cursorGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.cursorGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    // Create particle mesh
    this.cursorMesh = new THREE.Points(this.cursorGeometry, this.cursorMaterial)
    this.cursorMesh.frustumCulled = false
    this.world.stage.scene.add(this.cursorMesh)

    // Create cursor particle system
    const node = {
      update: (data) => {
        if (!data?.particles) return
        
        const positions = this.cursorGeometry.attributes.position.array
        const colors = this.cursorGeometry.attributes.color.array
        
        // Update particles
        let idx = 0
        data.particles.forEach(particle => {
          // Use world space coordinates directly
          positions[idx * 3] = particle.position.x
          positions[idx * 3 + 1] = particle.position.y 
          positions[idx * 3 + 2] = particle.position.z

          // Enhanced cyberpunk color scheme with movement-based intensity
          const lifetime = particle.lifetime
          const pulseIntensity = Math.sin(lifetime * Math.PI * 4) * 0.5 + 0.5
          const moveIntensity = Math.min(1, particle.velocity * 0.1)
          colors[idx * 3] = 0.2 + lifetime * 0.8 + moveIntensity * 0.2 // Red - increases with lifetime and movement
          colors[idx * 3 + 1] = 0.8 + pulseIntensity * 0.2 - moveIntensity * 0.3 // Green - pulsing cyan, decreases with movement
          colors[idx * 3 + 2] = 1.0 // Blue - constant
          
          idx++
        })

        // Update geometry
        this.cursorGeometry.attributes.position.needsUpdate = true
        this.cursorGeometry.attributes.color.needsUpdate = true
        this.cursorGeometry.setDrawRange(0, data.particles.length)
      }
    }

    this.cursorSystem = this.createSystem(node, {
      maxParticles: 50,
      emissionRate: 60,
      particleLifetime: 0.3,
      velocity: { x: 0, y: 0, z: 0 },
      spread: { x: 0.1, y: 0.1, z: 0.02 }, // Adjusted spread for world space
      gravity: { x: 0, y: 0, z: 0 },
      followStrength: 12,
      surfaceOffset: 0.01 // Smaller offset for world space
    })
  }

  update(delta) {
    // Update all particle systems
    this.systems.forEach(system => {
      system.node.update(delta)
    })

    // Update cursor particle system with current pointer position if hovering
    if (this.cursorSystem && this.isHovering) {
      const velocity = {
        x: (this.currentPointerPosition.x - this.lastPointerPosition.x) / delta,
        y: (this.currentPointerPosition.y - this.lastPointerPosition.y) / delta
      }
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)

      this.worker.postMessage({
        op: 'update',
        systemId: this.cursorSystem.id,
        position: {
          x: this.currentHitPoint.x,
          y: this.currentHitPoint.y,
          z: this.currentHitPoint.z
        },
        normal: {
          x: this.currentHitNormal.x,
          y: this.currentHitNormal.y,
          z: this.currentHitNormal.z
        },
        velocity: {
          x: velocity.x * 0.001, // Scale down for world space
          y: velocity.y * 0.001,
          z: 0
        },
        speed,
        emitting: true,
        delta
      })
    }
  }

  onMessage = msg => {
    msg = msg.data
    this.systems.get(msg.systemId)?.node.update(msg)
  }

  onError = err => {
    console.error('[particles]', err)
  }

  createSystem(node, options) {
    const id = ++ids
    const system = {
      id,
      node,
      onMessage: null,
      send: (msg, transfers) => {
        msg.systemId = id
        this.worker.postMessage(msg, transfers)
      },
      destroy: () => {
        this.systems.delete(id)
        this.worker.postMessage({ op: 'destroy', systemId: id })
      },
    }
    this.systems.set(id, system)
    this.worker.postMessage({ op: 'create', id, ...options })
    return system
  }

  debug(enabled) {
    enabled = isBoolean(enabled) ? enabled : !this.isDebugging
    if (this.isDebugging === enabled) return
    this.worker.postMessage({ op: 'debug', enabled })
    this.isDebugging = enabled
  }

  destroy() {
    // Release control binding
    this.control?.release()

    // Clean up cursor particles
    if (this.cursorMesh) {
      this.world.stage.scene.remove(this.cursorMesh)
      this.cursorGeometry.dispose()
      this.cursorMaterial.dispose()
    }

    // Clean up all systems
    this.systems.forEach(system => system.destroy())
    this.systems.clear()
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
} 