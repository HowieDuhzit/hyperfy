# Node System Documentation

The Node system is a fundamental part of the Hyperfy engine that manages the scene graph hierarchy and transformations. It provides an abstraction layer over Three.js's object system with additional features for game engine functionality.

## Core Concepts

### Node Class
The base class for all scene graph objects, providing:
- Transform management (position, rotation, scale)
- Hierarchical relationships
- Entity references
- State management

## Implementation

### Default Values
```javascript
const defaults = {
  active: true,
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]
}
```

### Vector Utilities
```javascript
// Reusable vector objects for calculations
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _m3 = new THREE.Matrix4()
```

## Node Features

### Transform Management
- Position in 3D space
- Rotation using quaternions
- Scale in three dimensions
- Matrix transformations

### Hierarchy
- Parent-child relationships
- World/local space conversions
- Transform inheritance
- Scene graph traversal

### State
- Active/inactive status
- Visibility control
- Update lifecycle
- Reference management

## Security

### Reference System
```javascript
const secure = { allowRef: false }

export function getRef(pNode) {
  secure.allowRef = true
  const node = pNode._ref
  secure.allowRef = false
  return node
}
```

## Usage Examples

### Creating Nodes
```javascript
// Basic node creation
const node = new Node({
  position: [0, 10, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]
})

// With parent
const childNode = new Node({
  parent: parentNode,
  position: [5, 0, 0]
})
```

### Transform Operations
```javascript
// Set position
node.position.set(x, y, z)

// Rotate
node.quaternion.setFromEuler(euler)

// Scale
node.scale.set(x, y, z)

// Update world matrix
node.updateMatrix()
```

### Hierarchy Management
```javascript
// Add child
parent.add(child)

// Remove child
parent.remove(child)

// Find in hierarchy
const found = parent.find(node => node.name === 'target')
```

## Integration with Three.js

### Matrix Operations
```javascript
// World matrix computation
_m1.compose(position, quaternion, scale)
_m2.copy(parent.matrixWorld)
_m3.multiplyMatrices(_m2, _m1)
```

### Transform Updates
```javascript
// Update world transform
updateWorldMatrix() {
  this.matrixWorld.multiplyMatrices(
    this.parent.matrixWorld,
    this.matrix
  )
}
```

## Best Practices

### Performance
1. **Matrix Updates**
   - Batch transform updates
   - Use matrix decomposition sparingly
   - Cache computed values

2. **Hierarchy Management**
   - Keep hierarchy depth reasonable
   - Batch child operations
   - Use scene graph culling

3. **Memory Management**
   - Reuse vector objects
   - Pool commonly used objects
   - Clean up removed nodes

### Scene Graph Organization
1. **Structure**
   - Logical grouping of nodes
   - Clear parent-child relationships
   - Efficient update propagation

2. **Naming**
   - Consistent naming conventions
   - Descriptive node names
   - Easy node lookup

3. **Updates**
   - Minimize matrix updates
   - Use dirty flags
   - Optimize update order

## Integration with HyperfoneOS

The Node system supports the cyberpunk theme through:
- Efficient UI element positioning
- Dynamic effect node management
- Holographic display transforms
- Neon effect hierarchies

## Technical Details

### Node Properties
```javascript
class Node {
  constructor(options) {
    this.id = nodeIds++
    this.active = options.active ?? true
    this.position = new THREE.Vector3()
    this.quaternion = new THREE.Quaternion()
    this.scale = new THREE.Vector3(1, 1, 1)
    this.matrix = new THREE.Matrix4()
    this.matrixWorld = new THREE.Matrix4()
    this.children = []
    this.parent = null
  }
}
```

### Update Cycle
1. Local transform update
2. World matrix computation
3. Child updates
4. Post-update operations 