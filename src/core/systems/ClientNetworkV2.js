import { emoteUrls } from '../extras/playerEmotes'
import { hashFile } from '../utils-client'
import { System } from './System'
import { TransportFactory, TRANSPORT_TYPES } from '../transport/TransportFactory'
import { MESSAGE_TYPES } from '../transport/Transport'

/**
 * Client Network System V2
 *
 * - runs on the client
 * - uses Transport interface for network abstraction
 * - supports both WebSocket and P2P transports
 *
 */
export class ClientNetworkV2 extends System {
  constructor(world) {
    super(world)
    this.ids = -1
    this.transport = null
    this.apiUrl = null
    this.id = null
    this.isClient = true
    this.queue = []
    this.serverTimeOffset = 0
    this.maxUploadSize = 0
    this._cleanupHandlers = []
  }

  async init({ wsUrl, apiUrl, config = {} }) {
    try {
      // Create appropriate transport
      this.transport = await TransportFactory.createAuto({
        wsUrl,
        apiUrl,
        ...config
      })

      // Set up message handlers
      this._setupMessageHandlers()

      // Connect to transport
      await this.transport.connect({ wsUrl })

      // Join the world room (P2P only, WebSocket ignores this)
      await this.transport.joinRoom('default', null)

      console.log('ClientNetwork connected via:', this.transport.constructor.name)

    } catch (error) {
      console.error('Failed to initialize ClientNetwork:', error)
      throw error
    }
  }

  preFixedUpdate() {
    this.flush()
  }

  send(name, data) {
    const messageType = this._getMessageTypeFromLegacyName(name)
    if (messageType !== null) {
      this.transport.send(messageType, data)
    } else {
      console.warn('Unknown message name:', name)
    }
  }

  sendTo(playerId, name, data) {
    const messageType = this._getMessageTypeFromLegacyName(name)
    if (messageType !== null) {
      this.transport.sendTo(playerId, messageType, data)
    } else {
      console.warn('Unknown message name:', name)
    }
  }

