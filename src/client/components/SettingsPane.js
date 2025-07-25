import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SettingsIcon, SunIcon, UserIcon, Volume2Icon, XIcon, MonitorIcon } from 'lucide-react'

import { usePane } from './usePane'
import { AvatarPreview } from '../AvatarPreview'
import { cls } from './cls'
import { hasRole } from '../../core/utils'
import { InputDropdown, InputNumber, InputRange, InputSwitch, InputText } from './Inputs'
import GraphicsSettingsPane from './GraphicsSettingsPane'

export function SettingsPane({ world, player, close }) {
  const paneRef = useRef()
  const headRef = useRef()
  usePane('settings', paneRef, headRef)
  const [tab, setTab] = useState('general')
  const [showAdvancedGraphics, setShowAdvancedGraphics] = useState(false)
  const canBuild = useMemo(() => {
    return hasRole(player.data.roles, 'admin', 'builder')
  }, [player])
  
  return (
    <>
      <div
        ref={paneRef}
        className='spane'
        css={css`
          position: absolute;
          top: 20px;
          left: 20px;
          width: 100%;
          max-width: 350px;
          background: rgba(22, 22, 28, 1);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
          pointer-events: auto;
          display: flex;
          flex-direction: column;
          .spane-head {
            height: 50px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            padding: 0 8px 0 20px;
            &-title {
              padding-left: 7px;
              font-weight: 500;
              flex: 1;
            }
            &-tabs {
              align-self: stretch;
              display: flex;
              align-items: stretch;
            }
            &-tab {
              display: flex;
              align-items: center;
              justify-content: center;
              border-bottom: 1px solid transparent;
              margin-bottom: -1px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 14px;
              margin: 0 0 0 16px;
              padding: 0 8px;
              &:hover:not(.active) {
                cursor: pointer;
                color: rgba(255, 255, 255, 0.7);
              }
              &.active {
                color: white;
                border-bottom-color: white;
              }
            }
            &-close {
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: rgba(255, 255, 255, 0.5);
              &:hover {
                cursor: pointer;
                color: white;
              }
            }
          }
          .spane-content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            max-height: 70vh;
          }
        `}
      >
        <div className='spane-head' ref={headRef}>
          <SettingsIcon size={16} />
          <div className='spane-head-title'>Settings</div>
          <div className='spane-head-tabs'>
            <div className={cls('spane-head-tab', { active: tab === 'general' })} onClick={() => setTab('general')}>
              <span>General</span>
            </div>
            <div className={cls('spane-head-tab', { active: tab === 'graphics' })} onClick={() => setTab('graphics')}>
              <span>Graphics</span>
            </div>
            {canBuild && (
              <div className={cls('spane-head-tab', { active: tab === 'world' })} onClick={() => setTab('world')}>
                <span>World</span>
              </div>
            )}
          </div>
          <div className='spane-head-close' onClick={close}>
            <XIcon size={20} />
          </div>
        </div>
        <div className='spane-content'>
          {tab === 'general' && <GeneralSettings world={world} player={player} />}
          {tab === 'graphics' && <GraphicsSettings world={world} onAdvancedClick={() => setShowAdvancedGraphics(true)} />}
          {tab === 'world' && <WorldSettings world={world} />}
        </div>
      </div>

      {/* Advanced Graphics Settings Modal */}
      {showAdvancedGraphics && (
        <GraphicsSettingsPane 
          world={world} 
          onClose={() => setShowAdvancedGraphics(false)} 
        />
      )}
    </>
  )
}

