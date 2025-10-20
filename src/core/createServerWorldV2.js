import { World } from './World.js'

import { Server } from './systems/Server.js'
import { ServerNetworkV2 } from './systems/ServerNetworkV2.js'
import { ServerLoader } from './systems/ServerLoader.js'
import { Solana } from './systems/ServerSolana.js'

/**
 * Create server world with storage abstraction support
 * 
 * This version supports both file-based and P2P storage through
 * the Storage interface abstraction.
 */
export function createServerWorldV2() {
  const world = new World()
  world.register('server', Server)
  world.register('network', ServerNetworkV2)
  world.register('loader', ServerLoader)
  world.register('solana', Solana)
  return world
}