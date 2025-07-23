import React, { useState, useEffect } from 'react'
import { Menu, MenuItemBack, MenuItemBtn, MenuItemSwitch, MenuItemRange, MenuItemToggle } from './Menu.js'

// Main menu component
function MenuMainIndex({ world, pop, push }) {
  return (
    <Menu title='Settings'>
      <MenuItemBtn 
        label='📱 Display' 
        hint='Screen and display settings'
        onClick={() => push('display')}
      />
      <MenuItemBtn 
        label='🎮 Graphics' 
        hint='Graphics quality and rendering settings'
        onClick={() => push('graphics')}
      />
      <MenuItemBtn 
        label='✨ Effects' 
        hint='Post-processing and visual effects'
        onClick={() => push('effects')}
      />
      <MenuItemBtn 
        label='⚡ Performance' 
        hint='Performance and optimization settings'
        onClick={() => push('performance')}
      />
      <MenuItemBtn 
        label='🎨 Advanced Graphics' 
        hint='Advanced graphics and material settings'
        onClick={() => push('advanced')}
      />
      <MenuItemBtn 
        label='🔊 Audio' 
        hint='Audio and sound settings'
        onClick={() => push('audio')}
      />
      <MenuItemBtn 
        label='🌍 World' 
        hint='World and environment settings'
        onClick={() => push('world')}
      />
    </Menu>
  )
}

// Display settings menu
function MenuMainDisplay({ world, pop, push }) {
  const [dpr, setDPR] = useState(world.prefs.dpr || 1)
  const [fieldOfView, setFieldOfView] = useState(world.prefs.fieldOfView || 75)
  const [gamma, setGamma] = useState(world.prefs.gamma || 2.2)
  const [brightness, setBrightness] = useState(world.prefs.brightness || 1.0)
  const [contrast, setContrast] = useState(world.prefs.contrast || 1.0)

  useEffect(() => {
    const onChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.fieldOfView) setFieldOfView(changes.fieldOfView.value)
      if (changes.gamma) setGamma(changes.gamma.value)
      if (changes.brightness) setBrightness(changes.brightness.value)
      if (changes.contrast) setContrast(changes.contrast.value)
    }
    world.prefs.on('change', onChange)
    return () => world.prefs.off('change', onChange)
  }, [])

  const add = (label, dpr) => {
    return { label, value: dpr }
  }

  const dprOptions = [
    add('0.5x (Low)', 0.5),
    add('1x (Standard)', 1),
    add('1.5x (High)', 1.5),
    add('2x (Ultra)', 2),
    add('3x (Extreme)', 3)
  ]

  return (
    <Menu title='Display Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      <MenuItemBtn label='— Display Quality —' disabled />
      <MenuItemSwitch
        label='Device Pixel Ratio'
        hint='Screen resolution scaling'
        options={dprOptions}
        value={dpr}
        onChange={value => world.prefs.setDPR(value)}
      />
      
      <MenuItemBtn label='— Camera Settings —' disabled />
      <MenuItemRange
        label='Field of View'
        hint='Camera field of view (60-120)'
        min={60}
        max={120}
        step={1}
        value={fieldOfView}
        onChange={value => world.prefs.setFieldOfView(value)}
      />
      
      <MenuItemBtn label='— Color Settings —' disabled />
      <MenuItemRange
        label='Gamma'
        hint='Color gamma correction (1.0-3.0)'
        min={1.0}
        max={3.0}
        step={0.1}
        value={gamma}
        onChange={value => world.prefs.setGamma(value)}
      />
      <MenuItemRange
        label='Brightness'
        hint='Overall brightness (0.5-2.0)'
        min={0.5}
        max={2.0}
        step={0.1}
        value={brightness}
        onChange={value => world.prefs.setBrightness(value)}
      />
      <MenuItemRange
        label='Contrast'
        hint='Image contrast (0.5-2.0)'
        min={0.5}
        max={2.0}
        step={0.1}
        value={contrast}
        onChange={value => world.prefs.setContrast(value)}
      />
    </Menu>
  )
}

