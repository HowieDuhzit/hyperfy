# Shadow and Lighting System Documentation

The Hyperfy engine uses Cascaded Shadow Maps (CSM) to provide high-quality, performant shadows across large scenes. The system is built on Three.js's DirectionalLight with advanced shadow mapping techniques.

## Cascaded Shadow Maps (CSM)

### Overview
CSM splits the view frustum into multiple cascades, each handling shadows for different distance ranges, providing high-quality shadows both near and far from the camera.

### Quality Levels

```javascript
const csmLevels = {
  none: {
    cascades: 1,
    shadowMapSize: 1024,
    castShadow: false,
    lightIntensity: 3,
    shadowIntensity: 2
  },
  low: {
    cascades: 1,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.0000009,
    shadowNormalBias: 0.001,
    shadowIntensity: 2
  },
  med: {
    cascades: 3,
    shadowMapSize: 1024,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000002,
    shadowNormalBias: 0.002,
    shadowIntensity: 2
  },
  high: {
    cascades: 3,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000003,
    shadowNormalBias: 0.002,
    shadowIntensity: 2
  }
}
```

## CSM Implementation

### Constructor Options
```javascript
new CSM({
  camera,           // Three.js camera
  parent,           // Scene or parent object
  cascades,         // Number of shadow cascades
  maxFar,          // Maximum shadow distance
  mode,            // 'practical' or 'uniform'
  shadowMapSize,   // Resolution of shadow maps
  shadowBias,      // Shadow bias value
  lightDirection,  // Direction of the sun/light
  lightIntensity, // Light brightness
  lightColor      // Color of the light
})
```

### Key Features

#### Automatic Cascade Management
- Dynamic frustum splitting
- Automatic light positioning
- Shadow map optimization
- Fade between cascades

#### Shadow Quality Control
- Configurable shadow map size
- Adjustable bias values
- Normal-based bias
- Cascade count selection

## Usage Example

```javascript
// Initialize CSM
const csm = new CSM({
  camera: camera,
  parent: scene,
  cascades: 3,
  maxFar: 1000,
  mode: 'practical',
  shadowMapSize: 2048,
  lightDirection: new THREE.Vector3(1, -1, 1).normalize(),
  lightIntensity: 1,
  lightColor: new THREE.Color(0xffffff)
});

// Update on camera change
function onCameraChange() {
  csm.updateFrustums();
}

// Dispose properly
function cleanup() {
  csm.dispose();
}
```

## Integration with Materials

The CSM system automatically patches materials to support cascaded shadows:

```javascript
// Material setup is handled automatically
material.onBeforeCompile = shader => {
  csm.setupMaterial(shader);
};
```

## Best Practices

### Performance Optimization
1. **Choose Appropriate Quality Level**
   - Use lower cascade counts for mobile
   - Adjust shadow map size based on platform
   - Consider disabling shadows for low-end devices

2. **Shadow Map Size**
   - Balance quality vs performance
   - Consider using smaller sizes for distant cascades
   - Adjust based on scene scale

3. **Bias Settings**
   - Fine-tune shadowBias to prevent artifacts
   - Adjust normalBias for different geometry types
   - Test with various camera angles

### Visual Quality
1. **Cascade Distribution**
   - Use 'practical' mode for better near shadow quality
   - Adjust lambda value for cascade distribution
   - Consider scene scale when setting maxFar

2. **Fade Between Cascades**
   - Enable fade to smooth transition between cascades
   - Adjust fade ratio based on scene needs
   - Consider disabling for performance

3. **Light Setup**
   - Position light to minimize shadow artifacts
   - Consider scene time of day
   - Adjust intensity based on environment

## Cyberpunk Integration

The shadow system supports the engine's cyberpunk aesthetic through:
- High contrast shadows for dramatic effect
- Colored light support for neon lighting
- Dynamic shadow updates for moving lights
- Integration with HyperfoneOS UI elements 