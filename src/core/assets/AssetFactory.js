import { HttpAssetStorage } from './HttpAssetStorage.js'
import { HyperdriveAssetStorage } from './HyperdriveAssetStorage.js'

/**
 * Asset Factory
 * 
 * Creates asset storage instances based on configuration and feature flags.
 * Supports gradual migration from HTTP-based to P2P asset delivery.
 */
export class AssetFactory {
  /**
   * Create an asset storage instance
   * @param {Object} options
   * @param {string} [options.type] - Asset storage type: 'http' or 'hyperdrive'
   * @param {string} [options.assetsDir] - Local assets directory (for HTTP)
   * @param {string} [options.worldDir] - World directory path (for Hyperdrive)
   * @param {string} [options.worldId] - World identifier
   * @param {string} [options.baseUrl] - Base URL for HTTP assets
   * @param {Object} [options.swarm] - Hyperswarm instance for P2P assets
   * @param {Object} [options.env] - Environment variables
   * @returns {AssetStorage} Asset storage instance
   */
  static async create(options = {}) {
    const {
      type: explicitType,
      assetsDir,
      worldDir,
      worldId,
      baseUrl,
      swarm,
      env = process.env
    } = options

    // Determine asset storage type from various sources
    const assetType = AssetFactory.getAssetType(explicitType, env)
    
    console.log(`Creating ${assetType} asset storage for world "${worldId}"`)

    switch (assetType) {
      case 'hyperdrive': {
        const storage = new HyperdriveAssetStorage()
        await storage.initialize({
          storageDir: `${worldDir}/hyperdrive-assets`,
          worldId,
          swarm
        })
        return storage
      }

      case 'http':
      default: {
        if (!assetsDir || !baseUrl) {
          throw new Error('HTTP asset storage requires assetsDir and baseUrl options')
        }
        
        const storage = new HttpAssetStorage()
        await storage.initialize({
          assetsDir,
          baseUrl
        })
        return storage
      }
    }
  }

  /**
   * Determine asset storage type from configuration and feature flags
   */
  static getAssetType(explicitType, env) {
    // 1. Explicit type parameter has highest priority
    if (explicitType) {
      return explicitType
    }

    // 2. Environment variable
    if (env.HYPERFY_ASSETS_TYPE) {
      return env.HYPERFY_ASSETS_TYPE
    }

    // 3. Check for browser localStorage (client-side feature flag)
    if (typeof window !== 'undefined' && window.localStorage) {
      const clientType = localStorage.getItem('hyperfy_assets_type')
      if (clientType) {
        return clientType
      }
    }

    // 4. Default to HTTP assets
    return 'http'
  }

  /**
   * Get available asset storage types
   */
  static getAvailableTypes() {
    return ['http', 'hyperdrive']
  }

  /**
   * Check if an asset storage type is available
   */
  static isTypeAvailable(type) {
    return AssetFactory.getAvailableTypes().includes(type)
  }

  /**
   * Create migration utilities for data transfer between asset storage types
   */
  static async createMigration(fromStorage, toStorage) {
    return new AssetMigration(fromStorage, toStorage)
  }
}

/**
 * Asset Migration Helper
 * 
 * Handles asset migration between different storage types
 */
class AssetMigration {
  constructor(fromStorage, toStorage) {
    this.fromStorage = fromStorage
    this.toStorage = toStorage
    this.migrationLog = []
  }

