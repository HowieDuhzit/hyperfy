import { WSTransport } from './WSTransport.js'

// Transport type constants
export const TRANSPORT_TYPES = {
  WEBSOCKET: 'websocket',
  HYPERSWARM: 'hyperswarm',
}

/**
 * Transport Factory
 * 
 * Creates transport instances based on configuration.
 * Supports feature flags for gradual migration from WebSocket to P2P.
 */
export class TransportFactory {
  /**
   * Create a transport instance
   * @param {string} type Transport type (TRANSPORT_TYPES.WEBSOCKET | TRANSPORT_TYPES.HYPERSWARM)
   * @param {Object} config Transport-specific configuration
   * @returns {Transport} Transport instance
   */
  static create(type, config = {}) {
    switch (type) {
      case TRANSPORT_TYPES.WEBSOCKET:
        return new WSTransport()
      
      case TRANSPORT_TYPES.HYPERSWARM:
        // Dynamic import to avoid bundling Hyperswarm in WebSocket builds
        return import('./SwarmTransport.js').then(module => {
          const { SwarmTransport } = module
          return new SwarmTransport()
        })
      
      default:
        throw new Error(`Unknown transport type: ${type}`)
    }
  }

  /**
   * Get transport type from configuration
   * @param {Object} config Application configuration
   * @returns {string} Transport type
   */
  static getTransportType(config) {
    // Feature flag support - check for transport override
    const transportOverride = config.TRANSPORT_TYPE || 
                             globalThis.localStorage?.getItem('hyperfy_transport_type') ||
                             globalThis.process?.env?.HYPERFY_TRANSPORT_TYPE
    
    if (transportOverride) {
      return transportOverride.toLowerCase()
    }

    // Check if we're in Pear environment
    const isPear = typeof globalThis.Pear !== 'undefined'
    
    // Default logic
    if (isPear && config.enableP2P) {
      return TRANSPORT_TYPES.HYPERSWARM
    }
    
    return TRANSPORT_TYPES.WEBSOCKET
  }

  /**
   * Create transport with automatic type detection
   * @param {Object} config Application configuration
   * @returns {Promise<Transport>} Transport instance
   */
  static async createAuto(config) {
    const type = TransportFactory.getTransportType(config)
    const transport = TransportFactory.create(type, config)
    
    // Handle async transport creation (e.g., dynamic imports)
    return await transport
  }
}