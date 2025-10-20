import { Transport, MESSAGE_TYPES } from './Transport.js'
import { readPacket, writePacket } from '../packets'
import { storage } from '../storage'

/**
 * WebSocket Transport Implementation
 * 
 * Adapts the existing WebSocket implementation to the Transport interface
 */
export class WSTransport extends Transport {
  constructor() {
    super()
    this.ws = null
    this.wsUrl = null
    this.authToken = null
    this._pingInterval = null
  }

  async connect({ wsUrl }) {
    this.wsUrl = wsUrl
    this.authToken = storage.get('authToken')
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${wsUrl}?authToken=${this.authToken}`)
        this.ws.binaryType = 'arraybuffer'
        
        this.ws.addEventListener('open', () => {
          this._connected = true
          this._startHeartbeat()
          resolve()
        })
        
        this.ws.addEventListener('message', this._onMessage.bind(this))
        this.ws.addEventListener('close', this._onClose.bind(this))
        this.ws.addEventListener('error', (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        })
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this._connected) {
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000)
        
      } catch (error) {
        reject(error)
      }
    })
  }

  async joinRoom(worldId, auth) {
    // WebSocket version doesn't need explicit room joining
    // The room is determined by the WebSocket endpoint
    this.worldId = worldId
    this.auth = auth
  }

  async leaveRoom() {
    // WebSocket version doesn't need explicit room leaving
    this.worldId = null
    this.auth = null
  }

  send(type, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, dropping message:', type, payload)
      return
    }

    try {
      // Map transport message types to legacy packet names
      const packetName = this._getPacketName(type)
      if (!packetName) {
        console.warn('Unknown message type:', type)
        return
      }

      const packet = writePacket(packetName, payload)
      this.ws.send(packet)
      this._metrics.messagesOut++
      this._metrics.bytesOut += packet.byteLength
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
    }
  }

  sendTo(peerId, type, payload) {
    // Wrap in sendTo packet structure for WebSocket
    this.send(MESSAGE_TYPES.SEND_TO, {
      playerId: peerId,
      name: this._getPacketName(type),
      data: payload
    })
  }

  destroy() {
    super.destroy()
    
    if (this._pingInterval) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
    
    if (this.ws) {
      this.ws.removeEventListener('message', this._onMessage.bind(this))
      this.ws.removeEventListener('close', this._onClose.bind(this))
      this.ws.close()
      this.ws = null
    }
  }

  // Private methods
  _startHeartbeat() {
    // Simple ping/pong to keep connection alive
    this._pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Update RTT measurement
        const start = performance.now()
        this.ws.ping?.() // If ping method exists
        
        // Estimate RTT (simplified)
        this._metrics.rtt = performance.now() - start
      }
    }, 30000) // 30 seconds
  }

  _onMessage(event) {
    try {
      const [packetName, data] = readPacket(event.data)
      const messageType = this._getMessageType(packetName)
      
      if (messageType !== null) {
        this._emit(messageType, data)
      } else {
        console.warn('Unknown packet name:', packetName)
      }
      
      this._metrics.messagesIn++
      this._metrics.bytesIn += event.data.byteLength || event.data.length
      
    } catch (error) {
      console.error('Failed to process WebSocket message:', error)
    }
  }

  _onClose(event) {
    this._emitDisconnect(event.code || 'WebSocket closed')
    
    if (this._pingInterval) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
  }

  // Map between transport message types and legacy packet names
  _getPacketName(messageType) {
    const mapping = {
      [MESSAGE_TYPES.SNAPSHOT]: 'snapshot',
      [MESSAGE_TYPES.CHAT_ADDED]: 'chatAdded',
      [MESSAGE_TYPES.CHAT_CLEARED]: 'chatCleared',
      [MESSAGE_TYPES.BLUEPRINT_ADDED]: 'blueprintAdded',
      [MESSAGE_TYPES.BLUEPRINT_MODIFIED]: 'blueprintModified',
      [MESSAGE_TYPES.ENTITY_ADDED]: 'entityAdded',
      [MESSAGE_TYPES.ENTITY_MODIFIED]: 'entityModified',
      [MESSAGE_TYPES.ENTITY_EVENT]: 'entityEvent',
      [MESSAGE_TYPES.ENTITY_REMOVED]: 'entityRemoved',
      [MESSAGE_TYPES.PLAYER_TELEPORT]: 'playerTeleport',
      [MESSAGE_TYPES.PLAYER_PUSH]: 'playerPush',
      [MESSAGE_TYPES.PLAYER_SESSION_AVATAR]: 'playerSessionAvatar',
      [MESSAGE_TYPES.PLAYER_KICK]: 'kick',
      [MESSAGE_TYPES.TOKEN_METADATA]: 'tokenMetadata',
      [MESSAGE_TYPES.SEND_TO]: 'sendTo',
    }
    return mapping[messageType] || null
  }

  _getMessageType(packetName) {
    const mapping = {
      'snapshot': MESSAGE_TYPES.SNAPSHOT,
      'chatAdded': MESSAGE_TYPES.CHAT_ADDED,
      'chatCleared': MESSAGE_TYPES.CHAT_CLEARED,
      'blueprintAdded': MESSAGE_TYPES.BLUEPRINT_ADDED,
      'blueprintModified': MESSAGE_TYPES.BLUEPRINT_MODIFIED,
      'entityAdded': MESSAGE_TYPES.ENTITY_ADDED,
      'entityModified': MESSAGE_TYPES.ENTITY_MODIFIED,
      'entityEvent': MESSAGE_TYPES.ENTITY_EVENT,
      'entityRemoved': MESSAGE_TYPES.ENTITY_REMOVED,
      'playerTeleport': MESSAGE_TYPES.PLAYER_TELEPORT,
      'playerPush': MESSAGE_TYPES.PLAYER_PUSH,
      'playerSessionAvatar': MESSAGE_TYPES.PLAYER_SESSION_AVATAR,
      'kick': MESSAGE_TYPES.PLAYER_KICK,
      'tokenMetadata': MESSAGE_TYPES.TOKEN_METADATA,
      'sendTo': MESSAGE_TYPES.SEND_TO,
    }
    return mapping[packetName] ?? null
  }
}