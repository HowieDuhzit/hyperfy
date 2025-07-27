import { css } from '@firebolt-dev/css'
import { MenuIcon, MicIcon, MicOffIcon, SettingsIcon, VRIcon } from './Icons'
import {
  BookTextIcon,
  BoxIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  CirclePlusIcon,
  CodeIcon,
  DownloadIcon,
  EarthIcon,
  InfoIcon,
  LayersIcon,
  ListTreeIcon,
  LoaderPinwheelIcon,
  MessageSquareTextIcon,
  Move3DIcon,
  OctagonXIcon,
  PinIcon,
  RocketIcon,
  SaveIcon,
  SearchIcon,
  SparkleIcon,
  SquareCheckBigIcon,
  SquareIcon,
  SquareMenuIcon,
  TagIcon,
  Trash2Icon,
} from 'lucide-react'
import { cls } from './cls'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePermissions } from './usePermissions'
import {
  FieldBtn,
  FieldCurve,
  FieldFile,
  FieldNumber,
  FieldRange,
  FieldSwitch,
  FieldText,
  FieldTextarea,
  FieldToggle,
  FieldVec3,
} from './Fields'
import { HintContext, HintProvider } from './Hint'
import { useFullscreen } from './useFullscreen'
import { downloadFile } from '../../core/extras/downloadFile'
import { exportApp } from '../../core/extras/appTools'
import { hashFile } from '../../core/utils-client'
import { cloneDeep, isArray, isBoolean } from 'lodash-es'
import { storage } from '../../core/storage'
import { ScriptEditor } from './ScriptEditor'
import { NodeHierarchy } from './NodeHierarchy'
import { AppsList } from './AppsList'
import { DEG2RAD, RAD2DEG } from '../../core/extras/general'
import * as THREE from '../../core/extras/three'
import { isTouch } from '../utils'
import { uuid } from '../../core/utils'

const mainSectionPanes = ['prefs']
const worldSectionPanes = ['world', 'docs', 'apps', 'add']
const appSectionPanes = ['app', 'script', 'nodes', 'meta']

const e1 = new THREE.Euler(0, 0, 0, 'YXZ')
const q1 = new THREE.Quaternion()

/**
 * frosted
 * 
background: rgba(11, 10, 21, 0.85); 
border: 0.0625rem solid #2a2b39;
backdrop-filter: blur(5px);
 *
 */

export function Sidebar({ world, ui }) {
  const { isAdmin, isBuilder } = usePermissions(world)
  const player = world.entities.player
  const [livekit, setLiveKit] = useState(() => world.livekit.status)
  useEffect(() => {
    const onLiveKitStatus = status => {
      setLiveKit({ ...status })
    }
    world.livekit.on('status', onLiveKitStatus)
    return () => {
      world.livekit.off('status', onLiveKitStatus)
    }
  }, [])
  const activePane = ui.active ? ui.pane : null
  return (
    <HintProvider>
      <div
        className='sidebar'
        css={css`
          position: absolute;
          font-size: 1rem;
          top: calc(2rem + env(safe-area-inset-top));
          right: calc(2rem + env(safe-area-inset-right));
          bottom: calc(2rem + env(safe-area-inset-bottom));
          left: calc(2rem + env(safe-area-inset-left));
          display: flex;
          gap: 0.625rem;
          z-index: 1; // above chat etc
          @media all and (max-width: 1200px) {
            top: calc(1rem + env(safe-area-inset-top));
            right: calc(1rem + env(safe-area-inset-right));
            bottom: calc(1rem + env(safe-area-inset-bottom));
            left: calc(1rem + env(safe-area-inset-left));
          }
          .sidebar-sections {
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            gap: 0.625rem;
          }
        `}
      >
        <div className='sidebar-sections'>
          <Section active={activePane} bottom>
            <Btn
              active={activePane === 'prefs'}
              suspended={ui.pane === 'prefs' && !activePane}
              onClick={() => world.ui.togglePane('prefs')}
            >
              <MenuIcon size='1.25rem' />
            </Btn>
            {isTouch && (
              <Btn
                onClick={() => {
                  world.emit('sidebar-chat-toggle')
                }}
              >
                <MessageSquareTextIcon size='1.25rem' />
              </Btn>
            )}
            {livekit.available && !livekit.connected && (
              <Btn disabled>
                <MicOffIcon size='1.25rem' />
              </Btn>
            )}
            {livekit.available && livekit.connected && (
              <Btn
                onClick={() => {
                  world.livekit.setMicrophoneEnabled()
                }}
              >
                {livekit.mic ? <MicIcon size='1.25rem' /> : <MicOffIcon size='1.25rem' />}
              </Btn>
            )}
            {world.xr.supportsVR && (
              <Btn
                onClick={() => {
                  world.xr.enter()
                }}
              >
                <VRIcon size='1.25rem' />
              </Btn>
            )}
          </Section>
          {isBuilder && (
            <Section active={activePane} top bottom>
              <Btn
                active={activePane === 'world'}
                suspended={ui.pane === 'world' && !activePane}
                onClick={() => world.ui.togglePane('world')}
              >
                <EarthIcon size='1.25rem' />
              </Btn>
              {/* <Btn
              active={activePane === 'docs'}
              suspended={ui.pane === 'docs' && !activePane}
              onClick={() => world.ui.togglePane('docs')}
            >
              <BookTextIcon size='1.25rem' />
            </Btn> */}
              <Btn
                active={activePane === 'apps'}
                suspended={ui.pane === 'apps' && !activePane}
                onClick={() => world.ui.togglePane('apps')}
              >
                <LayersIcon size='1.25rem' />
              </Btn>
              <Btn
                active={activePane === 'add'}
                suspended={ui.pane === 'add' && !activePane}
                onClick={() => world.ui.togglePane('add')}
              >
                <CirclePlusIcon size='1.25rem' />
              </Btn>
            </Section>
          )}
          {ui.app && (
            <Section active={activePane} top bottom>
              <Btn
                active={activePane === 'app'}
                suspended={ui.pane === 'app' && !activePane}
                onClick={() => world.ui.togglePane('app')}
              >
                <SquareMenuIcon size='1.25rem' />
              </Btn>
              <Btn
                active={activePane === 'script'}
                suspended={ui.pane === 'script' && !activePane}
                onClick={() => world.ui.togglePane('script')}
              >
                <CodeIcon size='1.25rem' />
              </Btn>
              <Btn
                active={activePane === 'nodes'}
                suspended={ui.pane === 'nodes' && !activePane}
                onClick={() => world.ui.togglePane('nodes')}
              >
                <ListTreeIcon size='1.25rem' />
              </Btn>
              <Btn
                active={activePane === 'meta'}
                suspended={ui.pane === 'meta' && !activePane}
                onClick={() => world.ui.togglePane('meta')}
              >
                <TagIcon size='1.25rem' />
              </Btn>
            </Section>
          )}
        </div>
        {ui.pane === 'prefs' && <Prefs world={world} hidden={!ui.active} />}
        {ui.pane === 'world' && <World world={world} hidden={!ui.active} />}
        {ui.pane === 'apps' && <Apps world={world} hidden={!ui.active} />}
        {ui.pane === 'add' && <Add world={world} hidden={!ui.active} />}
        {ui.pane === 'app' && <App key={ui.app.data.id} world={world} hidden={!ui.active} />}
        {ui.pane === 'script' && <Script key={ui.app.data.id} world={world} hidden={!ui.active} />}
        {ui.pane === 'nodes' && <Nodes key={ui.app.data.id} world={world} hidden={!ui.active} />}
        {ui.pane === 'meta' && <Meta key={ui.app.data.id} world={world} hidden={!ui.active} />}
      </div>
    </HintProvider>
  )
}

function Section({ active, top, bottom, children }) {
  return (
    <div
      className={cls('sidebar-section', { active, top, bottom })}
      css={css`
        background: rgba(11, 10, 21, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 2rem;
        padding: 0.6875rem 0;
        pointer-events: auto;
        position: relative;
        &.active {
          background: rgba(11, 10, 21, 0.9);
        }
      `}
    >
      {children}
    </div>
  )
}

function Btn({ disabled, suspended, active, children, ...props }) {
  return (
    <div
      className={cls('sidebar-btn', { disabled, suspended, active })}
      css={css`
        width: 2.75rem;
        height: 1.875rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        position: relative;
        .sidebar-btn-dot {
          display: none;
          position: absolute;
          top: 0.8rem;
          right: 0.2rem;
          width: 0.3rem;
          height: 0.3rem;
          border-radius: 0.15rem;
          background: white;
        }
        &:hover {
          cursor: pointer;
          color: white;
        }
        &.active {
          color: white;
          .sidebar-btn-dot {
            display: block;
          }
        }
        &.suspended {
          .sidebar-btn-dot {
            display: block;
            /* background: rgb(26, 151, 241); */
          }
        }
        &.disabled {
          color: rgba(255, 255, 255, 0.3);
        }
      `}
      {...props}
    >
      {children}
      <div className='sidebar-btn-dot' />
    </div>
  )
}

function Content({ width = '20rem', hidden, children }) {
  return (
    <div
      className={cls('sidebar-content', { hidden })}
      css={css`
        width: ${width};
        pointer-events: auto;
        .sidebar-content-main {
          background: rgba(11, 10, 21, 0.85);
          border: 0.0625rem solid #2a2b39;
          backdrop-filter: blur(5px);
          border-radius: 1rem;
          display: flex;
          align-items: stretch;
        }
        &.hidden {
          opacity: 0;
          pointer-events: none;
        }
      `}
    >
      <div className='sidebar-content-main'>{children}</div>
      <Hint />
    </div>
  )
}

