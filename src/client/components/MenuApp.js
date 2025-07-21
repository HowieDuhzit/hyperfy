import { useEffect, useMemo, useState } from 'react'
import {
  Menu,
  MenuItemBack,
  MenuItemBtn,
  MenuItemCurve,
  MenuItemFile,
  MenuItemFileBtn,
  MenuItemNumber,
  MenuItemRange,
  MenuItemSwitch,
  MenuItemText,
  MenuItemTextarea,
  MenuItemToggle,
  MenuLine,
  MenuSection,
} from './Menu'
import { exportApp } from '../../core/extras/appTools'
import { downloadFile } from '../../core/extras/downloadFile'
import { hashFile } from '../../core/utils-client'
import { isArray, isBoolean } from 'lodash-es'
import { css } from '@firebolt-dev/css'

export function MenuApp({ world, app, blur }) {
  const [pages, setPages] = useState(() => ['index'])
  const [blueprint, setBlueprint] = useState(app.blueprint)
  useEffect(() => {
    window.app = app
    const onModify = bp => {
      if (bp.id === blueprint.id) setBlueprint(bp)
    }
    world.blueprints.on('modify', onModify)
    return () => {
      world.blueprints.off('modify', onModify)
    }
  }, [])
  const pop = () => {
    const next = pages.slice()
    next.pop()
    setPages(next)
  }
  const push = page => {
    const next = pages.slice()
    next.push(page)
    setPages(next)
  }
  const page = pages[pages.length - 1]
  let Page
  if (page === 'index') Page = MenuAppIndex
  if (page === 'flags') Page = MenuAppFlags
  if (page === 'metadata') Page = MenuAppMetadata
  return (
    <Menu title={blueprint.name} blur={blur}>
      <Page world={world} app={app} blueprint={blueprint} pop={pop} push={push} />
    </Menu>
  )
}

const extToType = {
  glb: 'model',
  vrm: 'avatar',
}
const allowedModels = ['glb', 'vrm']

function MenuAppIndex({ world, app, blueprint, pop, push }) {
  const player = world.entities.player
  const frozen = blueprint.frozen // TODO: disable code editor, model change, metadata editing, flag editing etc
  const changeModel = async file => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
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
  const download = async () => {
    try {
      const file = await exportApp(app.blueprint, world.loader.loadFile)
      downloadFile(file)
    } catch (err) {
      console.error(err)
    }
  }
  return (
    <>
      <MenuItemFields world={world} app={app} blueprint={blueprint} />
      {app.fields?.length > 0 && <MenuLine />}
      {!frozen && (
        <MenuItemFileBtn
          label='Model'
          hint='Change the model for this app'
          accept='.glb,.vrm'
          value={blueprint.model}
          onChange={changeModel}
        />
      )}
      {!frozen && <MenuItemBtn label='Code' hint='View or edit the code for this app' onClick={world.ui.toggleCode} />}
      {!frozen && <MenuItemBtn label='Flags' hint='View/edit flags for this app' onClick={() => push('flags')} nav />}
      <MenuItemBtn label='Metadata' hint='View/edit metadata for this app' onClick={() => push('metadata')} nav />
      <MenuItemBtn label='Download' hint='Download this app as a .hyp file' onClick={download} />
      <MenuItemBtn
        label='Delete'
        hint='Delete this app instance'
        onClick={() => {
          world.ui.setMenu(null)
          app.destroy(true)
        }}
      />
    </>
  )
}

function MenuItemFields({ world, app, blueprint }) {
  const [fields, setFields] = useState(() => app.fields)
  const props = blueprint.props
  useEffect(() => {
    app.onFields = setFields
    return () => {
      app.onFields = null
    }
  }, [])
  const modify = (key, value) => {
    if (props[key] === value) return
    
    // Special handling for preset changes
    if (key === 'preset' && value !== 'custom') {
      // Get presets from global window object
      const presets = window.particleFXPresets || window.dynamicConfigTestPresets || {}
      const preset = presets[value]
      if (preset) {
        // Apply all preset values
        const bp = world.blueprints.get(blueprint.id)
        const newProps = { ...bp.props, [key]: value, ...preset }
        const id = bp.id
        const version = bp.version + 1
        world.blueprints.modify({ id, version, props: newProps })
        world.network.send('blueprintModified', { id, version, props: newProps })
        return
      }
    }
    
    // Special handling for saving presets
    if (key === 'savePreset' && value && value.trim()) {
      // Log current settings as a preset
      const currentPreset = {}
      
      // Determine which config keys to use based on available presets
      let configKeys = []
      if (window.particleFXPresets) {
        // ParticleFX script keys
        configKeys = [
          'rate', 'max', 'life', 'shapeType', 'shapeWidth', 'shapeHeight', 'shapeDepth',
          'volumeEmission', 'direction', 'speed', 'gravity', 'size', 'sizeOverLife',
          'rotate', 'color', 'alpha', 'alphaOverLife', 'blending', 'emissive', 'lit',
          'duration', 'loop', 'autoPlay', 'space', 'image'
        ]
      } else if (window.dynamicConfigTestPresets) {
        // DynamicConfigTest script keys
        configKeys = ['color', 'endColor', 'intensity', 'showDemo']
      } else {
        // Generic approach - save all non-preset fields
        configKeys = Object.keys(props).filter(k => k !== 'preset' && k !== 'savePreset')
      }
      
      configKeys.forEach(configKey => {
        if (props[configKey] !== undefined) {
          currentPreset[configKey] = props[configKey]
        }
      })
      
      console.log(`\n=== PRESET: "${value}" ===`)
      console.log(JSON.stringify(currentPreset, null, 2))
      console.log(`\nCopy this object and add it to the presets in your script.`)
      console.log(`Don't forget to add "${value}" to the preset options array!`)
      
      // Clear the input after saving
      const bp = world.blueprints.get(blueprint.id)
      const newProps = { ...bp.props, [key]: '' }
      const id = bp.id
      const version = bp.version + 1
      world.blueprints.modify({ id, version, props: newProps })
      world.network.send('blueprintModified', { id, version, props: newProps })
      return
    }
    
    // Check if this is a reactive field change that should trigger dynamic updates
    const field = app.fields?.find(f => f.key === key)
    if (field && field.reactive && field._onChangeHandler) {
      try {
        // Call the reactive onChange handler
        const updates = field._onChangeHandler(value, app, props)
        if (updates && Array.isArray(updates)) {
          // Use the new dynamic update method for multiple field changes
          app.updateConfiguration(updates)
          return
        }
      } catch (error) {
        console.warn('Reactive onChange handler failed:', error)
        // Fall back to default behavior
      }
    }
    
    // Default behavior for single field updates
    const bp = world.blueprints.get(blueprint.id)
    const newProps = { ...bp.props, [key]: value }
    // update blueprint locally (also rebuilds apps)
    const id = bp.id
    const version = bp.version + 1
    world.blueprints.modify({ id, version, props: newProps })
    // broadcast blueprint change to server + other clients
    world.network.send('blueprintModified', { id, version, props: newProps })
  }
  return fields.map(field => (
    <MenuItemField key={field.key} world={world} props={props} field={field} value={props[field.key]} modify={modify} />
  ))
}

