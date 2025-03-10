import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as THREE from '../../core/extras/three'
import {
  BoxIcon,
  CircleCheckIcon,
  DownloadIcon,
  EarthIcon,
  EyeIcon,
  FileCode2Icon,
  FileIcon,
  LoaderIcon,
  PackageCheckIcon,
  ShuffleIcon,
  XIcon,
  LayersIcon,
  AtomIcon,
  FolderIcon,
  BlendIcon,
  CircleIcon,
  AnchorIcon,
  PersonStandingIcon,
  MagnetIcon,
  DumbbellIcon,
  ChevronDown,
  SplitIcon,
  LockKeyholeIcon,
  SparkleIcon,
  ZapIcon,
  Trash2Icon,
} from 'lucide-react'

import { hashFile } from '../../core/utils-client'
import { usePane } from './usePane'
import { useUpdate } from './useUpdate'
import { cls } from './cls'
import { exportApp } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'
import { hasRole } from '../../core/utils'
import {
  fileKinds,
  InputDropdown,
  InputFile,
  InputNumber,
  InputRange,
  InputSwitch,
  InputText,
  InputTextarea,
} from './Inputs'
import { isArray } from 'lodash-es'

// Add this custom scrollbar styling after the imports
const customScrollbarStyle = `
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
  &::-webkit-scrollbar-corner {
    background: transparent;
  }
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) rgba(0, 0, 0, 0.1);
`;

export function InspectPane({ world, entity }) {
  if (entity.isApp) {
    return <AppPane world={world} app={entity} />
  }
  if (entity.isPlayer) {
    return <PlayerPane world={world} player={entity} />
  }
}

const extToType = {
  glb: 'model',
  vrm: 'avatar',
}
const allowedModels = ['glb', 'vrm']

export function AppPane({ world, app }) {
  const paneRef = useRef()
  const headRef = useRef()
  const [blueprint, setBlueprint] = useState(app.blueprint)
  const canEdit = !blueprint.frozen && hasRole(world.entities.player.data.roles, 'admin', 'builder')
  const [tab, setTab] = useState('main')
  usePane('inspect', paneRef, headRef)
  useEffect(() => {
    window.app = app
  }, [])
  useEffect(() => {
    const onModify = bp => {
      if (bp.id !== blueprint.id) return
      setBlueprint(bp)
    }
    world.blueprints.on('modify', onModify)
    return () => {
      world.blueprints.off('modify', onModify)
    }
  }, [])
  const download = async () => {
    try {
      const file = await exportApp(app.blueprint, world.loader.loadFile)
      downloadFile(file)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div
      ref={paneRef}
      className='apane'
      css={css`
        position: absolute;
        top: 20px;
        left: 20px;
        width: 320px;
        max-height: calc(100vh - 40px);
        background: rgba(22, 22, 28, 1);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        .apane-head {
          height: 50px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 10px;
          &-icon {
            width: 60px;
            height: 40px;
            display: flex;
            align-items: center;
            svg {
              margin-left: 10px;
            }
          }
          &-tabs {
            flex: 1;
            align-self: stretch;
            display: flex;
            justify-content: center;
          }
          &-tab {
            align-self: stretch;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 16px 0 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
            &:hover:not(.active) {
              cursor: pointer;
              color: rgba(255, 255, 255, 0.7);
            }
            &.active {
              border-bottom: 1px solid white;
              margin-bottom: -1px;
              color: white;
            }
          }

          &-btns {
            width: 60px;
            display: flex;
            align-items: center;
            &.right {
              justify-content: flex-end;
            }
          }

          &-btn {
            color: #515151;
            width: 30px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .apane-download {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          svg {
            margin-right: 8px;
          }
          span {
            font-size: 14px;
          }
          &:hover {
            cursor: pointer;
          }
        }
      `}
    >
      <div className='apane-head' ref={headRef}>
        <div className='apane-head-icon'>
          <ZapIcon size={16} />
        </div>
        <div className='apane-head-tabs'>
          <div className={cls('apane-head-tab', { active: tab === 'main' })} onClick={() => setTab('main')}>
            <span>App</span>
          </div>
          {canEdit && (
            <div className={cls('apane-head-tab', { active: tab === 'meta' })} onClick={() => setTab('meta')}>
              <span>Meta</span>
            </div>
          )}
          <div className={cls('apane-head-tab', { active: tab === 'nodes' })} onClick={() => setTab('nodes')}>
            <span>Nodes</span>
          </div>
        </div>
        <div className='apane-head-btns right'>
          {canEdit && (
            <div
              className='apane-head-btn'
              onClick={() => {
                world.emit('inspect', null)
                app.destroy(true)
              }}
            >
              <Trash2Icon size={16} />
            </div>
          )}
          <div className='apane-head-btn' onClick={() => world.emit('inspect', null)}>
            <XIcon size={20} />
          </div>
        </div>
      </div>
      {tab === 'main' && (
        <>
          <AppPaneMain world={world} app={app} blueprint={blueprint} canEdit={canEdit} />
          <div className='apane-download' onClick={download}>
            <DownloadIcon size={16} />
            <span>Download</span>
          </div>
        </>
      )}
      {tab === 'meta' && <AppPaneMeta world={world} app={app} blueprint={blueprint} />}
      {tab === 'nodes' && <AppPaneNodes app={app} />}
    </div>
  )
}

function AppPaneMain({ world, app, blueprint, canEdit }) {
  const [fileInputKey, setFileInputKey] = useState(0)
  const downloadModel = e => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader.getFile(blueprint.model)
      if (!file) return
      downloadFile(file)
    }
  }
  const changeModel = async e => {
    setFileInputKey(n => n + 1)
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    if (!allowedModels.includes(ext)) return
    // immutable hash the file
    const hash = await hashFile(file)
    // use hash as glb filename
    const filename = `${hash}.${ext}`
    // canonical url to this file
    const url = `asset://${filename}`
    // cache file locally so this client can insta-load it
    const type = extToType[ext]
    world.loader.insert(type, url, file)
    // update blueprint locally (also rebuilds apps)
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, model: url })
    // upload model
    await world.network.upload(file)
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id: blueprint.id, version, model: url })
  }
  const editCode = () => {
    world.emit('code', true)
  }
  const toggle = async key => {
    const value = !blueprint[key]
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='amain noscrollbar'
      css={css`
        flex: 1;
        padding: 0 20px 10px;
        max-height: 500px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        .amain-image {
          align-self: center;
          width: 120px;
          height: 120px;
          background-position: center;
          background-size: cover;
          border-radius: 10px;
          margin: 20px 0 0;
        }
        .amain-name {
          text-align: center;
          font-size: 18px;
          font-weight: 500;
          margin: 16px 0 0;
        }
        .amain-author {
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 7px 0 0;
          a {
            color: #00a7ff;
          }
        }
        .amain-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 16px 0 0;
        }
        .amain-line {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin: 0 -20px;
          &.mt {
            margin-top: 20px;
          }
          &.mb {
            margin-bottom: 20px;
          }
        }
        .amain-btns {
          display: flex;
          gap: 5px;
          margin: 0 0 5px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            cursor: pointer;
            input {
              position: absolute;
              top: -9999px;
            }
            svg {
              margin: 0 8px 0 0;
            }
            span {
              font-size: 14px;
            }
          }
        }
        .amain-btns2 {
          display: flex;
          gap: 5px;
          &-btn {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px 0;
            color: #606275;
            cursor: pointer;
            svg {
              margin: 0 0 5px;
            }
            span {
              font-size: 12px;
            }
            &.active {
              color: white;
              &.blue svg {
                color: #5097ff;
              }
              &.yellow svg {
                color: #fbff50;
              }
              &.red svg {
                color: #ff5050;
              }
              &.green svg {
                color: #50ff51;
              }
            }
          }
        }
        .amain-fields {
          margin-top: 20px;
        }
      `}
    >
      {blueprint.image && (
        <div
          className='amain-image'
          css={css`
            background-image: ${blueprint.image ? `url(${world.resolveURL(blueprint.image.url)})` : 'none'};
          `}
        />
      )}
      {blueprint.name && <div className='amain-name'>{blueprint.name}</div>}
      {blueprint.author && (
        <div className='amain-author'>
          <span>by </span>
          {blueprint.url && (
            <a href={world.resolveURL(blueprint.url)} target='_blank' rel="noreferrer">
              {blueprint.author || 'Unknown'}
            </a>
          )}
          {!blueprint.url && <span>{blueprint.author || 'Unknown'}</span>}
        </div>
      )}
      {blueprint.desc && <div className='amain-desc'>{blueprint.desc}</div>}
      {canEdit && (
        <>
          <div className='amain-line mt mb' />
          <div className='amain-btns'>
            <label className='amain-btns-btn' onClick={downloadModel}>
              <input key={fileInputKey} type='file' accept='.glb,.vrm' onChange={changeModel} />
              <BoxIcon size={16} />
              <span>Model</span>
            </label>
            <div className='amain-btns-btn' onClick={editCode}>
              <FileCode2Icon size={16} />
              <span>Code</span>
            </div>
          </div>
          <div className='amain-btns2'>
            <div
              className={cls('amain-btns2-btn green', { active: blueprint.preload })}
              onClick={() => toggle('preload')}
            >
              <CircleCheckIcon size={12} />
              <span>Preload</span>
            </div>
            <div className={cls('amain-btns2-btn blue', { active: blueprint.public })} onClick={() => toggle('public')}>
              <EarthIcon size={12} />
              <span>Public</span>
            </div>
            <div className={cls('amain-btns2-btn red', { active: blueprint.locked })} onClick={() => toggle('locked')}>
              <LockKeyholeIcon size={12} />
              <span>Lock</span>
            </div>
            <div
              className={cls('amain-btns2-btn yellow', { active: blueprint.unique })}
              onClick={() => toggle('unique')}
            >
              <SparkleIcon size={12} />
              <span>Unique</span>
            </div>
          </div>
          {app.fields.length > 0 && <div className='amain-line mt' />}
          <div className='amain-fields'>
            <Fields app={app} blueprint={blueprint} />
          </div>
        </>
      )}
    </div>
  )
}

