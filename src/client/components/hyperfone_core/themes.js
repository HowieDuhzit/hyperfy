// Theme definitions
export const themes = {
  hyperfy: {
    name: 'Hyperfy',
    variants: {
      dark: {
        primary: '#7C3AED',
        background: '#0F0F0F',
        border: '#1F1F1F',
        text: '#FFFFFF',
        textSecondary: 'rgba(255, 255, 255, 0.4)'
      },
      light: {
        primary: '#7C3AED',
        background: '#F0F0F0',
        border: '#E0E0E0',
        text: '#000000',
        textSecondary: 'rgba(0, 0, 0, 0.4)'
      }
    }
  },
  neon: {
    name: 'Neon',
    variants: {
      dark: {
        primary: '#00ff88',
        background: '#0a0a0a',
        border: '#1a1a1a',
        text: '#00ff88',
        textSecondary: 'rgba(0, 255, 136, 0.4)'
      },
      light: {
        primary: '#00cc66',
        background: '#f0f0f0',
        border: '#e0e0e0',
        text: '#00cc66',
        textSecondary: 'rgba(0, 204, 102, 0.4)'
      }
    }
  },
  sunset: {
    name: 'Sunset',
    variants: {
      dark: {
        primary: '#ff6b6b',
        background: '#2d1b2d',
        border: '#3d2b3d',
        text: '#ffd5d5',
        textSecondary: 'rgba(255, 213, 213, 0.4)'
      },
      light: {
        primary: '#ff6b6b',
        background: '#fff5f5',
        border: '#ffe5e5',
        text: '#ff4444',
        textSecondary: 'rgba(255, 68, 68, 0.4)'
      }
    }
  },
  ocean: {
    name: 'Ocean',
    variants: {
      dark: {
        primary: '#4facfe',
        background: '#192834',
        border: '#293844',
        text: '#e0f2fe',
        textSecondary: 'rgba(224, 242, 254, 0.4)'
      },
      light: {
        primary: '#4facfe',
        background: '#f0f9ff',
        border: '#e0f2fe',
        text: '#0369a1',
        textSecondary: 'rgba(3, 105, 161, 0.4)'
      }
    }
  }
}

// Default wallpaper
export const defaultWallpaper = {
  id: 'default',
  name: 'Default',
  url: 'https://pbs.twimg.com/profile_banners/1286491321583075329/1735471810/1500x500'
} 