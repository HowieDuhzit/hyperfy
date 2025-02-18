import { useState, useEffect } from 'react'
import { themes, defaultWallpaper } from './hyperfone_core/themes'

// Core OS functionality
export class HyperFoneOS {
  constructor() {
    // Clear existing data
    localStorage.removeItem('hyperfy_installed_apps')
    localStorage.removeItem('hyperfy_home_layout')
    
    this.state = {
      isLocked: true,
      activeApp: null,
      batteryLevel: 100,
      isCharging: false,
      currentTime: new Date(),
      currentTheme: 'hyperfy',
      currentWallpaper: 'default',
      customThemes: {},
      customWallpapers: {},
      isDarkMode: true,
      hiddenApps: ['settings'],
      isDeveloperMode: false,
      showWorldInspector: false,
      showObjectBounds: false,
      showPerformanceStats: false,
      installedApps: {
        settings: {
          id: 'settings',
          name: 'Settings',
          icon: '⚙️',
          isSystem: true
        },
        developer: {
          id: 'developer',
          name: 'Developer',
          icon: '🛠️',
          isSystem: true
        },
        wallet: {
          id: 'wallet',
          name: 'Wallet',
          icon: '👛',
          isSystem: true
        },
        chat: {
          id: 'chat',
          name: 'Chat',
          icon: '💬',
          isSystem: true
        },
        inventory: {
          id: 'inventory',
          name: 'Inventory',
          icon: '🎒',
          isSystem: true
        },
        appstore: {
          id: 'appstore',
          name: 'App Store',
          icon: '🏪',
          isSystem: true
        },
        browser: {
          id: 'browser',
          name: 'Browser',
          icon: '🌐',
          isSystem: true
        },
        screenshare: {
          id: 'screenshare',
          name: 'Screen Share',
          icon: '📱',
          isSystem: true
        }
      },
      homeScreenLayout: {
        currentPage: 'main',
        pages: [
          {
            id: 'main',
            name: 'Main',
            apps: ['wallet', 'chat', 'inventory', 'appstore', 'browser', 'screenshare']
          }
        ]
      }
    }

    // Load saved state
    const savedState = localStorage.getItem('hyperfy_os_state')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        this.state = {
          ...this.state,
          ...parsed,
          currentTime: new Date()
        }
      } catch (err) {
        console.error('Failed to load saved state:', err)
      }
    }

    // Start time update interval
    setInterval(() => {
      this.setState({ currentTime: new Date() })
    }, 1000)

    // Start battery update interval
    setInterval(() => {
      const batteryLevel = Math.max(0, this.state.batteryLevel - (this.state.isCharging ? -1 : 1))
      if (batteryLevel !== this.state.batteryLevel) {
        this.setState({ batteryLevel })
      }
      if (batteryLevel <= 20 && !this.state.isCharging) {
        // TODO: Show low battery notification
      }
    }, 60000)

    // Initialize system events
    this.initializeSystemEvents()
  }

  // Load saved data from localStorage
  loadInstalledApps() {
    const saved = localStorage.getItem('hyperfy_installed_apps')
    return saved ? JSON.parse(saved) : {
      'settings': {
        id: 'settings',
        name: 'Settings',
        icon: '⚙️',
        isSystem: true
      },
      'appstore': {
        id: 'appstore',
        name: 'App Store',
        icon: '🏪',
        isSystem: true
      },
      'wallet': {
        id: 'wallet',
        name: 'Wallet',
        icon: '💰',
        isSystem: true
      },
      'chat': {
        id: 'chat',
        name: 'Chat',
        icon: '💬',
        isSystem: true
      },
      'browser': {
        id: 'browser',
        name: 'Browser',
        icon: '🌐',
        isSystem: true
      },
      'inventory': {
        id: 'inventory',
        name: 'Inventory',
        icon: '🎒',
        isSystem: true
      },
      'screenshare': {
        id: 'screenshare',
        name: 'Screen Share',
        icon: '📱',
        isSystem: true
      }
    }
  }

  loadHomeScreenLayout() {
    const saved = localStorage.getItem('hyperfy_home_layout')
    return saved ? JSON.parse(saved) : {
      pages: [
        {
          id: 'main',
          name: 'Main',
          apps: ['appstore', 'settings', 'wallet', 'chat', 'browser', 'inventory', 'screenshare']
        }
      ],
      currentPage: 'main'
    }
  }

  loadHiddenApps() {
    const saved = localStorage.getItem('hyperfy_hidden_apps')
    return saved ? JSON.parse(saved) : []
  }

  loadCustomThemes() {
    const saved = localStorage.getItem('hyperfy_custom_themes')
    return saved ? JSON.parse(saved) : {}
  }

  loadCustomWallpapers() {
    const saved = localStorage.getItem('hyperfy_custom_wallpapers')
    return saved ? JSON.parse(saved) : {}
  }

  // System event handlers
  initializeSystemEvents() {
    // Battery status with better error handling and polling
    const updateBatteryStatus = async () => {
      try {
        // Try Web Battery API first
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery();
          this.updateBatteryStatus(battery);
          
          // Set up event listeners
          battery.addEventListener('levelchange', () => this.updateBatteryStatus(battery));
          battery.addEventListener('chargingchange', () => this.updateBatteryStatus(battery));
        } else {
          // Fallback to Windows battery API
          if (navigator.userAgent.includes('Windows')) {
            try {
              const powerStatus = await window.navigator.powerStatus;
              if (powerStatus) {
                this.setState({
                  batteryLevel: powerStatus.remainingCapacity / 100,
                  isCharging: powerStatus.powerSupplyStatus === 'Connected'
                });
              }
            } catch (err) {
              console.warn('Failed to get Windows power status:', err);
              this.setState({ batteryLevel: 1, isCharging: true });
            }
          } else {
            // Default to plugged in for desktop
            this.setState({ batteryLevel: 1, isCharging: true });
          }
        }
      } catch (err) {
        console.warn('Failed to get battery status:', err);
        // Default to plugged in
        this.setState({ batteryLevel: 1, isCharging: true });
      }
    };

    // Initial update
    updateBatteryStatus();

    // Poll every minute as backup
    setInterval(updateBatteryStatus, 60000);

    // Time updates
    setInterval(() => {
      this.setState({ currentTime: new Date() });
    }, 1000);
  }

  updateBatteryStatus(battery) {
    // Add validation and normalization
    let level = battery.level;
    
    // Ensure level is between 0 and 1
    level = Math.max(0, Math.min(1, level));
    
    // Round to 2 decimal places for stability
    level = Math.round(level * 100) / 100;

    this.setState({
      batteryLevel: level,
      isCharging: battery.charging
    });
  }

  // State management
  setState(newState) {
    this.state = { ...this.state, ...newState }
    this.saveState()
    if (this.onStateChange) {
      this.onStateChange(this.state)
    }
  }

  saveState() {
    localStorage.setItem('hyperfy_os_state', JSON.stringify(this.state))
    localStorage.setItem('hyperfy_installed_apps', JSON.stringify(this.state.installedApps))
    localStorage.setItem('hyperfy_custom_themes', JSON.stringify(this.state.customThemes))
    localStorage.setItem('hyperfy_custom_wallpapers', JSON.stringify(this.state.customWallpapers))
    localStorage.setItem('hyperfy_home_layout', JSON.stringify(this.state.homeScreenLayout))
    localStorage.setItem('hyperfy_hidden_apps', JSON.stringify(this.state.hiddenApps))
  }

  // App management
  async installApp(app) {
    try {
      // Add to installed apps
      this.setState({
        installedApps: {
          ...this.state.installedApps,
          [app.id]: {
            id: app.id,
            name: app.name,
            description: app.description,
            version: app.version,
            author: app.author,
            icon: app.icon || '📱',
            category: app.category || 'Apps',
            sourceCode: app.sourceCode,
            permissions: app.permissions || [],
            installDate: new Date().toISOString()
          }
        }
      })

      // Add to home screen layout
      const layout = this.state.homeScreenLayout
      if (!layout.pages[0].apps.includes(app.id)) {
        layout.pages[0].apps.push(app.id)
        this.setState({ homeScreenLayout: layout })
      }
      
      return true
    } catch (error) {
      console.error('Failed to install app:', error)
      return false
    }
  }

  uninstallApp(appId) {
    if (this.state.installedApps[appId]?.isSystem) {
      return false
    }

    const newApps = { ...this.state.installedApps }
    delete newApps[appId]
    
    const newLayout = {
      ...this.state.homeScreenLayout,
      pages: this.state.homeScreenLayout.pages.map(page => ({
        ...page,
        apps: page.apps.filter(id => id !== appId)
      }))
    }
    
    const newHidden = this.state.hiddenApps.filter(id => id !== appId)
    
    this.setState({
      installedApps: newApps,
      homeScreenLayout: newLayout,
      hiddenApps: newHidden,
      activeApp: this.state.activeApp === appId ? null : this.state.activeApp
    })

    return true
  }

  // Home screen management
  createHomePage(name) {
    const newPage = {
      id: Date.now().toString(),
      name,
      apps: []
    }
    
    const layout = this.state.homeScreenLayout
    layout.pages.push(newPage)
    this.setState({ homeScreenLayout: layout })
    return newPage.id
  }

  deleteHomePage(pageId) {
    if (pageId === 'main') return false

    const layout = this.state.homeScreenLayout
    const pageIndex = layout.pages.findIndex(p => p.id === pageId)
    if (pageIndex === -1) return false

    const appsToMove = layout.pages[pageIndex].apps
    layout.pages[0].apps.push(...appsToMove)

    layout.pages.splice(pageIndex, 1)
    
    if (layout.currentPage === pageId) {
      layout.currentPage = 'main'
    }

    this.setState({ homeScreenLayout: layout })
    return true
  }

  moveApp(appId, fromPageId, toPageId, newIndex) {
    const layout = this.state.homeScreenLayout
    const fromPage = layout.pages.find(p => p.id === fromPageId)
    const toPage = layout.pages.find(p => p.id === toPageId)
    if (!fromPage || !toPage) return false

    const fromIndex = fromPage.apps.indexOf(appId)
    if (fromIndex === -1) return false
    fromPage.apps.splice(fromIndex, 1)

    toPage.apps.splice(newIndex, 0, appId)

    this.setState({ homeScreenLayout: layout })
    return true
  }

  hideApp(appId) {
    if (this.state.installedApps[appId]?.isSystem) {
      return false
    }

    if (!this.state.hiddenApps.includes(appId)) {
      this.setState({
        hiddenApps: [...this.state.hiddenApps, appId]
      })
    }
    return true
  }

  showApp(appId) {
    this.setState({
      hiddenApps: this.state.hiddenApps.filter(id => id !== appId)
    })
    return true
  }

  // Theme management
  addCustomTheme(theme) {
    this.setState({
      customThemes: {
        ...this.state.customThemes,
        [theme.id]: theme
      }
    })
  }

  removeCustomTheme(themeId) {
    const newThemes = { ...this.state.customThemes }
    delete newThemes[themeId]
    
    this.setState({
      customThemes: newThemes,
      currentTheme: this.state.currentTheme === themeId ? 'hyperfy' : this.state.currentTheme
    })
  }

  // Wallpaper management
  addCustomWallpaper(wallpaper) {
    this.setState({
      customWallpapers: {
        ...this.state.customWallpapers,
        [wallpaper.id]: wallpaper
      }
    })
  }

  removeCustomWallpaper(wallpaperId) {
    const newWallpapers = { ...this.state.customWallpapers }
    delete newWallpapers[wallpaperId]
    
    this.setState({
      customWallpapers: newWallpapers,
      currentWallpaper: this.state.currentWallpaper === wallpaperId ? 'default' : this.state.currentWallpaper
    })
  }

  // System controls
  lock() {
    this.setState({ isLocked: true })
    localStorage.setItem('hyperfy_os_state', JSON.stringify(this.state))
  }

  unlock() {
    this.setState({ isLocked: false })
    localStorage.setItem('hyperfy_os_state', JSON.stringify(this.state))
  }

  launchApp(appId) {
    console.log('Launching app:', appId)
    if (this.state.installedApps[appId]) {
      this.setState({ activeApp: appId })
      return true
    }
    return false
  }

  closeApp() {
    this.setState({ activeApp: null })
  }

  // Theme getters
  getCurrentTheme() {
    const themeId = this.state.currentTheme
    const isDarkMode = this.state.isDarkMode
    const theme = themes[themeId] || themes.hyperfy
    const variant = isDarkMode ? theme.variants.dark : theme.variants.light
    return {
      ...variant,
      name: theme.name
    }
  }

  getCurrentWallpaper() {
    if (this.state.currentWallpaper === 'default') {
      return defaultWallpaper
    }
    return this.state.customWallpapers[this.state.currentWallpaper]
  }

  // System information
  getSystemInfo() {
    return {
      version: '1.0.0',
      buildNumber: '2024.1',
      platform: 'HyperFone OS',
      device: 'HyperFone Virtual Device',
      manufacturer: 'Hyperfy',
      model: 'HyperFone One',
      osName: 'HyperFoneOS',
      osVersion: '1.0.0',
      batteryLevel: this.state.batteryLevel,
      isCharging: this.state.isCharging,
      currentTime: this.state.currentTime,
      installedApps: Object.keys(this.state.installedApps).length,
      availableStorage: '1000GB',
      usedStorage: '0GB',
      ram: '16GB',
      cpu: 'HyperFone Virtual CPU',
      gpu: 'HyperFone Virtual GPU'
    }
  }
}

// Create and export a singleton instance
export const hyperFoneOS = new HyperFoneOS() 