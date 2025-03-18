import { useContext } from 'react'
import { WorldContext } from '../WorldContext'

export function useWorld() {
  const world = useContext(WorldContext)
  if (!world) {
    throw new Error('useWorld must be used within a WorldProvider')
  }
  return world
} 