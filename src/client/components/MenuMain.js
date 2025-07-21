import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeftIcon,
  MonitorIcon,
  SunIcon,
  VolumeXIcon,
  CpuIcon,
  EyeIcon,
  ZapIcon,
  PaletteIcon,
  TrendingUpIcon,
  SettingsIcon,
  UserIcon,
  MenuIcon,
  LayoutGridIcon
} from 'lucide-react'
import { MenuItemBack, MenuItemBtn, MenuItemSwitch, MenuItemToggle, MenuItemText, MenuItemRange, Menu } from './Menu'
import { usePermissions } from './usePermissions'

// Enhanced option definitions for AAA graphics settings
const shadowOptions = [
  { label: 'Off', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'med' },
  { label: 'High', value: 'high' },
]

const rendererOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'WebGPU', value: 'webgpu' },
  { label: 'WebGL', value: 'webgl' },
]

const antialiasingOptions = [
  { label: 'Off', value: 'none' },
  { label: 'FXAA', value: 'fxaa' },
  { label: 'SMAA', value: 'smaa' },
  { label: 'TAA', value: 'taa' },
  { label: 'MSAA 2x', value: 'msaa2x' },
  { label: 'MSAA 4x', value: 'msaa4x' },
  { label: 'MSAA 8x', value: 'msaa8x' },
]

const textureQualityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Ultra', value: 'ultra' },
]

const anisotropicOptions = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
  { label: '8x', value: 8 },
  { label: '16x', value: 16 },
]

const frameRateLimitOptions = [
  { label: '30 FPS', value: '30' },
  { label: '60 FPS', value: '60' },
  { label: '120 FPS', value: '120' },
  { label: '144 FPS', value: '144' },
  { label: 'Unlimited', value: 'unlimited' },
]

const toneMappingOptions = [
  { label: 'None', value: 'none' },
  { label: 'Linear', value: 'linear' },
  { label: 'Reinhard', value: 'reinhard' },
  { label: 'Cineon', value: 'cineon' },
  { label: 'ACES Filmic', value: 'aces' },
]

function MenuMainIndex({ world, pop, push }) {
  const { isAdmin, isBuilder } = usePermissions(world)
  const player = world.entities.player
  const [name, setName] = useState(() => player.data.name)
  const changeName = name => {
    if (!name) return setName(player.data.name)
    player.modify({ name })
    world.network.send('entityModified', { id: player.data.id, name })
  }
  return (
    <Menu title='Menu'>
      <MenuItemText label='Name' hint='Change your display name' value={name} onChange={changeName} />
      <MenuItemBtn label='UI' hint='Change your interface settings' onClick={() => push('ui')} nav />
      <MenuItemBtn label='Display' hint='Screen and visual settings' onClick={() => push('display')} nav />
      <MenuItemBtn label='Graphics' hint='Rendering and quality settings' onClick={() => push('graphics')} nav />
      <MenuItemBtn label='Effects' hint='Post-processing effects' onClick={() => push('effects')} nav />
      <MenuItemBtn label='Performance' hint='Optimization settings' onClick={() => push('performance')} nav />
      <MenuItemBtn label='Audio' hint='Volume and sound settings' onClick={() => push('audio')} nav />
    </Menu>
  )
}

