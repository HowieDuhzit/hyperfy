import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
  const canEdit = !blueprint.frozen && hasRole(world.entities.player.data.user.roles, 'admin', 'builder')
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
  const downloadModel = e => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader.getFile(blueprint.model)
      if (!file) return
      downloadFile(file)
    }
  }
  const changeModel = async e => {
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
            background-image: ${blueprint.image ? `url(${resolveURL(blueprint.image.url)})` : 'none'};
          `}
        />
      )}
      {blueprint.name && <div className='amain-name'>{blueprint.name}</div>}
      {blueprint.author && (
        <div className='amain-author'>
          <span>by </span>
          {blueprint.url && (
            <a href={resolveURL(blueprint.url)} target='_blank'>
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
              <input type='file' accept='.glb,.vrm' onChange={changeModel} />
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
  const rootNode = useMemo(() => app.getNodes(), [])

  useEffect(() => {
    if (rootNode && !selectedNode) {
      setSelectedNode(rootNode)
    }
  }, [rootNode])

  // Helper function to safely get vector string
  const getVectorString = vec => {
    if (!vec || typeof vec.x !== 'number') return null
    return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`
  }

  // Helper function to safely check if a property exists
  const hasProperty = (obj, prop) => {
    try {
      return obj && typeof obj[prop] !== 'undefined'
    } catch (err) {
      return false
    }
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
        }
        .anodes-item {
          display: flex;
          align-items: center;
          padding: 4px 6px;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
          &:hover {
            color: #00a7ff;
          }
          &.selected {
            color: #00a7ff;
            background: rgba(0, 167, 255, 0.1);
          }
          svg {
            margin-right: 8px;
            opacity: 0.5;
            flex-shrink: 0;
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
        }
        .anodes-detail {
          display: flex;
          margin-bottom: 8px;
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
            }
          }
        }
      `}
    >
      <div className='anodes-tree'>
        {rootNode ? (
          renderHierarchy([rootNode], 0, selectedNode, setSelectedNode)
        ) : (
          <div className='anodes-empty'>
            <LayersIcon size={24} />
            <div>No nodes found</div>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className='anodes-details'>
          <HierarchyDetail label='ID' value={selectedNode.id} copy />
          <HierarchyDetail label='Name' value={selectedNode.name} />

          {/* Position */}
          {hasProperty(selectedNode, 'position') && getVectorString(selectedNode.position) && (
            <HierarchyDetail label='Position' value={getVectorString(selectedNode.position)} />
          )}

          {/* Rotation */}
          {hasProperty(selectedNode, 'rotation') && getVectorString(selectedNode.rotation) && (
            <HierarchyDetail label='Rotation' value={getVectorString(selectedNode.rotation)} />
          )}

          {/* Scale */}
          {hasProperty(selectedNode, 'scale') && getVectorString(selectedNode.scale) && (
            <HierarchyDetail label='Scale' value={getVectorString(selectedNode.scale)} />
          )}

          {/* Material */}
          {hasProperty(selectedNode, 'material') && selectedNode.material && (
            <>
              <HierarchyDetail label='Material' value={selectedNode.material.type || 'Standard'} />
              {hasProperty(selectedNode.material, 'color') && selectedNode.material.color && (
                <HierarchyDetail
                  label='Color'
                  value={
                    selectedNode.material.color.getHexString
                      ? `#${selectedNode.material.color.getHexString()}`
                      : 'Unknown'
                  }
                />
              )}
            </>
          )}

          {/* Geometry */}
          {hasProperty(selectedNode, 'geometry') && selectedNode.geometry && (
            <HierarchyDetail label='Geometry' value={selectedNode.geometry.type || 'Custom'} />
          )}
        </div>
      )}
    </div>
  )
}

function HierarchyDetail({ label, value, copy }) {
  let handleCopy = copy ? () => navigator.clipboard.writeText(value) : null
  return (
    <div className='anodes-detail'>
      <div className='anodes-detail-label'>{label}</div>
      <div className={cls('anodes-detail-value', { copy })} onClick={handleCopy}>
        {value}
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
}

function renderHierarchy(nodes, depth = 0, selectedNode, setSelectedNode) {
  if (!Array.isArray(nodes)) return null

  return nodes.map(node => {
    if (!node) return null

    // Skip the root node but show its children
    // if (depth === 0 && node.id === '$root') {
    //   return renderHierarchy(node.children || [], depth, selectedNode, setSelectedNode)
    // }

    // Safely get children
    const children = node.children || []
    const hasChildren = Array.isArray(children) && children.length > 0
    const isSelected = selectedNode?.id === node.id
    const Icon = nodeIcons[node.name] || nodeIcons.default

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
          <Icon size={14} />
          <span>{node.id === '$root' ? 'app' : node.id}</span>
        </div>
        {hasChildren && renderHierarchy(children, depth + 1, selectedNode, setSelectedNode)}
      </div>
    )
  })
}

