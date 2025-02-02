import * as THREE from '../extras/three'
import { System } from './System'
import { ControlPriorities } from '../extras/ControlPriorities'

const MIN_CAMERA_SPEED = 1
const MAX_CAMERA_SPEED = 50
const ROTATION_SPEED = 2 // Fixed rotation speed
const SPEED_ADJUST_FACTOR = 1.2

export class BuildMode extends System {
	constructor(world) {
		super(world)
		this.active = false
		this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

		// Initialize speeds
		this.moveSpeed = 10
		this.rotateSpeed = ROTATION_SPEED

		// Add smooth camera rotation
		this.targetRotation = new THREE.Euler(0, 0, 0, 'YXZ')
		this.currentRotation = new THREE.Euler(0, 0, 0, 'YXZ')
		this.rotationVelocity = new THREE.Vector2(0, 0)
		this.lastMousePosition = new THREE.Vector2()

		// Store original camera position when entering build mode
		this.originalCameraPosition = new THREE.Vector3()
		this.originalCameraQuaternion = new THREE.Quaternion()

		// Store original player velocity
		this.originalPlayerVelocity = new THREE.Vector3()

		// Bind methods
		this.onMouseMove = this.onMouseMove.bind(this)
	}

	start() {
		this.control = this.world.controls.bind({
			priority: ControlPriorities.EDITOR,
			onPress: code => {
				if (code === 'KeyB') {
					this.toggleBuildMode()
				}
			},
			onScroll: () => {
				if (!this.active) return false

				// Only adjust movement speed with scroll wheel
				const delta = this.control.scroll.delta
				if (delta < 0) {
					this.moveSpeed = Math.min(MAX_CAMERA_SPEED, this.moveSpeed * SPEED_ADJUST_FACTOR)
				} else if (delta > 0) {
					this.moveSpeed = Math.max(MIN_CAMERA_SPEED, this.moveSpeed / SPEED_ADJUST_FACTOR)
				}
				return true
			}
		})

		// Handle window resize
		window.addEventListener('resize', this.onResize)
		this.onResize()
	}

	onResize = () => {
		this.camera.aspect = window.innerWidth / window.innerHeight
		this.camera.updateProjectionMatrix()
	}

	onMouseMove(event) {
		if (!this.active) return

		const deltaX = -event.movementX * 0.002 * this.rotateSpeed
		const deltaY = -event.movementY * 0.002 * this.rotateSpeed

		// Update target rotation
		this.targetRotation.y += deltaX
		this.targetRotation.x += deltaY

		// Clamp vertical rotation to prevent camera flipping
		this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x))
	}

	toggleBuildMode() {
		this.active = !this.active
		const player = this.world.entities.player

		if (this.active) {
			// Add mouse move listener for camera rotation
			document.addEventListener('mousemove', this.onMouseMove)

			// Request pointer lock
			document.body.requestPointerLock()

			// Store current camera state
			this.originalCameraPosition.copy(this.world.camera.position)
			this.originalCameraQuaternion.copy(this.world.camera.quaternion)

			// Initialize rotations
			this.currentRotation.setFromQuaternion(this.world.camera.quaternion)
			this.targetRotation.copy(this.currentRotation)

			// Position camera above player
			const playerPosition = player.base.position.clone()
			this.camera.position.copy(playerPosition).add(new THREE.Vector3(0, 5, 0))
			this.camera.lookAt(playerPosition)

			// Take control of the camera
			this.control.camera.claim()

			// Disable player movement and camera control
			player.control.camera.unclaim()
			player.control.priority = -1

			// Store and zero out player velocity
			this.originalPlayerVelocity.copy(player.capsule.getLinearVelocity())
			player.capsule.setLinearVelocity({ x: 0, y: 0, z: 0 })

			// Lock the player in place
			player.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)

			// Completely freeze player state
			player.moving = false
			player.running = false
			player.jumping = false
			player.falling = false
			player.sliding = false
			player.crouching = false
			player.sprinting = false
			player.swimming = false
			player.flying = false
			player.emote = null

			// Completely freeze the player model
			if (player.avatar) {
				// Store original visibility
				this.originalAvatarVisible = player.avatar.visible
				// Hide the avatar
				player.avatar.visible = false
				// Stop all animations
				if (player.avatar.mixer) {
					player.avatar.mixer.stopAllAction()
				}
			}

			// Hide the player model if it exists
			if (player.base) {
				this.originalBaseVisible = player.base.visible
				player.base.visible = false
			}

			// Disable player update loop
			this.originalUpdate = player.update
			player.update = () => { }

		} else {
			// Remove mouse move listener
			document.removeEventListener('mousemove', this.onMouseMove)

			// Exit pointer lock
			if (document.pointerLockElement) {
				document.exitPointerLock()
			}

			// Return control and restore original camera
			this.control.camera.unclaim()
			this.world.camera.position.copy(this.originalCameraPosition)
			this.world.camera.quaternion.copy(this.originalCameraQuaternion)

			// Re-enable player movement and camera control
			player.control.camera.claim()
			player.control.priority = ControlPriorities.PLAYER

			// Unlock the player and restore velocity
			player.capsule.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, false)
			player.capsule.setLinearVelocity(this.originalPlayerVelocity)

			// Restore player model visibility
			if (player.avatar) {
				player.avatar.visible = this.originalAvatarVisible
				if (player.avatar.mixer) {
					// Reset the mixer and start idle animation
					player.avatar.mixer.stopAllAction()
					player.emote = 'idle'
				}
			}

			if (player.base) {
				player.base.visible = this.originalBaseVisible
			}

			// Restore player update loop
			if (this.originalUpdate) {
				player.update = this.originalUpdate
			}
		}
	}

	update(delta) {
		if (!this.active) return

		// Smoothly interpolate current rotation to target rotation
		const rotationLerp = 1 - Math.pow(0.001, delta) // Smooth interpolation factor
		this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * rotationLerp
		this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * rotationLerp
		this.camera.quaternion.setFromEuler(this.currentRotation)

		// Handle camera movement
		if (this.control.buttons.KeyW) this.moveForward(this.moveSpeed * delta)
		if (this.control.buttons.KeyS) this.moveBackward(this.moveSpeed * delta)
		if (this.control.buttons.KeyA) this.moveLeft(this.moveSpeed * delta)
		if (this.control.buttons.KeyD) this.moveRight(this.moveSpeed * delta)
		if (this.control.buttons.Space) this.moveUp(this.moveSpeed * delta)
		if (this.control.buttons.KeyC) this.moveDown(this.moveSpeed * delta)

		// Update the control camera
		this.control.camera.position.copy(this.camera.position)
		this.control.camera.quaternion.copy(this.camera.quaternion)
	}

	moveForward(distance) {
		const direction = new THREE.Vector3(0, 0, -1)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveBackward(distance) {
		const direction = new THREE.Vector3(0, 0, 1)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveLeft(distance) {
		const direction = new THREE.Vector3(-1, 0, 0)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveRight(distance) {
		const direction = new THREE.Vector3(1, 0, 0)
		direction.applyQuaternion(this.camera.quaternion)
		this.camera.position.addScaledVector(direction, distance)
	}

	moveUp(distance) {
		this.camera.position.y += distance
	}

	moveDown(distance) {
		this.camera.position.y -= distance
	}

	destroy() {
		window.removeEventListener('resize', this.onResize)
		document.removeEventListener('mousemove', this.onMouseMove)
		if (document.pointerLockElement) {
			document.exitPointerLock()
		}
		if (this.active) {
			this.toggleBuildMode()
		}
	}
}