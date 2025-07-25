import { useEffect, useState, useCallback } from 'react'
import { css } from '@emotion/react'
import { useUpdate } from './useUpdate'

const GraphicsSettingsPane = ({ world, onClose }) => {
  const [settings, setSettings] = useState({})
  const [stats, setStats] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    shadows: false,
    postprocessing: false,
    textures: false,
    advanced: false,
    debug: false,
    performance: true
  })

  // Update settings and stats
  useUpdate(() => {
    if (world?.graphics) {
      setSettings(world.graphics.settings)
      setStats(world.graphics.getGraphicsStats())
    }
  }, 100) // Update every 100ms for real-time feedback

  const updateSetting = useCallback((key, value) => {
    if (world?.graphics) {
      world.graphics.updateGraphicsSettings({ [key]: value })
      setSettings(prev => ({ ...prev, [key]: value }))
    }
  }, [world])

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }, [])

  const resetToDefaults = useCallback(() => {
    if (world?.graphics) {
      const defaults = {
        adaptiveQuality: true,
        targetFPS: 60,
        pixelRatio: window.devicePixelRatio,
        shadowMapSize: 2048,
        shadowMapType: 'PCFSoftShadowMap',
        postProcessing: true,
        aoEnabled: true,
        aoQuality: 'medium',
        bloomEnabled: true,
        bloomIntensity: 0.5,
        smaaEnabled: true,
        anisotropy: 16,
        textureCompression: true,
        textureQuality: 1.0,
        instancedRendering: true,
        frustumCulling: true,
        shaderCaching: true,
        batchRendering: true,
        wireframe: false,
        showStats: false,
        logPerformance: false
      }
      world.graphics.updateGraphicsSettings(defaults)
    }
  }, [world])

  const exportSettings = useCallback(() => {
    const settingsJSON = JSON.stringify(settings, null, 2)
    const blob = new Blob([settingsJSON], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'graphics-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [settings])

  const importSettings = useCallback((event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target.result)
          world.graphics.updateGraphicsSettings(importedSettings)
        } catch (error) {
          console.error('Failed to import settings:', error)
        }
      }
      reader.readAsText(file)
    }
  }, [world])

  if (!world?.graphics) {
    return (
      <div css={containerStyle}>
        <div css={headerStyle}>
          <h2>Graphics Settings</h2>
          <button onClick={onClose} css={closeButtonStyle}>×</button>
        </div>
        <div css={contentStyle}>
          <p>Graphics system not available</p>
        </div>
      </div>
    )
  }

  return (
    <div css={containerStyle}>
      <div css={headerStyle}>
        <h2>Graphics Settings</h2>
        <div css={headerButtonsStyle}>
          <button onClick={exportSettings} css={buttonStyle}>Export</button>
          <label css={buttonStyle}>
            Import
            <input type="file" accept=".json" onChange={importSettings} css={hiddenInputStyle} />
          </label>
          <button onClick={resetToDefaults} css={buttonStyle}>Reset</button>
          <button onClick={onClose} css={closeButtonStyle}>×</button>
        </div>
      </div>

      <div css={contentStyle}>
        {/* Performance Metrics */}
        <Section
          title="Performance Metrics"
          expanded={expandedSections.performance}
          onToggle={() => toggleSection('performance')}
        >
          <div css={metricsGridStyle}>
            <MetricCard
              title="FPS"
              value={stats.performance?.currentFPS?.toFixed(1) || '0'}
              subtitle={`Target: ${settings.targetFPS || 60}`}
              color={stats.performance?.currentFPS > 55 ? 'green' : stats.performance?.currentFPS > 30 ? 'orange' : 'red'}
            />
            <MetricCard
              title="Frame Time"
              value={`${stats.performance?.lastFrameTime?.toFixed(2) || '0'}ms`}
              subtitle={`Avg: ${stats.performance?.avgFrameTime?.toFixed(2) || '0'}ms`}
              color={stats.performance?.lastFrameTime < 16.67 ? 'green' : stats.performance?.lastFrameTime < 33.33 ? 'orange' : 'red'}
            />
            <MetricCard
              title="Draw Calls"
              value={stats.renderer?.calls || '0'}
              subtitle={`Triangles: ${stats.renderer?.triangles || '0'}`}
              color={stats.renderer?.calls < 500 ? 'green' : stats.renderer?.calls < 1000 ? 'orange' : 'red'}
            />
            <MetricCard
              title="Memory"
              value={`${((stats.performance?.memoryUsage || 0) / 1024 / 1024).toFixed(1)}MB`}
              subtitle={`Textures: ${stats.renderer?.textures || '0'}`}
              color={stats.performance?.memoryUsage < 256 * 1024 * 1024 ? 'green' : 'orange'}
            />
            {stats.adaptive && (
              <MetricCard
                title="Quality Level"
                value={`${(stats.adaptive.qualityLevel * 100).toFixed(0)}%`}
                subtitle="Adaptive"
                color={stats.adaptive.qualityLevel > 0.8 ? 'green' : stats.adaptive.qualityLevel > 0.5 ? 'orange' : 'red'}
              />
            )}
          </div>
        </Section>

        {/* Basic Settings */}
        <Section
          title="Basic Settings"
          expanded={expandedSections.basic}
          onToggle={() => toggleSection('basic')}
        >
          <Setting
            label="Adaptive Quality"
            description="Automatically adjust quality based on performance"
          >
            <Checkbox
              checked={settings.adaptiveQuality}
              onChange={(value) => updateSetting('adaptiveQuality', value)}
            />
          </Setting>

          <Setting
            label="Target FPS"
            description="Target frame rate for adaptive quality system"
          >
            <Slider
              value={settings.targetFPS || 60}
              min={30}
              max={120}
              step={5}
              onChange={(value) => updateSetting('targetFPS', value)}
              showValue
            />
          </Setting>

          <Setting
            label="Pixel Ratio"
            description="Resolution scaling factor"
          >
            <Slider
              value={settings.pixelRatio || 1}
              min={0.5}
              max={2}
              step={0.1}
              onChange={(value) => updateSetting('pixelRatio', value)}
              showValue
            />
          </Setting>
        </Section>

        {/* Shadow Settings */}
        <Section
          title="Shadow Settings"
          expanded={expandedSections.shadows}
          onToggle={() => toggleSection('shadows')}
        >
          <Setting
            label="Shadow Map Size"
            description="Resolution of shadow maps (higher = better quality, lower performance)"
          >
            <Select
              value={settings.shadowMapSize || 2048}
              options={[
                { value: 512, label: '512 (Low)' },
                { value: 1024, label: '1024 (Medium)' },
                { value: 2048, label: '2048 (High)' },
                { value: 4096, label: '4096 (Ultra)' }
              ]}
              onChange={(value) => updateSetting('shadowMapSize', parseInt(value))}
            />
          </Setting>

          <Setting
            label="Shadow Type"
            description="Shadow filtering algorithm"
          >
            <Select
              value={settings.shadowMapType || 'PCFSoftShadowMap'}
              options={[
                { value: 'BasicShadowMap', label: 'Basic (Fastest)' },
                { value: 'PCFShadowMap', label: 'PCF (Good)' },
                { value: 'PCFSoftShadowMap', label: 'PCF Soft (Best)' }
              ]}
              onChange={(value) => updateSetting('shadowMapType', value)}
            />
          </Setting>

          <Setting
            label="Cascaded Shadows"
            description="Use cascaded shadow maps for better distant shadows"
          >
            <Checkbox
              checked={settings.cascadedShadows}
              onChange={(value) => updateSetting('cascadedShadows', value)}
            />
          </Setting>
        </Section>

        {/* Post-Processing Settings */}
        <Section
          title="Post-Processing"
          expanded={expandedSections.postprocessing}
          onToggle={() => toggleSection('postprocessing')}
        >
          <Setting
            label="Enable Post-Processing"
            description="Enable advanced post-processing effects"
          >
            <Checkbox
              checked={settings.postProcessing}
              onChange={(value) => updateSetting('postProcessing', value)}
            />
          </Setting>

          <Setting
            label="Ambient Occlusion"
            description="Screen-space ambient occlusion for better depth perception"
          >
            <Checkbox
              checked={settings.aoEnabled}
              onChange={(value) => updateSetting('aoEnabled', value)}
            />
          </Setting>

          <Setting
            label="AO Quality"
            description="Quality level for ambient occlusion"
          >
            <Select
              value={settings.aoQuality || 'medium'}
              options={[
                { value: 'low', label: 'Low (Fastest)' },
                { value: 'medium', label: 'Medium (Balanced)' },
                { value: 'high', label: 'High (Best)' }
              ]}
              onChange={(value) => updateSetting('aoQuality', value)}
              disabled={!settings.aoEnabled}
            />
          </Setting>

          <Setting
            label="Bloom Effect"
            description="Glow effect for bright objects"
          >
            <Checkbox
              checked={settings.bloomEnabled}
              onChange={(value) => updateSetting('bloomEnabled', value)}
            />
          </Setting>

          <Setting
            label="Bloom Intensity"
            description="Strength of the bloom effect"
          >
            <Slider
              value={settings.bloomIntensity || 0.5}
              min={0}
              max={2}
              step={0.1}
              onChange={(value) => updateSetting('bloomIntensity', value)}
              disabled={!settings.bloomEnabled}
              showValue
            />
          </Setting>

          <Setting
            label="Anti-Aliasing (SMAA)"
            description="Smooth jagged edges"
          >
            <Checkbox
              checked={settings.smaaEnabled}
              onChange={(value) => updateSetting('smaaEnabled', value)}
            />
          </Setting>

          <Setting
            label="Tone Mapping"
            description="HDR to LDR conversion method"
          >
            <Select
              value={settings.toneMappingMode || 'ACES_FILMIC'}
              options={[
                { value: 'LINEAR', label: 'Linear' },
                { value: 'REINHARD', label: 'Reinhard' },
                { value: 'CINEON', label: 'Cineon' },
                { value: 'ACES_FILMIC', label: 'ACES Filmic' }
              ]}
              onChange={(value) => updateSetting('toneMappingMode', value)}
            />
          </Setting>
        </Section>

        {/* Texture Settings */}
        <Section
          title="Texture Settings"
          expanded={expandedSections.textures}
          onToggle={() => toggleSection('textures')}
        >
          <Setting
            label="Anisotropic Filtering"
            description="Improve texture quality at steep angles"
          >
            <Select
              value={settings.anisotropy || 16}
              options={[
                { value: 1, label: '1x (Off)' },
                { value: 2, label: '2x' },
                { value: 4, label: '4x' },
                { value: 8, label: '8x' },
                { value: 16, label: '16x (Max)' }
              ]}
              onChange={(value) => updateSetting('anisotropy', parseInt(value))}
            />
          </Setting>

          <Setting
            label="Texture Compression"
            description="Compress textures to save memory"
          >
            <Checkbox
              checked={settings.textureCompression}
              onChange={(value) => updateSetting('textureCompression', value)}
            />
          </Setting>

          <Setting
            label="Texture Quality"
            description="Overall texture resolution scaling"
          >
            <Slider
              value={settings.textureQuality || 1.0}
              min={0.25}
              max={2.0}
              step={0.25}
              onChange={(value) => updateSetting('textureQuality', value)}
              showValue
            />
          </Setting>

          <Setting
            label="Mipmap Generation"
            description="Generate mipmaps for better texture filtering"
          >
            <Checkbox
              checked={settings.mipmapGeneration}
              onChange={(value) => updateSetting('mipmapGeneration', value)}
            />
          </Setting>
        </Section>

        {/* Advanced Settings */}
        <Section
          title="Advanced Settings"
          expanded={expandedSections.advanced}
          onToggle={() => toggleSection('advanced')}
        >
          <Setting
            label="Instanced Rendering"
            description="Batch similar objects for better performance"
          >
            <Checkbox
              checked={settings.instancedRendering}
              onChange={(value) => updateSetting('instancedRendering', value)}
            />
          </Setting>

          <Setting
            label="Frustum Culling"
            description="Skip rendering objects outside camera view"
          >
            <Checkbox
              checked={settings.frustumCulling}
              onChange={(value) => updateSetting('frustumCulling', value)}
            />
          </Setting>

          <Setting
            label="Occlusion Culling"
            description="Skip rendering objects hidden behind others"
          >
            <Checkbox
              checked={settings.occlusionCulling}
              onChange={(value) => updateSetting('occlusionCulling', value)}
            />
          </Setting>

          <Setting
            label="Shader Caching"
            description="Cache compiled shaders for faster loading"
          >
            <Checkbox
              checked={settings.shaderCaching}
              onChange={(value) => updateSetting('shaderCaching', value)}
            />
          </Setting>

          <Setting
            label="Batch Rendering"
            description="Group draw calls to reduce GPU overhead"
          >
            <Checkbox
              checked={settings.batchRendering}
              onChange={(value) => updateSetting('batchRendering', value)}
            />
          </Setting>
        </Section>

        {/* Debug Settings */}
        <Section
          title="Debug Settings"
          expanded={expandedSections.debug}
          onToggle={() => toggleSection('debug')}
        >
          <Setting
            label="Wireframe Mode"
            description="Show wireframe geometry"
          >
            <Checkbox
              checked={settings.wireframe}
              onChange={(value) => updateSetting('wireframe', value)}
            />
          </Setting>

          <Setting
            label="Show Performance Stats"
            description="Display real-time performance overlay"
          >
            <Checkbox
              checked={settings.showStats}
              onChange={(value) => updateSetting('showStats', value)}
            />
          </Setting>

          <Setting
            label="Log Performance"
            description="Log performance warnings to console"
          >
            <Checkbox
              checked={settings.logPerformance}
              onChange={(value) => updateSetting('logPerformance', value)}
            />
          </Setting>
        </Section>

        {/* Resource Stats */}
        <Section
          title="Resource Statistics"
          expanded={true}
        >
          <div css={statsGridStyle}>
            <StatItem label="Shader Cache" value={stats.shaders?.cachedShaders || 0} />
            <StatItem label="Texture Pool" value={stats.resources?.textures?.count || 0} />
            <StatItem label="Geometry Pool" value={stats.resources?.geometries?.count || 0} />
            <StatItem label="Material Pool" value={stats.resources?.materials?.count || 0} />
            <StatItem label="GPU Geometries" value={stats.renderer?.geometries || 0} />
            <StatItem label="GPU Textures" value={stats.renderer?.textures || 0} />
          </div>
        </Section>
      </div>
    </div>
  )
}