function PlayerPane({ world, player }) {
  return <div>PLAYER INSPECT</div>
}

function Fields({ app, blueprint }) {
  const world = app.world
  const [fields, setFields] = useState(app.fields)
  const [position, setPosition] = useState(app.root?.position || new THREE.Vector3())
  const [rotation, setRotation] = useState(app.root?.rotation || new THREE.Euler())
  const [scale, setScale] = useState(app.root?.scale || new THREE.Vector3(1, 1, 1))
  const props = blueprint.props || {}

  // Update state when app changes
  useEffect(() => {
    const onUpdate = () => {
      if (app.root) {
        setPosition(app.root.position.clone())
        setRotation(app.root.rotation.clone())
        setScale(app.root.scale.clone())
      }
    }

    // Initial update
    onUpdate()

    // Subscribe to updates
    app.on('update', onUpdate)
    return () => app.off('update', onUpdate)
  }, [app])

  // Add transform fields
  const transformFields = [
    {
      type: 'section',
      key: 'transform',
      label: 'Transform',
    },
    {
      type: 'vector3',
      key: 'position',
      label: 'Position',
      value: position,
    },
    {
      type: 'euler',
      key: 'rotation',
      label: 'Rotation',
      value: rotation,
    },
    {
      type: 'vector3',
      key: 'scale',
      label: 'Scale',
      value: scale,
    },
    ...fields
  ]

  useEffect(() => {
    app.onFields = setFields
    return () => {
      app.onFields = null
    }
  }, [])

  const modify = (key, value) => {
    if (props[key] === value) return

    // Handle transform updates
    if (key === 'position' && app.root) {
      app.root.position.copy(value)
      app.data.position = value.toArray()
      world.network.send('entityModified', {
        id: app.data.id,
        position: app.data.position
      })
      if (app.networkPos) {
        app.networkPos.pushArray(app.data.position)
      }
      setPosition(value.clone())
      return
    }

    if (key === 'rotation' && app.root) {
      // Ensure we maintain the same rotation order
      const euler = value.clone()
      euler.order = 'YXZ' // Match the app's rotation order

      app.root.rotation.copy(euler)
      const quaternion = new THREE.Quaternion().setFromEuler(euler)
      app.data.quaternion = quaternion.toArray()

      world.network.send('entityModified', {
        id: app.data.id,
        quaternion: app.data.quaternion
      })

      if (app.networkQuat) {
        app.networkQuat.pushArray(app.data.quaternion)
      }

      setRotation(euler)
      return
    }

    if (key === 'scale' && app.root) {
      app.scale.copy(value)
      app.data.scale = value.toArray()
      world.network.send('entityModified', {
        id: app.data.id,
        scale: app.data.scale
      })
      setScale(value.clone())
      return
    }

    // Handle other config updates
    props[key] = value

    // update blueprint locally (also rebuilds apps)
    const id = blueprint.id
    const version = blueprint.version + 1
    world.blueprints.modify({ id, version, props })

    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id, version, props })
  }

  return transformFields.map(field => (
    <Field key={field.key} world={world} props={props} field={field} value={props[field.key] ?? field.value} modify={modify} />
  ))
}

const fieldTypes = {
  section: FieldSection,
  text: FieldText,
  textarea: FieldTextArea,
  number: FieldNumber,
  file: FieldFile,
  switch: FieldSwitch,
  vector3: FieldVector3,
  euler: FieldEuler,
  dropdown: FieldDropdown,
  range: FieldRange,
}

