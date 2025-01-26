import * as THREE from '../extras/three'

import { System } from './System'

import { CSM } from '../libs/csm/CSM'

const csmLevels = {
  none: {
    cascades: 1,
    shadowMapSize: 1024,
    castShadow: false,
    lightIntensity: 3,
    // shadowBias: 0.000002,
    // shadowNormalBias: 0.001,
    shadowIntensity: 2,
  },
  low: {
    cascades: 1,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.0000009,
    shadowNormalBias: 0.001,
    shadowIntensity: 2,
  },
  med: {
    cascades: 3,
    shadowMapSize: 1024,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000002,
    shadowNormalBias: 0.002,
    shadowIntensity: 2,
  },
  high: {
    cascades: 3,
    shadowMapSize: 2048,
    castShadow: true,
    lightIntensity: 1,
    shadowBias: 0.000003,
    shadowNormalBias: 0.002,
    shadowIntensity: 2,
  },
}

const defaults = {
  sky: '/day2-2k.jpg',
  hdr: '/day2.hdr',
}

/**
 * Environment System
 *
 * - Runs on the client
 * - Sets up the sky, hdr, sun, shadows, fog etc
 *
 */
export class ClientEnvironment extends System {
  constructor(world) {
    super(world)

    this.sky = null
    this.skyUrl = null
    this.skyN = 0
    this.skys = []

    this.hdr = null
    this.hdrUrl = null
    this.hdrN = 0
    this.hdrs = []

    this.nebulae = []
    this.spaceObjects = []
    this.ufoOrbs = []
  }

  async start() {
    this.buildCSM()
    this.updateHDR()

    this.world.client.settings.on('change', this.onSettingsChange)
    this.world.graphics.on('resize', this.onViewportResize)

    // Remove the default environment and skybox setup
    // this.updateSky() // Commented out to remove skybox

    // Add background elements
    this.addStars()
    this.addNebulae()
    this.addPlanets()
    this.addMatrixRain()
    this.addSpaceObjects()
    this.addUFOOrbs()

    // Check admin status before initializing flight
    if (this.world.client?.isAdmin) {
        this.initializeAdminFlight();
    }
  }

  addSky(url) {
    const handle = {
      url,
      destroy: () => {
        const idx = this.skys.indexOf(handle)
        if (idx === -1) return
        this.skys.splice(idx, 1)
        this.updateSky()
      },
    }
    this.skys.push(handle)
    this.updateSky()
    return handle
  }

  async updateSky() {
    const url = this.skys[this.skys.length - 1]?.url || defaults.sky
    if (this.skyUrl === url) return
    this.skyUrl = url
    if (!this.sky) {
      const geometry = new THREE.SphereGeometry(1000, 60, 40)
      const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
      this.sky = new THREE.Mesh(geometry, material)
      this.sky.geometry.computeBoundsTree()
      this.sky.material.needsUpdate = true
      this.sky.material.fog = false
      this.sky.material.toneMapped = false
      this.sky.matrixAutoUpdate = false
      this.sky.matrixWorldAutoUpdate = false
      this.sky.visible = false
      this.world.stage.scene.add(this.sky)
    }
    const n = ++this.skyN
    const texture = await this.world.loader.load('texture', url)
    if (n !== this.skyN) return
    // texture = texture.clone()
    texture.minFilter = texture.magFilter = THREE.LinearFilter
    texture.mapping = THREE.EquirectangularReflectionMapping
    // texture.encoding = Encoding[this.encoding]
    texture.colorSpace = THREE.SRGBColorSpace
    this.sky.material.map = texture
    this.sky.visible = true
  }

  addHDR(url) {
    const handle = {
      url,
      destroy: () => {
        const idx = this.hdrs.indexOf(handle)
        if (idx === -1) return
        this.hdrs.splice(idx, 1)
        this.updateHDR()
      },
    }
    this.hdrs.push(handle)
    this.updateHDR()
    return handle
  }

  async updateHDR() {
    const url = this.hdrs[this.hdrs.length - 1]?.url || defaults.hdr
    if (this.hdrUrl === url) return
    this.hdrUrl = url
    const n = ++this.hdrN
    const texture = await this.world.loader.load('hdr', url)
    if (n !== this.hdrN) return
    // texture.colorSpace = THREE.NoColorSpace
    // texture.colorSpace = THREE.SRGBColorSpace
    // texture.colorSpace = THREE.LinearSRGBColorSpace
    texture.mapping = THREE.EquirectangularReflectionMapping
    this.world.stage.scene.environment = texture
  }