// Graphics settings menu
function MenuMainGraphics({ world, pop, push }) {
  const [renderer, setRenderer] = useState(world.prefs.renderer || 'auto')
  const [shadows, setShadows] = useState(world.prefs.shadows || true)
  const [antialiasing, setAntialiasing] = useState(world.prefs.antialiasing || 'fxaa')
  const [textureQuality, setTextureQuality] = useState(world.prefs.textureQuality || 'high')
  const [anisotropicFiltering, setAnisotropicFiltering] = useState(world.prefs.anisotropicFiltering || true)
  const [lodDistance, setLODDistance] = useState(world.prefs.lodDistance || 100)

  useEffect(() => {
    const onChange = changes => {
      if (changes.renderer) setRenderer(changes.renderer.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.antialiasing) setAntialiasing(changes.antialiasing.value)
      if (changes.textureQuality) setTextureQuality(changes.textureQuality.value)
      if (changes.anisotropicFiltering) setAnisotropicFiltering(changes.anisotropicFiltering.value)
      if (changes.lodDistance) setLODDistance(changes.lodDistance.value)
    }
    world.prefs.on('change', onChange)
    return () => world.prefs.off('change', onChange)
  }, [])

  const rendererOptions = [
    { label: 'Auto', value: 'auto' },
    { label: 'WebGL', value: 'webgl' },
    { label: 'WebGPU', value: 'webgpu' }
  ]

  const webglAntialiasingOptions = [
    { label: 'None', value: 'none' },
    { label: 'FXAA (Fast)', value: 'fxaa' },
    { label: 'SMAA (Recommended)', value: 'smaa' },
    { label: 'TAA (Temporal)', value: 'taa' },
    { label: 'MSAA 2x (Hardware)', value: 'msaa2x' },
    { label: 'MSAA 4x (Hardware)', value: 'msaa4x' },
    { label: 'MSAA 8x (Hardware)', value: 'msaa8x' }
  ]

  const webgpuAntialiasingOptions = [
    { label: 'None', value: 'none' },
    { label: 'FXAA (GPU Optimized)', value: 'fxaa' },
    { label: 'SMAA (GPU Accelerated)', value: 'smaa' },
    { label: 'TAA (Advanced)', value: 'taa' },
    { label: 'MSAA 2x (Native)', value: 'msaa2x' },
    { label: 'MSAA 4x (Native)', value: 'msaa4x' },
    { label: 'MSAA 8x (Native)', value: 'msaa8x' }
  ]

  const getAntialiasingOptions = (renderer) => {
    if (renderer === 'webgl') {
      return webglAntialiasingOptions
    } else if (renderer === 'webgpu') {
      return webgpuAntialiasingOptions
    } else {
      // Auto mode - show all options
      return webglAntialiasingOptions
    }
  }

  const textureQualityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Ultra', value: 'ultra' }
  ]

  return (
    <Menu title='Graphics Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      <MenuItemBtn label='— Renderer —' disabled />
      <MenuItemSwitch
        label='Renderer'
        hint='Graphics rendering backend'
        options={rendererOptions}
        value={renderer}
        onChange={value => world.prefs.setRenderer(value)}
      />
      
      <MenuItemBtn label='— Quality —' disabled />
      <MenuItemToggle
        label='Shadows'
        hint='Enable shadow rendering'
        trueLabel='On'
        falseLabel='Off'
        value={shadows}
        onChange={value => world.prefs.setShadows(value)}
      />
      <MenuItemSwitch
        label='Antialiasing'
        hint={`Edge smoothing method - ${renderer === 'webgl' ? 'WebGL optimized' : renderer === 'webgpu' ? 'WebGPU accelerated' : 'Auto-selected'}`}
        options={getAntialiasingOptions(renderer)}
        value={antialiasing}
        onChange={value => world.prefs.setAntialiasing(value)}
      />
      <MenuItemSwitch
        label='Texture Quality'
        hint='Texture resolution quality'
        options={textureQualityOptions}
        value={textureQuality}
        onChange={value => world.prefs.setTextureQuality(value)}
      />
      <MenuItemToggle
        label='Anisotropic Filtering'
        hint='Improve texture quality at angles'
        trueLabel='On'
        falseLabel='Off'
        value={anisotropicFiltering}
        onChange={value => world.prefs.setAnisotropicFiltering(value)}
      />
      
      <MenuItemBtn label='— Performance —' disabled />
      <MenuItemRange
        label='LOD Distance'
        hint='Level of detail distance (50-200)'
        min={50}
        max={200}
        step={10}
        value={lodDistance}
        onChange={value => world.prefs.setLODDistance(value)}
      />
    </Menu>
  )
}

// Effects settings menu
function MenuMainEffects({ world, pop, push }) {
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing || true)
  const [bloom, setBloom] = useState(world.prefs.bloom || true)
  const [ao, setAO] = useState(world.prefs.ao || true)
  const [depthOfField, setDepthOfField] = useState(world.prefs.depthOfField || false)
  const [motionBlur, setMotionBlur] = useState(world.prefs.motionBlur || false)
  const [ssReflections, setSSReflections] = useState(world.prefs.ssReflections || false)
  const [volumetricLighting, setVolumetricLighting] = useState(world.prefs.volumetricLighting || false)
  const [ssgi, setSSGI] = useState(world.prefs.ssgi || false)
  const [taa, setTAA] = useState(world.prefs.taa || true)
  const [temporalUpsampling, setTemporalUpsampling] = useState(world.prefs.temporalUpsampling || false)

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
    return () => world.prefs.off('change', onChange)
  }, [])

  const applyEffectPreset = (presetName) => {
    console.log(`✨ Applying ${presetName} effects preset...`)
    
    switch (presetName) {
      case 'cinematic':
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
      case 'balanced':
        world.prefs.setPostprocessing(true)
        world.prefs.setBloom(true)
        world.prefs.setAO(true)
        world.prefs.setDepthOfField(false)
        world.prefs.setMotionBlur(false)
        world.prefs.setSSReflections(false)
        world.prefs.setVolumetricLighting(false)
        world.prefs.setSSGI(false)
        world.prefs.setTAA(true)
        world.prefs.setTemporalUpsampling(false)
        break
      case 'performance':
        world.prefs.setPostprocessing(false)
        world.prefs.setBloom(false)
        world.prefs.setAO(false)
        world.prefs.setDepthOfField(false)
        world.prefs.setMotionBlur(false)
        world.prefs.setSSReflections(false)
        world.prefs.setVolumetricLighting(false)
        world.prefs.setSSGI(false)
        world.prefs.setTAA(false)
        world.prefs.setTemporalUpsampling(false)
        break
    }
  }

  return (
    <Menu title='Effects Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      {/* Effects Presets */}
      <MenuItemBtn label='— Effects Presets —' disabled />
      <MenuItemBtn 
        label='🎬 Cinematic' 
        hint='Maximum visual quality with all effects'
        onClick={() => applyEffectPreset('cinematic')}
      />
      <MenuItemBtn 
        label='⚖️ Balanced' 
        hint='Balanced quality and performance'
        onClick={() => applyEffectPreset('balanced')}
      />
      <MenuItemBtn 
        label='💨 Performance' 
        hint='Maximum performance, minimal effects'
        onClick={() => applyEffectPreset('performance')}
      />
      
      {/* Post-Processing */}
      <MenuItemBtn label='— Post-Processing —' disabled />
      <MenuItemToggle
        label='Post-Processing'
        hint='Enable all post-processing effects'
        trueLabel='On'
        falseLabel='Off'
        value={postprocessing}
        onChange={value => world.prefs.setPostprocessing(value)}
      />
          <MenuItemToggle
            label='Bloom'
        hint='Glowing light effects'
            trueLabel='On'
            falseLabel='Off'
            value={bloom}
        onChange={value => world.prefs.setBloom(value)}
          />
            <MenuItemToggle
              label='Ambient Occlusion'
        hint='Contact shadows and darkening'
              trueLabel='On'
              falseLabel='Off'
              value={ao}
        onChange={value => world.prefs.setAO(value)}
            />
          <MenuItemToggle
            label='Depth of Field'
        hint='Camera focus blur effect'
            trueLabel='On'
            falseLabel='Off'
            value={depthOfField}
        onChange={value => world.prefs.setDepthOfField(value)}
          />
          <MenuItemToggle
            label='Motion Blur'
        hint='Camera movement blur'
            trueLabel='On'
            falseLabel='Off'
            value={motionBlur}
        onChange={value => world.prefs.setMotionBlur(value)}
          />
          <MenuItemToggle
            label='Screen Space Reflections'
        hint='Real-time reflection mapping'
            trueLabel='On'
            falseLabel='Off'
            value={ssReflections}
        onChange={value => world.prefs.setSSReflections(value)}
          />
          <MenuItemToggle
            label='Volumetric Lighting'
        hint='Atmospheric light scattering'
            trueLabel='On'
            falseLabel='Off'
            value={volumetricLighting}
        onChange={value => world.prefs.setVolumetricLighting(value)}
          />
          <MenuItemToggle
        label='Screen Space Global Illumination'
        hint='Real-time global illumination'
            trueLabel='On'
            falseLabel='Off'
            value={ssgi}
        onChange={value => world.prefs.setSSGI(value)}
          />
          <MenuItemToggle
        label='Temporal Anti-Aliasing'
        hint='Advanced edge smoothing'
            trueLabel='On'
            falseLabel='Off'
            value={taa}
        onChange={value => world.prefs.setTAA(value)}
          />
          <MenuItemToggle
            label='Temporal Upsampling'
        hint='DLSS-like upscaling'
            trueLabel='On'
            falseLabel='Off'
            value={temporalUpsampling}
        onChange={value => world.prefs.setTemporalUpsampling(value)}
          />
    </Menu>
  )
}