function MenuItemField({ world, props, field, value, modify }) {
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
  if (field.type === 'section') {
    return <MenuSection label={field.label} />
  }
  if (field.type === 'text') {
    return (
      <MenuItemText
        label={field.label}
        hint={field.hint}
        placeholder={field.placeholder}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'textarea') {
    return (
      <MenuItemTextarea
        label={field.label}
        hint={field.hint}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <MenuItemNumber
        label={field.label}
        hint={field.hint}
        dp={field.dp}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'file') {
    return (
      <MenuItemFile
        label={field.label}
        hint={field.hint}
        kind={field.kind}
        value={value}
        onChange={value => modify(field.key, value)}
        world={world}
      />
    )
  }
  if (field.type === 'switch') {
    return (
      <MenuItemSwitch
        label={field.label}
        hint={field.hint}
        options={field.options}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'dropdown') {
    // deprecated, same as switch
    return (
      <MenuItemSwitch
        label={field.label}
        hint={field.hint}
        options={field.options}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'toggle') {
    return (
      <MenuItemToggle
        label={field.label}
        hint={field.hint}
        trueLabel={field.trueLabel}
        falseLabel={field.falseLabel}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'range') {
    return (
      <MenuItemRange
        label={field.label}
        hint={field.hint}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'curve') {
    return (
      <MenuItemCurve
        label={field.label}
        hint={field.hint}
        yMin={field.yMin}
        yMax={field.yMax}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'button') {
    return <MenuItemBtn label={field.label} hint={field.hint} onClick={field.onClick} />
  }
  return null
}

function MenuAppFlags({ world, app, blueprint, pop, push }) {
  const player = world.entities.player
  const toggle = async (key, value) => {
    value = isBoolean(value) ? value : !blueprint[key]
    if (blueprint[key] === value) return
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <>
      <MenuItemBack hint='Go back to the main app details' onClick={pop} />
      <MenuItemToggle
        label='Preload'
        hint='Preload this app before players enter the world'
        value={blueprint.preload}
        onChange={value => toggle('preload', value)}
      />
      <MenuItemToggle
        label='Lock'
        hint='Lock the app so that after downloading it the model, script and metadata can no longer be edited'
        value={blueprint.locked}
        onChange={value => toggle('locked', value)}
      />
      <MenuItemToggle
        label='Unique'
        hint='When duplicating this app in the world, create a completely new and unique instance with its own separate config'
        value={blueprint.unique}
        onChange={value => toggle('unique', value)}
      />
    </>
  )
}

function MenuAppMetadata({ world, app, blueprint, pop, push }) {
  const player = world.entities.player
  const set = async (key, value) => {
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <>
      <MenuItemBack hint='Go back to the main app details' onClick={pop} />
      <MenuItemText
        label='Name'
        hint='The name of this app'
        value={blueprint.name}
        onChange={value => set('name', value)}
      />
      <MenuItemFile
        label='Image'
        hint='An image/icon for this app'
        kind='texture'
        value={blueprint.image}
        onChange={value => set('image', value)}
        world={world}
      />
      <MenuItemText
        label='Author'
        hint='The name of the author that made this app'
        value={blueprint.author}
        onChange={value => set('author', value)}
      />
      <MenuItemText label='URL' hint='A url for this app' value={blueprint.url} onChange={value => set('url', value)} />
      <MenuItemTextarea
        label='Description'
        hint='A description for this app'
        value={blueprint.desc}
        onChange={value => set('desc', value)}
      />
    </>
  )
}
