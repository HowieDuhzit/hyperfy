/**
 * Asset Storage Interface
 * 
 * Defines a common interface for asset storage and delivery that can be implemented
 * by both HTTP-based file storage and P2P Hyperdrive systems.
 */

export class AssetStorage {
  /**
   * Initialize the asset storage system
   * @param {Object} options - Asset storage configuration
   */
  async initialize(options = {}) {
    throw new Error('initialize() must be implemented by subclass')
  }

  /**
   * Store an asset from a buffer
   * @param {Buffer} buffer - Asset data
   * @param {string} filename - Original filename
   * @param {Object} options - Additional options (metadata, etc.)
   * @returns {Promise<Object>} Asset info with hash, url, size, etc.
   */
  async storeAsset(buffer, filename, options = {}) {
    throw new Error('storeAsset() must be implemented by subclass')
  }

  /**
   * Check if an asset exists
   * @param {string} hash - Asset hash or identifier
   * @returns {Promise<boolean>} True if asset exists
   */
  async hasAsset(hash) {
    throw new Error('hasAsset() must be implemented by subclass')
  }

  /**
   * Get asset metadata
   * @param {string} hash - Asset hash or identifier
   * @returns {Promise<Object|null>} Asset metadata or null if not found
   */
  async getAssetInfo(hash) {
    throw new Error('getAssetInfo() must be implemented by subclass')
  }

  /**
   * Get asset data as buffer
   * @param {string} hash - Asset hash or identifier
   * @returns {Promise<Buffer|null>} Asset buffer or null if not found
   */
  async getAssetBuffer(hash) {
    throw new Error('getAssetBuffer() must be implemented by subclass')
  }

  /**
   * Get asset URL for client access
   * @param {string} hash - Asset hash or identifier
   * @param {Object} options - Additional options (download, inline, etc.)
   * @returns {Promise<string|null>} Asset URL or null if not found
   */
  async getAssetUrl(hash, options = {}) {
    throw new Error('getAssetUrl() must be implemented by subclass')
  }

  /**
   * List all assets with optional filtering
   * @param {Object} options - Filter options (extension, size, date, etc.)
   * @returns {Promise<Array>} Array of asset metadata objects
   */
  async listAssets(options = {}) {
    throw new Error('listAssets() must be implemented by subclass')
  }

  /**
   * Remove an asset
   * @param {string} hash - Asset hash or identifier
   * @returns {Promise<boolean>} True if asset was removed
   */
  async removeAsset(hash) {
    throw new Error('removeAsset() must be implemented by subclass')
  }

  /**
   * Cleanup unused assets
   * @param {Object} options - Cleanup options (maxAge, dryRun, etc.)
   * @returns {Promise<Object>} Cleanup results with counts and freed space
   */
  async cleanupAssets(options = {}) {
    throw new Error('cleanupAssets() must be implemented by subclass')
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats (total size, count, peer count, etc.)
   */
  async getStats() {
    throw new Error('getStats() must be implemented by subclass')
  }

  /**
   * Start replication/networking (for P2P implementations)
   * @param {Object} options - Networking options
   * @returns {Promise<void>}
   */
  async startReplication(options = {}) {
    // No-op for HTTP implementations
    return Promise.resolve()
  }

  /**
   * Stop replication/networking (for P2P implementations)
   * @returns {Promise<void>}
   */
  async stopReplication() {
    // No-op for HTTP implementations
    return Promise.resolve()
  }

  /**
   * Close the asset storage and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by subclass')
  }
}

// Asset storage event types for implementations that support event emission
export const ASSET_EVENTS = {
  READY: 'assets:ready',
  ERROR: 'assets:error',
  ASSET_ADDED: 'assets:asset:added',
  ASSET_REMOVED: 'assets:asset:removed',
  REPLICATION_START: 'assets:replication:start',
  REPLICATION_STOP: 'assets:replication:stop',
  PEER_JOIN: 'assets:peer:join',
  PEER_LEAVE: 'assets:peer:leave',
  SYNC_PROGRESS: 'assets:sync:progress',
  SYNC_COMPLETE: 'assets:sync:complete'
}