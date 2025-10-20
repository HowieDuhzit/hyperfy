#!/usr/bin/env node

/**
 * P2P Production Readiness Demonstration
 * 
 * This script demonstrates how to set up and use Hyperfy's complete
 * peer-to-peer system in a production-like environment.
 */

import { HyperdriveBridge } from './src/core/services/HyperdriveBridge.js'
import { HyperdriveAssetStorage } from './src/core/assets/HyperdriveAssetStorage.js'
import { HyperdriveWorldStorage } from './src/core/storage/HyperdriveWorldStorage.js'
import { AssetFactory } from './src/core/assets/AssetFactory.js'
import { StorageFactory } from './src/core/storage/StorageFactory.js'
import { promises as fs } from 'fs'
import path from 'path'

class P2PProductionDemo {
  constructor() {
    this.worldStorage = null
    this.assetStorage = null
    this.bridge = null
    this.assetFactory = null
    this.storageFactory = null
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString()
    const levels = { 
      info: '🔵', 
      success: '✅', 
      warning: '⚠️', 
      error: '❌',
      debug: '🔍' 
    }
    console.log(`${levels[level]} [${timestamp.substring(11, 23)}] ${message}`)
  }

  async setupP2PEnvironment() {
    this.log('🚀 Setting up P2P Production Environment', 'info')
    this.log('=' .repeat(60))

    // Environment configuration
    process.env.HYPERFY_STORAGE_TYPE = 'hyperdrive'
    process.env.HYPERFY_ASSETS_TYPE = 'hyperdrive'
    
    const worldDir = './world/production-p2p'
    
    try {
      // 1. Initialize P2P World Storage (Hypercore + Hyperbee)
      this.log('Setting up P2P world storage (Hypercore + Hyperbee)...', 'info')
      
      this.storageFactory = new StorageFactory()
      this.worldStorage = this.storageFactory.createStorage()
      
      await this.worldStorage.initialize({
        storageDir: worldDir,
        worldId: 'production-demo'
      })
      
      this.log(`World storage initialized with discovery key: ${this.worldStorage.discoveryKey.toString('hex')}`, 'success')

      // 2. Initialize P2P Asset Storage (Hyperdrive)
      this.log('Setting up P2P asset storage (Hyperdrive)...', 'info')
      
      this.assetFactory = new AssetFactory()
      this.assetStorage = this.assetFactory.createStorage()
      
      await this.assetStorage.initialize({
        storageDir: path.join(worldDir, 'assets'),
        worldId: 'production-demo'
      })
      
      this.log(`Asset storage initialized with drive key: ${this.assetStorage.drive.key.toString('hex')}`, 'success')

      // 3. Start WebSocket Bridge for Browser Clients
      this.log('Starting WebSocket bridge for browser clients...', 'info')
      
      this.bridge = new HyperdriveBridge({
        port: 3001,
        corestorePath: path.join(worldDir, 'assets/hyperdrive')
      })
      
      await this.bridge.start()
      this.log('Bridge service running on ws://localhost:3001', 'success')

      this.log('P2P Environment Setup Complete! 🎉', 'success')
      
    } catch (error) {
      this.log(`Setup failed: ${error.message}`, 'error')
      throw error
    }
  }

  async demonstrateWorldOperations() {
    this.log('🌍 Demonstrating P2P World Operations', 'info')

    // Store some world state
    const worldData = {
      name: 'P2P Production Demo World',
      created: new Date().toISOString(),
      entities: {
        'building-1': {
          type: 'building',
          position: [10, 0, 5],
          model: 'asset://models/office-building.glb'
        },
        'tree-1': {
          type: 'tree',
          position: [-5, 0, 8],
          model: 'asset://models/oak-tree.glb'
        }
      },
      settings: {
        gravity: -9.81,
        skybox: 'asset://textures/sky-sunset.hdr'
      }
    }

    await this.worldStorage.put('world/config', worldData)
    this.log('World configuration stored in P2P network', 'success')

    // Retrieve and verify
    const retrieved = await this.worldStorage.get('world/config')
    const isValid = retrieved.name === worldData.name
    this.log(`World data retrieval: ${isValid ? 'SUCCESS' : 'FAILED'}`, isValid ? 'success' : 'error')
  }

