import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useState, useContext } from 'react'
import { 
  UserIcon, 
  MonitorIcon,
  SunIcon, 
  VolumeXIcon,
  CpuIcon,
  EyeIcon,
  ZapIcon,
  PaletteIcon,
  TrendingUpIcon,
  SettingsIcon,
  InfoIcon
} from 'lucide-react'
import { InputText, InputDropdown, InputSwitch, InputRange } from './Inputs'
import { HintContext } from './Hint'
import { usePermissions } from './usePermissions'

// Enhanced option definitions for AAA graphics settings
const shadowOptions = [
  { label: 'Off', value: 'none', performance: '++' },
  { label: 'Low', value: 'low', performance: '+' },
  { label: 'Medium', value: 'med', performance: '0' },
  { label: 'High', value: 'high', performance: '-' },
]

const rendererOptions = [
  { label: 'Auto (Recommended)', value: 'auto', description: 'Automatically select best renderer' },
  { label: 'WebGPU (Modern)', value: 'webgpu', description: 'Next-gen graphics API' },
  { label: 'WebGL (Compatible)', value: 'webgl', description: 'Legacy graphics API' },
]

const webglAntialiasingOptions = [
  { label: 'Off', value: 'none', performance: '++' },
  { label: 'FXAA (Fast)', value: 'fxaa', performance: '+' },
  { label: 'SMAA (Recommended)', value: 'smaa', performance: '0' },
  { label: 'TAA (Temporal)', value: 'taa', performance: '-' },
  { label: 'MSAA 2x (Hardware)', value: 'msaa2x', performance: '--' },
  { label: 'MSAA 4x (Hardware)', value: 'msaa4x', performance: '---' },
  { label: 'MSAA 8x (Hardware)', value: 'msaa8x', performance: '----' },
]

const webgpuAntialiasingOptions = [
  { label: 'Off', value: 'none', performance: '++' },
  { label: 'FXAA (GPU Optimized)', value: 'fxaa', performance: '+' },
  { label: 'SMAA (GPU Accelerated)', value: 'smaa', performance: '+' },
  { label: 'TAA (Advanced)', value: 'taa', performance: '0' },
  { label: 'MSAA 2x (Native)', value: 'msaa2x', performance: '-' },
  { label: 'MSAA 4x (Native)', value: 'msaa4x', performance: '--' },
  { label: 'MSAA 8x (Native)', value: 'msaa8x', performance: '---' },
]

// Auto-detect best options based on renderer
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
  { label: 'Low (512px)', value: 'low', performance: '++' },
  { label: 'Medium (1024px)', value: 'medium', performance: '+' },
  { label: 'High (2048px)', value: 'high', performance: '0' },
  { label: 'Ultra (4096px)', value: 'ultra', performance: '--' },
]

