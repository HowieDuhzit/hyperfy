# AppLauncher Component Documentation

The AppLauncher is a React component that provides a cyberpunk-themed app launching interface for the HyperfoneOS. It displays installed apps in a grid layout with futuristic visual effects.

## Component Overview

```javascript
function AppLauncher({ apps, activeApp, onLaunch })
```

### Props

- `apps`: Array of installed applications
- `activeApp`: Currently active application
- `onLaunch`: Callback function triggered when an app is launched

## Visual Design

The AppLauncher implements a cyberpunk aesthetic with:

### Layout Elements
- Full-height container with flexbox column layout
- Radial gradient background overlay
- Grid-based app icon layout
- 20px spacing between elements

### Header Section
- Centered title "HyperFone OS"
- Version number display
- Scanline visual effect
- Cyberpunk typography styling

### App Grid
- Responsive grid layout using `grid-template-columns`
- Auto-filling columns with minimum 80px width
- 20px gap between app icons
- Padding around the grid

## Styling

The component uses the `@firebolt-dev/css` library with the cyberpunk theme:

```javascript
// Theme Integration
import { cyberpunkTheme } from '../../theme/cyberpunk'

// Styling Examples
${cyberpunkTheme.common.grid}
${cyberpunkTheme.common.effects.scanline}
${cyberpunkTheme.common.text.title}
${cyberpunkTheme.common.text.subtitle}
```

### Visual Effects
- Scanline animation on header
- Radial gradient background
- Neon text effects
- High-tech grid patterns

## Usage Example

```javascript
import { AppLauncher } from './components/hyperfone_core/AppLauncher'

const apps = [
  {
    id: 'browser',
    name: 'Neural Browser',
    icon: 'path/to/icon.png'
  },
  // ... more apps
]

function handleLaunch(appId) {
  console.log(`Launching app: ${appId}`)
}

<AppLauncher
  apps={apps}
  activeApp="browser"
  onLaunch={handleLaunch}
/>
```

## Styling Customization

The component can be customized through the cyberpunk theme:

```javascript
// Example theme customization
const customTheme = {
  background: '#0a0a0a',
  common: {
    grid: `
      background-image: linear-gradient(...);
      border: 1px solid rgba(0,255,255,0.2);
    `,
    effects: {
      scanline: `
        animation: scanline 2s linear infinite;
      `
    }
  }
}
``` 