  update(delta) {
    this.csm.update()
    
    // Slower, more subtle animation for background effect
    this.nebulae.forEach((nebula, index) => {
      nebula.material.uniforms.time.value += delta * 0.2;
      nebula.rotation.x += delta * 0.01 * (index % 2 ? 1 : -1);
      nebula.rotation.y += delta * 0.008 * (index % 2 ? -1 : 1);
    });

    // Animate stars
    if (this.stars) {
        this.stars.forEach((starLayer, index) => {
            starLayer.rotation.y += delta * 0.01 * (index + 1);
            starLayer.rotation.x += delta * 0.005 * (index + 1);
        });
    }

    // Animate planets
    if (this.planets) {
        this.planets.forEach((planetObj, index) => {
            // Update shader time uniforms
            planetObj.planet.material.uniforms.time.value += delta;
            planetObj.atmosphere.material.uniforms.time.value += delta;

            // Rotate planets
            planetObj.planet.rotation.y += delta * 0.05 * (index % 2 ? 1 : -1);
            
            // Subtle wobble
            planetObj.planet.position.y += Math.sin(this.time * 0.5) * 0.1;
        });
    }

    // Animate matrix rain
    if (this.matrixDrops) {
        this.matrixDrops.forEach(rain => {
            rain.material.uniforms.time.value += delta;
            rain.rotation.y += delta * 0.05;
        });
        
        // Add lightning update
        if (this.updateLightning) {
            this.updateLightning(delta);
        }
    }

    // Update space objects with larger removal distance
    for (let i = this.spaceObjects.length - 1; i >= 0; i--) {
        const obj = this.spaceObjects[i];
        obj.lifetime += delta;
        
        // Move object
        obj.mesh.position.addScaledVector(obj.direction, obj.speed * delta);
        
        // Update shader time
        obj.mesh.material.uniforms.time.value += delta;
        
        // Remove if too far or too old (increased distance)
        const distance = obj.mesh.position.length();
        if (distance > 15000 || obj.lifetime > 30) { // Increased removal distance and lifetime
            this.world.stage.scene.remove(obj.mesh);
            this.spaceObjects.splice(i, 1);
        }
    }

    // Update UFO orbs
    if (this.ufoOrbs && this.world.entities.player?.base) {
        const playerPosition = this.world.entities.player.base.position;
        
        this.ufoOrbs.forEach(orb => {
            orb.mesh.material.uniforms.time.value += delta;
            orb.stateTime += delta;
            
            // Update orb behavior based on state
            switch(orb.state) {
                case 'approaching':
                    // Smooth approach with easing
                    const approachTarget = new THREE.Vector3().copy(playerPosition).add(orb.offset);
                    const approachDir = approachTarget.clone().sub(orb.mesh.position).normalize();
                    const approachDist = orb.mesh.position.distanceTo(approachTarget);
                    const approachSpeed = orb.speed * Math.min(1.0, approachDist / 500);
                    orb.mesh.position.addScaledVector(approachDir, approachSpeed * delta);
                    
                    // Smooth transition to following state
                    if (approachDist < 300) {
                        orb.state = 'following';
                        orb.stateTime = 0;
                        orb.lastOffset = orb.offset.clone();
                        orb.nextOffset = new THREE.Vector3(
                            THREE.MathUtils.randFloatSpread(200),
                            THREE.MathUtils.randFloatSpread(200),
                            THREE.MathUtils.randFloatSpread(200)
                        );
                        orb.offsetTransition = 0;
                    }
                    break;

                case 'following':
                    // Smooth orbital movement with curious behavior
                    orb.offsetTransition += delta * 0.3; // Slow transition between positions
                    if (orb.offsetTransition >= 1) {
                        orb.lastOffset = orb.nextOffset;
                        orb.nextOffset = new THREE.Vector3(
                            THREE.MathUtils.randFloatSpread(200),
                            THREE.MathUtils.randFloatSpread(200),
                            THREE.MathUtils.randFloatSpread(200)
                        );
                        orb.offsetTransition = 0;
                    }

                    // Smoothly interpolate between last and next offset
                    const currentOffset = new THREE.Vector3();
                    currentOffset.lerpVectors(
                        orb.lastOffset, 
                        orb.nextOffset, 
                        smoothStep(orb.offsetTransition)
                    );
                    
                    // Add gentle wobble
                    const wobble = new THREE.Vector3(
                        Math.sin(orb.stateTime * 2.0) * 10,
                        Math.cos(orb.stateTime * 1.7) * 10,
                        Math.sin(orb.stateTime * 1.5) * 10
                    );
                    currentOffset.add(wobble);

                    // Calculate target position with smooth following
                    const followTarget = new THREE.Vector3().copy(playerPosition).add(currentOffset);
                    const followDir = followTarget.clone().sub(orb.mesh.position).normalize();
                    const followDist = orb.mesh.position.distanceTo(followTarget);
                    const followSpeed = orb.speed * 0.5 * Math.min(1.0, followDist / 100);
                    
                    orb.mesh.position.addScaledVector(followDir, followSpeed * delta);
                    
                    // Randomly decide to leave after some time, with smooth transition
                    if (orb.stateTime > 10 && Math.random() < 0.005) {
                        orb.state = 'leaving';
                        orb.stateTime = 0;
                    }
                    break;

                case 'leaving':
                    // Smooth departure
                    if (!orb.leaveTarget) {
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        const r = 4000;
                        orb.leaveTarget = new THREE.Vector3(
                            r * Math.sin(phi) * Math.cos(theta),
                            r * Math.sin(phi) * Math.sin(theta),
                            r * Math.cos(phi)
                        );
                    }
                    
                    const leaveDir = orb.leaveTarget.clone().sub(orb.mesh.position).normalize();
                    const leaveDist = orb.mesh.position.distanceTo(orb.leaveTarget);
                    const leaveSpeed = orb.speed * (1 + (leaveDist / 1000));
                    orb.mesh.position.addScaledVector(leaveDir, leaveSpeed * delta);
                    
                    if (orb.mesh.position.length() > 3000) {
                        this.world.stage.scene.remove(orb.mesh);
                        const index = this.ufoOrbs.indexOf(orb);
                        if (index > -1) {
                            this.ufoOrbs.splice(index, 1);
                        }
                    }
                    break;
            }

            // If player doesn't exist and not already leaving, start leaving
            if (!this.world.entities.player?.base && orb.state !== 'leaving') {
                orb.state = 'leaving';
                orb.stateTime = 0;
                orb.leaveTarget = null;
            }
        });
    }
  }