function Pane({ width = '20rem', hidden, children }) {
  return (
    <div
      className={cls('sidebarpane', { hidden })}
      css={css`
        width: ${width};
        max-width: 100%;
        display: flex;
        flex-direction: column;
        .sidebarpane-content {
          pointer-events: auto;
          max-height: 100%;
          display: flex;
          flex-direction: column;
        }
        &.hidden {
          opacity: 0;
          pointer-events: none;
        }
      `}
    >
      <div className='sidebarpane-content'>{children}</div>
      <Hint />
    </div>
  )
}

function Hint() {
  const { hint } = useContext(HintContext)
  if (!hint) return null
  return (
    <div
      className='hint'
      css={css`
        margin-top: 0.25rem;
        background: rgba(11, 10, 21, 0.85);
        border: 0.0625rem solid #2a2b39;
        backdrop-filter: blur(5px);
        border-radius: 1rem;
        min-width: 0;
        padding: 1rem;
        font-size: 0.9375rem;
      `}
    >
      <span>{hint}</span>
    </div>
  )
}

function Group({ label }) {
  return (
    <>
      <div
        css={css`
          height: 0.0625rem;
          background: rgba(255, 255, 255, 0.05);
          margin: 0.6rem 0;
        `}
      />
      {label && (
        <div
          css={css`
            font-weight: 500;
            line-height: 1;
            padding: 0.75rem 0 0.75rem 1rem;
            margin-top: -0.6rem;
          `}
        >
          {label}
        </div>
      )}
    </>
  )
}

const shadowOptions = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Med', value: 'med' },
  { label: 'High', value: 'high' },
]
function Prefs({ world, hidden }) {
  const player = world.entities.player
  const { isAdmin, isBuilder } = usePermissions(world)
  const [name, setName] = useState(() => player.data.name)
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [ao, setAO] = useState(world.prefs.ao)
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
  const [ui, setUI] = useState(world.prefs.ui)
  const [canFullscreen, isFullscreen, toggleFullscreen] = useFullscreen()
  const [actions, setActions] = useState(world.prefs.actions)
  const [stats, setStats] = useState(world.prefs.stats)
  const changeName = name => {
    if (!name) return setName(player.data.name)
    player.setName(name)
  }
  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr) => {
      options.push({
        // label: `${Math.round(width * dpr)} x ${Math.round(height * dpr)}`,
        label,
        value: dpr,
      })
    }
    add('0.5x', 0.5)
    add('1x', 1)
    if (dpr >= 2) add('2x', 2)
    if (dpr >= 3) add('3x', dpr)
    return options
  }, [])
  useEffect(() => {
    const onPrefsChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
      if (changes.ui) setUI(changes.ui.value)
      if (changes.actions) setActions(changes.actions.value)
      if (changes.stats) setStats(changes.stats.value)
    }
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
    }
  }, [])
  return (
    <Pane hidden={hidden}>
      <div
        className='prefs noscrollbar'
        css={css`
          overflow-y: auto;
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          padding: 0.6rem 0;
        `}
      >
        <FieldText label='Name' hint='Change your name' value={name} onChange={changeName} />
        <Group label='Interface' />
        <FieldRange
          label='Scale'
          hint='Change the scale of the user interface'
          min={0.5}
          max={1.5}
          step={0.1}
          value={ui}
          onChange={ui => world.prefs.setUI(ui)}
        />
        <FieldToggle
          label='Fullscreen'
          hint='Toggle fullscreen. Not supported in some browsers'
          value={isFullscreen}
          onChange={value => toggleFullscreen(value)}
          trueLabel='Enabled'
          falseLabel='Disabled'
        />
        {isBuilder && (
          <FieldToggle
            label='Build Prompts'
            hint='Show or hide action prompts when in build mode'
            value={actions}
            onChange={actions => world.prefs.setActions(actions)}
            trueLabel='Visible'
            falseLabel='Hidden'
          />
        )}
        <FieldToggle
          label='Stats'
          hint='Show or hide performance stats'
          value={world.prefs.stats}
          onChange={stats => world.prefs.setStats(stats)}
          trueLabel='Visible'
          falseLabel='Hidden'
        />
        {!isTouch && (
          <FieldBtn
            label='Hide Interface'
            note='Z'
            hint='Hide the user interface. Press Z to re-enable.'
            onClick={() => world.ui.toggleVisible()}
          />
        )}
        <Group label='Graphics' />
        <FieldSwitch
          label='Resolution'
          hint='Change your display resolution'
          options={dprOptions}
          value={dpr}
          onChange={dpr => world.prefs.setDPR(dpr)}
        />
        <FieldSwitch
          label='Shadows'
          hint='Change the quality of shadows in the world'
          options={shadowOptions}
          value={shadows}
          onChange={shadows => world.prefs.setShadows(shadows)}
        />
        <FieldToggle
          label='Post-processing'
          hint='Enable or disable all postprocessing effects'
          trueLabel='On'
          falseLabel='Off'
          value={postprocessing}
          onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
        />
        <FieldToggle
          label='Bloom'
          hint='Enable or disable the bloom effect'
          trueLabel='On'
          falseLabel='Off'
          value={bloom}
          onChange={bloom => world.prefs.setBloom(bloom)}
        />
        {world.settings.ao && (
          <FieldToggle
            label='Ambient Occlusion'
            hint='Enable or disable the ambient occlusion effect'
            trueLabel='On'
            falseLabel='Off'
            value={ao}
            onChange={ao => world.prefs.setAO(ao)}
          />
        )}
        <Group label='Audio' />
        <FieldRange
          label='Music'
          hint='Adjust general music volume'
          min={0}
          max={2}
          step={0.05}
          value={music}
          onChange={music => world.prefs.setMusic(music)}
        />
        <FieldRange
          label='SFX'
          hint='Adjust sound effects volume'
          min={0}
          max={2}
          step={0.05}
          value={sfx}
          onChange={sfx => world.prefs.setSFX(sfx)}
        />
        <FieldRange
          label='Voice'
          hint='Adjust global voice chat volume'
          min={0}
          max={2}
          step={0.05}
          value={voice}
          onChange={voice => world.prefs.setVoice(voice)}
        />
      </div>
    </Pane>
  )
}

function World({ world, hidden }) {
  const player = world.entities.player
  const { isAdmin } = usePermissions(world)
  const [title, setTitle] = useState(world.settings.title)
  const [desc, setDesc] = useState(world.settings.desc)
  const [image, setImage] = useState(world.settings.image)
  const [avatar, setAvatar] = useState(world.settings.avatar)
  const [playerLimit, setPlayerLimit] = useState(world.settings.playerLimit)
  const [ao, setAO] = useState(world.settings.ao)
  const [publicc, setPublic] = useState(world.settings.public)
  useEffect(() => {
    const onChange = changes => {
      if (changes.title) setTitle(changes.title.value)
      if (changes.desc) setDesc(changes.desc.value)
      if (changes.image) setImage(changes.image.value)
      if (changes.avatar) setAvatar(changes.avatar.value)
      if (changes.playerLimit) setPlayerLimit(changes.playerLimit.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.public) setPublic(changes.public.value)
    }
    world.settings.on('change', onChange)
    return () => {
      world.settings.off('change', onChange)
    }
  }, [])
  return (
    <Pane hidden={hidden}>
      <div
        className='world'
        css={css`
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          display: flex;
          flex-direction: column;
          min-height: 12rem;
          .world-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          .world-title {
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
          .world-content {
            flex: 1;
            padding: 0.5rem 0;
            overflow-y: auto;
          }
        `}
      >
        <div className='world-head'>
          <div className='world-title'>World</div>
        </div>
        <div className='world-content noscrollbar'>
          <FieldText
            label='Title'
            hint='Change the title of this world. Shown in the browser tab and when sharing links'
            placeholder='World'
            value={title}
            onChange={value => world.settings.set('title', value, true)}
          />
          <FieldText
            label='Description'
            hint='Change the description of this world. Shown in previews when sharing links to this world'
            value={desc}
            onChange={value => world.settings.set('desc', value, true)}
          />
          <FieldFile
            label='Image'
            hint='Change the image of the world. This is shown when loading into or sharing links to this world.'
            kind='image'
            value={image}
            onChange={value => world.settings.set('image', value, true)}
            world={world}
          />
          <FieldFile
            label='Avatar'
            hint='Change the default avatar everyone spawns into the world with'
            kind='avatar'
            value={avatar}
            onChange={value => world.settings.set('avatar', value, true)}
            world={world}
          />
          <FieldNumber
            label='Player Limit'
            hint='Set a maximum number of players that can be in the world at one time. Zero means unlimited.'
            value={playerLimit}
            onChange={value => world.settings.set('playerLimit', value, true)}
          />
          <FieldToggle
            label='Ambient Occlusion'
            hint={`Improves visuals by approximating darkened corners etc. When enabled, users also have an option to disable this on their device for performance.`}
            trueLabel='On'
            falseLabel='Off'
            value={ao}
            onChange={value => world.settings.set('ao', value, true)}
          />
          {isAdmin && (
            <FieldToggle
              label='Free Build'
              hint='Allow everyone to build (and destroy) things in the world. When disabled only admins can build.'
              trueLabel='On'
              falseLabel='Off'
              value={publicc}
              onChange={value => world.settings.set('public', value, true)}
            />
          )}
          {/* <FieldBtn
          label='Set Spawn'
          hint='Sets the location players spawn to the location you are currently standing'
          onClick={() => {
            world.network.send('spawnModified', 'set')
          }}
        /> */}
          {/* <FieldBtn
          label='Clear Spawn'
          hint='Resets the spawn point to origin'
          onClick={() => {
            world.network.send('spawnModified', 'clear')
          }}
        /> */}
        </div>
      </div>
    </Pane>
  )
}

