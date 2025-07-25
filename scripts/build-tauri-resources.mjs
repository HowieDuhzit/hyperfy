import 'dotenv-flow/config'  
import fs from 'fs-extra'  
import path from 'path'  
import { fileURLToPath } from 'url'  
  
const dirname = path.dirname(fileURLToPath(import.meta.url))  
const rootDir = path.join(dirname, '../')  
const resourcesDir = path.join(rootDir, 'src-tauri/resources')  
const buildDir = path.join(rootDir, 'build')  
  
// Ensure resources directory exists  
await fs.ensureDir(resourcesDir)  
  
// Copy the entire build directory to resources  
await fs.copy(buildDir, path.join(resourcesDir, 'build'))  
  
console.log('Tauri resources build complete') 