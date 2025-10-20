import 'ses'
import '../core/lockdown'
import { createRoot } from 'react-dom/client'

import { Client } from './world-client'
import * as buf from 'buffer'

const Buffer = buf.default.Buffer

// client support
if (typeof window !== 'undefined') {
  globalThis.Buffer = Buffer
}

function App({ wsUrl, apiUrl, assetsUrl }) {
  return <Client wsUrl={wsUrl} />
}

export function boot({ wsUrl, apiUrl, assetsUrl }) {
  const root = createRoot(document.getElementById('root'))
  root.render(<App wsUrl={wsUrl} apiUrl={apiUrl} assetsUrl={assetsUrl} />)
}

export function bootFromPear() {
  // Check if we're running in Pear environment
  const isPear = typeof globalThis.Pear !== 'undefined'
  
  if (isPear) {
    const apiBase = globalThis.Pear?.config?.links?.api || import.meta.env.PUBLIC_API_URL
    const wsUrl = globalThis.Pear?.config?.links?.ws || import.meta.env.PUBLIC_WS_URL
    const assetsBase = globalThis.Pear?.config?.links?.assets || import.meta.env.PUBLIC_ASSETS_URL
    return boot({ wsUrl, apiUrl: apiBase, assetsUrl: assetsBase })
  } else {
    // Fallback to environment variables for regular web
    return boot({ 
      wsUrl: process.env.PUBLIC_WS_URL,
      apiUrl: process.env.PUBLIC_API_URL,
      assetsUrl: process.env.PUBLIC_ASSETS_URL
    })
  }
}

// Auto-boot if we're not in a module context (legacy support)
if (typeof window !== 'undefined' && !globalThis.hyperfy_manual_boot) {
  bootFromPear()
}