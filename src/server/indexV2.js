import 'ses'
import '../core/lockdown.js'
import './bootstrap.js'

import fs from 'fs-extra'
import path from 'path'
import { pipeline } from 'stream/promises'
import Fastify from 'fastify'
import ws from '@fastify/websocket'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import statics from '@fastify/static'
import multipart from '@fastify/multipart'

import { loadPhysX } from './physx/loadPhysX.js'

import { createServerWorldV2 } from '../core/createServerWorldV2.js'
import { hashFile } from '../core/utils-server.js'
import { getDB } from './db.js'
import { StorageFactory } from '../core/storage/StorageFactory.js'
import { AssetFactory } from '../core/assets/AssetFactory.js'

// Import transport for P2P support
import { TransportFactory } from '../core/transport/TransportFactory.js'

const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, process.env.WORLD)
const assetsDir = path.join(worldDir, '/assets')
const port = process.env.PORT

await fs.ensureDir(worldDir)
await fs.ensureDir(assetsDir)

// copy core assets
await fs.copy(path.join(rootDir, 'src/core/assets'), path.join(assetsDir))

const db = await getDB(path.join(worldDir, '/db.sqlite'))

// Create P2P transport if needed (for storage networking)
let swarm = null
const storageType = StorageFactory.getStorageType(null, process.env)
if (storageType === 'hypercore') {
  const transport = await TransportFactory.create({
    type: 'hyperswarm',
    worldId: process.env.WORLD || 'default',
    isServer: true
  })
  swarm = transport.swarm
}

// Create storage with factory
const storage = await StorageFactory.create({
  worldDir,
  worldId: process.env.WORLD || 'default',
  swarm,
  env: process.env
})

// Create asset storage with factory
const assetStorage = await AssetFactory.create({
  assetsDir,
  worldDir,
  worldId: process.env.WORLD || 'default',
  baseUrl: process.env.PUBLIC_ASSETS_URL,
  swarm,
  env: process.env
})

const world = createServerWorldV2()
world.init({ db, storage, loadPhysX })

const fastify = Fastify({ logger: { level: 'error' } })

fastify.register(cors)
fastify.register(compress)
fastify.register(statics, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
  decorateReply: false,
  setHeaders: res => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  },
})
fastify.register(statics, {
  root: assetsDir,
  prefix: '/assets/',
  decorateReply: false,
  setHeaders: res => {
    // all assets are hashed & immutable so we can use aggressive caching
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // older browsers
  },
})
fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
})
fastify.register(ws)
fastify.register(worldNetwork)

const publicEnvs = {}
for (const key in process.env) {
  if (key.startsWith('PUBLIC_')) {
    const value = process.env[key]
    publicEnvs[key] = value
  }
}
const envsCode = `
  if (!globalThis.process) globalThis.process = {}
  globalThis.process.env = ${JSON.stringify(publicEnvs)}
`
fastify.get('/env.js', async (req, reply) => {
  reply.type('application/javascript').send(envsCode)
})

