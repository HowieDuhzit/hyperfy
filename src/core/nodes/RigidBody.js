import * as THREE from '../extras/three'

import { Node } from './Node'
import { isFunction, isNumber } from 'lodash-es'

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _m3 = new THREE.Matrix4()
const _defaultScale = new THREE.Vector3(1, 1, 1)

const types = ['static', 'kinematic', 'dynamic']

const defaults = {
  type: 'static',
  mass: 1,
  tag: null,
  onContactStart: null,
  onContactEnd: null,
  onTriggerEnter: null,
  onTriggerLeave: null,
}

export class RigidBody extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'rigidbody'

    this.shapes = new Set()

    this.type = data.type
    this.mass = data.mass
    this.tag = data.tag
    this.onContactStart = data.onContactStart
    this.onContactEnd = data.onContactEnd
    this.onTriggerEnter = data.onTriggerEnter
    this.onTriggerLeave = data.onTriggerLeave

    this._tm = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)

    this.tempVec3 = new THREE.Vector3()
    this.tempQuat = new THREE.Quaternion()
  }

  mount() {
    this.needsRebuild = false
    if (!this.ctx.physics) return // physics ignored when moving apps around
    this.matrixWorld.decompose(_v1, _q1, _v2)
    this.transform = new PHYSX.PxTransform(PHYSX.PxIDENTITYEnum.PxIdentity)
    _v1.toPxTransform(this.transform)
    _q1.toPxTransform(this.transform)
    if (this._type === 'static') {
      this.actor = this.ctx.world.physics.physics.createRigidStatic(this.transform)
    } else if (this._type === 'kinematic') {
      this.actor = this.ctx.world.physics.physics.createRigidDynamic(this.transform)
      this.actor.setRigidBodyFlag(PHYSX.PxRigidBodyFlagEnum.eKINEMATIC, true)
      // this.actor.setMass(this.mass)
      PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(this.actor, this._mass)
      // this.untrack = this.ctx.world.physics.track(this.actor, this.onPhysicsMovement)
    } else if (this._type === 'dynamic') {
      this.actor = this.ctx.world.physics.physics.createRigidDynamic(this.transform)
      // this.actor.setMass(this.mass)
      PHYSX.PxRigidBodyExt.prototype.setMassAndUpdateInertia(this.actor, this._mass)
      // this.untrack = this.ctx.world.physics.track(this.actor, this.onPhysicsMovement)
    }
    for (const shape of this.shapes) {
      this.actor.attachShape(shape)
    }
    const self = this
    const player = this.ctx.entity?.isPlayer ? this.ctx.entity.getProxy() : null
    this.actorHandle = this.ctx.world.physics.addActor(this.actor, {
      onInterpolate: this._type === 'kinematic' || this._type === 'dynamic' ? this.onInterpolate : null,
      get tag() {
        return self._tag
      },
      get player() {
        return player
      },
      get onContactStart() {
        return self._onContactStart
      },
      get onContactEnd() {
        return self._onContactEnd
      },
      get onTriggerEnter() {
        return self._onTriggerEnter
      },
      get onTriggerLeave() {
        return self._onTriggerLeave
      },
    })
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      this.actorHandle?.move(this.matrixWorld)
    }
  }

  onInterpolate = (position, quaternion) => {
    if (this.parent) {
      _m1.compose(position, quaternion, _defaultScale)
      _m2.copy(this.parent.matrixWorld).invert()
      _m3.multiplyMatrices(_m2, _m1)
      _m3.decompose(this.position, this.quaternion, _v1)
      // this.matrix.copy(_m3)
      // this.matrixWorld.copy(_m1)
    } else {
      this.position.copy(position)
      this.quaternion.copy(quaternion)
      // this.matrix.compose(this.position, this.quaternion, this.scale)
      // this.matrixWorld.copy(this.matrix)
    }
  }

  unmount() {
    if (this.actor) {
      // this.untrack?.()
      // this.untrack = null
      this.actorHandle?.destroy()
      this.actorHandle = null
      this.actor.release()
      this.actor = null
    }
  }

  addShape(shape) {
    if (!shape) return
    this.shapes.add(shape)
    if (this.actor) {
      this.actor.attachShape(shape)
    }
  }

  removeShape(shape) {
    if (!shape) return
    this.shapes.delete(shape)
    if (this.actor) {
      this.actor.detachShape(shape)
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._type = source._type
    this._mass = source._mass
    this._tag = source._tag
    this._onContactStart = source._onContactStart
    this._onContactEnd = source._onContactEnd
    this._onTriggerEnter = source._onTriggerEnter
    this._onTriggerLeave = source._onTriggerLeave
    return this
  }

  get type() {
    return this._type
  }

  set type(value = defaults.type) {
    if (!isType(value)) {
      throw new Error(`[rigidbody] type invalid: ${value}`)
    }
    if (this._type === value) return
    this._type = value
    this.needsRebuild = true
    this.setDirty()
  }

  get mass() {
    return this._mass
  }

  set mass(value = defaults.mass) {
    if (!isNumber(value)) {
      throw new Error('[rigidbody] mass not a number')
    }
    if (value < 0) {
      throw new Error('[rigidbody] mass cannot be less than zero')
    }
    this._mass = value
    this.needsRebuild = true
    this.setDirty()
  }

  get tag() {
    return this._tag
  }

  set tag(value = defaults.tag) {
    if (isNumber(value)) {
      value = value + ''
    }
    if (value !== null && !isString(value)) {
      throw new Error('[rigidbody] tag not a string')
    }
    this._tag = value
  }

  get onContactStart() {
    return this._onContactStart
  }

  set onContactStart(value = defaults.onContactStart) {
    if (value !== null && !isFunction(value)) {
      throw new Error('[rigidbody] onContactStart not a function')
    }
    this._onContactStart = value
  }

  get onContactEnd() {
    return this._onContactEnd
  }

  set onContactEnd(value = defaults.onContactEnd) {
    if (value !== null && !isFunction(value)) {
      throw new Error('[rigidbody] onContactEnd not a function')
    }
    this._onContactEnd = value
  }

  get onTriggerEnter() {
    return this._onTriggerEnter
  }

  set onTriggerEnter(value = defaults.onTriggerEnter) {
    if (value !== null && !isFunction(value)) {
      throw new Error('[rigidbody] onTriggerEnter not a function')
    }
    this._onTriggerEnter = value
  }

  get onTriggerLeave() {
    return this._onTriggerLeave
  }

  set onTriggerLeave(value = defaults.onTriggerLeave) {
    if (value !== null && !isFunction(value)) {
      throw new Error('[rigidbody] onTriggerLeave not a function')
    }
    this._onTriggerLeave = value
  }

  get sleeping() {
    if (!this.actor) return false
    return this.actor.isSleeping()
  }

  addForce(force, mode) {
    if (!force?.isVector3) {
      throw new Error('[rigidbody] addForce force must be Vector3')
    }
    // TODO: modes + enums injected into script
    this.actor?.addForce(force.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
  }

  addTorque(torque, mode) {
    if (!torque?.isVector3) {
      throw new Error('[rigidbody] addForce torque must be Vector3')
    }
    // TODO: modes + enums injected into script
    this.actor?.addTorque(torque.toPxVec3(), PHYSX.PxForceModeEnum.eFORCE, true)
  }

  getPosition(vec3) {
    if (!vec3) vec3 = this.tempVec3
    if (!this.actor) return vec3.set(0, 0, 0)
    const pose = this.actor.getGlobalPose()
    vec3.copy(pose.p)
    return vec3
  }

  setPosition(vec3) {
    if (!this.actor) return
    const pose = this.actor.getGlobalPose()
    vec3.toPxTransform(pose)
    this.actor.setGlobalPose(pose)
    this.position.copy(vec3)
  }

  getQuaternion(quat) {
    if (!quat) quat = this.tempQuat
    if (!this.actor) return quat.set(0, 0, 0)
    const pose = this.actor.getGlobalPose()
    quat.copy(pose.q)
    return quat
  }

  setQuaternion(quat) {
    if (!this.actor) return
    const pose = this.actor.getGlobalPose()
    quat.toPxTransform(pose)
    this.actor.setGlobalPose(pose)
    this.quaternion.copy(quat)
  }

  getLinearVelocity(vec3) {
    if (!vec3) vec3 = this.tempVec3
    if (!this.actor) return vec3.set(0, 0, 0)
    return vec3.fromPxVec3(this.actor.getLinearVelocity())
  }

  setLinearVelocity(vec3) {
    this.actor?.setLinearVelocity?.(vec3.toPxVec3())
  }

  getAngularVelocity(vec3) {
    if (!vec3) vec3 = this.tempVec3
    if (!this.actor) return vec3.set(0, 0, 0)
    return vec3.fromPxVec3(this.actor.getAngularVelocity())
  }

  setAngularVelocity(vec3) {
    this.actor?.setAngularVelocity?.(vec3.toPxVec3())
  }

  setKinematicTarget(position, quaternion) {
    if (this._type !== 'kinematic') {
      throw new Error('[rigidbody] setKinematicTarget failed (not kinematic)')
    }
    position.toPxTransform(this._tm)
    quaternion.toPxTransform(this._tm)
    this.actor?.setKinematicTarget(this._tm)
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get type() {
          return self.type
        },
        set type(value) {
          self.type = value
        },
        get mass() {
          return self.mass
        },
        set mass(value) {
          self.mass = value
        },
        get tag() {
          return self.tag
        },
        set tag(value) {
          self.tag = value
        },
        get onContactStart() {
          return self.onContactStart
        },
        set onContactStart(value) {
          self.onContactStart = value
        },
        get onContactEnd() {
          return self.onContactEnd
        },
        set onContactEnd(value) {
          self.onContactEnd = value
        },
        get onTriggerEnter() {
          return self.onTriggerEnter
        },
        set onTriggerEnter(value) {
          self.onTriggerEnter = value
        },
        get onTriggerLeave() {
          return self.onTriggerLeave
        },
        set onTriggerLeave(value) {
          self.onTriggerLeave = value
        },
        get sleeping() {
          return self.sleeping
        },
        addForce(force, mode) {
          self.addForce(force, mode)
        },
        addTorque(torque, mode) {
          self.addTorque(torque, mode)
        },
        getPosition(vec3) {
          return self.getPosition(vec3)
        },
        setPosition(vec3) {
          self.setPosition(vec3)
        },
        getQuaternion(quat) {
          return self.getQuaternion(quat)
        },
        setQuaternion(quat) {
          self.setQuaternion(quat)
        },
        getLinearVelocity(vec3) {
          return self.getLinearVelocity(vec3)
        },
        setLinearVelocity(vec3) {
          self.setLinearVelocity(vec3)
        },
        getAngularVelocity(vec3) {
          self.getAngularVelocity(vec3)
        },
        setAngularVelocity(vec3) {
          self.setAngularVelocity(vec3)
        },
        setKinematicTarget(position, quaternion) {
          self.setKinematicTarget(position, quaternion)
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isType(value) {
  return types.includes(value)
}
