# UI Components Documentation

Detailed documentation of the core UI components in the Hyperfy engine. Each component is designed to support the cyberpunk aesthetic while providing flexible layout and styling options.

## UIView Component

A flexible container component that implements Flexbox layout.

### Properties

#### Layout
```javascript
{
  display: 'flex',              // Display mode
  width: Number,                // Container width
  height: Number,               // Container height
  margin: Number | String,      // Outer spacing
  padding: Number | String,     // Inner spacing
  gap: Number,                  // Space between children
}
```

#### Flex Properties
```javascript
{
  flexDirection: String,        // 'row' | 'column'
  justifyContent: String,       // Main axis alignment
  alignItems: String,           // Cross axis alignment
  alignContent: String,         // Multi-line alignment
  flexBasis: Number,           // Initial main size
  flexGrow: Number,            // Growth factor
  flexShrink: Number,          // Shrink factor
  flexWrap: String            // 'wrap' | 'nowrap'
}
```

#### Visual
```javascript
{
  backgroundColor: String,     // Background color
  borderRadius: Number,        // Corner rounding
  opacity: Number,            // Transparency
  visible: Boolean           // Visibility toggle
}
```

### Usage Example
```javascript
const container = app.create('uiview', {
  width: 300,
  height: 200,
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#1a1a1a',
  borderRadius: 10,
  padding: 20,
  gap: 10
})
```

## UIText Component

Text rendering component with advanced styling options.

### Properties

#### Text Content
```javascript
{
  text: String,                // Text content
  fontSize: Number,            // Font size in pixels
  fontFamily: String,          // Font family name
  fontWeight: Number | String, // Font weight
  lineHeight: Number,          // Line spacing
  letterSpacing: Number       // Character spacing
}
```

#### Styling
```javascript
{
  color: String,              // Text color
  textAlign: String,          // Text alignment
  textTransform: String,      // Text transformation
  textOverflow: String,       // Overflow handling
  whiteSpace: String         // Wrapping behavior
}
```

#### Effects
```javascript
{
  glow: {                    // Neon glow effect
    color: String,
    intensity: Number
  },
  flicker: {                 // Cyberpunk flicker
    speed: Number,
    intensity: Number
  }
}
```

### Usage Example
```javascript
const label = app.create('uitext', {
  text: 'HYPERFY',
  fontSize: 24,
  fontFamily: 'Cyberpunk',
  color: '#00ff77',
  textAlign: 'center',
  glow: {
    color: '#00ff77',
    intensity: 0.8
  }
})
```

## UI Base Component

The foundation component that provides common functionality.

### Properties

#### Transform
```javascript
{
  size: Number,               // World space scaling
  res: Number,               // Resolution multiplier
  billboard: String | null,   // Billboard mode
  pivot: String             // Anchor point
}
```

#### Rendering
```javascript
{
  lit: Boolean,              // Lighting enabled
  doubleside: Boolean,       // Double-sided rendering
  depthTest: Boolean,        // Depth testing
  renderOrder: Number       // Render priority
}
```

### Methods

#### Lifecycle
```javascript
class UI {
  build() {}      // Initial setup
  unbuild() {}    // Cleanup
  draw() {}       // Render update
  mount() {}      // Scene attachment
  unmount() {}    // Scene detachment
}
```

#### Updates
```javascript
class UI {
  commit(didMove) {}         // Apply changes
  rebuild() {}              // Full rebuild
  redraw() {}              // Visual update
  postLateUpdate(delta) {} // Frame update
}
```

## Common Features

### Event Handling
All UI components support:
```javascript
{
  onClick: (event) => void,
  onPointerEnter: (event) => void,
  onPointerLeave: (event) => void,
  onFocus: () => void,
  onBlur: () => void
}
```

### Animation Support
```javascript
// Property animation
component.animate({
  property: 'opacity',
  from: 0,
  to: 1,
  duration: 1000,
  easing: 'easeOutCubic'
})

// Transform animation
component.animate({
  scale: [1, 1.2],
  rotation: [0, Math.PI * 2],
  duration: 2000
})
```

### Cyberpunk Effects

#### Neon Glow
```javascript
component.setStyle({
  neonGlow: {
    color: '#ff00ff',
    intensity: 0.8,
    pulse: true
  }
})
```

#### Digital Distortion
```javascript
component.setStyle({
  glitch: {
    frequency: 0.5,
    intensity: 0.2,
    scanlines: true
  }
})
```

#### Holographic Effect
```javascript
component.setStyle({
  hologram: {
    color: '#00ffff',
    scanlines: true,
    flicker: 0.1
  }
})
```

## Best Practices

### Layout
1. **Hierarchy**
   - Keep nesting shallow
   - Use flex layout effectively
   - Group related elements

2. **Positioning**
   - Use relative units
   - Consider billboard mode
   - Handle different scales

3. **Performance**
   - Share materials
   - Batch updates
   - Use appropriate resolution

### Styling
1. **Theme Consistency**
   - Follow color scheme
   - Use consistent effects
   - Maintain visual hierarchy

2. **Effects**
   - Don't overuse effects
   - Consider performance impact
   - Ensure readability

3. **Animation**
   - Use smooth transitions
   - Implement proper easing
   - Handle state changes 