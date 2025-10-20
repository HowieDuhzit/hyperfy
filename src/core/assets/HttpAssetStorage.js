import { AssetStorage, ASSET_EVENTS } from './AssetStorage.js'
import { EventEmitter } from 'events'
import fs from 'fs/promises'
import path from 'path'
import { hashFile } from '../utils-server.js'

/**
 * HTTP-based asset storage implementation
 * 
 * Maintains backward compatibility with the existing HTTP file-based asset system.
 * Assets are stored as files and served via HTTP endpoints.
 */
export class HttpAssetStorage extends AssetStorage {
  constructor() {
    super()
    this.emitter = new EventEmitter()
    this.assetsDir = null
    this.baseUrl = null
    this.ready = false
    this.stats = {
      totalAssets: 0,
      totalSize: 0,
      lastUpdated: null
    }
  }

  /**
   * Initialize HTTP asset storage
   * @param {Object} options
   * @param {string} options.assetsDir - Local directory for asset files
   * @param {string} options.baseUrl - Base URL for asset access (e.g., 'http://localhost:3000/assets')
   */
  async initialize(options = {}) {
    const { assetsDir, baseUrl } = options
    
    if (!assetsDir) {
      throw new Error('HttpAssetStorage requires an assetsDir option')
    }
    
    if (!baseUrl) {
      throw new Error('HttpAssetStorage requires a baseUrl option')
    }

    this.assetsDir = assetsDir
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

    // Ensure assets directory exists
    await fs.mkdir(assetsDir, { recursive: true })

    // Update stats
    await this._updateStats()
    
    this.ready = true
    this.emitter.emit(ASSET_EVENTS.READY)
    
    console.log(`HttpAssetStorage initialized:`)
    console.log(`  Assets Dir: ${assetsDir}`)
    console.log(`  Base URL: ${this.baseUrl}`)
    console.log(`  Total Assets: ${this.stats.totalAssets}`)
  }

