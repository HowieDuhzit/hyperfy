import { System } from './System'

import StatsGL from '../libs/stats-gl'
import Panel from '../libs/stats-gl/panel'
import { isBoolean } from 'lodash-es'

const PING_RATE = 1 / 2
const MEMORY_UPDATE_RATE = 1 / 4 // Update memory stats 4 times per second
const PERFORMANCE_HISTORY_SIZE = 60 // Store 60 samples for performance graphs

/**
 * Stats System
 *
 * - runs on the client
 * - attaches stats to the ui to see fps/cpu/gpu
 *
 */
export class ClientStats extends System {
  constructor(world) {
    super(world)
    this.stats = null
    this.ui = null
    this.active = false
    this.lastPingAt = 0
    this.lastMemoryUpdateAt = 0
    this.pingHistory = []
    this.pingHistorySize = 30 // Store the last 30 ping measurements
    this.maxPing = 0.01 // Starting value for max (will be updated)
    
    // Enhanced performance tracking
    this.performanceHistory = {
      frameTime: [],
      drawCalls: [],
      triangles: [],
      gpuMemory: [],
      textureMemory: [],
      geometryMemory: []
    }
    
    // Performance monitoring state
    this.currentFrameStats = {
      frameStartTime: 0,
      renderStartTime: 0,
      renderEndTime: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      gpuMemoryUsed: 0,
      textureMemoryUsed: 0,
      geometryMemoryUsed: 0,
      systemMemoryUsed: 0,
      cullRatio: 0,
      visibleObjects: 0,
      totalObjects: 0
    }
    
    // WebGPU/WebGL compatibility flags
    this.isWebGPU = false
    this.hasMemoryInfo = false
    this.hasExtensions = false
  }

  init({ ui }) {
    this.ui = ui
  }

  start() {
    this.world.prefs.on('change', this.onPrefsChange)
    this.world.on('ui', this.onUIState)
    this.world.on('ready', this.onReady)
  }

  onReady = () => {
    if (this.world.prefs.stats) {
      this.toggle(true)
    }
  }

  toggle(value) {
    value = isBoolean(value) ? value : !this.active
    if (this.active === value) return
    this.active = value
    if (this.active) {
      if (!this.stats) {
        // WebGPU compatibility: Check if WebGPU renderer is being used
        const renderer = this.world.graphics?.renderer
        const isWebGPU = renderer && (renderer.isWebGPURenderer || renderer.constructor.name === 'WebGPURenderer')
        
        // Store renderer information for capabilities detection
        this.isWebGPU = isWebGPU
        this.detectCapabilities()
        
        if (isWebGPU) {
          // For WebGPU, use enhanced stats with WebGPU-specific monitoring
          console.log('Using enhanced WebGPU performance stats')
          this.createEnhancedStats()
        } else {
          try {
            // Try to use StatsGL for WebGL with enhanced monitoring
            this.stats = new StatsGL({
              logsPerSecond: 20,
              samplesLog: 100,
              samplesGraph: 10,
              precision: 2,
              horizontal: true,
              minimal: false,
              mode: 0,
            })
            
            this.stats.init(this.world.graphics.renderer, false)
            this.ping = new Panel('PING', '#f00', '#200')
            this.stats.addPanel(this.ping, 3)
            
            // Add enhanced monitoring overlay
            this.createEnhancedStatsOverlay()
            
          } catch (error) {
            console.warn('Failed to initialize StatsGL, using enhanced fallback:', error)
            this.createEnhancedStats()
          }
        }
      }
      if (this.stats?.dom) {
        this.ui.appendChild(this.stats.dom)
      }
    } else {
      if (this.stats?.dom && this.stats.dom.parentNode) {
        this.ui.removeChild(this.stats.dom)
      }
    }
  }
  
  detectCapabilities() {
    const renderer = this.world.graphics?.renderer
    
    if (this.isWebGPU) {
      // WebGPU capabilities detection
      this.hasMemoryInfo = false // WebGPU doesn't expose memory info yet
      this.hasExtensions = false
    } else if (renderer) {
      // WebGL capabilities detection
      const gl = renderer.getContext()
      this.hasMemoryInfo = !!(gl && gl.getExtension('WEBGL_debug_renderer_info'))
      this.hasExtensions = !!(gl && gl.getExtension('EXT_disjoint_timer_query'))
    }
    
    // Browser memory API detection
    this.hasPerformanceMemory = !!(performance && performance.memory)
    
    console.log('📊 Performance capabilities detected:', {
      renderer: this.isWebGPU ? 'WebGPU' : 'WebGL',
      memoryInfo: this.hasMemoryInfo,
      extensions: this.hasExtensions,
      performanceMemory: this.hasPerformanceMemory
    })
  }