  async upload(file) {
    // File upload still goes through HTTP API regardless of transport
    // In Phase 2.E, this will be replaced with Hyperdrive
    
    {
      // first check if we even need to upload it
      const hash = await hashFile(file)
      const ext = file.name.split('.').pop().toLowerCase()
      const filename = `${hash}.${ext}`
      const url = `${this.apiUrl}/upload-check?filename=${filename}`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.exists) return // console.log('already uploaded:', filename)
    }
    // then upload it
    const form = new FormData()
    form.append('file', file)
    const url = `${this.apiUrl}/upload`
    await fetch(url, {
      method: 'POST',
      body: form,
    })
  }

  enqueue(method, data) {
    this.queue.push([method, data])
  }

  flush() {
    while (this.queue.length) {
      try {
        const [method, data] = this.queue.shift()
        this[method]?.(data)
      } catch (err) {
        console.error(err)
      }
    }
  }

  getTime() {
    return (performance.now() + this.serverTimeOffset) / 1000 // seconds
  }

  getMetrics() {
    return this.transport?.getMetrics() || {}
  }

  destroy() {
    // Clean up handlers
    this._cleanupHandlers.forEach(cleanup => cleanup())
    this._cleanupHandlers.length = 0

    // Clean up transport
    if (this.transport) {
      this.transport.destroy()
      this.transport = null
    }
  }

  // Private methods
  _setupMessageHandlers() {
    // Set up handlers for all message types
    const handlers = [
      [MESSAGE_TYPES.SNAPSHOT, (data) => this.enqueue('onSnapshot', data)],
      [MESSAGE_TYPES.CHAT_ADDED, (data) => this.enqueue('onChatAdded', data)],
      [MESSAGE_TYPES.CHAT_CLEARED, (data) => this.enqueue('onChatCleared', data)],
      [MESSAGE_TYPES.BLUEPRINT_ADDED, (data) => this.enqueue('onBlueprintAdded', data)],
      [MESSAGE_TYPES.BLUEPRINT_MODIFIED, (data) => this.enqueue('onBlueprintModified', data)],
      [MESSAGE_TYPES.ENTITY_ADDED, (data) => this.enqueue('onEntityAdded', data)],
      [MESSAGE_TYPES.ENTITY_MODIFIED, (data) => this.enqueue('onEntityModified', data)],
      [MESSAGE_TYPES.ENTITY_EVENT, (data) => this.enqueue('onEntityEvent', data)],
      [MESSAGE_TYPES.ENTITY_REMOVED, (data) => this.enqueue('onEntityRemoved', data)],
      [MESSAGE_TYPES.PLAYER_TELEPORT, (data) => this.enqueue('onPlayerTeleport', data)],
      [MESSAGE_TYPES.PLAYER_PUSH, (data) => this.enqueue('onPlayerPush', data)],
      [MESSAGE_TYPES.PLAYER_SESSION_AVATAR, (data) => this.enqueue('onPlayerSessionAvatar', data)],
      [MESSAGE_TYPES.PLAYER_KICK, (data) => this.enqueue('onKick', data)],
      [MESSAGE_TYPES.TOKEN_METADATA, (data) => this.enqueue('onTokenMetadata', data)],
    ]

    for (const [messageType, handler] of handlers) {
      const cleanup = this.transport.onMessage(messageType, handler)
      this._cleanupHandlers.push(cleanup)
    }

    // Disconnect handler
    const disconnectCleanup = this.transport.onDisconnect((reason) => {
      this.enqueue('onClose', reason)
    })
    this._cleanupHandlers.push(disconnectCleanup)
  }

  _getMessageTypeFromLegacyName(name) {
    // Map legacy packet names to message types
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
    return mapping[name] ?? null
  }

  // Legacy message handlers (keep the same API)
  onSnapshot(data) {
    this.id = data.id
    this.serverTimeOffset = data.serverTime - performance.now()
    this.apiUrl = data.apiUrl
    this.maxUploadSize = data.maxUploadSize
    this.world.assetsUrl = data.assetsUrl

    // preload some blueprints
    for (const item of data.blueprints) {
      if (item.preload) {
        if (item.model) {
          const type = item.model.endsWith('.vrm') ? 'avatar' : 'model'
          this.world.loader.preload(type, item.model)
        }
        if (item.script) {
          this.world.loader.preload('script', item.script)
        }
        for (const value of Object.values(item.props || {})) {
          if (value === undefined || value === null || !value?.url || !value?.type) continue
          this.world.loader.preload(value.type, value.url)
        }
      }
    }
    // preload emotes
    for (const url of emoteUrls) {
      this.world.loader.preload('emote', url)
    }
    // preload local player avatar
    for (const item of data.entities) {
      if (item.type === 'player' && item.owner === this.id) {
        const url = item.sessionAvatar || item.avatar || 'asset://avatar.vrm'
        this.world.loader.preload('avatar', url)
      }
    }
    this.world.loader.execPreload()

    this.world.chat.deserialize(data.chat)
    this.world.blueprints.deserialize(data.blueprints)
    this.world.entities.deserialize(data.entities)
    
    // Store auth token (for WebSocket compatibility)
    if (data.authToken && typeof globalThis.localStorage !== 'undefined') {
      localStorage.setItem('authToken', data.authToken)
    }
  }

  onChatAdded = msg => {
    this.world.chat.add(msg, false)
  }

  onChatCleared = () => {
    this.world.chat.clear()
  }

  onBlueprintAdded = blueprint => {
    this.world.blueprints.add(blueprint)
  }

  onBlueprintModified = change => {
    this.world.blueprints.modify(change)
  }

  onEntityAdded = data => {
    this.world.entities.add(data)
  }

  onEntityModified = data => {
    const entity = this.world.entities.get(data.id)
    if (!entity) return console.error('onEntityModified: no entity found', data)
    entity.modify(data)
  }

  onEntityEvent = event => {
    const [id, version, name, data] = event
    const entity = this.world.entities.get(id)
    entity?.onEvent(version, name, data)
  }

  onEntityRemoved = id => {
    this.world.entities.remove(id)
  }

  onPlayerTeleport = data => {
    this.world.entities.player?.teleport(data)
  }

  onPlayerPush = data => {
    this.world.entities.player?.push(data.force)
  }

  onPlayerSessionAvatar = data => {
    this.world.entities.player?.setSessionAvatar(data.avatar)
  }

  onKick = code => {
    this.world.emit('kick', code)
  }

  onTokenMetadata = ({ tokenMint, metadata }) => {
    console.log(`Received metadata for token: ${tokenMint}`, metadata)

    // Get the Solana system
    const solana = this.world.solana
    if (!solana) {
      console.error('Solana system not initialized')
      return
    }

    solana.tokens.set(tokenMint, metadata)
  }

  onClose = code => {
    this.world.emit('disconnect', code || true)
    console.log('disconnect', code)
  }
}