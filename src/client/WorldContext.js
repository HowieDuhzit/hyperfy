import { createContext } from 'react'

export const WorldContext = createContext(null)

export function WorldProvider({ world, children }) {
  return (
    <WorldContext.Provider value={world}>
      {children}
    </WorldContext.Provider>
  )
} 