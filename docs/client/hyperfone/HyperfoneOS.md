# HyperfoneOS Documentation

The HyperfoneOS is a cyberpunk-themed operating system simulation that provides the core UI experience within the Hyperfy engine. It implements a complete virtual OS with app management, theming, and system functionality.

## Core Features

- App Management System
- Theme Management
- Battery Status Simulation
- Wallpaper Customization
- Developer Mode
- Performance Monitoring

## Class: HyperFoneOS

### Constructor

Initializes a new instance of the HyperfoneOS with the following default state:

```javascript
{
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
  hiddenApps: [],
  isDeveloperMode: false,
  showWorldInspector: false,
  showObjectBounds: false,
  showPerformanceStats: false
}
```

### Core Methods

#### State Management
- `setState(newState)`: Updates the OS state
- `saveState()`: Persists the current state to localStorage
- `getSystemInfo()`: Returns current system information

#### App Management
- `installApp(app)`: Installs a new application
- `uninstallApp(appId)`: Removes an installed application
- `hideApp(appId)`: Hides an application from view
- `showApp(appId)`: Makes a hidden application visible
- `launchApp(appId)`: Launches an application
- `closeApp()`: Closes the currently active application

#### Theme Management
- `addCustomTheme(theme)`: Adds a new custom theme
- `removeCustomTheme(themeId)`: Removes a custom theme
- `getCurrentTheme()`: Returns the current theme configuration

#### Home Screen Management
- `createHomePage(name)`: Creates a new home screen page
- `deleteHomePage(pageId)`: Removes a home screen page
- `moveApp(appId, fromPageId, toPageId, newIndex)`: Reorganizes apps on home screen

#### System Functions
- `lock()`: Locks the OS
- `unlock()`: Unlocks the OS
- `initializeSystemEvents()`: Sets up system event listeners
- `updateBatteryStatus(battery)`: Updates the battery status

## Events

The HyperfoneOS implements various system events:
- Battery status updates
- Time updates
- State changes
- App lifecycle events

## Theming

The OS supports a cyberpunk-inspired theming system with:
- Custom color schemes
- Wallpaper management
- Dark/Light mode switching
- Custom theme installation

## Developer Tools

When developer mode is enabled:
- World Inspector
- Object Bounds Visualization
- Performance Statistics
- Debug Console

## Usage Example

```javascript
const os = new HyperFoneOS();

// Install a new app
await os.installApp({
  id: 'myapp',
  name: 'My App',
  icon: 'path/to/icon.png'
});

// Launch the app
os.launchApp('myapp');

// Add a custom theme
os.addCustomTheme({
  id: 'cyberpunk-neon',
  colors: {
    primary: '#ff00ff',
    secondary: '#00ffff'
  }
});
``` 