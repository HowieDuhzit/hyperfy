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

// AAA Advanced Feature Options
const materialQualityOptions = [
  { label: 'Standard', value: 'standard' },
  { label: 'Enhanced', value: 'enhanced' },
  { label: 'AAA Quality', value: 'aaa' },
  { label: 'Ultra Premium', value: 'ultra' },
]

const shadowAtlasQualityOptions = [
  { label: 'Low (1024px)', value: 'low' },
  { label: 'Medium (2048px)', value: 'medium' },
  { label: 'High (4096px)', value: 'high' },
  { label: 'Ultra (8192px)', value: 'ultra' },
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
      <MenuItemBtn label='Display & UI' hint='Screen, interface, and visual settings' onClick={() => push('display')} nav />
      <MenuItemBtn label='Graphics' hint='Core rendering and quality settings' onClick={() => push('graphics')} nav />
      <MenuItemBtn label='Effects' hint='Post-processing effects' onClick={() => push('effects')} nav />
      <MenuItemBtn label='AAA WebGPU' hint='Advanced AAA rendering features' onClick={() => push('aaa')} nav />
      <MenuItemBtn label='Performance' hint='Optimization and profiling tools' onClick={() => push('performance')} nav />
      <MenuItemBtn label='Audio' hint='Sound and music settings' onClick={() => push('audio')} nav />
    </Menu>
  )
}

