import { FileStorage } from './FileStorage.js'
import { HypercoreStorage } from './HypercoreStorage.js'

/**
 * Storage Factory
 * 
 * Creates storage instances based on configuration and feature flags.
 * Supports gradual migration from file-based to P2P storage.
 */
export class StorageFactory {
  /**
   * Create a storage instance
   * @param {Object} options
   * @param {string} [options.type] - Storage type: 'file' or 'hypercore'
   * @param {string} [options.worldDir] - World directory path
   * @param {string} [options.worldId] - World identifier
   * @param {Object} [options.swarm] - Hyperswarm instance for P2P storage
   * @param {Object} [options.env] - Environment variables
   * @returns {Storage} Storage instance
   */
  static async create(options = {}) {
    const {
      type: explicitType,
      worldDir,
      worldId,
      swarm,
      env = process.env
    } = options

    // Determine storage type from various sources
    const storageType = StorageFactory.getStorageType(explicitType, env)
    
    console.log(`Creating ${storageType} storage for world "${worldId}"`)

    switch (storageType) {
      case 'hypercore': {
        const storage = new HypercoreStorage()
        await storage.initialize({
          storageDir: `${worldDir}/hypercore`,
          worldId,
          swarm
        })
        return storage
      }

      case 'file':
      default: {
        const storage = new FileStorage()
        await storage.initialize({
          filename: `${worldDir}/storage.json`,
          throttleDuration: parseInt(env.STORAGE_THROTTLE_MS) || 1000
        })
        return storage
      }
    }
  }

  /**
   * Determine storage type from configuration and feature flags
   */
  static getStorageType(explicitType, env) {
    // 1. Explicit type parameter has highest priority
    if (explicitType) {
      return explicitType
    }

    // 2. Environment variable
    if (env.HYPERFY_STORAGE_TYPE) {
      return env.HYPERFY_STORAGE_TYPE
    }

    // 3. Check for browser localStorage (client-side feature flag)
    if (typeof window !== 'undefined' && window.localStorage) {
      const clientType = localStorage.getItem('hyperfy_storage_type')
      if (clientType) {
        return clientType
      }
    }

    // 4. Default to file storage
    return 'file'
  }

  /**
   * Get available storage types
   */
  static getAvailableTypes() {
    return ['file', 'hypercore']
  }

  /**
   * Check if a storage type is available
   */
  static isTypeAvailable(type) {
    return StorageFactory.getAvailableTypes().includes(type)
  }

  /**
   * Create migration utilities for data transfer between storage types
   */
  static async createMigration(fromStorage, toStorage) {
    return new StorageMigration(fromStorage, toStorage)
  }
}

/**
 * Storage Migration Helper
 * 
 * Handles data migration between different storage types
 */
class StorageMigration {
  constructor(fromStorage, toStorage) {
    this.fromStorage = fromStorage
    this.toStorage = toStorage
    this.migrationLog = []
  }

  /**
   * Migrate all data from source to destination storage
   */
  async migrate(options = {}) {
    const { 
      prefix = '',
      batchSize = 100,
      dryRun = false,
      onProgress
    } = options

    console.log(`Starting storage migration${dryRun ? ' (dry run)' : ''}`)
    console.log(`From: ${this.fromStorage.constructor.name}`)
    console.log(`To: ${this.toStorage.constructor.name}`)
    
    const startTime = Date.now()
    let migratedCount = 0
    let errorCount = 0

    try {
      // Get all data from source
      const sourceData = await this.fromStorage.entries(prefix)
      const totalKeys = Object.keys(sourceData).length

      console.log(`Found ${totalKeys} keys to migrate`)

      // Migrate in batches
      const keys = Object.keys(sourceData)
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize)
        
        for (const key of batch) {
          try {
            if (!dryRun) {
              await this.toStorage.set(key, sourceData[key])
            }
            
            migratedCount++
            this.migrationLog.push({
              type: 'success',
              key,
              timestamp: Date.now()
            })
            
          } catch (error) {
            errorCount++
            this.migrationLog.push({
              type: 'error',
              key,
              error: error.message,
              timestamp: Date.now()
            })
            console.error(`Migration error for key "${key}":`, error)
          }
        }

        // Report progress
        const progress = {
          total: totalKeys,
          migrated: migratedCount,
          errors: errorCount,
          percentage: Math.round((migratedCount / totalKeys) * 100)
        }

        if (onProgress) {
          onProgress(progress)
        }

        console.log(`Migration progress: ${progress.percentage}% (${migratedCount}/${totalKeys})`)
      }

      const duration = Date.now() - startTime
      const summary = {
        totalKeys,
        migratedCount,
        errorCount,
        duration,
        success: errorCount === 0
      }

      console.log('Migration completed:', summary)
      return summary

    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }

  /**
   * Verify migration by comparing data between storages
   */
  async verify(prefix = '') {
    console.log('Verifying migration...')
    
    const sourceData = await this.fromStorage.entries(prefix)
    const targetData = await this.toStorage.entries(prefix)
    
    const sourceKeys = Object.keys(sourceData).sort()
    const targetKeys = Object.keys(targetData).sort()
    
    const results = {
      totalKeys: sourceKeys.length,
      missingKeys: [],
      mismatchedValues: [],
      extraKeys: targetKeys.filter(key => !sourceKeys.includes(key)),
      success: true
    }

    // Check for missing keys
    for (const key of sourceKeys) {
      if (!targetKeys.includes(key)) {
        results.missingKeys.push(key)
        results.success = false
      }
    }

    // Check for value mismatches
    for (const key of sourceKeys) {
      if (targetKeys.includes(key)) {
        const sourceValue = JSON.stringify(sourceData[key])
        const targetValue = JSON.stringify(targetData[key])
        
        if (sourceValue !== targetValue) {
          results.mismatchedValues.push({
            key,
            sourceValue: sourceData[key],
            targetValue: targetData[key]
          })
          results.success = false
        }
      }
    }

    console.log('Verification results:', {
      totalKeys: results.totalKeys,
      missingKeys: results.missingKeys.length,
      mismatchedValues: results.mismatchedValues.length,
      extraKeys: results.extraKeys.length,
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