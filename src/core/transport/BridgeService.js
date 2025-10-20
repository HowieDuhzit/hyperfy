import { SwarmTransport } from './SwarmTransport.js'
import { WSTransport } from './WSTransport.js'
import { MESSAGE_TYPES } from './Transport.js'

/**
 * Bridge Service
 * 
 * Relays messages between WebSocket server and Hyperswarm P2P network.
 * Allows gradual migration where existing servers remain authoritative
 * while clients can connect via P2P.
 */
export class BridgeService {
  constructor() {
    this.wsTransport = null
    this.swarmTransport = null
    this.isRunning = false
    this.messageQueue = []
    this.metrics = {
      messagesRelayed: 0,
      wsToSwarm: 0,
      swarmToWs: 0,
      errors: 0
    }
  }

  /**
   * Start the bridge service
   * @param {Object} config Bridge configuration
   * @param {string} config.wsUrl WebSocket server URL
   * @param {string} config.worldId World ID for P2P topic
   * @param {Array} config.bootstrap Bootstrap nodes for DHT
   */
  async start(config) {
    if (this.isRunning) {
      throw new Error('Bridge service already running')
    }

    try {
      console.log('Starting bridge service...')

      // Initialize WebSocket transport
      this.wsTransport = new WSTransport()
      await this.wsTransport.connect({ wsUrl: config.wsUrl })
      
      // Initialize Hyperswarm transport
      this.swarmTransport = new SwarmTransport()
      await this.swarmTransport.connect({ 
        worldId: config.worldId, 
        bootstrap: config.bootstrap 
      })
      await this.swarmTransport.joinRoom(config.worldId)

      // Set up message relaying
      this._setupMessageRelaying()

      this.isRunning = true
      console.log('Bridge service started successfully')

    } catch (error) {
      console.error('Failed to start bridge service:', error)
      await this.stop()
      throw error
    }
  }

  /**
   * Stop the bridge service
   */
  async stop() {
    if (!this.isRunning) {
      return
    }

    console.log('Stopping bridge service...')

    // Clean up transports
    if (this.wsTransport) {
      this.wsTransport.destroy()
      this.wsTransport = null
    }

    if (this.swarmTransport) {
      this.swarmTransport.destroy()
      this.swarmTransport = null
    }

    this.isRunning = false
    this.messageQueue.length = 0

    console.log('Bridge service stopped')
  }

  /**
   * Get bridge metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      wsMetrics: this.wsTransport?.getMetrics() || {},
      swarmMetrics: this.swarmTransport?.getMetrics() || {}
    }
  }

  /**
   * Set up bidirectional message relaying
   */
  _setupMessageRelaying() {
    // Relay messages from WebSocket to Swarm
    this._setupWSToSwarmRelay()
    
    // Relay messages from Swarm to WebSocket
    this._setupSwarmToWSRelay()

    // Set up peer connection events
    this._setupPeerEvents()
  }

  _setupWSToSwarmRelay() {
    // List of message types that should be relayed from WS to Swarm
    const relayableMessages = [
      MESSAGE_TYPES.ENTITY_ADDED,
      MESSAGE_TYPES.ENTITY_MODIFIED,
      MESSAGE_TYPES.ENTITY_REMOVED,
      MESSAGE_TYPES.ENTITY_EVENT,
      MESSAGE_TYPES.CHAT_ADDED,
      MESSAGE_TYPES.CHAT_CLEARED,
      MESSAGE_TYPES.BLUEPRINT_ADDED,
      MESSAGE_TYPES.BLUEPRINT_MODIFIED,
      MESSAGE_TYPES.PLAYER_TELEPORT,
      MESSAGE_TYPES.PLAYER_PUSH,
      MESSAGE_TYPES.PLAYER_SESSION_AVATAR,
    ]

    for (const messageType of relayableMessages) {
      this.wsTransport.onMessage(messageType, (payload, fromPeer) => {
        try {
          // Relay to all P2P peers
          this.swarmTransport.send(messageType, payload)
          this.metrics.wsToSwarm++
          this.metrics.messagesRelayed++
        } catch (error) {
          console.error('Failed to relay WS->Swarm:', error)
          this.metrics.errors++
        }
      })
    }

    // Handle special snapshot messages (initial world state)
    this.wsTransport.onMessage(MESSAGE_TYPES.SNAPSHOT, (payload, fromPeer) => {
      try {
        // Relay snapshot to P2P peers for world state sync
        this.swarmTransport.send(MESSAGE_TYPES.SNAPSHOT, payload)
        this.metrics.wsToSwarm++
        this.metrics.messagesRelayed++
      } catch (error) {
        console.error('Failed to relay snapshot WS->Swarm:', error)
        this.metrics.errors++
      }
    })
  }

