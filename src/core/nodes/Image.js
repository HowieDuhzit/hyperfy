import { isBoolean, isNumber, isString } from 'lodash-es'
import { Node } from './Node'
import * as THREE from '../extras/three'
import CustomShaderMaterial from '../libs/three-custom-shader-material'

const fits = ['none', 'cover', 'contain']
const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  src: null,
  width: null,
  height: 1,
  fit: 'contain',
  color: 'black',
  pivot: 'center',
  lit: false,
  doubleside: false,
  castShadow: false,
  receiveShadow: false,
}

export class Image extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'image'

    this.src = data.src
    this.width = data.width
    this.height = data.height
    this.fit = data.fit
    this.color = data.color
    this.pivot = data.pivot
    this.lit = data.lit
    this.doubleside = data.doubleside
    this.castShadow = data.castShadow
    this.receiveShadow = data.receiveShadow

    this.n = 0
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._src = source._src
    this._width = source._width
    this._height = source._height
    this._fit = source._fit
    this._color = source._color
    this._pivot = source._pivot
    this._lit = source._lit
    this._doubleside = source._doubleside
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    return this
  }

  async mount() {
    this.build()
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.build()
      return
    }
    if (didMove) {
      if (this.mesh) {
        this.mesh.matrixWorld.copy(this.matrixWorld)
      }
    }
  }

  unmount() {
    this.unbuild()
  }

  async build() {
    this.needsRebuild = false
    if (this.ctx.world.network.isServer) return
    if (!this._src) return
    const n = ++this.n
    let image = this.ctx.world.loader.get('image', this._src)
    if (!image) image = await this.ctx.world.loader.load('image', this._src)
    if (this.n !== n) return
    this.unbuild()
    const imgAspect = image.width / image.height
    let width = this._width
    let height = this._height
    if (width === null && height === null) {
      height = 0
      width = 0
    } else if (width !== null && height === null) {
      height = width / imgAspect
    } else if (height !== null && width === null) {
      width = height * imgAspect
    }
    const geoAspect = width / height
    this.texture = new THREE.Texture(image)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = this.ctx.world.graphics.maxAnisotropy
    this.texture.needsUpdate = true
    if (this._width && this._height) {
      applyFit(this.texture, width, height, this._fit)
    }
    const geometry = new THREE.PlaneGeometry(width, height)
    applyPivot(geometry, width, height, this._pivot)
    
    // UNIFIED MATERIAL CREATION: Let the loader handle WebGPU compatibility
    
    const uniforms = {
      uMap: { value: this.texture },
      uImgAspect: { value: imgAspect },
      uGeoAspect: { value: geoAspect },
      uFit: { value: this._fit === 'cover' ? 1 : this._fit === 'contain' ? 2 : 0 }, // 0 = none, 1 = cover, 2 = contain
      uColor: { value: new THREE.Color(this._color) },
      uTransparent: { value: this._color === 'transparent' ? 1.0 : 0.0 },
    }
    
    // Check renderer type for material selection
    const renderer = this.ctx.world.graphics?.renderer
    const isWebGPU = renderer && (renderer.isWebGPURenderer || renderer.constructor.name === 'WebGPURenderer')
    
    let material
    
    if (isWebGPU) {
      // WebGPU: Create material with proper fit/aspect handling using texture transforms
      material = this._lit ? new THREE.MeshStandardMaterial() : new THREE.MeshBasicMaterial()
      
      if (this._lit) {
        material.roughness = 1
        material.metalness = 0
      }
      
      material.side = this._doubleside ? THREE.DoubleSide : THREE.FrontSide
      
      // Apply texture - always set the texture
      material.map = uniforms.uMap.value
      
      // Apply fit logic using texture repeat and offset
      const fit = uniforms.uFit.value
      const imgAspect = uniforms.uImgAspect.value
      const geoAspect = uniforms.uGeoAspect.value
      const aspect = geoAspect / imgAspect
      
      if (fit === 1) { // cover - fill entire geometry, may crop image
        if (aspect > 1.0) {
          // Geometry is wider than image - scale horizontally to fill
          const scaleY = 1.0 / aspect
          material.map.repeat.set(1.0, scaleY)
          material.map.offset.set(0, (1.0 - scaleY) / 2)
        } else {
          // Geometry is taller than image - scale vertically to fill
          const scaleX = aspect
          material.map.repeat.set(scaleX, 1.0)
          material.map.offset.set((1.0 - scaleX) / 2, 0)
        }
      } else if (fit === 2) { // contain - show entire image, may have empty space
        if (aspect > 1.0) {
          // Geometry is wider than image - fit image horizontally
          const scaleX = aspect
          material.map.repeat.set(scaleX, 1.0)
          material.map.offset.set((1.0 - scaleX) / 2, 0)
        } else {
          // Geometry is taller than image - fit image vertically
          const scaleY = 1.0 / aspect
          material.map.repeat.set(1.0, scaleY)
          material.map.offset.set(0, (1.0 - scaleY) / 2)
        }
      } else { // none - stretch to fill
        material.map.repeat.set(1, 1)
        material.map.offset.set(0, 0)
      }
      
      material.map.needsUpdate = true
      
      // Apply color tinting and transparency
      if (this._color === 'transparent') {
        // When color is 'transparent', make the entire material transparent
        material.opacity = 0
        material.transparent = true
        material.color.set(0xffffff) // White base color
      } else {
        // For normal images, use white color to show original texture colors
        // This avoids the black tinting issue where color='black' would make images appear black
        material.color.set(0xffffff) // White = no tint, shows original texture
        // Enable transparency to handle alpha channels in textures
        material.transparent = true
        material.alphaTest = 0.001 // Small alpha test to avoid z-fighting
      }
      
      // Apply unified material processing
      this.ctx.world.setupMaterial(material)
      
    } else {
      // WebGL: Use CustomShaderMaterial for advanced features
      material = new CustomShaderMaterial({
        baseMaterial: this._lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial,
        roughness: this._lit ? 1 : undefined,
        metalness: this._lit ? 0 : undefined,
        side: this._doubleside ? THREE.DoubleSide : THREE.FrontSide,
        transparent: this._color === 'transparent',
        uniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform float uImgAspect;
          uniform float uGeoAspect;
          uniform int uFit;
          uniform vec3 uColor;
          uniform float uTransparent;
          varying vec2 vUv;
          
          void main() {
            vec2 uv = vUv;
            
            // Apply fitting logic
            if (uFit == 1) { // cover
              float scale = max(uGeoAspect / uImgAspect, 1.0);
              uv = (uv - 0.5) * scale + 0.5;
            } else if (uFit == 2) { // contain
              float scale = min(uGeoAspect / uImgAspect, 1.0);
              uv = (uv - 0.5) * scale + 0.5;
            }
            
            vec4 texColor = texture2D(uMap, uv);
            
            if (uTransparent > 0.5) {
              csm_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            } else {
              csm_FragColor = texColor * vec4(uColor, 1.0);
            }
          }
        `,
      })
      
      // Apply unified material processing
      this.ctx.world.setupMaterial(material)
    }

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = this._castShadow
    this.mesh.receiveShadow = this._receiveShadow
    this.mesh.matrixWorld.copy(this.matrixWorld)
    this.mesh.matrixAutoUpdate = false
    this.mesh.matrixWorldAutoUpdate = false
    this.ctx.world.stage.scene.add(this.mesh)
    this.sItem = {
      matrix: this.matrixWorld,
      geometry,
      material,
      getEntity: () => this.ctx.entity,
      node: this,
    }
    this.ctx.world.stage.octree.insert(this.sItem)
  }

  unbuild() {
    this.n++
    if (this.mesh) {
      this.ctx.world.stage.scene.remove(this.mesh)
      this.mesh.material.dispose()
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    if (this.sItem) {
      this.ctx.world.stage.octree.remove(this.sItem)
      this.sItem = null
    }
  }

  get src() {
    return this._src
  }

  set src(value = defaults.src) {
    if (value !== null && !isString(value)) {
      throw new Error('[image] src not null or string')
    }
    if (this._src === value) return
    this._src = value
    this.needsRebuild = true
    this.setDirty()
  }

  get width() {
    return this._width
  }

  set width(value = defaults.width) {
    if (value !== null && !isNumber(value)) {
      throw new Error('[image] width not null or number')
    }
    if (this._width === value) return
    this._width = value
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value = defaults.height) {
    if (value !== null && !isNumber(value)) {
      throw new Error('[image] height not null or number')
    }
    if (this._height === value) return
    this._height = value
    this.needsRebuild = true
    this.setDirty()
  }

  get fit() {
    return this._fit
  }

  set fit(value = defaults.fit) {
    if (!isFit(value)) {
      throw new Error('[image] fit invalid')
    }
    if (this._fit === value) return
    this._fit = value
    this.needsRebuild = true
    this.setDirty()
  }

  get color() {
    return this._color
  }

  set color(value = defaults.color) {
    if (value !== null && !isString(value)) {
      throw new Error('[image] color not null or string')
    }
    if (this._color === value) return
    this._color = value
    this.needsRebuild = true
    this.setDirty()
  }

  get pivot() {
    return this._pivot
  }

  set pivot(value = defaults.pivot) {
    if (!isPivot(value)) {
      throw new Error('[image] pivot invalid')
    }
    if (this._pivot === value) return
    this._pivot = value
    this.needsRebuild = true
    this.setDirty()
  }

  get lit() {
    return this._lit
  }

  set lit(value = defaults.lit) {
    if (!isBoolean(value)) {
      throw new Error('[image] lit not a boolean')
    }
    if (this._lit === value) return
    this._lit = value
    this.needsRebuild = true
    this.setDirty()
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value = defaults.doubleside) {
    if (!isBoolean(value)) {
      throw new Error('[image] doubleside not a boolean')
    }
    if (this._doubleside === value) return
    this._doubleside = value
    this.needsRebuild = true
    this.setDirty()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value = defaults.castShadow) {
    if (!isBoolean(value)) {
      throw new Error('[image] castShadow not a boolean')
    }
    if (this._castShadow === value) return
    this._castShadow = value
    this.needsRebuild = true
    this.setDirty()
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value = defaults.receiveShadow) {
    if (!isBoolean(value)) {
      throw new Error('[image] receiveShadow not a boolean')
    }
    if (this._receiveShadow === value) return
    this._receiveShadow = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get fit() {
          return self.fit
        },
        set fit(value) {
          self.fit = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get lit() {
          return self.lit
        },
        set lit(value) {
          self.lit = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
        },
        get castShadow() {
          return self.castShadow
        },
        set castShadow(value) {
          self.castShadow = value
        },
        get receiveShadow() {
          return self.receiveShadow
        },
        set receiveShadow(value) {
          self.receiveShadow = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isFit(value) {
  return fits.includes(value)
}

function isPivot(value) {
  return pivots.includes(value)
}

function applyPivot(geometry, width, height, pivot) {
  if (pivot === 'center') return
  let offsetX = 0
  let offsetY = 0
  if (pivot.includes('left')) {
    offsetX = width / 2
  } else if (pivot.includes('right')) {
    offsetX = -width / 2
  }
  if (pivot.includes('top')) {
    offsetY = -height / 2
  } else if (pivot.includes('bottom')) {
    offsetY = height / 2
  }
  if (offsetX !== 0 || offsetY !== 0) {
    geometry.translate(offsetX, offsetY, 0)
  }
}

function applyFit(texture, width, height, fit) {
  if (fit === 'none') return
  // calc aspect ratios
  const containerAspect = width / height
  const imageAspect = texture.image.width / texture.image.height
  // contain: the entire image should be visible inside the container
  // cover: the image should cover the entire container (may crop)
  let scaleX = 1
  let scaleY = 1
  if (fit === 'contain') {
    // if image is wider than container proportionally
    if (imageAspect > containerAspect) {
      // scale Y to maintain aspect ratio
      scaleY = containerAspect / imageAspect
      // center vertically
      texture.offset.y = (1 - scaleY) / 2
    } else {
      // scale X to maintain aspect ratio
      scaleX = imageAspect / containerAspect
      // center horizontally
      texture.offset.x = (1 - scaleX) / 2
    }
  } else if (fit === 'cover') {
    // if image is wider than container proportionally
    if (imageAspect > containerAspect) {
      // scale X to fill container height
      scaleX = containerAspect / imageAspect
      // center horizontally with overflow
      texture.offset.x = (1 - 1 / scaleX) / 2
      scaleX = 1 / scaleX
    } else {
      // scale Y to fill container width
      scaleY = imageAspect / containerAspect
      // center vertically with overflow
      texture.offset.y = (1 - 1 / scaleY) / 2
      scaleY = 1 / scaleY
    }
  }
  texture.repeat.set(scaleX, scaleY)
  texture.needsUpdate = true
}