// Helper Components
const Section = ({ title, expanded, onToggle, children }) => (
  <div css={sectionStyle}>
    <div css={sectionHeaderStyle} onClick={onToggle}>
      <span css={sectionTitleStyle}>{title}</span>
      <span css={expandIconStyle}>{expanded ? '−' : '+'}</span>
    </div>
    {expanded && <div css={sectionContentStyle}>{children}</div>}
  </div>
)

const Setting = ({ label, description, children }) => (
  <div css={settingStyle}>
    <div css={settingLabelStyle}>
      <span css={settingNameStyle}>{label}</span>
      <span css={settingDescStyle}>{description}</span>
    </div>
    <div css={settingControlStyle}>{children}</div>
  </div>
)

const MetricCard = ({ title, value, subtitle, color = 'blue' }) => (
  <div css={[metricCardStyle, { borderColor: color }]}>
    <div css={metricTitleStyle}>{title}</div>
    <div css={[metricValueStyle, { color }]}>{value}</div>
    <div css={metricSubtitleStyle}>{subtitle}</div>
  </div>
)

const StatItem = ({ label, value }) => (
  <div css={statItemStyle}>
    <span css={statLabelStyle}>{label}</span>
    <span css={statValueStyle}>{value}</span>
  </div>
)

const Checkbox = ({ checked, onChange, disabled = false }) => (
  <label css={checkboxStyle}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
    <span css={checkboxIndicatorStyle}></span>
  </label>
)

