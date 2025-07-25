import 'dotenv-flow/config'  
import fs from 'fs-extra'  
import path from 'path'  
import * as esbuild from 'esbuild'  
import { fileURLToPath } from 'url'  
  
const dirname = path.dirname(fileURLToPath(import.meta.url))  
const rootDir = path.join(dirname, '../')  
const buildDir = path.join(rootDir, 'src-tauri/binaries')  
  
// Ensure build directory exists  
await fs.ensureDir(buildDir)  
  
// Determine the correct binary name for the platform  
const platform = process.platform  
const arch = process.arch  
let binaryName = 'hyperfy-server'  
  
if (platform === 'win32') {  
  binaryName = `hyperfy-server-x86_64-pc-windows-msvc.exe`  
} else if (platform === 'darwin') {  
  binaryName = `hyperfy-server-x86_64-apple-darwin`  
} else if (platform === 'linux') {  
  binaryName = `hyperfy-server-x86_64-unknown-linux-gnu`  
}  
  
// Build the server as a standalone executable for Tauri sidecar  
const serverCtx = await esbuild.context({  
  entryPoints: ['src/server/index.js'],  
  outfile: path.join(buildDir, binaryName),  
  platform: 'node',  
  format: 'esm',  
  bundle: true,  
  treeShaking: true,  
  minify: true,  
  sourcemap: false,  
  packages: 'external',  
  define: {  
    'process.env.CLIENT': 'false',  
    'process.env.SERVER': 'true',  
    'process.env.PORT': '3000'  
  },  
  plugins: [  
    {  
      name: 'tauri-server-plugin',  
      setup(build) {  
        build.onEnd(async result => {  
          // Copy required files  
          const physxIdlSrc = path.join(rootDir, 'src/core/physx-js-webidl.js')  
          const physxIdlDest = path.join(buildDir, 'physx-js-webidl.js')  
          await fs.copy(physxIdlSrc, physxIdlDest)  
            
          const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')  
          const physxWasmDest = path.join(buildDir, 'physx-js-webidl.wasm')  
          await fs.copy(physxWasmSrc, physxWasmDest)  
            
          console.log(`Tauri server build complete: ${binaryName}`)  
        })  
      },  
    },  
  ],  
})  
  
await serverCtx.rebuild()  
await serverCtx.dispose()