const appsState = {
  query: '',
  perf: false,
  scrollTop: 0,
}
function Apps({ world, hidden }) {
  const contentRef = useRef()
  const [query, setQuery] = useState(appsState.query)
  const [perf, setPerf] = useState(appsState.perf)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    contentRef.current.scrollTop = appsState.scrollTop
  }, [])
  useEffect(() => {
    appsState.query = query
    appsState.perf = perf
  }, [query, perf])
  return (
    <Pane width={perf ? '40rem' : '20rem'} hidden={hidden}>
      <div
        className='apps'
        css={css`
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 17rem;
          .apps-head {
            height: 3.125rem;
            padding: 0 0.6rem 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          .apps-title {
            flex: 1;
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
          .apps-search {
            display: flex;
            align-items: center;
            input {
              margin-left: 0.5rem;
              width: 5rem;
              font-size: 0.9375rem;
              &::placeholder {
                color: #5d6077;
              }
              &::selection {
                background-color: white;
                color: rgba(0, 0, 0, 0.8);
              }
            }
          }
          .apps-toggle {
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 0 0 1rem;
            color: #5d6077;
            &:hover {
              cursor: pointer;
            }
            &.active {
              color: white;
            }
          }
          .apps-content {
            flex: 1;
            overflow-y: auto;
          }
        `}
      >
        <div className='apps-head'>
          <div className='apps-title'>Apps</div>
          <label className='apps-search'>
            <SearchIcon size='1.125rem' />
            <input type='text' placeholder='Search' value={query} onChange={e => setQuery(e.target.value)} />
          </label>
          <div className={cls('apps-toggle', { active: perf })} onClick={() => setPerf(!perf)}>
            <RocketIcon size='1.125rem' />
          </div>
        </div>
        <div
          ref={contentRef}
          className='apps-content noscrollbar'
          onScroll={e => {
            appsState.scrollTop = contentRef.current.scrollTop
          }}
        >
          <AppsList world={world} query={query} perf={perf} refresh={refresh} setRefresh={setRefresh} />
        </div>
      </div>
    </Pane>
  )
}