const Slider = ({ value, min, max, step, onChange, disabled = false, showValue = false }) => (
  <div css={sliderContainerStyle}>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      css={sliderStyle}
    />
    {showValue && <span css={sliderValueStyle}>{value}</span>}
  </div>
)

const Select = ({ value, options, onChange, disabled = false }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    css={selectStyle}
  >
    {options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
)

// Styles
const containerStyle = css`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  max-width: 1200px;
  height: 90vh;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid #333;
  border-radius: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`

const headerStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #333;
  background: rgba(0, 0, 0, 0.8);

  h2 {
    margin: 0;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
  }
`

const headerButtonsStyle = css`
  display: flex;
  gap: 8px;
  align-items: center;
`

const buttonStyle = css`
  background: #333;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #444;
  }
`

const closeButtonStyle = css`
  ${buttonStyle}
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  padding: 0;
`

const hiddenInputStyle = css`
  display: none;
`

const contentStyle = css`
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
`

const metricsGridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
`

const metricCardStyle = css`
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
`

const metricTitleStyle = css`
  color: #ccc;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 8px;
`

const metricValueStyle = css`
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
`

const metricSubtitleStyle = css`
  color: #999;
  font-size: 11px;
`

const sectionStyle = css`
  margin-bottom: 24px;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
`