// Performance settings menu
function MenuMainPerformance({ world, pop, push }) {
  const [vsync, setVSync] = useState(world.prefs.vsync || true)
  const [frameRateLimit, setFrameRateLimit] = useState(world.prefs.frameRateLimit || 'unlimited')
  const [resolutionScale, setResolutionScale] = useState(world.prefs.resolutionScale || 1.0)
  const [toneMappingMode, setToneMappingMode] = useState(world.prefs.toneMappingMode || 'aces')
  const [toneMappingExposure, setToneMappingExposure] = useState(world.prefs.toneMappingExposure || 1.0)

  useEffect(() => {
    const onChange = changes => {
      if (changes.vsync) setVSync(changes.vsync.value)
      if (changes.frameRateLimit) setFrameRateLimit(changes.frameRateLimit.value)
      if (changes.resolutionScale) setResolutionScale(changes.resolutionScale.value)
      if (changes.toneMappingMode) setToneMappingMode(changes.toneMappingMode.value)
      if (changes.toneMappingExposure) setToneMappingExposure(changes.toneMappingExposure.value)
    }
    world.prefs.on('change', onChange)
    return () => world.prefs.off('change', onChange)
  }, [])

  const frameRateOptions = [
    { label: 'Unlimited', value: 'unlimited' },
    { label: '30 FPS', value: '30' },
    { label: '60 FPS', value: '60' },
    { label: '120 FPS', value: '120' },
    { label: '144 FPS', value: '144' }
  ]

  const toneMappingOptions = [
    { label: 'None', value: 'none' },
    { label: 'Linear', value: 'linear' },
    { label: 'Reinhard', value: 'reinhard' },
    { label: 'Cineon', value: 'cineon' },
    { label: 'ACES', value: 'aces' }
  ]

  return (
    <Menu title='Performance Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      <MenuItemBtn label='— Frame Rate —' disabled />
      <MenuItemToggle
        label='VSync'
        hint='Vertical synchronization'
        trueLabel='On'
        falseLabel='Off'
        value={vsync}
        onChange={value => world.prefs.setVSync(value)}
      />
      <MenuItemSwitch
        label='Frame Rate Limit'
        hint='Maximum frame rate'
        options={frameRateOptions}
        value={frameRateLimit}
        onChange={value => world.prefs.setFrameRateLimit(value)}
      />
      
      <MenuItemBtn label='— Rendering —' disabled />
      <MenuItemRange
        label='Resolution Scale'
        hint='Internal rendering resolution (0.5-2.0)'
        min={0.5}
        max={2.0}
        step={0.1}
        value={resolutionScale}
        onChange={value => world.prefs.setResolutionScale(value)}
      />
      
      <MenuItemBtn label='— Tone Mapping —' disabled />
      <MenuItemSwitch
        label='Tone Mapping Mode'
        hint='HDR to SDR conversion method'
        options={toneMappingOptions}
        value={toneMappingMode}
        onChange={value => world.prefs.setToneMappingMode(value)}
      />
      <MenuItemRange
        label='Tone Mapping Exposure'
        hint='Exposure adjustment (0.1-5.0)'
        min={0.1}
        max={5.0}
        step={0.1}
        value={toneMappingExposure}
        onChange={value => world.prefs.setToneMappingExposure(value)}
      />
    </Menu>
  )
}