// New Graphics Settings Component for the tab
function GraphicsSettings({ world, onAdvancedClick }) {
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [ao, setAO] = useState(world.prefs.ao)

  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr) => {
      options.push({
        label: `${label} (${Math.round(width * dpr)} x ${Math.round(height * dpr)})`,
        value: dpr,
      })
    }
    add('Low', 0.5)
    add('High', 1)
    if (dpr >= 2) add('Ultra', 2)
    if (dpr >= 3) add('Insane', dpr)
    return options
  }, [])

  const shadowOptions = [
    { label: 'None', value: 'none' },
    { label: 'Low', value: 'low' },
    { label: 'Med', value: 'med' },
    { label: 'High', value: 'high' },
  ]
  
  const onOffOptions = [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ]

  useEffect(() => {
    world.prefs.dpr = dpr
  }, [dpr])
  useEffect(() => {
    world.prefs.shadows = shadows
  }, [shadows])
  useEffect(() => {
    world.prefs.postprocessing = postprocessing
  }, [postprocessing])
  useEffect(() => {
    world.prefs.bloom = bloom
  }, [bloom])
  useEffect(() => {
    world.prefs.ao = ao
  }, [ao])

  // Get current graphics stats for display
  const stats = world.graphics?.getGraphicsStats?.() || {}
  const currentFPS = stats.performance?.currentFPS || 0
  const frameTime = stats.performance?.lastFrameTime || 0
  const drawCalls = stats.renderer?.calls || 0

  return (
    <div css={css`
      .graphics-section {
        margin-bottom: 24px;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
      
      .performance-summary {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        
        .perf-title {
          color: #fff;
          font-weight: 600;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .perf-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          font-size: 12px;
        }
        
        .perf-stat {
          text-align: center;
          
          .stat-value {
            display: block;
            font-size: 18px;
            font-weight: bold;
            color: ${currentFPS > 55 ? '#4ade80' : currentFPS > 30 ? '#fb923c' : '#ef4444'};
            margin-bottom: 2px;
          }
          
          .stat-label {
            color: rgba(255, 255, 255, 0.7);
          }
        }
      }
      
      .advanced-button {
        width: 100%;
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        
        &:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.4);
          color: #93c5fd;
        }
      }
      
      .section-title {
        color: #fff;
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .setting-item {
        margin-bottom: 16px;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
    `}>
      {/* Performance Summary */}
      <div className="performance-summary">
        <div className="perf-title">
          <MonitorIcon size={16} />
          Performance
        </div>
        <div className="perf-stats">
          <div className="perf-stat">
            <span className="stat-value">{currentFPS.toFixed(0)}</span>
            <span className="stat-label">FPS</span>
          </div>
          <div className="perf-stat">
            <span className="stat-value">{frameTime.toFixed(1)}</span>
            <span className="stat-label">Frame Time (ms)</span>
          </div>
          <div className="perf-stat">
            <span className="stat-value">{drawCalls}</span>
            <span className="stat-label">Draw Calls</span>
          </div>
        </div>
      </div>

      {/* Basic Graphics Settings */}
      <div className="graphics-section">
        <div className="section-title">Quality Settings</div>
        
        <div className="setting-item">
          <InputDropdown
            label="Resolution"
            value={dpr}
            options={dprOptions}
            onChange={setDPR}
          />
        </div>

        <div className="setting-item">
          <InputDropdown
            label="Shadows"
            value={shadows}
            options={shadowOptions}
            onChange={setShadows}
          />
        </div>

        <div className="setting-item">
          <InputDropdown
            label="Post Processing"
            value={postprocessing}
            options={onOffOptions}
            onChange={setPostprocessing}
          />
        </div>

        <div className="setting-item">
          <InputDropdown
            label="Bloom"
            value={bloom}
            options={onOffOptions}
            onChange={setBloom}
          />
        </div>

        <div className="setting-item">
          <InputDropdown
            label="Ambient Occlusion"
            value={ao}
            options={onOffOptions}
            onChange={setAO}
          />
        </div>
      </div>

      {/* Advanced Settings Button */}
      <button className="advanced-button" onClick={onAdvancedClick}>
        <SettingsIcon size={16} />
        Advanced Graphics Settings
      </button>
    </div>
  )
}