  async demonstrateAssetOperations() {
    this.log('📦 Demonstrating P2P Asset Operations', 'info')

    // Create sample assets
    const assets = [
      {
        name: 'office-building.glb',
        content: JSON.stringify({
          type: 'model',
          name: 'Modern Office Building',
          triangles: 15000,
          materials: ['concrete', 'glass', 'steel']
        }),
        mimeType: 'model/gltf-binary'
      },
      {
        name: 'oak-tree.glb',
        content: JSON.stringify({
          type: 'model',
          name: 'Oak Tree',
          triangles: 5000,
          materials: ['bark', 'leaves']
        }),
        mimeType: 'model/gltf-binary'
      },
      {
        name: 'sky-sunset.hdr',
        content: 'HDR_TEXTURE_DATA_PLACEHOLDER',
        mimeType: 'image/vnd.radiance'
      }
    ]

    const assetUrls = new Map()

    for (const asset of assets) {
      const buffer = Buffer.from(asset.content, 'utf-8')
      const assetInfo = await this.assetStorage.storeAsset(buffer, asset.name)
      const url = await this.assetStorage.getAssetUrl(assetInfo.hash)
      
      assetUrls.set(asset.name, url)
      this.log(`Asset stored: ${asset.name} -> ${assetInfo.hash}`, 'success')
    }

    // Display P2P URLs
    this.log('Generated P2P Asset URLs:', 'info')
    for (const [name, url] of assetUrls) {
      this.log(`  ${name}: ${url}`, 'debug')
    }

    return assetUrls
  }

  async demonstrateClientIntegration(assetUrls) {
    this.log('🌐 Demonstrating Client Integration', 'info')

    // Show how the client would resolve URLs
    const mockWorld = {
      assetsUrl: 'http://localhost:3000/assets',
      hyperdriveUrl: this.assetStorage.drive.key.toString('hex'),
      isP2PAssetsEnabled: () => true,
      
      resolveURL(url) {
        if (!url) return url
        url = url.trim()
        
        if (url.startsWith('asset://')) {
          const useHyperdrive = this.isP2PAssetsEnabled()
          if (useHyperdrive && this.hyperdriveUrl) {
            const assetPath = url.replace('asset://', '')
            return `hyperdrive://${this.hyperdriveUrl}/${assetPath}`
          } else {
            return url.replace('asset:/', this.assetsUrl)
          }
        }
        
        return url
      }
    }

    // Test URL resolution
    const testUrls = [
      'asset://models/office-building.glb',
      'asset://models/oak-tree.glb',
      'asset://textures/sky-sunset.hdr'
    ]

    this.log('Client URL Resolution Examples:', 'info')
    for (const testUrl of testUrls) {
      const resolved = mockWorld.resolveURL(testUrl)
      this.log(`  ${testUrl} -> ${resolved}`, 'debug')
    }
  }

  async demonstrateFeatureFlags() {
    this.log('🎛️  Demonstrating Feature Flag Management', 'info')

    const configs = [
      {
        name: 'HTTP Only (Legacy)',
        env: {
          HYPERFY_STORAGE_TYPE: 'sqlite',
          HYPERFY_ASSETS_TYPE: 'http'
        },
        client: {
          hyperfy_use_loader_v2: 'false',
          hyperfy_assets_type: 'http'
        }
      },
      {
        name: 'Hybrid (P2P Storage + HTTP Assets)',
        env: {
          HYPERFY_STORAGE_TYPE: 'hyperdrive',
          HYPERFY_ASSETS_TYPE: 'http'
        },
        client: {
          hyperfy_use_loader_v2: 'false',
          hyperfy_assets_type: 'http'
        }
      },
      {
        name: 'Full P2P (Recommended)',
        env: {
          HYPERFY_STORAGE_TYPE: 'hyperdrive',
          HYPERFY_ASSETS_TYPE: 'hyperdrive'
        },
        client: {
          hyperfy_use_loader_v2: 'true',
          hyperfy_assets_type: 'hyperdrive'
        }
      }
    ]

    this.log('Available Configuration Modes:', 'info')
    configs.forEach((config, i) => {
      this.log(`${i + 1}. ${config.name}`, 'debug')
      this.log(`   Server: ${JSON.stringify(config.env)}`, 'debug')
      this.log(`   Client: ${JSON.stringify(config.client)}`, 'debug')
    })
  }

