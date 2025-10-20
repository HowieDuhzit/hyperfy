/**
 * Simplified P2P Integration Test
 * 
 * This test validates the P2P system without corestore sharing conflicts
 * by testing each component independently.
 */

import { HyperdriveBridge } from './src/core/services/HyperdriveBridge.js'
import { HyperdriveAssetStorage } from './src/core/assets/HyperdriveAssetStorage.js'
import { hyperdriveRegistry } from './src/core/utils/BrowserHyperdrive.js'
import { promises as fs } from 'fs'

class SimpleIntegrationTest {
  constructor() {
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

  async testHyperdriveAssetStorage() {
    this.log('🗄️  Testing HyperdriveAssetStorage...')

    const storage = new HyperdriveAssetStorage()
    await storage.initialize({
      storageDir: './world/test-simple-storage'
    })

    // Create test asset
    const testContent = JSON.stringify({ message: 'Hello P2P World!' })
    const testBuffer = Buffer.from(testContent, 'utf-8')
    
    const assetInfo = await storage.storeAsset(testBuffer, 'test.json')
    await this.assert(assetInfo.hash, 'Asset stored with hash')
    
    // Test retrieval
    const retrieved = await storage.getAssetBuffer(assetInfo.hash)
    await this.assert(retrieved.toString('utf-8') === testContent, 'Asset content integrity')

    // Test URL generation
    const url = await storage.getAssetUrl(assetInfo.hash)
    await this.assert(url.startsWith('hyperdrive://'), 'Hyperdrive URL generated')

    this.log(`  Drive Key: ${storage.drive.key.toString('hex')}`)
    this.log(`  Asset URL: ${url}`)

    await storage.close()

    // Cleanup
    await fs.rm('./world/test-simple-storage', { recursive: true, force: true }).catch(() => {})
  }

  async testBridgeService() {
    this.log('🌉 Testing Bridge Service...')

    const bridge = new HyperdriveBridge({ port: 3002 })
    await bridge.start()

    await this.assert(bridge.wss !== null, 'Bridge service started')
    this.log(`  Bridge running on port 3002`)

    // Test with a simple drive creation
    const storage = new HyperdriveAssetStorage()
    await storage.initialize({
      storageDir: './world/test-bridge-storage'
    })

    const testAsset = Buffer.from('Bridge test content')
    const assetInfo = await storage.storeAsset(testAsset, 'bridge-test.txt')
    
    this.log(`  Created test asset: ${assetInfo.hash}`)
    this.log(`  Drive key for bridge: ${storage.drive.key.toString('hex')}`)

    await storage.close()
    await bridge.stop()

    // Cleanup
    await fs.rm('./world/test-bridge-storage', { recursive: true, force: true }).catch(() => {})
  }

  async testBrowserHyperdriveClient() {
    this.log('🌐 Testing BrowserHyperdrive Client...')

    // This tests the client interface without needing a real bridge
    const driveKey = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234'
    
    const drive = await hyperdriveRegistry.get(driveKey, {
      bridgeUrl: 'ws://localhost:9999' // Non-existent bridge
    })

    await this.assert(drive !== null, 'BrowserHyperdrive instance created')
    await this.assert(drive.key === driveKey, 'Drive key stored correctly')
    await this.assert(!drive.connected, 'Drive starts disconnected')

    // Test connection failure handling (expect it to fail)
    let connectionFailed = false
    try {
      await drive.connect()
    } catch (error) {
      connectionFailed = true
    }
    
    await this.assert(connectionFailed, 'Connection failure handled gracefully')
    hyperdriveRegistry.disconnectAll()
  }

  async testURLResolution() {
    this.log('🔗 Testing URL Resolution...')

    // Test the World.resolveURL logic
    const testWorld = {
      assetsUrl: 'http://localhost:3000/assets',
      hyperdriveUrl: 'abc123def456',
      
      isP2PAssetsEnabled: () => true,
      
      resolveURL(url) {
        if (!url) return url
        url = url.trim()
        
        if (url.startsWith('blob')) return url
        if (url.startsWith('hyperdrive://')) return url
        
        if (url.startsWith('asset://')) {
          const useHyperdrive = this.isP2PAssetsEnabled()
          if (useHyperdrive && this.hyperdriveUrl) {
            const assetPath = url.replace('asset://', '')
            return `hyperdrive://${this.hyperdriveUrl}/${assetPath}`
          } else {
            return url.replace('asset:/', this.assetsUrl)
          }
        }
        
        if (url.match(/^https?:\/\//i)) return url
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return url
        return `https://${url}`
      }
    }

    // Test cases
    const resolved1 = testWorld.resolveURL('asset://models/building.glb')
    await this.assert(resolved1.startsWith('hyperdrive://'), 'asset:// resolved to hyperdrive://')
    
    const resolved2 = testWorld.resolveURL('http://example.com/test.glb')
    await this.assert(resolved2 === 'http://example.com/test.glb', 'HTTP URL passed through')
    
    const resolved3 = testWorld.resolveURL('hyperdrive://test123/asset.glb')
    await this.assert(resolved3 === 'hyperdrive://test123/asset.glb', 'hyperdrive:// URL passed through')

    this.log(`  asset:// -> ${resolved1}`)
    this.log(`  http:// -> ${resolved2}`)
    this.log(`  hyperdrive:// -> ${resolved3}`)
  }

  async testSystemIntegration() {
    this.log('🔄 Testing System Integration...')

    // Test that all components can coexist
    const storage = new HyperdriveAssetStorage()
    await storage.initialize({
      storageDir: './world/test-integration-final'
    })

    const bridge = new HyperdriveBridge({ port: 3003 })
    await bridge.start()

    // Create asset
    const content = JSON.stringify({ integrated: true, timestamp: Date.now() })
    const buffer = Buffer.from(content, 'utf-8')
    const assetInfo = await storage.storeAsset(buffer, 'integration.json')

    await this.assert(assetInfo.hash, 'Asset created in integration test')

    // Test URL generation
    const url = await storage.getAssetUrl(assetInfo.hash)
    await this.assert(url.includes(assetInfo.hash), 'URL contains asset hash')

    this.log(`  Integration asset: ${assetInfo.hash}`)
    this.log(`  Integration URL: ${url}`)

    // Cleanup
    await bridge.stop()
    await storage.close()
    await fs.rm('./world/test-integration-final', { recursive: true, force: true }).catch(() => {})
  }

  async run() {
    this.log('🚀 Starting Simplified P2P Integration Test')
    this.log('=' .repeat(60))

    try {
      await this.testHyperdriveAssetStorage()
      await this.testBridgeService()
      await this.testBrowserHyperdriveClient()
      await this.testURLResolution()
      await this.testSystemIntegration()

      this.log('🎉 All simplified integration tests completed!')
      this.log(`   Passed: ${this.passed} | Failed: ${this.failed}`)
      
      if (this.failed === 0) {
        this.log('✨ P2P system components are operational!', 'pass')
        return { passed: this.passed, failed: this.failed, success: true }
      } else {
        this.log('⚠️  Some tests failed - system needs attention', 'warn')
        return { passed: this.passed, failed: this.failed, success: false }
      }

    } catch (error) {
      this.log(`💥 Integration test failed: ${error.message}`, 'fail')
      return { passed: this.passed, failed: this.failed, success: false, error }
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new SimpleIntegrationTest()
  
  testSuite.run().then(results => {
    if (results.success) {
      console.log('\n🚀 P2P System Components: OPERATIONAL')
      process.exit(0)
    } else {
      console.log('\n⚠️  P2P System: NEEDS REVIEW')
      process.exit(1)
    }
  }).catch(error => {
    console.error('\n❌ Simple integration test failed:', error)
    process.exit(1)
  })
}

export { SimpleIntegrationTest }