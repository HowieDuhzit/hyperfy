import { AssetStorage, ASSET_EVENTS } from './AssetStorage.js'
import { EventEmitter } from 'events'
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import { hashFile } from '../utils-server.js'
import path from 'path'
import fs from 'fs/promises'

/**
 * P2P Asset Storage implementation using Hyperdrive
 * 
 * Uses Hyperdrive for distributed file storage and replication.
 * Assets are stored in the hyperdrive and replicated across peers automatically.
 */
export class HyperdriveAssetStorage extends AssetStorage {
  constructor() {
    super()
    this.emitter = new EventEmitter()
    this.drive = null
    this.corestore = null
    this.storageDir = null
    this.ready = false
    this.peers = new Set()
    this.swarm = null
    
    // Metrics
    this.metrics = {
      totalAssets: 0,
      totalSize: 0,
      peerCount: 0,
      syncEvents: 0,
      lastSync: null
    }
  }

  /**
   * Initialize Hyperdrive asset storage
   * @param {Object} options
   * @param {string} options.storageDir - Directory for hyperdrive storage
   * @param {string} [options.worldId] - World identifier for deterministic keys
   * @param {Buffer} [options.key] - Existing hyperdrive key to use
   * @param {Object} [options.swarm] - Hyperswarm instance for networking
   */
  async initialize(options = {}) {
    const { storageDir, worldId, key, swarm } = options
    
    if (!storageDir) {
      throw new Error('HyperdriveAssetStorage requires a storageDir option')
    }

    this.storageDir = storageDir
    this.swarm = swarm

    // Ensure storage directory exists
    await fs.mkdir(storageDir, { recursive: true })

    // Create hyperdrive path
    const drivePath = path.join(storageDir, 'hyperdrive')
    
    try {
      // Initialize corestore
      this.corestore = new Corestore(drivePath)
      
      // Initialize hyperdrive
      this.drive = new Hyperdrive(this.corestore, key)
      await this.drive.ready()

      // Set up event handlers
      this._setupEventHandlers()

      // If swarm provided, replicate the drive
      if (this.swarm) {
        this.swarm.join(this.drive.discoveryKey, { lookup: true, announce: true })
        this.swarm.on('connection', (conn) => this._handlePeerConnection(conn))
      }

      // Update metrics
      await this._updateMetrics()

      this.ready = true
      this.emitter.emit(ASSET_EVENTS.READY)
      
      console.log(`HyperdriveAssetStorage initialized:`)
      console.log(`  Storage Dir: ${storageDir}`)
      console.log(`  Drive Key: ${this.drive.key.toString('hex')}`)
      console.log(`  Discovery Key: ${this.drive.discoveryKey.toString('hex')}`)
      console.log(`  Version: ${this.drive.version}`)
      console.log(`  Writable: ${this.drive.writable}`)
      console.log(`  Total Assets: ${this.metrics.totalAssets}`)
      
    } catch (error) {
      console.error('Failed to initialize HyperdriveAssetStorage:', error)
      this.emitter.emit(ASSET_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Set up event handlers for replication and sync
   */
  _setupEventHandlers() {
    // Drive events
    this.drive.on('sync', () => {
      this.metrics.syncEvents++
      this.metrics.lastSync = new Date().toISOString()
      console.log('HyperdriveAssetStorage: Drive synced')
      this.emitter.emit(ASSET_EVENTS.SYNC_COMPLETE)
    })

    this.drive.on('peer-add', (peer) => {
      this.peers.add(peer)
      this.metrics.peerCount = this.peers.size
      console.log(`HyperdriveAssetStorage: Peer connected (${this.peers.size} total)`)
      this.emitter.emit(ASSET_EVENTS.PEER_JOIN, peer)
    })

    this.drive.on('peer-remove', (peer) => {
      this.peers.delete(peer)
      this.metrics.peerCount = this.peers.size
      console.log(`HyperdriveAssetStorage: Peer disconnected (${this.peers.size} total)`)
      this.emitter.emit(ASSET_EVENTS.PEER_LEAVE, peer)
    })

    this.drive.on('error', (error) => {
      console.error('HyperdriveAssetStorage drive error:', error)
      this.emitter.emit(ASSET_EVENTS.ERROR, error)
    })
  }

  /**
   * Handle peer connection for replication
   */
  _handlePeerConnection(conn) {
    console.log('HyperdriveAssetStorage: New peer connection')
    
    // Replicate the hyperdrive with the peer
    const stream = this.drive.replicate(conn.isInitiator)
    conn.pipe(stream).pipe(conn)
    
    conn.on('error', (error) => {
      console.error('HyperdriveAssetStorage peer connection error:', error)
    })
    
    conn.on('close', () => {
      console.log('HyperdriveAssetStorage: Peer connection closed')
    })
  }

  /**
   * Store an asset from a buffer
   */
  async storeAsset(buffer, filename, options = {}) {
    if (!this.ready) {
      throw new Error('Asset storage not ready')
    }

    if (!this.drive.writable) {
      throw new Error('Drive is not writable')
    }

    try {
      // Generate hash-based filename
      const hash = await hashFile(buffer)
      const ext = path.extname(filename).toLowerCase()
      const hashedFilename = `${hash}${ext}`
      const drivePath = `/assets/${hashedFilename}`
      
      // Check if asset already exists
      const exists = await this.hasAsset(hash)
      if (!exists) {
        // Write to hyperdrive
        await this.drive.put(drivePath, buffer)
        
        // Store metadata
        const metadata = {
          hash,
          originalName: filename,
          filename: hashedFilename,
          size: buffer.length,
          type: this._getAssetType(ext),
          extension: ext,
          uploadedAt: new Date().toISOString()
        }
        
        await this.drive.put(`/metadata/${hash}.json`, JSON.stringify(metadata, null, 2))
        
        this.metrics.totalAssets++
        this.metrics.totalSize += buffer.length
        
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
        url: `hyperdrive://${this.drive.key.toString('hex')}${drivePath}`,
        size: buffer.length,
        type: this._getAssetType(ext),
        extension: ext,
        exists: true
      }
      
      return assetInfo
      
    } catch (error) {
      console.error(`HyperdriveAssetStorage store error for "${filename}":`, error)
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
      const metadata = await this.getAssetInfo(hash)
      return metadata !== null
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
      const metadataPath = `/metadata/${hash}.json`
      const metadataBuffer = await this.drive.get(metadataPath)
      
      if (!metadataBuffer) {
        return null
      }
      
      const metadata = JSON.parse(metadataBuffer.toString())
      metadata.url = `hyperdrive://${this.drive.key.toString('hex')}/assets/${metadata.filename}`
      
      return metadata
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
      const assetInfo = await this.getAssetInfo(hash)
      if (!assetInfo) {
        return null
      }
      
      const assetPath = `/assets/${assetInfo.filename}`
      return await this.drive.get(assetPath)
    } catch (error) {
      console.error(`HyperdriveAssetStorage get buffer error for hash "${hash}":`, error)
      return null
    }
  }

  /**
   * Get asset URL for client access
   */
  async getAssetUrl(hash, options = {}) {
    const assetInfo = await this.getAssetInfo(hash)
    if (!assetInfo) {
      return null
    }
    
    // Return hyperdrive:// URL for P2P access
    return assetInfo.url
  }

  /**
   * List all assets with optional filtering
   */
  async listAssets(options = {}) {
    if (!this.ready) {
      return []
    }

    try {
      const assets = []
      
      // List all metadata files
      let metadataFiles
      try {
        metadataFiles = await this.drive.readdir('/metadata')
      } catch (error) {
        // Metadata directory doesn't exist yet
        return []
      }
      
      if (!metadataFiles || !Array.isArray(metadataFiles)) {
        return []
      }
      
      for (const filename of metadataFiles) {
        if (!filename.endsWith('.json')) {
          continue
        }
        
        try {
          const hash = filename.replace('.json', '')
          const assetInfo = await this.getAssetInfo(hash)
          
          if (!assetInfo) {
            continue
          }
          
          // Apply filters
          if (options.extension && assetInfo.extension !== options.extension) {
            continue
          }
          
          if (options.minSize && assetInfo.size < options.minSize) {
            continue
          }
          
          if (options.maxSize && assetInfo.size > options.maxSize) {
            continue
          }
          
          assets.push(assetInfo)
        } catch (error) {
          console.error(`Error processing asset metadata ${filename}:`, error)
        }
      }
      
      return assets
    } catch (error) {
      console.error('HyperdriveAssetStorage list error:', error)
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

    if (!this.drive.writable) {
      throw new Error('Drive is not writable')
    }

    try {
      const assetInfo = await this.getAssetInfo(hash)
      if (!assetInfo) {
        return false
      }
      
      // Remove asset file and metadata
      const assetPath = `/assets/${assetInfo.filename}`
      const metadataPath = `/metadata/${hash}.json`
      
      await this.drive.del(assetPath)
      await this.drive.del(metadataPath)
      
      this.metrics.totalAssets--
      this.metrics.totalSize -= assetInfo.size
      
      this.emitter.emit(ASSET_EVENTS.ASSET_REMOVED, {
        hash,
        filename: assetInfo.filename,
        size: assetInfo.size
      })
      
      return true
    } catch (error) {
      console.error(`HyperdriveAssetStorage remove error for hash "${hash}":`, error)
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
          if (maxAge && asset.uploadedAt) {
            const ageMs = Date.now() - new Date(asset.uploadedAt).getTime()
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
   * Start replication
   */
  async startReplication(options = {}) {
    if (!this.swarm) {
      console.warn('HyperdriveAssetStorage: No swarm available for replication')
      return
    }
    
    this.emitter.emit(ASSET_EVENTS.REPLICATION_START)
    console.log('HyperdriveAssetStorage: Replication started')
  }

  /**
   * Stop replication
   */
  async stopReplication() {
    if (this.swarm) {
      this.swarm.leave(this.drive.discoveryKey)
    }
    
    this.emitter.emit(ASSET_EVENTS.REPLICATION_STOP)
    console.log('HyperdriveAssetStorage: Replication stopped')
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    await this._updateMetrics()
    
    const driveStats = this.drive ? {
      version: this.drive.version,
      writable: this.drive.writable,
      readable: this.drive.readable
    } : {}

    return {
      type: 'hyperdrive',
      ready: this.ready,
      storageDir: this.storageDir,
      driveKey: this.drive?.key?.toString('hex'),
      discoveryKey: this.drive?.discoveryKey?.toString('hex'),
      peerCount: this.peers.size,
      totalAssets: this.metrics.totalAssets,
      totalSizeBytes: this.metrics.totalSize,
      syncEvents: this.metrics.syncEvents,
      lastSync: this.metrics.lastSync,
      ...driveStats
    }
  }

  /**
   * Close storage and cleanup
   */
  async close() {
    if (!this.ready) {
      return
    }

    try {
      // Stop replication
      await this.stopReplication()

      // Close hyperdrive
      if (this.drive) {
        await this.drive.close()
        this.drive = null
      }
      
      // Close corestore
      if (this.corestore) {
        await this.corestore.close()
        this.corestore = null
      }

      this.ready = false
      this.peers.clear()
      this.emitter.removeAllListeners()
      
      console.log('HyperdriveAssetStorage closed')
    } catch (error) {
      console.error('Error closing HyperdriveAssetStorage:', error)
      throw error
    }
  }

  /**
   * Update metrics by scanning the drive
   */
  async _updateMetrics() {
    try {
      if (!this.ready || !this.drive) {
        return
      }
      
      const assets = await this.listAssets()
      this.metrics.totalAssets = assets.length
      this.metrics.totalSize = assets.reduce((sum, asset) => sum + asset.size, 0)
      this.metrics.peerCount = this.peers.size
    } catch (error) {
      console.error('Error updating metrics:', error)
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
   * Get the hyperdrive key for sharing/joining
   */
  getKey() {
    return this.drive?.key
  }

  /**
   * Get the discovery key for networking
   */
  getDiscoveryKey() {
    return this.drive?.discoveryKey
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