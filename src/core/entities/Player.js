import * as THREE from '../extras/three'

import { PlayerLocal } from '../extras/PlayerLocal'
import { PlayerRemote } from '../extras/PlayerRemote'

import { Entity } from './Entity'

export class Player extends Entity {
  constructor(world, data, local) {
    super(world, data, local)
    if (data.owner === this.world.network.id) {
      this.player = new PlayerLocal(this)
    } else {
      this.player = new PlayerRemote(this)
    }
  }
}