function MenuMainDisplay({ world, pop, push }) {
  const [ui, setUI] = useState(world.prefs.ui)
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
      if (changes.ui) setUI(changes.ui.value)
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
    <Menu title='Display & UI'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemRange
        label='UI Scale'
        hint='Adjust user interface size'
        min={0.5}
        max={1.5}
        step={0.1}
        value={ui}
        onChange={ui => world.prefs.setUI(ui)}
      />
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
        label='Renderer ⚠️ RESTART REQUIRED'
        hint='Choose graphics API backend (requires page refresh to take effect)'
        options={rendererOptions}
        value={renderer}
        onChange={newRenderer => {
          world.prefs.setRenderer(newRenderer)
          alert('⚠️ Please refresh the page for renderer change to take effect!')
        }}
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
  const [ssgi, setSSGI] = useState(world.prefs.ssgi)
  const [taa, setTAA] = useState(world.prefs.taa)
  const [temporalUpsampling, setTemporalUpsampling] = useState(world.prefs.temporalUpsampling)

  useEffect(() => {
    const onChange = changes => {
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.depthOfField) setDepthOfField(changes.depthOfField.value)
      if (changes.motionBlur) setMotionBlur(changes.motionBlur.value)
      if (changes.ssReflections) setSSReflections(changes.ssReflections.value)
      if (changes.volumetricLighting) setVolumetricLighting(changes.volumetricLighting.value)
      if (changes.ssgi) setSSGI(changes.ssgi.value)
      if (changes.taa) setTAA(changes.taa.value)
      if (changes.temporalUpsampling) setTemporalUpsampling(changes.temporalUpsampling.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  const applyEffectPreset = (presetName) => {
    console.log(`🎨 Applying ${presetName} effects preset...`)
    
    switch (presetName) {
      case 'performance':
        // Performance - minimal effects
        world.prefs.setPostprocessing(true)
        world.prefs.setBloom(false)
        world.prefs.setAO(false)
        world.prefs.setDepthOfField(false)
        world.prefs.setMotionBlur(false)
        world.prefs.setSSReflections(false)
        world.prefs.setVolumetricLighting(false)
        world.prefs.setSSGI(false)
        world.prefs.setTAA(true) // Keep TAA for quality
        world.prefs.setTemporalUpsampling(false)
        break
        
      case 'balanced':
        // Balanced - common effects
        world.prefs.setPostprocessing(true)
        world.prefs.setBloom(true)
        world.prefs.setAO(true)
        world.prefs.setDepthOfField(false)
        world.prefs.setMotionBlur(false)
        world.prefs.setSSReflections(true)
        world.prefs.setVolumetricLighting(false)
        world.prefs.setSSGI(false)
        world.prefs.setTAA(true)
        world.prefs.setTemporalUpsampling(false)
        break
        
      case 'cinematic':
        // Cinematic - film-like effects
        world.prefs.setPostprocessing(true)
        world.prefs.setBloom(true)
        world.prefs.setAO(true)
        world.prefs.setDepthOfField(true)
        world.prefs.setMotionBlur(true)
        world.prefs.setSSReflections(true)
        world.prefs.setVolumetricLighting(true)
        world.prefs.setSSGI(true)
        world.prefs.setTAA(true)
        world.prefs.setTemporalUpsampling(false)
        break
        
      case 'ultra':
        // Ultra - everything enabled
        world.prefs.setPostprocessing(true)
        world.prefs.setBloom(true)
        world.prefs.setAO(true)
        world.prefs.setDepthOfField(true)
        world.prefs.setMotionBlur(true)
        world.prefs.setSSReflections(true)
        world.prefs.setVolumetricLighting(true)
        world.prefs.setSSGI(true)
        world.prefs.setTAA(true)
        world.prefs.setTemporalUpsampling(true)
        break
    }
  }

  return (
    <Menu title='Effects'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      {/* Effects Presets */}
      <MenuItemBtn label='— Effect Presets —' hint='Quick post-processing presets' disabled />
      <MenuItemBtn 
        label='🚀 Performance' 
        hint='Minimal effects for maximum framerate'
        onClick={() => applyEffectPreset('performance')}
      />
      <MenuItemBtn 
        label='⚖️ Balanced' 
        hint='Common effects with good performance'
        onClick={() => applyEffectPreset('balanced')}
      />
      <MenuItemBtn 
        label='🎬 Cinematic' 
        hint='Film-like effects for dramatic visuals'
        onClick={() => applyEffectPreset('cinematic')}
      />
      <MenuItemBtn 
        label='🔥 Ultra' 
        hint='All effects enabled - maximum visual impact'
        onClick={() => applyEffectPreset('ultra')}
      />
      
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
          <MenuItemToggle
            label='SSGI (WebGPU)'
            hint='Screen Space Global Illumination - advanced lighting'
            trueLabel='On'
            falseLabel='Off'
            value={ssgi}
            onChange={ssgi => world.prefs.setSSGI(ssgi)}
          />
          <MenuItemToggle
            label='TAA (WebGPU)'
            hint='Temporal Anti-Aliasing - high quality edge smoothing'
            trueLabel='On'
            falseLabel='Off'
            value={taa}
            onChange={taa => world.prefs.setTAA(taa)}
          />
          <MenuItemToggle
            label='Temporal Upsampling'
            hint='DLSS-like AI upsampling (Experimental)'
            trueLabel='On'
            falseLabel='Off'
            value={temporalUpsampling}
            onChange={tu => world.prefs.setTemporalUpsampling(tu)}
          />
        </>
      )}
    </Menu>
  )
}


function MenuMainPerformance({ world, pop, push }) {
  const [vsync, setVSync] = useState(world.prefs.vsync)
  const [frameRateLimit, setFrameRateLimit] = useState(world.prefs.frameRateLimit)
  const [gpuProfilerOverlay, setGPUProfilerOverlay] = useState(world.prefs.gpuProfilerOverlay)
  const [autoOptimization, setAutoOptimization] = useState(world.prefs.autoOptimization)
  const [performanceWarnings, setPerformanceWarnings] = useState(world.prefs.performanceWarnings)
  const [thermalThrottlingDetection, setThermalThrottlingDetection] = useState(world.prefs.thermalThrottlingDetection)
  const [gpuDrivenCulling, setGPUDrivenCulling] = useState(world.prefs.gpuDrivenCulling)
  const [gpuParticleSimulation, setGPUParticleSimulation] = useState(world.prefs.gpuParticleSimulation)
  const [gpuLODSelection, setGPULODSelection] = useState(world.prefs.gpuLODSelection)

  useEffect(() => {
    const onChange = changes => {
      if (changes.vsync) setVSync(changes.vsync.value)
      if (changes.frameRateLimit) setFrameRateLimit(changes.frameRateLimit.value)
      if (changes.gpuProfilerOverlay) setGPUProfilerOverlay(changes.gpuProfilerOverlay.value)
      if (changes.autoOptimization) setAutoOptimization(changes.autoOptimization.value)
      if (changes.performanceWarnings) setPerformanceWarnings(changes.performanceWarnings.value)
      if (changes.thermalThrottlingDetection) setThermalThrottlingDetection(changes.thermalThrottlingDetection.value)
      if (changes.gpuDrivenCulling) setGPUDrivenCulling(changes.gpuDrivenCulling.value)
      if (changes.gpuParticleSimulation) setGPUParticleSimulation(changes.gpuParticleSimulation.value)
      if (changes.gpuLODSelection) setGPULODSelection(changes.gpuLODSelection.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  return (
    <Menu title='Performance & Profiling'>
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
      <MenuItemToggle
        label='GPU Profiler Overlay'
        hint='Real-time performance monitoring'
        trueLabel='On'
        falseLabel='Off'
        value={gpuProfilerOverlay}
        onChange={overlay => world.prefs.setGPUProfilerOverlay(overlay)}
      />
      <MenuItemToggle
        label='Auto Optimization'
        hint='Automatically adjust quality for performance'
        trueLabel='On'
        falseLabel='Off'
        value={autoOptimization}
        onChange={auto => world.prefs.setAutoOptimization(auto)}
      />
      <MenuItemToggle
        label='Performance Warnings'
        hint='Alerts for performance issues'
        trueLabel='On'
        falseLabel='Off'
        value={performanceWarnings}
        onChange={warnings => world.prefs.setPerformanceWarnings(warnings)}
      />
      <MenuItemToggle
        label='Thermal Throttling Detection'
        hint='Monitor device temperature impact'
        trueLabel='On'
        falseLabel='Off'
        value={thermalThrottlingDetection}
        onChange={thermal => world.prefs.setThermalThrottlingDetection(thermal)}
      />
      <MenuItemToggle
        label='GPU-Driven Culling'
        hint='GPU compute shader object culling'
        trueLabel='On'
        falseLabel='Off'
        value={gpuDrivenCulling}
        onChange={cull => world.prefs.setGPUDrivenCulling(cull)}
      />
      <MenuItemToggle
        label='GPU Particle Simulation'
        hint='Hardware-accelerated particles'
        trueLabel='On'
        falseLabel='Off'
        value={gpuParticleSimulation}
        onChange={particles => world.prefs.setGPUParticleSimulation(particles)}
      />
      <MenuItemToggle
        label='GPU LOD Selection'
        hint='GPU compute shader LOD calculation'
        trueLabel='On'
        falseLabel='Off'
        value={gpuLODSelection}
        onChange={lod => world.prefs.setGPULODSelection(lod)}
      />
    </Menu>
  )
}

function MenuMainAAA({ world, pop, push }) {
  // Materials
  const [materialQuality, setMaterialQuality] = useState(world.prefs.materialQuality)
  const [proceduralMaterials, setProceduralMaterials] = useState(world.prefs.proceduralMaterials)
  const [dynamicMaterialLOD, setDynamicMaterialLOD] = useState(world.prefs.dynamicMaterialLOD)
  const [materialBatching, setMaterialBatching] = useState(world.prefs.materialBatching)
  
  // Shadows
  const [cascadedShadowMaps, setCascadedShadowMaps] = useState(world.prefs.cascadedShadowMaps)
  const [volumetricShadows, setVolumetricShadows] = useState(world.prefs.volumetricShadows)
  const [contactShadows, setContactShadows] = useState(world.prefs.contactShadows)
  const [temporalShadowFiltering, setTemporalShadowFiltering] = useState(world.prefs.temporalShadowFiltering)
  const [variableRateShadows, setVariableRateShadows] = useState(world.prefs.variableRateShadows)
  const [shadowAtlasQuality, setShadowAtlasQuality] = useState(world.prefs.shadowAtlasQuality)
  
  // Ray Tracing
  const [rayTracedReflections, setRayTracedReflections] = useState(world.prefs.rayTracedReflections)
  const [rayTracedGlobalIllumination, setRayTracedGlobalIllumination] = useState(world.prefs.rayTracedGlobalIllumination)
  const [rayTracedShadows, setRayTracedShadows] = useState(world.prefs.rayTracedShadows)

  useEffect(() => {
    const onChange = changes => {
      // Materials
      if (changes.materialQuality) setMaterialQuality(changes.materialQuality.value)
      if (changes.proceduralMaterials) setProceduralMaterials(changes.proceduralMaterials.value)
      if (changes.dynamicMaterialLOD) setDynamicMaterialLOD(changes.dynamicMaterialLOD.value)
      if (changes.materialBatching) setMaterialBatching(changes.materialBatching.value)
      
      // Shadows
      if (changes.cascadedShadowMaps) setCascadedShadowMaps(changes.cascadedShadowMaps.value)
      if (changes.volumetricShadows) setVolumetricShadows(changes.volumetricShadows.value)
      if (changes.contactShadows) setContactShadows(changes.contactShadows.value)
      if (changes.temporalShadowFiltering) setTemporalShadowFiltering(changes.temporalShadowFiltering.value)
      if (changes.variableRateShadows) setVariableRateShadows(changes.variableRateShadows.value)
      if (changes.shadowAtlasQuality) setShadowAtlasQuality(changes.shadowAtlasQuality.value)
      
      // Ray Tracing
      if (changes.rayTracedReflections) setRayTracedReflections(changes.rayTracedReflections.value)
      if (changes.rayTracedGlobalIllumination) setRayTracedGlobalIllumination(changes.rayTracedGlobalIllumination.value)
      if (changes.rayTracedShadows) setRayTracedShadows(changes.rayTracedShadows.value)
    }
    world.prefs.on('change', onChange)
    return () => {
      world.prefs.off('change', onChange)
    }
  }, [])

  const applyPreset = (presetName) => {
    console.log(`🎮 Applying ${presetName} preset...`)
    
    switch (presetName) {
      case 'performance':
        // Performance preset - prioritize framerate
        world.prefs.setMaterialQuality('standard')
        world.prefs.setProceduralMaterials(false)
        world.prefs.setDynamicMaterialLOD(true)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(false)
        world.prefs.setVolumetricShadows(false)
        world.prefs.setContactShadows(false)
        world.prefs.setTemporalShadowFiltering(true)
        world.prefs.setVariableRateShadows(true)
        world.prefs.setShadowAtlasQuality('low')
        world.prefs.setGPUProfilerOverlay(true)
        world.prefs.setAutoOptimization(true)
        world.prefs.setGPUDrivenCulling(true)
        world.prefs.setGPUParticleSimulation(true)
        world.prefs.setGPULODSelection(true)
        break
        
      case 'balanced':
        // Balanced preset - good quality + performance
        world.prefs.setMaterialQuality('enhanced')
        world.prefs.setProceduralMaterials(true)
        world.prefs.setDynamicMaterialLOD(true)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(true)
        world.prefs.setVolumetricShadows(false)
        world.prefs.setContactShadows(true)
        world.prefs.setTemporalShadowFiltering(true)
        world.prefs.setVariableRateShadows(true)
        world.prefs.setShadowAtlasQuality('medium')
        world.prefs.setGPUProfilerOverlay(false)
        world.prefs.setAutoOptimization(true)
        world.prefs.setGPUDrivenCulling(true)
        world.prefs.setGPUParticleSimulation(true)
        world.prefs.setGPULODSelection(true)
        break
        
      case 'quality':
        // Quality preset - maximum visual fidelity
        world.prefs.setMaterialQuality('aaa')
        world.prefs.setProceduralMaterials(true)
        world.prefs.setDynamicMaterialLOD(true)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(true)
        world.prefs.setVolumetricShadows(true)
        world.prefs.setContactShadows(true)
        world.prefs.setTemporalShadowFiltering(true)
        world.prefs.setVariableRateShadows(true)
        world.prefs.setShadowAtlasQuality('high')
        world.prefs.setGPUProfilerOverlay(false)
        world.prefs.setAutoOptimization(false)
        world.prefs.setGPUDrivenCulling(true)
        world.prefs.setGPUParticleSimulation(true)
        world.prefs.setGPULODSelection(true)
        break
        
      case 'ultra':
        // Ultra preset - ultimate realistic quality with all advanced PBR features
        world.prefs.setMaterialQuality('ultra')
        world.prefs.setProceduralMaterials(true)
        world.prefs.setDynamicMaterialLOD(false) // Disable LOD for max quality
        world.prefs.setMaterialBatching(false) // Disable batching for max quality
        world.prefs.setCascadedShadowMaps(true)
        world.prefs.setVolumetricShadows(true)
        world.prefs.setContactShadows(true)
        world.prefs.setTemporalShadowFiltering(true)
        world.prefs.setVariableRateShadows(false) // Disable for max quality
        world.prefs.setShadowAtlasQuality('ultra')
        world.prefs.setGPUProfilerOverlay(false)
        world.prefs.setAutoOptimization(false)
        world.prefs.setGPUDrivenCulling(false) // CPU culling for max precision
        world.prefs.setGPUParticleSimulation(true)
        world.prefs.setGPULODSelection(false) // Disable LOD
        break
    }
  }

  return (
    <Menu title='AAA WebGPU Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      {/* Quality Presets */}
      <MenuItemBtn label='— Quality Presets —' hint='Quick configuration presets' disabled />
      <MenuItemBtn 
        label='🚀 Performance' 
        hint='Natural PBR materials optimized for high framerate'
        onClick={() => applyPreset('performance')}
      />
      <MenuItemBtn 
        label='⚖️ Balanced' 
        hint='Enhanced PBR with improved reflections and surface quality'
        onClick={() => applyPreset('balanced')}
      />
      <MenuItemBtn 
        label='💎 Quality' 
        hint='Maximum realistic PBR fidelity with advanced features'
        onClick={() => applyPreset('quality')}
      />
      <MenuItemBtn 
        label='🔥 Ultra' 
        hint='Ultimate PBR quality with cutting-edge material features'
        onClick={() => applyPreset('ultra')}
      />
      
      {/* Advanced Materials Section */}
      <MenuItemBtn label='— Advanced Materials —' hint='PBR materials and quality' disabled />
      <MenuItemSwitch
        label='Material Quality'
        hint='Realistic PBR material enhancement level - from natural to ultimate fidelity'
        options={materialQualityOptions}
        value={materialQuality}
        onChange={quality => world.prefs.setMaterialQuality(quality)}
      />
      <MenuItemToggle
        label='Procedural Materials'
        hint='AI-generated material details'
        trueLabel='On'
        falseLabel='Off'
        value={proceduralMaterials}
        onChange={proc => world.prefs.setProceduralMaterials(proc)}
      />
      <MenuItemToggle
        label='Dynamic Material LOD'
        hint='Automatic material quality scaling'
        trueLabel='On'
        falseLabel='Off'
        value={dynamicMaterialLOD}
        onChange={lod => world.prefs.setDynamicMaterialLOD(lod)}
      />
      <MenuItemToggle
        label='Material Batching'
        hint='Performance optimization for similar materials'
        trueLabel='On'
        falseLabel='Off'
        value={materialBatching}
        onChange={batch => world.prefs.setMaterialBatching(batch)}
      />
      
      {/* Advanced Shadows Section */}
      <MenuItemBtn label='— Advanced Shadows —' hint='High-quality shadow rendering' disabled />
      <MenuItemToggle
        label='Cascaded Shadow Maps'
        hint='High-quality directional light shadows'
        trueLabel='On'
        falseLabel='Off'
        value={cascadedShadowMaps}
        onChange={csm => world.prefs.setCascadedShadowMaps(csm)}
      />
      <MenuItemToggle
        label='Volumetric Shadows'
        hint='Light scattering through fog and atmosphere'
        trueLabel='On'
        falseLabel='Off'
        value={volumetricShadows}
        onChange={vs => world.prefs.setVolumetricShadows(vs)}
      />
      <MenuItemToggle
        label='Contact Shadows'
        hint='Fine detail shadows for close objects'
        trueLabel='On'
        falseLabel='Off'
        value={contactShadows}
        onChange={cs => world.prefs.setContactShadows(cs)}
      />
      <MenuItemToggle
        label='Temporal Shadow Filtering'
        hint='Smooth, flicker-free shadow edges'
        trueLabel='On'
        falseLabel='Off'
        value={temporalShadowFiltering}
        onChange={tsf => world.prefs.setTemporalShadowFiltering(tsf)}
      />
      <MenuItemToggle
        label='Variable Rate Shadows'
        hint='Adaptive shadow quality based on importance'
        trueLabel='On'
        falseLabel='Off'
        value={variableRateShadows}
        onChange={vrs => world.prefs.setVariableRateShadows(vrs)}
      />
      <MenuItemSwitch
        label='Shadow Atlas Quality'
        hint='Shadow texture resolution'
        options={shadowAtlasQualityOptions}
        value={shadowAtlasQuality}
        onChange={quality => world.prefs.setShadowAtlasQuality(quality)}
      />
      
      {/* Ray Tracing Section */}
      <MenuItemBtn label='— Ray Tracing (Future) —' hint='Hardware ray tracing features' disabled />
      <MenuItemToggle
        label='Ray Traced Reflections'
        hint='Real-time ray traced reflections (WebGPU RT)'
        trueLabel='On'
        falseLabel='Off'
        value={rayTracedReflections}
        onChange={rtr => world.prefs.setRayTracedReflections(rtr)}
        disabled={true}
      />
      <MenuItemToggle
        label='Ray Traced Global Illumination'
        hint='Real-time ray traced global lighting (WebGPU RT)'
        trueLabel='On'
        falseLabel='Off'
        value={rayTracedGlobalIllumination}
        onChange={rtgi => world.prefs.setRayTracedGlobalIllumination(rtgi)}
        disabled={true}
      />
      <MenuItemToggle
        label='Ray Traced Shadows'
        hint='Hardware ray traced shadows (WebGPU RT)'
        trueLabel='On'
        falseLabel='Off'
        value={rayTracedShadows}
        onChange={rts => world.prefs.setRayTracedShadows(rts)}
        disabled={true}
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
  if (route === 'display') {
    return <MenuMainDisplay world={world} {...routeProps} />
  }
  if (route === 'graphics') {
    return <MenuMainGraphics world={world} {...routeProps} />
  }
  if (route === 'effects') {
    return <MenuMainEffects world={world} {...routeProps} />
  }
  if (route === 'aaa') {
    return <MenuMainAAA world={world} {...routeProps} />
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