// Advanced Graphics settings menu
function MenuMainAdvanced({ world, pop, push }) {
  const [materialQuality, setMaterialQuality] = useState(world.prefs.materialQuality || 'enhanced')
  const [proceduralMaterials, setProceduralMaterials] = useState(world.prefs.proceduralMaterials || true)
  const [dynamicMaterialLOD, setDynamicMaterialLOD] = useState(world.prefs.dynamicMaterialLOD || true)
  const [materialBatching, setMaterialBatching] = useState(world.prefs.materialBatching || true)
  const [cascadedShadowMaps, setCascadedShadowMaps] = useState(world.prefs.cascadedShadowMaps || true)
  const [volumetricShadows, setVolumetricShadows] = useState(world.prefs.volumetricShadows || false)
  const [contactShadows, setContactShadows] = useState(world.prefs.contactShadows || true)
  const [temporalShadowFiltering, setTemporalShadowFiltering] = useState(world.prefs.temporalShadowFiltering || true)
  const [variableRateShadows, setVariableRateShadows] = useState(world.prefs.variableRateShadows || true)
  const [shadowAtlasQuality, setShadowAtlasQuality] = useState(world.prefs.shadowAtlasQuality || 'high')
  const [gpuDrivenCulling, setGPUDrivenCulling] = useState(world.prefs.gpuDrivenCulling || true)
  const [gpuParticleSimulation, setGPUParticleSimulation] = useState(world.prefs.gpuParticleSimulation || true)
  const [gpuLODSelection, setGPULODSelection] = useState(world.prefs.gpuLODSelection || true)
  const [rayTracedReflections, setRayTracedReflections] = useState(world.prefs.rayTracedReflections || false)
  const [rayTracedGlobalIllumination, setRayTracedGlobalIllumination] = useState(world.prefs.rayTracedGlobalIllumination || false)
  const [rayTracedShadows, setRayTracedShadows] = useState(world.prefs.rayTracedShadows || false)
  
  // Shader Quality Settings
  const [shaderQuality, setShaderQuality] = useState(world.prefs.shaderQuality || 'enhanced')
  const [materialDetail, setMaterialDetail] = useState(world.prefs.materialDetail || 'high')
  const [reflectionQuality, setReflectionQuality] = useState(world.prefs.reflectionQuality || 'high')
  const [subsurfaceScattering, setSubsurfaceScattering] = useState(world.prefs.subsurfaceScattering || true)
  const [parallaxMapping, setParallaxMapping] = useState(world.prefs.parallaxMapping || false)
  const [tessellation, setTessellation] = useState(world.prefs.tessellation || false)
  
  // Advanced Material Properties
  const [normalMapStrength, setNormalMapStrength] = useState(world.prefs.normalMapStrength || 1.0)
  const [roughnessVariation, setRoughnessVariation] = useState(world.prefs.roughnessVariation || 0.1)
  const [metallicVariation, setMetallicVariation] = useState(world.prefs.metallicVariation || 0.1)
  const [emissiveIntensity, setEmissiveIntensity] = useState(world.prefs.emissiveIntensity || 1.0)
  const [clearcoatStrength, setClearcoatStrength] = useState(world.prefs.clearcoatStrength || 0.0)
  const [clearcoatRoughness, setClearcoatRoughness] = useState(world.prefs.clearcoatRoughness || 0.1)
  const [anisotropy, setAnisotropy] = useState(world.prefs.anisotropy || 0.0)
  const [anisotropyRotation, setAnisotropyRotation] = useState(world.prefs.anisotropyRotation || 0.0)
  const [sheenRoughness, setSheenRoughness] = useState(world.prefs.sheenRoughness || 0.5)
  const [transmission, setTransmission] = useState(world.prefs.transmission || 0.0)
  const [thickness, setThickness] = useState(world.prefs.thickness || 1.0)
  const [attenuationDistance, setAttenuationDistance] = useState(world.prefs.attenuationDistance || 1.0)
  
  // Shader Effects
  const [fresnelEffect, setFresnelEffect] = useState(world.prefs.fresnelEffect || false)
  const [fresnelStrength, setFresnelStrength] = useState(world.prefs.fresnelStrength || 1.0)
  const [rimLighting, setRimLighting] = useState(world.prefs.rimLighting || false)
  const [rimStrength, setRimStrength] = useState(world.prefs.rimStrength || 1.0)
  const [matcapReflection, setMatcapReflection] = useState(world.prefs.matcapReflection || false)
  const [environmentMapping, setEnvironmentMapping] = useState(world.prefs.environmentMapping || true)
  const [iridescence, setIridescence] = useState(world.prefs.iridescence || false)
  const [iridescenceStrength, setIridescenceStrength] = useState(world.prefs.iridescenceStrength || 1.0)
  const [iridescenceThickness, setIridescenceThickness] = useState(world.prefs.iridescenceThickness || 1.0)

  useEffect(() => {
    const onChange = changes => {
      if (changes.materialQuality) setMaterialQuality(changes.materialQuality.value)
      if (changes.proceduralMaterials) setProceduralMaterials(changes.proceduralMaterials.value)
      if (changes.dynamicMaterialLOD) setDynamicMaterialLOD(changes.dynamicMaterialLOD.value)
      if (changes.materialBatching) setMaterialBatching(changes.materialBatching.value)
      if (changes.cascadedShadowMaps) setCascadedShadowMaps(changes.cascadedShadowMaps.value)
      if (changes.volumetricShadows) setVolumetricShadows(changes.volumetricShadows.value)
      if (changes.contactShadows) setContactShadows(changes.contactShadows.value)
      if (changes.temporalShadowFiltering) setTemporalShadowFiltering(changes.temporalShadowFiltering.value)
      if (changes.variableRateShadows) setVariableRateShadows(changes.variableRateShadows.value)
      if (changes.shadowAtlasQuality) setShadowAtlasQuality(changes.shadowAtlasQuality.value)
      if (changes.gpuDrivenCulling) setGPUDrivenCulling(changes.gpuDrivenCulling.value)
      if (changes.gpuParticleSimulation) setGPUParticleSimulation(changes.gpuParticleSimulation.value)
      if (changes.gpuLODSelection) setGPULODSelection(changes.gpuLODSelection.value)
      if (changes.rayTracedReflections) setRayTracedReflections(changes.rayTracedReflections.value)
      if (changes.rayTracedGlobalIllumination) setRayTracedGlobalIllumination(changes.rayTracedGlobalIllumination.value)
      if (changes.rayTracedShadows) setRayTracedShadows(changes.rayTracedShadows.value)
      
      // Shader Quality Settings
      if (changes.shaderQuality) setShaderQuality(changes.shaderQuality.value)
      if (changes.materialDetail) setMaterialDetail(changes.materialDetail.value)
      if (changes.reflectionQuality) setReflectionQuality(changes.reflectionQuality.value)
      if (changes.subsurfaceScattering) setSubsurfaceScattering(changes.subsurfaceScattering.value)
      if (changes.parallaxMapping) setParallaxMapping(changes.parallaxMapping.value)
      if (changes.tessellation) setTessellation(changes.tessellation.value)
      
      // Advanced Material Properties
      if (changes.normalMapStrength) setNormalMapStrength(changes.normalMapStrength.value)
      if (changes.roughnessVariation) setRoughnessVariation(changes.roughnessVariation.value)
      if (changes.metallicVariation) setMetallicVariation(changes.metallicVariation.value)
      if (changes.emissiveIntensity) setEmissiveIntensity(changes.emissiveIntensity.value)
      if (changes.clearcoatStrength) setClearcoatStrength(changes.clearcoatStrength.value)
      if (changes.clearcoatRoughness) setClearcoatRoughness(changes.clearcoatRoughness.value)
      if (changes.anisotropy) setAnisotropy(changes.anisotropy.value)
      if (changes.anisotropyRotation) setAnisotropyRotation(changes.anisotropyRotation.value)
      if (changes.sheenRoughness) setSheenRoughness(changes.sheenRoughness.value)
      if (changes.transmission) setTransmission(changes.transmission.value)
      if (changes.thickness) setThickness(changes.thickness.value)
      if (changes.attenuationDistance) setAttenuationDistance(changes.attenuationDistance.value)
      
      // Shader Effects
      if (changes.fresnelEffect) setFresnelEffect(changes.fresnelEffect.value)
      if (changes.fresnelStrength) setFresnelStrength(changes.fresnelStrength.value)
      if (changes.rimLighting) setRimLighting(changes.rimLighting.value)
      if (changes.rimStrength) setRimStrength(changes.rimStrength.value)
      if (changes.matcapReflection) setMatcapReflection(changes.matcapReflection.value)
      if (changes.environmentMapping) setEnvironmentMapping(changes.environmentMapping.value)
      if (changes.iridescence) setIridescence(changes.iridescence.value)
      if (changes.iridescenceStrength) setIridescenceStrength(changes.iridescenceStrength.value)
      if (changes.iridescenceThickness) setIridescenceThickness(changes.iridescenceThickness.value)
    }
    world.prefs.on('change', onChange)
    return () => world.prefs.off('change', onChange)
  }, [])

  const applyPreset = (presetName) => {
    console.log(`🎨 Applying ${presetName} advanced graphics preset...`)
    
    switch (presetName) {
      case 'ultra':
        world.prefs.setMaterialQuality('ultra')
        world.prefs.setProceduralMaterials(true)
        world.prefs.setDynamicMaterialLOD(true)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(true)
        world.prefs.setVolumetricShadows(true)
        world.prefs.setContactShadows(true)
        world.prefs.setTemporalShadowFiltering(true)
        world.prefs.setVariableRateShadows(true)
        world.prefs.setShadowAtlasQuality('ultra')
        world.prefs.setGPUDrivenCulling(true)
        world.prefs.setGPUParticleSimulation(true)
        world.prefs.setGPULODSelection(true)
        world.prefs.setRayTracedReflections(true)
        world.prefs.setRayTracedGlobalIllumination(true)
        world.prefs.setRayTracedShadows(true)
        break
      case 'high':
        world.prefs.setMaterialQuality('enhanced')
        world.prefs.setProceduralMaterials(true)
        world.prefs.setDynamicMaterialLOD(true)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(true)
        world.prefs.setVolumetricShadows(false)
        world.prefs.setContactShadows(true)
        world.prefs.setTemporalShadowFiltering(true)
        world.prefs.setVariableRateShadows(true)
        world.prefs.setShadowAtlasQuality('high')
        world.prefs.setGPUDrivenCulling(true)
        world.prefs.setGPUParticleSimulation(true)
        world.prefs.setGPULODSelection(true)
        world.prefs.setRayTracedReflections(false)
        world.prefs.setRayTracedGlobalIllumination(false)
        world.prefs.setRayTracedShadows(false)
        break
      case 'balanced':
        world.prefs.setMaterialQuality('enhanced')
        world.prefs.setProceduralMaterials(true)
        world.prefs.setDynamicMaterialLOD(true)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(true)
        world.prefs.setVolumetricShadows(false)
        world.prefs.setContactShadows(false)
        world.prefs.setTemporalShadowFiltering(false)
        world.prefs.setVariableRateShadows(false)
        world.prefs.setShadowAtlasQuality('medium')
        world.prefs.setGPUDrivenCulling(true)
        world.prefs.setGPUParticleSimulation(false)
        world.prefs.setGPULODSelection(true)
        world.prefs.setRayTracedReflections(false)
        world.prefs.setRayTracedGlobalIllumination(false)
        world.prefs.setRayTracedShadows(false)
        break
      case 'performance':
        world.prefs.setMaterialQuality('basic')
        world.prefs.setProceduralMaterials(false)
        world.prefs.setDynamicMaterialLOD(false)
        world.prefs.setMaterialBatching(true)
        world.prefs.setCascadedShadowMaps(false)
        world.prefs.setVolumetricShadows(false)
        world.prefs.setContactShadows(false)
        world.prefs.setTemporalShadowFiltering(false)
        world.prefs.setVariableRateShadows(false)
        world.prefs.setShadowAtlasQuality('low')
        world.prefs.setGPUDrivenCulling(false)
        world.prefs.setGPUParticleSimulation(false)
        world.prefs.setGPULODSelection(false)
        world.prefs.setRayTracedReflections(false)
        world.prefs.setRayTracedGlobalIllumination(false)
        world.prefs.setRayTracedShadows(false)
        break
    }
  }

  const materialQualityOptions = [
    { label: 'Basic', value: 'basic' },
    { label: 'Standard', value: 'standard' },
    { label: 'Enhanced', value: 'enhanced' },
    { label: 'AAA', value: 'aaa' },
    { label: 'Ultra', value: 'ultra' }
  ]

  const shadowAtlasOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Ultra', value: 'ultra' }
  ]

  return (
    <Menu title='Advanced Graphics'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      {/* Graphics Presets */}
      <MenuItemBtn label='— Graphics Presets —' disabled />
      <MenuItemBtn 
        label='🚀 Ultra' 
        hint='Maximum quality with all features enabled'
        onClick={() => applyPreset('ultra')}
      />
      <MenuItemBtn 
        label='⚡ High' 
        hint='High quality with most features enabled'
        onClick={() => applyPreset('high')}
      />
      <MenuItemBtn 
        label='⚖️ Balanced' 
        hint='Balanced quality and performance'
        onClick={() => applyPreset('balanced')}
      />
      <MenuItemBtn 
        label='💨 Performance' 
        hint='Optimized for maximum performance'
        onClick={() => applyPreset('performance')}
      />
      
      {/* Material Quality Section */}
      <MenuItemBtn label='— Material Quality —' disabled />
      <MenuItemSwitch
        label='Material Quality'
        hint='Overall material rendering quality'
        options={materialQualityOptions}
        value={materialQuality}
        onChange={quality => world.prefs.setMaterialQuality(quality)}
      />
      <MenuItemToggle
        label='Procedural Materials'
        hint='Enable procedural material generation'
        trueLabel='On'
        falseLabel='Off'
        value={proceduralMaterials}
        onChange={enabled => world.prefs.setProceduralMaterials(enabled)}
      />
      <MenuItemToggle
        label='Dynamic Material LOD'
        hint='Dynamic material level of detail'
        trueLabel='On'
        falseLabel='Off'
        value={dynamicMaterialLOD}
        onChange={enabled => world.prefs.setDynamicMaterialLOD(enabled)}
      />
      <MenuItemToggle
        label='Material Batching'
        hint='Batch similar materials for performance'
        trueLabel='On'
        falseLabel='Off'
        value={materialBatching}
        onChange={enabled => world.prefs.setMaterialBatching(enabled)}
      />
      
      {/* Shadow Settings Section */}
      <MenuItemBtn label='— Shadow Settings —' disabled />
      <MenuItemToggle
        label='Cascaded Shadow Maps'
        hint='High-quality cascaded shadow mapping'
        trueLabel='On'
        falseLabel='Off'
        value={cascadedShadowMaps}
        onChange={enabled => world.prefs.setCascadedShadowMaps(enabled)}
      />
      <MenuItemToggle
        label='Volumetric Shadows'
        hint='Volumetric lighting and shadow effects'
        trueLabel='On'
        falseLabel='Off'
        value={volumetricShadows}
        onChange={enabled => world.prefs.setVolumetricShadows(enabled)}
      />
      <MenuItemToggle
        label='Contact Shadows'
        hint='Contact shadow mapping for detail'
        trueLabel='On'
        falseLabel='Off'
        value={contactShadows}
        onChange={enabled => world.prefs.setContactShadows(enabled)}
      />
      <MenuItemToggle
        label='Temporal Shadow Filtering'
        hint='Temporal shadow filtering for smoothness'
        trueLabel='On'
        falseLabel='Off'
        value={temporalShadowFiltering}
        onChange={enabled => world.prefs.setTemporalShadowFiltering(enabled)}
      />
      <MenuItemToggle
        label='Variable Rate Shadows'
        hint='Variable rate shadow rendering'
        trueLabel='On'
        falseLabel='Off'
        value={variableRateShadows}
        onChange={enabled => world.prefs.setVariableRateShadows(enabled)}
      />
      <MenuItemSwitch
        label='Shadow Atlas Quality'
        hint='Shadow texture atlas quality'
        options={shadowAtlasOptions}
        value={shadowAtlasQuality}
        onChange={quality => world.prefs.setShadowAtlasQuality(quality)}
      />
      
      {/* GPU Compute Section */}
      <MenuItemBtn label='— GPU Compute —' disabled />
      <MenuItemToggle
        label='GPU-Driven Culling'
        hint='GPU-accelerated object culling'
        trueLabel='On'
        falseLabel='Off'
        value={gpuDrivenCulling}
        onChange={enabled => world.prefs.setGPUDrivenCulling(enabled)}
      />
      <MenuItemToggle
        label='GPU Particle Simulation'
        hint='GPU-accelerated particle systems'
        trueLabel='On'
        falseLabel='Off'
        value={gpuParticleSimulation}
        onChange={enabled => world.prefs.setGPUParticleSimulation(enabled)}
      />
      <MenuItemToggle
        label='GPU LOD Selection'
        hint='GPU-accelerated level of detail'
        trueLabel='On'
        falseLabel='Off'
        value={gpuLODSelection}
        onChange={enabled => world.prefs.setGPULODSelection(enabled)}
      />
      
      {/* Ray Tracing Section */}
      <MenuItemBtn label='— Ray Tracing —' disabled />
      <MenuItemToggle
        label='Ray Traced Reflections'
        hint='Hardware ray traced reflections'
        trueLabel='On'
        falseLabel='Off'
        value={rayTracedReflections}
        onChange={enabled => world.prefs.setRayTracedReflections(enabled)}
      />
      <MenuItemToggle
        label='Ray Traced Global Illumination'
        hint='Hardware ray traced global illumination'
        trueLabel='On'
        falseLabel='Off'
        value={rayTracedGlobalIllumination}
        onChange={enabled => world.prefs.setRayTracedGlobalIllumination(enabled)}
      />
      <MenuItemToggle
        label='Ray Traced Shadows'
        hint='Hardware ray traced shadows'
        trueLabel='On'
        falseLabel='Off'
        value={rayTracedShadows}
        onChange={enabled => world.prefs.setRayTracedShadows(enabled)}
      />
      
      {/* Shader Quality Section */}
      <MenuItemBtn label='— Shader Quality —' disabled />
      <MenuItemSwitch
        label='Shader Quality'
        hint='Overall shader rendering quality'
        options={materialQualityOptions}
        value={shaderQuality}
        onChange={quality => world.prefs.setShaderQuality(quality)}
      />
      <MenuItemSwitch
        label='Material Detail'
        hint='Level of material detail and complexity'
        options={materialQualityOptions}
        value={materialDetail}
        onChange={detail => world.prefs.setMaterialDetail(detail)}
      />
      <MenuItemSwitch
        label='Reflection Quality'
        hint='Quality of reflection and mirror effects'
        options={materialQualityOptions}
        value={reflectionQuality}
        onChange={quality => world.prefs.setReflectionQuality(quality)}
      />
      <MenuItemToggle
        label='Subsurface Scattering'
        hint='Realistic skin and material subsurface effects'
        trueLabel='On'
        falseLabel='Off'
        value={subsurfaceScattering}
        onChange={enabled => world.prefs.setSubsurfaceScattering(enabled)}
      />
      <MenuItemToggle
        label='Parallax Mapping'
        hint='Height-based texture displacement'
        trueLabel='On'
        falseLabel='Off'
        value={parallaxMapping}
        onChange={enabled => world.prefs.setParallaxMapping(enabled)}
      />
      <MenuItemToggle
        label='Tessellation'
        hint='Dynamic geometry subdivision'
        trueLabel='On'
        falseLabel='Off'
        value={tessellation}
        onChange={enabled => world.prefs.setTessellation(enabled)}
      />
      
      {/* Advanced Material Properties Section */}
      <MenuItemBtn label='— Material Properties —' disabled />
      <MenuItemRange
        label='Normal Map Strength'
        hint='Strength of normal map detail (0.0-3.0)'
        min={0.0}
        max={3.0}
        step={0.1}
        value={normalMapStrength}
        onChange={value => world.prefs.setNormalMapStrength(value)}
      />
      <MenuItemRange
        label='Roughness Variation'
        hint='Variation in surface roughness (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={roughnessVariation}
        onChange={value => world.prefs.setRoughnessVariation(value)}
      />
      <MenuItemRange
        label='Metallic Variation'
        hint='Variation in metallic properties (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={metallicVariation}
        onChange={value => world.prefs.setMetallicVariation(value)}
      />
      <MenuItemRange
        label='Emissive Intensity'
        hint='Strength of glowing materials (0.0-5.0)'
        min={0.0}
        max={5.0}
        step={0.1}
        value={emissiveIntensity}
        onChange={value => world.prefs.setEmissiveIntensity(value)}
      />
      <MenuItemRange
        label='Clearcoat Strength'
        hint='Strength of clearcoat layer (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={clearcoatStrength}
        onChange={value => world.prefs.setClearcoatStrength(value)}
      />
      <MenuItemRange
        label='Clearcoat Roughness'
        hint='Roughness of clearcoat layer (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={clearcoatRoughness}
        onChange={value => world.prefs.setClearcoatRoughness(value)}
      />
      <MenuItemRange
        label='Anisotropy'
        hint='Directional reflection strength (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={anisotropy}
        onChange={value => world.prefs.setAnisotropy(value)}
      />
      <MenuItemRange
        label='Anisotropy Rotation'
        hint='Rotation of anisotropic reflections (0.0-6.28)'
        min={0.0}
        max={6.28}
        step={0.1}
        value={anisotropyRotation}
        onChange={value => world.prefs.setAnisotropyRotation(value)}
      />
      <MenuItemRange
        label='Sheen Roughness'
        hint='Roughness of sheen layer (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={sheenRoughness}
        onChange={value => world.prefs.setSheenRoughness(value)}
      />
      <MenuItemRange
        label='Transmission'
        hint='Light transmission through materials (0.0-1.0)'
        min={0.0}
        max={1.0}
        step={0.1}
        value={transmission}
        onChange={value => world.prefs.setTransmission(value)}
      />
      <MenuItemRange
        label='Thickness'
        hint='Material thickness for transmission (0.0-10.0)'
        min={0.0}
        max={10.0}
        step={0.1}
        value={thickness}
        onChange={value => world.prefs.setThickness(value)}
      />
      <MenuItemRange
        label='Attenuation Distance'
        hint='Distance for transmission attenuation (0.0-10.0)'
        min={0.0}
        max={10.0}
        step={0.1}
        value={attenuationDistance}
        onChange={value => world.prefs.setAttenuationDistance(value)}
      />
      
      {/* Shader Effects Section */}
      <MenuItemBtn label='— Shader Effects —' disabled />
      <MenuItemToggle
        label='Fresnel Effect'
        hint='View-dependent reflection effect'
        trueLabel='On'
        falseLabel='Off'
        value={fresnelEffect}
        onChange={enabled => world.prefs.setFresnelEffect(enabled)}
      />
      <MenuItemRange
        label='Fresnel Strength'
        hint='Strength of fresnel effect (0.0-5.0)'
        min={0.0}
        max={5.0}
        step={0.1}
        value={fresnelStrength}
        onChange={value => world.prefs.setFresnelStrength(value)}
      />
      <MenuItemToggle
        label='Rim Lighting'
        hint='Edge lighting effect'
        trueLabel='On'
        falseLabel='Off'
        value={rimLighting}
        onChange={enabled => world.prefs.setRimLighting(enabled)}
      />
      <MenuItemRange
        label='Rim Strength'
        hint='Strength of rim lighting (0.0-5.0)'
        min={0.0}
        max={5.0}
        step={0.1}
        value={rimStrength}
        onChange={value => world.prefs.setRimStrength(value)}
      />
      <MenuItemToggle
        label='Matcap Reflection'
        hint='Material capture reflection mapping'
        trueLabel='On'
        falseLabel='Off'
        value={matcapReflection}
        onChange={enabled => world.prefs.setMatcapReflection(enabled)}
      />
      <MenuItemToggle
        label='Environment Mapping'
        hint='Environment reflection mapping'
        trueLabel='On'
        falseLabel='Off'
        value={environmentMapping}
        onChange={enabled => world.prefs.setEnvironmentMapping(enabled)}
      />
      <MenuItemToggle
        label='Iridescence'
        hint='Rainbow-like color shifting effect'
        trueLabel='On'
        falseLabel='Off'
        value={iridescence}
        onChange={enabled => world.prefs.setIridescence(enabled)}
      />
      <MenuItemRange
        label='Iridescence Strength'
        hint='Strength of iridescence effect (0.0-5.0)'
        min={0.0}
        max={5.0}
        step={0.1}
        value={iridescenceStrength}
        onChange={value => world.prefs.setIridescenceStrength(value)}
      />
      <MenuItemRange
        label='Iridescence Thickness'
        hint='Thickness for iridescence calculation (0.0-5.0)'
        min={0.0}
        max={5.0}
        step={0.1}
        value={iridescenceThickness}
        onChange={value => world.prefs.setIridescenceThickness(value)}
      />
    </Menu>
  )
}