function MenuMainDisplay({ world, pop, push }) {
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [fieldOfView, setFieldOfView] = useState(world.prefs.fieldOfView)
  const [gamma, setGamma] = useState(world.prefs.gamma)
  const [brightness, setBrightness] = useState(world.prefs.brightness)
  const [contrast, setContrast] = useState(world.prefs.contrast)

  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr) => {
      options.push({
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
    const onChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.fieldOfView) setFieldOfView(changes.fieldOfView.value)
      if (changes.gamma) setGamma(changes.gamma.value)
      if (changes.brightness) setBrightness(changes.brightness.value)
      if (changes.contrast) setContrast(changes.contrast.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  return (
    <Menu title='Display'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemSwitch
        label='Resolution'
        hint='Change your display resolution scale'
        options={dprOptions}
        value={dpr}
        onChange={dpr => world.prefs.setDPR(dpr)}
      />
      <MenuItemRange
        label='Field of View'
        hint='Adjust your viewing angle (60-120°)'
        min={60}
        max={120}
        step={1}
        value={fieldOfView}
        onChange={fov => world.prefs.setFieldOfView(fov)}
      />
      <MenuItemRange
        label='Gamma'
        hint='Adjust brightness curve (1.8-2.6)'
        min={1.8}
        max={2.6}
        step={0.1}
        value={gamma}
        onChange={gamma => world.prefs.setGamma(gamma)}
      />
      <MenuItemRange
        label='Brightness'
        hint='Adjust overall image brightness'
        min={0.5}
        max={2.0}
        step={0.1}
        value={brightness}
        onChange={brightness => world.prefs.setBrightness(brightness)}
      />
      <MenuItemRange
        label='Contrast'
        hint='Adjust light/dark difference'
        min={0.5}
        max={2.0}
        step={0.1}
        value={contrast}
        onChange={contrast => world.prefs.setContrast(contrast)}
      />
    </Menu>
  )
}

function MenuMainGraphics({ world, pop, push }) {
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [renderer, setRenderer] = useState(world.prefs.renderer)
  const [antialiasing, setAntialiasing] = useState(world.prefs.antialiasing)
  const [textureQuality, setTextureQuality] = useState(world.prefs.textureQuality)
  const [anisotropicFiltering, setAnisotropicFiltering] = useState(world.prefs.anisotropicFiltering)
  const [lodDistance, setLODDistance] = useState(world.prefs.lodDistance)
  const [toneMappingMode, setToneMappingMode] = useState(world.prefs.toneMappingMode)
  const [toneMappingExposure, setToneMappingExposure] = useState(world.prefs.toneMappingExposure)

  useEffect(() => {
    const onChange = changes => {
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.renderer) setRenderer(changes.renderer.value)
      if (changes.antialiasing) setAntialiasing(changes.antialiasing.value)
      if (changes.textureQuality) setTextureQuality(changes.textureQuality.value)
      if (changes.anisotropicFiltering) setAnisotropicFiltering(changes.anisotropicFiltering.value)
      if (changes.lodDistance) setLODDistance(changes.lodDistance.value)
      if (changes.toneMappingMode) setToneMappingMode(changes.toneMappingMode.value)
      if (changes.toneMappingExposure) setToneMappingExposure(changes.toneMappingExposure.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  return (
    <Menu title='Graphics'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemSwitch
        label='Renderer'
        hint='Choose graphics API backend'
        options={rendererOptions}
        value={renderer}
        onChange={newRenderer => world.prefs.setRenderer(newRenderer)}
      />
      <MenuItemSwitch
        label='Shadows'
        hint='Shadow quality setting'
        options={shadowOptions}
        value={shadows}
        onChange={shadows => world.prefs.setShadows(shadows)}
      />
      <MenuItemSwitch
        label='Anti-Aliasing'
        hint='Edge smoothing quality'
        options={antialiasingOptions}
        value={antialiasing}
        onChange={aa => world.prefs.setAntialiasing(aa)}
      />
      <MenuItemSwitch
        label='Texture Quality'
        hint='Texture resolution setting'
        options={textureQualityOptions}
        value={textureQuality}
        onChange={quality => world.prefs.setTextureQuality(quality)}
      />
      <MenuItemSwitch
        label='Anisotropic Filtering'
        hint='Texture sharpness at distance'
        options={anisotropicOptions}
        value={anisotropicFiltering}
        onChange={af => world.prefs.setAnisotropicFiltering(af)}
      />
      <MenuItemRange
        label='LOD Distance'
        hint='Level of detail distance multiplier'
        min={0.5}
        max={2.0}
        step={0.1}
        value={lodDistance}
        onChange={lod => world.prefs.setLODDistance(lod)}
      />
      <MenuItemSwitch
        label='Tone Mapping'
        hint='Color and brightness mapping'
        options={toneMappingOptions}
        value={toneMappingMode}
        onChange={mode => world.prefs.setToneMappingMode(mode)}
      />
      <MenuItemRange
        label='Exposure'
        hint='Scene brightness adjustment'
        min={0.1}
        max={3.0}
        step={0.1}
        value={toneMappingExposure}
        onChange={exposure => world.prefs.setToneMappingExposure(exposure)}
      />
    </Menu>
  )
}

function MenuMainEffects({ world, pop, push }) {
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [ao, setAO] = useState(world.prefs.ao)
  const [depthOfField, setDepthOfField] = useState(world.prefs.depthOfField)
  const [motionBlur, setMotionBlur] = useState(world.prefs.motionBlur)
  const [ssReflections, setSSReflections] = useState(world.prefs.ssReflections)
  const [volumetricLighting, setVolumetricLighting] = useState(world.prefs.volumetricLighting)

  useEffect(() => {
    const onChange = changes => {
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.depthOfField) setDepthOfField(changes.depthOfField.value)
      if (changes.motionBlur) setMotionBlur(changes.motionBlur.value)
      if (changes.ssReflections) setSSReflections(changes.ssReflections.value)
      if (changes.volumetricLighting) setVolumetricLighting(changes.volumetricLighting.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  return (
    <Menu title='Effects'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemToggle
        label='Post-Processing'
        hint='Enable or disable all effects'
        trueLabel='On'
        falseLabel='Off'
        value={postprocessing}
        onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
      />
      {postprocessing && (
        <>
          <MenuItemToggle
            label='Bloom'
            hint='Bright object glow effect'
            trueLabel='On'
            falseLabel='Off'
            value={bloom}
            onChange={bloom => world.prefs.setBloom(bloom)}
          />
          {world.settings.ao && (
            <MenuItemToggle
              label='Ambient Occlusion'
              hint='Realistic corner shadows'
              trueLabel='On'
              falseLabel='Off'
              value={ao}
              onChange={ao => world.prefs.setAO(ao)}
            />
          )}
          <MenuItemToggle
            label='Depth of Field'
            hint='Camera-like focus blur'
            trueLabel='On'
            falseLabel='Off'
            value={depthOfField}
            onChange={dof => world.prefs.setDepthOfField(dof)}
          />
          <MenuItemToggle
            label='Motion Blur'
            hint='Fast movement blur effect'
            trueLabel='On'
            falseLabel='Off'
            value={motionBlur}
            onChange={mb => world.prefs.setMotionBlur(mb)}
          />
          <MenuItemToggle
            label='Screen Space Reflections'
            hint='Surface reflection effects'
            trueLabel='On'
            falseLabel='Off'
            value={ssReflections}
            onChange={ssr => world.prefs.setSSReflections(ssr)}
          />
          <MenuItemToggle
            label='Volumetric Lighting'
            hint='Atmospheric light rays'
            trueLabel='On'
            falseLabel='Off'
            value={volumetricLighting}
            onChange={vl => world.prefs.setVolumetricLighting(vl)}
          />
        </>
      )}
    </Menu>
  )
}

function MenuMainPerformance({ world, pop, push }) {
  const [vsync, setVSync] = useState(world.prefs.vsync)
  const [frameRateLimit, setFrameRateLimit] = useState(world.prefs.frameRateLimit)

  useEffect(() => {
    const onChange = changes => {
      if (changes.vsync) setVSync(changes.vsync.value)
      if (changes.frameRateLimit) setFrameRateLimit(changes.frameRateLimit.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  return (
    <Menu title='Performance'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemToggle
        label='V-Sync'
        hint='Prevent screen tearing'
        trueLabel='On'
        falseLabel='Off'
        value={vsync}
        onChange={vsync => world.prefs.setVSync(vsync)}
      />
      <MenuItemSwitch
        label='Frame Rate Limit'
        hint='Maximum frame rate cap'
        options={frameRateLimitOptions}
        value={frameRateLimit}
        onChange={limit => world.prefs.setFrameRateLimit(limit)}
      />
    </Menu>
  )
}

function MenuMainAudio({ world, pop, push }) {
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)

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
    <Menu title='Audio'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemRange
        label='Music'
        hint='Background music volume'
        min={0}
        max={2}
        step={0.05}
        value={music}
        onChange={music => world.prefs.setMusic(music)}
      />
      <MenuItemRange
        label='Sound Effects'
        hint='Game sound effects volume'
        min={0}
        max={2}
        step={0.05}
        value={sfx}
        onChange={sfx => world.prefs.setSFX(sfx)}
      />
      <MenuItemRange
        label='Voice Chat'
        hint='Voice communication volume'
        min={0}
        max={2}
        step={0.05}
        value={voice}
        onChange={voice => world.prefs.setVoice(voice)}
      />
    </Menu>
  )
}

function MenuMainUI({ world, pop, push }) {
  return (
    <Menu title='Interface'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemBtn label='Coming Soon' hint='UI customization options' disabled />
    </Menu>
  )
}

function MenuMainWorld({ world, pop, push }) {
  return (
    <Menu title='World'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemBtn label='World Settings' hint='Configure world properties' disabled />
      <MenuItemBtn label='Player Management' hint='Manage world permissions' disabled />
    </Menu>
  )
}

export default function MenuMain({ world, hidden, route, ...routeProps }) {
  const { isAdmin, isBuilder } = usePermissions(world)

  if (!route || route === 'index') {
    return <MenuMainIndex world={world} {...routeProps} />
  }
  if (route === 'ui') {
    return <MenuMainUI world={world} {...routeProps} />
  }
  if (route === 'display') {
    return <MenuMainDisplay world={world} {...routeProps} />
  }
  if (route === 'graphics') {
    return <MenuMainGraphics world={world} {...routeProps} />
  }
  if (route === 'effects') {
    return <MenuMainEffects world={world} {...routeProps} />
  }
  if (route === 'performance') {
    return <MenuMainPerformance world={world} {...routeProps} />
  }
  if (route === 'audio') {
    return <MenuMainAudio world={world} {...routeProps} />
  }
  if (route === 'world') {
    return <MenuMainWorld world={world} {...routeProps} />
  }
  return null
}
