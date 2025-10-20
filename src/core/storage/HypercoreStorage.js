import { Storage, STORAGE_EVENTS } from './Storage.js'
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'
import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs/promises'

/**
 * P2P Storage implementation using Hypercore and Hyperbee
 * 
 * Uses:
 * - Hypercore for append-only logs (versioning, replication)
 * - Hyperbee for indexed key-value storage with range queries
 * - Multi-writer support with conflict resolution
 * - P2P replication and real-time sync
 */
export class HypercoreStorage extends Storage {
  constructor() {
    super()
    this.emitter = new EventEmitter()
    this.core = null
    this.bee = null
    this.storageDir = null
    this.ready = false
    this.writerKey = null
    this.peers = new Set()
    
    // Metrics
    this.metrics = {
      operations: 0,
      bytesStored: 0,
      peerCount: 0,
      syncEvents: 0
    }
  }

  /**
   * Initialize Hypercore storage
   * @param {Object} options
   * @param {string} options.storageDir - Directory for storage files
   * @param {string} [options.worldId] - World identifier for deterministic keys
   * @param {Buffer} [options.key] - Existing hypercore key to use
   * @param {Object} [options.swarm] - Hyperswarm instance for networking
   */
  async initialize(options = {}) {
    const { storageDir, worldId, key, swarm } = options
    
    if (!storageDir) {
      throw new Error('HypercoreStorage requires a storageDir option')
    }

    this.storageDir = storageDir
    this.swarm = swarm

    // Ensure storage directory exists
    await fs.mkdir(storageDir, { recursive: true })

    // Create hypercore path
    const corePath = path.join(storageDir, 'hypercore')
    
    try {
      // Initialize hypercore
      this.core = new Hypercore(corePath, key, {
        valueEncoding: 'json',
        createIfMissing: true
      })

      await this.core.ready()
      this.writerKey = this.core.key

      // Initialize hyperbee on top of hypercore
      this.bee = new Hyperbee(this.core, {
        keyEncoding: 'utf8',
        valueEncoding: 'json'
      })

      await this.bee.ready()

      // Set up event handlers
      this._setupEventHandlers()

      // If swarm provided, replicate the core
      if (this.swarm) {
        this.swarm.join(this.core.discoveryKey, { lookup: true, announce: true })
        this.swarm.on('connection', (conn) => this._handlePeerConnection(conn))
      }

      this.ready = true
      this.emitter.emit(STORAGE_EVENTS.READY)
      
      console.log(`HypercoreStorage initialized:`)
      console.log(`  Storage Dir: ${storageDir}`)
      console.log(`  Core Key: ${this.core.key.toString('hex')}`)
      console.log(`  Discovery Key: ${this.core.discoveryKey.toString('hex')}`)
      console.log(`  Length: ${this.core.length}`)
      console.log(`  Writable: ${this.core.writable}`)
      
    } catch (error) {
      console.error('Failed to initialize HypercoreStorage:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Set up event handlers for replication and sync
   */
  _setupEventHandlers() {
    // Core events
    this.core.on('append', () => {
      this.metrics.syncEvents++
      this.emitter.emit(STORAGE_EVENTS.SYNC)
    })

    this.core.on('sync', () => {
      console.log('HypercoreStorage: Core synced')
      this.emitter.emit(STORAGE_EVENTS.SYNC)
    })

    this.core.on('peer-add', (peer) => {
      this.peers.add(peer)
      this.metrics.peerCount = this.peers.size
      console.log(`HypercoreStorage: Peer connected (${this.peers.size} total)`)
      this.emitter.emit(STORAGE_EVENTS.PEER_JOIN, peer)
    })

    this.core.on('peer-remove', (peer) => {
      this.peers.delete(peer)
      this.metrics.peerCount = this.peers.size
      console.log(`HypercoreStorage: Peer disconnected (${this.peers.size} total)`)
      this.emitter.emit(STORAGE_EVENTS.PEER_LEAVE, peer)
    })

    this.core.on('error', (error) => {
      console.error('HypercoreStorage core error:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
    })

    // Bee events
    this.bee.on('error', (error) => {
      console.error('HypercoreStorage bee error:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
    })
  }

  /**
   * Handle peer connection for replication
   */
  _handlePeerConnection(conn) {
    console.log('HypercoreStorage: New peer connection')
    
    // Replicate the hypercore with the peer
    const stream = this.core.replicate(conn.isInitiator)
    conn.pipe(stream).pipe(conn)
    
    conn.on('error', (error) => {
      console.error('HypercoreStorage peer connection error:', error)
    })
    
    conn.on('close', () => {
      console.log('HypercoreStorage: Peer connection closed')
    })
  }

  /**
   * Get a value by key
   */
  async get(key) {
    if (!this.ready) {
      throw new Error('Storage not ready')
    }

    try {
      const node = await this.bee.get(key)
      return node?.value
    } catch (error) {
      console.error(`HypercoreStorage get error for key "${key}":`, error)
      return undefined
    }
  }

  /**
   * Set a key-value pair
   */
  async set(key, value) {
    if (!this.ready) {
      throw new Error('Storage not ready')
    }

    if (!this.core.writable) {
      throw new Error('Core is not writable')
    }

    try {
      const oldValue = await this.get(key)
      await this.bee.put(key, value)
      
      this.metrics.operations++
      this.metrics.bytesStored += JSON.stringify(value).length
      
      // Emit change event
      this.emitter.emit(STORAGE_EVENTS.CHANGE, { key, value, oldValue })
      
    } catch (error) {
      console.error(`HypercoreStorage set error for key "${key}":`, error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Delete a key
   */
  async delete(key) {
    if (!this.ready) {
      throw new Error('Storage not ready')
    }

    if (!this.core.writable) {
      throw new Error('Core is not writable')
    }

    try {
      const oldValue = await this.get(key)
      if (oldValue === undefined) {
        return false
      }

      await this.bee.del(key)
      
      this.metrics.operations++
      
      // Emit change event
      this.emitter.emit(STORAGE_EVENTS.CHANGE, { key, value: undefined, oldValue })
      
      return true
    } catch (error) {
      console.error(`HypercoreStorage delete error for key "${key}":`, error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Check if a key exists
   */
  async has(key) {
    const value = await this.get(key)
    return value !== undefined
  }

  /**
   * Get all keys with optional prefix filter
   */
  async keys(prefix = '') {
    if (!this.ready) {
      throw new Error('Storage not ready')
    }

    const keys = []
    try {
      const stream = this.bee.createReadStream({
        gte: prefix,
        lt: prefix ? this._incrementString(prefix) : undefined
      })

      for await (const { key } of stream) {
        keys.push(key)
      }
    } catch (error) {
      console.error('HypercoreStorage keys error:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
    }

    return keys
  }

  /**
   * Get all key-value pairs with optional prefix filter
   */
  async entries(prefix = '') {
    if (!this.ready) {
      throw new Error('Storage not ready')
    }

    const entries = {}
    try {
      const stream = this.bee.createReadStream({
        gte: prefix,
        lt: prefix ? this._incrementString(prefix) : undefined
      })

      for await (const { key, value } of stream) {
        entries[key] = value
      }
    } catch (error) {
      console.error('HypercoreStorage entries error:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
    }

    return entries
  }

  /**
   * Clear all data or data with specific prefix
   */
  async clear(prefix = '') {
    if (!this.ready) {
      throw new Error('Storage not ready')
    }

    if (!this.core.writable) {
      throw new Error('Core is not writable')
    }

    try {
      const keysToDelete = await this.keys(prefix)
      
      for (const key of keysToDelete) {
        await this.bee.del(key)
      }
      
      this.metrics.operations += keysToDelete.length
      
      // Emit change event
      this.emitter.emit(STORAGE_EVENTS.CHANGE, { 
        key: prefix || '*', 
        value: undefined,
        deletedCount: keysToDelete.length
      })
      
    } catch (error) {
      console.error('HypercoreStorage clear error:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Force a flush operation (Hypercore auto-syncs, so this is a no-op)
   */
  async flush() {
    // Hypercore automatically syncs, but we can force a flush if needed
    return Promise.resolve()
  }

  /**
   * Close storage and cleanup
   */
  async close() {
    if (!this.ready) {
      return
    }

    try {
      // Close hyperbee
      if (this.bee) {
        await this.bee.close()
        this.bee = null
      }

      // Close hypercore
      if (this.core) {
        await this.core.close()
        this.core = null
      }

      this.ready = false
      this.peers.clear()
      this.emitter.removeAllListeners()
      
      console.log('HypercoreStorage closed')
    } catch (error) {
      console.error('Error closing HypercoreStorage:', error)
      throw error
    }
  }

  /**
   * Get storage statistics
   */
  async stats() {
    const coreStats = this.core ? {
      length: this.core.length,
      byteLength: this.core.byteLength,
      writable: this.core.writable,
      readable: this.core.readable
    } : {}

    return {
      type: 'hypercore',
      ready: this.ready,
      storageDir: this.storageDir,
      writerKey: this.writerKey?.toString('hex'),
      discoveryKey: this.core?.discoveryKey?.toString('hex'),
      peerCount: this.peers.size,
      ...coreStats,
      ...this.metrics
    }
  }

  /**
   * Utility method to increment a string for range queries
   */
  _incrementString(str) {
    if (str.length === 0) return String.fromCharCode(1)
    
    const lastChar = str.slice(-1)
    const prefix = str.slice(0, -1)
    const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1)
    
    return prefix + nextChar
  }

  /**
   * Get the hypercore key for sharing/joining
   */
  getKey() {
    return this.core?.key
  }

  /**
   * Get the discovery key for networking
   */
  getDiscoveryKey() {
    return this.core?.discoveryKey
  }

  /**
   * Event subscription for storage events
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