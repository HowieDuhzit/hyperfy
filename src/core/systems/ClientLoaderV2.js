import * as THREE from '../extras/three.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { System } from './System.js'
import { createNode } from '../extras/createNode.js'
import { createVRMFactory } from '../extras/createVRMFactory.js'
import { glbToNodes } from '../extras/glbToNodes.js'
import { createEmoteFactory } from '../extras/createEmoteFactory.js'
import { TextureLoader } from 'three'
import { formatBytes } from '../extras/formatBytes.js'
import { emoteUrls } from '../extras/playerEmotes.js'
import { hyperdriveRegistry } from '../utils/BrowserHyperdrive.js'

// THREE.Cache.enabled = true

/**
 * Client Loader System V2
 *
 * - Runs on the client
 * - Support for both HTTP and P2P Hyperdrive asset loading
 * - Basic file loader for many different formats, cached.
 *
 */
export class ClientLoaderV2 extends System {
  constructor(world) {
    super(world)
    this.files = new Map()
    this.promises = new Map()
    this.results = new Map()
    this.rgbeLoader = new RGBELoader()
    this.texLoader = new TextureLoader()
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))
    this.preloadItems = []
    
    // P2P support
    this.hyperdriveInstances = new Map()
    this.p2pEnabled = this.isP2PEnabled()
  }

  start() {
    this.vrmHooks = {
      camera: this.world.camera,
      scene: this.world.stage.scene,
      octree: this.world.stage.octree,
      setupMaterial: this.world.setupMaterial,
      loader: this.world.loader,
    }
  }

  /**
   * Check if P2P assets are enabled
   */
  isP2PEnabled() {
    // Check localStorage feature flag
    if (typeof window !== 'undefined' && window.localStorage) {
      const assetType = localStorage.getItem('hyperfy_assets_type')
      if (assetType === 'hyperdrive') {
        return true
      }
    }
    
    // Check if environment variables suggest P2P
    if (typeof process !== 'undefined' && process.env) {
      return process.env.HYPERFY_ASSETS_TYPE === 'hyperdrive'
    }
    
    return false
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
    const promises = this.preloadItems.map(item => this.load(item.type, item.url))
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null
      this.world.emit('ready', true)
    })
  }

  setFile(url, file) {
    this.files.set(url, file)
  }

  getFile(url) {
    url = this.world.resolveURL(url)
    return this.files.get(url)
  }

  /**
   * Enhanced loadFile that supports both HTTP and Hyperdrive URLs
   */
  loadFile = async url => {
    url = this.world.resolveURL(url)
    
    if (this.files.has(url)) {
      return this.files.get(url)
    }
    
    let file
    
    if (url.startsWith('hyperdrive://')) {
      // P2P Hyperdrive asset loading
      file = await this.loadHyperdriveFile(url)
    } else {
      // Traditional HTTP asset loading
      const resp = await fetch(url)
      const blob = await resp.blob()
      file = new File([blob], url.split('/').pop(), { type: blob.type })
    }
    
    this.files.set(url, file)
    return file
  }

  /**
   * Load a file from Hyperdrive P2P network
   */
  async loadHyperdriveFile(url) {
    try {
      // Parse hyperdrive:// URL
      const urlObj = new URL(url)
      const driveKey = urlObj.hostname
      const filePath = urlObj.pathname
      
      console.log(`Loading P2P asset: ${filePath} from drive: ${driveKey}`)
      
      // Get or create hyperdrive instance
      let hyperdrive = this.hyperdriveInstances.get(driveKey)
      if (!hyperdrive) {
        hyperdrive = await hyperdriveRegistry.get(driveKey)
        this.hyperdriveInstances.set(driveKey, hyperdrive)
      }
      
      // Load file from hyperdrive
      const buffer = await hyperdrive.get(filePath)
      if (!buffer) {
        throw new Error('File not found in hyperdrive')
      }
      
      // Create file object from buffer
      const filename = filePath.split('/').pop()
      const mimeType = this.getMimeType(filename)
      const blob = new Blob([buffer], { type: mimeType })
      const file = new File([blob], filename, { type: mimeType })
      
      console.log(`Successfully loaded P2P asset: ${filename} (${file.size} bytes)`)
      return file
      
    } catch (error) {
      console.error('Error loading hyperdrive file:', error)
      // Fall back to HTTP if P2P fails
      return this.loadHttpFallback(url)
    }
  }

  /**
   * Fallback to HTTP loading for hyperdrive URLs
   */
  async loadHttpFallback(hyperdriveUrl) {
    console.warn('Falling back to HTTP for hyperdrive URL:', hyperdriveUrl)
    
    // Convert hyperdrive:// URL to HTTP URL
    // This is a temporary fallback - in production, we'd want proper P2P loading
    const url = new URL(hyperdriveUrl)
    const httpUrl = `${this.world.assetsUrl}${url.pathname}`
    
    try {
      const resp = await fetch(httpUrl)
      const blob = await resp.blob()
      return new File([blob], url.pathname.split('/').pop(), { type: blob.type })
    } catch (error) {
      console.error('HTTP fallback failed:', error)
      throw error
    }
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    const mimeTypes = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      
      // 3D Models
      'glb': 'model/gltf-binary',
      'gltf': 'model/gltf+json',
      
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      
      // Scripts
      'js': 'application/javascript',
      'txt': 'text/plain',
      'json': 'application/json',
      
      // Other
      'hdr': 'image/vnd.radiance',
    }
    
    return mimeTypes[ext] || 'application/octet-stream'
  }

  async load(type, url) {
    if (this.preloader) {
      await this.preloader
    }
    const key = `${type}/${url}`
    if (this.promises.has(key)) {
      return this.promises.get(key)
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
      if (type === 'texture') {
        return new Promise(resolve => {
          const img = new Image()
          img.onload = () => {
            const texture = this.texLoader.load(img.src)
            this.results.set(key, texture)
            resolve(texture)
            URL.revokeObjectURL(img.src)
          }
          img.src = URL.createObjectURL(file)
        })
      }
      if (type === 'model') {
        const buffer = await file.arrayBuffer()
        const glb = await this.gltfLoader.parseAsync(buffer)
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
    if (type === 'texture') {
      promise = this.texLoader.loadAsync(localUrl).then(texture => {
        this.results.set(key, texture)
        return texture
      })
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
}