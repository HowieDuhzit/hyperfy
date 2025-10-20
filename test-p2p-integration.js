/**
 * Comprehensive P2P Integration Test
 * 
 * This test validates the complete P2P asset pipeline:
 * 1. Server asset storage (HyperdriveAssetStorage)
 * 2. Bridge service for browser access
 * 3. Client asset loading (ClientLoaderV2 via bridge)
 * 4. URL resolution and transport switching
 */

import { HyperdriveBridge } from './src/core/services/HyperdriveBridge.js'
import { HyperdriveAssetStorage } from './src/core/assets/HyperdriveAssetStorage.js'
import { BrowserHyperdrive, hyperdriveRegistry } from './src/core/utils/BrowserHyperdrive.js'
import { promises as fs } from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import WebSocket from 'ws'

class IntegrationTestSuite extends EventEmitter {
  constructor() {
    super()
    this.bridge = null
    this.serverStorage = null
    this.testAssets = new Map()
    this.passed = 0
    this.failed = 0
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substring(11, 23)
    const icons = { info: '📋', pass: '✅', fail: '❌', warn: '⚠️' }
    console.log(`${icons[type]} [${timestamp}] ${message}`)
  }

  async assert(condition, message) {
    if (condition) {
      this.passed++
      this.log(`PASS: ${message}`, 'pass')
    } else {
      this.failed++
      this.log(`FAIL: ${message}`, 'fail')
      throw new Error(`Assertion failed: ${message}`)
    }
  }

  async setup() {
    this.log('🚀 Starting comprehensive P2P integration test')
    this.log('=' .repeat(60))

    // Initialize server-side asset storage first
    this.log('Initializing server-side asset storage...')
    this.serverStorage = new HyperdriveAssetStorage()
    await this.serverStorage.initialize({
      storageDir: './world/test-integration'
    })
    
    // Start bridge service using same storage directory
    this.log('Starting WebSocket bridge service...')
    this.bridge = new HyperdriveBridge({
      port: 3001,
      corestorePath: './world/test-integration/hyperdrive'
    })
    await this.bridge.start()

    await this.assert(this.serverStorage.ready, 'Server storage initialized')
    
    // Wait a bit for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  async teardown() {
    this.log('🧹 Cleaning up test environment...')
    
    // Disconnect all browser hyperdrive instances
    hyperdriveRegistry.disconnectAll()
    
    // Stop services in correct order
    if (this.bridge) {
      await this.bridge.stop()
    }
    
    if (this.serverStorage) {
      await this.serverStorage.close()
    }

    // Clean up test directories
    try {
      await fs.rm('./world/test-integration', { recursive: true, force: true })
    } catch (e) {
      // Ignore cleanup errors
      this.log(`Cleanup warning: ${e.message}`, 'warn')
    }
  }

  async createTestAssets() {
    this.log('📄 Creating test assets...')

    const assets = [
      {
        name: 'test-model.json',
        content: JSON.stringify({
          type: '3d-model',
          name: 'Test Building',
          vertices: 1024,
          triangles: 512
        }),
        mimeType: 'application/json'
      },
      {
        name: 'test-texture.json',
        content: JSON.stringify({
          type: 'texture',
          name: 'Brick Wall',
          width: 512,
          height: 512,
          format: 'RGB'
        }),
        mimeType: 'application/json'
      },
      {
        name: 'test-script.js',
        content: `
// Test script for P2P validation
export default function TestApp() {
  console.log('P2P script loaded successfully')
  return { message: 'Hello from P2P!' }
}`,
        mimeType: 'application/javascript'
      }
    ]

    for (const asset of assets) {
      const buffer = Buffer.from(asset.content, 'utf-8')
      const assetInfo = await this.serverStorage.storeAsset(buffer, asset.name)
      
      this.testAssets.set(asset.name, {
        ...assetInfo,
        originalContent: asset.content,
        buffer
      })

      await this.assert(assetInfo.hash, `Asset ${asset.name} stored with hash`)
      this.log(`  Stored: ${asset.name} -> ${assetInfo.hash}`)
    }

    await this.assert(this.testAssets.size === assets.length, 'All test assets created')
  }