  _setupSwarmToWSRelay() {
    // List of message types that should be relayed from Swarm to WS
    const relayableMessages = [
      MESSAGE_TYPES.ENTITY_MODIFIED, // Player movements, interactions
      MESSAGE_TYPES.ENTITY_EVENT,   // Player events
      MESSAGE_TYPES.CHAT_ADDED,     // Chat messages
    ]

    for (const messageType of relayableMessages) {
      this.swarmTransport.onMessage(messageType, (payload, fromPeer) => {
        try {
          // Only relay certain types of messages back to WebSocket
          // (avoid feedback loops)
          if (this._shouldRelayToWS(messageType, payload, fromPeer)) {
            this.wsTransport.send(messageType, payload)
            this.metrics.swarmToWs++
            this.metrics.messagesRelayed++
          }
        } catch (error) {
          console.error('Failed to relay Swarm->WS:', error)
          this.metrics.errors++
        }
      })
    }
  }

  _setupPeerEvents() {
    // Handle peer join events
    this.swarmTransport.onPeerJoin((peerId) => {
      console.log('P2P peer joined:', peerId)
      // Could notify WebSocket server about new P2P peer
    })

    // Handle peer leave events  
    this.swarmTransport.onPeerLeave((peerId) => {
      console.log('P2P peer left:', peerId)
      // Could notify WebSocket server about peer leaving
    })

    // Handle WebSocket disconnect
    this.wsTransport.onDisconnect((reason) => {
      console.warn('WebSocket disconnected:', reason)
      // Could attempt reconnection or switch to P2P-only mode
    })
  }

  /**
   * Determine if a message should be relayed from Swarm to WS
   * This prevents feedback loops and unnecessary traffic
   */
  _shouldRelayToWS(messageType, payload, fromPeer) {
    switch (messageType) {
      case MESSAGE_TYPES.CHAT_ADDED:
        // Always relay chat messages
        return true
        
      case MESSAGE_TYPES.ENTITY_MODIFIED:
        // Only relay player movements and state changes
        return payload.type === 'player'
        
      case MESSAGE_TYPES.ENTITY_EVENT:
        // Relay player events but not system events
        return !payload.system
        
      default:
        return false
    }
  }
}

/**
 * Create and start a bridge service with default configuration
 */
export async function createBridge(config = {}) {
  const bridge = new BridgeService()
  
  const defaultConfig = {
    wsUrl: 'ws://localhost:3000/ws',
    worldId: 'default',
    bootstrap: [], // Use default DHT bootstrap nodes
    ...config
  }
  
  await bridge.start(defaultConfig)
  return bridge
}

/**
 * Bridge Service CLI for standalone operation
 */
export class BridgeCLI {
  constructor() {
    this.bridge = null
  }

  async start(args) {
    const config = this._parseArgs(args)
    
    this.bridge = new BridgeService()
    await this.bridge.start(config)
    
    // Set up graceful shutdown
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
    
    // Log metrics periodically
    setInterval(() => {
      const metrics = this.bridge.getMetrics()
      console.log('Bridge metrics:', metrics)
    }, 30000) // Every 30 seconds
    
    console.log('Bridge service running. Press Ctrl+C to stop.')
  }

  async shutdown() {
    if (this.bridge) {
      await this.bridge.stop()
      this.bridge = null
    }
    process.exit(0)
  }

  _parseArgs(args) {
    const config = {
      wsUrl: 'ws://localhost:3000/ws',
      worldId: 'default',
      bootstrap: []
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      switch (arg) {
        case '--ws-url':
          config.wsUrl = args[++i]
          break
        case '--world-id':
          config.worldId = args[++i]
          break
        case '--bootstrap':
          config.bootstrap = args[++i].split(',')
          break
      }
    }

    return config
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new BridgeCLI()
  cli.start(process.argv.slice(2))
}