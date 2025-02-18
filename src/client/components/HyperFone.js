import { css } from '@firebolt-dev/css'
import React, { useState, useEffect, Suspense, useTransition, startTransition } from 'react'
import { hyperFoneOS } from './hyperfoneOS'

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('HyperFone Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div css={css`
          padding: 20px;
          color: ${this.props.theme?.error || '#ff0000'};
          background: rgba(0, 0, 0, 0.8);
          border-radius: 8px;
        `}>
          <h3>Something went wrong</h3>
          <p>{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            css={css`
              padding: 8px 16px;
              background: ${this.props.theme?.primary || '#ffffff'}22;
              border: 1px solid ${this.props.theme?.primary || '#ffffff'};
              color: ${this.props.theme?.text || '#ffffff'};
              border-radius: 4px;
              cursor: pointer;
              margin-top: 10px;
              &:hover {
                background: ${this.props.theme?.primary || '#ffffff'}33;
              }
            `}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Loading fallback
const LoadingFallback = () => (
  <div css={css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
  `}>
    Loading...
  </div>
)

// Lazy load components with retry mechanism
function lazyWithRetry(componentImport) {
  return React.lazy(() => 
    componentImport().catch(error => {
      console.error('Failed to load component:', error)
      return new Promise(resolve => 
        setTimeout(() => resolve(componentImport()), 1000)
      )
    })
  )
}

// Import core components
const StatusBar = lazyWithRetry(() => import('./hyperfone_core/StatusBar').then(m => ({ default: m.StatusBar })))
const LockScreen = lazyWithRetry(() => import('./hyperfone_core/LockScreen').then(m => ({ default: m.LockScreen })))
const HomeScreen = lazyWithRetry(() => import('./hyperfone_core/HomeScreen').then(m => ({ default: m.HomeScreen })))

// Import system apps
const Settings = lazyWithRetry(() => import('./hyperfone_core/Settings').then(m => ({ default: m.Settings })))
const AppStore = lazyWithRetry(() => import('./hyperfone_core/AppStore').then(m => ({ default: m.AppStore })))
const WalletApp = lazyWithRetry(() => import('./hyperfone_core/WalletApp').then(m => ({ default: m.WalletApp })))
const ChatApp = lazyWithRetry(() => import('./hyperfone_core/ChatApp').then(m => ({ default: m.ChatApp })))
const WebBrowser = lazyWithRetry(() => import('./hyperfone_core/WebBrowser').then(m => ({ default: m.WebBrowser })))
const InventoryApp = lazyWithRetry(() => import('./hyperfone_core/InventoryApp').then(m => ({ default: m.InventoryApp })))
// const ScreenShare = lazyWithRetry(() => import('./hyperfone_apps/ScreenShare').then(m => ({ default: m.ScreenShare })))
const DeveloperApp = lazyWithRetry(() => import('./hyperfone_core/DeveloperApp').then(m => ({ default: m.DeveloperApp })))

