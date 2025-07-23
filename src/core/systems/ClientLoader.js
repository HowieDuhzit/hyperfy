import * as THREE from '../extras/three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from './System'
import { createNode } from '../extras/createNode'
import { createVRMFactory } from '../extras/createVRMFactory'
import { glbToNodes } from '../extras/glbToNodes'
import { createEmoteFactory } from '../extras/createEmoteFactory'
import { TextureLoader } from 'three'
import { formatBytes } from '../extras/formatBytes'
import { emoteUrls } from '../extras/playerEmotes'
import Hls from 'hls.js/dist/hls.js'

// THREE.Cache.enabled = true

/**
 * Client Loader System
 *
 * - Runs on the client
 * - Basic file loader for many different formats, cached.
 * - Enhanced with KTX2 compressed textures and DRACO geometry compression
 *
 */
export class ClientLoader extends System {
  constructor(world) {
    super(world)
    this.files = new Map()
    this.promises = new Map()
    this.results = new Map()
    
    // Standard loaders
    this.rgbeLoader = new RGBELoader()
    this.texLoader = new THREE.TextureLoader()
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
    
    // Advanced compression loaders
    this.ktx2Loader = null
    this.dracoLoader = null
    
    this.preloadItems = []
    
    // Initialize advanced loaders
    this.initAdvancedLoaders()
  }

  async initAdvancedLoaders() {
    try {
      // Initialize KTX2Loader for compressed textures (optional)
      try {
      this.ktx2Loader = new KTX2Loader()
      this.ktx2Loader.setTranscoderPath('/libs/basis/')
        console.log('✅ KTX2 texture compression initialized')
      } catch (ktx2Error) {
        console.warn('⚠️ KTX2 loader not available (files missing), continuing without KTX2 support:', ktx2Error)
        this.ktx2Loader = null
      }
      
      // Initialize DRACOLoader for geometry compression (optional)
      try {
      this.dracoLoader = new DRACOLoader()
      this.dracoLoader.setDecoderPath('/libs/draco/')
      this.dracoLoader.preload()
        console.log('✅ DRACO geometry compression initialized')
      } catch (dracoError) {
        console.warn('⚠️ DRACO loader not available (files missing), continuing without DRACO support:', dracoError)
        this.dracoLoader = null
      }
      
      console.log('🚀 Advanced compression loaders initialized: KTX2 + DRACO (optional)')
    } catch (error) {
      console.warn('⚠️ Advanced loaders initialization failed:', error)
    }
  }

  start() {
    // Detect renderer support and configure compression loaders
    if (this.world.graphics?.renderer) {
      if (this.ktx2Loader) {
        this.ktx2Loader.detectSupport(this.world.graphics.renderer)
        
        // Configure GLTFLoader with KTX2 support
        this.gltfLoader.setKTX2Loader(this.ktx2Loader)
        console.log('✅ KTX2 compression enabled for GLTF models')
      } else {
        console.log('ℹ️ KTX2 texture compression not available, using standard texture loading')
      }
      
      if (this.dracoLoader) {
        // Configure GLTFLoader with DRACO support
        this.gltfLoader.setDRACOLoader(this.dracoLoader)
        console.log('✅ DRACO geometry compression enabled for GLTF models')
      } else {
        console.log('ℹ️ DRACO geometry compression not available, using standard geometry loading')
      }
    }
    this.vrmHooks = {
      camera: this.world.camera,
      scene: this.world.stage.scene,
      octree: this.world.stage.octree,
      setupMaterial: this.world.setupMaterial,
      loader: this.world.loader,
    }
  }

  has(type, url) {
    const key = `${type}/${url}`
    return this.promises.has(key)
  }

  get(type, url) {
    const key = `${type}/${url}`
    return this.results.get(key)
  }

  preload(type, url) {
    this.preloadItems.push({ type, url })
  }