const anisotropicOptions = [
  { label: '1x', value: 1, performance: '++' },
  { label: '2x', value: 2, performance: '+' },
  { label: '4x', value: 4, performance: '0' },
  { label: '8x', value: 8, performance: '-' },
  { label: '16x', value: 16, performance: '--' },
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

const onOffOptions = [
  { label: 'Off', value: false },
  { label: 'On', value: true },
]

// Performance indicator component
function PerformanceIndicator({ value }) {
  const getColor = (perf) => {
    if (perf.includes('+')) return '#4ade80' // Green
    if (perf.includes('-')) return '#f87171' // Red
    return '#fbbf24' // Yellow
  }
  
  if (!value) return null
  
  return (
    <span 
      css={css`
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: ${getColor(value)}20;
        color: ${getColor(value)};
        font-weight: 500;
      `}
    >
      {value}
    </span>
  )
}

// Modern field component with performance indicators
function ModernField({ label, hint, performance, children, icon: Icon }) {
  const { setHint } = useContext(HintContext)
  
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        padding: 12px 20px;
        border-radius: 8px;
        transition: all 0.2s ease;
        
        &:hover {
          background: rgba(255, 255, 255, 0.02);
          transform: translateX(2px);
        }
        
        .field-icon {
          width: 16px;
          height: 16px;
          margin-right: 12px;
          color: rgba(255, 255, 255, 0.4);
        }
        
        .field-label {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          
          .label-text {
            font-size: 14px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
          }
        }
        
        .field-control {
          min-width: 180px;
            display: flex;
          align-items: center;
          gap: 8px;
        }
      `}
      onPointerEnter={() => setHint(hint)}
      onPointerLeave={() => setHint(null)}
    >
      {Icon && <Icon className="field-icon" size={16} />}
      <div className="field-label">
        <span className="label-text">{label}</span>
        <PerformanceIndicator value={performance} />
      </div>
      <div className="field-control">
        {children}
      </div>
    </div>
  )
}

// Modern section header
function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div
      css={css`
            display: flex;
            align-items: center;
        padding: 20px 20px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        margin-bottom: 8px;
        
        .section-icon {
          width: 20px;
          height: 20px;
          margin-right: 12px;
          color: #3b82f6;
        }
        
        .section-content {
          flex: 1;
          
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            margin-bottom: 4px;
          }
          
          .section-description {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.5);
            line-height: 1.4;
          }
        }
      `}
    >
      <Icon className="section-icon" size={20} />
      <div className="section-content">
        <div className="section-title">{title}</div>
        <div className="section-description">{description}</div>
      </div>
    </div>
  )
}

function GeneralSettings({ world, player }) {
  // Player settings
  const [name, setName] = useState(() => player.data.name)
  
  // Display settings
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [fieldOfView, setFieldOfView] = useState(world.prefs.fieldOfView)
  const [gamma, setGamma] = useState(world.prefs.gamma)
  const [brightness, setBrightness] = useState(world.prefs.brightness)
  const [contrast, setContrast] = useState(world.prefs.contrast)
  
  // Rendering settings
  const [renderer, setRenderer] = useState(world.prefs.renderer)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [antialiasing, setAntialiasing] = useState(world.prefs.antialiasing)
  const [textureQuality, setTextureQuality] = useState(world.prefs.textureQuality)
  const [anisotropicFiltering, setAnisotropicFiltering] = useState(world.prefs.anisotropicFiltering)
  const [lodDistance, setLODDistance] = useState(world.prefs.lodDistance)
  
  // Post-processing settings
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [ao, setAO] = useState(world.prefs.ao)
  const [depthOfField, setDepthOfField] = useState(world.prefs.depthOfField)
  const [motionBlur, setMotionBlur] = useState(world.prefs.motionBlur)
  const [ssReflections, setSSReflections] = useState(world.prefs.ssReflections)
  const [volumetricLighting, setVolumetricLighting] = useState(world.prefs.volumetricLighting)
  
  // Performance settings
  const [vsync, setVSync] = useState(world.prefs.vsync)
  const [frameRateLimit, setFrameRateLimit] = useState(world.prefs.frameRateLimit)
  
  // Tone mapping settings
  const [toneMappingMode, setToneMappingMode] = useState(world.prefs.toneMappingMode)
  const [toneMappingExposure, setToneMappingExposure] = useState(world.prefs.toneMappingExposure)
  
  // Audio settings
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)

  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr, perf) => {
      options.push({
        label: `${label} (${Math.round(width * dpr)} × ${Math.round(height * dpr)})`,
        value: dpr,
        performance: perf
      })
    }
    add('Low', 0.5, '++')
    add('High', 1, '0')
    if (dpr >= 2) add('Ultra', 2, '--')
    if (dpr >= 3) add('Insane', dpr, '---')
    return options
  }, [])

  useEffect(() => {
    const onChange = changes => {
      // Display settings
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.fieldOfView) setFieldOfView(changes.fieldOfView.value)
      if (changes.gamma) setGamma(changes.gamma.value)
      if (changes.brightness) setBrightness(changes.brightness.value)
      if (changes.contrast) setContrast(changes.contrast.value)
      
      // Rendering settings
      if (changes.renderer) setRenderer(changes.renderer.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.antialiasing) setAntialiasing(changes.antialiasing.value)
      if (changes.textureQuality) setTextureQuality(changes.textureQuality.value)
      if (changes.anisotropicFiltering) setAnisotropicFiltering(changes.anisotropicFiltering.value)
      if (changes.lodDistance) setLODDistance(changes.lodDistance.value)
      
      // Post-processing settings
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.depthOfField) setDepthOfField(changes.depthOfField.value)
      if (changes.motionBlur) setMotionBlur(changes.motionBlur.value)
      if (changes.ssReflections) setSSReflections(changes.ssReflections.value)
      if (changes.volumetricLighting) setVolumetricLighting(changes.volumetricLighting.value)
      
      // Performance settings
      if (changes.vsync) setVSync(changes.vsync.value)
      if (changes.frameRateLimit) setFrameRateLimit(changes.frameRateLimit.value)
      
      // Tone mapping settings
      if (changes.toneMappingMode) setToneMappingMode(changes.toneMappingMode.value)
      if (changes.toneMappingExposure) setToneMappingExposure(changes.toneMappingExposure.value)
      
      // Audio settings
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
      className='settings-container noscrollbar'
      css={css`
        padding: 0;
        max-height: 600px;
        overflow-y: auto;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(20px);
        
        /* Custom scrollbar */
        &::-webkit-scrollbar {
          width: 6px;
        }
        &::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        &::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          &:hover {
            background: rgba(255, 255, 255, 0.3);
          }
        }
      `}
    >
      {/* Player Section */}
      <SectionHeader 
        icon={UserIcon} 
        title="Player" 
        description="Customize your identity and profile settings"
      />
      <ModernField 
        label="Display Name" 
        hint="Change your display name visible to other players"
        icon={UserIcon}
      >
          <InputText
            value={name}
            onChange={name => {
              if (!name) {
                return setName(player.data.name)
              }
              player.modify({ name })
            }}
          />
      </ModernField>

      {/* Display Section */}
      <SectionHeader 
        icon={MonitorIcon} 
        title="Display" 
        description="Screen resolution, field of view, and visual calibration"
      />
      <ModernField 
        label="Resolution Scale" 
        hint="Higher values improve image quality but reduce performance"
        performance={dprOptions.find(o => o.value === dpr)?.performance}
        icon={MonitorIcon}
      >
        <InputDropdown 
          options={dprOptions} 
          value={dpr} 
          onChange={dpr => world.prefs.setDPR(dpr)} 
        />
      </ModernField>
      
      <ModernField 
        label="Field of View" 
        hint="Adjust your viewing angle (60-120°). Higher values show more of the world"
        icon={EyeIcon}
      >
        <InputRange 
          min={60} 
          max={120} 
          step={1} 
          value={fieldOfView}
          onChange={fov => world.prefs.setFieldOfView(fov)}
          instant={true}
        />
      </ModernField>
      
      <ModernField 
        label="Gamma Correction" 
        hint="Adjust overall brightness curve (1.8-2.6). Lower values brighten dark areas"
        icon={PaletteIcon}
      >
        <InputRange 
          min={1.8} 
          max={2.6} 
          step={0.1} 
          value={gamma}
          onChange={gamma => world.prefs.setGamma(gamma)}
          instant={true}
        />
      </ModernField>
      
      <ModernField 
        label="Brightness" 
        hint="Adjust overall image brightness (0.5-2.0)"
        icon={SunIcon}
      >
        <InputRange 
          min={0.5} 
          max={2.0} 
          step={0.1} 
          value={brightness}
          onChange={brightness => world.prefs.setBrightness(brightness)}
          instant={true}
        />
      </ModernField>
      
      <ModernField 
        label="Contrast" 
        hint="Adjust difference between light and dark areas (0.5-2.0)"
        icon={PaletteIcon}
      >
        <InputRange 
          min={0.5} 
          max={2.0} 
          step={0.1} 
          value={contrast}
          onChange={contrast => world.prefs.setContrast(contrast)}
          instant={true}
        />
      </ModernField>

      {/* Rendering Section */}
      <SectionHeader 
        icon={CpuIcon} 
        title="Rendering" 
        description="Core graphics settings that affect image quality and performance"
      />
      <ModernField 
        label="Graphics API" 
        hint="Choose rendering backend. WebGPU offers better performance on modern devices"
        icon={CpuIcon}
      >
        <InputSwitch 
          options={rendererOptions} 
          value={renderer} 
          onChange={newRenderer => world.prefs.setRenderer(newRenderer)}
        />
      </ModernField>
      
      <ModernField 
        label="Shadow Quality" 
        hint="Higher quality shadows look more realistic but impact performance"
        performance={shadowOptions.find(o => o.value === shadows)?.performance}
        icon={SunIcon}
      >
        <InputSwitch 
          options={shadowOptions} 
          value={shadows} 
          onChange={shadows => world.prefs.setShadows(shadows)} 
        />
      </ModernField>
      
      <ModernField 
        label="Anti-Aliasing" 
        hint={`Reduces jagged edges. ${renderer === 'webgl' ? 'WebGL: FXAA is fast, SMAA is balanced, TAA/MSAA are highest quality' : renderer === 'webgpu' ? 'WebGPU: All methods use modern GPU acceleration' : 'Auto: Options adapt to selected renderer'}`}
        performance={getAntialiasingOptions(renderer).find(o => o.value === antialiasing)?.performance}
        icon={SettingsIcon}
      >
        <InputSwitch 
          options={getAntialiasingOptions(renderer)} 
          value={antialiasing} 
          onChange={aa => world.prefs.setAntialiasing(aa)} 
        />
      </ModernField>
      
      <ModernField 
        label="Texture Quality" 
        hint="Higher quality textures are sharper but use more memory"
        performance={textureQualityOptions.find(o => o.value === textureQuality)?.performance}
        icon={PaletteIcon}
      >
        <InputSwitch 
          options={textureQualityOptions} 
          value={textureQuality} 
          onChange={quality => world.prefs.setTextureQuality(quality)} 
        />
      </ModernField>
      
      <ModernField 
        label="Anisotropic Filtering" 
        hint="Improves texture sharpness at distance. Higher values look better but cost performance"
        performance={anisotropicOptions.find(o => o.value === anisotropicFiltering)?.performance}
        icon={EyeIcon}
      >
        <InputSwitch 
          options={anisotropicOptions} 
          value={anisotropicFiltering} 
          onChange={af => world.prefs.setAnisotropicFiltering(af)} 
        />
      </ModernField>
      
      <ModernField 
        label="LOD Distance" 
        hint="Controls how far away objects switch to lower detail (0.5x-2.0x)"
        icon={TrendingUpIcon}
      >
        <InputRange 
          min={0.5} 
          max={2.0} 
          step={0.1} 
          value={lodDistance}
          onChange={lod => world.prefs.setLODDistance(lod)}
          instant={true}
        />
      </ModernField>

      {/* Post-Processing Section */}
      <SectionHeader 
        icon={ZapIcon} 
        title="Post-Processing Effects" 
        description="Visual effects that enhance realism and atmosphere"
      />
      <ModernField 
        label="Post-Processing" 
        hint="Enable or disable all post-processing effects"
        icon={ZapIcon}
      >
          <InputSwitch
            options={onOffOptions}
            value={postprocessing}
            onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
          />
      </ModernField>
      
      {postprocessing && (
        <>
          <ModernField 
            label="Bloom" 
            hint="Makes bright objects glow. Adds realism to light sources"
            icon={SunIcon}
          >
            <InputSwitch
              options={onOffOptions}
              value={bloom}
              onChange={bloom => world.prefs.setBloom(bloom)}
            />
          </ModernField>
          
          {world.settings.ao && (
            <ModernField 
              label="Ambient Occlusion" 
              hint="Adds realistic shadows in corners and crevices"
              icon={EyeIcon}
            >
              <InputSwitch
                options={onOffOptions}
                value={ao}
                onChange={ao => world.prefs.setAO(ao)}
              />
            </ModernField>
          )}
          
          <ModernField 
            label="Depth of Field" 
            hint="Blurs objects that are out of focus, like a camera"
            icon={EyeIcon}
          >
            <InputSwitch
              options={onOffOptions}
              value={depthOfField}
              onChange={dof => world.prefs.setDepthOfField(dof)}
            />
          </ModernField>
          
          <ModernField 
            label="Motion Blur" 
            hint="Adds blur to fast-moving objects for cinematic feel"
            icon={ZapIcon}
          >
            <InputSwitch
              options={onOffOptions}
              value={motionBlur}
              onChange={mb => world.prefs.setMotionBlur(mb)}
            />
          </ModernField>
          
          <ModernField 
            label="Screen Space Reflections" 
            hint="Adds realistic reflections to surfaces"
            icon={EyeIcon}
          >
            <InputSwitch
              options={onOffOptions}
              value={ssReflections}
              onChange={ssr => world.prefs.setSSReflections(ssr)}
            />
          </ModernField>
          
          <ModernField 
            label="Volumetric Lighting" 
            hint="Creates realistic light rays and atmospheric effects"
            icon={SunIcon}
          >
            <InputSwitch
              options={onOffOptions}
              value={volumetricLighting}
              onChange={vl => world.prefs.setVolumetricLighting(vl)}
            />
          </ModernField>
        </>
      )}

      {/* Tone Mapping Section */}
      <SectionHeader 
        icon={PaletteIcon} 
        title="Tone Mapping" 
        description="Control how colors and brightness are displayed"
      />
      <ModernField 
        label="Tone Mapping Mode" 
        hint="ACES Filmic provides the most cinematic look"
        icon={PaletteIcon}
      >
        <InputSwitch 
          options={toneMappingOptions} 
          value={toneMappingMode} 
          onChange={mode => world.prefs.setToneMappingMode(mode)} 
        />
      </ModernField>
      
      <ModernField 
        label="Exposure" 
        hint="Adjust overall scene brightness (0.1-3.0). Higher values brighten the scene"
        icon={SunIcon}
      >
        <InputRange 
          min={0.1} 
          max={3.0} 
          step={0.1} 
          value={toneMappingExposure}
          onChange={exposure => world.prefs.setToneMappingExposure(exposure)}
          instant={true}
        />
      </ModernField>

      {/* Performance Section */}
      <SectionHeader 
        icon={TrendingUpIcon} 
        title="Performance" 
        description="Frame rate and performance optimization settings"
      />
      <ModernField 
        label="V-Sync" 
        hint="Prevents screen tearing but may add input lag"
        icon={MonitorIcon}
      >
        <InputSwitch
          options={onOffOptions}
          value={vsync}
          onChange={vsync => world.prefs.setVSync(vsync)}
        />
      </ModernField>
      
      <ModernField 
        label="Frame Rate Limit" 
        hint="Cap maximum frame rate to save power or reduce heat"
        icon={TrendingUpIcon}
      >
        <InputSwitch 
          options={frameRateLimitOptions} 
          value={frameRateLimit} 
          onChange={limit => world.prefs.setFrameRateLimit(limit)} 
        />
      </ModernField>

      {/* Audio Section */}
      <SectionHeader 
        icon={VolumeXIcon} 
        title="Audio" 
        description="Volume levels for different audio types"
      />
      <ModernField 
        label="Music Volume" 
        hint="Adjust background music volume (0-200%)"
        icon={VolumeXIcon}
      >
          <InputRange
          min={0}
          max={2}
          step={0.05}
            value={music}
          onChange={music => world.prefs.setMusic(music)}
          instant={true}
        />
      </ModernField>
      
      <ModernField 
        label="Sound Effects" 
        hint="Adjust sound effects volume (0-200%)"
        icon={VolumeXIcon}
      >
        <InputRange
            min={0}
            max={2}
            step={0.05}
          value={sfx}
          onChange={sfx => world.prefs.setSFX(sfx)}
          instant={true}
        />
      </ModernField>
      
      <ModernField 
        label="Voice Chat" 
        hint="Adjust voice chat volume (0-200%)"
        icon={VolumeXIcon}
      >
          <InputRange
            min={0}
            max={2}
            step={0.05}
          value={voice}
          onChange={voice => world.prefs.setVoice(voice)}
          instant={true}
          />
      </ModernField>
    </div>
  )
}

export default function SettingsPane({ world, hidden }) {
  const { isAdmin, isBuilder } = usePermissions(world)
  const player = world.entities.player

  if (!player) return null

  return (
    <div
      className='settingspane'
      css={css`
        position: absolute;
        top: 64px;
        right: 16px;
        width: 420px;
        max-height: calc(100vh - 80px);
        z-index: 10;
        pointer-events: ${hidden ? 'none' : 'auto'};
        opacity: ${hidden ? 0 : 1};
        transform: ${hidden ? 'translateX(100%)' : 'translateX(0)'};
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        
        @media (max-width: 768px) {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          max-height: 100vh;
          transform: ${hidden ? 'translateY(100%)' : 'translateY(0)'};
        }
      `}
    >
      <GeneralSettings world={world} player={player} />
    </div>
  )
}
