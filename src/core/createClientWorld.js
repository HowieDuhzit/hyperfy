import { World } from './World'

import { Client } from './systems/Client'
import { ClientPointer } from './systems/ClientPointer'
import { ClientPrefs } from './systems/ClientPrefs'
import { ClientControls } from './systems/ClientControls'
import { ClientNetwork } from './systems/ClientNetwork'
import { ClientLoader } from './systems/ClientLoader'
import { ClientLoaderV2 } from './systems/ClientLoaderV2'
import { ClientGraphics } from './systems/ClientGraphics'
import { ClientEnvironment } from './systems/ClientEnvironment'
import { ClientAudio } from './systems/ClientAudio'
import { ClientStats } from './systems/ClientStats'
import { ClientBuilder } from './systems/ClientBuilder'
import { ClientActions } from './systems/ClientActions'
import { ClientTarget } from './systems/ClientTarget'
import { LODs } from './systems/LODs'
import { Nametags } from './systems/Nametags'
import { Snaps } from './systems/Snaps'
import { XR } from './systems/XR'
import { Solana } from './systems/ClientSolana'

export function createClientWorld() {
  const world = new World()
  world.register('client', Client)
  world.register('pointer', ClientPointer)
  world.register('prefs', ClientPrefs)
  world.register('controls', ClientControls)
  world.register('network', ClientNetwork)
  // Use V2 loader for P2P asset support
  const useV2Loader = typeof window !== 'undefined' && window.localStorage && 
                      localStorage.getItem('hyperfy_use_loader_v2') === 'true'
  world.register('loader', useV2Loader ? ClientLoaderV2 : ClientLoader)
  world.register('graphics', ClientGraphics)
  world.register('environment', ClientEnvironment)
  world.register('audio', ClientAudio)
  world.register('stats', ClientStats)
  world.register('builder', ClientBuilder)
  world.register('actions', ClientActions)
  world.register('target', ClientTarget)
  world.register('lods', LODs)
  world.register('nametags', Nametags)
  world.register('snaps', Snaps)
  world.register('xr', XR)
  world.register('solana', Solana)
  return world
}
