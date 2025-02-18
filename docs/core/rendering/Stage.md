# Stage System Documentation

The Stage system is a fundamental component of the Hyperfy engine that manages the 3D scene graph and handles mesh insertion, instancing, and batching. It runs on both server and client.

## Core Features

### Scene Management
- Maintains the Three.js scene graph
- Handles mesh instancing and batching
- Provides spatial partitioning via Octree
- Manages model instances and materials

### Key Components

```javascript
class Stage extends System {
  constructor(world) {
    this.scene = new THREE.Scene()
    this.models = new Map()  // id -> Model
    this.octree = new LooseOctree()
    this.raycaster = new THREE.Raycaster()
    this.dirtyNodes = new Set()
  }
}
```

## Main Functions

### Mesh Management

#### insert(options)
Inserts a mesh into the scene with options for:
- Single mesh insertion
- Instanced mesh handling
- Shadow casting/receiving
- Matrix transformations

```javascript
// Single mesh insertion
stage.insert({
  geometry,
  material,
  castShadow: true,
  receiveShadow: true,
  node,
  matrix
})

// Instanced mesh
stage.insert({
  geometry,
  material,
  instance: true,
  node,
  matrix
})
```

#### insertInstance({ geometry, material, castShadow, receiveShadow, node, matrix })
- Creates or reuses instanced meshes
- Handles batching for performance
- Returns instance handle for manipulation

#### insertSingle({ geometry, material, castShadow, receiveShadow, node, matrix })
- Creates individual Three.js meshes
- Adds to scene and octree
- Returns handle for movement/destruction

### Material Management

#### createMaterial(options)
Creates materials with:
- Standard/Basic material types
- Unlit option
- Color, metalness, roughness properties
- Shadow configuration

```javascript
const material = stage.createMaterial({
  unlit: false,
  color: 'white',
  metalness: 0,
  roughness: 1
})
```

### Raycasting

#### raycastPointer(position, layers, min, max)
Performs raycasting for:
- Pointer interaction
- Object selection
- Collision detection

## Model Class

Handles instanced mesh management:

```javascript
class Model {
  constructor(stage, geometry, material, castShadow, receiveShadow) {
    this.iMesh = new THREE.InstancedMesh()
    this.items = []  // { matrix, node }
  }
  
  // Methods
  clean()  // Updates instance matrices
  getEntity(instanceId)  // Returns entity for instance
  getTriangles()  // Returns triangle count
}
```

## Best Practices

1. **Performance**
   - Use instancing for repeated meshes
   - Leverage the octree for spatial queries
   - Batch updates when possible

2. **Memory Management**
   - Clean up unused models
   - Dispose of geometries and materials
   - Remove meshes when no longer needed

3. **Shadow Handling**
   - Configure shadow properties appropriately
   - Use `castShadow` and `receiveShadow` judiciously
   - Consider performance impact of shadows

## Integration with HyperfoneOS

The Stage system integrates with the HyperfoneOS by:
- Managing 3D UI elements
- Handling app visualization
- Supporting cyberpunk visual effects
- Providing spatial awareness for UI placement 