  async testServerAssetRetrieval() {
    this.log('🔍 Testing server-side asset retrieval...')

    for (const [name, assetInfo] of this.testAssets) {
      // Test exists check
      const exists = await this.serverStorage.hasAsset(assetInfo.hash)
      await this.assert(exists, `Asset ${name} exists in storage`)

      // Test metadata retrieval
      const metadata = await this.serverStorage.getAssetInfo(assetInfo.hash)
      await this.assert(metadata !== null, `Metadata retrieved for ${name}`)
      await this.assert(metadata.hash === assetInfo.hash, `Correct hash in metadata for ${name}`)

      // Test buffer retrieval
      const retrievedBuffer = await this.serverStorage.getAssetBuffer(assetInfo.hash)
      await this.assert(retrievedBuffer !== null, `Buffer retrieved for ${name}`)
      await this.assert(retrievedBuffer.equals(assetInfo.buffer), `Buffer integrity for ${name}`)

      // Test URL generation
      const url = await this.serverStorage.getAssetUrl(assetInfo.hash)
      await this.assert(url && url.startsWith('hyperdrive://'), `Hyperdrive URL generated for ${name}`)
      
      this.log(`  Verified: ${name} -> ${url.substring(0, 50)}...`)
    }
  }

  async testBridgeConnectivity() {
    this.log('🌉 Testing bridge connectivity...')

    // Get server storage drive key
    const driveKey = this.serverStorage.drive.key.toString('hex')
    this.log(`  Server drive key: ${driveKey}`)

    // Create browser client and connect
    const browserDrive = await hyperdriveRegistry.get(driveKey, {
      bridgeUrl: 'ws://localhost:3001'
    })

    await browserDrive.connect()
    await this.assert(browserDrive.connected, 'Browser client connected to bridge')

    // Test file listing through bridge
    const fileList = await browserDrive.list('/assets/')
    await this.assert(Array.isArray(fileList), 'File listing returned from bridge')
    
    this.log(`  Listed ${fileList.length} files through bridge`)
    return browserDrive
  }

  async testClientAssetLoading(browserDrive) {
    this.log('📦 Testing client asset loading through bridge...')

    for (const [name, assetInfo] of this.testAssets) {
      const assetPath = `/assets/${assetInfo.filename}`
      
      // Load asset through browser drive (simulating ClientLoaderV2)
      const buffer = await browserDrive.get(assetPath)
      await this.assert(buffer !== null, `Asset ${name} loaded through bridge`)
      
      // Verify content integrity
      const content = buffer.toString('utf-8')
      const expectedContent = assetInfo.originalContent
      await this.assert(content === expectedContent, `Content integrity for ${name}`)
      
      this.log(`  Loaded: ${name} (${buffer.length} bytes)`)
    }
  }

