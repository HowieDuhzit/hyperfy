import { createNode } from './createNode'
import * as THREE from '../extras/three'
import CustomShaderMaterial from '../libs/three-custom-shader-material'

const groupTypes = ['Scene', 'Group', 'Object3D']

export function glbToNodes(glb, world) {
  // Check renderer type once at the beginning
  const renderer = world.graphics?.renderer
  const isWebGPU = renderer && (renderer.isWebGPURenderer || renderer.constructor.name === 'WebGPURenderer')
  
  console.log(`🔧 Processing GLB with ${isWebGPU ? 'WebGPU' : 'WebGL'} compatibility mode`)
  
  // MULTI-MESH FIX: Analyze GLB structure to determine linking strategy
  const meshCount = countMeshes(glb.scene)
  const hasMultipleMeshes = meshCount > 1
  const forceNonLinked = isWebGPU && hasMultipleMeshes // WebGPU multi-mesh objects should not be linked
  
  if (forceNonLinked) {
    console.log(`🔧 Multi-mesh GLB detected (${meshCount} meshes) - forcing non-linked rendering for WebGPU compatibility`)
  }
  
  function registerNode(name, data) {
    const node = createNode(name, data)
    return node
  }
  
  function parse(object3ds, parentNode) {
    for (const object3d of object3ds) {
      const props = object3d.userData || {}
      const isSkinnedMeshRoot = !!object3d.children.find(c => c.isSkinnedMesh)
      // SkinnedMesh (root)
      if (isSkinnedMeshRoot) {
        const node = registerNode('skinnedmesh', {
          id: object3d.name,
          object3d,
          animations: glb.animations,
          castShadow: props.castShadow,
          receiveShadow: props.receiveShadow,
          active: props.active,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        if (parentNode.name === 'lod' && props.maxDistance) {
          parentNode.insert(node, props.maxDistance)
        } else {
          parentNode.add(node)
        }
        // parse(object3d.children, node)
      }
      // Snap (custom node)
      else if (props.node === 'snap') {
        const node = registerNode('snap', {
          id: object3d.name,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // LOD (custom node)
      else if (props.node === 'lod') {
        const node = registerNode('lod', {
          id: object3d.name,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // RigidBody (custom node)
      else if (props.node === 'rigidbody') {
        const node = registerNode('rigidbody', {
          id: object3d.name,
          type: props.type,
          mass: props.mass,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // Collider (custom node)
      else if (props.node === 'collider' && object3d.isMesh) {
        // NOTE: in blender if you export a single object with node:collider but it has multiple materials, it converts this into a Group with one Mesh for each material.
        // but since the Group is the one that has the collider custom property, it won't work as expected. we could hack to fix this, but i think it adds a layer of indirection.
        // colliders should not have materials on them.
        // console.error('TODO: glbToNodes collider for box/sphere in blender?')
        const node = registerNode('collider', {
          id: object3d.name,
          type: 'geometry',
          geometry: object3d.geometry,
          convex: props.convex,
          trigger: props.trigger,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
      // Mesh
      else if (object3d.type === 'Mesh') {
        // Special terrain handling (keep existing terrain logic)
        if (props.terrain) {
          console.log('🌍 Processing terrain mesh with splatting support')
          const mesh = object3d
          
          // Process terrain materials consistently for both renderers
          processTerrainMaterial(mesh, props, world, isWebGPU)
          
          const node = registerNode('mesh', {
            id: object3d.name,
            type: 'geometry',
            geometry: object3d.geometry,
            material: object3d.material,
            linked: false, // Terrain is never linked due to custom materials
            castShadow: props.castShadow,
            receiveShadow: props.receiveShadow,
            visible: props.visible,
            active: props.active,
            position: object3d.position.toArray(),
            quaternion: object3d.quaternion.toArray(),
            scale: object3d.scale.toArray(),
          })
          
          if (parentNode.name === 'lod' && props.maxDistance) {
            parentNode.insert(node, props.maxDistance)
          } else {
            parentNode.add(node)
          }
          parse(object3d.children, node)
          continue
        }
        
        // Standard mesh processing - ensure consistent behavior
        const hasMorphTargets = object3d.morphTargetDictionary || object3d.morphTargetInfluences?.length > 0
        
        // Restore experimental splatmap processing
        if (props.exp_splatmap && !world.network.isServer) {
          setupSplatmap(object3d)
        }
        // Restore wind effect processing
        else if (object3d.material.userData.wind) {
          addWind(object3d, world)
        }
        
        // Apply consistent material processing for both renderers
        if (object3d.material) {
          ensureConsistentMaterial(object3d.material, world, isWebGPU)
        }
        
        // MULTI-MESH FIX: Determine linking based on GLB structure and renderer
        let shouldLink = !hasMorphTargets && !object3d.material.transparent
        
        if (forceNonLinked) {
          shouldLink = false // Force non-linked for WebGPU multi-mesh objects
        }
        
        const node = registerNode('mesh', {
          id: object3d.name,
          type: 'geometry',
          geometry: object3d.geometry,
          material: object3d.material,
          linked: shouldLink,
          castShadow: props.castShadow,
          receiveShadow: props.receiveShadow,
          visible: props.visible, // DEPRECATED: use Node.active
          active: props.active,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        if (parentNode.name === 'lod' && props.maxDistance) {
          parentNode.insert(node, props.maxDistance)
        } else {
          parentNode.add(node)
        }
        parse(object3d.children, node)
      }
      // SkinnedMesh
      else if (object3d.type === 'SkinnedMesh') {
        // Apply consistent material processing for skinned meshes too
        if (object3d.material) {
          ensureConsistentMaterial(object3d.material, world, isWebGPU)
        }
        
        const node = registerNode('skinnedmesh', {
          id: object3d.name,
          object3d,
          animations: glb.animations,
          castShadow: props.castShadow,
          receiveShadow: props.receiveShadow,
          active: props.active,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        if (parentNode.name === 'lod' && props.maxDistance) {
          parentNode.insert(node, props.maxDistance)
        } else {
          parentNode.add(node)
        }
      }
      // Object3D / Group / Scene
      else if (groupTypes.includes(object3d.type)) {
        const node = registerNode('group', {
          id: object3d.name,
          position: object3d.position.toArray(),
          quaternion: object3d.quaternion.toArray(),
          scale: object3d.scale.toArray(),
        })
        parentNode.add(node)
        parse(object3d.children, node)
      }
    }
  }
  const root = registerNode('group', {
    id: '$root',
  })
  parse(glb.scene.children, root)
  // console.log('$root', root)
  return root
}

// NEW: Ensure consistent material behavior between WebGL and WebGPU
function ensureConsistentMaterial(material, world, isWebGPU) {
  if (!material.isMaterial) return
  
  const materials = Array.isArray(material) ? material : [material]
  
  materials.forEach(mat => {
    // Apply world material setup (CSM shadows, etc.) - same for both renderers
    if (world.setupMaterial) {
      world.setupMaterial(mat)
    }
    
    if (isWebGPU) {
      // Apply WebGPU-specific fixes to ensure compatibility
      applyWebGPUMaterialFixes(mat, world)
    }
    
    // Add wind support if available (same for both renderers)
    if (world.wind && mat.isMeshStandardMaterial) {
      addWind({ material: mat }, world)
    }
  })
}

// NEW: Apply WebGPU-specific material fixes
function applyWebGPUMaterialFixes(material, world) {
  // Ensure proper texture configuration
  const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']
  
  textureProps.forEach(prop => {
    if (material[prop] && material[prop].isTexture) {
      const texture = material[prop]
      
      // Match WebGL texture settings
      texture.anisotropy = Math.min(world.graphics?.maxAnisotropy || 16, 16)
      
      // Ensure proper color space
      if (prop === 'map' || prop === 'emissiveMap') {
        texture.colorSpace = THREE.SRGBColorSpace
      }
      
      texture.needsUpdate = true
    }
  })
  
  // Clamp material values for WebGPU compatibility
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    material.roughness = Math.max(0.04, Math.min(1.0, material.roughness || 1.0))
    material.metalness = Math.max(0.0, Math.min(1.0, material.metalness || 0.0))
    
    if (material.transparent && !material.alphaTest) {
      material.alphaTest = 0.01
    }
  }
  
  material.needsUpdate = true
}

// Process terrain materials consistently for both renderers
function processTerrainMaterial(mesh, props, world, isWebGPU) {
  const uniforms = {
    splatTex: { value: null },
    rTex: { value: null },
    gTex: { value: null },
    bTex: { value: null },
    aTex: { value: null },
    rScale: { value: props.rScale || 1 },
    gScale: { value: props.gScale || 1 },
    bScale: { value: props.bScale || 1 },
    aScale: { value: props.aScale || 1 },
  }

  // Load terrain textures
  const texturePromises = []
  if (props.splatTex) {
    texturePromises.push(
      world.loader.load('texture', props.splatTex).then(tex => {
        uniforms.splatTex.value = tex
      })
    )
  }
  
  const channels = ['r', 'g', 'b', 'a']
  channels.forEach(channel => {
    const texProp = `${channel}Tex`
    if (props[texProp]) {
      texturePromises.push(
        world.loader.load('texture', props[texProp]).then(tex => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          uniforms[`${channel}Tex`].value = tex
        })
      )
    }
  })

  if (isWebGPU) {
    console.log('⚠️ WebGPU terrain rendering: Using simplified material (custom shaders not fully supported)')
    
    // For WebGPU, use a simplified approach until custom shaders are better supported
    mesh.material = new THREE.MeshStandardMaterial({
      roughness: 1,
      metalness: 0,
    })
    
    // Apply the first available texture as a basic diffuse map
    Promise.all(texturePromises).then(() => {
      if (uniforms.rTex.value) {
        mesh.material.map = uniforms.rTex.value
        mesh.material.needsUpdate = true
      }
    })
  } else {
    // WebGL: Use full CustomShaderMaterial with triplanar mapping
    mesh.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      roughness: 1,
      metalness: 0,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNorm;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vNorm = normalize(normal);
          vPos = position;
        }
      `,
      fragmentShader: `
        uniform sampler2D splatTex;
        uniform sampler2D rTex;
        uniform sampler2D gTex;
        uniform sampler2D bTex;
        uniform sampler2D aTex;
        uniform float rScale;
        uniform float gScale;
        uniform float bScale;
        uniform float aScale;
        varying vec2 vUv;
        varying vec3 vNorm;
        varying vec3 vPos;

        vec4 textureTriplanar(sampler2D tex, float scale, vec3 normal, vec3 position) {
            vec2 uv_x = position.yz * scale;
            vec2 uv_y = position.xz * scale;
            vec2 uv_z = position.xy * scale;
            vec4 xProjection = texture2D(tex, uv_x);
            vec4 yProjection = texture2D(tex, uv_y);
            vec4 zProjection = texture2D(tex, uv_z);
            vec3 weight = abs(normal);
            weight = pow(weight, vec3(4.0)); // bias towards the major axis
            weight = weight / (weight.x + weight.y + weight.z);
            return xProjection * weight.x + yProjection * weight.y + zProjection * weight.z;
        }

        vec3 tri(sampler2D t, float s) {
          return textureTriplanar(t, s, vNorm, vPos).rgb;
        }

        void main() {
            vec4 splat = texture2D(splatTex, vUv);
            vec4 result = vec4(0, 0, 0, 1.0);
            result += splat.r * textureTriplanar(rTex, rScale, vNorm, vPos);
            result += splat.g * textureTriplanar(gTex, gScale, vNorm, vPos);
            result += splat.b * textureTriplanar(bTex, bScale, vNorm, vPos);
            csm_DiffuseColor *= result;
        }
      `,
    })
  }
}

function setupSplatmap(mesh) {
  /**
   * TODO
   * - vertex colors should shade terrain
   * - use alpha for a 4th texture layer
   *
   * NOTES
   * - blender gltf export doesnt support a complex triplanar splatmap shader
   *   so we force the splat and rgba textures into random material slots and
   *   reconstruct them here.
   */
  const original = mesh.material
  if (original.specularIntensityMap) original.specularIntensityMap.colorSpace = THREE.SRGBColorSpace
  if (original.transmissionMap) original.transmissionMap.colorSpace = THREE.SRGBColorSpace
  if (original.emissiveMap) original.emissiveMap.colorSpace = THREE.SRGBColorSpace
  if (original.normalMap) original.normalMap.colorSpace = THREE.SRGBColorSpace
  const uniforms = {
    splatTex: { value: original.map },
    rTex: { value: original.specularIntensityMap },
    gTex: { value: original.emissiveMap },
    bTex: { value: original.normalMap },
    aTex: { value: original.transmissionMap },
    rScale: { value: mesh.userData.red_scale || 1 },
    gScale: { value: mesh.userData.green_scale || 1 },
    bScale: { value: mesh.userData.blue_scale || 1 },
    aScale: { value: mesh.userData.alpha_scale || 1 },
  }
  // if (mesh.geometry.hasAttribute('_color')) {
  //   terrain.geometry.setAttribute('color', terrain.geometry.attributes._color)
  //   terrain.geometry.deleteAttribute('_color')
  //   hasVertexColors = true
  // }
  mesh.material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    roughness: 1,
    metalness: 0,
    // vertexColors: true,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vNorm = normalize(normal);
        vPos = position;
      }
    `,
    fragmentShader: `
      uniform sampler2D splatTex;
      uniform sampler2D rTex;
      uniform sampler2D gTex;
      uniform sampler2D bTex;
      uniform sampler2D aTex;
      uniform float rScale;
      uniform float gScale;
      uniform float bScale;
      uniform float aScale;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vPos;

      vec4 textureTriplanar(sampler2D tex, float scale, vec3 normal, vec3 position) {
          vec2 uv_x = position.yz * scale;
          vec2 uv_y = position.xz * scale;
          vec2 uv_z = position.xy * scale;
          vec4 xProjection = texture2D(tex, uv_x);
          vec4 yProjection = texture2D(tex, uv_y);
          vec4 zProjection = texture2D(tex, uv_z);
          vec3 weight = abs(normal);
          weight = pow(weight, vec3(4.0)); // bias towards the major axis
          weight = weight / (weight.x + weight.y + weight.z);
          return xProjection * weight.x + yProjection * weight.y + zProjection * weight.z;
      }

      vec3 tri(sampler2D t, float s) {
        return textureTriplanar(t, s, vNorm, vPos).rgb;
      }

      void main() {
          vec4 splat = texture2D(splatTex, vUv);
          vec4 result = vec4(0, 0, 0, 1.0);
          result += splat.r * textureTriplanar(rTex, rScale, vNorm, vPos);
          result += splat.g * textureTriplanar(gTex, gScale, vNorm, vPos);
          result += splat.b * textureTriplanar(bTex, bScale, vNorm, vPos);
          // result += splat.a * textureTriplanar(aTex, aScale, vNorm, vPos);
          // result += (1.0 - splat.a) * textureTriplanar(aTex, aScale, vNorm, vPos);
          // result *= vColor;
          csm_DiffuseColor *= result;
      }
    `,
  })
}

function addWind(mesh, world) {
  if (!world.wind) return
  const uniforms = world.wind.uniforms
  if (mesh.material.hasWind) return
  mesh.material.hasWind = true
  // console.log('added wind to', mesh.name)
  mesh.material.onBeforeCompile = shader => {
    if (!shader.defines) shader.defines = {}
    shader.defines.USE_WIND = 1
    shader.uniforms.time = uniforms.time
    shader.uniforms.strength = uniforms.strength
    shader.uniforms.direction = uniforms.direction
    shader.uniforms.speed = uniforms.speed
    shader.uniforms.noiseScale = uniforms.noiseScale
    shader.uniforms.ampScale = uniforms.ampScale
    shader.uniforms.freqMultiplier = uniforms.freqMultiplier

    const height = mesh.geometry.boundingBox.max.y * mesh.scale.y

    shader.uniforms.height = { value: height } // prettier-ignore
    shader.uniforms.stiffness = { value: 0 }

    // BUG: somehow the wind shader code below is added to other meshes
    // so we wrap it in an ifdef. this might be a bug with CSM because disabling
    // the prepareMaterial in Stage.js the issues goes away
    // tbh the wind code should probably be part
    // of the global shader anyway, same with things like outlines etc.

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      uniform float time;
      uniform float strength;
      uniform vec3 direction;
      uniform float speed;
      uniform float noiseScale;
      uniform float ampScale;
      uniform float freqMultiplier;

      uniform float height;
      uniform float stiffness;

      ${snoise}

      #include <common>
      `
    )

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>

      #ifdef USE_WIND
        vec4 worldPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          worldPos = instanceMatrix * worldPos;
        #endif
        worldPos = modelMatrix * worldPos;

        float heightFactor = position.y / height;
        float noiseFactor = snoise(worldPos.xyz * noiseScale + time * speed);
        vec3 displacement = sin(time * freqMultiplier + worldPos.xyz) * noiseFactor * ampScale * heightFactor * (1.0 - stiffness);
        transformed += strength * displacement * direction;
      #endif
      `
    )
  }
}

// Helper function to count meshes in GLB scene
function countMeshes(object3d) {
  let count = 0
  
  if (object3d.type === 'Mesh') {
    count++
  }
  
  if (object3d.children) {
    for (const child of object3d.children) {
      count += countMeshes(child)
    }
  }
  
  return count
}

const snoise = `
  //	Simplex 3D Noise 
  //	by Ian McEwan, Stefan Gustavson (https://github.com/stegu/webgl-noise)
  //
  vec4 permute(vec4 x){
    return mod(((x*34.0)+1.0)*x, 289.0);
  }
  vec4 taylorInvSqrt(vec4 r){ 
    return 1.79284291400159 - 0.85373472095314 * r; 
  }

  float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
      i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
  }
`
