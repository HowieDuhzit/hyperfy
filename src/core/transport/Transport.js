/**
 * Transport Interface
 * 
 * Provides a clean abstraction for network transport layers.
 * Both WebSocket and Hyperswarm implementations satisfy this interface.
 */

// Message Type Constants (replacing magic numbers)
export const MESSAGE_TYPES = {
  // Connection lifecycle
  CONNECT: 1,
  DISCONNECT: 2,
  PEER_JOIN: 3,
  PEER_LEAVE: 4,
  
  // Reliable messaging
  SNAPSHOT: 10,
  CHAT_ADDED: 11,
  CHAT_CLEARED: 12,
  BLUEPRINT_ADDED: 13,
  BLUEPRINT_MODIFIED: 14,
  ENTITY_ADDED: 15,
  ENTITY_MODIFIED: 16,
  ENTITY_EVENT: 17,
  ENTITY_REMOVED: 18,
  
  // Player events
  PLAYER_TELEPORT: 20,
  PLAYER_PUSH: 21,
  PLAYER_SESSION_AVATAR: 22,
  PLAYER_KICK: 23,
  
  // System events
  TOKEN_METADATA: 30,
  SEND_TO: 31,
  
  // Unreliable messaging (high-frequency updates)
  POSITION_UPDATE: 100,
  ANIMATION_UPDATE: 101,
  PHYSICS_UPDATE: 102,
}

/**
 * Abstract Transport class
 * All transport implementations must extend this class
 */
export class Transport {
  constructor() {
    this._messageHandlers = new Map()
    this._peerJoinHandlers = new Set()
    this._peerLeaveHandlers = new Set()
    this._disconnectHandlers = new Set()
    this._connected = false
    this._metrics = {
      bytesIn: 0,
      bytesOut: 0,
      messagesIn: 0,
      messagesOut: 0,
      peerCount: 0,
      rtt: 0
    }
  }

  /**
   * Connect to the transport
   * @param {Object} opts Connection options
   * @returns {Promise<void>}
   */
  async connect(opts) {
    throw new Error('connect() must be implemented by transport')
  }

  /**
   * Join a world/room
   * @param {string} worldId World identifier
   * @param {any} auth Optional authentication data
   * @returns {Promise<void>}
   */
  async joinRoom(worldId, auth) {
    throw new Error('joinRoom() must be implemented by transport')
  }

  /**
   * Leave current room
   * @returns {Promise<void>}
   */
  async leaveRoom() {
    throw new Error('leaveRoom() must be implemented by transport')
  }

  /**
   * Send reliable message
   * @param {number} type Message type constant
   * @param {any} payload Message payload
   */
  send(type, payload) {
    throw new Error('send() must be implemented by transport')
  }

  /**
   * Send unreliable message (for high-frequency updates)
   * @param {number} type Message type constant
   * @param {any} payload Message payload
   */
  sendUnreliable(type, payload) {
    // Default to reliable send if unreliable not supported
    this.send(type, payload)
  }

  /**
   * Send message to specific peer
   * @param {string} peerId Target peer ID
   * @param {number} type Message type constant
   * @param {any} payload Message payload
   */
  sendTo(peerId, type, payload) {
    throw new Error('sendTo() must be implemented by transport')
  }

  /**
   * Register message handler
   * @param {number} type Message type constant
   * @param {function} handler Message handler function
   * @returns {function} Cleanup function
   */
  onMessage(type, handler) {
    if (!this._messageHandlers.has(type)) {
      this._messageHandlers.set(type, new Set())
    }
    this._messageHandlers.get(type).add(handler)
    
    return () => {
      const handlers = this._messageHandlers.get(type)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this._messageHandlers.delete(type)
        }
      }
    }
  }

  /**
   * Register peer join handler
   * @param {function} handler Handler function (peerId) => void
   * @returns {function} Cleanup function
   */
  onPeerJoin(handler) {
    this._peerJoinHandlers.add(handler)
    return () => this._peerJoinHandlers.delete(handler)
  }

  /**
   * Register peer leave handler
   * @param {function} handler Handler function (peerId) => void
   * @returns {function} Cleanup function
   */
  onPeerLeave(handler) {
    this._peerLeaveHandlers.add(handler)
    return () => this._peerLeaveHandlers.delete(handler)
  }

  /**
   * Register disconnect handler
   * @param {function} handler Handler function (reason) => void
   * @returns {function} Cleanup function
   */
  onDisconnect(handler) {
    this._disconnectHandlers.add(handler)
    return () => this._disconnectHandlers.delete(handler)
  }

  /**
   * Destroy the transport and clean up resources
   */
  destroy() {
    this._messageHandlers.clear()
    this._peerJoinHandlers.clear()
    this._peerLeaveHandlers.clear()
    this._disconnectHandlers.clear()
    this._connected = false
  }

  /**
   * Get transport metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return { ...this._metrics }
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isConnected() {
    return this._connected
  }

  // Internal methods for subclasses
  _emit(type, payload, fromPeerId = null) {
    const handlers = this._messageHandlers.get(type)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload, fromPeerId)
        } catch (error) {
          console.error('Transport message handler error:', error)
        }
      }
    }
    this._metrics.messagesIn++
  }

  _emitPeerJoin(peerId) {
    for (const handler of this._peerJoinHandlers) {
      try {
        handler(peerId)
      } catch (error) {
        console.error('Transport peer join handler error:', error)
      }
    }
    this._metrics.peerCount++
  }

  _emitPeerLeave(peerId) {
    for (const handler of this._peerLeaveHandlers) {
      try {
        handler(peerId)
      } catch (error) {
        console.error('Transport peer leave handler error:', error)
      }
    }
    this._metrics.peerCount = Math.max(0, this._metrics.peerCount - 1)
  }

  _emitDisconnect(reason) {
    this._connected = false
    for (const handler of this._disconnectHandlers) {
      try {
        handler(reason)
      } catch (error) {
        console.error('Transport disconnect handler error:', error)
      }
    }
  }
}