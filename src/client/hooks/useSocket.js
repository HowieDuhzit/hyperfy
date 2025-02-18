import { useState, useEffect } from 'react'
import { writePacket } from '../../core/packets'

export function useSocket() {
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    // Get the socket from the world instance
    const worldSocket = window.world?.network
    if (worldSocket) {
      // Create a wrapper object with event emitter interface
      const socketWrapper = {
        _listeners: new Map(),
        on(event, callback) {
          const method = `on${event.charAt(0).toUpperCase() + event.slice(1)}`
          if (!this._listeners.has(method)) {
            this._listeners.set(method, new Set())
          }
          this._listeners.get(method).add(callback)
          
          // Add method to network if it doesn't exist
          if (!worldSocket[method]) {
            worldSocket[method] = (data) => {
              const listeners = this._listeners.get(method)
              if (listeners) {
                listeners.forEach(cb => cb(data))
              }
            }
          }
        },
        off(event, callback) {
          const method = `on${event.charAt(0).toUpperCase() + event.slice(1)}`
          const listeners = this._listeners.get(method)
          if (listeners) {
            listeners.delete(callback)
          }
        },
        emit(event, data) {
          // Convert event name to packet name (e.g. 'file:list' -> 'fileList')
          const packetName = event.replace(/:/g, '').replace(/\b\w/g, c => c.toUpperCase())
          worldSocket.send(packetName.charAt(0).toLowerCase() + packetName.slice(1), data)
        }
      }

      setSocket(socketWrapper)
    }

    return () => {
      setSocket(null)
    }
  }, [])

  return socket
} 