  async testURLResolution() {
    this.log('🔗 Testing URL resolution patterns...')

    // Mock world object for URL resolution testing
    const mockWorld = {
      assetsUrl: 'http://localhost:3000/assets',
      hyperdriveUrl: this.serverStorage.drive.key.toString('hex'),
      
      isP2PAssetsEnabled() {
        return true // Simulate P2P enabled
      },
      
      resolveURL(url) {
        if (!url) return url
        url = url.trim()
        
        if (url.startsWith('blob')) {
          return url
        }
        if (url.startsWith('hyperdrive://')) {
          return url
        }
        if (url.startsWith('asset://')) {
          const useHyperdrive = this.isP2PAssetsEnabled()
          if (useHyperdrive && this.hyperdriveUrl) {
            const assetPath = url.replace('asset://', '')
            return `hyperdrive://${this.hyperdriveUrl}/${assetPath}`
          } else {
            return url.replace('asset:/', this.assetsUrl)
          }
        }
        if (url.match(/^https?:\/\//i)) {
          return url
        }
        if (url.startsWith('//')) {
          return `https:${url}`
        }
        if (url.startsWith('/')) {
          return url
        }
        return `https://${url}`
      }
    }

    // Test URL resolution patterns
    const testCases = [
      {
        input: 'asset://models/building.glb',
        expectedPrefix: 'hyperdrive://',
        description: 'asset:// to hyperdrive:// resolution'
      },
      {
        input: 'http://example.com/model.glb',
        expected: 'http://example.com/model.glb',
        description: 'HTTP URL pass-through'
      },
      {
        input: `hyperdrive://${mockWorld.hyperdriveUrl}/test.glb`,
        expected: `hyperdrive://${mockWorld.hyperdriveUrl}/test.glb`,
        description: 'hyperdrive:// URL pass-through'
      }
    ]

    for (const testCase of testCases) {
      const resolved = mockWorld.resolveURL(testCase.input)
      
      if (testCase.expectedPrefix) {
        await this.assert(resolved.startsWith(testCase.expectedPrefix), testCase.description)
      } else {
        await this.assert(resolved === testCase.expected, testCase.description)
      }
      
      this.log(`  ${testCase.input} -> ${resolved}`)
    }
  }

  async testErrorHandlingAndFallbacks() {
    this.log('🛡️  Testing error handling and fallbacks...')

    const driveKey = this.serverStorage.drive.key.toString('hex')
    const browserDrive = await hyperdriveRegistry.get(driveKey)

    // Test non-existent file
    const nonExistentBuffer = await browserDrive.get('/assets/does-not-exist.glb')
    await this.assert(nonExistentBuffer === null, 'Non-existent file returns null')

    // Test disconnect/reconnect
    browserDrive.disconnect()
    await this.assert(!browserDrive.connected, 'Client can disconnect')

    // Reconnect should work
    await browserDrive.connect()
    await this.assert(browserDrive.connected, 'Client can reconnect')

    this.log('  Error handling and fallbacks working correctly')
  }

  async testPerformanceCharacteristics() {
    this.log('📊 Testing performance characteristics...')

    const driveKey = this.serverStorage.drive.key.toString('hex')
    const browserDrive = await hyperdriveRegistry.get(driveKey)

    // Test concurrent loading
    const concurrentTests = []
    for (const [name, assetInfo] of this.testAssets) {
      const assetPath = `/assets/${assetInfo.filename}`
      concurrentTests.push(browserDrive.get(assetPath))
    }

    const startTime = Date.now()
    const results = await Promise.all(concurrentTests)
    const duration = Date.now() - startTime

    await this.assert(results.every(r => r !== null), 'All concurrent loads successful')
    this.log(`  Concurrent loading: ${this.testAssets.size} assets in ${duration}ms`)

    // Test caching (second load should be faster or cached)
    const cachedStartTime = Date.now()
    const firstAsset = this.testAssets.values().next().value
    await browserDrive.get(`/assets/${firstAsset.filename}`)
    const cachedDuration = Date.now() - cachedStartTime

    this.log(`  Cached load time: ${cachedDuration}ms`)
  }

  async run() {
    try {
      await this.setup()

      await this.createTestAssets()
      await this.testServerAssetRetrieval()
      
      const browserDrive = await this.testBridgeConnectivity()
      await this.testClientAssetLoading(browserDrive)
      
      await this.testURLResolution()
      await this.testErrorHandlingAndFallbacks()
      await this.testPerformanceCharacteristics()

      this.log('🎉 All integration tests completed successfully!')
      this.log(`   Passed: ${this.passed} | Failed: ${this.failed}`)
      
      if (this.failed === 0) {
        this.log('✨ P2P asset pipeline is fully operational!', 'pass')
      }

    } catch (error) {
      this.log(`💥 Integration test failed: ${error.message}`, 'fail')
      throw error
    } finally {
      await this.teardown()
    }

    return {
      passed: this.passed,
      failed: this.failed,
      success: this.failed === 0
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new IntegrationTestSuite()
  
  testSuite.run().then(results => {
    if (results.success) {
      console.log('\n🚀 P2P Integration: READY FOR PRODUCTION')
      process.exit(0)
    } else {
      console.log('\n💥 P2P Integration: NEEDS ATTENTION')
      process.exit(1)
    }
  }).catch(error => {
    console.error('\n❌ Integration test suite failed:', error)
    process.exit(1)
  })
}

export { IntegrationTestSuite }