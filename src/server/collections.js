import fs from 'fs-extra'
import path from 'path'
import { importApp } from '../core/extras/appTools'

export async function initCollections({ collectionsDir, assetsDir }) {
  let folderNames = fs.readdirSync(collectionsDir)
  folderNames.sort((a, b) => {
    // keep "default" first then sort alphabetically
    if (a === 'default') return -1
    if (b === 'default') return 1
    return a.localeCompare(b)
  })
  const collections = []
  for (const folderName of folderNames) {
    const folderPath = path.join(collectionsDir, folderName)
    const stats = fs.statSync(folderPath)
    if (!stats.isDirectory()) continue
    const manifestPath = path.join(folderPath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue
    const manifest = fs.readJsonSync(manifestPath)
    const blueprints = []
    for (const appFilename of manifest.apps) {
      const appPath = path.join(folderPath, appFilename)
      const appBuffer = fs.readFileSync(appPath)
      const appFile = new File([appBuffer], appFilename, {
        type: 'application/octet-stream',
      })
      const app = await importApp(appFile)
      for (const asset of app.assets) {
        const file = asset.file
        const assetFilename = asset.url.slice(8) // remove 'asset://' prefix
        const assetPath = path.join(assetsDir, assetFilename)
        const exists = await fs.exists(assetPath)
        if (exists) continue
        const arrayBuffer = await file.arrayBuffer()
        await fs.writeFile(assetPath, Buffer.from(arrayBuffer))
      }
      
      // Ensure unique blueprint ID by prefixing with collection name
      const blueprint = { ...app.blueprint }
      if (blueprint.id) {
        blueprint.id = `${folderName}_${blueprint.id}`
      }
      
      blueprints.push(blueprint)
    }
    collections.push({
      id: folderName,
      name: manifest.name,
      blueprints,
    })
  }
  return collections
}
