import { System } from './System'

export class Collections extends System {
  constructor(world) {
    super(world)
    this.collections = []
  }

  get(id) {
    return this.collections.find(coll => coll.id === id)
  }

  getAll() {
    return this.collections
  }

  deserialize(data) {
    this.collections = data
  }

  serialize() {
    return this.collections
  }

  destroy() {
    this.collections = []
  }
}
