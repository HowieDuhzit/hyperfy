import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SettingsIcon, SunIcon, UserIcon, Volume2Icon, XIcon, KeyboardIcon } from 'lucide-react'
import styled from 'styled-components'
import { CONTROLLER_TYPE } from '../../core/extras/Gamepad'

import { usePane } from './usePane'
import { AvatarPreview } from '../AvatarPreview'
import { cls } from './cls'
import { hasRole } from '../../core/utils'
import { InputDropdown, InputNumber, InputRange, InputSwitch, InputText } from './Inputs'
import { useWorld } from '../hooks/useWorld'
import { codeToProp } from '../../core/extras/buttons'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: 20,
    height: '100%',
    overflow: 'auto',
    color: '#fff'
  },
  heading: {
    margin: 0,
    fontSize: 20,
    fontWeight: 500
  },
  sectionHeading: {
    margin: '0 0 10px 0',
    fontSize: 16,
    fontWeight: 500,
    color: '#888'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#1a1a1a',
    borderRadius: 4
  },
  button: {
    padding: '4px 8px',
    minWidth: 80,
    border: '1px solid #666',
    borderRadius: 4,
    background: 'transparent',
    color: '#fff',
    textAlign: 'center',
    cursor: 'pointer'
  },
  buttonHover: {
    background: '#333'
  },
  buttonListening: {
    background: '#444'
  },
  resetButton: {
    padding: '6px 12px',
    border: '1px solid #666',
    borderRadius: 4,
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  disabledRow: {
    opacity: 0.7
  },
  settingsPane: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: '100%',
    maxWidth: 350,
    background: 'rgba(22, 22, 28, 1)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    boxShadow: 'rgba(0, 0, 0, 0.5) 0px 10px 30px',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  paneHead: {
    height: 50,
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px 0 20px'
  },
  paneHeadTitle: {
    paddingLeft: 7,
    fontWeight: 500,
    flex: 1
  },
  paneHeadTabs: {
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'stretch'
  },
  paneHeadTab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '1px solid transparent',
    marginBottom: -1,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    margin: '0 0 0 16px',
    cursor: 'pointer'
  },
  paneHeadTabActive: {
    color: 'white',
    borderBottomColor: 'white'
  },
  paneHeadClose: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.5)',
    cursor: 'pointer'
  },
  paneContent: {
    flex: 1,
    padding: 20,
    overflowY: 'auto'
  },
  generalSection: {
    display: 'flex',
    alignItems: 'center',
    margin: '30px 0 20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
  },
  subTabs: {
    display: 'flex',
    gap: 10,
    marginBottom: 20
  },
  subTab: {
    padding: '6px 12px',
    border: '1px solid #666',
    borderRadius: 4,
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.5)',
    cursor: 'pointer'
  },
  subTabActive: {
    color: '#fff',
    background: '#333'
  }
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
  overflow: auto;
  color: #fff;
`

const Tabs = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`

const Tab = styled.div`
  padding: 6px 12px;
  border: 1px solid #666;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  ${props => props.active && `
    color: #fff;
    background: #333;
  `}
`

const Content = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`

const Section = styled.div`
  margin-bottom: 30px;
`

const SectionTitle = styled.h3`
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #fff;
`

const Setting = styled.div`
  margin-bottom: 10px;
`

const Label = styled.div`
  margin-right: 10px;
`

const Select = styled.select`
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: white;
  padding: 8px;
  width: 100%;
  margin-top: 4px;
  
  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.3);
  }
`

const Value = styled.div`
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
`

const Note = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-top: 8px;
  line-height: 1.4;
`

const CloseButton = styled.div`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  &:hover {
    color: white;
  }
`