  buildCSM() {
    if (this.csm) this.csm.dispose()
    const scene = this.world.stage.scene
    const camera = this.world.camera
    const options = csmLevels[this.world.client.settings.shadows]
    this.csm = new CSM({
      mode: 'practical', // uniform, logarithmic, practical, custom
      // mode: 'custom',
      // customSplitsCallback: function (cascadeCount, nearDistance, farDistance) {
      //   return [0.05, 0.2, 0.5]
      // },
      cascades: 3,
      shadowMapSize: 2048,
      maxFar: 100,
      lightIntensity: 1,
      lightDirection: new THREE.Vector3(-1, -2, -2).normalize(),
      fade: true,
      parent: scene,
      camera: camera,
      // note: you can play with bias in console like this:
      // var csm = world.graphics.csm
      // csm.shadowBias = 0.00001
      // csm.shadowNormalBias = 0.002
      // csm.updateFrustums()
      // shadowBias: 0.00001,
      // shadowNormalBias: 0.002,
      // lightNear: 0.0000001,
      // lightFar: 5000,
      // lightMargin: 200,
      // noLastCascadeCutOff: true,
      ...options,
      // note: you can test changes in console and then call csm.updateFrustrums() to debug
    })
    for (const light of this.csm.lights) {
      light.shadow.intensity = options.shadowIntensity
    }
    if (!options.castShadow) {
      for (const light of this.csm.lights) {
        light.castShadow = false
      }
    }
  }

  onSettingsChange = changes => {
    if (changes.shadows) {
      this.buildCSM()
    }
  }

  onViewportResize = () => {
    this.csm.updateFrustums()
  }

