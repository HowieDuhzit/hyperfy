import { Transport, MESSAGE_TYPES } from './Transport.js'

// Protocol constants
const PROTOCOL_VERSION = 1
const SCHEMA_VERSION = 1
const MESSAGE_HEADER_SIZE = 3 // version(1) + msgType(1) + schemaRev(1)
const PING_INTERVAL = 30000 // 30 seconds
const PEER_TIMEOUT = 60000 // 60 seconds

/**
 * Hyperswarm P2P Transport Implementation
 * 
 * Uses Hyperswarm for peer discovery and Secretstream for encrypted communication.
 * Provides NAT traversal and end-to-end encryption for all peer connections.
 */
export class SwarmTransport extends Transport {
  constructor() {
    super()
    this.swarm = null
    this.dht = null
    this.worldTopic = null
    this.peers = new Map() // peerId -> PeerConnection
    this.hostPeer = null
    this.isHost = false
    this.peerId = null
    this._pingInterval = null
    this._connectPromise = null
  }

  async connect({ worldId = 'default', bootstrap = [] }) {
    if (this._connectPromise) {
      return this._connectPromise
    }

    this._connectPromise = this._doConnect({ worldId, bootstrap })
    return this._connectPromise
  }

  async _doConnect({ worldId, bootstrap }) {
    try {
      // Check if we're in Pear environment
      if (typeof globalThis.Pear === 'undefined') {
        throw new Error('SwarmTransport requires Pear runtime (Hyperswarm not available)')
      }

      // Access Pear's bundled Hyperswarm and HyperDHT
      const Hyperswarm = globalThis.Pear.Hyperswarm || globalThis.Hyperswarm
      const HyperDHT = globalThis.Pear.HyperDHT || globalThis.HyperDHT
      const Secretstream = globalThis.Pear.Secretstream || globalThis.Secretstream
      const crypto = globalThis.Pear.crypto || globalThis.crypto

      if (!Hyperswarm || !HyperDHT || !Secretstream) {
        throw new Error('Hyperswarm stack not available in Pear runtime')
      }

      // Initialize DHT with bootstrap nodes
      this.dht = new HyperDHT({ bootstrap })
      
      // Initialize Hyperswarm
      this.swarm = new Hyperswarm({ dht: this.dht })
      
      // Generate peer ID
      this.peerId = this._generatePeerId()
      
      // Set up swarm event handlers
      this._setupSwarmHandlers()
      
      // Start heartbeat
      this._startHeartbeat()
      
      this._connected = true
      console.log('SwarmTransport connected, peer ID:', this.peerId)
      
    } catch (error) {
      console.error('Failed to initialize SwarmTransport:', error)
      throw error
    }
  }

  async joinRoom(worldId, auth) {
    if (!this.swarm) {
      throw new Error('SwarmTransport not connected')
    }

    try {
      // Derive deterministic topic from worldId using blake2b-like hash
      this.worldTopic = await this._deriveTopic(worldId)
      
      // Join the swarm topic
      const discovery = this.swarm.join(this.worldTopic, { client: true, server: true })
      await discovery.flushed() // Wait for DHT announce
      
      console.log('Joined world:', worldId, 'topic:', this._topicToHex(this.worldTopic))
      
    } catch (error) {
      console.error('Failed to join room:', error)
      throw error
    }
  }

  async leaveRoom() {
    if (!this.swarm || !this.worldTopic) {
      return
    }

    try {
      // Leave the swarm topic
      await this.swarm.leave(this.worldTopic)
      
      // Close all peer connections
      for (const peer of this.peers.values()) {
        peer.destroy()
      }
      this.peers.clear()
      
      this.worldTopic = null
      this.hostPeer = null
      this.isHost = false
      
      console.log('Left world room')
      
    } catch (error) {
      console.error('Failed to leave room:', error)
    }
  }