export function SettingsPane({ world, player, close, gamepadManager }) {
  const paneRef = useRef()
  const headRef = useRef()
  usePane('settings', paneRef, headRef)
  const [tab, setTab] = useState('general')
  const [controllerType, setControllerType] = useState(gamepadManager?.controllerType || CONTROLLER_TYPE.GENERIC)
  const canBuild = useMemo(() => {
    return hasRole(player.data.roles, 'admin', 'builder')
  }, [player])

  useEffect(() => {
    const handleControllerType = (type) => {
      setControllerType(type)
    }
    
    if (gamepadManager) {
      gamepadManager.on('controllerType', handleControllerType)
      return () => {
        gamepadManager.off('controllerType', handleControllerType)
      }
    }
  }, [gamepadManager])

  const handleControllerTypeChange = (type) => {
    setControllerType(type)
    gamepadManager?.setControllerTypeOverride(type)
  }

  return (
    <Container ref={paneRef} className='spane' style={styles.settingsPane}>
      <div className='spane-head' ref={headRef} style={styles.paneHead}>
        <SettingsIcon size={16} />
        <div style={styles.paneHeadTitle}>Settings</div>
        <div style={styles.paneHeadTabs}>
          <div 
            style={{
              ...styles.paneHeadTab,
              ...(tab === 'general' ? styles.paneHeadTabActive : {})
            }}
            onClick={() => setTab('general')}
          >
            <span>General</span>
          </div>
          <div 
            style={{
              ...styles.paneHeadTab,
              ...(tab === 'binds' ? styles.paneHeadTabActive : {})
            }}
            onClick={() => setTab('binds')}
          >
            <span>Binds</span>
          </div>
          {canBuild && (
            <div 
              style={{
                ...styles.paneHeadTab,
                ...(tab === 'world' ? styles.paneHeadTabActive : {})
              }}
              onClick={() => setTab('world')}
            >
              <span>World</span>
            </div>
          )}
          <div 
            style={{
              ...styles.paneHeadTab,
              ...(tab === 'controller' ? styles.paneHeadTabActive : {})
            }}
            onClick={() => setTab('controller')}
          >
            <span>Controller</span>
          </div>
        </div>
        <div 
          style={{
            ...styles.paneHeadClose,
            '&:hover': { color: 'white' }
          }}
          onClick={close}
        >
          <XIcon size={20} />
        </div>
      </div>
      <div style={styles.paneContent}>
        {tab === 'general' && <GeneralSettings world={world} player={player} />}
        {tab === 'binds' && <KeybindSettings world={world} canBuild={canBuild} />}
        {tab === 'world' && <WorldSettings world={world} />}
        {tab === 'controller' && (
          <Section>
            <SectionTitle>Controller Settings</SectionTitle>
            
            <Setting>
              <Label>Controller Type</Label>
              <Select 
                value={controllerType} 
                onChange={(e) => handleControllerTypeChange(e.target.value)}
              >
                <option value={CONTROLLER_TYPE.GENERIC}>Auto-detect</option>
                <option value={CONTROLLER_TYPE.XBOX}>Xbox Controller</option>
                <option value={CONTROLLER_TYPE.PS4}>PlayStation 4 Controller</option>
                <option value={CONTROLLER_TYPE.PS5}>PlayStation 5 Controller</option>
                <option value={CONTROLLER_TYPE.SWITCH_PRO}>Nintendo Switch Pro Controller</option>
              </Select>
            </Setting>

            <Setting>
              <Label>Current Controller:</Label>
              <Value>
                {gamepadManager?.connected ? (
                  <>
                    {gamepadManager.gamepads.values().next().value?.id || 'Unknown'}
                    {controllerType !== CONTROLLER_TYPE.GENERIC && ' (Overridden)'}
                  </>
                ) : (
                  'No controller connected'
                )}
              </Value>
            </Setting>

            <Note>
              Select a specific controller type to override the auto-detection and use those button icons.
              This is useful if your controller is not being detected correctly.
            </Note>
          </Section>
        )}
      </div>
    </Container>
  )
}

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
function GeneralSettings({ world, player }) {
  const [name, setName] = useState(() => player.data.name)
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
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
  useEffect(() => {
    const onChange = changes => {
      // TODO: rename .dpr
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
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
      style={{
        padding: '20px 20px 10px',
        maxHeight: 500,
        overflowY: 'auto'
      }}
    >
      <div style={styles.generalSection}>
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
        <SunIcon size={16} />
        <span>Graphics</span>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Resolution</div>
        <div className='general-field-input'>
          <InputDropdown options={dprOptions} value={dpr} onChange={dpr => world.prefs.setDPR(dpr)} />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Shadows</div>
        <div className='general-field-input'>
          <InputSwitch options={shadowOptions} value={shadows} onChange={shadows => world.prefs.setShadows(shadows)} />
        </div>
      </div>
      <div className='general-field'>
        <div className='general-field-label'>Postprocessing</div>
        <div className='general-field-input'>
          <InputSwitch
            options={onOffOptions}
            value={postprocessing}
            onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
          />
        </div>
      </div>
      {postprocessing && (
        <div className='general-field'>
          <div className='general-field-label'>Bloom</div>
          <div className='general-field-input'>
            <InputSwitch options={onOffOptions} value={bloom} onChange={bloom => world.prefs.setBloom(bloom)} />
          </div>
        </div>
      )}
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

function KeybindSettings({ world, canBuild }) {
  const [subTab, setSubTab] = useState('play')
  const [keybinds, setKeybinds] = useState(world.prefs?.keybinds || {})
  const [listening, setListening] = useState(null)

  // Movement Controls
  const movementControls = {
    moveForward: 'Move Forward',
    moveBackward: 'Move Backward',
    moveLeft: 'Move Left',
    moveRight: 'Move Right',
    jump: 'Jump',
    sprint: 'Sprint',
    toggleBuildMode: 'Toggle Build Mode'
  }

  // Build Controls
  const buildControls = {
    buildRotateX: 'Rotate X',
    buildRotateY: 'Rotate Y',
    buildRotateZ: 'Rotate Z',
    buildScale: 'Scale',
    buildDuplicate: 'Duplicate',
    buildDelete: 'Delete',
    buildUndo: 'Undo',
    buildRedo: 'Redo',
    buildSnap: 'Toggle Snap',
    buildFocus: 'Focus Selected'
  }

  // Gamepad Controls
  const gamepadControls = {
    gamepadA: 'A Button',
    gamepadB: 'B Button',
    gamepadX: 'X Button',
    gamepadY: 'Y Button',
    gamepadL1: 'L1 Button',
    gamepadR1: 'R1 Button',
    gamepadL2: 'L2 Trigger',
    gamepadR2: 'R2 Trigger',
    gamepadSelect: 'Select Button',
    gamepadStart: 'Start Button',
    gamepadDpadUp: 'D-Pad Up',
    gamepadDpadDown: 'D-Pad Down',
    gamepadDpadLeft: 'D-Pad Left',
    gamepadDpadRight: 'D-Pad Right'
  }

  useEffect(() => {
    const handleKeyDown = e => {
      if (!listening) return
      e.preventDefault()
      
      if (e.code === 'Escape') {
        setListening(null)
        return
      }

      const newKeybinds = { ...keybinds }
      newKeybinds[listening] = codeToProp[e.code] || e.code.toLowerCase()
      setKeybinds(newKeybinds)
      world.prefs.setKeybinds(newKeybinds)
      setListening(null)
    }

    const handleGamepadInput = e => {
      if (!listening || !listening.startsWith('gamepad')) return
      e.preventDefault()
      
      // Get gamepad input
      const gamepad = navigator.getGamepads?.()?.[0]
      if (!gamepad) return

      // Check buttons
      for (let i = 0; i < gamepad.buttons.length; i++) {
        if (gamepad.buttons[i].pressed) {
          const newKeybinds = { ...keybinds }
          newKeybinds[listening] = `button${i}`
          setKeybinds(newKeybinds)
          world.prefs.setKeybinds(newKeybinds)
          setListening(null)
          return
        }
      }
    }

    if (listening) {
      if (listening.startsWith('gamepad')) {
        window.addEventListener('gamepadconnected', handleGamepadInput)
        const interval = setInterval(handleGamepadInput, 100)
        return () => {
          window.removeEventListener('gamepadconnected', handleGamepadInput)
          clearInterval(interval)
        }
      } else {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [listening, keybinds])

  const handleReset = () => {
    const defaultKeybinds = {
      // Play controls
      moveForward: 'keyW',
      moveBackward: 'keyS',
      moveLeft: 'keyA',
      moveRight: 'keyD',
      jump: 'space',
      sprint: 'shiftLeft',
      toggleBuildMode: 'tab',
      // Build controls
      buildRotateX: 'keyX',
      buildRotateY: 'keyY',
      buildRotateZ: 'keyZ',
      buildScale: 'keyR',
      buildDuplicate: 'keyD',
      buildDelete: 'backspace',
      buildUndo: 'keyZ',
      buildRedo: 'keyY',
      buildSnap: 'keyS',
      buildFocus: 'keyF',
      // Gamepad defaults
      gamepadA: 'button0',
      gamepadB: 'button1',
      gamepadX: 'button2',
      gamepadY: 'button3',
      gamepadL1: 'button4',
      gamepadR1: 'button5',
      gamepadL2: 'button6',
      gamepadR2: 'button7',
      gamepadSelect: 'button8',
      gamepadStart: 'button9',
      gamepadDpadUp: 'button12',
      gamepadDpadDown: 'button13',
      gamepadDpadLeft: 'button14',
      gamepadDpadRight: 'button15'
    }
    setKeybinds(defaultKeybinds)
    world.prefs.setKeybinds(defaultKeybinds)
  }

  const formatKeyName = key => {
    if (!key) return 'Not Set'
    if (key.startsWith('button')) {
      return `Button ${key.slice(6)}`
    }
    return key
      .replace('key', '')
      .replace('Left', ' Left')
      .replace('Right', ' Right')
      .replace('digit', '')
      .toUpperCase()
  }

  const renderKeybindButton = (action) => (
    <button
      onClick={() => setListening(action)}
      style={{
        ...styles.button,
        ...(listening === action ? styles.buttonListening : {}),
        minWidth: 100
      }}
    >
      {listening === action ? (
        action.startsWith('gamepad') ? 'Press Button...' : 'Press Key...'
      ) : formatKeyName(keybinds[action])}
    </button>
  )

  const renderControlsSection = (title, controls) => (
    <div style={{...styles.section, marginBottom: 30}}>
      <h3 style={{...styles.sectionHeading, fontSize: 18, color: '#fff', marginBottom: 15}}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {Object.entries(controls).map(([action, label]) => (
          <div key={action} style={{
            ...styles.row,
            padding: '10px 15px',
            background: '#1a1a1a',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span style={{marginRight: 10}}>{label}</span>
            {renderKeybindButton(action)}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{...styles.container, maxHeight: 600, overflowY: 'auto', padding: '0 5px'}}>
      <div style={{...styles.header, position: 'sticky', top: 0, background: 'rgba(22, 22, 28, 1)', padding: '20px 15px', zIndex: 1}}>
        <h2 style={styles.heading}>Controls</h2>
        <button onClick={handleReset} style={{...styles.resetButton, background: '#333'}}>
          Reset to Default
        </button>
      </div>

      <div style={{...styles.subTabs, padding: '0 15px', marginBottom: 25}}>
        <button
          style={{
            ...styles.subTab,
            ...(subTab === 'play' ? styles.subTabActive : {})
          }}
          onClick={() => setSubTab('play')}
        >
          Play Controls
        </button>
        {canBuild && (
          <button
            style={{
              ...styles.subTab,
              ...(subTab === 'build' ? styles.subTabActive : {})
            }}
            onClick={() => setSubTab('build')}
          >
            Build Controls
          </button>
        )}
      </div>

      <div style={{padding: '0 15px 20px'}}>
        {subTab === 'play' && (
          <>
            {renderControlsSection('Keyboard Controls', movementControls)}
            {renderControlsSection('Gamepad Controls', gamepadControls)}
          </>
        )}
        {subTab === 'build' && canBuild && renderControlsSection('Build Controls', buildControls)}
      </div>
    </div>
  )
}

function WorldSettings({ world }) {
  // ...
}
