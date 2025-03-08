import moment from 'moment'
import * as THREE from '../extras/three'
import { cloneDeep, isBoolean } from 'lodash-es'

import { System } from './System'

import { hashFile } from '../utils-client'
import { hasRole, uuid } from '../utils'
import { ControlPriorities } from '../extras/ControlPriorities'
import { importApp } from '../extras/appTools'
import { DEG2RAD, RAD2DEG } from '../extras/general'

const FORWARD = new THREE.Vector3(0, 0, -1)
const SNAP_DISTANCE = 1
const SNAP_DEGREES = 5
const PROJECT_SPEED = 10
const PROJECT_MIN = 3
const PROJECT_MAX = 50

// Gizmo colors
const X_AXIS_COLOR = 0xff0000 // Red
const Y_AXIS_COLOR = 0x00ff00 // Green
const Z_AXIS_COLOR = 0x0000ff // Blue
const HIGHLIGHT_COLOR = 0x00ffff // Cyan

const v1 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const e1 = new THREE.Euler()

/**
 * Builder System
 *
 * - runs on the client
 * - listens for files being drag and dropped onto the window and handles them
 * - handles build mode
 *
 */
export class ClientBuilder extends System {
  constructor(world) {
    super(world)
    this.enabled = false

    this.selected = null
    this.inspectedEntity = null
    this.target = new THREE.Object3D()
    this.target.rotation.reorder('YXZ')
    this.lastMoveSendTime = 0

    this.undos = []

    this.dropTarget = null
    this.file = null
    
    // For highlighting and gizmos
    this.highlightMaterial = null
    this.highlightMesh = null
    this.gizmoMode = 'translate' // 'translate', 'rotate', or 'scale'
    this.gizmos = null
    
    // Default scale for gizmos
    this.defaultGizmoScale = 1.0
  }

