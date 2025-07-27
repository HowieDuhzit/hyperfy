import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const nodeExePath = path.join(rootDir, 'src-tauri/binaries/node-x86_64-pc-windows-msvc.exe')
const serverPath = path.join(rootDir, 'build/index.js')

async function testServerStartup() {
  console.log('Testing server startup process...')
  
  // Check if files exist
  if (!fs.existsSync(nodeExePath)) {
    console.error('❌ Node.js executable not found:', nodeExePath)
    return false
  }
  
  if (!fs.existsSync(serverPath)) {
    console.error('❌ Server file not found:', serverPath)
    return false
  }
  
  console.log('✅ Node.js executable found:', nodeExePath)
  console.log('✅ Server file found:', serverPath)
  
  // Test Node.js version
  console.log('\nTesting Node.js version...')
  const versionResult = spawn(nodeExePath, ['--version'], { stdio: 'pipe' })
  
  versionResult.stdout.on('data', (data) => {
    console.log('Node.js version:', data.toString().trim())
  })
  
  versionResult.stderr.on('data', (data) => {
    console.error('Node.js version error:', data.toString())
  })
  
  // Test server startup (briefly)
  console.log('\nTesting server startup (5 second test)...')
  const serverProcess = spawn(nodeExePath, [serverPath], { 
    stdio: 'pipe',
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3000',
      WORLD: 'world',
      PUBLIC_ASSETS_URL: ''
    }
  })
  
  let serverOutput = ''
  let serverError = ''
  
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString()
    serverOutput += output
    console.log('Server stdout:', output.trim())
  })
  
  serverProcess.stderr.on('data', (data) => {
    const error = data.toString()
    serverError += error
    console.log('Server stderr:', error.trim())
  })
  
  // Wait 5 seconds then kill the process
  setTimeout(() => {
    serverProcess.kill()
    console.log('\n✅ Server startup test completed')
    console.log('Server output length:', serverOutput.length)
    console.log('Server error length:', serverError.length)
    
    if (serverError.length > 0) {
      console.log('⚠️  Server had some errors, but this might be normal during startup')
    }
    
    if (serverOutput.includes('listening') || serverOutput.includes('started') || serverOutput.includes('3000')) {
      console.log('✅ Server appears to be starting correctly')
    } else {
      console.log('⚠️  Server output doesn\'t show clear startup indicators')
    }
  }, 5000)
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`)
  })
}

testServerStartup().catch(console.error) 