function AppPaneMeta({ world, app, blueprint }) {
  const set = async (key, value) => {
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <div
      className='ameta noscrollbar'
      css={css`
        flex: 1;
        padding: 20px 20px 10px;
        max-height: 500px;
        overflow-y: auto;
        .ameta-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
          &-label {
            width: 90px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
          }
          &-input {
            flex: 1;
          }
        }
      `}
    >
      <div className='ameta-field'>
        <div className='ameta-field-label'>Name</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.name} onChange={name => set('name', name)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Image</div>
        <div className='ameta-field-input'>
          <InputFile world={world} kind='texture' value={blueprint.image} onChange={image => set('image', image)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Author</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.author} onChange={author => set('author', author)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>URL</div>
        <div className='ameta-field-input'>
          <InputText value={blueprint.url} onChange={url => set('url', url)} />
        </div>
      </div>
      <div className='ameta-field'>
        <div className='ameta-field-label'>Description</div>
        <div className='ameta-field-input'>
          <InputTextarea value={blueprint.desc} onChange={desc => set('desc', desc)} />
        </div>
      </div>
    </div>
  )
}

function AppPaneNodes({ app }) {
  const [selectedNode, setSelectedNode] = useState(null)
  const [rootNode, setRootNode] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState({})
  const isMountedRef = useRef(true); // Ref to track if component is mounted
  const appRef = useRef(app); // Ref to keep track of latest app reference
  const inputTimeoutRef = useRef(null); // Ref to track input timeout
  const [precisionStep, setPrecisionStep] = useState(0.1); // Default step size for transform inputs
  
  // Update the app ref whenever app changes
  useEffect(() => {
    appRef.current = app;
  }, [app]);
  
  // Add a cleanup effect when the component unmounts
  useEffect(() => {
    return () => {
      // Mark as unmounted first to prevent any new callbacks
      isMountedRef.current = false;
      
      // Clean up any references that might be causing memory leaks
      appRef.current = null;
      
      // Clear any pending debounced inputs
      if (inputTimeoutRef.current !== null) {
        clearTimeout(inputTimeoutRef.current);
        inputTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Add a refresh interval to keep the transform data up-to-date
  useEffect(() => {
    // Initial load
    if (app) {
      try {
        const initialNode = app.getNodes();
        setRootNode(initialNode);
      } catch (err) {
        console.warn('Error loading initial nodes:', err);
      }
    }
    
    // Set up an interval to refresh the node data periodically
    const refreshInterval = setInterval(() => {
      // Skip if component is unmounted
      if (!isMountedRef.current) {
        return;
      }
      
      // Get the current app reference from ref
      const currentApp = appRef.current;
      
      // Improved check that properly handles zero values
      if (!currentApp || !currentApp.root || 
          typeof currentApp.root.position === 'undefined' || 
          typeof currentApp.root.quaternion === 'undefined' || 
          typeof currentApp.root.scale === 'undefined') {
        return; // Skip update if app is invalid
      }
      
      if (selectedNode) {
        // Rather than refreshing the entire tree, just update the transform values
        // of the selected node when it's the $root node (which is what we're editing)
        if (selectedNode.id === '$root' && 
            typeof selectedNode.position !== 'undefined' && 
            typeof selectedNode.quaternion !== 'undefined' && 
            typeof selectedNode.scale !== 'undefined') {
          try {
            selectedNode.position.copy(currentApp.root.position);
            selectedNode.quaternion.copy(currentApp.root.quaternion);
            selectedNode.scale.copy(currentApp.root.scale);
            selectedNode.isTransformed = true;
            
            // Safely call updateTransform if it exists
            if (typeof selectedNode.updateTransform === 'function') {
              selectedNode.updateTransform();
            }
            
            // Force a re-render by creating a new reference
            if (isMountedRef.current) { // Only update state if still mounted
              setSelectedNode({...selectedNode});
            }
          } catch (err) {
            console.warn('Error updating node transform:', err);
            // Don't throw error, just skip this update
          }
        }
      }
    }, 100); // Refresh every 100ms for smooth updates
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [app]);
  
  // Mount selected node once the root is available
  useEffect(() => {
    if (rootNode && !selectedNode) {
      setSelectedNode(rootNode)
      // Auto-expand the root node
      setExpandedNodes(prev => ({ ...prev, [rootNode.id]: true }))
    }
  }, [rootNode, selectedNode])

  // Modify the updateNodeApp function to handle other nodes too
  const updateNodeApp = useCallback((node) => {
    // Skip update if component is unmounted
    if (!isMountedRef.current) {
      return;
    }
    
    // Get the current app reference from ref
    const currentApp = appRef.current;
    
    // Improved check that properly handles zero values
    if (!currentApp || !currentApp.root || typeof currentApp.world === 'undefined') {
      console.warn('Cannot update node: app is no longer available');
      return;
    }
    
    if (node.id === '$root') {
      try {
        // Instead of directly modifying properties, use the app's native transform functions
        // which handle both visual updates and physics synchronization

        // Check if the app has a transform function first
        if (typeof currentApp.setTransform === 'function') {
          // Use the app's built-in transform function if available
          currentApp.setTransform({
            position: node.position.toArray(),
            quaternion: node.quaternion.toArray(),
            scale: node.scale.toArray()
          });
        } else if (typeof currentApp.setPosition === 'function' && 
                  typeof currentApp.setRotation === 'function' && 
                  typeof currentApp.setScale === 'function') {
          // Try individual transform functions if available
          currentApp.setPosition(node.position.x, node.position.y, node.position.z);
          currentApp.setRotation(node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w);
          currentApp.setScale(node.scale.x, node.scale.y, node.scale.z);
        } else if (typeof currentApp.updateTransform === 'function') {
          // Try updateTransform if available
          currentApp.updateTransform({
            position: node.position,
            quaternion: node.quaternion,
            scale: node.scale
          });
        } else {
          // Fallback to direct property assignments and manual physics updates
          // Update the visual representation (THREE.js objects)
          currentApp.root.position.copy(node.position);
          currentApp.root.quaternion.copy(node.quaternion);
          currentApp.root.scale.copy(node.scale);
          
          // Apply matrix updates if available
          if (currentApp.root.updateMatrix) {
            currentApp.root.updateMatrix();
          }
          if (currentApp.root.updateMatrixWorld) {
            currentApp.root.updateMatrixWorld(true);
          }

          // Update any physics bodies and colliders if they exist
          // This is critical for synchronizing visual and physical representations
          if (currentApp.colliders && Array.isArray(currentApp.colliders)) {
            // Update all colliders attached to this app
            for (const collider of currentApp.colliders) {
              if (collider && typeof collider.setPosition === 'function') {
                collider.setPosition(node.position.x, node.position.y, node.position.z);
              }
              if (collider && typeof collider.setRotation === 'function') {
                collider.setRotation(node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w);
              }
            }
          }
          
          // Also check for a direct rigidbody property
          if (currentApp.rigidbody) {
            const rb = currentApp.rigidbody;
            if (typeof rb.setPosition === 'function') {
              rb.setPosition(node.position.x, node.position.y, node.position.z);
            }
            if (typeof rb.setRotation === 'function') {
              rb.setRotation(node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w);
            }
          }
          
          // Check for physics property on the root node
          if (currentApp.root.physics) {
            const physics = currentApp.root.physics;
            if (typeof physics.setPosition === 'function') {
              physics.setPosition(node.position.x, node.position.y, node.position.z);
            }
            if (typeof physics.setRotation === 'function') {
              physics.setRotation(node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w);
            }
          }
          
          // Look for transform node
          if (currentApp.transform) {
            const transform = currentApp.transform;
            if (typeof transform.set === 'function') {
              transform.set({
                position: [node.position.x, node.position.y, node.position.z],
                rotation: [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w],
                scale: [node.scale.x, node.scale.y, node.scale.z]
              });
            }
          }
        }

        // Trigger any update callbacks the app might have
        if (typeof currentApp.onTransformUpdate === 'function') {
          currentApp.onTransformUpdate();
        }
        
        // Also try to invoke the app script's update method if it exists
        if (currentApp.script && typeof currentApp.script.onTransformChange === 'function') {
          currentApp.script.onTransformChange();
        }

        // For networked instances, send the update to ensure server-side sync
        if (currentApp.data && currentApp.world && currentApp.world.network) {
          // Try to use the app's entity system if available
          if (currentApp.world.entities && 
              typeof currentApp.world.entities.updateEntityTransform === 'function') {
            currentApp.world.entities.updateEntityTransform(
              currentApp.data.id, 
              node.position.toArray(),
              node.quaternion.toArray(),
              node.scale.toArray()
            );
          } else {
            // Fallback to direct network message
            currentApp.world.network.send('entityModified', { 
              id: currentApp.data.id, 
              position: node.position.toArray(),
              quaternion: node.quaternion.toArray(),
              scale: node.scale.toArray(),
              // Add a flag to ensure physics is updated on the server too
              updatePhysics: true
            });
          }
        }
      } catch (err) {
        console.warn('Error updating app entity:', err);
      }
    } else if (selectedNode && currentApp.root) {
      // For child nodes, we need to make the change relative to the parent
      // This is a more complex operation and would require tracking the node's path
      // in the hierarchy to properly update it
      
      // For now, we'll just log that child node editing isn't fully supported
      console.log('Note: Editing child nodes is view-only. The changes won\'t be saved.');
    }
  }, [selectedNode, isMountedRef]);

  // Handle position change
  const handlePositionChange = useCallback((axis, value) => {
    // Skip update if component is unmounted
    if (!isMountedRef.current) {
      return;
    }
    
    // Get the current app reference from ref
    const currentApp = appRef.current;
    
    if (!selectedNode || !currentApp) return;
    
    try {
      selectedNode.position[axis] = value;
      selectedNode.isTransformed = true;
      
      if (typeof selectedNode.updateTransform === 'function') {
        selectedNode.updateTransform();
      }
      
      updateNodeApp(selectedNode);
      
      // Force a re-render to update the UI
      if (isMountedRef.current) {
        setSelectedNode({...selectedNode});
      }
    } catch (err) {
      console.warn('Error updating position:', err);
    }
  }, [selectedNode, updateNodeApp, isMountedRef]);

  // Handle rotation change
  const handleRotationChange = useCallback((axis, value) => {
    // Skip update if component is unmounted
    if (!isMountedRef.current) {
      return;
    }
    
    // Get the current app reference from ref
    const currentApp = appRef.current;
    
    if (!selectedNode || !currentApp) return;
    
    try {
      // Convert degrees to radians for Euler rotation
      const radians = THREE.MathUtils.degToRad(value);
      selectedNode.rotation[axis] = radians;
      
      // This will automatically update the quaternion via the _onChange handlers
      selectedNode.isTransformed = true;
      
      if (typeof selectedNode.updateTransform === 'function') {
        selectedNode.updateTransform();
      }
      
      updateNodeApp(selectedNode);
      
      // Force a re-render to update the UI
      if (isMountedRef.current) {
        setSelectedNode({...selectedNode});
      }
    } catch (err) {
      console.warn('Error updating rotation:', err);
    }
  }, [selectedNode, updateNodeApp, isMountedRef]);

  // Handle scale change
  const handleScaleChange = useCallback((axis, value) => {
    // Skip update if component is unmounted
    if (!isMountedRef.current) {
      return;
    }
    
    // Get the current app reference from ref
    const currentApp = appRef.current;
    
    if (!selectedNode || !currentApp) return;
    
    try {
      selectedNode.scale[axis] = value;
      selectedNode.isTransformed = true;
      
      if (typeof selectedNode.updateTransform === 'function') {
        selectedNode.updateTransform();
      }
      
      updateNodeApp(selectedNode);
      
      // Force a re-render to update the UI
      if (isMountedRef.current) {
        setSelectedNode({...selectedNode});
      }
    } catch (err) {
      console.warn('Error updating scale:', err);
    }
  }, [selectedNode, updateNodeApp, isMountedRef]);

  // Toggle node expansion
  const toggleNode = (nodeId, e) => {
    e.stopPropagation()
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }))
  }

  // Helper function to safely extract vector values (works with THREE.Vector3 and plain objects)
  const extractVectorComponents = vec => {
    if (!vec) return null
    
    // Handle THREE.Vector3-like objects
    if (typeof vec.x === 'number' && typeof vec.y === 'number' && typeof vec.z === 'number') {
      return { x: vec.x, y: vec.y, z: vec.z }
    }
    
    // Handle array-like structures [x, y, z]
    if (Array.isArray(vec) && vec.length >= 3) {
      return { x: vec[0], y: vec[1], z: vec[2] }
    }
    
    // Handle objects with toArray() method
    if (typeof vec.toArray === 'function') {
      try {
        const arr = vec.toArray()
        if (arr && arr.length >= 3) {
          return { x: arr[0], y: arr[1], z: arr[2] }
        }
      } catch (err) {
        console.warn('Error calling toArray()', err)
      }
    }
    
    // Handle Euler angles - convert to degrees for display
    if (vec.isEuler) {
      return { 
        x: (THREE.MathUtils.radToDeg(vec.x) || 0).toFixed(1) + '°', 
        y: (THREE.MathUtils.radToDeg(vec.y) || 0).toFixed(1) + '°', 
        z: (THREE.MathUtils.radToDeg(vec.z) || 0).toFixed(1) + '°' 
      }
    }
    
    // Special case for matrices
    if (vec.isMatrix4) {
      const pos = new THREE.Vector3()
      const quat = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      vec.decompose(pos, quat, scale)
      return { x: pos.x, y: pos.y, z: pos.z }
    }
    
    // Try to access internal elements or elements property (some THREE objects structure)
    if (vec.elements && Array.isArray(vec.elements) && vec.elements.length >= 3) {
      return { x: vec.elements[0], y: vec.elements[1], z: vec.elements[2] }
    }
    
    return null
  }

  // Check if a property exists and is valid
  const hasProperty = (obj, prop) => {
    try {
      return obj && (typeof obj[prop] !== 'undefined' && obj[prop] !== null)
    } catch (err) {
      return false
    }
  }

  // Modify safeChangeHandler to use debouncing and more robust checking
  const safeChangeHandler = (axis, value, onChangeVec) => {
    // Clear any previous pending updates for this axis
    if (inputTimeoutRef.current !== null) {
      clearTimeout(inputTimeoutRef.current);
    }
    
    // Debounce the input changes to prevent rapid successive updates
    inputTimeoutRef.current = setTimeout(() => {
      // Reset the timeout ref
      inputTimeoutRef.current = null;
      
      // Double-check if component is still mounted
      if (!isMountedRef.current) {
        console.warn('Cannot update: component is unmounted');
        return;
      }
      
      // Capture the current app reference at the time of the callback
      const currentApp = appRef.current;
      
      if (!currentApp) {
        console.warn('Cannot update: app reference is null');
        return;
      }
      
      // More careful checks for property existence
      if (typeof currentApp.root === 'undefined') {
        console.warn('Cannot update: app.root is undefined');
        return;
      }
      
      if (typeof currentApp.world === 'undefined') {
        console.warn('Cannot update: app.world is undefined');
        return;
      }
      
      try {
        // Only call the original handler if it's safe to do so and it's a function
        if (typeof onChangeVec === 'function') {
          onChangeVec(axis, value);
        }
      } catch (err) {
        console.warn(`Error updating ${axis}:`, err);
      }
    }, 50); // 50ms debounce delay
  };
  
  // Add this utility function to increment/decrement values with precision
  const adjustValue = useCallback((value, increment, step) => {
    // Parse the value to ensure it's a number
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 0;
    
    // Calculate new value with the precision step
    const newValue = increment ? numValue + step : numValue - step;
    
    // Return formatted to avoid floating point precision issues
    const precision = Math.max(0, Math.ceil(Math.log10(1 / step)));
    return parseFloat(newValue.toFixed(precision));
  }, []);

  // Create a function to cycle through precision steps
  const cyclePrecision = useCallback(() => {
    // Define available precision steps
    const steps = [1, 0.1, 0.01, 0.001];
    const currentIndex = steps.indexOf(precisionStep);
    const nextIndex = (currentIndex + 1) % steps.length;
    setPrecisionStep(steps[nextIndex]);
  }, [precisionStep]);

  // Update the formatVector function with the new controls
  const formatVector = (vec, onChangeVec, isChildNode = false) => {
    const components = extractVectorComponents(vec)
    if (!components) return 'None'
    
    // If this is a child node and we have an onChangeVec function,
    // we'll show the inputs but disable them
    const showInputs = onChangeVec !== null;
    const disableInputs = isChildNode && showInputs;
    
    return (
      <div className="vector-value">
        <span style={{ color: '#ff6b6b', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ width: '20px', display: 'inline-block' }}>X:</span>
          {showInputs ? (
            <div className="transform-input-wrapper">
              <button 
                className="transform-button minus"
                onClick={() => safeChangeHandler('x', adjustValue(components.x, false, precisionStep), onChangeVec)}
                disabled={disableInputs}
              >
                -
              </button>
              <input 
                type="number" 
                value={typeof components.x === 'string' ? parseFloat(components.x) : components.x} 
                onChange={(e) => safeChangeHandler('x', parseFloat(e.target.value), onChangeVec)}
                disabled={disableInputs}
                className={disableInputs ? "transform-input disabled" : "transform-input"}
                step={precisionStep}
              />
              <button 
                className="transform-button plus"
                onClick={() => safeChangeHandler('x', adjustValue(components.x, true, precisionStep), onChangeVec)}
                disabled={disableInputs}
              >
                +
              </button>
            </div>
          ) : (
            <span style={{ marginLeft: '5px' }}>
              {typeof components.x === 'string' ? components.x : Number(components.x).toFixed(3)}
            </span>
          )}
        </span>
        <span style={{ color: '#51cf66', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ width: '20px', display: 'inline-block' }}>Y:</span>
          {showInputs ? (
            <div className="transform-input-wrapper">
              <button 
                className="transform-button minus"
                onClick={() => safeChangeHandler('y', adjustValue(components.y, false, precisionStep), onChangeVec)}
                disabled={disableInputs}
              >
                -
              </button>
              <input 
                type="number" 
                value={typeof components.y === 'string' ? parseFloat(components.y) : components.y} 
                onChange={(e) => safeChangeHandler('y', parseFloat(e.target.value), onChangeVec)}
                disabled={disableInputs}
                className={disableInputs ? "transform-input disabled" : "transform-input"}
                step={precisionStep}
              />
              <button 
                className="transform-button plus"
                onClick={() => safeChangeHandler('y', adjustValue(components.y, true, precisionStep), onChangeVec)}
                disabled={disableInputs}
              >
                +
              </button>
            </div>
          ) : (
            <span style={{ marginLeft: '5px' }}>
              {typeof components.y === 'string' ? components.y : Number(components.y).toFixed(3)}
            </span>
          )}
        </span>
        <span style={{ color: '#339af0', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ width: '20px', display: 'inline-block' }}>Z:</span>
          {showInputs ? (
            <div className="transform-input-wrapper">
              <button 
                className="transform-button minus"
                onClick={() => safeChangeHandler('z', adjustValue(components.z, false, precisionStep), onChangeVec)}
                disabled={disableInputs}
              >
                -
              </button>
              <input 
                type="number" 
                value={typeof components.z === 'string' ? parseFloat(components.z) : components.z} 
                onChange={(e) => safeChangeHandler('z', parseFloat(e.target.value), onChangeVec)}
                disabled={disableInputs}
                className={disableInputs ? "transform-input disabled" : "transform-input"}
                step={precisionStep}
              />
              <button 
                className="transform-button plus"
                onClick={() => safeChangeHandler('z', adjustValue(components.z, true, precisionStep), onChangeVec)}
                disabled={disableInputs}
              >
                +
              </button>
            </div>
          ) : (
            <span style={{ marginLeft: '5px' }}>
              {typeof components.z === 'string' ? components.z : Number(components.z).toFixed(3)}
            </span>
          )}
        </span>
        
        {/* Add precision step control */}
        {showInputs && !disableInputs && (
          <div className="precision-control">
            <button 
              className="precision-button" 
              onClick={cyclePrecision} 
              title="Change precision"
            >
              Step: {precisionStep}
            </button>
          </div>
        )}
      </div>
    )
  }

  // Helper function to format color values
  const formatColor = color => {
    if (!color) return 'None'
    if (color.getHexString) {
      const hex = `#${color.getHexString()}`
      return (
        <div className="color-value" style={{ display: 'flex', alignItems: 'center' }}>
          <div 
            style={{ 
              width: 16, 
              height: 16, 
              backgroundColor: hex, 
              marginRight: 8,
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.2)'
            }} 
          />
          <span>{hex}</span>
        </div>
      )
    }
    return 'Unknown'
  }

  // Get the appropriate display value for rotation
  const getRotationValue = (node, wantEditableVector) => {
    // Try different possible rotation representations
    if (hasProperty(node, 'rotation')) {
      if (node.rotation.isEuler) {
        // For editable values, we need to convert to degrees
        if (wantEditableVector) {
          return new THREE.Vector3(
            THREE.MathUtils.radToDeg(node.rotation.x),
            THREE.MathUtils.radToDeg(node.rotation.y),
            THREE.MathUtils.radToDeg(node.rotation.z)
          );
        }
        return formatVector(node.rotation, null)
      } else {
        // Create a new Euler if the rotation isn't already one
        try {
          const euler = new THREE.Euler()
          if (Array.isArray(node.rotation) && node.rotation.length >= 3) {
            euler.set(node.rotation[0], node.rotation[1], node.rotation[2])
          } else if (typeof node.rotation.x === 'number') {
            euler.set(node.rotation.x, node.rotation.y, node.rotation.z)
          }
          // For editable values, we need to convert to degrees
          if (wantEditableVector) {
            return new THREE.Vector3(
              THREE.MathUtils.radToDeg(euler.x),
              THREE.MathUtils.radToDeg(euler.y),
              THREE.MathUtils.radToDeg(euler.z)
            );
          }
          return formatVector(euler, null)
        } catch (err) {
          console.warn('Error converting rotation', err)
          return formatVector(node.rotation, null)
        }
      }
    } else if (hasProperty(node, 'quaternion')) {
      // Convert quaternion to euler angles for display
      try {
        const euler = new THREE.Euler().setFromQuaternion(
          typeof node.quaternion.x === 'number' 
            ? node.quaternion  // Direct quaternion object
            : Array.isArray(node.quaternion) && node.quaternion.length >= 4 
              ? new THREE.Quaternion(node.quaternion[0], node.quaternion[1], node.quaternion[2], node.quaternion[3]) 
              : new THREE.Quaternion() // Default empty quaternion
        )
        // For editable values, we need to convert to degrees
        if (wantEditableVector) {
          return new THREE.Vector3(
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
          );
        }
        return formatVector(euler, null)
      } catch (err) {
        console.warn('Error converting quaternion', err)
        return "Error converting quaternion"
      }
    }
    return 'None'
  }

  return (
    <div
      className='anodes noscrollbar'
      css={css`
        flex: 1;
        padding: 20px;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        .anodes-tree {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 20px;
          padding-right: 10px;
          ${customScrollbarStyle}
        }
        .anodes-item {
          display: flex;
          align-items: center;
          padding: 6px 8px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 2px;
          transition: background 0.15s ease, color 0.15s ease;
          &:hover {
            background: rgba(0, 167, 255, 0.05);
          }
          &.selected {
            color: #00a7ff;
            background: rgba(0, 167, 255, 0.1);
          }
          .icon-container {
            display: flex;
            align-items: center;
            margin-right: 8px;
            opacity: 0.7;
          }
          .chevron {
            cursor: pointer;
            opacity: 0.5;
            margin-right: 5px;
            transition: transform 0.15s ease;
            &.expanded {
              transform: rotate(90deg);
            }
            &:hover {
              opacity: 1;
            }
          }
          .node-type {
            margin-left: 5px;
            font-size: 11px;
            opacity: 0.5;
            font-style: italic;
          }
          span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          &-indent {
            margin-left: 20px;
          }
        }
        .anodes-empty {
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 20px;
        }
        .anodes-details {
          flex-shrink: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          max-height: 40vh;
          overflow-y: auto;
          padding-right: 10px;
          ${customScrollbarStyle}
        }
        .anodes-detail {
          display: flex;
          margin-bottom: 12px;
          font-size: 14px;
          &-label {
            width: 100px;
            color: rgba(255, 255, 255, 0.5);
            flex-shrink: 0;
          }
          &-value {
            flex: 1;
            word-break: break-word;
            &.copy {
              cursor: pointer;
              transition: color 0.15s ease;
              &:hover {
                color: #00a7ff;
              }
            }
          }
        }
        .vector-value {
          display: flex;
          flex-direction: column;
          span {
            margin-bottom: 3px;
          }
        }
        .property-section {
          margin-top: 16px;
          margin-bottom: 12px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.3);
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .transform-input-wrapper {
          position: relative;
          flex: 1;
          margin-left: 5px;
          display: flex;
          align-items: center;
        }
        .transform-input {
          flex: 1;
          background: rgba(40, 40, 50, 0.8);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 13px;
          transition: all 0.2s ease;
          text-align: center;
          &:hover {
            border-color: rgba(255, 255, 255, 0.3);
          }
          &:focus {
            outline: none;
            border-color: #00a7ff;
            box-shadow: 0 0 0 2px rgba(0, 167, 255, 0.2);
          }
          &.disabled {
            background: rgba(20, 20, 25, 0.8);
            color: rgba(255, 255, 255, 0.5);
            cursor: not-allowed;
          }
          /* Hide browser arrows */
          &::-webkit-inner-spin-button, 
          &::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          -moz-appearance: textfield; /* Firefox */
        }
        .transform-button {
          width: 28px;
          height: 28px;
          background: rgba(30, 30, 40, 0.9);
          color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          transition: all 0.15s ease;
          margin: 0 4px;
          flex-shrink: 0;
          
          &:hover {
            background: rgba(50, 50, 60, 0.9);
            color: white;
            border-color: rgba(255, 255, 255, 0.3);
          }
          
          &:active {
            background: rgba(0, 167, 255, 0.3);
            transform: scale(0.95);
          }
          
          &.minus {
            margin-left: 0;
          }
          
          &.plus {
            margin-right: 0;
          }
          
          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            &:hover, &:active {
              background: rgba(30, 30, 40, 0.9);
              color: rgba(255, 255, 255, 0.8);
              border-color: rgba(255, 255, 255, 0.15);
              transform: none;
            }
          }
        }
        .precision-control {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
          
          .precision-button {
            background: rgba(30, 30, 40, 0.7);
            color: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
            
            &:hover {
              background: rgba(40, 40, 50, 0.8);
              color: white;
              border-color: rgba(255, 255, 255, 0.2);
            }
            
            &:active {
              background: rgba(0, 167, 255, 0.2);
            }
          }
        }
        /* Style for amain scrollable area */
        .amain.noscrollbar, .ameta.noscrollbar {
          ${customScrollbarStyle}
        }
      `}
    >
      <div className='anodes-tree'>
        {rootNode ? (
          renderHierarchy(rootNode, 0, selectedNode, setSelectedNode, expandedNodes, toggleNode)
        ) : (
          <div className='anodes-empty'>
            <LayersIcon size={24} />
            <div>No nodes found</div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className='anodes-details'>
          {selectedNode.id === '$root' && (
            <div style={{ 
              padding: '8px 12px', 
              background: 'rgba(0, 167, 255, 0.1)', 
              borderRadius: '5px', 
              marginBottom: '15px',
              fontSize: '12px',
              lineHeight: '1.4'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>✓ Root node is fully editable</div>
              <div>Transform changes will be applied directly to the app and automatically saved.</div>
            </div>
          )}
          
          {selectedNode.id !== '$root' && (
            <div style={{ 
              padding: '8px 12px', 
              background: 'rgba(255, 167, 0, 0.1)', 
              borderRadius: '5px', 
              marginBottom: '15px',
              fontSize: '12px',
              lineHeight: '1.4'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Child node editing is view-only</div>
              <div>Changes to child nodes won't be saved as they're part of the model structure.</div>
            </div>
          )}
          
          <div className="property-section">Identity</div>
          <HierarchyDetail label='ID' value={selectedNode.id} copy />
          <HierarchyDetail label='Type' value={selectedNode.name || 'Unknown'} />
          
          {/* Transform section */}
          {(hasProperty(selectedNode, 'position') || 
            hasProperty(selectedNode, 'rotation') || 
            hasProperty(selectedNode, 'quaternion') || 
            hasProperty(selectedNode, 'scale')) && (
            <div className="property-section">Transform</div>
          )}
          
          {/* Position */}
          {hasProperty(selectedNode, 'position') && (
            <HierarchyDetail 
              label='Position' 
              value={formatVector(
                selectedNode.position, 
                selectedNode.id === '$root' ? handlePositionChange : null,
                selectedNode.id !== '$root'
              )} 
              isComponent 
            />
          )}

          {/* Rotation - handle both euler and quaternion */}
          {(hasProperty(selectedNode, 'rotation') || hasProperty(selectedNode, 'quaternion')) && (
            <HierarchyDetail 
              label='Rotation' 
              value={formatVector(
                getRotationValue(selectedNode, true), 
                selectedNode.id === '$root' ? handleRotationChange : null,
                selectedNode.id !== '$root'
              )} 
              isComponent 
            />
          )}

          {/* Scale */}
          {hasProperty(selectedNode, 'scale') && (
            <HierarchyDetail 
              label='Scale' 
              value={formatVector(
                selectedNode.scale, 
                selectedNode.id === '$root' ? handleScaleChange : null,
                selectedNode.id !== '$root'
              )} 
              isComponent 
            />
          )}

          {/* Material properties */}
          {hasProperty(selectedNode, 'material') && selectedNode.material && (
            <>
              <div className="property-section">Material</div>
              <HierarchyDetail 
                label='Type' 
                value={selectedNode.material.type || 'Standard'} 
              />
              
              {hasProperty(selectedNode.material, 'color') && (
                <HierarchyDetail 
                  label='Color' 
                  value={formatColor(selectedNode.material.color)} 
                  isComponent 
                />
              )}
              
              {hasProperty(selectedNode.material, 'emissive') && (
                <HierarchyDetail 
                  label='Emissive' 
                  value={formatColor(selectedNode.material.emissive)} 
                  isComponent 
                />
              )}
              
              {hasProperty(selectedNode.material, 'metalness') && (
                <HierarchyDetail 
                  label='Metalness' 
                  value={selectedNode.material.metalness.toFixed(2)} 
                />
              )}
              
              {hasProperty(selectedNode.material, 'roughness') && (
                <HierarchyDetail 
                  label='Roughness' 
                  value={selectedNode.material.roughness.toFixed(2)} 
                />
              )}
              
              {hasProperty(selectedNode.material, 'transparent') && (
                <HierarchyDetail 
                  label='Transparent' 
                  value={selectedNode.material.transparent ? 'Yes' : 'No'} 
                />
              )}
              
              {hasProperty(selectedNode.material, 'opacity') && selectedNode.material.transparent && (
                <HierarchyDetail 
                  label='Opacity' 
                  value={selectedNode.material.opacity.toFixed(2)} 
                />
              )}
            </>
          )}

          {/* Geometry */}
          {hasProperty(selectedNode, 'geometry') && selectedNode.geometry && (
            <>
              <div className="property-section">Geometry</div>
              <HierarchyDetail 
                label='Type' 
                value={selectedNode.geometry.type || 'Custom'} 
              />
              
              {hasProperty(selectedNode.geometry, 'parameters') && (
                <HierarchyDetail 
                  label='Parameters' 
                  value={
                    Object.entries(selectedNode.geometry.parameters || {})
                      .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`)
                      .join(', ') || 'None'
                  } 
                />
              )}
            </>
          )}
          
          {/* Other common properties */}
          {(hasProperty(selectedNode, 'visible') || 
            hasProperty(selectedNode, 'castShadow') || 
            hasProperty(selectedNode, 'receiveShadow')) && (
            <div className="property-section">Rendering</div>
          )}
          
          {hasProperty(selectedNode, 'visible') && (
            <HierarchyDetail 
              label='Visible' 
              value={selectedNode.visible === false ? 'No' : 'Yes'} 
            />
          )}
          
          {hasProperty(selectedNode, 'castShadow') && (
            <HierarchyDetail 
              label='Cast Shadow' 
              value={selectedNode.castShadow ? 'Yes' : 'No'} 
            />
          )}
          
          {hasProperty(selectedNode, 'receiveShadow') && (
            <HierarchyDetail 
              label='Receive Shadow' 
              value={selectedNode.receiveShadow ? 'Yes' : 'No'} 
            />
          )}

          {hasProperty(selectedNode, 'url') && (
            <HierarchyDetail 
              label='URL' 
              value={
                <a 
                  href={selectedNode.url} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{color: '#339af0', textDecoration: 'underline'}}
                >
                  {selectedNode.url}
                </a>
              } 
              isComponent 
            />
          )}
        </div>
      )}
    </div>
  )
}

function HierarchyDetail({ label, value, copy, isComponent }) {
  let handleCopy = copy ? () => navigator.clipboard.writeText(value) : null
  return (
    <div className='anodes-detail'>
      <div className='anodes-detail-label'>{label}</div>
      <div className={cls('anodes-detail-value', { copy })}>
        {isComponent ? value : (typeof value === 'string' ? value : JSON.stringify(value))}
      </div>
    </div>
  )
}

const nodeIcons = {
  default: CircleIcon,
  group: FolderIcon,
  mesh: BoxIcon,
  rigidbody: DumbbellIcon,
  collider: BlendIcon,
  lod: EyeIcon,
  avatar: PersonStandingIcon,
  snap: MagnetIcon,
  audio: AtomIcon,
  action: ZapIcon,
  ui: LayersIcon,
  uitext: FileIcon,
  uiimage: FileIcon,
}

function renderHierarchy(node, depth = 0, selectedNode, setSelectedNode, expandedNodes, toggleNode) {
  if (!node) return null

  // Get Icon component based on node type
  const Icon = nodeIcons[node.name] || nodeIcons.default
  
  // Check if this node is expanded
  const isExpanded = expandedNodes[node.id]
  
  // Check if node has children
  const hasChildren = node.children && node.children.length > 0
  
  // Check if this node is the selected one
  const isSelected = selectedNode?.id === node.id

  return (
    <div key={node.id}>
      <div
        className={cls('anodes-item', {
          'anodes-item-indent': depth > 0,
          selected: isSelected,
        })}
        style={{ marginLeft: depth * 20 }}
        onClick={() => setSelectedNode(node)}
      >
        <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
          {hasChildren && (
            <ChevronDown 
              size={14} 
              className={cls('chevron', { expanded: isExpanded })} 
              onClick={(e) => toggleNode(node.id, e)}
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          )}
        </div>
        <div className="icon-container">
          <Icon size={14} />
        </div>
        <span>
          {node.id === '$root' ? 'app' : node.id}
          <span className="node-type">{node.name !== 'group' ? node.name : ''}</span>
        </span>
      </div>
      
      {/* Render children if expanded */}
      {isExpanded && hasChildren && node.children.map(child => 
        renderHierarchy(child, depth + 1, selectedNode, setSelectedNode, expandedNodes, toggleNode)
      )}
    </div>
  )
}

function PlayerPane({ world, player }) {
  return <div>PLAYER INSPECT</div>
}

function Fields({ app, blueprint }) {
  const world = app.world
  const [fields, setFields] = useState(app.fields)
  const props = blueprint.props
  useEffect(() => {
    app.onFields = setFields
    return () => {
      app.onFields = null
    }
  }, [])
  const modify = (key, value) => {
    if (props[key] === value) return
    props[key] = value
    // update blueprint locally (also rebuilds apps)
    const id = blueprint.id
    const version = blueprint.version + 1
    world.blueprints.modify({ id, version, props })
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id, version, props })
  }
  return fields.map(field => (
    <Field key={field.key} world={world} props={props} field={field} value={props[field.key]} modify={modify} />
  ))
}

const fieldTypes = {
  section: FieldSection,
  text: FieldText,
  textarea: FieldTextArea,
  number: FieldNumber,
  file: FieldFile,
  switch: FieldSwitch,
  dropdown: FieldDropdown,
  range: FieldRange,
  button: FieldButton,
  buttons: FieldButtons,
}

function Field({ world, props, field, value, modify }) {
  if (field.hidden) {
    return null
  }
  if (field.when && isArray(field.when)) {
    for (const rule of field.when) {
      if (rule.op === 'eq' && props[rule.key] !== rule.value) {
        return null
      }
    }
  }
  const FieldControl = fieldTypes[field.type]
  if (!FieldControl) return null
  return <FieldControl world={world} field={field} value={value} modify={modify} />
}

function FieldWithLabel({ label, children }) {
  return (
    <div
      className='fieldwlabel'
      css={css`
        display: flex;
        align-items: center;
        margin: 0 0 10px;
        .fieldwlabel-label {
          width: 90px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }
        .fieldwlabel-content {
          flex: 1;
        }
      `}
    >
      <div className='fieldwlabel-label'>{label}</div>
      <div className='fieldwlabel-content'>{children}</div>
    </div>
  )
}

function FieldSection({ world, field, value, modify }) {
  return (
    <div
      className='fieldsection'
      css={css`
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        margin: 20px 0 14px;
        padding: 16px 0 0 0;
        .fieldsection-label {
          font-size: 14px;
          font-weight: 400;
          line-height: 1;
        }
      `}
    >
      <div className='fieldsection-label'>{field.label}</div>
    </div>
  )
}

function FieldText({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputText value={value} onChange={value => modify(field.key, value)} placeholder={field.placeholder} />
    </FieldWithLabel>
  )
}

function FieldTextArea({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputTextarea value={value} onChange={value => modify(field.key, value)} placeholder={field.placeholder} />
    </FieldWithLabel>
  )
}

function FieldNumber({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputNumber
        placeholder={field.placeholder}
        value={value}
        onChange={value => modify(field.key, value)}
        dp={field.dp}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

function FieldRange({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputRange
        value={value}
        onChange={value => modify(field.key, value)}
        min={field.min}
        max={field.max}
        step={field.step}
      />
    </FieldWithLabel>
  )
}

function FieldFile({ world, field, value, modify }) {
  const kind = fileKinds[field.kind]
  if (!kind) return null
  return (
    <FieldWithLabel label={field.label}>
      <InputFile world={world} kind={field.kind} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldSwitch({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputSwitch options={field.options} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldDropdown({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <InputDropdown options={field.options} value={value} onChange={value => modify(field.key, value)} />
    </FieldWithLabel>
  )
}

function FieldButton({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={''}>
      <div
        css={css`
          background: #252630;
          border-radius: 10px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          &:hover {
            cursor: pointer;
            background: #30323e;
          }
        `}
        onClick={field.onClick}
      >
        <span>{field.label}</span>
      </div>
    </FieldWithLabel>
  )
}

function FieldButtons({ world, field, value, modify }) {
  return (
    <FieldWithLabel label={field.label}>
      <div
        css={css`
          height: 34px;
          display: flex;
          gap: 5px;
          .fieldbuttons-button {
            flex: 1;
            background: #252630;
            border-radius: 10px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            &:hover {
              cursor: pointer;
              background: #30323e;
            }
          }
        `}
      >
        {field.buttons.map(button => (
          <div key={button.label} className='fieldbuttons-button' onClick={button.onClick}>
            <span>{button.label}</span>
          </div>
        ))}
      </div>
    </FieldWithLabel>
  )
}