  async init({ viewport }) {
    this.viewport = viewport
    this.viewport.addEventListener('dragover', this.onDragOver)
    this.viewport.addEventListener('dragenter', this.onDragEnter)
    this.viewport.addEventListener('dragleave', this.onDragLeave)
    this.viewport.addEventListener('drop', this.onDrop)
    this.world.on('player', this.onLocalPlayer)
    
    // Create highlight material
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: HIGHLIGHT_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      depthTest: false
    })
    
    // Listen for inspect events to track what's being inspected
    this.world.on('inspect', this.onInspect)
    
    // Listen for inspect-close events
    this.world.on('inspect-close', this.onInspectClose)
    
    // Initialize gizmo container - will be added to scene in start()
    this.gizmos = new THREE.Object3D()
    this.gizmos.visible = false
    
    // Default scale for gizmos
    this.defaultGizmoScale = 1.0
  }

  onInspect = (entity) => {
    this.inspectedEntity = entity
    
    // Ensure gizmos are shown when inspect pane is opened
    if (entity && entity.isApp && this.world.scene) {
      // Force the gizmos to be created if they don't exist yet
      if (!this.gizmos) {
        this.gizmos = new THREE.Object3D();
        this.createGizmos();
        this.world.scene.add(this.gizmos);
      }
      
      console.log("Inspect pane opened for entity:", entity);
      
      // Make sure gizmos are visible
      this.gizmos.visible = true;
      this.updateGizmoVisibility();
    } else if (this.gizmos) {
      // Hide gizmos if no entity is being inspected
      this.gizmos.visible = false;
    }
    
    this.updateHighlight();
  }

  onInspectClose = () => {
    this.inspectedEntity = null;
    
    // Hide gizmos if no entity is selected
    if (this.gizmos && !this.selected) {
      this.gizmos.visible = false;
      console.log('Hiding gizmos - inspect pane closed');
    }
    
    this.updateHighlight();
  }

  createGizmos() {
    console.log('Creating gizmos...');
    
    // Set default scale (can be adjusted based on object size later)
    this.gizmos.scale.set(this.defaultGizmoScale, this.defaultGizmoScale, this.defaultGizmoScale);
    
    // Create translation gizmos (arrows)
    const translateGizmo = new THREE.Object3D()
    translateGizmo.name = "translateGizmo"
    
    // X-axis (red)
    const xArrow = this.createArrow(X_AXIS_COLOR, new THREE.Vector3(1, 0, 0))
    xArrow.name = "xAxis"
    translateGizmo.add(xArrow)
    
    // Y-axis (green)
    const yArrow = this.createArrow(Y_AXIS_COLOR, new THREE.Vector3(0, 1, 0))
    yArrow.name = "yAxis"
    translateGizmo.add(yArrow)
    
    // Z-axis (blue)
    const zArrow = this.createArrow(Z_AXIS_COLOR, new THREE.Vector3(0, 0, 1))
    zArrow.name = "zAxis"
    translateGizmo.add(zArrow)
    
    // Create rotation gizmos (rings)
    const rotateGizmo = new THREE.Object3D()
    rotateGizmo.name = "rotateGizmo"
    
    // X-axis rotation (red)
    const xRing = this.createRing(X_AXIS_COLOR, new THREE.Vector3(1, 0, 0))
    xRing.name = "xRotation"
    rotateGizmo.add(xRing)
    
    // Y-axis rotation (green)
    const yRing = this.createRing(Y_AXIS_COLOR, new THREE.Vector3(0, 1, 0))
    yRing.name = "yRotation"
    rotateGizmo.add(yRing)
    
    // Z-axis rotation (blue)
    const zRing = this.createRing(Z_AXIS_COLOR, new THREE.Vector3(0, 0, 1))
    zRing.name = "zRotation"
    rotateGizmo.add(zRing)
    
    // Create scale gizmos (cubes)
    const scaleGizmo = new THREE.Object3D()
    scaleGizmo.name = "scaleGizmo"
    
    // X-axis scale (red)
    const xCube = this.createCube(X_AXIS_COLOR, new THREE.Vector3(1, 0, 0))
    xCube.name = "xScale"
    scaleGizmo.add(xCube)
    
    // Y-axis scale (green)
    const yCube = this.createCube(Y_AXIS_COLOR, new THREE.Vector3(0, 1, 0))
    yCube.name = "yScale"
    scaleGizmo.add(yCube)
    
    // Z-axis scale (blue)
    const zCube = this.createCube(Z_AXIS_COLOR, new THREE.Vector3(0, 0, 1))
    zCube.name = "zScale"
    scaleGizmo.add(zCube)
    
    // Add all gizmo types to the container
    this.gizmos.add(translateGizmo)
    this.gizmos.add(rotateGizmo)
    this.gizmos.add(scaleGizmo)
    
    // Initially show only translate gizmo
    translateGizmo.visible = true
    rotateGizmo.visible = false
    scaleGizmo.visible = false
    
    console.log('Gizmos created:', {
      translateGizmo: translateGizmo,
      rotateGizmo: rotateGizmo,
      scaleGizmo: scaleGizmo
    });
  }

  createArrow(color, direction) {
    const arrow = new THREE.Object3D()
    
    // Create arrow line
    const lineGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 8)
    lineGeometry.translate(0, 0.5, 0) // Move origin to bottom
    const lineMaterial = new THREE.MeshBasicMaterial({ color })
    const line = new THREE.Mesh(lineGeometry, lineMaterial)
    
    // Create arrow head
    const headGeometry = new THREE.ConeGeometry(0.1, 0.2, 8)
    headGeometry.translate(0, 1.1, 0) // Position at end of line
    const headMaterial = new THREE.MeshBasicMaterial({ color })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    
    // Add to arrow object
    arrow.add(line)
    arrow.add(head)
    
    // Set the direction
    if (direction.x === 1) {
      arrow.rotateZ(-Math.PI / 2)
    } else if (direction.z === 1) {
      arrow.rotateX(Math.PI / 2)
    }
    
    return arrow
  }

  createRing(color, normal) {
    const ringGeometry = new THREE.TorusGeometry(0.8, 0.05, 8, 32)
    const ringMaterial = new THREE.MeshBasicMaterial({ color })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    
    // Orient ring based on normal vector
    if (normal.x === 1) {
      ring.rotateY(Math.PI / 2)
    } else if (normal.z === 1) {
      ring.rotateX(Math.PI / 2)
    }
    
    return ring
  }

  createCube(color, position) {
    const cubeGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15)
    const cubeMaterial = new THREE.MeshBasicMaterial({ color })
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
    
    // Position cube at end of axis
    cube.position.copy(position).multiplyScalar(1.2)
    
    return cube
  }

  updateHighlight() {
    // Remove any existing highlight mesh
    if (this.highlightMesh) {
      if (this.world.scene) {
        this.world.scene.remove(this.highlightMesh)
      }
      this.highlightMesh = null
    }
    
    const entity = this.inspectedEntity || this.selected
    
    if (entity && entity.isApp && this.world.scene) {
      console.log('Updating highlight for entity:', entity.data.id);
      
      // Find the main mesh to highlight
      if (entity.root && entity.root.children.length > 0) {
        // Create a bounding box from all child meshes
        const bbox = new THREE.Box3()
        
        // Recursively find all meshes
        entity.root.traverse(child => {
          if (child.isMesh && child.geometry) {
            bbox.expandByObject(child)
          }
        })
        
        // Create a wireframe box from the bounding box
        const size = new THREE.Vector3()
        bbox.getSize(size)
        
        const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z)
        this.highlightMesh = new THREE.Mesh(boxGeometry, this.highlightMaterial)
        
        // Position the highlight at the center of the bounding box
        const center = new THREE.Vector3()
        bbox.getCenter(center)
        this.highlightMesh.position.copy(center)
        
        // Add to scene
        this.world.scene.add(this.highlightMesh)
        
        // Position gizmos at the same center
        if (this.gizmos) {
          this.gizmos.position.copy(center)
          
          // Scale gizmos based on object size for better visibility
          const maxDimension = Math.max(size.x, size.y, size.z);
          const desiredGizmoSize = maxDimension * 1.2; // Make gizmos slightly larger than object
          this.gizmos.scale.set(desiredGizmoSize, desiredGizmoSize, desiredGizmoSize);
          
          // Make sure gizmos are visible
          this.gizmos.visible = true;
          
          // Update which gizmo is visible based on mode
          this.updateGizmoVisibility();
          
          console.log('Gizmos positioned at center:', center);
          console.log('Gizmos scaled to:', desiredGizmoSize);
          console.log('Gizmos visible:', this.gizmos.visible);
        } else {
          console.warn('No gizmos container available');
        }
      }
    } else {
      // Hide gizmos if no entity is selected or inspected
      if (this.gizmos && !this.inspectedEntity) {
        this.gizmos.visible = false;
        console.log('Hiding gizmos - no entity selected or inspected');
      }
    }
  }

  updateGizmoVisibility() {
    // Show only the active gizmo type
    const translateGizmo = this.gizmos.getObjectByName("translateGizmo")
    const rotateGizmo = this.gizmos.getObjectByName("rotateGizmo")
    const scaleGizmo = this.gizmos.getObjectByName("scaleGizmo")
    
    console.log('Gizmo mode:', this.gizmoMode);
    console.log('Found gizmos:', {
      translateGizmo: !!translateGizmo, 
      rotateGizmo: !!rotateGizmo, 
      scaleGizmo: !!scaleGizmo
    });
    
    if (translateGizmo) translateGizmo.visible = this.gizmoMode === 'translate'
    if (rotateGizmo) rotateGizmo.visible = this.gizmoMode === 'rotate'
    if (scaleGizmo) scaleGizmo.visible = this.gizmoMode === 'scale'
    
    // Check if any gizmo is visible
    if (this.gizmos) {
      console.log('Gizmo container visible:', this.gizmos.visible);
      if (translateGizmo) console.log('Translate gizmo visible:', translateGizmo.visible);
      if (rotateGizmo) console.log('Rotate gizmo visible:', rotateGizmo.visible);
      if (scaleGizmo) console.log('Scale gizmo visible:', scaleGizmo.visible);
    }
  }

  cycleGizmoMode() {
    // Cycle through gizmo modes: translate -> rotate -> scale -> translate
    switch (this.gizmoMode) {
      case 'translate':
        this.gizmoMode = 'rotate'
        break
      case 'rotate':
        this.gizmoMode = 'scale'
        break
      case 'scale':
        this.gizmoMode = 'translate'
        break
    }
    
    this.updateGizmoVisibility()
    this.world.emit('toast', `Gizmo Mode: ${this.gizmoMode}`)
  }

  start() {
    this.control = this.world.controls.bind({ priority: ControlPriorities.BUILDER })
    this.control.mouseLeft.onPress = () => {
      // pointer lock requires user-gesture in safari
      // so this can't be done during update cycle
      if (!this.control.pointer.locked) {
        this.control.pointer.lock()
        this.justPointerLocked = true
        return true // capture
      }
    }
    
    // Now that the world is fully initialized, we can create and add gizmos
    if (this.world.scene) {
      // Create gizmos first
      this.createGizmos()
      // Then add the container to the scene
      this.world.scene.add(this.gizmos)
    }
    
    this.updateActions()
  }

  onLocalPlayer = () => {
    this.updateActions()
  }

  canBuild() {
    return hasRole(this.world.entities.player?.data.roles, 'admin', 'builder')
  }

  updateActions() {
    const actions = []
    if (!this.enabled) {
      if (this.canBuild()) {
        actions.push({ type: 'tab', label: 'Build Mode' })
      }
    }
    if (this.enabled && !this.selected) {
      actions.push({ type: 'mouseLeft', label: 'Grab' })
      actions.push({ type: 'mouseRight', label: 'Inspect' })
      actions.push({ type: 'mouseMiddle', label: 'Camera Control (Hold)' })
      actions.push({ type: 'keyR', label: 'Duplicate' })
      actions.push({ type: 'keyP', label: 'Pin' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'keyG', label: 'Cycle Gizmo Mode' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    if (this.enabled && this.selected) {
      actions.push({ type: 'mouseLeft', label: 'Place' })
      actions.push({ type: 'mouseWheel', label: 'Rotate' })
      actions.push({ type: 'mouseRight', label: 'Inspect' })
      actions.push({ type: 'mouseMiddle', label: 'Camera Control (Hold)' })
      actions.push({ type: 'keyR', label: 'Duplicate' })
      actions.push({ type: 'keyX', label: 'Destroy' })
      actions.push({ type: 'keyG', label: 'Cycle Gizmo Mode' })
      actions.push({ type: 'controlLeft', label: 'No Snap (Hold)' })
      actions.push({ type: 'space', label: 'Jump / Fly (Double-Tap)' })
      actions.push({ type: 'tab', label: 'Exit Build Mode' })
    }
    this.control.setActions(actions)
  }

  update(delta) {
    // toggle build
    if (this.control.tab.pressed) {
      this.toggle()
    }
    // deselect if dead
    if (this.selected?.dead) {
      this.select(null)
    }
    // deselect if stolen
    if (this.selected && this.selected?.data.mover !== this.world.network.id) {
      this.select(null)
    }
    // stop here if build mode not enabled
    if (!this.enabled) {
      return
    }
    
    // Create and add gizmos if they don't exist yet but scene does
    if (!this.gizmos && this.world.scene) {
      console.log('Creating gizmos in update because they were not created earlier');
      this.gizmos = new THREE.Object3D();
      this.createGizmos();
      this.world.scene.add(this.gizmos);
      this.gizmos.visible = false;
    }
    
    // Cycle gizmo mode with G key
    if (this.control.keyG.pressed) {
      this.cycleGizmoMode()
    }
    
    // inspect with right mouse button (was R key)
    if (this.control.mouseRight.pressed) {
      const entity = this.getEntityAtPointer()
      if (entity) {
        this.select(null)
        this.world.emit('inspect', entity)
        return // Add return to prevent duplicate handling
      }
    }
    
    // unlink
    if (this.control.keyU.pressed) {
      const entity = this.getEntityAtPointer()
      if (entity?.isApp) {
        this.select(null)
        // duplicate the blueprint
        const blueprint = {
          id: uuid(),
          version: 0,
          name: entity.blueprint.name,
          image: entity.blueprint.image,
          author: entity.blueprint.author,
          url: entity.blueprint.url,
          desc: entity.blueprint.desc,
          model: entity.blueprint.model,
          script: entity.blueprint.script,
          props: cloneDeep(entity.blueprint.props),
          preload: entity.blueprint.preload,
          public: entity.blueprint.public,
          locked: entity.blueprint.locked,
          frozen: entity.blueprint.frozen,
          unique: entity.blueprint.unique,
        }
        this.world.blueprints.add(blueprint, true)
        // assign new blueprint
        entity.modify({ blueprint: blueprint.id })
        this.world.network.send('entityModified', { id: entity.data.id, blueprint: blueprint.id })
        // toast
        this.world.emit('toast', 'Unlinked')
      }
    }
    
    // pin/unpin
    if (!this.selected && this.control.keyP.pressed) {
      const entity = this.getEntityAtPointer()
      if (entity?.isApp) {
        entity.data.pinned = !entity.data.pinned
        this.world.network.send('entityModified', {
          id: entity.data.id,
          pinned: entity.data.pinned,
        })
        this.world.emit('toast', entity.data.pinned ? 'Pinned' : 'Un-pinned')
      }
    }
    
    // grab with left mouse button
    if (!this.justPointerLocked && this.control.mouseLeft.pressed && !this.selected) {
      // Make sure pointer is unlocked in build mode
      if (this.control.pointer.locked && this.enabled) {
        this.control.pointer.unlock()
      }
      
      // Always use pointer position in build mode
      const entity = this.getEntityAtPointer()
        
      if (entity?.isApp && !entity.data.pinned) {
        this.addUndo({
          name: 'move-entity',
          entityId: entity.data.id,
          position: entity.data.position.slice(),
        })
        this.select(entity)
      }
    }
    
    // place with left mouse button
    else if (
      (!this.control.pointer.locked && this.selected) ||
      (this.control.mouseLeft.pressed && this.selected)
    ) {
      this.select(null)
    }
    
    // duplicate with R key (was right mouse button)
    if (!this.justPointerLocked && this.control.keyR.pressed) {
      const entity = this.selected || this.getEntityAtPointer()
      if (entity?.isApp) {
        let blueprintId = entity.data.blueprint
        // if unique, we also duplicate the blueprint
        if (entity.blueprint.unique) {
          const blueprint = {
            id: uuid(),
            version: 0,
            name: entity.blueprint.name,
            image: entity.blueprint.image,
            author: entity.blueprint.author,
            url: entity.blueprint.url,
            desc: entity.blueprint.desc,
            model: entity.blueprint.model,
            script: entity.blueprint.script,
            props: cloneDeep(entity.blueprint.props),
            preload: entity.blueprint.preload,
            public: entity.blueprint.public,
            locked: entity.blueprint.locked,
            frozen: entity.blueprint.frozen,
            unique: entity.blueprint.unique,
          }
          this.world.blueprints.add(blueprint, true)
          blueprintId = blueprint.id
        }
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprintId,
          position: entity.root.position.toArray(),
          quaternion: entity.root.quaternion.toArray(),
          mover: this.world.network.id,
          uploader: null,
          pinned: false,
          state: {},
        }
        const dup = this.world.entities.add(data, true)
        this.select(dup)
      }
    }
    
    // destroy
    if (this.control.keyX.pressed) {
      const entity = this.selected || this.getEntityAtPointer()
      if (entity?.isApp && !entity.data.pinned) {
        this.select(null)
        this.addUndo({
          name: 'add-entity',
          data: cloneDeep(entity.data),
        })
        entity?.destroy(true)
      }
    }
    // undo
    if (this.control.keyZ.pressed && (this.control.metaLeft.down || this.control.controlLeft.down)) {
      this.undo()
    }
    
    if (this.selected) {
      const app = this.selected
      const hit = this.getHitAtPointer(app, true)
      // place at distance
      const camPos = this.world.rig.position
      const camDir = v1.copy(FORWARD).applyQuaternion(this.world.rig.quaternion)
      const hitDistance = hit ? hit.point.distanceTo(camPos) : 0
      if (hit && hitDistance < this.target.limit) {
        // within range, use hit point
        this.target.position.copy(hit.point)
      } else {
        // no hit, project to limit
        this.target.position.copy(camPos).add(camDir.multiplyScalar(this.target.limit))
      }
      
      // Push and pull functionality has been disabled (C and F keys)
      
      // if not holding shift, mouse wheel rotates
      this.target.rotation.y += this.control.scrollDelta.value * 0.1 * delta
      // apply movement
      app.root.position.copy(this.target.position)
      app.root.quaternion.copy(this.target.quaternion)
      // snap rotation to degrees
      if (!this.control.controlLeft.down) {
        const newY = this.target.rotation.y
        const degrees = newY / DEG2RAD
        const snappedDegrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
        app.root.rotation.y = snappedDegrees * DEG2RAD
      }
      // update matrix
      app.root.clean()
      // and snap to any nearby points
      if (!this.control.controlLeft.down) {
        for (const pos of app.snaps) {
          const result = this.world.snaps.octree.query(pos, SNAP_DISTANCE)[0]
          if (result) {
            const offset = v1.copy(result.position).sub(pos)
            app.root.position.add(offset)
            break
          }
        }
      }

      // periodically send updates
      this.lastMoveSendTime += delta
      if (this.lastMoveSendTime > this.world.networkRate) {
        this.world.network.send('entityModified', {
          id: app.data.id,
          position: app.root.position.toArray(),
          quaternion: app.root.quaternion.toArray(),
        })
        this.lastMoveSendTime = 0
      }
      
      // Update highlight and gizmos position
      this.updateHighlight()
    }

    if (this.justPointerLocked) {
      this.justPointerLocked = false
    }
  }

  addUndo(action) {
    this.undos.push(action)
    if (this.undos.length > 50) {
      this.undos.shift()
    }
  }

  undo() {
    const undo = this.undos.pop()
    if (!undo) return
    if (this.selected) this.select(null)
    if (undo.name === 'add-entity') {
      this.world.entities.add(undo.data, true)
      return
    }
    if (undo.name === 'move-entity') {
      const entity = this.world.entities.get(undo.entityId)
      if (!entity) return
      entity.data.position = undo.position
      this.world.network.send('entityModified', {
        id: undo.entityId,
        position: entity.data.position,
      })
      entity.build()
      return
    }
  }

  toggle(enabled) {
    if (!this.canBuild()) return
    enabled = isBoolean(enabled) ? enabled : !this.enabled
    if (this.enabled === enabled) return
    this.enabled = enabled
    
    // Release pointer when entering build mode, lock it when exiting
    if (this.enabled) {
      this.control.pointer.unlock()
    } else {
      // Lock pointer when exiting build mode to return to play mode
      this.control.pointer.lock()
      
      if (this.control.middleMouseLocked) {
        // If we were using the middle mouse to control camera, turn it off
        this.control.middleMouseLocked = false
      }
      
      // Clear highlight and gizmos when exiting build mode
      if (this.highlightMesh) {
        this.world.scene.remove(this.highlightMesh)
        this.highlightMesh = null
      }
      this.gizmos.visible = false
      this.inspectedEntity = null
    }
    
    if (!this.enabled) this.select(null)
    this.updateActions()
    this.world.emit('build-mode', enabled)
  }

  select(app) {
    // do nothing if not changed
    if (this.selected === app) return
    // deselect existing
    if (this.selected) {
      if (!this.selected.dead && this.selected.data.mover === this.world.network.id) {
        const app = this.selected
        app.data.mover = null
        app.data.position = app.root.position.toArray()
        app.data.quaternion = app.root.quaternion.toArray()
        app.data.state = {}
        this.world.network.send('entityModified', {
          id: app.data.id,
          mover: null,
          position: app.data.position,
          quaternion: app.data.quaternion,
          state: app.data.state,
        })
        app.build()
      }
      this.selected = null
      this.control.keyC.capture = false
      this.control.scrollDelta.capture = false
    }
    // select new (if any)
    if (app) {
      if (app.data.mover !== this.world.network.id) {
        app.data.mover = this.world.network.id
        app.build()
        this.world.network.send('entityModified', { id: app.data.id, mover: app.data.mover })
      }
      this.selected = app
      this.control.keyC.capture = true
      this.control.scrollDelta.capture = true
      this.target.position.copy(app.root.position)
      this.target.quaternion.copy(app.root.quaternion)
      this.target.limit = PROJECT_MAX
      
      console.log('Selected app:', app);
    }
    
    // Update highlight and gizmos
    this.updateHighlight()
    
    // Force update gizmo visibility to ensure correct display
    if (this.gizmos && this.selected) {
      this.gizmos.visible = true;
      this.updateGizmoVisibility();
      console.log('Forced gizmo visibility after selection');
    }
    
    // update actions
    this.updateActions()
  }

  getEntityAtReticle() {
    const hits = this.world.stage.raycastReticle()
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity) break
    }
    return entity
  }

  getEntityAtPointer() {
    const hits = this.world.stage.raycastPointer(this.control.pointer.position)
    let entity
    for (const hit of hits) {
      entity = hit.getEntity?.()
      if (entity && entity.isApp) break
    }
    return entity
  }

  getHitAtReticle(ignoreEntity, ignorePlayers) {
    const hits = this.world.stage.raycastReticle()
    let hit
    for (const _hit of hits) {
      const entity = _hit.getEntity?.()
      if (entity === ignoreEntity || (entity?.isPlayer && ignorePlayers)) continue
      hit = _hit
      break
    }
    return hit
  }

  getHitAtPointer(ignoreEntity, ignorePlayers) {
    const hits = this.world.stage.raycastPointer(this.control.pointer.position)
    let hit
    for (const _hit of hits) {
      const entity = _hit.getEntity?.()
      if (entity === ignoreEntity || (entity?.isPlayer && ignorePlayers)) continue
      hit = _hit
      break
    }
    return hit
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragEnter = e => {
    this.dropTarget = e.target
    this.dropping = true
    this.file = null
  }

  onDragLeave = e => {
    if (e.target === this.dropTarget) {
      this.dropping = false
    }
  }

  onDrop = async e => {
    e.preventDefault()
    this.dropping = false
    // ensure we have admin/builder role
    if (!this.canBuild()) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `You don't have permission to do that.`,
        createdAt: moment().toISOString(),
      })
      return
    }
    // handle drop
    let file
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const item = e.dataTransfer.items[0]
      if (item.kind === 'file') {
        file = item.getAsFile()
      }
      // Handle multiple MIME types for URLs
      if (item.type === 'text/uri-list' || item.type === 'text/plain' || item.type === 'text/html') {
        const text = await getAsString(item)
        // Extract URL from the text (especially important for text/html type)
        const url = text.trim().split('\n')[0] // Take first line in case of multiple
        if (url.startsWith('http')) {
          // Basic URL validation
          const resp = await fetch(url)
          const blob = await resp.blob()
          file = new File([blob], new URL(url).pathname.split('/').pop(), { type: resp.headers.get('content-type') })
        }
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0]
    }
    if (!file) return
    // slight delay to ensure we get updated pointer position from window focus
    await new Promise(resolve => setTimeout(resolve, 100))
    // ensure we in build mode
    this.toggle(true)
    // add it!
    const maxSize = this.world.network.maxUploadSize * 1024 * 1024
    if (file.size > maxSize) {
      this.world.chat.add({
        id: uuid(),
        from: null,
        fromId: null,
        body: `File size too large (>${this.world.network.maxUploadSize}mb)`,
        createdAt: moment().toISOString(),
      })
      console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      return
    }
    const transform = this.getSpawnTransform()
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'hyp') {
      this.addApp(file, transform)
    }
    if (ext === 'glb') {
      this.addModel(file, transform)
    }
    if (ext === 'vrm') {
      this.addAvatar(file, transform)
    }
  }

  async addApp(file, transform) {
    const info = await importApp(file)
    for (const asset of info.assets) {
      this.world.loader.insert(asset.type, asset.url, asset.file)
    }
    const blueprint = {
      id: uuid(),
      version: 0,
      name: info.blueprint.name,
      image: info.blueprint.image,
      author: info.blueprint.author,
      url: info.blueprint.url,
      desc: info.blueprint.desc,
      model: info.blueprint.model,
      script: info.blueprint.script,
      props: info.blueprint.props,
      preload: info.blueprint.preload,
      public: info.blueprint.public,
      locked: info.blueprint.locked,
      frozen: info.blueprint.frozen,
      unique: info.blueprint.unique,
    }
    this.world.blueprints.add(blueprint, true)
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      mover: null,
      uploader: this.world.network.id,
      pinned: false,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    const promises = info.assets.map(asset => {
      return this.world.network.upload(asset.file)
    })
    try {
      await Promise.all(promises)
      app.onUploaded()
    } catch (err) {
      console.error('failed to upload .hyp assets')
      console.error(err)
      app.destroy()
    }
  }

  async addModel(file, transform) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.glb`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('model', url, file)
    // make blueprint
    const blueprint = {
      id: uuid(),
      version: 0,
      name: file.name.split('.')[0],
      image: null,
      author: null,
      url: null,
      desc: null,
      model: url,
      script: null,
      props: {},
      preload: false,
      public: false,
      locked: false,
      unique: false,
    }
    // register blueprint
    this.world.blueprints.add(blueprint, true)
    // spawn the app moving
    // - mover: follows this clients cursor until placed
    // - uploader: other clients see a loading indicator until its fully uploaded
    const data = {
      id: uuid(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      mover: null,
      uploader: this.world.network.id,
      pinned: false,
      state: {},
    }
    const app = this.world.entities.add(data, true)
    // upload the glb
    await this.world.network.upload(file)
    // mark as uploaded so other clients can load it in
    app.onUploaded()
  }

  async addAvatar(file, transform) {
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as vrm filename
    const filename = `${hash}.vrm`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    this.world.loader.insert('avatar', url, file)
    this.world.emit('avatar', {
      file,
      url,
      hash,
      onPlace: async () => {
        // close pane
        this.world.emit('avatar', null)
        // make blueprint
        const blueprint = {
          id: uuid(),
          version: 0,
          name: file.name,
          image: null,
          author: null,
          url: null,
          desc: null,
          model: url,
          script: null,
          props: {},
          preload: false,
          public: false,
          locked: false,
          unique: false,
        }
        // register blueprint
        this.world.blueprints.add(blueprint, true)
        // spawn the app moving
        // - mover: follows this clients cursor until placed
        // - uploader: other clients see a loading indicator until its fully uploaded
        const data = {
          id: uuid(),
          type: 'app',
          blueprint: blueprint.id,
          position: transform.position,
          quaternion: transform.quaternion,
          mover: null,
          uploader: this.world.network.id,
          pinned: false,
          state: {},
        }
        const app = this.world.entities.add(data, true)
        // upload the glb
        await this.world.network.upload(file)
        // mark as uploaded so other clients can load it in
        app.onUploaded()
      },
      onEquip: async () => {
        // close pane
        this.world.emit('avatar', null)
        // prep new user data
        const player = this.world.entities.player
        const prevUrl = player.data.avatar
        // update locally
        player.modify({ avatar: url, sessionAvatar: null })
        // upload
        try {
          await this.world.network.upload(file)
        } catch (err) {
          console.error(err)
          // revert
          player.modify({ avatar: prevUrl })
          return
        }
        // update for everyone
        this.world.network.send('entityModified', {
          id: player.data.id,
          avatar: url,
        })
      },
    })
  }

  getSpawnTransform() {
    const hit = this.world.stage.raycastPointer(this.control.pointer.position)[0]
    const position = hit ? hit.point.toArray() : [0, 0, 0]
    let quaternion
    if (hit) {
      e1.copy(this.world.rig.rotation).reorder('YXZ')
      e1.x = 0
      e1.z = 0
      const degrees = e1.y * RAD2DEG
      const snappedDegrees = Math.round(degrees / SNAP_DEGREES) * SNAP_DEGREES
      e1.y = snappedDegrees * DEG2RAD
      q1.setFromEuler(e1)
      quaternion = q1.toArray()
    } else {
      quaternion = [0, 0, 0, 1]
    }
    return { position, quaternion }
  }

  destroy() {
    // Clean up resources
    if (this.highlightMesh && this.world.scene) {
      this.world.scene.remove(this.highlightMesh)
      this.highlightMesh = null
    }
    
    if (this.gizmos && this.world.scene) {
      this.world.scene.remove(this.gizmos)
      this.gizmos = null
    }
    
    // Remove event listeners
    this.world.off('inspect', this.onInspect)
    this.world.off('inspect-close', this.onInspectClose)
    this.world.off('player', this.onLocalPlayer)
    
    // Continue with original cleanup
    super.destroy?.()
  }
}

function getAsString(item) {
  return new Promise(resolve => {
    item.getAsString(resolve)
  })
}