  execPreload() {
    let loadedItems = 0
    let totalItems = this.preloadItems.length
    let progress = 0
    const promises = this.preloadItems.map(item => {
      return this.load(item.type, item.url).then(() => {
        loadedItems++
        progress = (loadedItems / totalItems) * 100
        this.world.emit('progress', progress)
      })
    })
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
      // this.world.emit('ready', true)
    })
  }

  setFile(url, file) {
    this.files.set(url, file)
  }

  hasFile(url) {
    url = this.world.resolveURL(url)
    return this.files.has(url)
  }

  getFile(url, name) {
    url = this.world.resolveURL(url)
    const file = this.files.get(url)
    if (!file) return null
    if (name) {
      return new File([file], name, {
        type: file.type, // Preserve the MIME type
        lastModified: file.lastModified, // Preserve the last modified timestamp
      })
    }
    return file
  }

  loadFile = async url => {
    url = this.world.resolveURL(url)
    if (this.files.has(url)) {
      return this.files.get(url)
    }
    const resp = await fetch(url)
    const blob = await resp.blob()
    const file = new File([blob], url.split('/').pop(), { type: blob.type })
    this.files.set(url, file)
    return file
  }

  async load(type, url) {
    if (this.preloader) {
      await this.preloader
    }
    const key = `${type}/${url}`
    if (this.promises.has(key)) {
      return this.promises.get(key)
    }
    if (type === 'video') {
      const promise = new Promise(resolve => {
        url = this.world.resolveURL(url)
        const factory = createVideoFactory(this.world, url)
        resolve(factory)
      })
      this.promises.set(key, promise)
      return promise
    }
    const promise = this.loadFile(url).then(async file => {
      if (type === 'hdr') {
        const buffer = await file.arrayBuffer()
        const result = this.rgbeLoader.parse(buffer)
        // we just mimicing what rgbeLoader.load() does behind the scenes
        const texture = new THREE.DataTexture(result.data, result.width, result.height)
        texture.colorSpace = THREE.LinearSRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false
        texture.flipY = true
        texture.type = result.type
        texture.needsUpdate = true
        this.results.set(key, texture)
        return texture
      }
      if (type === 'image') {
        return new Promise(resolve => {
          const img = new Image()
          img.onload = () => {
            this.results.set(key, img)
            resolve(img)
            // URL.revokeObjectURL(img.src)
          }
          img.src = URL.createObjectURL(file)
        })
      }
      if (type === 'texture') {
        return new Promise(resolve => {
          const img = new Image()
          img.onload = () => {
            const texture = new THREE.Texture(img)
            texture.colorSpace = THREE.SRGBColorSpace
            texture.anisotropy = this.world.graphics.maxAnisotropy
            texture.needsUpdate = true
            this.results.set(key, texture)
            resolve(texture)
            URL.revokeObjectURL(img.src)
          }
          img.src = URL.createObjectURL(file)
        })
      }
      if (type === 'ktx2') {
        if (!this.ktx2Loader) {
          throw new Error('KTX2Loader not initialized')
        }
        const buffer = await file.arrayBuffer()
        const texture = await this.ktx2Loader.parseAsync(buffer)
        this.results.set(key, texture)
        return texture
      }
      if (type === 'model') {
        const buffer = await file.arrayBuffer()
        
        // UNIFIED GLB LOADING: Use same process for both WebGL and WebGPU
        console.log('🔧 Loading GLB model with unified pipeline (WebGL/WebGPU compatible)')
        
        const glb = await this.gltfLoader.parseAsync(buffer)
        
        // Ensure consistent material processing for both renderers
        this.ensureConsistentMaterials(glb)
        
        const node = glbToNodes(glb, this.world)
        const model = {
          toNodes() {
            return node.clone(true)
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, model)
        return model
      }
      if (type === 'emote') {
        const buffer = await file.arrayBuffer()
        const glb = await this.gltfLoader.parseAsync(buffer)
        
        // Ensure consistent material processing for emotes too
        this.ensureConsistentMaterials(glb)
        
        const factory = createEmoteFactory(glb, url)
        const emote = {
          toClip(options) {
            return factory.toClip(options)
          },
        }
        this.results.set(key, emote)
        return emote
      }
      if (type === 'avatar') {
        const buffer = await file.arrayBuffer()
        const glb = await this.gltfLoader.parseAsync(buffer)
        
        // Ensure consistent material processing for avatars
        this.ensureConsistentMaterials(glb)
        
        const factory = createVRMFactory(glb, this.world.setupMaterial)
        const hooks = this.vrmHooks
        const node = createNode('group', { id: '$root' })
        const node2 = createNode('avatar', { id: 'avatar', factory, hooks })
        node.add(node2)
        const avatar = {
          factory,
          hooks,
          toNodes() {
            return node.clone(true)
          },
          getStats() {
            return node.getStats(true)
          },
        }
        this.results.set(key, avatar)
        return avatar
      }
      if (type === 'script') {
        const code = await file.text()
        const script = this.world.scripts.evaluate(code)
        this.results.set(key, script)
        return script
      }
      if (type === 'audio') {
        const buffer = await file.arrayBuffer()
        const audioBuffer = await this.world.audio.ctx.decodeAudioData(buffer)
        this.results.set(key, audioBuffer)
        return audioBuffer
      }
    })
    this.promises.set(key, promise)
    return promise
  }

  // NEW: Ensure consistent material processing between WebGL and WebGPU
  ensureConsistentMaterials(glb) {
    const renderer = this.world.graphics?.renderer
    const isWebGPU = renderer && (renderer.isWebGPURenderer || renderer.constructor.name === 'WebGPURenderer')
    
    if (!isWebGPU) {
      // WebGL - no changes needed, already works correctly
      return
    }
    
    console.log('🔧 Applying WebGPU material compatibility fixes to GLB')
    
    // Traverse all materials in the GLB and ensure WebGPU compatibility
    glb.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        
        materials.forEach((material, index) => {
          if (material.isMaterial) {
            // Apply WebGPU-specific material fixes
            this.applyWebGPUMaterialFixes(material)
          }
        })
      }
    })
  }
  
  // NEW: Apply WebGPU-specific material fixes to match WebGL behavior
  applyWebGPUMaterialFixes(material) {
    // Ensure textures are properly configured for WebGPU
    const textureProperties = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']
    
    textureProperties.forEach(prop => {
      if (material[prop]) {
        const texture = material[prop]
        
        // Ensure proper texture settings for WebGPU
        if (texture.isTexture) {
          // Match WebGL texture configuration
          texture.anisotropy = Math.min(this.world.graphics?.maxAnisotropy || 16, 16)
          texture.generateMipmaps = texture.image && 
            (texture.image.width & (texture.image.width - 1)) === 0 && 
            (texture.image.height & (texture.image.height - 1)) === 0
          
          // Ensure proper color space
          if (prop === 'map' || prop === 'emissiveMap') {
            texture.colorSpace = THREE.SRGBColorSpace
          } else {
            texture.colorSpace = THREE.NoColorSpace
          }
          
          texture.needsUpdate = true
        }
      }
    })
    
    // Ensure material properties are WebGPU-compatible
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
      // Clamp values to prevent WebGPU shader compilation issues
      material.roughness = Math.max(0.04, Math.min(1.0, material.roughness || 1.0))
      material.metalness = Math.max(0.0, Math.min(1.0, material.metalness || 0.0))
      
      // Ensure proper alpha handling
      if (material.transparent) {
        material.alphaTest = material.alphaTest || 0.01
      }
    }
    
    // Force material update
    material.needsUpdate = true
    
    console.log(`✅ Applied WebGPU material fixes to ${material.name || 'unnamed material'}`)
  }

  insert(type, url, file) {
    const key = `${type}/${url}`
    const localUrl = URL.createObjectURL(file)
    let promise
    if (type === 'hdr') {
      promise = this.rgbeLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'image') {
      promise = new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          this.results.set(key, img)
          resolve(img)
        }
        img.src = localUrl
      })
    }
    if (type === 'video') {
      promise = new Promise(resolve => {
        const factory = createVideoFactory(this.world, localUrl)
        resolve(factory)
      })
    }
    if (type === 'texture') {
      promise = this.texLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
    }
    if (type === 'ktx2') {
      if (!this.ktx2Loader) {
        promise = Promise.reject(new Error('KTX2Loader not initialized'))
      } else {
        promise = this.ktx2Loader.loadAsync(localUrl).then(texture => {
          this.results.set(key, texture)
          return texture
        })
      }
    }
    if (type === 'model') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const node = glbToNodes(glb, this.world)
        const model = {
          toNodes() {
            return node.clone(true)
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, model)
        return model
      })
    }
    if (type === 'emote') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const factory = createEmoteFactory(glb, url)
        const emote = {
          toClip(options) {
            return factory.toClip(options)
          },
        }
        this.results.set(key, emote)
        return emote
      })
    }
    if (type === 'avatar') {
      promise = this.gltfLoader.loadAsync(localUrl).then(glb => {
        const factory = createVRMFactory(glb, this.world.setupMaterial)
        const hooks = this.vrmHooks
        const node = createNode('group', { id: '$root' })
        const node2 = createNode('avatar', { id: 'avatar', factory, hooks })
        node.add(node2)
        const avatar = {
          factory,
          hooks,
          toNodes(customHooks) {
            const clone = node.clone(true)
            if (customHooks) {
              clone.get('avatar').hooks = customHooks
            }
            return clone
          },
          getStats() {
            const stats = node.getStats(true)
            // append file size
            stats.fileBytes = file.size
            return stats
          },
        }
        this.results.set(key, avatar)
        return avatar
      })
    }
    if (type === 'script') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const code = await file.text()
          const script = this.world.scripts.evaluate(code)
          this.results.set(key, script)
          resolve(script)
        } catch (err) {
          reject(err)
        }
      })
    }
    if (type === 'audio') {
      promise = new Promise(async (resolve, reject) => {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const audioBuffer = await this.world.audio.ctx.decodeAudioData(arrayBuffer)
          this.results.set(key, audioBuffer)
          resolve(audioBuffer)
        } catch (err) {
          reject(err)
        }
      })
    }
    this.promises.set(key, promise)
  }

  destroy() {
    this.files.clear()
    this.promises.clear()
    this.results.clear()
    this.preloadItems = []
  }
}

