/**
 * Storage Interface
 * 
 * Defines a common interface for world state storage that can be implemented
 * by both file-based storage and P2P storage using Hypercore/Hyperbee.
 */

export class Storage {
  /**
   * Initialize the storage system
   * @param {Object} options - Storage configuration
   */
  async initialize(options = {}) {
    throw new Error('initialize() must be implemented by subclass')
  }

  /**
   * Get a value by key
   * @param {string} key - The key to retrieve
   * @returns {Promise<any>} The value, or undefined if not found
   */
  async get(key) {
    throw new Error('get() must be implemented by subclass')
  }

  /**
   * Set a key-value pair
   * @param {string} key - The key to set
   * @param {any} value - The value to set
   * @returns {Promise<void>}
   */
  async set(key, value) {
    throw new Error('set() must be implemented by subclass')
  }

  /**
   * Delete a key
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} True if the key existed and was deleted
   */
  async delete(key) {
    throw new Error('delete() must be implemented by subclass')
  }

  /**
   * Check if a key exists
   * @param {string} key - The key to check
   * @returns {Promise<boolean>} True if the key exists
   */
  async has(key) {
    throw new Error('has() must be implemented by subclass')
  }

  /**
   * Get all keys with an optional prefix filter
   * @param {string} [prefix] - Optional prefix to filter keys
   * @returns {Promise<string[]>} Array of matching keys
   */
  async keys(prefix = '') {
    throw new Error('keys() must be implemented by subclass')
  }

  /**
   * Get all key-value pairs with an optional prefix filter
   * @param {string} [prefix] - Optional prefix to filter keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async entries(prefix = '') {
    throw new Error('entries() must be implemented by subclass')
  }

  /**
   * Clear all data or data with a specific prefix
   * @param {string} [prefix] - Optional prefix to filter what to clear
   * @returns {Promise<void>}
   */
  async clear(prefix = '') {
    throw new Error('clear() must be implemented by subclass')
  }

  /**
   * Force a save/sync operation (for storage types that batch writes)
   * @returns {Promise<void>}
   */
  async flush() {
    throw new Error('flush() must be implemented by subclass')
  }

  /**
   * Close the storage connection and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by subclass')
  }

  /**
   * Get storage statistics/metrics
   * @returns {Promise<Object>} Storage stats object
   */
  async stats() {
    throw new Error('stats() must be implemented by subclass')
  }
}

// Storage event types for implementations that support event emission
export const STORAGE_EVENTS = {
  READY: 'storage:ready',
  ERROR: 'storage:error',
  CHANGE: 'storage:change',
  SYNC: 'storage:sync',
  PEER_JOIN: 'storage:peer:join',
  PEER_LEAVE: 'storage:peer:leave'
}