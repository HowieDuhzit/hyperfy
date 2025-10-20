/**
 * Browser-compatible Hyperdrive client implementation
 * 
 * This provides a minimal interface to connect to Hyperdrive instances
 * from the browser using WebSocket connections to a bridge service.
 */

export class BrowserHyperdrive {
  constructor(key, options = {}) {
    this.key = key
    this.bridgeUrl = options.bridgeUrl || 'ws://localhost:3001' // Bridge service
    this.connected = false
    this.socket = null
    this.pendingRequests = new Map()
    this.requestId = 0
  }

  async connect() {
    if (this.connected) return

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.bridgeUrl)
        
        this.socket.onopen = () => {
          console.log('Connected to Hyperdrive bridge')
          this.connected = true
          
          // Send connection request with drive key
          this.send('connect', { key: this.key })
          resolve()
        }
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (error) {
            console.error('Failed to parse bridge message:', error)
          }
        }
        
        this.socket.onclose = () => {
          console.log('Disconnected from Hyperdrive bridge')
          this.connected = false
        }
        
        this.socket.onerror = (error) => {
          console.error('Hyperdrive bridge error:', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  handleMessage(data) {
    const { id, type, payload, error } = data
    
    if (id && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id)
      this.pendingRequests.delete(id)
      
      if (error) {
        reject(new Error(error))
      } else {
        resolve(payload)
      }
      return
    }
    
    // Handle other message types if needed
    console.log('Received bridge message:', data)
  }

  send(type, payload) {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to bridge')
    }
    
    const id = ++this.requestId
    const message = { id, type, payload }
    
    this.socket.send(JSON.stringify(message))
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }

  async get(path) {
    if (!this.connected) {
      await this.connect()
    }
    
    try {
      const result = await this.send('get', { path })
      if (result && result.buffer) {
        // Convert base64 back to buffer
        const binaryString = atob(result.buffer)
        const buffer = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          buffer[i] = binaryString.charCodeAt(i)
        }
        return buffer
      }
      return null
    } catch (error) {
      console.error('Failed to get file from hyperdrive:', error)
      return null
    }
  }

  async put(path, buffer) {
    if (!this.connected) {
      await this.connect()
    }
    
    try {
      // Convert buffer to base64 for transport
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      await this.send('put', { path, buffer: base64 })
      return true
    } catch (error) {
      console.error('Failed to put file to hyperdrive:', error)
      return false
    }
  }

  async list(path = '/') {
    if (!this.connected) {
      await this.connect()
    }
    
    try {
      const result = await this.send('list', { path })
      return result.files || []
    } catch (error) {
      console.error('Failed to list hyperdrive contents:', error)
      return []
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
      this.connected = false
    }
  }
}

// Global registry for hyperdrive instances
export class HyperdriveRegistry {
  constructor() {
    this.drives = new Map()
  }

  async get(key, options = {}) {
    if (!this.drives.has(key)) {
      const drive = new BrowserHyperdrive(key, options)
      this.drives.set(key, drive)
    }
    return this.drives.get(key)
  }

  disconnect(key) {
    const drive = this.drives.get(key)
    if (drive) {
      drive.disconnect()
      this.drives.delete(key)
    }
  }

  disconnectAll() {
    for (const [key, drive] of this.drives) {
      drive.disconnect()
    }
    this.drives.clear()
  }
}

// Export singleton instance
export const hyperdriveRegistry = new HyperdriveRegistry()