export function HyperFone({ world, user, setUser }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [osState, setOSState] = useState(hyperFoneOS.state)
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 620 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDraggable, setIsDraggable] = useState(true)
  const [opacity, setOpacity] = useState(100)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationSettings, setAnimationSettings] = useState({
    duration: 1000,
    curve: 'bounce',
    rotation: true
  })

  // Load animation settings
  useEffect(() => {
    const saved = localStorage.getItem('hyperfy_animation_settings')
    if (saved) {
      setAnimationSettings(JSON.parse(saved))
    }
  }, [])

  // Get animation curve based on setting
  const getAnimationCurve = () => {
    switch (animationSettings.curve) {
      case 'linear': return 'cubic-bezier(0, 0, 1, 1)'
      case 'ease': return 'cubic-bezier(0.4, 0, 0.2, 1)'
      case 'bounce': return 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      case 'snap': return 'cubic-bezier(0.4, 0, 0.6, 1)'
      default: return 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  }

  // Handle opening and closing animations with transition
  const handleOpenClose = (shouldOpen) => {
    startTransition(() => {
      setIsAnimating(true)
      if (!shouldOpen) {
        setTimeout(() => {
          setIsOpen(false)
          setIsAnimating(false)
        }, animationSettings.duration)
      } else {
        setIsOpen(true)
        setTimeout(() => {
          setIsAnimating(false)
        }, animationSettings.duration)
      }
    })
  }

  // Handle drag start
  const handleMouseDown = (e) => {
    if (!isDraggable) return
    if (e.target.closest('.top-bar')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  // Handle drag
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Add and remove event listeners
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isOpen, isDragging, dragOffset])

  // Subscribe to OS state changes
  useEffect(() => {
    const handleStateChange = (newState) => {
      console.log('State changed:', newState);
      setOSState(prevState => ({...prevState, ...newState}));
    };
    
    hyperFoneOS.onStateChange = handleStateChange;
    
    return () => {
      hyperFoneOS.onStateChange = null;
    };
  }, []);

  // Get current theme and wallpaper
  const currentTheme = hyperFoneOS.getCurrentTheme()
  const currentWallpaper = hyperFoneOS.getCurrentWallpaper()

  // Wrap app content in Suspense and ErrorBoundary
  const renderAppContent = () => {
    return (
      <ErrorBoundary theme={currentTheme}>
        <Suspense fallback={<LoadingFallback />}>
          {(() => {
            if (osState.isLocked) {
              return (
                <LockScreen 
                  theme={currentTheme}
                  onUnlock={() => hyperFoneOS.unlock()}
                  setIsOpen={setIsOpen}
                />
              )
            }

            if (!osState.activeApp) {
              return (
                <HomeScreen 
                  theme={currentTheme}
                  setActiveApp={(appId) => startTransition(() => hyperFoneOS.launchApp(appId))}
                  installedApps={osState.installedApps}
                  layout={osState.homeScreenLayout}
                  hiddenApps={osState.hiddenApps}
                  setIsOpen={setIsOpen}
                />
              )
            }

            const activeApp = osState.installedApps[osState.activeApp]
            if (!activeApp) return null

            const AppComponent = (() => {
              switch (osState.activeApp) {
                case 'settings': return Settings
                case 'developer': return DeveloperApp
                case 'appstore': return AppStore
                case 'wallet': return WalletApp
                case 'chat': return ChatApp
                case 'browser': return WebBrowser
                case 'inventory': return InventoryApp
                default: return null
              }
            })()

            if (AppComponent) {
              return (
                <AppComponent 
                  theme={currentTheme}
                  {...(osState.activeApp === 'settings' ? {
                    currentTheme: osState.currentTheme,
                    setCurrentTheme: (theme) => startTransition(() => hyperFoneOS.setState({ currentTheme: theme })),
                    currentWallpaper: osState.currentWallpaper,
                    setCurrentWallpaper: (wallpaper) => startTransition(() => hyperFoneOS.setState({ currentWallpaper: wallpaper })),
                    customThemes: osState.customThemes,
                    addCustomTheme: hyperFoneOS.addCustomTheme,
                    removeCustomTheme: hyperFoneOS.removeCustomTheme,
                    customWallpapers: osState.customWallpapers,
                    addCustomWallpaper: hyperFoneOS.addCustomWallpaper,
                    removeCustomWallpaper: hyperFoneOS.removeCustomWallpaper,
                    isDraggable,
                    setIsDraggable,
                    opacity,
                    setOpacity,
                    setIsOpen,
                    handleOpenClose,
                    animationSettings,
                    setAnimationSettings
                  } : {})}
                />
              )
            }

            if (activeApp.sourceCode) {
              return (
                <div css={css`
                  height: 100%;
                  overflow: auto;
                `}>
                  {(() => {
                    try {
                      const DynamicApp = new Function('React', 'theme', `
                        ${activeApp.sourceCode}
                        return App;
                      `)(React, currentTheme)
                      
                      return <DynamicApp theme={currentTheme} />
                    } catch (err) {
                      console.error('Failed to render app:', err)
                      return (
                        <div css={css`
                          padding: 20px;
                          color: ${currentTheme.error};
                        `}>
                          Failed to load app: {err.message}
                        </div>
                      )
                    }
                  })()}
                </div>
              )
            }

            return null
          })()}
        </Suspense>
      </ErrorBoundary>
    )
  }

  if (!isOpen) {
    return (
      <button
        css={css`
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 60px;
          height: 60px;
          border-radius: 4px;
          background: ${currentTheme.primary}22;
          border: 1px solid ${currentTheme.primary};
          color: ${currentTheme.primary};
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform ${animationSettings.duration}ms ${getAnimationCurve()};
          box-shadow: 
            0 0 10px ${currentTheme.primary}44,
            inset 0 0 20px ${currentTheme.primary}22;
          z-index: 1000;
          pointer-events: auto;
          opacity: ${isAnimating ? 0 : 1};
          transform: ${isAnimating ? 
            `scale(0.1) ${animationSettings.rotation ? 'rotate(-10deg)' : ''} translateY(500px)` : 
            'scale(1) rotate(0deg) translateY(0)'
          };
          
          &:hover {
            background: ${currentTheme.primary}33;
            box-shadow: 
              0 0 20px ${currentTheme.primary}66,
              inset 0 0 30px ${currentTheme.primary}33;
            border-color: ${currentTheme.primary}dd;
          }
        `}
        onClick={() => handleOpenClose(true)}
      >
        <div css={css`
          font-size: 28px;
          background: linear-gradient(135deg, ${currentTheme.primary}, ${currentTheme.text});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 2px ${currentTheme.primary}66);
        `}>
          ⚡
        </div>
      </button>
    )
  }

  return (
    <div 
      onMouseDown={handleMouseDown}
      css={css`
        position: fixed;
        left: ${position.x}px;
        top: ${position.y}px;
        width: 800px;
        height: 600px;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 
          0 0 40px rgba(0, 0, 0, 0.6),
          0 0 100px ${currentTheme.primary}22,
          inset 0 0 20px ${currentTheme.primary}11;
        z-index: 1000;
        pointer-events: auto;
        backdrop-filter: blur(20px);
        border: 1px solid ${currentTheme.border};
        user-select: none;
        cursor: ${isDragging ? 'grabbing' : 'default'};
        background: url(${currentWallpaper.url});
        background-size: cover;
        background-position: center;
        opacity: ${Math.max(0.2, Math.min(1, opacity / 100))};
        transition: transform ${animationSettings.duration}ms ${getAnimationCurve()}, opacity ${animationSettings.duration}ms ease;
        transform-origin: bottom right;
        transform: ${isAnimating ? 
          (isOpen ? 
            'scale(1) rotate(0deg) translateY(0)' : 
            `scale(0.1) ${animationSettings.rotation ? 'rotate(-10deg)' : ''} translateY(500px)`
          ) : 
          'scale(1) rotate(0deg) translateY(0)'
        };
      `}
    >
      {/* Theme Overlay */}
      <div css={css`
        position: absolute;
        inset: 0;
        background: ${currentTheme.background};
        opacity: 0.8;
        z-index: 1;
        pointer-events: none;
      `} />

      {/* Status Bar with tech accents */}
      <div className="top-bar" css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        cursor: ${isDragging ? 'grabbing' : 'grab'};
        z-index: 10;
      `} />

      <StatusBar 
        theme={currentTheme}
        batteryLevel={osState.batteryLevel}
        isCharging={osState.isCharging}
        currentTime={osState.currentTime}
      />

      {/* Main Content */}
      <div css={css`
        flex: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
        z-index: 4;
        margin: 2px;
        border-radius: 10px;
        background: ${currentTheme.background}22;
        box-shadow: inset 0 0 20px ${currentTheme.primary}11;
      `}>
        {renderAppContent()}
      </div>

      {/* Bottom Navigation Bar */}
      {!osState.isLocked && osState.activeApp && (
        <div css={css`
          height: 60px;
          background: ${currentTheme.background}aa;
          backdrop-filter: blur(10px);
          border-top: 1px solid ${currentTheme.primary}22;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px;
          z-index: 3;
          position: relative;

          &:before {
            content: '';
            position: absolute;
            left: 20px;
            right: 20px;
            bottom: 0;
            height: 2px;
            background: linear-gradient(
              to right,
              transparent,
              ${currentTheme.primary},
              transparent
            );
            opacity: 0.5;
          }
        `}>
          <button
            onClick={() => hyperFoneOS.closeApp()}
            css={css`
              background: none;
              border: 1px solid ${currentTheme.primary}44;
              color: ${currentTheme.text};
              font-size: 14px;
              cursor: pointer;
              padding: 8px 16px;
              border-radius: 4px;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: all 0.2s ease;
              
              &:hover {
                background: ${currentTheme.primary}22;
                border-color: ${currentTheme.primary};
                box-shadow: 0 0 10px ${currentTheme.primary}44;
              }
            `}
          >
            ← Back
          </button>
          
          <button
            onClick={() => {
              hyperFoneOS.closeApp()
              handleOpenClose(false)
              hyperFoneOS.lock()
            }}
            data-power-off="true"
            css={css`
              background: ${currentTheme.primary}22;
              border: 1px solid ${currentTheme.primary}44;
              color: ${currentTheme.text};
              font-size: 14px;
              cursor: pointer;
              padding: 8px 16px;
              border-radius: 4px;
              transition: all 0.2s ease;
              
              &:hover {
                background: ${currentTheme.primary}33;
                border-color: ${currentTheme.primary};
                box-shadow: 0 0 10px ${currentTheme.primary}44;
              }
            `}
          >
            Power Off
          </button>
        </div>
      )}
    </div>
  )
} 