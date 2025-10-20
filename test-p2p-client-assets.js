/**
 * Test script for P2P client asset loading
 * 
 * This script tests the browser-based P2P asset loading system
 * by setting up both server and client components and validating
 * that assets can be loaded via Hyperdrive URLs.
 */

import { HyperdriveBridge } from './src/core/services/HyperdriveBridge.js'
import { HyperdriveAssetStorage } from './src/core/assets/HyperdriveAssetStorage.js'
import { promises as fs } from 'fs'
import path from 'path'

async function testP2PClientAssets() {
  console.log('🧪 Testing P2P Client Asset Loading System')
  console.log('=' .repeat(50))

  let bridge = null
  let assetStorage = null

  try {
    // Start the WebSocket bridge service
    console.log('\n📡 Starting Hyperdrive bridge...')
    bridge = new HyperdriveBridge({ port: 3001 })
    await bridge.start()
    
    // Create asset storage instance
    console.log('\n💾 Setting up asset storage...')
    assetStorage = new HyperdriveAssetStorage()
    await assetStorage.initialize({ 
      storageDir: './world/hyperdrive-assets' 
    })
    
    // Create a test asset
    console.log('\n📄 Creating test asset...')
    const testContent = JSON.stringify({
      name: "Test 3D Model",
      format: "glb",
      description: "A test asset for P2P loading validation"
    }, null, 2)
    
    const testBuffer = Buffer.from(testContent, 'utf-8')
    const assetInfo = await assetStorage.storeAsset(testBuffer, 'test-model.json')
    console.log(`✅ Test asset stored: ${assetInfo.hash}`)
    
    // Get the asset URL that would be sent to clients
    const assetUrl = await assetStorage.getAssetUrl(assetInfo.hash)
    console.log(`🔗 Asset URL: ${assetUrl}`)
    
    // Test that we can retrieve it
    const retrievedBuffer = await assetStorage.getAssetBuffer(assetInfo.hash)
    const retrievedContent = retrievedBuffer.toString('utf-8')
    const parsedContent = JSON.parse(retrievedContent)
    
    console.log('📦 Retrieved asset content:', parsedContent)
    
    // Validate the content matches
    if (retrievedContent === testContent) {
      console.log('✅ Asset storage and retrieval working correctly')
    } else {
      throw new Error('Asset content mismatch')
    }
    
    console.log('\n🌐 Bridge is running on ws://localhost:3001')
    console.log('🎯 To test browser client loading:')
    console.log('   1. Start your Hyperfy server with: npm run dev')
    console.log('   2. In browser console, run:')
    console.log(`      localStorage.setItem('hyperfy_use_loader_v2', 'true')`)
    console.log(`      localStorage.setItem('hyperfy_assets_type', 'hyperdrive')`)
    console.log('   3. Try loading assets - they should use P2P transport')
    console.log('\n⏱️  Bridge will stay running for testing (Ctrl+C to stop)')
    
    // Keep the bridge running for manual testing
    return new Promise((resolve) => {
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down test environment...')
        if (bridge) await bridge.stop()
        console.log('✅ Test environment stopped')
        resolve()
      })
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    
    if (bridge) {
      await bridge.stop()
    }
    
    throw error
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testP2PClientAssets().catch(error => {
    console.error('Test suite failed:', error)
    process.exit(1)
  })
}