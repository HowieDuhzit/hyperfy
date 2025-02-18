# Performance Monitoring System

The Hyperfy engine includes a comprehensive performance monitoring system based on a modified version of stats-gl. This system provides real-time statistics and performance metrics for the game engine.

## Overview

The performance monitoring system tracks:
- Frame rates (FPS)
- Render times
- Memory usage
- GPU statistics
- Draw calls

## Stats Class

```javascript
class Stats {
  constructor() {
    this.dom = document.createElement('div')
    this.panels = []
    this.minimal = false
    this.horizontal = false
  }
}
```

### Key Features

#### Panel Management
- Multiple metric panels
- Customizable layout (horizontal/vertical)
- Minimal mode for reduced UI footprint
- Canvas-based rendering

#### Three.js Integration
- Automatic renderer patching
- Performance tracking per render call
- GPU statistics collection
- Memory monitoring

## Usage

### Basic Setup
```javascript
const stats = new Stats()
document.body.appendChild(stats.dom)

// Start monitoring a render cycle
stats.begin()

// Your render code here
renderer.render(scene, camera)

// End monitoring
stats.end()
```

### Panel Configuration
```javascript
// Add custom panel
const panel = stats.addPanel(new Stats.Panel('Custom', '#ff3800', '#001f00'))

// Configure layout
stats.horizontal = true  // Horizontal layout
stats.minimal = true    // Minimal display mode
```

### Three.js Integration
```javascript
// Manual integration (recommended)
function animate() {
  stats.begin()
  renderer.render(scene, camera)
  stats.end()
  requestAnimationFrame(animate)
}

// Automatic integration (if needed)
stats.patchThreeRenderer(renderer)
```

## Panel Types

### Default Panels
1. **FPS Panel**
   - Frames per second
   - Frame time
   - Frame time history

2. **Memory Panel**
   - JavaScript heap size
   - Allocated memory
   - Peak memory usage

3. **GPU Panel**
   - GPU time
   - Draw calls
   - Triangle count

### Custom Panels
Create custom panels to monitor specific metrics:
```javascript
const customPanel = new Stats.Panel('Custom', '#ff3800', '#001f00')
customPanel.update = function(value, maxValue) {
  // Update panel with custom metric
}
```

## Integration with HyperfoneOS

The performance monitoring system integrates with HyperfoneOS:

### Developer Mode Features
- Toggle stats visibility
- Switch between minimal/full mode
- Custom panel placement
- Performance alerts

### Cyberpunk UI Integration
- Neon color scheme
- Retro-digital display style
- Transparent overlay design
- Grid-based layout

## Best Practices

### Performance Optimization
1. **Monitoring Strategy**
   - Monitor critical metrics
   - Set performance budgets
   - Track trends over time

2. **UI Impact**
   - Use minimal mode when needed
   - Position stats non-intrusively
   - Consider VR/AR requirements

3. **Resource Usage**
   - Monitor memory leaks
   - Track GPU bottlenecks
   - Optimize based on metrics

### Development Workflow
1. **Debug Mode**
   - Enable detailed statistics
   - Monitor all available metrics
   - Track performance regressions

2. **Production Mode**
   - Disable stats by default
   - Enable via developer mode
   - Minimal performance overhead

3. **Performance Testing**
   - Establish baseline metrics
   - Monitor across devices
   - Track impact of changes

## Technical Details

### Panel Implementation
```javascript
class Panel {
  constructor(name, fg, bg) {
    this.name = name
    this.fg = fg
    this.bg = bg
    this.WIDTH = 80 * this.PR
    this.HEIGHT = 48 * this.PR
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.WIDTH
    this.canvas.height = this.HEIGHT
    this.context = this.canvas.getContext('2d')
  }
}
```

### Rendering Pipeline Integration
- Begin/end timing hooks
- Automatic stat collection
- Non-blocking updates
- Efficient canvas rendering 