  /**
   * Migrate all assets from source to destination storage
   */
  async migrate(options = {}) {
    const { 
      batchSize = 10,
      dryRun = false,
      onProgress
    } = options

    console.log(`Starting asset migration${dryRun ? ' (dry run)' : ''}`)
    console.log(`From: ${this.fromStorage.constructor.name}`)
    console.log(`To: ${this.toStorage.constructor.name}`)
    
    const startTime = Date.now()
    let migratedCount = 0
    let errorCount = 0

    try {
      // Get all assets from source
      const sourceAssets = await this.fromStorage.listAssets()
      const totalAssets = sourceAssets.length

      console.log(`Found ${totalAssets} assets to migrate`)

      // Migrate in batches
      for (let i = 0; i < sourceAssets.length; i += batchSize) {
        const batch = sourceAssets.slice(i, i + batchSize)
        
        for (const asset of batch) {
          try {
            // Get asset data from source
            const buffer = await this.fromStorage.getAssetBuffer(asset.hash)
            
            if (!buffer) {
              throw new Error('Asset buffer not found')
            }
            
            if (!dryRun) {
              // Store in destination
              await this.toStorage.storeAsset(buffer, asset.originalName || asset.filename)
            }
            
            migratedCount++
            this.migrationLog.push({
              type: 'success',
              hash: asset.hash,
              filename: asset.filename,
              size: asset.size,
              timestamp: Date.now()
            })
            
          } catch (error) {
            errorCount++
            this.migrationLog.push({
              type: 'error',
              hash: asset.hash,
              filename: asset.filename,
              error: error.message,
              timestamp: Date.now()
            })
            console.error(`Migration error for asset "${asset.filename}":`, error)
          }
        }

        // Report progress
        const progress = {
          total: totalAssets,
          migrated: migratedCount,
          errors: errorCount,
          percentage: Math.round((migratedCount / totalAssets) * 100)
        }

        if (onProgress) {
          onProgress(progress)
        }

        console.log(`Migration progress: ${progress.percentage}% (${migratedCount}/${totalAssets})`)
      }

      const duration = Date.now() - startTime
      const summary = {
        totalAssets,
        migratedCount,
        errorCount,
        duration,
        success: errorCount === 0
      }

      console.log('Asset migration completed:', summary)
      return summary

    } catch (error) {
      console.error('Asset migration failed:', error)
      throw error
    }
  }

  /**
   * Verify migration by comparing assets between storages
   */
  async verify(options = {}) {
    const { sampleSize = 10 } = options
    
    console.log('Verifying asset migration...')
    
    const sourceAssets = await this.fromStorage.listAssets()
    const targetAssets = await this.toStorage.listAssets()
    
    const sourceHashes = sourceAssets.map(asset => asset.hash).sort()
    const targetHashes = targetAssets.map(asset => asset.hash).sort()
    
    const results = {
      totalAssets: sourceAssets.length,
      missingAssets: [],
      mismatchedAssets: [],
      extraAssets: targetHashes.filter(hash => !sourceHashes.includes(hash)),
      success: true
    }

    // Check for missing assets
    for (const hash of sourceHashes) {
      if (!targetHashes.includes(hash)) {
        results.missingAssets.push(hash)
        results.success = false
      }
    }

    // Verify asset content for a sample
    const sampleHashes = sourceHashes.slice(0, Math.min(sampleSize, sourceHashes.length))
    
    for (const hash of sampleHashes) {
      try {
        const sourceBuffer = await this.fromStorage.getAssetBuffer(hash)
        const targetBuffer = await this.toStorage.getAssetBuffer(hash)
        
        if (!sourceBuffer || !targetBuffer) {
          results.mismatchedAssets.push({
            hash,
            reason: 'Buffer missing'
          })
          results.success = false
          continue
        }
        
        if (!sourceBuffer.equals(targetBuffer)) {
          results.mismatchedAssets.push({
            hash,
            reason: 'Content mismatch'
          })
          results.success = false
        }
      } catch (error) {
        results.mismatchedAssets.push({
          hash,
          reason: error.message
        })
        results.success = false
      }
    }

    console.log('Asset verification results:', {
      totalAssets: results.totalAssets,
      missingAssets: results.missingAssets.length,
      mismatchedAssets: results.mismatchedAssets.length,
      extraAssets: results.extraAssets.length,
      sampledAssets: sampleHashes.length,
      success: results.success
    })

    return results
  }

  /**
   * Get migration log
   */
  getLog() {
    return this.migrationLog
  }
}