function Add({ world, hidden }) {
  const [selectedCollection, setSelectedCollection] = useState('default')
  const [show3DPreview, setShow3DPreview] = useState(false)
  const collections = useMemo(() => world.collections.getAll(), [world.collections])
  const collection = useMemo(() => world.collections.get(selectedCollection), [selectedCollection, world.collections])
  const span = 4
  const gap = '0.5rem'
  
  const add = blueprint => {
    blueprint = cloneDeep(blueprint)
    blueprint.id = uuid()
    blueprint.version = 0
    world.blueprints.add(blueprint, true)
    const transform = world.builder.getSpawnTransform(true)
    world.builder.toggle(true)
    world.builder.control.pointer.lock()
    setTimeout(() => {
      const data = {
        id: uuid(),
        type: 'app',
        blueprint: blueprint.id,
        position: transform.position,
        quaternion: transform.quaternion,
        scale: [1, 1, 1],
        mover: world.network.id,
        uploader: null,
        pinned: false,
        state: {},
      }
      const app = world.entities.add(data, true)
      world.builder.select(app)
    }, 100)
  }
  
  return (
    <Pane hidden={hidden}>
      <div
        className='add'
        css={css`
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          display: flex;
          flex-direction: column;
          min-height: 17rem;
          .add-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .add-title {
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
            flex-shrink: 0;
          }
          .add-controls {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
            min-width: 0;
          }
          .preview-toggle {
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s ease;
            color: rgba(255, 255, 255, 0.7);
            flex-shrink: 0;
          }
          .preview-toggle:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }
          .preview-toggle.active {
            background: rgba(0, 255, 170, 0.2);
            border-color: rgba(0, 255, 170, 0.5);
            color: #00ffaa;
          }
          .collection-tabs {
            display: flex;
            gap: 0.25rem;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
            -ms-overflow-style: none;
            &::-webkit-scrollbar {
              display: none;
            }
            flex: 1;
            min-width: 0;
            padding-right: 0.5rem;
          }
          .collection-tab {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.375rem;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .collection-tab:hover {
            background: rgba(255, 255, 255, 0.1);
          }
          .collection-tab.active {
            background: rgba(0, 255, 170, 0.2);
            border-color: rgba(0, 255, 170, 0.5);
            color: #00ffaa;
          }
          .add-content {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
          }
          .add-items {
            display: flex;
            align-items: stretch;
            flex-wrap: wrap;
            gap: ${gap};
          }
          .add-item {
            flex-basis: calc((100% / ${span}) - (${gap} * (${span} - 1) / ${span}));
            cursor: pointer;
            transition: transform 0.2s ease;
          }
          .add-item:hover {
            transform: translateY(-2px);
          }
          .add-item-image {
            width: 100%;
            aspect-ratio: 1;
            background-color: #1c1d22;
            background-size: cover;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 0.7rem;
            margin: 0 0 0.4rem;
          }
          .add-item-name {
            text-align: center;
            font-size: 0.875rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
            margin-top: 0.2rem;
            transition: color 0.2s ease;
          }
          .add-item:hover .add-item-name {
            color: rgba(255, 255, 255, 1);
          }
        `}
      >
        <div className='add-head'>
          <div className='add-title'>Add</div>
          <div className='add-controls'>
            <button
              className={`preview-toggle ${show3DPreview ? 'active' : ''}`}
              onClick={() => setShow3DPreview(!show3DPreview)}
              title={show3DPreview ? 'Show 2D images' : 'Show 3D previews'}
            >
              <BoxIcon size='1rem' />
            </button>
            {collections.length > 1 && (
              <div className='collection-tabs'>
                {collections.map(col => (
                  <button 
                    key={col.id}
                    className={`collection-tab ${selectedCollection === col.id ? 'active' : ''}`}
                    onClick={() => setSelectedCollection(col.id)}
                    title={col.description || col.name}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className='add-content noscrollbar'>
          <div className='add-items' key={`collection-${selectedCollection}-${collection?.blueprints?.length || 0}`}>
            {collection && collection.blueprints && collection.blueprints.map((blueprint, index) => {
              // Debug: log blueprint structure
              if (show3DPreview && index === 0) {
                console.log('🔍 First blueprint structure:', {
                  name: blueprint.name,
                  id: blueprint.id,
                  model: blueprint.model,
                  hasModel: !!blueprint.model
                })
              }
              
              return (
                <div className='add-item' key={`${selectedCollection}-${index}-${blueprint.name}`} onClick={() => add(blueprint)}>
                  <div
                    className='add-item-image'
                    css={css`
                      background-image: ${show3DPreview ? 'none' : `url(${world.resolveURL(blueprint.image?.url)})`};
                      position: relative;
                      transition: all 0.2s ease;
                      ${show3DPreview ? `
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                      ` : ''}
                    `}
                  >
                    {show3DPreview && (
                      <Blueprint3DPreview 
                        key={`preview-${blueprint.id}`}
                        blueprint={blueprint} 
                        world={world}
                      />
                    )}
                  </div>
                  <div className='add-item-name'>{blueprint.name}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Pane>
  )
}

// 3D Preview Component for Blueprints
// Track active previews with conservative limits
let activePreviewCount = 0
const MAX_ACTIVE_PREVIEWS = 6 // Very conservative limit
let previewCounter = 0

function Blueprint3DPreview({ blueprint, world }) {
  const containerRef = useRef()
  const sceneRef = useRef()
  const rendererRef = useRef()
  const cameraRef = useRef()
  const modelRef = useRef()
  const animationRef = useRef()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!containerRef.current || !blueprint.model) return

    // Create Three.js scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1c1d22)
    sceneRef.current = scene

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(0, 0, 4) // Move camera back a bit more
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Check if we're at the limit of active previews
    if (activePreviewCount >= MAX_ACTIVE_PREVIEWS) {
      console.warn('⚠️ Too many active 3D previews, skipping:', blueprint.name)
      return
    }

    // Increment active preview count
    activePreviewCount++
    console.log(`📊 Active previews: ${activePreviewCount}/${MAX_ACTIVE_PREVIEWS}`)

    // Create renderer with proper context management
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false
    })
    renderer.setSize(100, 100)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0) // Transparent background
    renderer.shadowMap.enabled = false // Disable shadows for preview
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

            // Load model using the same approach as App entity
        const loadModel = async () => {
          setIsLoading(true)
          
          // Add a timeout to prevent hanging loads
          const loadTimeout = setTimeout(() => {
            console.warn('⏰ Load timeout for blueprint:', blueprint.name)
            setIsLoading(false)
          }, 10000) // 10 second timeout
          
          try {
            console.log('🔍 Loading 3D preview for:', blueprint.name)

            // Use the exact same loading approach as App.js
            const type = blueprint.model.endsWith('vrm') ? 'avatar' : 'model'

            let modelData = world.loader.get(type, blueprint.model)
            if (!modelData) {
              try {
                modelData = await world.loader.load(type, blueprint.model)
              } catch (error) {
                console.warn('⚠️ Failed to load model data:', error.message || error)
                setIsLoading(false)
                return
              }
            }

            // Validate modelData structure
            if (!modelData || typeof modelData !== 'object') {
              console.warn('❌ Invalid model data structure for blueprint:', blueprint.name)
              setIsLoading(false)
              return
            }

            if (!modelData) {
              console.warn('❌ Failed to load model data for blueprint:', blueprint.name)
              setIsLoading(false)
              return
            }

            console.log('✅ Model data loaded:', modelData)

            // Try to access the original GLB data directly
            console.log('🔍 Model data type:', typeof modelData)
            console.log('🔍 Model data properties:', Object.keys(modelData))
            
            // Check if we can access the original GLB scene
            if (modelData.scene) {
              console.log('🎯 Found GLB scene, creating meshes directly from scene')
              
              const group = new THREE.Group()
              let meshCount = 0
              
              // Traverse the GLB scene directly
              const traverseGLBScene = (object3d) => {
                try {
                  if (!object3d || typeof object3d !== 'object') {
                    console.warn('⚠️ Invalid object in GLB scene traversal')
                    return
                  }
                  
                  if (object3d.type === 'Mesh') {
                    console.log('🔧 Found GLB mesh:', object3d.name)
                    
                    try {
                      // Validate mesh before cloning
                      if (!object3d.geometry || !object3d.material) {
                        console.warn('⚠️ Invalid mesh structure:', object3d.name)
                        return
                      }
                      
                      // Clone the mesh directly from the GLB scene
                      const mesh = object3d.clone()
                      group.add(mesh)
                      meshCount++
                      console.log('✅ Successfully created mesh from GLB scene:', object3d.name)
                    } catch (error) {
                      console.warn('⚠️ Failed to create mesh from GLB scene:', object3d.name, error)
                    }
                  }
                  
                  // Recursively traverse children with error handling
                  if (object3d.children && Array.isArray(object3d.children)) {
                    object3d.children.forEach(child => {
                      try {
                        traverseGLBScene(child)
                      } catch (error) {
                        console.warn('⚠️ Error traversing GLB child:', error)
                      }
                    })
                  }
                } catch (error) {
                  console.warn('⚠️ Error in GLB scene traversal:', error)
                }
              }
              
              traverseGLBScene(modelData.scene)
              console.log('📊 Total GLB meshes found:', meshCount)
              
              if (meshCount > 0) {
                // Center and scale the group
                const box = new THREE.Box3().setFromObject(group)
                const center = box.getCenter(new THREE.Vector3())
                const size = box.getSize(new THREE.Vector3())
                const maxDim = Math.max(size.x, size.y, size.z)
                const scale = 1.5 / maxDim
                
                console.log('📏 Model bounds:', { center, size, maxDim, scale })
                
                group.position.sub(center)
                group.scale.setScalar(scale)
                
                scene.add(group)
                modelRef.current = group
                console.log('🎉 Model added to scene successfully from GLB!')
                return // Exit early since we found meshes
              } else {
                console.warn('❌ No meshes found in GLB scene')
              }
            }
            
            // Use the model node directly like the normal loading process
            console.log('🎯 Using model node directly like normal loading process')
            
            if (modelData.toNodes && typeof modelData.toNodes === 'function') {
              let modelNode
              try {
                modelNode = modelData.toNodes()
                console.log('🎯 Model node created:', modelNode)
                
                if (!modelNode || typeof modelNode !== 'object') {
                  console.warn('❌ Invalid model node created for blueprint:', blueprint.name)
                  setIsLoading(false)
                  return
                }
              } catch (error) {
                console.warn('❌ Failed to create model node for blueprint:', blueprint.name, error)
                setIsLoading(false)
                return
              }
              
              let stageInsertCount = 0
              
              // Create a minimal context that mimics the normal loading process
              // but doesn't add to the actual world stage or load scripts
              const previewContext = {
                world: {
                  ...world,
                  stage: {
                    scene: scene, // Use our preview scene instead of world stage
                    add: (mesh) => {
                      // Don't actually add to world stage, just track for our preview
                      console.log('🔧 Preview stage add called for:', mesh.name || 'unnamed mesh')
                    },
                                                                insert: (options) => {
          // Handle stage.insert calls by creating meshes directly
          stageInsertCount++
          console.log(`🔧 Preview stage insert called #${stageInsertCount}:`, options)
          
          // Validate options structure
          if (!options || typeof options !== 'object') {
            console.warn('⚠️ Invalid options passed to stage.insert')
            return { material: null, move: () => {}, destroy: () => {} }
          }
          
          console.log('🔧 Node details:', {
            id: options.node?.id,
            name: options.node?.name,
            type: options.node?.type,
            hasGeometry: !!options.geometry,
            hasMaterial: !!options.material,
            geometryType: options.geometry?.type,
            materialType: options.material?.type
          })
          const { geometry, material, matrix, node } = options
                    
                    if (geometry && material) {
                      try {
                        // Validate geometry and material before creating mesh
                        if (!geometry.isBufferGeometry && !geometry.isGeometry) {
                          console.warn('⚠️ Invalid geometry type:', geometry?.type || 'unknown')
                          return { material: material, move: () => {}, destroy: () => {} }
                        }
                        
                        if (!material.isMaterial) {
                          console.warn('⚠️ Invalid material type:', material?.type || 'unknown')
                          return { material: material, move: () => {}, destroy: () => {} }
                        }
                        
                        const mesh = new THREE.Mesh(geometry, material)
                        
                        // Validate matrix before using it
                        if (matrix && matrix.isMatrix4) {
                          mesh.matrixWorld.copy(matrix)
                          mesh.matrixAutoUpdate = true  // Enable for rotation
                          mesh.matrixWorldAutoUpdate = true  // Enable for rotation
                          
                          // Extract position from the matrix to ensure proper positioning
                          const position = new THREE.Vector3()
                          const quaternion = new THREE.Quaternion()
                          const scale = new THREE.Vector3()
                          matrix.decompose(position, quaternion, scale)
                          
                          mesh.position.copy(position)
                          mesh.quaternion.copy(quaternion)
                          mesh.scale.copy(scale)
                          
                          console.log(`📍 Mesh ${mesh.name} positioned at:`, position, 'scale:', scale)
                        } else {
                          console.warn('⚠️ Invalid matrix, using default position')
                          mesh.position.set(0, 0, 0)
                          mesh.matrixAutoUpdate = true
                          mesh.matrixWorldAutoUpdate = true
                        }
                        
                        mesh.visible = true
                        mesh.name = node?.id || 'unknown-mesh'
                        
                        // Add to our preview group instead of world stage
                        if (!modelRef.current) {
                          modelRef.current = new THREE.Group()
                          modelRef.current.matrixAutoUpdate = true
                          modelRef.current.matrixWorldAutoUpdate = true
                          modelRef.current.visible = true
                          scene.add(modelRef.current)
                          console.log('🎯 Created new model group')
                        }
                        modelRef.current.add(mesh)
                        console.log('✅ Successfully created mesh from stage.insert:', mesh.name, 'geometry:', geometry.type, 'material:', material.type)
                        console.log('🔍 Mesh position:', mesh.position, 'visible:', mesh.visible, 'matrixAutoUpdate:', mesh.matrixAutoUpdate)
                      } catch (error) {
                        console.warn('⚠️ Failed to create mesh from stage.insert:', error.message || error)
                        // Don't let this crash the entire preview
                      }
                    } else {
                      console.warn('⚠️ Missing geometry or material for mesh:', node?.id || 'unknown')
                    }
                    
                    // Return a mock handle
                    return {
                      material: material,
                      move: () => {},
                      destroy: () => {}
                    }
                  }
                  },
                  loader: world.loader,
                  resolveURL: world.resolveURL,
                  setupMaterial: (material) => {
                    // Handle material setup if needed
                    console.log('🔧 Material setup called for:', material.type)
                  }
                },
                entity: null, // No entity for preview
                moving: false
              }
              
              // Activate the model node with our preview context
              // This will create the meshes using the normal loading process
              console.log('🔧 Activating model node with preview context')
              try {
                modelNode.activate(previewContext)
              } catch (error) {
                console.warn('⚠️ Failed to activate model node:', error.message || error)
                // Continue with fallback or show error state
                setIsLoading(false)
                return
              }

              // Debug: Log the entire model node hierarchy
              console.log('🔍 Full model node hierarchy:')
              const logNodeHierarchy = (node, depth = 0) => {
                const indent = '  '.repeat(depth)
                console.log(`${indent}${node.name || 'unnamed'} (${node.type || 'unknown'}) - children: ${node.children?.length || 0}`)
                if (node.children) {
                  node.children.forEach(child => logNodeHierarchy(child, depth + 1))
                }
              }
              logNodeHierarchy(modelNode)
              
              console.log(`📊 Stage insert calls received: ${stageInsertCount}`)
              
              // Check if we got any meshes
              if (modelRef.current && modelRef.current.children.length > 0) {
                console.log('📊 Total meshes created:', modelRef.current.children.length)
                console.log('🔍 Model group children:', modelRef.current.children.map(child => ({
                  name: child.name,
                  type: child.type,
                  position: child.position,
                  visible: child.visible,
                  geometry: child.geometry?.type || 'none',
                  material: child.material?.type || 'none'
                })))
                
                // Debug scene contents
                console.log('🎭 Scene children count:', scene.children.length)
                scene.children.forEach((child, index) => {
                  console.log(`🎭 Scene child ${index}:`, {
                    name: child.name,
                    type: child.type,
                    children: child.children?.length || 0,
                    visible: child.visible
                  })
                })
                console.log('🎯 Model ref set successfully:', modelRef.current)
                console.log('🔄 Initial rotation:', modelRef.current.rotation)
                
                            // Center and scale the group using bounding box
            // First, ensure all children are visible and included in the calculation
            let lodNodeCount = 0
            
            // Recursive function to find and process ALL meshes (for preview, show everything)
            const processAllMeshes = (node) => {
              try {
                // Validate node structure
                if (!node || typeof node !== 'object') {
                  return
                }
                
                // Check multiple ways a node might be a mesh
                const isMesh = node.type === 'Mesh' || 
                              (node.geometry && node.material) ||
                              (node._geometry && node._material) ||
                              (node.mesh && node.mesh.geometry && node.mesh.material)
                
                if (isMesh) {
                  node.visible = true
                  node.matrixAutoUpdate = true
                  node.matrixWorldAutoUpdate = true
                }
                
                // If this is an LOD node, make ALL its children visible (for preview)
                if (node.name && node.name.toLowerCase().includes('lod')) {
                  lodNodeCount++
                  
                  // For preview, show ALL LOD children (not just the first one)
                  if (node.children && Array.isArray(node.children)) {
                    node.children.forEach((lodChild, index) => {
                      try {
                        const isLodChildMesh = lodChild.type === 'Mesh' || 
                                              (lodChild.geometry && lodChild.material) ||
                                              (lodChild._geometry && lodChild._material) ||
                                              (lodChild.mesh && lodChild.mesh.geometry && lodChild.mesh.material)
                        
                        if (isLodChildMesh) {
                          lodChild.visible = true
                          lodChild.matrixAutoUpdate = true
                          lodChild.matrixWorldAutoUpdate = true
                        }
                      } catch (error) {
                        console.warn('⚠️ Error processing LOD child:', error)
                      }
                    })
                  }
                }
                
                // Recursively process all children
                if (node.children && Array.isArray(node.children)) {
                  node.children.forEach(child => {
                    try {
                      processAllMeshes(child)
                    } catch (error) {
                      console.warn('⚠️ Error processing child in processAllMeshes:', error)
                    }
                  })
                }
              } catch (error) {
                console.warn('⚠️ Error in processAllMeshes:', error)
              }
            }
            
            // Process the entire model hierarchy
            modelRef.current.traverse(child => {
              if (child.type === 'Mesh') {
                child.visible = true
                child.matrixAutoUpdate = true
                child.matrixWorldAutoUpdate = true
              }
            })
            
            // Now find and process ALL meshes recursively
            processAllMeshes(modelRef.current)
            console.log(`📊 Total LOD nodes found: ${lodNodeCount}`)
            
            // Don't center the group - let individual meshes keep their positions
            // The meshes are already positioned correctly from their matrices
            console.log('🎯 Keeping individual mesh positions (not centering group)')
                
                // Calculate bounding box including all visible meshes
                const box = new THREE.Box3()
                let meshCount = 0
                let lodNodesInBounds = 0
                
                // Recursive function to include ALL meshes in bounding box (for preview)
                const includeAllMeshesInBounds = (node) => {
                  try {
                    // Validate node structure
                    if (!node || typeof node !== 'object') {
                      return
                    }
                    
                    // Check multiple ways a node might be a mesh
                    const isMesh = node.type === 'Mesh' || 
                                  (node.geometry && node.material) ||
                                  (node._geometry && node._material) ||
                                  (node.mesh && node.mesh.geometry && node.mesh.material)
                    
                    // If this is a mesh, include it in bounds
                    if (isMesh && node.visible) {
                      try {
                        box.expandByObject(node)
                        meshCount++
                        console.log(`🔍 Including mesh in bounds:`, node.name || 'unnamed', 'position:', node.position, 'type:', node.type)
                      } catch (error) {
                        console.warn('⚠️ Error expanding bounds for mesh:', node.name || 'unnamed', error)
                      }
                    }
                    
                    // If this is an LOD node, include ALL its children in bounds
                    if (node.name && node.name.toLowerCase().includes('lod')) {
                      lodNodesInBounds++
                      console.log(`🎯 Found LOD node ${lodNodesInBounds}:`, node.name, 'children:', node.children?.length || 0)
                      
                      // Include ALL LOD children in bounds
                      if (node.children && Array.isArray(node.children)) {
                        node.children.forEach((lodChild, index) => {
                          try {
                            const isLodChildMesh = lodChild.type === 'Mesh' || 
                                                  (lodChild.geometry && lodChild.material) ||
                                                  (lodChild._geometry && lodChild._material) ||
                                                  (lodChild.mesh && lodChild.mesh.geometry && lodChild.mesh.material)
                            
                            if (isLodChildMesh) {
                              lodChild.visible = true
                              lodChild.matrixAutoUpdate = true
                              lodChild.matrixWorldAutoUpdate = true
                              box.expandByObject(lodChild)
                              meshCount++
                              console.log(`🔍 Including LOD ${lodNodesInBounds} child ${index + 1} mesh:`, lodChild.name || 'unnamed', 'position:', lodChild.position, 'type:', lodChild.type)
                            }
                          } catch (error) {
                            console.warn('⚠️ Error processing LOD child in bounds:', error)
                          }
                        })
                      }
                    }
                    
                    // Recursively process all children
                    if (node.children && Array.isArray(node.children)) {
                      node.children.forEach(child => {
                        try {
                          includeAllMeshesInBounds(child)
                        } catch (error) {
                          console.warn('⚠️ Error processing child in includeAllMeshesInBounds:', error)
                        }
                      })
                    }
                  } catch (error) {
                    console.warn('⚠️ Error in includeAllMeshesInBounds:', error)
                  }
                }
                
                // First include all regular meshes
                modelRef.current.traverse(child => {
                  try {
                    // Check multiple ways a node might be a mesh
                    const isMesh = child.type === 'Mesh' || 
                                  (child.geometry && child.material) ||
                                  (child._geometry && child._material) ||
                                  (child.mesh && child.mesh.geometry && child.mesh.material)
                    
                    if (isMesh && child.visible) {
                      try {
                        box.expandByObject(child)
                        meshCount++
                        console.log('🔍 Including mesh in bounds:', child.name || 'unnamed', 'position:', child.position, 'type:', child.type)
                      } catch (error) {
                        console.warn('⚠️ Error expanding bounds for traversed mesh:', child.name || 'unnamed', error)
                      }
                    }
                  } catch (error) {
                    console.warn('⚠️ Error in traverse:', error)
                  }
                })
                
                // Now include ALL meshes recursively
                includeAllMeshesInBounds(modelRef.current)
                console.log(`📊 Total meshes included in bounds: ${meshCount} (from ${lodNodesInBounds} LOD nodes)`)
                
                const size = box.getSize(new THREE.Vector3())
                const maxDim = Math.max(size.x, size.y, size.z)
                const scale = 1.5 / maxDim
                
                console.log('📏 Model bounds:', { 
                  min: box.min, 
                  max: box.max, 
                  size, 
                  maxDim, 
                  scale 
                })
                
                            // Scale the model to fit in the preview, but don't center it
            // This preserves the relative positions of all meshes
            modelRef.current.scale.setScalar(scale)
            console.log('🎯 Scaled model to fit preview, preserved mesh positions')
                
                // Ensure matrix updates are enabled for rotation
                modelRef.current.matrixAutoUpdate = true
                modelRef.current.matrixWorldAutoUpdate = true
                
                console.log('🎯 Model positioned at:', modelRef.current.position)
                console.log('📐 Model scale:', modelRef.current.scale)
                console.log('📍 Bounding box info:', { 
                  min: box.min, 
                  max: box.max, 
                  size: size,
                  scale: scale 
                })
                console.log('🔄 Matrix auto update enabled:', modelRef.current.matrixAutoUpdate)
                
                            console.log('🎉 Model added to scene successfully using normal loading process!')
                

                
            setIsLoading(false)
          } else {
                console.warn('❌ No meshes created from normal loading process')
                
                // Fallback to manual traversal if activation didn't create meshes
                console.log('⚠️ Falling back to manual node traversal')
                
                const group = new THREE.Group()
                let meshCount = 0
                
                const traverseNodes = (node) => {
                  try {
                    // Validate node structure
                    if (!node || typeof node !== 'object') {
                      console.warn('⚠️ Invalid node in fallback traversal')
                      return
                    }
                    
                    if (meshCount < 3) {
                      console.log('🔍 Traversing node:', {
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        hasGeometry: !!node.geometry,
                        hasMaterial: !!node.material,
                        materialType: node.material?.type || 'none',
                        geometryType: node.geometry?.type || 'none',
                        geometryConstructor: node.geometry?.constructor?.name || 'none',
                        materialConstructor: node.material?.constructor?.name || 'none',
                        geometryKeys: node.geometry ? Object.keys(node.geometry).slice(0, 10) : [],
                        materialKeys: node.material ? Object.keys(node.material).slice(0, 10) : [],
                        childrenCount: node.children?.length || 0
                      })
                    }
                  } catch (error) {
                    console.warn('⚠️ Error logging node details:', error)
                  }
                  
                  // Check if the node has a mounted mesh (this is what gets created when nodes are mounted)
                  if (node.mesh && node.mesh.geometry && node.mesh.material) {
                    if (meshCount < 3) {
                      console.log('🔧 Found mounted mesh node:', node.id, 'name:', node.name, 'type:', node.type)
                    }
                    
                    try {
                      // Use the mounted mesh directly
                      const mesh = node.mesh.clone()
                      mesh.position.copy(node.position)
                      mesh.quaternion.copy(node.quaternion)
                      mesh.scale.copy(node.scale)
                      
                      group.add(mesh)
                      meshCount++
                      console.log('✅ Successfully created mesh from mounted mesh for node:', node.id)
                    } catch (error) {
                      console.warn('⚠️ Failed to create mesh from mounted mesh for node:', node.id, error)
                    }
                  } else {
                    // Check for geometry and material properties
                    const geometry = node.geometry || node._geometry || node.mesh?.geometry
                    const material = node.material || node._material || node.mesh?.material
                    
                    if (geometry && material) {
                      if (meshCount < 3) {
                        console.log('🔧 Found mesh node:', node.id, 'name:', node.name, 'type:', node.type)
                      }
                      
                      try {
                        // Clone geometry and material to ensure they're proper Three.js objects
                        let clonedGeometry = geometry
                        let clonedMaterial = material
                        
                        // Clone geometry if it's a valid Three.js geometry
                        if (clonedGeometry && (clonedGeometry.isBufferGeometry || clonedGeometry.isGeometry)) {
                          clonedGeometry = clonedGeometry.clone()
                        } else {
                          console.warn('⚠️ Invalid geometry for node:', node.id)
                          return
                        }
                        
                        // Clone material if it's a valid Three.js material
                        if (clonedMaterial && clonedMaterial.isMaterial) {
                          clonedMaterial = clonedMaterial.clone()
                        } else {
                          console.warn('⚠️ Invalid material for node:', node.id, 'creating default material')
                          clonedMaterial = new THREE.MeshStandardMaterial({ 
                            color: 0x888888,
                            roughness: 0.8,
                            metalness: 0.2
                          })
                        }
                        
                        // Create a Three.js mesh from the cloned data
                        try {
                          // Validate geometry and material before creating mesh
                          if (!clonedGeometry.isBufferGeometry && !clonedGeometry.isGeometry) {
                            console.warn('⚠️ Invalid geometry type in fallback:', clonedGeometry?.type || 'unknown')
                            return
                          }
                          
                          if (!clonedMaterial.isMaterial) {
                            console.warn('⚠️ Invalid material type in fallback:', clonedMaterial?.type || 'unknown')
                            return
                          }
                          
                          const mesh = new THREE.Mesh(clonedGeometry, clonedMaterial)
                          mesh.position.copy(node.position)
                          mesh.quaternion.copy(node.quaternion)
                          mesh.scale.copy(node.scale)
                          mesh.visible = true
                          mesh.name = node.id || 'fallback-mesh'
                          
                          group.add(mesh)
                          meshCount++
                          console.log('✅ Successfully created mesh for node:', node.id, 'geometry:', clonedGeometry.type, 'material:', clonedMaterial.type)
                          console.log('🔍 Fallback mesh position:', mesh.position, 'visible:', mesh.visible, 'matrixAutoUpdate:', mesh.matrixAutoUpdate)
                        } catch (error) {
                          console.warn('⚠️ Failed to create mesh for node:', node.id, error.message || error)
                        }
                      } catch (error) {
                        console.warn('⚠️ Failed to process mesh node:', node.id, error.message || error)
                      }
                    } else if ((node.geometry || node._geometry || node.mesh?.geometry) && !(node.material || node._material || node.mesh?.material)) {
                      // Found geometry but no material - create a default material
                      if (meshCount < 3) {
                        console.log('🔧 Found geometry-only node:', node.id, 'name:', node.name, 'type:', node.type)
                      }
                      
                      try {
                        // Clone geometry if it's a valid Three.js geometry
                        let clonedGeometry = node.geometry || node._geometry || node.mesh?.geometry
                        if (clonedGeometry && (clonedGeometry.isBufferGeometry || clonedGeometry.isGeometry)) {
                          clonedGeometry = clonedGeometry.clone()
                        } else {
                          console.warn('⚠️ Invalid geometry for node:', node.id)
                          return
                        }
                        
                        // Create a default material
                        const defaultMaterial = new THREE.MeshStandardMaterial({ 
                          color: 0x888888,
                          roughness: 0.8,
                          metalness: 0.2
                        })
                        
                        // Create a Three.js mesh from the geometry with default material
                        const mesh = new THREE.Mesh(clonedGeometry, defaultMaterial)
                        mesh.position.copy(node.position)
                        mesh.quaternion.copy(node.quaternion)
                        mesh.scale.copy(node.scale)
                        
                        group.add(mesh)
                        meshCount++
                        console.log('✅ Successfully created mesh for geometry-only node:', node.id)
                      } catch (error) {
                        console.warn('⚠️ Failed to create mesh for geometry-only node:', node.id, error)
                      }
                    }
                  }
                  
                  // Recursively traverse children
                  if (node.children && Array.isArray(node.children)) {
                    node.children.forEach(child => {
                      try {
                        traverseNodes(child)
                      } catch (error) {
                        console.warn('⚠️ Error traversing fallback child:', error)
                      }
                    })
                  }
                }
                
                traverseNodes(modelNode)
                console.log('📊 Total meshes found in fallback:', meshCount)
                
                if (meshCount > 0) {
                  // Center and scale the group using bounding box
                  // First, ensure all children are visible and included in the calculation
                  let fallbackLodNodeCount = 0
                  
                  // Recursive function to find and process ALL meshes (for preview, show everything)
                  const processFallbackAllMeshes = (node) => {
                    try {
                      // Validate node structure
                      if (!node || typeof node !== 'object') {
                        console.warn('⚠️ Invalid node in processFallbackAllMeshes')
                        return
                      }
                      
                      // If this is a mesh, make it visible
                      if (node.type === 'Mesh') {
                        node.visible = true
                        node.matrixAutoUpdate = true
                        node.matrixWorldAutoUpdate = true
                        console.log(`🔧 Made fallback mesh visible:`, node.name || 'unnamed')
                      }
                      
                      // If this is an LOD node, make ALL its children visible (for preview)
                      if (node.name && node.name.toLowerCase().includes('lod')) {
                        fallbackLodNodeCount++
                        console.log(`🎯 Found fallback LOD node ${fallbackLodNodeCount}:`, node.name, 'children:', node.children?.length || 0)
                        
                        // For preview, show ALL LOD children (not just the first one)
                        if (node.children && Array.isArray(node.children)) {
                          node.children.forEach((lodChild, index) => {
                            try {
                              if (lodChild.type === 'Mesh') {
                                lodChild.visible = true
                                lodChild.matrixAutoUpdate = true
                                lodChild.matrixWorldAutoUpdate = true
                                console.log(`🔧 Made fallback LOD ${fallbackLodNodeCount} child ${index + 1} visible:`, lodChild.name || 'unnamed')
                              }
                            } catch (error) {
                              console.warn('⚠️ Error processing LOD child:', error)
                            }
                          })
                        }
                      }
                      
                      // Recursively process all children
                      if (node.children && Array.isArray(node.children)) {
                        node.children.forEach(child => {
                          try {
                            processFallbackAllMeshes(child)
                          } catch (error) {
                            console.warn('⚠️ Error processing fallback child:', error)
                          }
                        })
                      }
                    } catch (error) {
                      console.warn('⚠️ Error in processFallbackAllMeshes:', error)
                    }
                  }
                  
                  // Process the entire group hierarchy
                  group.traverse(child => {
                    if (child.type === 'Mesh') {
                      child.visible = true
                      child.matrixAutoUpdate = true
                      child.matrixWorldAutoUpdate = true
                    }
                  })
                  
                  // Now find and process ALL meshes recursively
                  processFallbackAllMeshes(group)
                  console.log(`📊 Total fallback LOD nodes found: ${fallbackLodNodeCount}`)
                  
                  // Calculate bounding box including all visible meshes
                  const box = new THREE.Box3()
                  let fallbackMeshCount = 0
                  let fallbackLodNodesInBounds = 0
                  
                  // Recursive function to include ALL meshes in bounding box (for preview)
                  const includeFallbackAllMeshesInBounds = (node) => {
                    try {
                      // Validate node structure
                      if (!node || typeof node !== 'object') {
                        console.warn('⚠️ Invalid node in includeFallbackAllMeshesInBounds')
                        return
                      }
                      
                      // If this is a mesh, include it in bounds
                      if (node.type === 'Mesh' && node.visible) {
                        try {
                          box.expandByObject(node)
                          fallbackMeshCount++
                          console.log(`🔍 Including fallback mesh in bounds:`, node.name || 'unnamed', 'position:', node.position)
                        } catch (error) {
                          console.warn('⚠️ Error expanding bounds for fallback mesh:', node.name || 'unnamed', error)
                        }
                      }
                      
                      // If this is an LOD node, include ALL its children in bounds
                      if (node.name && node.name.toLowerCase().includes('lod')) {
                        fallbackLodNodesInBounds++
                        console.log(`🎯 Found fallback LOD node ${fallbackLodNodesInBounds}:`, node.name, 'children:', node.children?.length || 0)
                        
                        // Include ALL LOD children in bounds
                        if (node.children && Array.isArray(node.children)) {
                          node.children.forEach((lodChild, index) => {
                            try {
                              if (lodChild.type === 'Mesh') {
                                lodChild.visible = true
                                lodChild.matrixAutoUpdate = true
                                lodChild.matrixWorldAutoUpdate = true
                                box.expandByObject(lodChild)
                                fallbackMeshCount++
                                console.log(`🔍 Including fallback LOD ${fallbackLodNodesInBounds} child ${index + 1} mesh:`, lodChild.name || 'unnamed', 'position:', lodChild.position)
                              }
                            } catch (error) {
                              console.warn('⚠️ Error processing LOD child in fallback bounds:', error)
                            }
                          })
                        }
                      }
                      
                      // Recursively process all children
                      if (node.children && Array.isArray(node.children)) {
                        node.children.forEach(child => {
                          try {
                            includeFallbackAllMeshesInBounds(child)
                          } catch (error) {
                            console.warn('⚠️ Error processing fallback child in bounds:', error)
                          }
                        })
                      }
                    } catch (error) {
                      console.warn('⚠️ Error in includeFallbackAllMeshesInBounds:', error)
                    }
                  }
                  
                  // First include all regular meshes
                  group.traverse(child => {
                    if (child.type === 'Mesh' && child.visible) {
                      box.expandByObject(child)
                      fallbackMeshCount++
                      console.log('🔍 Including fallback mesh in bounds:', child.name || 'unnamed', 'position:', child.position)
                    }
                  })
                  
                  // Now include ALL meshes recursively
                  includeFallbackAllMeshesInBounds(group)
                  console.log(`📊 Total fallback meshes included in bounds: ${fallbackMeshCount} (from ${fallbackLodNodesInBounds} LOD nodes)`)
                  
                  const size = box.getSize(new THREE.Vector3())
                  const maxDim = Math.max(size.x, size.y, size.z)
                  const scale = 1.5 / maxDim
                  
                  console.log('📏 Fallback model bounds:', { 
                    min: box.min, 
                    max: box.max, 
                    size, 
                    maxDim, 
                    scale 
                  })
                  
                  // Center the model by offsetting its position based on bounding box
                  const offsetX = -(box.min.x + size.x / 2)
                  const offsetY = -(box.min.y + size.y / 2)
                  const offsetZ = -(box.min.z + size.z / 2)
                  
                  group.position.set(offsetX, offsetY, offsetZ)
                  group.scale.setScalar(scale)
                  
                  // Ensure matrix updates are enabled for rotation
                  group.matrixAutoUpdate = true
                  group.matrixWorldAutoUpdate = true
                  
                  console.log('🎯 Fallback model positioned at:', group.position)
                  console.log('📐 Fallback model scale:', group.scale)
                  console.log('📍 Fallback bounding box offset:', { offsetX, offsetY, offsetZ })
                  console.log('🔄 Fallback matrix auto update enabled:', group.matrixAutoUpdate)
                  
                  scene.add(group)
                  modelRef.current = group
                  console.log('🎉 Model added to scene successfully in fallback!')
                  console.log('🎯 Fallback model ref set:', modelRef.current)
                  console.log('🔄 Fallback initial rotation:', modelRef.current.rotation)
                  setIsLoading(false)
                } else {
                  console.warn('❌ No meshes found in fallback traversal')
                }
              }
            } else {
              console.warn('❌ Model data does not have toNodes method')
            }
          } catch (error) {
            console.error('💥 Failed to load 3D preview for blueprint:', blueprint.name, error)
            setIsLoading(false)
          } finally {
            clearTimeout(loadTimeout)
          }
        }

        loadModel()

                  // Animation loop
              let frameCount = 0
              const animate = () => {
                animationRef.current = requestAnimationFrame(animate)
                frameCount++

                if (modelRef.current) {
                  // Apply rotation to the model group
                  modelRef.current.rotation.y += 0.01 // Slightly faster rotation
                  
                  // Also try rotating individual meshes if they exist
                  if (modelRef.current.children && modelRef.current.children.length > 0) {
                    modelRef.current.children.forEach(child => {
                      if (child.type === 'Mesh') {
                        child.rotation.y += 0.01
                      }
                    })
                  }
                  
                  if (frameCount % 60 === 0) { // Log every 60 frames (about once per second)
                    console.log('🔄 Model rotation:', modelRef.current.rotation.y, 'Frame:', frameCount)
                    console.log('🔍 Model children count:', modelRef.current.children.length)
                    console.log('🔍 Model visible:', modelRef.current.visible)
                    console.log('🔍 Model matrix:', modelRef.current.matrix)
                  }
                } else {
                  if (frameCount % 60 === 0) {
                    console.log('⚠️ No model ref in animation loop, frame:', frameCount)
                  }
                }

                // Render the scene
                if (renderer && scene && camera) {
                  try {
                    renderer.render(scene, camera)
                  } catch (error) {
                    console.warn('⚠️ Render error:', error)
                  }
                }
              }
              
              // Start animation loop
              console.log('🎬 Starting animation loop for:', blueprint.name)
              animate()

    return () => {
      // Decrement active preview count
      activePreviewCount = Math.max(0, activePreviewCount - 1)
      
      // Cancel animation loop
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      
      // Clean up renderer and WebGL context
      if (rendererRef.current) {
        try {
          // Remove from DOM
          if (containerRef.current && rendererRef.current.domElement) {
            containerRef.current.removeChild(rendererRef.current.domElement)
          }
          
          // Dispose of renderer and WebGL context
          rendererRef.current.dispose()
          rendererRef.current = null
        } catch (error) {
          console.warn('⚠️ Error cleaning up renderer:', error)
        }
      }

      // Clean up scene and camera references
      sceneRef.current = null
      cameraRef.current = null
      modelRef.current = null
    }
  }, [blueprint.model, world])

  return (
    <div
      ref={containerRef}
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.1) 100%);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
      `}
    >
      {isLoading && (
        <div
          css={css`
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.75rem;
            text-align: center;
            font-weight: 500;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            pointer-events: none;
          `}
        >
          Loading...
        </div>
      )}
    </div>
  )
}

const extToType = {
  glb: 'model',
  vrm: 'avatar',
}
const allowedModels = ['glb', 'vrm']
let showTransforms = false

function App({ world, hidden }) {
  const { setHint } = useContext(HintContext)
  const app = world.ui.state.app
  const [pinned, setPinned] = useState(app.data.pinned)
  const [transforms, setTransforms] = useState(showTransforms)
  const [blueprint, setBlueprint] = useState(app.blueprint)
  useEffect(() => {
    showTransforms = transforms
  }, [transforms])
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
  const frozen = blueprint.frozen // TODO: disable code editor, model change, metadata editing, flag editing etc
  const download = async () => {
    try {
      const file = await exportApp(app.blueprint, world.loader.loadFile)
      downloadFile(file)
    } catch (err) {
      console.error(err)
    }
  }
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
  const toggleKey = async (key, value) => {
    value = isBoolean(value) ? value : !blueprint[key]
    if (blueprint[key] === value) return
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  const togglePinned = () => {
    const pinned = !app.data.pinned
    app.data.pinned = pinned
    world.network.send('entityModified', { id: app.data.id, pinned })
    setPinned(pinned)
  }
  return (
    <Pane hidden={hidden}>
      <div
        className='app'
        css={css`
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          display: flex;
          flex-direction: column;
          min-height: 1rem;
          .app-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          .app-title {
            flex: 1;
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }
          .app-btn {
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.8);
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
          .app-toggles {
            padding: 0.5rem 1.4rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .app-toggle {
            width: 2rem;
            height: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6f7289;
            &:hover:not(.disabled) {
              cursor: pointer;
            }
            &.active {
              color: white;
            }
            &.disabled {
              color: #434556;
            }
          }
          .app-transforms {
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .app-transforms-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.4rem;
            &:hover {
              cursor: pointer;
            }
          }
          .app-content {
            flex: 1;
            overflow-y: auto;
          }
        `}
      >
        <div className='app-head'>
          <div className='app-title'>{app.blueprint.name}</div>
          <div
            className='app-btn'
            onClick={download}
            onPointerEnter={() => setHint('Download this app')}
            onPointerLeave={() => setHint(null)}
          >
            <DownloadIcon size='1.125rem' />
          </div>
          {!frozen && (
            <AppModelBtn value={blueprint.model} onChange={changeModel}>
              <div
                className='app-btn'
                onPointerEnter={() => setHint('Change this apps base model')}
                onPointerLeave={() => setHint(null)}
              >
                <BoxIcon size='1.125rem' />
              </div>
            </AppModelBtn>
          )}
          {!blueprint.scene && (
            <div
              className='app-btn'
              onClick={() => {
                world.ui.setApp(null)
                app.destroy(true)
              }}
              onPointerEnter={() => setHint('Delete this app')}
              onPointerLeave={() => setHint(null)}
            >
              <Trash2Icon size='1.125rem' />
            </div>
          )}
        </div>
        {!blueprint.scene && (
          <div className='app-toggles'>
            <div
              className={cls('app-toggle', { active: blueprint.disabled })}
              onClick={() => toggleKey('disabled')}
              onPointerEnter={() => setHint('Disable this app so that it is no longer active in the world.')}
              onPointerLeave={() => setHint(null)}
            >
              <OctagonXIcon size='1.125rem' />
              {/* {blueprint.disabled ? <SquareIcon size='1.125rem' /> : <SquareCheckBigIcon size='1.125rem' />} */}
            </div>
            <div
              className={cls('app-toggle', { active: pinned })}
              onClick={() => togglePinned()}
              onPointerEnter={() => setHint("Pin this app so it can't accidentally be moved.")}
              onPointerLeave={() => setHint(null)}
            >
              <PinIcon size='1.125rem' />
            </div>
            <div
              className={cls('app-toggle', { active: blueprint.preload })}
              onClick={() => toggleKey('preload')}
              onPointerEnter={() => setHint('Preload this app before entering the world.')}
              onPointerLeave={() => setHint(null)}
            >
              <LoaderPinwheelIcon size='1.125rem' />
            </div>
            <div
              className={cls('app-toggle', { active: blueprint.unique })}
              onClick={() => toggleKey('unique')}
              onPointerEnter={() => setHint('Make this app unique so that new duplicates are not linked to this one.')}
              onPointerLeave={() => setHint(null)}
            >
              <SparkleIcon size='1.125rem' />
            </div>
          </div>
        )}
        <div className='app-content noscrollbar'>
          {!blueprint.scene && (
            <div className='app-transforms'>
              <div className='app-transforms-btn' onClick={() => setTransforms(!transforms)}>
                <ChevronsUpDownIcon size='1rem' />
              </div>
              {transforms && <AppTransformFields app={app} />}
            </div>
          )}
          <AppFields world={world} app={app} blueprint={blueprint} />
        </div>
      </div>
    </Pane>
  )
}

function AppTransformFields({ app }) {
  const [position, setPosition] = useState(app.root.position.toArray())
  const [rotation, setRotation] = useState(app.root.rotation.toArray().map(n => n * RAD2DEG))
  const [scale, setScale] = useState(app.root.scale.toArray())
  return (
    <>
      <FieldVec3
        label='Position'
        dp={1}
        step={0.1}
        bigStep={1}
        value={position}
        onChange={value => {
          console.log(value)
          setPosition(value)
          app.modify({ position: value })
          app.world.network.send('entityModified', {
            id: app.data.id,
            position: value,
          })
        }}
      />
      <FieldVec3
        label='Rotation'
        dp={1}
        step={1}
        bigStep={5}
        value={rotation}
        onChange={value => {
          setRotation(value)
          value = q1.setFromEuler(e1.fromArray(value.map(n => n * DEG2RAD))).toArray()
          app.modify({ quaternion: value })
          app.world.network.send('entityModified', {
            id: app.data.id,
            quaternion: value,
          })
        }}
      />
      <FieldVec3
        label='Scale'
        dp={1}
        step={0.1}
        bigStep={1}
        value={scale}
        onChange={value => {
          setScale(value)
          app.modify({ scale: value })
          app.world.network.send('entityModified', {
            id: app.data.id,
            scale: value,
          })
        }}
      />
    </>
  )
}

// todo: blueprint models need migrating to file object format so
// we can replace needing this and instead use MenuItemFile, but
// that will also somehow need to support both model and avatar kinds.
function AppModelBtn({ value, onChange, children }) {
  const [key, setKey] = useState(0)
  const handleDownload = e => {
    if (e.shiftKey) {
      e.preventDefault()
      const file = world.loader.getFile(value)
      if (!file) return
      downloadFile(file)
    }
  }
  const handleChange = e => {
    setKey(n => n + 1)
    onChange(e.target.files[0])
  }
  return (
    <label
      className='appmodelbtn'
      css={css`
        overflow: hidden;
        input {
          position: absolute;
          top: -9999px;
        }
      `}
      onClick={handleDownload}
    >
      <input key={key} type='file' accept='.glb,.vrm' onChange={handleChange} />
      {children}
    </label>
  )
}

function AppFields({ world, app, blueprint }) {
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
    <AppField key={field.key} world={world} props={props} field={field} value={props[field.key]} modify={modify} />
  ))
}

function AppField({ world, props, field, value, modify }) {
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
    return <Group label={field.label} />
  }
  if (field.type === 'text') {
    return (
      <FieldText
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
      <FieldTextarea label={field.label} hint={field.hint} value={value} onChange={value => modify(field.key, value)} />
    )
  }
  if (field.type === 'number') {
    return (
      <FieldNumber
        label={field.label}
        hint={field.hint}
        dp={field.dp}
        min={field.min}
        max={field.max}
        step={field.step}
        bigStep={field.bigStep}
        value={value}
        onChange={value => modify(field.key, value)}
      />
    )
  }
  if (field.type === 'file') {
    return (
      <FieldFile
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
      <FieldSwitch
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
      <FieldSwitch
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
      <FieldToggle
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
      <FieldRange
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
      <FieldCurve
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
    return <FieldBtn label={field.label} hint={field.hint} onClick={field.onClick} />
  }
  return null
}

function Script({ world, hidden }) {
  const app = world.ui.state.app
  const containerRef = useRef()
  const resizeRef = useRef()
  const [handle, setHandle] = useState(null)
  useEffect(() => {
    const elem = resizeRef.current
    const container = containerRef.current
    container.style.width = `${storage.get('code-editor-width', 500)}px`
    let active
    function onPointerDown(e) {
      active = true
      elem.addEventListener('pointermove', onPointerMove)
      elem.addEventListener('pointerup', onPointerUp)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    function onPointerMove(e) {
      let newWidth = container.offsetWidth + e.movementX
      if (newWidth < 250) newWidth = 250
      container.style.width = `${newWidth}px`
      storage.set('code-editor-width', newWidth)
    }
    function onPointerUp(e) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      elem.removeEventListener('pointermove', onPointerMove)
      elem.removeEventListener('pointerup', onPointerUp)
    }
    elem.addEventListener('pointerdown', onPointerDown)
    return () => {
      elem.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])
  return (
    <div
      ref={containerRef}
      className={cls('script', { hidden })}
      css={css`
        pointer-events: auto;
        align-self: stretch;
        background: rgba(11, 10, 21, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 1.375rem;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        min-height: 23.7rem;
        position: relative;
        .script-head {
          height: 3.125rem;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .script-title {
          flex: 1;
          font-weight: 500;
          font-size: 1rem;
          line-height: 1;
        }
        .script-btn {
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
          &:hover {
            cursor: pointer;
            color: white;
          }
        }
        .script-resizer {
          position: absolute;
          top: 0;
          bottom: 0;
          right: -5px;
          width: 10px;
          cursor: ew-resize;
        }
        &.hidden {
          opacity: 0;
          pointer-events: none;
        }
      `}
    >
      <div className='script-head'>
        <div className='script-title'>Script</div>
        <div className='script-btn' onClick={() => handle?.save()}>
          <SaveIcon size='1.125rem' />
        </div>
      </div>
      <ScriptEditor key={app.data.id} app={app} onHandle={setHandle} />
      <div className='script-resizer' ref={resizeRef} />
    </div>
  )
}

function Nodes({ world, hidden }) {
  const app = world.ui.state.app
  return (
    <Pane hidden={hidden}>
      <div
        className='nodes'
        css={css`
          flex: 1;
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          min-height: 23.7rem;
          display: flex;
          flex-direction: column;
          .nodes-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          .nodes-title {
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
        `}
      >
        <div className='nodes-head'>
          <div className='nodes-title'>Nodes</div>
        </div>
        <NodeHierarchy app={app} />
      </div>
    </Pane>
  )
}

function Meta({ world, hidden }) {
  const app = world.ui.state.app
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
  const set = async (key, value) => {
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, [key]: value })
    world.network.send('blueprintModified', { id: blueprint.id, version, [key]: value })
  }
  return (
    <Pane hidden={hidden}>
      <div
        className='meta'
        css={css`
          flex: 1;
          background: rgba(11, 10, 21, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.375rem;
          display: flex;
          flex-direction: column;
          min-height: 1rem;
          .meta-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          .meta-title {
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
          .meta-content {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem 0;
          }
        `}
      >
        <div className='meta-head'>
          <div className='meta-title'>Metadata</div>
        </div>
        <div className='meta-content noscrollbar'>
          <FieldText
            label='Name'
            hint='The name of this app'
            value={blueprint.name}
            onChange={value => set('name', value)}
          />
          <FieldFile
            label='Image'
            hint='An image/icon for this app'
            kind='texture'
            value={blueprint.image}
            onChange={value => set('image', value)}
            world={world}
          />
          <FieldText
            label='Author'
            hint='The name of the author that made this app'
            value={blueprint.author}
            onChange={value => set('author', value)}
          />
          <FieldText
            label='URL'
            hint='A url for this app'
            value={blueprint.url}
            onChange={value => set('url', value)}
          />
          <FieldTextarea
            label='Description'
            hint='A description for this app'
            value={blueprint.desc}
            onChange={value => set('desc', value)}
          />
        </div>
      </div>
    </Pane>
  )
}