fastify.post('/api/upload', async (req, reply) => {
  try {
    // console.log('DEBUG: slow uploads')
    // await new Promise(resolve => setTimeout(resolve, 2000))
    const file = await req.file()
    const originalFilename = file.filename
    
    // create temp buffer to store contents
    const chunks = []
    for await (const chunk of file.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    
    // Store asset using asset storage (HTTP or P2P)
    const assetInfo = await assetStorage.storeAsset(buffer, originalFilename)
    
    return reply.send({
      success: true,
      hash: assetInfo.hash,
      filename: assetInfo.filename,
      url: assetInfo.url,
      size: assetInfo.size,
      type: assetInfo.type
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return reply.code(500).send({
      success: false,
      error: error.message
    })
  }
})

fastify.get('/api/upload-check', async (req, reply) => {
  try {
    const { filename, hash } = req.query
    
    let exists = false
    if (hash) {
      // Check by hash (preferred method)
      exists = await assetStorage.hasAsset(hash)
    } else if (filename) {
      // Fallback: check by filename (extract hash from filename)
      const hashFromFilename = filename.split('.')[0]
      exists = await assetStorage.hasAsset(hashFromFilename)
    }
    
    return { exists }
  } catch (error) {
    console.error('Upload check error:', error)
    return { exists: false, error: error.message }
  }
})

// Enhanced health check with storage and asset info
fastify.get('/health', async (request, reply) => {
  try {
    const storageStats = await storage.stats()
    const assetStats = await assetStorage.getStats()
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      storage: {
        type: storageStats.type,
        ready: storageStats.ready,
        peerCount: storageStats.peerCount || 0
      },
      assets: {
        type: assetStats.type,
        ready: assetStats.ready,
        totalAssets: assetStats.totalAssets || 0,
        peerCount: assetStats.peerCount || 0
      }
    }

    return reply.code(200).send(health)
  } catch (error) {
    console.error('Health check failed:', error)
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

// Enhanced status endpoint with storage, assets, and P2P info
fastify.get('/status', async (request, reply) => {
  try {
    const storageStats = await storage.stats()
    const assetStats = await assetStorage.getStats()
    const status = {
      uptime: Math.round(world.time),
      protected: process.env.ADMIN_CODE !== undefined ? true : false,
      connectedUsers: [],
      commitHash: process.env.COMMIT_HASH,
      storage: storageStats,
      assets: assetStats,
    }
    
    for (const socket of world.network.sockets.values()) {
      status.connectedUsers.push({
        id: socket.player.data.userId,
        position: socket.player.position.current.toArray(),
        name: socket.player.data.name,
      })
    }

    return reply.code(200).send(status)
  } catch (error) {
    console.error('Status failed:', error)
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

// API endpoints for storage and asset migration (admin only)
fastify.post('/api/migrate-storage', async (request, reply) => {
  try {
    const { targetType, dryRun = true } = request.body
    
    if (!StorageFactory.isTypeAvailable(targetType)) {
      return reply.code(400).send({ error: 'Invalid storage type' })
    }
    
    const currentStats = await storage.stats()
    if (targetType === currentStats.type) {
      return reply.code(400).send({ error: 'Already using target storage type' })
    }
    
    // Create target storage
    const targetStorage = await StorageFactory.create({
      type: targetType,
      worldDir,
      worldId: process.env.WORLD || 'default',
      swarm,
      env: process.env
    })
    
    // Create migration
    const migration = await StorageFactory.createMigration(storage, targetStorage)
    
    // Run migration
    const result = await migration.migrate({ dryRun })
    
    await targetStorage.close()
    
    return reply.send({
      success: true,
      migration: result
    })
    
  } catch (error) {
    console.error('Storage migration failed:', error)
    return reply.code(500).send({ error: error.message })
  }
})

fastify.post('/api/migrate-assets', async (request, reply) => {
  try {
    const { targetType, dryRun = true } = request.body
    
    if (!AssetFactory.isTypeAvailable(targetType)) {
      return reply.code(400).send({ error: 'Invalid asset storage type' })
    }
    
    const currentStats = await assetStorage.getStats()
    if (targetType === currentStats.type) {
      return reply.code(400).send({ error: 'Already using target asset storage type' })
    }
    
    // Create target asset storage
    const targetAssetStorage = await AssetFactory.create({
      type: targetType,
      assetsDir,
      worldDir,
      worldId: process.env.WORLD || 'default',
      baseUrl: process.env.PUBLIC_ASSETS_URL,
      swarm,
      env: process.env
    })
    
    // Create migration
    const migration = await AssetFactory.createMigration(assetStorage, targetAssetStorage)
    
    // Run migration
    const result = await migration.migrate({ dryRun })
    
    await targetAssetStorage.close()
    
    return reply.send({
      success: true,
      migration: result
    })
    
  } catch (error) {
    console.error('Asset migration failed:', error)
    return reply.code(500).send({ error: error.message })
  }
})

fastify.setErrorHandler((err, req, reply) => {
  console.error(err)
  reply.status(500).send()
})

try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${port}`)
  process.exit(1)
}

async function worldNetwork(fastify) {
  fastify.get('/ws', { websocket: true }, (ws, req) => {
    world.network.onConnection(ws, req.query.authToken)
  })
}

console.log(`running on port ${port}`)
console.log(`storage type: ${storageType}`)

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...')
  await storage.close()
  await assetStorage.close()
  await fastify.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...')
  await storage.close()
  await assetStorage.close()
  await fastify.close()
  process.exit(0)
})