function createVideoFactory(world, url) {
  const isHLS = url?.endsWith('.m3u8')
  const sources = {}
  let width
  let height
  let duration
  let ready = false
  let prepare
  function createSource(key) {
    const elem = document.createElement('video')
    elem.crossOrigin = 'anonymous'
    elem.playsInline = true
    elem.loop = false
    elem.muted = true
    elem.style.width = '1px'
    elem.style.height = '1px'
    elem.style.position = 'absolute'
    elem.style.opacity = '0'
    elem.style.zIndex = '-1000'
    elem.style.pointerEvents = 'none'
    elem.style.overflow = 'hidden'
    const needsPolyfill = isHLS && !elem.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()
    if (needsPolyfill) {
      const hls = new Hls()
      hls.loadSource(url)
      hls.attachMedia(elem)
    } else {
      elem.src = url
    }
    const audio = world.audio.ctx.createMediaElementSource(elem)
    let n = 0
    let dead
    world.audio.ready(() => {
      if (dead) return
      elem.muted = false
    })
    // set linked=false to have a separate source (and texture)
    const texture = new THREE.VideoTexture(elem)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = world.graphics.maxAnisotropy
    if (!prepare) {
      prepare = (function () {
        /**
         *
         * A regular video will load data automatically BUT a stream
         * needs to hit play() before it gets that data.
         *
         * The following code handles this for us, and when streaming
         * will hit play just until we get the data needed, then pause.
         */
        return new Promise(async resolve => {
          let playing = false
          let data = false
          elem.addEventListener(
            'loadeddata',
            async () => {
              // if we needed to hit play to fetch data then revert back to paused
              // console.log('[video] loadeddata', { playing })
              if (playing) elem.pause()
              data = true
              // await new Promise(resolve => setTimeout(resolve, 2000))
              width = elem.videoWidth
              height = elem.videoHeight
              duration = elem.duration
              ready = true
              resolve()
            },
            { once: true }
          )
          elem.addEventListener(
            'loadedmetadata',
            async () => {
              // we need a gesture before we can potentially hit play
              // console.log('[video] ready')
              // await this.engine.driver.gesture
              // if we already have data do nothing, we're done!
              // console.log('[video] gesture', { data })
              if (data) return
              // otherwise hit play to force data loading for streams
              elem.play()
              playing = true
            },
            { once: true }
          )
        })
      })()
    }
    function isPlaying() {
      return elem.currentTime > 0 && !elem.paused && !elem.ended && elem.readyState > 2
    }
    function play(restartIfPlaying = false) {
      if (restartIfPlaying) elem.currentTime = 0
      elem.play()
    }
    function pause() {
      elem.pause()
    }
    function stop() {
      elem.currentTime = 0
      elem.pause()
    }
    function release() {
      n--
      if (n === 0) {
        stop()
        audio.disconnect()
        texture.dispose()
        document.body.removeChild(elem)
        delete sources[key]
        // help to prevent chrome memory leaks
        // see: https://github.com/facebook/react/issues/15583#issuecomment-490912533
        elem.src = ''
        elem.load()
      }
    }
    const handle = {
      elem,
      audio,
      texture,
      prepare,
      get ready() {
        return ready
      },
      get width() {
        return width
      },
      get height() {
        return height
      },
      get duration() {
        return duration
      },
      get loop() {
        return elem.loop
      },
      set loop(value) {
        elem.loop = value
      },
      get isPlaying() {
        return isPlaying()
      },
      get currentTime() {
        return elem.currentTime
      },
      set currentTime(value) {
        elem.currentTime = value
      },
      play,
      pause,
      stop,
      release,
    }
    return {
      createHandle() {
        n++
        if (n === 1) {
          document.body.appendChild(elem)
        }
        return handle
      },
    }
  }
  return {
    get(key) {
      let source = sources[key]
      if (!source) {
        source = createSource(key)
        sources[key] = source
      }
      return source.createHandle()
    },
  }
}
