# UI System Documentation

The Hyperfy UI system provides a flexible, React-like interface for creating and managing 3D user interfaces. It implements a custom layout engine with Flexbox support and cyberpunk-themed styling capabilities. The system integrates with the [Input System](/docs/core/input/README.md), [Asset System](/docs/core/assets/README.md), and [Entity Component System](/docs/core/ecs/README.md).

## Core Components

### UI Node
The base UI component that extends the [Entity Component System](/docs/core/ecs/README.md):

```javascript
class UI extends Node {
  constructor(data = {}) {
    this.width = data.width ?? 100
    this.height = data.height ?? 100
    this.size = data.size ?? 0.01      // World size scaling
    this.res = data.res ?? 2           // Resolution multiplier
    
    // Rendering properties
    this.lit = data.lit ?? false
    this.doubleside = data.doubleside ?? true
    this.billboard = data.billboard ?? null
    this.pivot = data.pivot ?? 'center'
    
    // Style properties
    this.backgroundColor = data.backgroundColor
    this.borderRadius = data.borderRadius ?? 0
  }
}
```

### Layout Properties
Integrates with the [Physics System](/docs/core/physics/README.md) for 3D positioning:
```javascript
const defaults = {
  padding: 0,
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  alignContent: 'flex-start'
}
```

## Core Components

### UIView
A container component that uses the [Input System](/docs/core/input/README.md) for interaction:
```javascript
class UIView extends Node {
  // Layout properties
  display: 'flex'
  width: Number
  height: Number
  backgroundColor: String
  borderRadius: Number
  margin: Number
  padding: Number
  
  // Flex properties
  flexDirection: String
  justifyContent: String
  alignItems: String
  flexBasis: Number
  flexGrow: Number
  flexShrink: Number
  gap: Number
}
```

### UIText
Text rendering component using [Asset System](/docs/core/assets/README.md) for fonts:
```javascript
class UIText extends Node {
  // Text properties
  text: String
  fontSize: Number
  color: String
  lineHeight: Number
  textAlign: String
  fontFamily: String
  fontWeight: Number
}
```

## Layout System
Integrates with the [Physics System](/docs/core/physics/README.md) for 3D space positioning.

### Flex Layout
The system implements Flexbox layout with:
- Flex direction (row/column)
- Justification
- Alignment
- Wrapping
- Gap support

### Positioning
```javascript
function applyPivot(pivot, geometry, width, height) {
  // Center, TopLeft, TopRight, etc.
  // Adjusts geometry based on pivot point
}
```

## Rendering Pipeline
Uses the [Asset System](/docs/core/assets/README.md) for textures and materials.

### Build Process
```javascript
class UI {
  build() {
    // Create geometry
    // Setup materials
    // Configure mesh
    // Initialize layout
  }
  
  draw() {
    // Update canvas
    // Render background
    // Apply effects
    // Update texture
  }
}
```

### Update Cycle
```javascript
postLateUpdate(delta) {
  // Handle billboard mode
  // Update transforms
  // Process children
}
```

## Styling System

### Visual Properties
- Background color
- Border radius
- Padding/Margin
- Shadows
- Opacity

### Effects
- Billboard mode
- Lighting
- Double-sided rendering
- Resolution scaling

## Best Practices

### Performance
1. **Layout Optimization**
   - Minimize layout depth
   - Batch style updates
   - Use appropriate resolution

2. **Rendering**
   - Share materials when possible
   - Use texture atlases
   - Optimize draw calls

3. **Memory Management**
   - Clean up unused resources
   - Pool common elements
   - Dispose textures properly

### Design
1. **Component Structure**
   - Keep hierarchy shallow
   - Use semantic components
   - Follow flex best practices

2. **Styling**
   - Use consistent units
   - Implement responsive design
   - Follow cyberpunk theme

## Integration with HyperfoneOS

The UI system provides cyberpunk styling through:
- Neon color effects
- Holographic displays
- Digital distortions
- Tech-inspired layouts

## Technical Details

### Component Properties
```javascript
class UIComponent {
  constructor(options) {
    this.node = options.node
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')
    this.texture = new THREE.Texture(this.canvas)
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true
    })
  }
}
```

### Layout Calculation
```javascript
calculateLayout() {
  // Compute flex layout
  // Update geometries
  // Position children
  // Apply transforms
}
```

### Event Handling
```javascript
class UIEvents {
  // Pointer events
  onClick(event) {}
  onPointerEnter(event) {}
  onPointerLeave(event) {}
  
  // Focus events
  onFocus() {}
  onBlur() {}
  
  // Drag events
  onDragStart(event) {}
  onDrag(event) {}
  onDragEnd(event) {}
}
```

### Proxy Interface
```javascript
getProxy() {
  return {
    // Style properties
    get width() {},
    set width(value) {},
    get height() {},
    set height(value) {},
    
    // Layout properties
    get flexDirection() {},
    set flexDirection(value) {},
    get justifyContent() {},
    set justifyContent(value) {},
    
    // Visual properties
    get backgroundColor() {},
    set backgroundColor(value) {},
    get borderRadius() {},
    set borderRadius(value) {}
  }
}
``` 