  addStars() {
    const starColors = [
        new THREE.Color('#ff1b8d').multiplyScalar(0.8),
        new THREE.Color('#8b2fe6').multiplyScalar(0.7),
        new THREE.Color('#0e9fff').multiplyScalar(0.9),
    ];

    // Create a texture for the stars
    const starTexture = (() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 64;
        canvas.width = size;
        canvas.height = size;

        // Create radial gradient for soft orb effect
        const gradient = ctx.createRadialGradient(
            size/2, size/2, 0,
            size/2, size/2, size/2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    })();

    starColors.forEach((color, index) => {
    const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: color },
                starTexture: { value: starTexture }
            },
            vertexShader: `
                attribute float size;
                varying float vSize;
                
                void main() {
                    vSize = size;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Dynamic size based on distance and base size
                    float distanceScale = 1.0 - smoothstep(0.0, 4000.0, length(position));
                    gl_PointSize = size * (1.0 + distanceScale * 0.8) * (300.0 / -mvPosition.z);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform sampler2D starTexture;
                varying float vSize;
                
                void main() {
                    vec4 texColor = texture2D(starTexture, gl_PointCoord);
                    
                    // Add bloom effect
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    float glow = smoothstep(0.5, 0.0, dist);
                    
                    // Combine texture color with glow
                    vec3 finalColor = color * (1.0 + glow * 0.5);
                    float alpha = texColor.a * (0.8 + glow * 0.2);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const starCount = 15000 + (index * 4000);
    const starVertices = [];
        const sizes = [];
        
        for (let i = 0; i < starCount; i++) {
            const isInnerRegion = Math.random() < 0.6;
            let x, y, z, size;
            
            if (isInnerRegion) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.pow(Math.random(), 0.7) * 2000;
                
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
                
                size = 0.3 + Math.random() * 0.7;
            } else {
                x = THREE.MathUtils.randFloatSpread(8000);
                y = THREE.MathUtils.randFloatSpread(8000);
                z = THREE.MathUtils.randFloatSpread(8000);
                
                size = 0.8 + Math.random() * 1.2;
            }
            
            const cluster = Math.random() > 0.85;
            if (cluster) {
                const clusterCenter = new THREE.Vector3(x, y, z);
                const clusterSize = isInnerRegion ? 15 : 30;
                const clusterCount = isInnerRegion ? 5 : 3;
                
                for (let j = 0; j < clusterCount; j++) {
                    const offsetX = THREE.MathUtils.randFloatSpread(clusterSize);
                    const offsetY = THREE.MathUtils.randFloatSpread(clusterSize);
                    const offsetZ = THREE.MathUtils.randFloatSpread(clusterSize);
                    
                    starVertices.push(
                        clusterCenter.x + offsetX,
                        clusterCenter.y + offsetY,
                        clusterCenter.z + offsetZ
                    );
                    sizes.push(size * 0.8);
                }
            } else {
      starVertices.push(x, y, z);
                sizes.push(size);
            }
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const stars = new THREE.Points(starGeometry, starMaterial);
        
        stars.rotation.x = Math.random() * Math.PI;
        stars.rotation.y = Math.random() * Math.PI;
        
        this.stars = this.stars || [];
        this.stars.push(stars);
        
    this.world.stage.scene.add(stars);
    });
  }

  addNebulae() {
    // Create multiple nebula clouds with cyberpunk colors
    const nebulaColors = [
        new THREE.Color('#ff1b8d').multiplyScalar(0.25), // Increased brightness
        new THREE.Color('#8b2fe6').multiplyScalar(0.2),  // Increased brightness
        new THREE.Color('#0e9fff').multiplyScalar(0.22), // Increased brightness
    ];

    // Increased number of nebulae
    for (let i = 0; i < 7; i++) {
      const nebulaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color: { value: nebulaColors[i % nebulaColors.length] }
        },
        vertexShader: `
                varying vec3 vPosition;
          varying vec2 vUv;
                varying vec3 vNormal;
                uniform float time;
                
                void main() {
                    vPosition = position;
                    vUv = uv;
                    vNormal = normal;
                    
                    // Add more pronounced vertex displacement
                    vec3 pos = position;
                    float displacement = sin(position.x * 0.03 + time * 0.1) * 
                                       cos(position.y * 0.03 + time * 0.1) * 
                                       sin(position.z * 0.03 + time * 0.1) * 50.0;
                    pos += normal * displacement;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
          varying vec3 vPosition;
                varying vec2 vUv;
                varying vec3 vNormal;

                // Improved noise function for denser patterns
                float noise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float n = mix(mix(mix(dot(random3(i), f),
                                        dot(random3(i + vec3(1,0,0)), f - vec3(1,0,0)),f.x),
                                    mix(dot(random3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                                        dot(random3(i + vec3(1,1,0)), f - vec3(1,1,0)),f.x),
                                mix(mix(dot(random3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                                        dot(random3(i + vec3(1,0,1)), f - vec3(1,0,1)),f.x),
                                    mix(dot(random3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                                        dot(random3(i + vec3(1,1,1)), f - vec3(1,1,1)),f.y),f.z);
                    return n * 0.5 + 0.5;
                }

                vec3 random3(vec3 p) {
                    return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),
                                       dot(p,vec3(269.5,183.3,246.1)),
                                       dot(p,vec3(113.5,271.9,124.6))))*43758.5453123);
                }

                void main() {
                    // Create denser cloud shape with multiple noise layers
                    float n = noise(vPosition * 0.008 + time * 0.05);
                    float detail1 = noise(vPosition * 0.016 + time * 0.1) * 0.5;
                    float detail2 = noise(vPosition * 0.032 + time * 0.15) * 0.25;
                    float detail3 = noise(vPosition * 0.064 + time * 0.2) * 0.125;
                    
                    // Combine noise layers with more weight on details
                    float noise = n + detail1 + detail2 + detail3;
                    
                    // Enhanced edge effect
                    float edge = noise(vPosition * 0.1 + time * 0.1);
                    edge = smoothstep(0.2, 0.8, edge);
                    
                    // Enhanced fresnel effect
                    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                    
                    // Combine everything with increased base opacity
                    float alpha = smoothstep(0.2, 0.8, noise) * 0.15; // Increased opacity
                    alpha *= mix(1.0, edge, 0.6);
                    alpha *= mix(1.0, fresnel, 0.5);
                    
                    // Enhanced color variation
                    vec3 finalColor = color + vec3(detail3 * 0.2);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        // Smaller geometry for denser appearance
        const nebulaGeometry = new THREE.IcosahedronGeometry(800, 5);
        const nebulaMesh = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
        
        // Position nebulae closer together
        let x, y, z;
        do {
            const phi = Math.acos(-1 + (2 * i) / 7);
            const theta = Math.sqrt(8 * Math.PI) * phi;
            
            const radius = 1200 + Math.random() * 800;
            x = radius * Math.cos(theta) * Math.sin(phi);
            y = radius * Math.sin(theta) * Math.sin(phi);
            z = radius * Math.cos(phi);
        } while (!this.clearSphereTest(x, y, z, 300));

        nebulaMesh.position.set(x, y, z);
        
        // More varied rotation
        nebulaMesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        // Larger, more varied scale
        const scale = 1.5 + Math.random() * 2.5;
        nebulaMesh.scale.set(
            scale * (0.8 + Math.random() * 0.4),
            scale * (0.8 + Math.random() * 0.4),
            scale * 0.4 // Still relatively flat but thicker
        );

        this.nebulae.push(nebulaMesh);
        this.world.stage.scene.add(nebulaMesh);
    }
  }

  initializeAdminFlight() {
    const FLIGHT_SPEED = 2.5;
    let isFlying = false;
    
    // Create cyberpunk HUD styles
    const style = document.createElement('style');
    style.textContent = `
        .flight-hud {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #0ff;
            border-radius: 5px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            color: #0ff;
            text-shadow: 0 0 10px #0ff;
            z-index: 1000;
        }
        .flight-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .neon-text {
            font-size: 14px;
            letter-spacing: 2px;
            animation: neon-pulse 1.5s infinite alternate;
        }
        .flight-status {
            font-size: 12px;
            margin-top: 5px;
            color: #ff3333;
        }
        .flight-status.active {
            color: #00ff00;
        }
        @keyframes neon-pulse {
            from { text-shadow: 0 0 5px #0ff, 0 0 10px #0ff, 0 0 15px #0ff; }
            to { text-shadow: 0 0 10px #0ff, 0 0 20px #0ff, 0 0 30px #0ff; }
        }
    `;
    document.head.appendChild(style);
    
    // Create HUD element
    const flightHUD = document.createElement('div');
    flightHUD.className = 'flight-hud';
    flightHUD.innerHTML = `
        <div class="flight-indicator">
            <span class="neon-text">FLIGHT MODE</span>
            <div class="flight-status">DISABLED</div>
        </div>
    `;
    document.body.appendChild(flightHUD);

    // Bind to control system instead of raw event listener
    this.flightControl = this.world.controls.bind({
        priority: ControlPriorities.PLAYER,
        onPress: (code) => {
            if (code === 'KeyF') {
                isFlying = !isFlying;
                flightHUD.querySelector('.flight-status').textContent = 
                    isFlying ? 'ENABLED' : 'DISABLED';
                flightHUD.querySelector('.flight-status').className = 
                    `flight-status ${isFlying ? 'active' : ''}`;
            }
        },
        onFixedUpdate: () => {
            if (!isFlying) return;
            
            const player = this.world.entities.player;
            if (!player) return;

            // Get current velocity
            const velocity = player.capsule.getLinearVelocity();
            
            // Apply vertical movement
            if (this.flightControl.buttons.Space) {
                velocity.y = FLIGHT_SPEED * 10; 
            } else if (this.flightControl.buttons.ShiftLeft || this.flightControl.buttons.ShiftRight) {
                velocity.y = -FLIGHT_SPEED * 10;
            } else {
                velocity.y = 0; // Hover when no up/down input
            }

            // Update velocity
            player.capsule.setLinearVelocity(velocity.toPxVec3());
            
            // Disable gravity while flying
            player.capsule.setActorFlag(PHYSX.PxActorFlagEnum.eDISABLE_GRAVITY, true);
        }
    });
  }

  destroy() {
    if (this.flightControl) {
        this.flightControl.release();
    }
    // ... other cleanup code ...
    clearInterval(this.spaceObjectInterval);
    this.spaceObjects.forEach(obj => {
        this.world.stage.scene.remove(obj.mesh);
    });
    clearInterval(this.ufoInterval);
    this.ufoOrbs.forEach(orb => {
        this.world.stage.scene.remove(orb.mesh);
    });
  }

  addPlanets() {
    const planetColors = [
        {
            core: new THREE.Color('#ff1b8d'),      // Hot pink core
            atmosphere: new THREE.Color('#ff1b8d').multiplyScalar(0.5) // Dimmed atmosphere
        },
        {
            core: new THREE.Color('#8b2fe6'),      // Purple core
            atmosphere: new THREE.Color('#8b2fe6').multiplyScalar(0.5)
        },
        {
            core: new THREE.Color('#0e9fff'),      // Bright blue core
            atmosphere: new THREE.Color('#0e9fff').multiplyScalar(0.5)
        }
    ];

    this.planets = [];

    planetColors.forEach((colors, index) => {
        // Create planet core
        const radius = 50 + Math.random() * 100;
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        
        // Create cyberpunk-style shader material for the planet
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                coreColor: { value: colors.core },
                atmosphereColor: { value: colors.atmosphere },
                gridIntensity: { value: 0.5 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
          void main() {
            vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
                uniform vec3 coreColor;
                uniform vec3 atmosphereColor;
                uniform float gridIntensity;
                
          varying vec2 vUv;
                varying vec3 vNormal;
          varying vec3 vPosition;

                float grid(vec2 uv, float size) {
                    vec2 grid = fract(uv * size);
                    return (step(0.95, grid.x) + step(0.95, grid.y)) * 0.5;
                }
                
                void main() {
                    // Create grid pattern
                    float gridSmall = grid(vUv, 50.0);
                    float gridLarge = grid(vUv, 10.0);
                    
                    // Create atmosphere glow
                    float atmosphere = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                    
                    // Pulse effect
                    float pulse = sin(time * 2.0) * 0.5 + 0.5;
                    
                    // Combine effects
                    vec3 finalColor = mix(coreColor, atmosphereColor, atmosphere);
                    finalColor += (gridSmall + gridLarge) * gridIntensity;
                    finalColor += atmosphere * atmosphereColor * pulse;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            transparent: true
        });

        const planet = new THREE.Mesh(geometry, material);

        // Position planets at different distances and angles
        const angle = (Math.PI * 2 * index) / planetColors.length;
        const distance = 1000 + Math.random() * 500;
        planet.position.x = Math.cos(angle) * distance;
        planet.position.y = (Math.random() - 0.5) * 400;
        planet.position.z = Math.sin(angle) * distance;

        // Random rotation
        planet.rotation.x = Math.random() * Math.PI;
        planet.rotation.y = Math.random() * Math.PI;
        planet.rotation.z = Math.random() * Math.PI;

        // Add atmosphere glow
        const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.2, 32, 32);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: colors.atmosphere }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(color, intensity * (sin(time) * 0.2 + 0.8));
                }
            `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });

        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        planet.add(atmosphere);

        this.planets.push({ planet, atmosphere });
        this.world.stage.scene.add(planet);
    });
  }

  addMatrixRain() {
    const matrixColors = [
        new THREE.Color('#ff1b8d').multiplyScalar(3.0), // Much brighter
        new THREE.Color('#0e9fff').multiplyScalar(3.0),
    ];

    // Create textures for 0 and 1
    const createCharTexture = (char) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const charSize = 128; // Doubled texture size
        canvas.width = charSize;
        canvas.height = charSize;
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, charSize, charSize);
        ctx.font = `bold ${charSize * 0.9}px monospace`; // Increased font size ratio
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(char, charSize/2, charSize/2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
    };

    const texture0 = createCharTexture('0');
    const texture1 = createCharTexture('1');

    this.matrixDrops = [];

    matrixColors.forEach((color, colorIndex) => {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: color },
                texture0: { value: texture0 },
                texture1: { value: texture1 }
            },
            vertexShader: `
                attribute float velocity;
                attribute float charType;
                attribute float emission;
                varying float vCharType;
                varying float vEmission;
                uniform float time;

                void main() {
                    vec3 pos = position;
                    pos.y = mod(pos.y - velocity * time, 5000.0) - 2500.0;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Much larger base size
                    float size = 96.0 * (1.0 / -mvPosition.z);
                    gl_PointSize = size;

                    vCharType = charType;
                    vEmission = emission;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform sampler2D texture0;
                uniform sampler2D texture1;
                varying float vCharType;
                varying float vEmission;

                vec3 random3(vec3 p) {
                    return fract(sin(vec3(
                        dot(p,vec3(127.1,311.7,74.7)),
                        dot(p,vec3(269.5,183.3,246.1)),
                        dot(p,vec3(113.5,271.9,124.6))))*43758.5453123);
          }

          void main() {
                    vec4 texColor;
                    if (vCharType > 0.5) {
                        texColor = texture2D(texture1, gl_PointCoord);
                    } else {
                        texColor = texture2D(texture0, gl_PointCoord);
                    }
                    
                    // Stronger emission glow
                    vec3 finalColor = color * (1.0 + vEmission * 5.0);
                    float alpha = texColor.r * 0.9 * (0.7 + vEmission);
                    
                    // Enhanced bloom effect
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    float glow = smoothstep(0.5, 0.1, dist);
                    alpha *= glow;
                    
                    gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const dropCount = 1500;
        const positions = [];
        const velocities = [];
        const charTypes = [];  // 0 or 1
        const emissions = [];  // Random emission strength

        for (let i = 0; i < dropCount; i++) {
            let x, y, z;
            if (Math.random() < 0.5) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.pow(Math.random(), 0.5) * 1500;
                
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            } else {
                const innerRegion = Math.random() < 0.3; // 30% chance for inner region
                if (innerRegion) {
                    x = THREE.MathUtils.randFloatSpread(500); // Closer to center
                    y = THREE.MathUtils.randFloatSpread(500);
                    z = THREE.MathUtils.randFloatSpread(500);
                } else {
                    x = THREE.MathUtils.randFloatSpread(5000);
                    y = THREE.MathUtils.randFloatSpread(5000);
                    z = THREE.MathUtils.randFloatSpread(5000);
                }
            }

            // Create trails
            const trailLength = Math.floor(3 + Math.random() * 4);
            for (let j = 0; j < trailLength; j++) {
                positions.push(
                    x + THREE.MathUtils.randFloatSpread(15),
                    y - j * 60 + THREE.MathUtils.randFloatSpread(5),
                    z + THREE.MathUtils.randFloatSpread(15)
                );
                velocities.push(15 + Math.random() * 60);
                charTypes.push(Math.random() > 0.5 ? 1 : 0);
                emissions.push(0.3 + Math.random() * 0.7);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 1));
        geometry.setAttribute('charType', new THREE.Float32BufferAttribute(charTypes, 1));
        geometry.setAttribute('emission', new THREE.Float32BufferAttribute(emissions, 1));

        const matrixRain = new THREE.Points(geometry, material);
        this.matrixDrops.push(matrixRain);
        this.world.stage.scene.add(matrixRain);
    });

    // Add after the matrix drops creation
    this.lightningSystem = {
        lines: [],
        material: new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color('#00ffff').multiplyScalar(1.2) }, // Reduced brightness
                glitchOffset: { value: 0 }
            },
            vertexShader: `
                attribute float offset;
                uniform float time;
                uniform float glitchOffset;
                varying float vProgress;
                
                void main() {
                    vProgress = position.y + 0.5;
                    
                    // More aggressive zigzag with glitch effect
                    float glitchTime = time * 10.0 + glitchOffset;
                    float glitch = step(0.95, fract(glitchTime)) * 10.0 * sin(glitchTime * 100.0);
                    float zigzag = sin((position.y + time * 8.0 + offset) * 40.0) * 1.0;
                    
                    vec3 pos = position;
                    pos.x += zigzag + glitch;
                    pos.z += zigzag - glitch;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                varying float vProgress;
                
                float random(float x) {
                    return fract(sin(x * 12.9898) * 43758.5453);
                }
                
                void main() {
                    float intensity = sin(vProgress * 3.14159);
                    
                    // Add glitch effect to intensity
                    float glitchTime = floor(time * 20.0);
                    float glitch = step(0.8, random(glitchTime));
                    intensity *= mix(1.0, random(glitchTime + vProgress), glitch * 0.5);
                    
                    // Flicker effect
                    float flicker = mix(0.8, 1.0, random(floor(time * 30.0)));
                    
                    vec3 finalColor = color * intensity * flicker;
                    float alpha = intensity * 0.3; // Reduced base opacity
                    
                    // Occasional dropout
                    if (random(floor(time * 5.0) + vProgress) < 0.05) {
                        alpha = 0.0;
                    }
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    };

    // Function to create lightning between two points
    const createLightning = (start, end) => {
        const points = [];
        const segments = 15; // More segments for more detail
        const offsetsArray = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            // Add slight random offset to path
            const offset = (Math.random() - 0.5) * 5;
            points.push(
                start.x + (end.x - start.x) * t + offset,
                start.y + (end.y - start.y) * t + offset,
                start.z + (end.z - start.z) * t + offset
            );
            offsetsArray.push(Math.random() * 20); // Increased random offset
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setAttribute('offset', new THREE.Float32BufferAttribute(offsetsArray, 1));

        const line = new THREE.Line(geometry, this.lightningSystem.material);
        this.lightningSystem.lines.push({
            mesh: line,
            lifetime: 0.1 + Math.random() * 0.2, // Shorter lifetime
            currentLife: 0
        });
        this.world.stage.scene.add(line);
    };

    // Add to update method
    this.updateLightning = (delta) => {
        // Update existing lightning
        for (let i = this.lightningSystem.lines.length - 1; i >= 0; i--) {
            const lightning = this.lightningSystem.lines[i];
            lightning.currentLife += delta;
            
            if (lightning.currentLife >= lightning.lifetime) {
                this.world.stage.scene.remove(lightning.mesh);
                this.lightningSystem.lines.splice(i, 1);
            }
        }

        // Create new lightning with adjusted probabilities
        if (Math.random() < 0.2) { // Slightly increased chance
            const drops = this.matrixDrops;
            for (const drop of drops) {
                const positions = drop.geometry.attributes.position.array;
                const charTypes = drop.geometry.attributes.charType.array;
                
                const stride = 9;
                for (let i = 0; i < positions.length; i += stride) {
                    if (charTypes[i/3] === 1 && Math.random() < 0.08) { // Increased chance
                        const pos1 = new THREE.Vector3(
                            positions[i],
                            positions[i+1],
                            positions[i+2]
                        );
                        
                        // Look for nearby '1' characters with adjusted distance check
                        for (let j = i + stride; j < positions.length; j += stride) {
                            if (charTypes[j/3] === 1) {
                                const pos2 = new THREE.Vector3(
                                    positions[j],
                                    positions[j+1],
                                    positions[j+2]
                                );
                                
                                const distance = pos1.distanceTo(pos2);
                                // Allow closer connections and increase chance for nearby ones
                                const maxDistance = 100;
                                const connectionChance = 0.15 * (1 - distance/maxDistance);
                                if (distance < maxDistance && Math.random() < connectionChance) {
                                    createLightning(pos1, pos2);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Update material uniforms
        this.lightningSystem.material.uniforms.time.value += delta;
        this.lightningSystem.material.uniforms.glitchOffset.value = Math.floor(Date.now() / 50) * 0.1;
    };
  }

  addSpaceObjects() {
    // Create comet/asteroid material with trail
    const cometMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color('#ff1b8d') },
            trailColor: { value: new THREE.Color('#ff1b8d').multiplyScalar(0.7) }
        },
        vertexShader: `
            attribute float trailFactor;
            varying float vTrailFactor;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                vTrailFactor = trailFactor;
                vPosition = position;
                