  send(type, payload) {
    if (!this._connected) {
      console.warn('SwarmTransport not connected, dropping message')
      return
    }

    const message = this._serializeMessage(type, payload)
    let sentCount = 0
    
    // Send to all connected peers
    for (const peer of this.peers.values()) {
      if (peer.connected) {
        try {
          peer.send(message)
          sentCount++
        } catch (error) {
          console.warn('Failed to send to peer:', peer.id, error)
        }
      }
    }
    
    if (sentCount > 0) {
      this._metrics.messagesOut++
      this._metrics.bytesOut += message.length
    }
  }

  sendTo(peerId, type, payload) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer.connected) {
      console.warn('Peer not found or not connected:', peerId)
      return
    }

    try {
      const message = this._serializeMessage(type, payload)
      peer.send(message)
      this._metrics.messagesOut++
      this._metrics.bytesOut += message.length
    } catch (error) {
      console.error('Failed to send to peer:', peerId, error)
    }
  }

  destroy() {
    super.destroy()
    
    if (this._pingInterval) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
    
    // Close all peer connections
    for (const peer of this.peers.values()) {
      peer.destroy()
    }
    this.peers.clear()
    
    // Close swarm and DHT
    if (this.swarm) {
      this.swarm.destroy()
      this.swarm = null
    }
    
    if (this.dht) {
      this.dht.destroy()
      this.dht = null
    }
    
    this._connected = false
    console.log('SwarmTransport destroyed')
  }

  // Private methods
  _setupSwarmHandlers() {
    this.swarm.on('connection', (rawSocket, info) => {
      this._handleNewConnection(rawSocket, info)
    })
    
    this.swarm.on('error', (error) => {
      console.error('Swarm error:', error)
    })
  }

  async _handleNewConnection(rawSocket, info) {
    try {
      // Wrap connection with Secretstream for encryption
      const Secretstream = globalThis.Pear.Secretstream || globalThis.Secretstream
      const socket = new Secretstream(rawSocket)
      
      // Generate peer ID from connection info
      const peerId = this._generatePeerIdFromConnection(info)
      
      // Create peer connection object
      const peer = new PeerConnection(peerId, socket, info.client)
      
      // Set up peer event handlers
      peer.on('message', (message) => {
        this._handlePeerMessage(peer, message)
      })
      
      peer.on('close', () => {
        this._handlePeerDisconnect(peer)
      })
      
      peer.on('error', (error) => {
        console.warn('Peer error:', peerId, error)
        this._handlePeerDisconnect(peer)
      })
      
      // Add to peers map
      this.peers.set(peerId, peer)
      this._metrics.peerCount = this.peers.size
      
      // Emit peer join event
      this._emitPeerJoin(peerId)
      
      console.log('New peer connected:', peerId, 'client:', info.client)
      
    } catch (error) {
      console.error('Failed to handle new connection:', error)
      rawSocket.destroy()
    }
  }

  _handlePeerMessage(peer, buffer) {
    try {
      const { type, payload } = this._deserializeMessage(buffer)
      this._emit(type, payload, peer.id)
      this._metrics.messagesIn++
      this._metrics.bytesIn += buffer.length
    } catch (error) {
      console.error('Failed to deserialize message from peer:', peer.id, error)
    }
  }

  _handlePeerDisconnect(peer) {
    const peerId = peer.id
    this.peers.delete(peerId)
    this._metrics.peerCount = this.peers.size
    
    // Check if this was the host peer
    if (peer === this.hostPeer) {
      this.hostPeer = null
      this.isHost = false
      // TODO: Implement host election logic
    }
    
    this._emitPeerLeave(peerId)
    console.log('Peer disconnected:', peerId)
  }

  _serializeMessage(type, payload) {
    // Create message header: [version(1), msgType(1), schemaRev(1)]
    const header = new Uint8Array(MESSAGE_HEADER_SIZE)
    header[0] = PROTOCOL_VERSION
    header[1] = type
    header[2] = SCHEMA_VERSION
    
    // Serialize payload (using msgpack or JSON)
    const payloadBuffer = this._serializePayload(payload)
    
    // Combine header and payload
    const message = new Uint8Array(header.length + payloadBuffer.length)
    message.set(header, 0)
    message.set(payloadBuffer, header.length)
    
    return message
  }

  _deserializeMessage(buffer) {
    if (buffer.length < MESSAGE_HEADER_SIZE) {
      throw new Error('Message too short')
    }
    
    // Extract header
    const version = buffer[0]
    const type = buffer[1]
    const schemaRev = buffer[2]
    
    // Validate version
    if (version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported protocol version: ${version}`)
    }
    
    // Extract and deserialize payload
    const payloadBuffer = buffer.slice(MESSAGE_HEADER_SIZE)
    const payload = this._deserializePayload(payloadBuffer)
    
    return { type, payload, schemaRev }
  }

  _serializePayload(payload) {
    // Use JSON serialization for now (could switch to msgpack later)
    const jsonString = JSON.stringify(payload)
    return new TextEncoder().encode(jsonString)
  }

  _deserializePayload(buffer) {
    const jsonString = new TextDecoder().decode(buffer)
    return JSON.parse(jsonString)
  }

  async _deriveTopic(worldId) {
    // Use Pear's crypto API to create deterministic topic
    const crypto = globalThis.Pear.crypto || globalThis.crypto
    const encoder = new TextEncoder()
    const data = encoder.encode(`hyperfy-world-${worldId}`)
    
    // Create hash (blake2b-like functionality)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(hashBuffer.slice(0, 32)) // Take first 32 bytes
  }

  _generatePeerId() {
    // Generate random peer ID
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  _generatePeerIdFromConnection(info) {
    // Generate deterministic peer ID from connection info
    const data = `${info.publicKey || info.remoteAddress}:${info.remotePort || ''}`
    return data.slice(0, 32) // Simplified - could use proper hash
  }

  _topicToHex(topic) {
    return Array.from(topic, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  _startHeartbeat() {
    this._pingInterval = setInterval(() => {
      this._sendPings()
      this._cleanupStaleConnections()
    }, PING_INTERVAL)
  }

  _sendPings() {
    const now = Date.now()
    for (const peer of this.peers.values()) {
      if (peer.connected) {
        peer.lastPing = now
        // Send ping message (could be a special message type)
        try {
          this.sendTo(peer.id, MESSAGE_TYPES.CONNECT, { ping: now })
        } catch (error) {
          console.warn('Failed to ping peer:', peer.id)
        }
      }
    }
  }

  _cleanupStaleConnections() {
    const now = Date.now()
    const staleThreshold = now - PEER_TIMEOUT
    
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.lastSeen && peer.lastSeen < staleThreshold) {
        console.warn('Removing stale peer:', peerId)
        peer.destroy()
        this.peers.delete(peerId)
      }
    }
  }
}

/**
 * Peer Connection wrapper
 */
class PeerConnection {
  constructor(id, socket, isClient) {
    this.id = id
    this.socket = socket
    this.isClient = isClient
    this.connected = true
    this.lastSeen = Date.now()
    this.lastPing = Date.now()
    this._handlers = new Map()
    
    this._setupSocket()
  }

  _setupSocket() {
    this.socket.on('data', (data) => {
      this.lastSeen = Date.now()
      this._emit('message', data)
    })
    
    this.socket.on('close', () => {
      this.connected = false
      this._emit('close')
    })
    
    this.socket.on('error', (error) => {
      this.connected = false
      this._emit('error', error)
    })
  }

  send(data) {
    if (!this.connected) {
      throw new Error('Peer not connected')
    }
    this.socket.write(data)
  }

  destroy() {
    this.connected = false
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this._handlers.clear()
  }

  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set())
    }
    this._handlers.get(event).add(handler)
  }

  _emit(event, ...args) {
    const handlers = this._handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args)
        } catch (error) {
          console.error('Peer event handler error:', error)
        }
      }
    }
  }
}
