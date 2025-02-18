import { css } from '@firebolt-dev/css'
import React, { useState, useEffect, useRef } from 'react'

// App metadata
const APP_INFO = {
  id: 'screen-share',
  name: 'Screen Share',
  version: '1.0.0',
  description: 'Share your PC screen, app windows or camera on your HyperFone',
  author: 'HyperFone',
  icon: '📱',
  category: 'utilities',
  permissions: ['screen-capture', 'camera'],
}

// Default configuration
const DEFAULT_CONFIG = {
  theme: {
    primary: '#551bf9',
    background: '#1a1a1a', 
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
    error: '#ff4444',
  },
  settings: {
    preferredSource: null,
    frameRate: 30,
    quality: 'high'
  }
}

export const ScreenShare = ({ onClose }) => {
  const [isSharing, setIsSharing] = useState(false)

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      // Handle screen sharing stream
      setIsSharing(true)
    } catch (err) {
      console.error('Error starting screen share:', err)
    }
  }

  const stopSharing = () => {
    setIsSharing(false)
    // Clean up screen sharing
  }

  useEffect(() => {
    return () => {
      stopSharing()
    }
  }, [])

  return (
    <div className="screen-share-app">
      <h2>Screen Share</h2>
      <button onClick={isSharing ? stopSharing : startSharing}>
        {isSharing ? 'Stop Sharing' : 'Start Sharing'}
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  )
} 