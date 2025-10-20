import { Storage, STORAGE_EVENTS } from './Storage.js'
import fs from 'fs/promises'
import { EventEmitter } from 'events'
import path from 'path'

/**
 * File-based storage implementation
 * 
 * Wraps the existing file-based storage functionality to match the Storage interface.
 * This maintains backward compatibility with the current Hyperfy storage system.
 */
export class FileStorage extends Storage {
  constructor() {
    super()
    this.emitter = new EventEmitter()
    this.data = {}
    this.filename = null
    this.saveTimeout = null
    this.throttleDuration = 1000
    this.ready = false
  }

  /**
   * Initialize file storage
   * @param {Object} options
   * @param {string} options.filename - Path to the storage file
   * @param {number} [options.throttleDuration=1000] - Throttle duration for saves in ms
   */
  async initialize(options = {}) {
    const { filename, throttleDuration = 1000 } = options
    
    if (!filename) {
      throw new Error('FileStorage requires a filename option')
    }

    this.filename = filename
    this.throttleDuration = throttleDuration

    // Ensure directory exists
    const dir = path.dirname(filename)
    await fs.mkdir(dir, { recursive: true })

    // Load existing data
    await this._load()
    
    this.ready = true
    this.emitter.emit(STORAGE_EVENTS.READY)
  }

  /**
   * Load data from file
   */
  async _load() {
    try {
      const fileContent = await fs.readFile(this.filename, 'utf8')
      this.data = JSON.parse(fileContent)
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty data
        this.data = {}
        await this._save()
      } else {
        console.error('Error loading storage file:', error)
        throw error
      }
    }
  }

  /**
   * Save data to file (throttled)
   */
  async _save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        const jsonData = JSON.stringify(this.data, null, 2)
        await fs.writeFile(this.filename, jsonData, 'utf8')
        this.emitter.emit(STORAGE_EVENTS.SYNC)
      } catch (error) {
        console.error('Error saving storage file:', error)
        this.emitter.emit(STORAGE_EVENTS.ERROR, error)
      }
      this.saveTimeout = null
    }, this.throttleDuration)
  }

  /**
   * Get a value by key
   */
  async get(key) {
    return this.data[key]
  }

  /**
   * Set a key-value pair
   */
  async set(key, value) {
    const oldValue = this.data[key]
    this.data[key] = value
    
    // Emit change event
    this.emitter.emit(STORAGE_EVENTS.CHANGE, { key, value, oldValue })
    
    // Trigger throttled save
    await this._save()
  }

  /**
   * Delete a key
   */
  async delete(key) {
    if (!(key in this.data)) {
      return false
    }

    const oldValue = this.data[key]
    delete this.data[key]
    
    // Emit change event
    this.emitter.emit(STORAGE_EVENTS.CHANGE, { key, value: undefined, oldValue })
    
    // Trigger throttled save
    await this._save()
    return true
  }

  /**
   * Check if a key exists
   */
  async has(key) {
    return key in this.data
  }

  /**
   * Get all keys with optional prefix filter
   */
  async keys(prefix = '') {
    const allKeys = Object.keys(this.data)
    if (!prefix) {
      return allKeys
    }
    return allKeys.filter(key => key.startsWith(prefix))
  }

  /**
   * Get all key-value pairs with optional prefix filter
   */
  async entries(prefix = '') {
    if (!prefix) {
      return { ...this.data }
    }
    
    const result = {}
    for (const [key, value] of Object.entries(this.data)) {
      if (key.startsWith(prefix)) {
        result[key] = value
      }
    }
    return result
  }

  /**
   * Clear all data or data with specific prefix
   */
  async clear(prefix = '') {
    if (!prefix) {
      // Clear all data
      this.data = {}
    } else {
      // Clear data with prefix
      for (const key of Object.keys(this.data)) {
        if (key.startsWith(prefix)) {
          delete this.data[key]
        }
      }
    }
    
    // Emit change event
    this.emitter.emit(STORAGE_EVENTS.CHANGE, { key: prefix || '*', value: undefined })
    
    // Trigger immediate save for clear operations
    await this.flush()
  }

  /**
   * Force immediate save
   */
  async flush() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    
    try {
      const jsonData = JSON.stringify(this.data, null, 2)
      await fs.writeFile(this.filename, jsonData, 'utf8')
      this.emitter.emit(STORAGE_EVENTS.SYNC)
    } catch (error) {
      console.error('Error flushing storage file:', error)
      this.emitter.emit(STORAGE_EVENTS.ERROR, error)
      throw error
    }
  }

  /**
   * Close storage and cleanup
   */
  async close() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    
    // Force final save
    await this.flush()
    
    this.ready = false
    this.emitter.removeAllListeners()
  }

  /**
   * Get storage statistics
   */
  async stats() {
    const keys = Object.keys(this.data)
    const dataSize = JSON.stringify(this.data).length
    
    let fileSize = 0
    try {
      const stat = await fs.stat(this.filename)
      fileSize = stat.size
    } catch (error) {
      // File might not exist yet
    }

    return {
      type: 'file',
      ready: this.ready,
      filename: this.filename,
      keyCount: keys.length,
      dataSizeBytes: dataSize,
      fileSizeBytes: fileSize,
      throttleDuration: this.throttleDuration,
      pendingSave: this.saveTimeout !== null
    }
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