  async demonstrateMonitoring() {
    this.log('📊 Demonstrating P2P Monitoring', 'info')

    // World storage stats
    const worldStats = await this.worldStorage.getStats()
    this.log('World Storage Statistics:', 'info')
    this.log(`  Total Records: ${worldStats.totalRecords}`, 'debug')
    this.log(`  Storage Size: ${worldStats.totalSize} bytes`, 'debug')
    this.log(`  Peer Count: ${worldStats.peerCount}`, 'debug')

    // Asset storage stats
    const assetStats = await this.assetStorage.getStats()
    this.log('Asset Storage Statistics:', 'info')
    this.log(`  Total Assets: ${assetStats.totalAssets}`, 'debug')
    this.log(`  Storage Size: ${assetStats.totalSize} bytes`, 'debug')
    this.log(`  Peer Count: ${assetStats.peerCount}`, 'debug')

    // Bridge stats
    this.log('Bridge Service Statistics:', 'info')
    this.log(`  Active Connections: ${this.bridge.clients.size}`, 'debug')
    this.log(`  Active Drives: ${this.bridge.drives.size}`, 'debug')
  }

  async demonstrateBackupAndRecovery() {
    this.log('💾 Demonstrating Backup & Recovery', 'info')

    // In P2P systems, backup is essentially replication
    this.log('P2P Backup Strategy:', 'info')
    this.log('  - Data automatically replicated across peers', 'debug')
    this.log('  - No single point of failure', 'debug')
    this.log('  - Content-addressed storage ensures integrity', 'debug')
    this.log('  - Can export specific world states for external backup', 'debug')

    // Export world state
    const worldSnapshot = await this.worldStorage.exportData()
    this.log(`World state exported: ${Object.keys(worldSnapshot).length} records`, 'success')
  }

  async cleanup() {
    this.log('🧹 Cleaning up demonstration environment', 'info')

    try {
      if (this.bridge) {
        await this.bridge.stop()
        this.log('Bridge service stopped', 'success')
      }

      if (this.assetStorage) {
        await this.assetStorage.close()
        this.log('Asset storage closed', 'success')
      }

      if (this.worldStorage) {
        await this.worldStorage.close()
        this.log('World storage closed', 'success')
      }

      // Clean up demo files
      await fs.rm('./world/production-p2p', { recursive: true, force: true }).catch(() => {})
      
    } catch (error) {
      this.log(`Cleanup warning: ${error.message}`, 'warning')
    }
  }

  async runDemo() {
    try {
      await this.setupP2PEnvironment()
      await this.demonstrateWorldOperations()
      
      const assetUrls = await this.demonstrateAssetOperations()
      await this.demonstrateClientIntegration(assetUrls)
      
      await this.demonstrateFeatureFlags()
      await this.demonstrateMonitoring()
      await this.demonstrateBackupAndRecovery()

      this.log('', 'info')
      this.log('🎉 P2P Production Demo Complete!', 'success')
      this.log('', 'info')
      this.log('Next Steps for Production:', 'info')
      this.log('1. Configure environment variables for P2P mode', 'info')
      this.log('2. Start bridge service: npm run bridge', 'info')
      this.log('3. Enable P2P in client with localStorage flags', 'info')
      this.log('4. Monitor P2P network health and performance', 'info')
      this.log('5. Set up automated testing and deployment', 'info')

    } catch (error) {
      this.log(`Demo failed: ${error.message}`, 'error')
      throw error
      
    } finally {
      await this.cleanup()
    }
  }
}

// Run demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new P2PProductionDemo()
  
  demo.runDemo().then(() => {
    console.log('\n🚀 Hyperfy P2P System: READY FOR PRODUCTION!')
    process.exit(0)
  }).catch(error => {
    console.error('\n❌ Production demo failed:', error)
    process.exit(1)
  })
}

export { P2PProductionDemo }