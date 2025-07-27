import sourceMapSupport from 'source-map-support'
import path from 'path'
import { fileURLToPath } from 'url'

// Set up environment variables for Tauri bundled version
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.PORT = process.env.PORT || '3000'
process.env.WORLD = process.env.WORLD || 'world'
process.env.PUBLIC_ASSETS_URL = process.env.PUBLIC_ASSETS_URL || ''

// support node source maps
sourceMapSupport.install()

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('Tauri bootstrap loaded with environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  WORLD: process.env.WORLD,
  PUBLIC_ASSETS_URL: process.env.PUBLIC_ASSETS_URL
}) 