  /**
   * Store an asset from a buffer
   */
  async storeAsset(buffer, filename, options = {}) {
    if (!this.ready) {
      throw new Error('Asset storage not ready')
    }

    try {
      // Generate hash-based filename
      const hash = await hashFile(buffer)
      const ext = path.extname(filename).toLowerCase()
      const hashedFilename = `${hash}${ext}`
      const filePath = path.join(this.assetsDir, hashedFilename)
      
      // Check if file already exists
      const exists = await this._fileExists(filePath)
      if (!exists) {
        await fs.writeFile(filePath, buffer)
        this.stats.totalAssets++
        this.stats.totalSize += buffer.length
        this.stats.lastUpdated = new Date().toISOString()
        
        this.emitter.emit(ASSET_EVENTS.ASSET_ADDED, {
          hash,
          filename: hashedFilename,
          originalName: filename,
          size: buffer.length
        })
      }
      
      const assetInfo = {
        hash,
        filename: hashedFilename,
        originalName: filename,
        url: `${this.baseUrl}/${hashedFilename}`,
        size: buffer.length,
        type: this._getAssetType(ext),
        extension: ext,
        exists: true
      }
      
      return assetInfo
      
    } catch (error) {
      console.error('Error storing asset:', error)
      this.emitter.emit(ASSET_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Check if an asset exists
   */
  async hasAsset(hash) {
    if (!this.ready) {
      return false
    }

    try {
      const files = await fs.readdir(this.assetsDir)
      return files.some(file => file.startsWith(hash))
    } catch (error) {
      return false
    }
  }

  /**
   * Get asset metadata
   */
  async getAssetInfo(hash) {
    if (!this.ready) {
      return null
    }

    try {
      const files = await fs.readdir(this.assetsDir)
      const filename = files.find(file => file.startsWith(hash))
      
      if (!filename) {
        return null
      }
      
      const filePath = path.join(this.assetsDir, filename)
      const stats = await fs.stat(filePath)
      const ext = path.extname(filename)
      
      return {
        hash,
        filename,
        url: `${this.baseUrl}/${filename}`,
        size: stats.size,
        type: this._getAssetType(ext),
        extension: ext,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Get asset data as buffer
   */
  async getAssetBuffer(hash) {
    if (!this.ready) {
      return null
    }

    try {
      const files = await fs.readdir(this.assetsDir)
      const filename = files.find(file => file.startsWith(hash))
      
      if (!filename) {
        return null
      }
      
      const filePath = path.join(this.assetsDir, filename)
      return await fs.readFile(filePath)
    } catch (error) {
      return null
    }
  }

  /**
   * Get asset URL for client access
   */
  async getAssetUrl(hash, options = {}) {
    const assetInfo = await this.getAssetInfo(hash)
    return assetInfo?.url || null
  }

  /**
   * List all assets with optional filtering
   */
  async listAssets(options = {}) {
    if (!this.ready) {
      return []
    }

    try {
      const files = await fs.readdir(this.assetsDir)
      const assets = []
      
      for (const filename of files) {
        const filePath = path.join(this.assetsDir, filename)
        const stats = await fs.stat(filePath)
        const ext = path.extname(filename)
        const hash = filename.split('.')[0]
        
        // Apply filters
        if (options.extension && ext !== options.extension) {
          continue
        }
        
        if (options.minSize && stats.size < options.minSize) {
          continue
        }
        
        if (options.maxSize && stats.size > options.maxSize) {
          continue
        }
        
        assets.push({
          hash,
          filename,
          url: `${this.baseUrl}/${filename}`,
          size: stats.size,
          type: this._getAssetType(ext),
          extension: ext,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString()
        })
      }
      
      return assets
    } catch (error) {
      console.error('Error listing assets:', error)
      return []
    }
  }

  /**
   * Remove an asset
   */
  async removeAsset(hash) {
    if (!this.ready) {
      return false
    }

    try {
      const files = await fs.readdir(this.assetsDir)
      const filename = files.find(file => file.startsWith(hash))
      
      if (!filename) {
        return false
      }
      
      const filePath = path.join(this.assetsDir, filename)
      const stats = await fs.stat(filePath)
      
      await fs.unlink(filePath)
      
      this.stats.totalAssets--
      this.stats.totalSize -= stats.size
      this.stats.lastUpdated = new Date().toISOString()
      
      this.emitter.emit(ASSET_EVENTS.ASSET_REMOVED, {
        hash,
        filename,
        size: stats.size
      })
      
      return true
    } catch (error) {
      console.error('Error removing asset:', error)
      return false
    }
  }

  /**
   * Cleanup unused assets
   */
  async cleanupAssets(options = {}) {
    const { maxAge, dryRun = false } = options
    const results = {
      scannedCount: 0,
      removedCount: 0,
      freedBytes: 0,
      errors: []
    }
    
    try {
      const assets = await this.listAssets()
      results.scannedCount = assets.length
      
      for (const asset of assets) {
        try {
          let shouldRemove = false
          
          // Age-based cleanup
          if (maxAge) {
            const ageMs = Date.now() - new Date(asset.createdAt).getTime()
            if (ageMs > maxAge) {
              shouldRemove = true
            }
          }
          
          if (shouldRemove) {
            if (!dryRun) {
              const removed = await this.removeAsset(asset.hash)
              if (removed) {
                results.removedCount++
                results.freedBytes += asset.size
              }
            } else {
              results.removedCount++
              results.freedBytes += asset.size
            }
          }
        } catch (error) {
          results.errors.push({
            hash: asset.hash,
            error: error.message
          })
        }
      }
    } catch (error) {
      results.errors.push({
        operation: 'cleanup',
        error: error.message
      })
    }
    
    return results
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    await this._updateStats()
    
    return {
      type: 'http',
      ready: this.ready,
      assetsDir: this.assetsDir,
      baseUrl: this.baseUrl,
      totalAssets: this.stats.totalAssets,
      totalSizeBytes: this.stats.totalSize,
      lastUpdated: this.stats.lastUpdated,
      peerCount: 0 // HTTP has no peers
    }
  }

  /**
   * Close storage and cleanup
   */
  async close() {
    this.ready = false
    this.emitter.removeAllListeners()
    console.log('HttpAssetStorage closed')
  }

  /**
   * Update internal statistics
   */
  async _updateStats() {
    try {
      const assets = await this.listAssets()
      this.stats.totalAssets = assets.length
      this.stats.totalSize = assets.reduce((sum, asset) => sum + asset.size, 0)
      this.stats.lastUpdated = new Date().toISOString()
    } catch (error) {
      console.error('Error updating stats:', error)
    }
  }

  /**
   * Check if file exists
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get asset type from extension
   */
  _getAssetType(ext) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp']
    const modelExts = ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.ply']
    const audioExts = ['.mp3', '.wav', '.ogg', '.aac', '.m4a']
    const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv']
    const textExts = ['.txt', '.json', '.xml', '.csv']
    
    ext = ext.toLowerCase()
    
    if (imageExts.includes(ext)) return 'image'
    if (modelExts.includes(ext)) return 'model'
    if (audioExts.includes(ext)) return 'audio'
    if (videoExts.includes(ext)) return 'video'
    if (textExts.includes(ext)) return 'text'
    
    return 'unknown'
  }

  /**
   * Event subscription for asset events
   */
  on(event, listener) {
    this.emitter.on(event, listener)
  }

  off(event, listener) {
    this.emitter.off(event, listener)
  }

  once(event, listener) {
    this.emitter.once(event, listener)
  }
}