function Field({ world, props, field, value, modify }) {
  if (field.when) {
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

function DraggableNumberInput({ value, onChange, step = 0.1, className = '' }) {
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)
  const startValue = useRef(0)
  
  const handleMouseDown = (e) => {
    if (e.target.type === 'number') {
      e.preventDefault()
      setIsDragging(true)
      startY.current = e.clientY
      startValue.current = parseFloat(value) || 0
      
      const handleMouseMove = (e) => {
        const delta = startY.current - e.clientY
        const multiplier = e.shiftKey ? 0.1 : 1 // Fine control with shift
        const newValue = startValue.current + (delta * step * multiplier)
        onChange(Number(newValue.toFixed(3))) // Round to 3 decimal places
      }
      
      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
      
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  return (
    <input
      type="number"
      value={Number(value).toFixed(3)}
      onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
      onMouseDown={handleMouseDown}
      className={className}
      css={css`
        cursor: ns-resize;
        user-select: none;
        &::-webkit-inner-spin-button,
        &::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        -moz-appearance: textfield;
      `}
    />
  )
}

function FieldVector3({ world, field, value, modify }) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    if (localValue !== value) setLocalValue(value)
  }, [value])

  return (
    <FieldWithLabel label={field.label}>
      <div
        css={css`
          display: flex;
          gap: 8px;
          label {
            flex: 1;
            display: block;
            background-color: #252630;
            border-radius: 10px;
            padding: 0 8px;
            cursor: text;
            input {
              height: 34px;
              font-size: 14px;
              width: 100%;
            }
          }
        `}
      >
        <label>
          <DraggableNumberInput
            value={localValue.x || 0}
            onChange={(newValue) => {
              const newVector = new THREE.Vector3(newValue, localValue.y, localValue.z)
              setLocalValue(newVector)
              modify(field.key, newVector)
            }}
            step={field.key === 'scale' ? 0.01 : 0.1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={localValue.y || 0}
            onChange={(newValue) => {
              const newVector = new THREE.Vector3(localValue.x, newValue, localValue.z)
              setLocalValue(newVector)
              modify(field.key, newVector)
            }}
            step={field.key === 'scale' ? 0.01 : 0.1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={localValue.z || 0}
            onChange={(newValue) => {
              const newVector = new THREE.Vector3(localValue.x, localValue.y, newValue)
              setLocalValue(newVector)
              modify(field.key, newVector)
            }}
            step={field.key === 'scale' ? 0.01 : 0.1}
          />
        </label>
      </div>
    </FieldWithLabel>
  )
}

function FieldEuler({ world, field, value, modify }) {
  const [localValue, setLocalValue] = useState(value)
  const [inputValues, setInputValues] = useState({
    x: (value.x * 180 / Math.PI) || 0,
    y: (value.y * 180 / Math.PI) || 0,
    z: (value.z * 180 / Math.PI) || 0
  })
  const eulerRef = useRef(new THREE.Euler())
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (localValue !== value) {
      eulerRef.current.copy(value)
      setLocalValue(eulerRef.current)
      setInputValues({
        x: (value.x * 180 / Math.PI) || 0,
        y: (value.y * 180 / Math.PI) || 0,
        z: (value.z * 180 / Math.PI) || 0
      })
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleChange = useCallback((axis, value) => {
    // Update the input value immediately for responsiveness
    setInputValues(prev => ({
      ...prev,
      [axis]: value
    }))

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set a new timeout to update the actual rotation
    timeoutRef.current = setTimeout(() => {
      const radians = value * Math.PI / 180
      eulerRef.current.copy(localValue)
      eulerRef.current[axis] = radians
      setLocalValue(eulerRef.current)
      modify(field.key, eulerRef.current)
    }, 100) // 100ms debounce
  }, [localValue, modify, field.key])

  return (
    <FieldWithLabel label={field.label}>
      <div
        css={css`
          display: flex;
          gap: 8px;
          label {
            flex: 1;
            display: block;
            background-color: #252630;
            border-radius: 10px;
            padding: 0 8px;
            cursor: text;
            input {
              height: 34px;
              font-size: 14px;
              width: 100%;
            }
          }
        `}
      >
        <label>
          <DraggableNumberInput
            value={inputValues.x}
            onChange={(val) => handleChange('x', val)}
            step={1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={inputValues.y}
            onChange={(val) => handleChange('y', val)}
            step={1}
          />
        </label>
        <label>
          <DraggableNumberInput
            value={inputValues.z}
            onChange={(val) => handleChange('z', val)}
            step={1}
          />
        </label>
      </div>
    </FieldWithLabel>
  )
}

function resolveURL(url) {
  url = url.trim()
  if (url.startsWith('asset://')) {
    return url.replace('asset:/', process.env.PUBLIC_ASSETS_URL)
  }
  if (url.match(/^https?:\/\//i)) {
    return url
  }
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  return `https://${url}`
}
