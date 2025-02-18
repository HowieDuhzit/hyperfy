/*
 * HyperFone App Template
 * Use this template as a starting point for building apps for the HyperFone app store
 */

import { css } from '@firebolt-dev/css'
import { useState, useEffect, useRef } from 'react'
import { hyperFoneOS } from '../hyperfoneOS'

// Required app store metadata - must be included for app store submission
const APP_STORE_INFO = {
  // Unique identifier for your app
  id: 'your.app.id',
  
  // App store display name
  name: 'Your App Name',
  
  // App version following semver
  version: '1.0.0',
  
  // Short description for app store listing
  description: 'A brief description of your app',
  
  // Developer/company name
  author: 'Your Name',
  
  // App icon (emoji or URL)
  icon: '🚀',
  
  // App category for store organization
  category: 'utilities', // utilities, social, games, productivity, entertainment
  
  // Required permissions
  permissions: [], // e.g. ['storage', 'notifications', 'camera']
  
  // Supported devices/screen sizes
  supportedDevices: ['phone', 'tablet'],
  
  // Minimum OS version required
  minOSVersion: '1.0.0',
  
  // Keywords for app store search
  keywords: ['app', 'template'],
  
  // App store screenshots
  screenshots: [
    // Add screenshot URLs
  ],
  
  // Optional app website
  website: '',
  
  // Optional support contact
  support: '',
  
  // Optional privacy policy URL
  privacyPolicy: '',
  
  // Optional terms of service URL
  termsOfService: ''
}

export function AppTemplate() {
  // Access HyperFone OS features
  const [isDarkMode, setIsDarkMode] = useState(hyperFoneOS.state.isDarkMode)
  const [notifications, setNotifications] = useState([])
  const [isLocked, setIsLocked] = useState(hyperFoneOS.state.isLocked)
  
  // App state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Load app data and handle OS events
  useEffect(() => {
    // Listen for OS theme changes
    const handleThemeChange = () => {
      setIsDarkMode(hyperFoneOS.state.isDarkMode)
    }
    hyperFoneOS.on('themeChanged', handleThemeChange)
    
    // Listen for OS lock state
    const handleLockChange = () => {
      setIsLocked(hyperFoneOS.state.isLocked)
    }
    hyperFoneOS.on('lockStateChanged', handleLockChange)
    
    // Listen for notifications
    const handleNotification = (notification) => {
      setNotifications(prev => [...prev, notification])
    }
    hyperFoneOS.on('notification', handleNotification)
    
    // Initialize app
    const initApp = async () => {
      try {
        // Load saved data
        const savedData = localStorage.getItem(`hyperfone_${APP_STORE_INFO.id}_data`)
        if (savedData) {
          // Initialize with saved data
        }
        
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to initialize app:', err)
        setError('Failed to load app data')
        setIsLoading(false)
      }
    }
    
    initApp()
    
    // Cleanup
    return () => {
      hyperFoneOS.off('themeChanged', handleThemeChange)
      hyperFoneOS.off('lockStateChanged', handleLockChange)
      hyperFoneOS.off('notification', handleNotification)
    }
  }, [])

  // Handle app suspension/resume
  useEffect(() => {
    const handleSuspend = () => {
      // Save app state
      console.log('App suspended')
    }
    
    const handleResume = () => {
      // Restore app state
      console.log('App resumed')
    }
    
    hyperFoneOS.on('suspend', handleSuspend)
    hyperFoneOS.on('resume', handleResume)
    
    return () => {
      hyperFoneOS.off('suspend', handleSuspend)
      hyperFoneOS.off('resume', handleResume)
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: white;
      `}>
        Loading...
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 20px;
        padding: 20px;
        color: #ff4444;
      `}>
        <div>{error}</div>
        <button
          onClick={() => setError(null)}
          css={css`
            background: #551bf9;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            
            &:hover {
              opacity: 0.9;
            }
          `}
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
      color: ${isDarkMode ? '#ffffff' : '#000000'};
    `}>
      {/* App Header - Required for app store recognition */}
      <div css={css`
        padding: 15px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `}>
        <div css={css`
          display: flex;
          align-items: center;
          gap: 10px;
        `}>
          <span css={css`font-size: 24px;`}>{APP_STORE_INFO.icon}</span>
          <h1 css={css`
            margin: 0;
            font-size: 18px;
            font-weight: 500;
          `}>
            {APP_STORE_INFO.name}
          </h1>
        </div>

        {/* Optional app actions */}
        <div css={css`
          display: flex;
          gap: 10px;
        `}>
          <button
            onClick={() => hyperFoneOS.openSettings()}
            css={css`
              background: none;
              border: none;
              color: ${isDarkMode ? 'white' : 'black'};
              cursor: pointer;
              padding: 8px;
              font-size: 20px;
              opacity: 0.6;
              
              &:hover {
                opacity: 1;
              }
            `}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div css={css`
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        
        &::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        &::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        
        &::-webkit-scrollbar-thumb {
          background: rgba(85, 27, 249, 0.3);
          border-radius: 3px;
          
          &:hover {
            background: rgba(85, 27, 249, 0.5);
          }
        }
      `}>
        {/* Add your app content here */}
        <div css={css`
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          padding: 20px;
        `}>
          <h2 css={css`
            margin: 0 0 10px 0;
            font-size: 16px;
            font-weight: 500;
          `}>
            Welcome to {APP_STORE_INFO.name}
          </h2>
          <p css={css`
            color: ${isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'};
            font-size: 14px;
            margin: 0;
          `}>
            {APP_STORE_INFO.description}
          </p>
        </div>
      </div>
    </div>
  )
}

// Export app store info for the app store
AppTemplate.APP_STORE_INFO = APP_STORE_INFO 