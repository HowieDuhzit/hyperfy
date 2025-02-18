/**
 * Particle System Worker
 * 
 * Handles particle simulation computations off the main thread.
 * Supports creating, updating, and destroying particle systems.
 */

const systems = new Map() // id -> ParticleSystem

class ParticleSystem {
  constructor(id, options = {}) {
    this.id = id
    this.particles = []
    this.isDebugging = false
    this.currentPosition = { x: 0, y: 0, z: 0 }
    this.currentNormal = { x: 0, y: 0, z: 1 }
    this.currentVelocity = { x: 0, y: 0, z: 0 }
    this.currentSpeed = 0
    this.isEmitting = false
    this.options = {
      maxParticles: options.maxParticles || 1000,
      emissionRate: options.emissionRate || 10, // particles per second
      particleLifetime: options.particleLifetime || 2, // seconds
      velocity: options.velocity || { x: 0, y: 1, z: 0 },
      spread: options.spread || { x: 0.5, y: 0.5, z: 0.5 },
      gravity: options.gravity || { x: 0, y: -9.81, z: 0 },
      followStrength: options.followStrength || 5, // How quickly particles follow cursor
      surfaceOffset: options.surfaceOffset || 0.02, // How far to offset from surface
      ...options
    }
  }

  update(delta, position, normal, velocity, speed, emitting) {
    // Update current state
    if (position) {
      this.currentPosition = position
    }
    if (normal) {
      this.currentNormal = normal
    }
    if (velocity) {
      this.currentVelocity = velocity
    }
    if (speed !== undefined) {
      this.currentSpeed = speed
    }
    if (emitting !== undefined) {
      this.isEmitting = emitting
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]
      particle.lifetime += delta

      if (particle.lifetime >= this.options.particleLifetime) {
        this.particles.splice(i, 1)
        continue
      }

      // Calculate direction to cursor position on surface
      const dx = this.currentPosition.x - particle.position.x
      const dy = this.currentPosition.y - particle.position.y
      const dz = this.currentPosition.z - particle.position.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Update velocity to follow cursor while staying near surface
      if (dist > 0.001) {
        const followStrength = this.options.followStrength * (1 - particle.lifetime / this.options.particleLifetime)
        
        // Add force toward cursor position
        particle.velocity.x += (dx / dist) * followStrength * delta
        particle.velocity.y += (dy / dist) * followStrength * delta
        particle.velocity.z += (dz / dist) * followStrength * delta

        // Project velocity onto surface plane using normal
        const dot = particle.velocity.x * this.currentNormal.x + 
                   particle.velocity.y * this.currentNormal.y + 
                   particle.velocity.z * this.currentNormal.z
        
        particle.velocity.x -= this.currentNormal.x * dot
        particle.velocity.y -= this.currentNormal.y * dot
        particle.velocity.z -= this.currentNormal.z * dot
      }

      // Add cursor velocity influence (projected onto surface)
      const cursorDot = this.currentVelocity.x * this.currentNormal.x + 
                       this.currentVelocity.y * this.currentNormal.y + 
                       this.currentVelocity.z * this.currentNormal.z
      
      const projectedVelocity = {
        x: this.currentVelocity.x - this.currentNormal.x * cursorDot,
        y: this.currentVelocity.y - this.currentNormal.y * cursorDot,
        z: this.currentVelocity.z - this.currentNormal.z * cursorDot
      }

      particle.velocity.x += projectedVelocity.x * delta * 2
      particle.velocity.y += projectedVelocity.y * delta * 2
      particle.velocity.z += projectedVelocity.z * delta * 2

      // Apply stronger damping for world space
      const damping = 0.85
      particle.velocity.x *= damping
      particle.velocity.y *= damping
      particle.velocity.z *= damping

      // Update position
      particle.position.x += particle.velocity.x * delta
      particle.position.y += particle.velocity.y * delta
      particle.position.z += particle.velocity.z * delta

      // Keep particles very close to surface
      const normalDist = (particle.position.x - this.currentPosition.x) * this.currentNormal.x +
                        (particle.position.y - this.currentPosition.y) * this.currentNormal.y +
                        (particle.position.z - this.currentPosition.z) * this.currentNormal.z

      // Apply stronger correction to keep particles on surface
      const surfaceCorrection = 0.8
      particle.position.x -= this.currentNormal.x * (normalDist - this.options.surfaceOffset) * surfaceCorrection
      particle.position.y -= this.currentNormal.y * (normalDist - this.options.surfaceOffset) * surfaceCorrection
      particle.position.z -= this.currentNormal.z * (normalDist - this.options.surfaceOffset) * surfaceCorrection

      // Store velocity magnitude for color calculations
      particle.velocityMagnitude = Math.sqrt(
        particle.velocity.x * particle.velocity.x + 
        particle.velocity.y * particle.velocity.y +
        particle.velocity.z * particle.velocity.z
      )
    }

    // Emit new particles at current position if emitting
    if (this.isEmitting) {
      const particlesToEmit = Math.floor(this.options.emissionRate * delta)
      for (let i = 0; i < particlesToEmit; i++) {
        if (this.particles.length >= this.options.maxParticles) break

        const spread = this.options.spread
        
        // Create random direction in tangent space
        const rx = (Math.random() - 0.5) * spread.x
        const ry = (Math.random() - 0.5) * spread.y
        const rz = (Math.random() - 0.5) * spread.z

        // Project onto surface plane
        const dot = rx * this.currentNormal.x + 
                   ry * this.currentNormal.y + 
                   rz * this.currentNormal.z

        const tangentX = rx - this.currentNormal.x * dot
        const tangentY = ry - this.currentNormal.y * dot
        const tangentZ = rz - this.currentNormal.z * dot

        // Scale down initial spread
        const spreadScale = 0.05
        
        this.particles.push({
          position: {
            x: this.currentPosition.x + tangentX * spreadScale,
            y: this.currentPosition.y + tangentY * spreadScale,
            z: this.currentPosition.z + tangentZ * spreadScale
          },
          velocity: {
            x: tangentX * 0.1,
            y: tangentY * 0.1,
            z: tangentZ * 0.1
          },
          velocityMagnitude: 0,
          lifetime: 0
        })
      }
    }

    // Send updated particle data to main thread
    self.postMessage({
      systemId: this.id,
      particles: this.particles.map(p => ({
        position: p.position,
        lifetime: p.lifetime / this.options.particleLifetime, // normalized lifetime
        velocity: p.velocityMagnitude // for color intensity
      }))
    })
  }

  setDebug(enabled) {
    this.isDebugging = enabled
  }
}

// Handle messages from main thread
self.onmessage = event => {
  const msg = event.data

  switch (msg.op) {
    case 'create':
      systems.set(msg.id, new ParticleSystem(msg.id, msg))
      break

    case 'update':
      const system = systems.get(msg.systemId)
      if (system) {
        system.update(msg.delta, msg.position, msg.normal, msg.velocity, msg.speed, msg.emitting)
      }
      break

    case 'destroy':
      systems.delete(msg.systemId)
      break

    case 'debug':
      systems.forEach(system => system.setDebug(msg.enabled))
      break

    default:
      console.error('[particles worker] Unknown operation:', msg.op)
  }
} 