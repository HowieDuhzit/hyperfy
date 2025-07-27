import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const binariesDir = path.join(rootDir, 'src-tauri/binaries')
const nodejsDir = path.join(binariesDir, 'nodejs')

async function setupNodeSidecar() {
  console.log('Setting up Node.js sidecar for Tauri...')
  
  // Check if Node.js is already downloaded
  const nodeExePath = path.join(nodejsDir, 'node-v24.4.0-win-x64/node.exe')
  const targetPath = path.join(binariesDir, 'node-x86_64-pc-windows-msvc.exe')
  
  if (!fs.existsSync(nodeExePath)) {
    console.log('Node.js not found, downloading...')
    
    // Create directories
    await fs.ensureDir(nodejsDir)
    
    // Download Node.js
    const nodeUrl = 'https://nodejs.org/dist/v24.4.0/node-v24.4.0-win-x64.zip'
    const zipPath = path.join(rootDir, 'nodejs.zip')
    
    console.log('Downloading Node.js...')
    execSync(`powershell -Command "Invoke-WebRequest -Uri '${nodeUrl}' -OutFile '${zipPath}'"`, { stdio: 'inherit' })
    
    console.log('Extracting Node.js...')
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${nodejsDir}' -Force"`, { stdio: 'inherit' })
    
    // Clean up zip file
    await fs.remove(zipPath)
  }
  
  // Copy Node.js to the correct location for Tauri
  console.log('Copying Node.js to Tauri binaries directory...')
  await fs.copy(nodeExePath, targetPath)
  
  console.log('Node.js sidecar setup complete!')
  console.log(`Node.js executable: ${targetPath}`)
}

setupNodeSidecar().catch(console.error) 