function GeneralSettings({ world, player }) {
  const [name, setName] = useState(() => player.data.name)
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)

  useEffect(() => {
    const onChange = changes => {
      if (changes.name) setName(changes.name.value)
    }
    player.on('change', onChange)
    return () => {
      player.off('change', onChange)
    }
  }, [player])

  useEffect(() => {
    const onChange = changes => {
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  return (
    <div
      className='general noscrollbar'
      css={css`
        .general-section {
          display: flex;
          align-items: center;
          margin: 30px 0 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          svg {
            margin-right: 10px;
          }
          span {
            font-weight: 500;
            font-size: 14px;
          }
          &:first-child {
            margin-top: 0;
            padding-top: 0;
            border-top: 0;
          }
        }
        .general-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
          &-label {
            width: 120px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
          }
          &-input {
            flex: 1;
          }
        }
      `}
    >
      <div className='general-section'>
        <UserIcon size={16} />
        <span>Player</span>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Name</div>
        <div className='general-field-input'>
          <InputText
            value={name}
            onChange={name => {
              if (!name) {
                return setName(player.data.name)
              }
              player.modify({ name })
            }}
          />
        </div>
      </div>
      <div className='general-section'>
        <Volume2Icon size={16} />
        <span>Audio</span>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Music</div>
        <div className='general-field-input'>
          <InputRange
            value={music}
            onChange={volume => world.prefs.setMusic(volume)}
            min={0}
            max={2}
            step={0.05}
            instant
          />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>SFX</div>
        <div className='general-field-input'>
          <InputRange value={sfx} onChange={volume => world.prefs.setSFX(volume)} min={0} max={2} step={0.05} instant />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Voice</div>
        <div className='general-field-input'>
          <InputRange
            value={voice}
            onChange={volume => world.prefs.setVoice(volume)}
            min={0}
            max={2}
            step={0.05}
            instant
          />
        </div>
      </div>
    </div>
  )
}

function WorldSettings({ world }) {
  const [title, setTitle] = useState(() => world.settings.title)
  const [invite, setInvite] = useState(() => world.settings.invite)
  const [walkSpeed, setWalkSpeed] = useState(() => world.settings.walkSpeed)
  const [runSpeed, setRunSpeed] = useState(() => world.settings.runSpeed)
  const [jumpHeight, setJumpHeight] = useState(() => world.settings.jumpHeight)
  const [sun, setSun] = useState(() => world.settings.sun)
  const [ao, setAO] = useState(() => world.settings.ao)
  const [fog, setFog] = useState(() => world.settings.fog)
  const [wind, setWind] = useState(() => world.settings.wind)

  useEffect(() => {
    const onChange = changes => {
      if (changes.title) setTitle(changes.title.value)
      if (changes.invite) setInvite(changes.invite.value)
      if (changes.walkSpeed) setWalkSpeed(changes.walkSpeed.value)
      if (changes.runSpeed) setRunSpeed(changes.runSpeed.value)
      if (changes.jumpHeight) setJumpHeight(changes.jumpHeight.value)
      if (changes.sun) setSun(changes.sun.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.fog) setFog(changes.fog.value)
      if (changes.wind) setWind(changes.wind.value)
    }
    world.settings.on('change', onChange)
    return () => {
      world.settings.off('change', onChange)
    }
  }, [])

  const onOffOptions = [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ]

  return (
    <div
      className="world noscrollbar"
      css={css`
        .world-section {
          display: flex;
          align-items: center;
          margin: 30px 0 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          svg {
            margin-right: 10px;
          }
          span {
            font-weight: 500;
            font-size: 14px;
          }
          &:first-child {
            margin-top: 0;
            padding-top: 0;
            border-top: 0;
          }
        }
        .world-field {
          display: flex;
          align-items: center;
          margin: 0 0 10px;
          &-label {
            width: 120px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
          }
          &-input {
            flex: 1;
          }
        }
      `}
    >
      <div className="world-section">
        <SettingsIcon size={16} />
        <span>World</span>
      </div>
      <div className="world-field">
        <div className="world-field-label">Title</div>
        <div className="world-field-input">
          <InputText value={title} onChange={title => world.settings.setTitle(title)} />
        </div>
      </div>
      <div className="world-field">
        <div className="world-field-label">Invite</div>
        <div className="world-field-input">
          <InputSwitch options={onOffOptions} value={invite} onChange={invite => world.settings.setInvite(invite)} />
        </div>
      </div>
      <div className="world-section">
        <UserIcon size={16} />
        <span>Player</span>
      </div>
      <div className="world-field">
        <div className="world-field-label">Walk Speed</div>
        <div className="world-field-input">
          <InputNumber
            value={walkSpeed}
            onChange={walkSpeed => world.settings.setWalkSpeed(walkSpeed)}
            min={0.1}
            max={20}
            step={0.1}
          />
        </div>
      </div>
      <div className="world-field">
        <div className="world-field-label">Run Speed</div>
        <div className="world-field-input">
          <InputNumber
            value={runSpeed}
            onChange={runSpeed => world.settings.setRunSpeed(runSpeed)}
            min={0.1}
            max={20}
            step={0.1}
          />
        </div>
      </div>
      <div className="world-field">
        <div className="world-field-label">Jump Height</div>
        <div className="world-field-input">
          <InputNumber
            value={jumpHeight}
            onChange={jumpHeight => world.settings.setJumpHeight(jumpHeight)}
            min={0.1}
            max={20}
            step={0.1}
          />
        </div>
      </div>
      <div className="world-section">
        <SunIcon size={16} />
        <span>Environment</span>
      </div>
      <div className="world-field">
        <div className="world-field-label">Sun</div>
        <div className="world-field-input">
          <InputSwitch options={onOffOptions} value={sun} onChange={sun => world.settings.setSun(sun)} />
        </div>
      </div>
      <div className="world-field">
        <div className="world-field-label">AO</div>
        <div className="world-field-input">
          <InputSwitch options={onOffOptions} value={ao} onChange={ao => world.settings.setAO(ao)} />
        </div>
      </div>
      <div className="world-field">
        <div className="world-field-label">Fog</div>
        <div className="world-field-input">
          <InputSwitch options={onOffOptions} value={fog} onChange={fog => world.settings.setFog(fog)} />
        </div>
      </div>
      <div className="world-field">
        <div className="world-field-label">Wind</div>
        <div className="world-field-input">
          <InputSwitch options={onOffOptions} value={wind} onChange={wind => world.settings.setWind(wind)} />
        </div>
      </div>
    </div>
  )
}