const sectionHeaderStyle = css`
  background: rgba(255, 255, 255, 0.05);
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`

const sectionTitleStyle = css`
  color: #fff;
  font-weight: 600;
`

const expandIconStyle = css`
  color: #ccc;
  font-weight: bold;
  font-size: 18px;
`

const sectionContentStyle = css`
  padding: 16px;
`

const settingStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #222;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`

const settingLabelStyle = css`
  flex: 1;
  margin-right: 16px;
`

const settingNameStyle = css`
  color: #fff;
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
`

const settingDescStyle = css`
  color: #999;
  font-size: 12px;
  line-height: 1.4;
`

const settingControlStyle = css`
  flex-shrink: 0;
`

const checkboxStyle = css`
  display: flex;
  align-items: center;
  cursor: pointer;

  input {
    display: none;
  }
`

const checkboxIndicatorStyle = css`
  width: 20px;
  height: 20px;
  border: 2px solid #555;
  border-radius: 3px;
  background: transparent;
  transition: all 0.2s;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 6px;
    width: 4px;
    height: 8px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    opacity: 0;
    transition: opacity 0.2s;
  }

  input:checked + & {
    background: #0066cc;
    border-color: #0066cc;

    &::after {
      opacity: 1;
    }
  }
`

const sliderContainerStyle = css`
  display: flex;
  align-items: center;
  gap: 8px;
`

const sliderStyle = css`
  width: 120px;
  height: 4px;
  background: #333;
  border-radius: 2px;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: #0066cc;
    border-radius: 50%;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #0066cc;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
`

const sliderValueStyle = css`
  color: #ccc;
  font-size: 12px;
  min-width: 40px;
  text-align: right;
`

const selectStyle = css`
  background: #333;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  min-width: 140px;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const statsGridStyle = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
`

const statItemStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
`

const statLabelStyle = css`
  color: #ccc;
  font-size: 12px;
`

const statValueStyle = css`
  color: #fff;
  font-weight: 600;
  font-size: 12px;
`

export default GraphicsSettingsPane 