                // Enhanced wobble effect
                vec3 pos = position;
                if (trailFactor > 0.0) {
                    float wobble = sin(time * 8.0 + trailFactor * 15.0) * 4.0;
                    pos.x += wobble * trailFactor;
                    pos.y += wobble * trailFactor;
                }
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = 20.0 * (1.0 - trailFactor); // Larger core size
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform vec3 trailColor;
            varying float vTrailFactor;
            
            void main() {
                vec3 finalColor = mix(color, trailColor, vTrailFactor);
                // Enhanced glow effect
                float alpha = (1.0 - vTrailFactor * 0.8) * (1.0 - length(gl_PointCoord - vec2(0.5)) * 2.0);
                alpha = smoothstep(0.0, 1.0, alpha);
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const createSpaceObject = () => {
        const isComet = Math.random() > 0.5;
        const geometry = new THREE.BufferGeometry();
        
        // Create trail points in the correct direction
        const points = [];
        const trailFactors = [];
        const trailLength = isComet ? 80 : 40;
        const trailWidth = isComet ? 150 : 100;
        
        for (let i = 0; i < trailLength; i++) {
            const factor = i / (trailLength - 1);
            const spread = (1 - factor) * trailWidth * 0.2;
            for (let j = 0; j < 5; j++) {
                points.push(
                    THREE.MathUtils.randFloatSpread(spread),
                    THREE.MathUtils.randFloatSpread(spread),
                    factor * trailWidth  // Positive to extend trail in positive Z
                );
                trailFactors.push(factor);
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setAttribute('trailFactor', new THREE.Float32BufferAttribute(trailFactors, 1));

        const material = cometMaterial.clone();
        material.uniforms.color.value = isComet ? 
            new THREE.Color('#ff1b8d').multiplyScalar(3) : 
            new THREE.Color('#0e9fff').multiplyScalar(2.5);
        material.uniforms.trailColor.value = material.uniforms.color.value.clone().multiplyScalar(0.6);

        const object = new THREE.Points(geometry, material);
        
        // Start position from much further away
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 12000 + Math.random() * 5000; // Much further spawn distance
        const startPos = new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        
        // Target position with wider range
        const targetOffset = 4000; // Increased target area
        const targetPos = new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(targetOffset),
            THREE.MathUtils.randFloatSpread(targetOffset),
            THREE.MathUtils.randFloatSpread(targetOffset)
        );

        // Calculate direction and rotation
        const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
        
        // Create quaternion for rotation - using positive forward vector
        const quaternion = new THREE.Quaternion();
        const forward = new THREE.Vector3(0, 0, 1); // Changed to positive Z
        quaternion.setFromUnitVectors(forward.negate(), direction); // Negate the forward vector
        
        // Apply rotation to geometry
        geometry.applyQuaternion(quaternion);
        
        // Set position
        object.position.copy(startPos);

        // Increased speeds to compensate for longer distances
        const speed = isComet ? 1200 + Math.random() * 1000 : 600 + Math.random() * 600;
        
        this.spaceObjects.push({
            mesh: object,
            direction: direction,
            speed: speed,
            isComet: isComet,
            lifetime: 0
        });

        this.world.stage.scene.add(object);
    };

    // Create more initial objects
    for (let i = 0; i < 8; i++) {
        createSpaceObject();
    }

    // More frequent creation
    this.spaceObjectInterval = setInterval(() => {
        if (this.spaceObjects.length < 15 && Math.random() > 0.5) {
            createSpaceObject();
        }
    }, 1500);
  }

  addUFOOrbs() {
    const orbMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color('#00ffff') },
            pulseColor: { value: new THREE.Color('#ff00ff') }
        },
        vertexShader: `
            varying vec3 vPosition;
            varying vec3 vNormal;
            
            void main() {
                vPosition = position;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color;
            uniform vec3 pulseColor;
            varying vec3 vPosition;
            varying vec3 vNormal;
            
            vec3 random3(vec3 p) {
                return fract(sin(vec3(
                    dot(p,vec3(127.1,311.7,74.7)),
                    dot(p,vec3(269.5,183.3,246.1)),
                    dot(p,vec3(113.5,271.9,124.6))))*43758.5453123);
            }
            
            void main() {
                // Create pulsing glow effect
                float pulse = sin(time * 2.0) * 0.5 + 0.5;
                
                // Create energy field effect
                float energyRings = abs(sin(length(vPosition) * 10.0 - time * 3.0));
                
                // Create scanning line effect
                float scanLine = smoothstep(0.0, 0.1, abs(sin(vPosition.y * 20.0 + time * 5.0)));
                
                // Add noise to make it more ethereal
                vec3 noise = random3(vPosition + vec3(time * 0.1));
                
                // Combine effects
                vec3 finalColor = mix(color, pulseColor, pulse * energyRings);
                finalColor += scanLine * 0.5;
                finalColor += noise * 0.1;
                
                // Add rim lighting
                float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                finalColor += rim * color;
                
                gl_FragColor = vec4(finalColor, 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    const createUFOOrb = () => {
        // Reduced size from 7.5 to about 2 (75% smaller again)
        const geometry = new THREE.SphereGeometry(1.875, 32, 32);
        const material = orbMaterial.clone();
        
        // Randomize colors
        const hue = Math.random();
        material.uniforms.color.value.setHSL(hue, 1, 0.5);
        material.uniforms.pulseColor.value.setHSL((hue + 0.5) % 1, 1, 0.5);

        const orb = new THREE.Mesh(geometry, material);
        
        // Random starting position far from player
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 2000 + Math.random() * 1000;
        
        orb.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );

        this.ufoOrbs.push({
            mesh: orb,
            state: 'approaching', // approaching, following, leaving
            stateTime: 0,
            speed: 100 + Math.random() * 200,
            offset: new THREE.Vector3(
                THREE.MathUtils.randFloatSpread(200),
                THREE.MathUtils.randFloatSpread(200),
                THREE.MathUtils.randFloatSpread(200)
            ),
            rotationAxis: new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize()
        });

        this.world.stage.scene.add(orb);
    };

    // Create initial UFO orbs as a group
    const createOrbGroup = () => {
        const groupSize = 2 + Math.floor(Math.random() * 4); // 2-5 orbs per group
        for (let i = 0; i < groupSize; i++) {
            createUFOOrb();
        }
    };

    // Create initial group
    createOrbGroup();

    // Periodically create new UFO orb groups
    this.ufoInterval = setInterval(() => {
        if (this.ufoOrbs.length < 12 && Math.random() > 0.7) { // Increased max orbs
            createOrbGroup();
        }
    }, 8000); // Slightly longer interval for larger groups
  }

  clearSphereTest(x, y, z, radius = 200) {
    const distance = Math.sqrt(x * x + y * y + z * z);
    return distance > radius;
  }
}

function smoothStep(x) {
    return x * x * (3 - 2 * x);
}