// Audio settings menu
function MenuMainAudio({ world, pop, push }) {
  const [music, setMusic] = useState(world.prefs.music || 1)
  const [sfx, setSFX] = useState(world.prefs.sfx || 1)
  const [voice, setVoice] = useState(world.prefs.voice || 1)

  useEffect(() => {
    const onChange = changes => {
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
    }
    world.prefs.on('change', onChange)
    return () => world.prefs.off('change', onChange)
  }, [])

  return (
    <Menu title='Audio Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      
      <MenuItemBtn label='— Volume Levels —' disabled />
      <MenuItemRange
        label='Music Volume'
        hint='Background music volume (0-1)'
        min={0}
        max={1}
        step={0.1}
        value={music}
        onChange={value => world.prefs.setMusic(value)}
      />
      <MenuItemRange
        label='SFX Volume'
        hint='Sound effects volume (0-1)'
        min={0}
        max={1}
        step={0.1}
        value={sfx}
        onChange={value => world.prefs.setSFX(value)}
      />
      <MenuItemRange
        label='Voice Volume'
        hint='Voice chat volume (0-1)'
        min={0}
        max={1}
        step={0.1}
        value={voice}
        onChange={value => world.prefs.setVoice(value)}
      />
    </Menu>
  )
}

// World settings menu
function MenuMainWorld({ world, pop, push }) {
  return (
    <Menu title='World Settings'>
      <MenuItemBack hint='Go back to the main menu' onClick={pop} />
      <MenuItemBtn label='Coming Soon' hint='World and environment settings' disabled />
    </Menu>
  )
}

// Main menu router
export default function MenuMain({ world, hidden, route, ...routeProps }) {
  if (hidden) return null

  const routes = {
    index: () => <MenuMainIndex world={world} {...routeProps} />,
    display: () => <MenuMainDisplay world={world} {...routeProps} />,
    graphics: () => <MenuMainGraphics world={world} {...routeProps} />,
    effects: () => <MenuMainEffects world={world} {...routeProps} />,
    performance: () => <MenuMainPerformance world={world} {...routeProps} />,
    advanced: () => <MenuMainAdvanced world={world} {...routeProps} />,
    audio: () => <MenuMainAudio world={world} {...routeProps} />,
    world: () => <MenuMainWorld world={world} {...routeProps} />
  }

  const Component = routes[route] || routes.index
  return <Component />
}

