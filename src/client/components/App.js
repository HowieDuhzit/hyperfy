import { useEffect } from 'react'
import { gamepadMenuNavigator } from '../utils/gamepadMenu'

function App({ world }) {
  useEffect(() => {
    // Set up gamepad menu navigation
    const updateGamepadMenu = () => {
      if (world.controls.gamepadManager) {
        gamepadMenuNavigator.update(world.controls.gamepadManager)
      }
      requestAnimationFrame(updateGamepadMenu)
    }
    
    updateGamepadMenu()
    
    return () => {
      // Clean up any active navigation state
      gamepadMenuNavigator.stopNavigation()
    }
  }, [world])

  // ... rest of existing component code ...
} 