  createEnhancedStats() {
    // Create comprehensive performance stats display
    const container = document.createElement('div')
    container.className = 'hyperfy-enhanced-stats'
    container.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 350px;
      background: rgba(0, 0, 0, 0.9);
      color: #fff;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.4;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 10000;
      user-select: none;
      pointer-events: none;
      opacity: 0.95;
    `
    
    // Create sections for different types of stats
    const sections = {
      performance: this.createStatsSection('⚡ Performance', container),
      rendering: this.createStatsSection('🎨 Rendering', container),
      memory: this.createStatsSection('💾 Memory', container),
      network: this.createStatsSection('🌐 Network', container),
      system: this.createStatsSection('🖥️ System', container)
    }
    
    this.statsSections = sections
    
    this.stats = {
      dom: container,
      begin: () => {
        this.currentFrameStats.frameStartTime = performance.now()
        this.collectPreRenderStats()
      },
      end: () => {
        this.currentFrameStats.renderEndTime = performance.now()
        this.collectPostRenderStats()
        this.updateStatsDisplay()
      },
      update: () => {
        // Compatible with StatsGL interface
      }
    }
    
    console.log('✅ Enhanced performance stats initialized')
  }

  createEnhancedStatsOverlay() {
    // Create overlay for additional stats when using StatsGL
    const overlay = document.createElement('div')
    overlay.className = 'hyperfy-stats-overlay'
    overlay.style.cssText = `
      position: absolute;
      top: 60px;
      right: 10px;
      width: 250px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 10px;
      line-height: 1.3;
      padding: 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 9999;
      user-select: none;
      pointer-events: none;
      opacity: 0.9;
    `
    
    this.statsOverlay = overlay
    this.ui.appendChild(overlay)
  }

  createStatsSection(title, parent) {
    const section = document.createElement('div')
    section.style.cssText = 'margin-bottom: 6px;'
    
    const header = document.createElement('div')
    header.textContent = title
    header.style.cssText = 'color: #4fc3f7; font-weight: bold; margin-bottom: 2px; border-bottom: 1px solid rgba(79, 195, 247, 0.3); padding-bottom: 1px;'
    
    const content = document.createElement('div')
    content.className = `stats-${title.replace(/[^a-zA-Z]/g, '').toLowerCase()}`
    content.style.cssText = 'padding-left: 8px;'
    
    section.appendChild(header)
    section.appendChild(content)
    parent.appendChild(section)
    
    return content
  }

  preTick() {
    if (this.active && this.stats) {
      this.stats.begin()
    }
  }

  collectPreRenderStats() {
    const renderer = this.world.graphics?.renderer
    
    if (renderer && renderer.info) {
      // Store render start time
      this.currentFrameStats.renderStartTime = performance.now()
      
      // Reset frame stats
      if (!this.isWebGPU) {
        this.currentFrameStats.drawCalls = renderer.info.render.calls
        this.currentFrameStats.triangles = renderer.info.render.triangles
        this.currentFrameStats.vertices = renderer.info.render.points
      }
    }
    
    // Collect world/stage statistics
    if (this.world.stage) {
      const stageStats = this.world.stage.getPerformanceStats?.() || {}
      this.currentFrameStats.cullRatio = stageStats.cullRatio || 0
      this.currentFrameStats.visibleObjects = stageStats.visibleObjects || 0
      this.currentFrameStats.totalObjects = stageStats.totalObjects || 0
    }
  }

  collectPostRenderStats() {
    const renderer = this.world.graphics?.renderer
    
    // Calculate frame time
    const frameTime = this.currentFrameStats.renderEndTime - this.currentFrameStats.frameStartTime
    
    // Update performance history
    this.addToHistory('frameTime', frameTime)
    
    if (renderer) {
      if (renderer.info && !this.isWebGPU) {
        // WebGL render info
        const renderInfo = renderer.info
        this.currentFrameStats.drawCalls = renderInfo.render.calls
        this.currentFrameStats.triangles = renderInfo.render.triangles
        this.currentFrameStats.vertices = renderInfo.render.points
        
        this.addToHistory('drawCalls', this.currentFrameStats.drawCalls)
        this.addToHistory('triangles', this.currentFrameStats.triangles)
      }
      
      // Collect memory stats (less frequently)
      this.lastMemoryUpdateAt += frameTime
      if (this.lastMemoryUpdateAt > MEMORY_UPDATE_RATE * 1000) {
        this.collectMemoryStats()
        this.lastMemoryUpdateAt = 0
      }
    }
  }

  collectMemoryStats() {
    const renderer = this.world.graphics?.renderer
    
    if (renderer && renderer.info) {
      const memInfo = renderer.info.memory
      
      // GPU Memory (approximate)
      this.currentFrameStats.textureMemoryUsed = memInfo.textures || 0
      this.currentFrameStats.geometryMemoryUsed = memInfo.geometries || 0
      
      this.addToHistory('textureMemory', this.currentFrameStats.textureMemoryUsed)
      this.addToHistory('geometryMemory', this.currentFrameStats.geometryMemoryUsed)
    }
    
    // Browser memory API
    if (this.hasPerformanceMemory && performance.memory) {
      this.currentFrameStats.systemMemoryUsed = performance.memory.usedJSHeapSize
      this.addToHistory('gpuMemory', this.currentFrameStats.systemMemoryUsed)
    }
  }

  addToHistory(key, value) {
    if (!this.performanceHistory[key]) {
      this.performanceHistory[key] = []
    }
    
    this.performanceHistory[key].push(value)
    
    if (this.performanceHistory[key].length > PERFORMANCE_HISTORY_SIZE) {
      this.performanceHistory[key].shift()
    }
  }

  getHistoryStats(key) {
    const history = this.performanceHistory[key] || []
    if (history.length === 0) return { current: 0, avg: 0, min: 0, max: 0 }
    
    const current = history[history.length - 1] || 0
    const sum = history.reduce((a, b) => a + b, 0)
    const avg = sum / history.length
    const min = Math.min(...history)
    const max = Math.max(...history)
    
    return { current, avg, min, max }
  }

  formatMemory(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  updateStatsDisplay() {
    if (!this.statsSections) {
      this.updateStatsOverlay()
      return
    }
    
    // Performance Section
    const frameStats = this.getHistoryStats('frameTime')
    const fps = frameStats.current > 0 ? Math.round(1000 / frameStats.current) : 0
    const avgFps = frameStats.avg > 0 ? Math.round(1000 / frameStats.avg) : 0
    
    this.statsSections.performance.innerHTML = `
      <div>FPS: <span style="color: ${fps > 50 ? '#4caf50' : fps > 30 ? '#ff9800' : '#f44336'}">${fps}</span> (avg: ${avgFps})</div>
      <div>Frame Time: ${frameStats.current.toFixed(2)}ms (avg: ${frameStats.avg.toFixed(2)}ms)</div>
      <div>Min/Max: ${frameStats.min.toFixed(1)}ms / ${frameStats.max.toFixed(1)}ms</div>
    `
    
    // Rendering Section
    const drawCallStats = this.getHistoryStats('drawCalls')
    const triangleStats = this.getHistoryStats('triangles')
    
    this.statsSections.rendering.innerHTML = `
      <div>Draw Calls: ${drawCallStats.current} (avg: ${Math.round(drawCallStats.avg)})</div>
      <div>Triangles: ${this.formatNumber(triangleStats.current)} (avg: ${this.formatNumber(Math.round(triangleStats.avg))})</div>
      <div>Cull Ratio: ${(this.currentFrameStats.cullRatio * 100).toFixed(1)}%</div>
      <div>Objects: ${this.currentFrameStats.visibleObjects}/${this.currentFrameStats.totalObjects}</div>
      <div>Renderer: <span style="color: #4fc3f7">${this.isWebGPU ? 'WebGPU' : 'WebGL'}</span></div>
    `
    
    // Memory Section
    const textureMemStats = this.getHistoryStats('textureMemory')
    const geometryMemStats = this.getHistoryStats('geometryMemory')
    const systemMemStats = this.getHistoryStats('gpuMemory')
    
    this.statsSections.memory.innerHTML = `
      <div>Textures: ${textureMemStats.current} loaded</div>
      <div>Geometries: ${geometryMemStats.current} loaded</div>
      ${this.hasPerformanceMemory ? `
        <div>JS Heap: ${this.formatMemory(systemMemStats.current)}</div>
        <div>Heap Limit: ${this.formatMemory(performance.memory?.jsHeapSizeLimit || 0)}</div>
      ` : '<div>Memory info unavailable</div>'}
    `
    
    // Network Section (using existing ping data)
    const pingAvg = this.pingHistory.length > 0 ? 
      this.pingHistory.reduce((a, b) => a + b, 0) / this.pingHistory.length : 0
    const pingCurrent = this.pingHistory[this.pingHistory.length - 1] || 0
    
    this.statsSections.network.innerHTML = `
      <div>Ping: ${pingCurrent.toFixed(0)}ms (avg: ${pingAvg.toFixed(0)}ms)</div>
      <div>Connection: <span style="color: ${pingCurrent < 50 ? '#4caf50' : pingCurrent < 150 ? '#ff9800' : '#f44336'}">
        ${pingCurrent < 50 ? 'Excellent' : pingCurrent < 150 ? 'Good' : 'Poor'}
      </span></div>
    `
    
    // System Section
    const devicePixelRatio = window.devicePixelRatio || 1
    const screenRes = `${screen.width}×${screen.height}`
    const viewportRes = `${window.innerWidth}×${window.innerHeight}`
    
    this.statsSections.system.innerHTML = `
      <div>Device Pixel Ratio: ${devicePixelRatio}</div>
      <div>Screen: ${screenRes}</div>
      <div>Viewport: ${viewportRes}</div>
      <div>User Agent: ${navigator.userAgent.split(' ')[0]}</div>
    `
  }

  updateStatsOverlay() {
    if (!this.statsOverlay) return
    
    const frameStats = this.getHistoryStats('frameTime')
    const drawCallStats = this.getHistoryStats('drawCalls')
    const triangleStats = this.getHistoryStats('triangles')
    const fps = frameStats.current > 0 ? Math.round(1000 / frameStats.current) : 0
    
    this.statsOverlay.innerHTML = `
      <div style="color: #4fc3f7; font-weight: bold; margin-bottom: 3px;">📊 Enhanced Stats</div>
      <div>Draw Calls: ${drawCallStats.current}</div>
      <div>Triangles: ${this.formatNumber(triangleStats.current)}</div>
      <div>Cull Ratio: ${(this.currentFrameStats.cullRatio * 100).toFixed(1)}%</div>
      <div>Objects: ${this.currentFrameStats.visibleObjects}/${this.currentFrameStats.totalObjects}</div>
      ${this.hasPerformanceMemory ? `<div>Memory: ${this.formatMemory(performance.memory?.usedJSHeapSize || 0)}</div>` : ''}
    `
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  update(delta) {
    if (!this.active) return
    this.lastPingAt += delta
    if (this.lastPingAt > PING_RATE) {
      const time = performance.now()
      this.world.network.send('ping', time)
      this.lastPingAt = 0
    }
  }

  postTick() {
    if (this.active && this.stats) {
      this.stats.end()
      // WebGPU compatibility: update method may not exist in fallback stats
      if (this.stats.update) {
        this.stats.update()
      }
    }
  }

  onPong(time) {
    const rttMs = performance.now() - time
    if (this.active && this.ping) {
      this.pingHistory.push(rttMs)
      if (this.pingHistory.length > this.pingHistorySize) {
        this.pingHistory.shift()
      }
      let sum = 0
      let min = Infinity
      let max = 0
      for (let i = 0; i < this.pingHistory.length; i++) {
        const value = this.pingHistory[i]
        sum += value
        if (value < min) min = value
        if (value > max) max = value
      }
      const avg = sum / this.pingHistory.length
      if (max > this.maxPing) {
        this.maxPing = max
      }
      this.ping.update(
        avg, // current value (average)
        rttMs, // graph value (latest ping)
        max, // max value for text display
        this.maxPing, // max value for graph scaling
        0 // number of decimal places (0 for ping)
      )
    }
    // emit an event so other systems can use ping information
    // if (this.pingHistory.length > 0) {
    //   let sum = 0
    //   let min = Infinity
    //   let max = 0
    //   for (let i = 0; i < this.pingHistory.length; i++) {
    //     const value = this.pingHistory[i]
    //     sum += value
    //     if (value < min) min = value
    //     if (value > max) max = value
    //   }
    //   this.world.emit('ping-update', {
    //     current: rttMs,
    //     average: Math.round(sum / this.pingHistory.length),
    //     min: min,
    //     max: max,
    //   })
    // }
  }

  onPrefsChange = changes => {
    if (changes.stats) {
      this.toggle(changes.stats.value)
    }
  }

  onUIState = state => {
    if (this.active && !state.visible) {
      this.uiHidden = true
      this.toggle(false)
    } else if (this.uiHidden && state.visible) {
      this.uiHidden = null
      this.toggle(true)
    }
  }

  destroy() {
    this.toggle(false)
    
    // Clean up enhanced stats elements
    if (this.statsOverlay && this.statsOverlay.parentNode) {
      this.statsOverlay.parentNode.removeChild(this.statsOverlay)
    }
    
    // Clean up performance tracking
    this.performanceHistory = {
      frameTime: [],
      drawCalls: [],
      triangles: [],
      gpuMemory: [],
      textureMemory: [],
      geometryMemory: []
    }
    
    this.statsOverlay = null
    this.statsSections = null
  }
}
