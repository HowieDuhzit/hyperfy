/**
 * WebSocket bridge service for browser Hyperdrive access
 * 
 * This service allows browser clients to access Hyperdrive content
 * via WebSocket connections, bridging the gap between Node.js
 * Hyperdrive instances and browser clients.
 */

import { WebSocketServer } from 'ws'
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

export class HyperdriveBridge {
  constructor(options = {}) {
    this.port = options.port || 3001
    this.corestorePath = options.corestorePath || './world/corestore-bridge'
    this.corestore = new Corestore(this.corestorePath)
    this.drives = new Map()
    this.clients = new Set()
    this.wss = null
  }

  async start() {
    console.log(`Starting Hyperdrive bridge on port ${this.port}`)
    
    this.wss = new WebSocketServer({ 
      port: this.port,
      perMessageDeflate: false 
    })

    this.wss.on('connection', (ws) => {
      console.log('Browser client connected to Hyperdrive bridge')
      this.clients.add(ws)
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString())
          await this.handleMessage(ws, message)
        } catch (error) {
          console.error('Bridge message error:', error)
          this.sendError(ws, null, error.message)
        }
      })
      
      ws.on('close', () => {
        console.log('Browser client disconnected from Hyperdrive bridge')
        this.clients.delete(ws)
      })
      
      ws.on('error', (error) => {
        console.error('Bridge WebSocket error:', error)
        this.clients.delete(ws)
      })
    })

    console.log(`Hyperdrive bridge listening on ws://localhost:${this.port}`)
  }

  async handleMessage(ws, message) {
    const { id, type, payload } = message

    try {
      switch (type) {
        case 'connect':
          await this.handleConnect(ws, id, payload)
          break
        
        case 'get':
          await this.handleGet(ws, id, payload)
          break
        
        case 'put':
          await this.handlePut(ws, id, payload)
          break
        
        case 'list':
          await this.handleList(ws, id, payload)
          break
        
        default:
          throw new Error(`Unknown message type: ${type}`)
      }
    } catch (error) {
      console.error(`Error handling ${type}:`, error)
      this.sendError(ws, id, error.message)
    }
  }

  async handleConnect(ws, id, payload) {
    const { key } = payload
    
    if (!key) {
      throw new Error('Drive key required')
    }

    try {
      // Create or get existing hyperdrive
      let drive = this.drives.get(key)
      if (!drive) {
        const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex')
        drive = new Hyperdrive(this.corestore, keyBuffer)
        await drive.ready()
        
        // Ensure drive is readable
        if (!drive.writable && drive.length === 0) {
          console.log(`Waiting for drive to sync: ${key}`)
          // Give some time for the drive to sync with peers
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        this.drives.set(key, drive)
        console.log(`Hyperdrive ready: ${key} (writable: ${drive.writable}, length: ${drive.length})`)
      }

      // Store drive reference for this connection
      ws.driveKey = key

      this.sendResponse(ws, id, { connected: true, key, writable: drive.writable, length: drive.length })
    } catch (error) {
      throw new Error(`Failed to connect to drive: ${error.message}`)
    }
  }

  async handleGet(ws, id, payload) {
    const { path } = payload
    const driveKey = ws.driveKey
    
    if (!driveKey) {
      throw new Error('Not connected to any drive')
    }

    const drive = this.drives.get(driveKey)
    if (!drive) {
      throw new Error('Drive not found')
    }

    try {
      const buffer = await drive.get(path)
      if (!buffer) {
        this.sendResponse(ws, id, { buffer: null })
        return
      }

      // Convert buffer to base64 for transport
      const base64 = buffer.toString('base64')
      this.sendResponse(ws, id, { buffer: base64 })
      
      console.log(`Served file: ${path} (${buffer.length} bytes) from drive: ${driveKey}`)
    } catch (error) {
      throw new Error(`Failed to get file: ${error.message}`)
    }
  }

  async handlePut(ws, id, payload) {
    const { path, buffer } = payload
    const driveKey = ws.driveKey
    
    if (!driveKey) {
      throw new Error('Not connected to any drive')
    }

    const drive = this.drives.get(driveKey)
    if (!drive) {
      throw new Error('Drive not found')
    }

    try {
      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(buffer, 'base64')
      await drive.put(path, fileBuffer)
      
      this.sendResponse(ws, id, { success: true })
      console.log(`Stored file: ${path} (${fileBuffer.length} bytes) to drive: ${driveKey}`)
    } catch (error) {
      throw new Error(`Failed to put file: ${error.message}`)
    }
  }

  async handleList(ws, id, payload) {
    const { path = '/' } = payload
    const driveKey = ws.driveKey
    
    if (!driveKey) {
      throw new Error('Not connected to any drive')
    }

    const drive = this.drives.get(driveKey)
    if (!drive) {
      throw new Error('Drive not found')
    }

    try {
      const files = []
      for await (const entry of drive.list(path)) {
        files.push({
          path: entry.key,
          size: entry.value?.blob?.byteLength || 0
        })
      }
      
      this.sendResponse(ws, id, { files })
      console.log(`Listed ${files.length} files in ${path} from drive: ${driveKey}`)
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`)
    }
  }

  sendResponse(ws, id, payload) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ id, payload }))
    }
  }

  sendError(ws, id, error) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ id, error }))
    }
  }

  async stop() {
    console.log('Stopping Hyperdrive bridge...')
    
    if (this.wss) {
      this.wss.close()
    }
    
    // Close all drives
    for (const drive of this.drives.values()) {
      await drive.close()
    }
    this.drives.clear()
    
    await this.corestore.close()
    console.log('Hyperdrive bridge stopped')
  }
}

// Standalone script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const bridge = new HyperdriveBridge()
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down bridge...')
    await bridge.stop()
    process.exit(0)
  })
  
  bridge.start().catch(console.error)
}