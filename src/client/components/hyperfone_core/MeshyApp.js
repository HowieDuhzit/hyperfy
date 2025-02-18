import { css } from '@firebolt-dev/css'
import React, { useState, useEffect } from 'react'
import { uuid } from '../../../core/utils'

// App metadata
const APP_INFO = {
  id: 'meshy',
  name: 'Meshy 3D',
  version: '1.0.0',
  description: 'Generate and spawn 3D models from text using Meshy AI',
  author: 'HyperFone',
  icon: '🎨',
  category: 'creativity',
  permissions: ['world-spawn']
}

// Default configuration
const DEFAULT_CONFIG = {
  theme: {
    primary: '#551bf9',
    background: '#1a1a1a',
    text: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
    error: '#ff4444'
  }
}

export const MeshyApp = ({ theme, world }) => {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewTaskId, setPreviewTaskId] = useState(null)
  const [refinedTaskId, setRefinedTaskId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [modelUrl, setModelUrl] = useState(null)
  const [apiKey, setApiKey] = useState(localStorage.getItem('meshy_api_key') || '')
  const [isPlacingModel, setIsPlacingModel] = useState(false)
  const [placementPreview, setPlacementPreview] = useState(null)
  const [generationResult, setGenerationResult] = useState(null)
  const [artStyle, setArtStyle] = useState('realistic')
  const [topology, setTopology] = useState('triangle')
  const [targetPolycount, setTargetPolycount] = useState(30000)
  const [shouldRemesh, setShouldRemesh] = useState(true)
  const [symmetryMode, setSymmetryMode] = useState('auto')
  const [enablePbr, setEnablePbr] = useState(true)

  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('meshy_api_key', apiKey)
    }
  }, [apiKey])

  // Handle model placement mode
  useEffect(() => {
    if (!isPlacingModel || !modelUrl || !world) return

    // Create preview object
    const preview = world.entities.add({
      id: uuid(),
      type: 'model',
      url: modelUrl,
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
      opacity: 0.5
    }, true)
    setPlacementPreview(preview)

    // Set up click handler for placement
    const handleClick = (e) => {
      if (!isPlacingModel || !preview) return
      
      // Place the actual model
      world.entities.add({
        id: uuid(),
        type: 'model',
        url: modelUrl,
        position: preview.data.position,
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1]
      }, true)

      // Clean up placement mode
      setIsPlacingModel(false)
      preview.destroy()
      setPlacementPreview(null)
    }

    // Set up mouse move handler for preview
    const handleMouseMove = (e) => {
      if (!isPlacingModel || !preview) return
      
      // Get intersection with ground plane
      const intersection = world.raycast({
        origin: world.camera.position,
        direction: world.camera.forward,
        distance: 100
      })

      if (intersection) {
        preview.data.position = intersection.point.toArray()
        preview.update()
      }
    }

    // Add event listeners
    world.on('click', handleClick)
    world.on('mousemove', handleMouseMove)

    return () => {
      // Clean up
      world.off('click', handleClick)
      world.off('mousemove', handleMouseMove)
      if (preview) preview.destroy()
    }
  }, [isPlacingModel, modelUrl, world])

  const addToInventory = (blueprint) => {
    // Create an inventory item
    const item = {
      id: uuid(),
      blueprint: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      model: blueprint.model
    }

    // Add to local storage if inventory system isn't ready
    const savedItems = localStorage.getItem('hyperfy_inventory') || '[]'
    const items = JSON.parse(savedItems)
    items.push(item)
    localStorage.setItem('hyperfy_inventory', JSON.stringify(items))

    // Try to use inventory system if available
    try {
      if (window.hyperFoneInventory && typeof window.hyperFoneInventory.addItem === 'function') {
        window.hyperFoneInventory.addItem(item)
      }
    } catch (err) {
      console.warn('Could not add to HyperFone inventory:', err)
    }

    return item
  }

  const spawnModel = (blueprint, item) => {
    try {
      // Get player position
      const player = world.entities.player
      const position = [...player.base.position.toArray()]
      position[2] += 2 // 2 units in front of player

      // Spawn the model in front of the player
      const modelEntity = {
        id: uuid(),
        type: 'app',
        blueprint: blueprint.id,
        position: position,
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        mover: world.network.id // Start in moving mode
      }

      world.entities.add(modelEntity, true)
    } catch (err) {
      console.warn('Could not spawn model:', err)
      setError('Model generated but could not be spawned. Check inventory to use it.')
    }
  }

  const generateModel = async () => {
    if (!apiKey) {
      setError('Please enter your Meshy API key')
      return
    }
    if (!prompt) {
      setError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError(null)
    setProgress(0)

    try {
      // Step 1: Generate preview model
      const previewResponse = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'preview',
          prompt: prompt,
          negative_prompt: 'low quality, low resolution, low poly, ugly',
          art_style: artStyle,
          topology: topology,
          target_polycount: targetPolycount,
          should_remesh: shouldRemesh,
          symmetry_mode: symmetryMode
        })
      })

      if (!previewResponse.ok) {
        const errorData = await previewResponse.json()
        throw new Error(errorData.message || 'Failed to start preview generation')
      }

      const previewData = await previewResponse.json()
      setPreviewTaskId(previewData.result)
      setProgress(25)

      // Step 2: Poll preview task until complete
      let previewTask
      while (true) {
        const statusResponse = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${previewData.result}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        
        if (!statusResponse.ok) {
          const errorData = await statusResponse.json()
          throw new Error(errorData.message || 'Failed to check preview status')
        }
        
        previewTask = await statusResponse.json()
        
        if (previewTask.status === 'SUCCEEDED') {
          setProgress(50)
          break
        } else if (previewTask.status === 'FAILED') {
          throw new Error(previewTask.task_error?.message || 'Preview generation failed')
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000))
      }

      // Step 3: Generate refined model
      const refinedResponse = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'refine',
          preview_task_id: previewData.result,
          enable_pbr: enablePbr
        })
      })

      if (!refinedResponse.ok) {
        const errorData = await refinedResponse.json()
        throw new Error(errorData.message || 'Failed to start refinement')
      }

      const refinedData = await refinedResponse.json()
      setRefinedTaskId(refinedData.result)
      setProgress(75)

      // Step 4: Poll refined task until complete
      while (true) {
        const statusResponse = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${refinedData.result}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        
        if (!statusResponse.ok) {
          const errorData = await statusResponse.json()
          throw new Error(errorData.message || 'Failed to check refinement status')
        }
        
        const refinedTask = await statusResponse.json()
        console.log('Refined task:', refinedTask) // Debug log
        
        if (refinedTask.status === 'SUCCEEDED') {
          // Store the full generation result
          setGenerationResult(refinedTask)
          
          // Check if we have model URLs
          if (!refinedTask.model_urls?.glb) {
            throw new Error('No GLB model URL found in the response')
          }

          const modelUrl = refinedTask.model_urls.glb
          setModelUrl(modelUrl)
          setProgress(100)

          // Create a blueprint for the model
          const blueprintId = `meshy_${uuid()}`
          const blueprint = {
            id: blueprintId,
            name: prompt,
            description: `Generated from prompt: ${prompt}`,
            model: modelUrl,
            type: 'model'
          }

          // Register the blueprint with the world
          if (world && world.blueprints) {
            try {
              world.blueprints.add(blueprint)
            } catch (err) {
              console.warn('Could not register blueprint:', err)
            }
          }

          // Add to inventory
          const item = addToInventory(blueprint)

          // Try to spawn the model
          if (world) {
            spawnModel(blueprint, item)
          }

          break
        } else if (refinedTask.status === 'FAILED') {
          throw new Error(refinedTask.task_error?.message || 'Refinement failed')
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000))
      }

    } catch (err) {
      console.error('Generation error:', err)
      setError(err.message || 'An error occurred during generation')
    } finally {
      setIsGenerating(false)
      if (!error) {
        setPrompt('')
      }
    }
  }

  const ResultsView = () => {
    if (!generationResult) return null

    return (
      <div css={css`
        flex: 1;
        display: flex;
        flex-direction: column;
        background: ${theme.background}ee;
        border-radius: 12px;
        border: 1px solid ${theme.border};
        overflow: hidden;
      `}>
        {/* Header */}
        <div css={css`
          padding: 16px;
          border-bottom: 1px solid ${theme.border};
          background: ${theme.background};
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}>
          <h3 css={css`
            margin: 0;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          `}>
            <span css={css`color: ${theme.primary};`}>✨</span>
            Generation Complete
          </h3>
          <div css={css`display: flex; gap: 8px;`}>
            <button
              onClick={() => setIsPlacingModel(true)}
              css={css`
                padding: 6px 12px;
                border-radius: 6px;
                border: none;
                background: ${theme.primary};
                color: white;
                font-weight: 500;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s ease;
                &:hover {
                  opacity: 0.9;
                }
              `}
            >
              Place in World
            </button>
            <button
              onClick={() => {
                setGenerationResult(null)
                setModelUrl(null)
              }}
              css={css`
                padding: 6px 12px;
                border-radius: 6px;
                border: 1px solid ${theme.border};
                background: transparent;
                color: ${theme.text};
                font-size: 13px;
                cursor: pointer;
                &:hover {
                  background: ${theme.border};
                }
              `}
            >
              New Generation
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div css={css`
          flex: 1;
          overflow-y: auto;
          padding: 16px;

          /* Custom Scrollbar */
          &::-webkit-scrollbar {
            width: 6px;
          }
          &::-webkit-scrollbar-track {
            background: transparent;
          }
          &::-webkit-scrollbar-thumb {
            background: ${theme.border};
            border-radius: 3px;
            &:hover {
              background: ${theme.textSecondary};
            }
          }
        `}>
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 16px;
          `}>
            {/* Preview Section */}
            <div css={css`
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid ${theme.border};
              background: ${theme.background};
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              aspect-ratio: 16/9;
            `}>
              <img 
                src={generationResult.thumbnail_url} 
                alt="Model preview"
                css={css`
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                `}
              />
            </div>

            {/* Info Grid */}
            <div css={css`
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 16px;
            `}>
              {/* Generation Details */}
              <div css={css`
                background: ${theme.background};
                border-radius: 8px;
                border: 1px solid ${theme.border};
                padding: 16px;
              `}>
                <h4 css={css`margin: 0 0 12px 0; font-size: 14px;`}>
                  <span>📋</span> Details
                </h4>
                <div css={css`display: flex; flex-direction: column; gap: 12px;`}>
                  <DetailItem label="Prompt" value={generationResult.prompt} />
                  <DetailItem label="Art Style" value={generationResult.art_style} />
                  <DetailItem 
                    label="Generation Time" 
                    value={`${Math.round((generationResult.finished_at - generationResult.started_at) / 1000)}s`} 
                  />
                </div>
              </div>

              {/* Download Links */}
              {generationResult.model_urls && (
                <div css={css`
                  background: ${theme.background};
                  border-radius: 8px;
                  border: 1px solid ${theme.border};
                  padding: 16px;
                `}>
                  <h4 css={css`margin: 0 0 12px 0; font-size: 14px;`}>
                    <span>💾</span> Downloads
                  </h4>
                  <div css={css`
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 8px;
                  `}>
                    {Object.entries(generationResult.model_urls).map(([format, url]) => (
                      <a
                        key={format}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        css={css`
                          padding: 6px 8px;
                          border-radius: 6px;
                          background: ${theme.background};
                          border: 1px solid ${theme.border};
                          color: ${theme.text};
                          text-decoration: none;
                          text-transform: uppercase;
                          font-size: 12px;
                          text-align: center;
                          transition: all 0.2s ease;
                          &:hover {
                            background: ${theme.primary};
                            border-color: ${theme.primary};
                            color: white;
                          }
                        `}
                      >
                        {format}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Texture Maps */}
              {generationResult.texture_urls?.[0] && (
                <div css={css`
                  background: ${theme.background};
                  border-radius: 8px;
                  border: 1px solid ${theme.border};
                  padding: 16px;
                `}>
                  <h4 css={css`margin: 0 0 12px 0; font-size: 14px;`}>
                    <span>🎨</span> Textures
                  </h4>
                  <div css={css`
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 12px;
                  `}>
                    {Object.entries(generationResult.texture_urls[0]).map(([type, url]) => (
                      <div key={type} css={css`text-align: center;`}>
                        <img 
                          src={url} 
                          alt={`${type} map`}
                          css={css`
                            width: 100%;
                            aspect-ratio: 1;
                            object-fit: cover;
                            border-radius: 4px;
                            border: 1px solid ${theme.border};
                            margin-bottom: 4px;
                          `}
                        />
                        <span css={css`
                          font-size: 11px;
                          color: ${theme.textSecondary};
                          text-transform: capitalize;
                        `}>
                          {type.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const DetailItem = ({ label, value }) => (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 4px;
    `}>
      <span css={css`
        font-size: 12px;
        color: ${theme.textSecondary};
      `}>
        {label}
      </span>
      <span css={css`
        font-size: 14px;
        word-break: break-word;
      `}>
        {value}
      </span>
    </div>
  )

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      gap: 16px;
      color: ${theme.text};
      overflow: hidden;
    `}>
      <h2 css={css`
        margin: 0;
        font-size: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
      `}>
        <span>🎨</span> Meshy 3D Generator
      </h2>

      {isPlacingModel ? (
        <div css={css`
          text-align: center;
          padding: 16px;
          background: ${theme.background}ee;
          border-radius: 8px;
          border: 1px solid ${theme.border};
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `}>
          <h3 css={css`margin: 0 0 8px 0; font-size: 16px;`}>Place Your Model</h3>
          <p css={css`margin: 0; color: ${theme.textSecondary}; font-size: 14px;`}>
            Click anywhere in the world to place the model
          </p>
          <button
            onClick={() => {
              setIsPlacingModel(false)
              if (placementPreview) placementPreview.destroy()
              setPlacementPreview(null)
            }}
            css={css`
              margin-top: 12px;
              padding: 8px 16px;
              border-radius: 4px;
              border: 1px solid ${theme.error};
              background: transparent;
              color: ${theme.error};
              cursor: pointer;
              &:hover {
                background: ${theme.error}22;
              }
            `}
          >
            Cancel Placement
          </button>
        </div>
      ) : generationResult ? (
        <ResultsView />
      ) : (
        <div css={css`
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          padding-right: 8px;

          /* Custom Scrollbar */
          &::-webkit-scrollbar {
            width: 6px;
          }
          &::-webkit-scrollbar-track {
            background: transparent;
          }
          &::-webkit-scrollbar-thumb {
            background: ${theme.border};
            border-radius: 3px;
            &:hover {
              background: ${theme.textSecondary};
            }
          }
        `}>
          {/* API Key Input */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 8px;
          `}>
            <label css={css`font-weight: 500;`}>Meshy API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Meshy API key"
              css={css`
                padding: 12px;
                border-radius: 8px;
                border: 1px solid ${theme.border};
                background: ${theme.background};
                color: ${theme.text};
                font-size: 14px;
                &:focus {
                  outline: none;
                  border-color: ${theme.primary};
                }
              `}
            />
          </div>

          {/* Prompt Input */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 8px;
          `}>
            <label css={css`font-weight: 500;`}>What would you like to create?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the 3D model you want to generate..."
              css={css`
                padding: 12px;
                border-radius: 8px;
                border: 1px solid ${theme.border};
                background: ${theme.background};
                color: ${theme.text};
                min-height: 100px;
                resize: vertical;
                font-size: 14px;
                &:focus {
                  outline: none;
                  border-color: ${theme.primary};
                }
              `}
            />
          </div>

          {/* Advanced Options */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
            background: ${theme.background};
            border-radius: 12px;
            border: 1px solid ${theme.border};
            padding: 20px;
          `}>
            <h3 css={css`
              margin: 0;
              font-size: 18px;
              display: flex;
              align-items: center;
              gap: 8px;
            `}>
              <span>⚙️</span> Advanced Options
            </h3>

            {/* Art Style */}
            <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
              <label css={css`font-weight: 500; font-size: 14px;`}>Art Style</label>
              <div css={css`display: flex; gap: 12px;`}>
                {['realistic', 'sculpture'].map(style => (
                  <button
                    key={style}
                    onClick={() => {
                      setArtStyle(style)
                      if (style === 'sculpture') setEnablePbr(false)
                    }}
                    css={css`
                      padding: 8px 16px;
                      border-radius: 8px;
                      border: 1px solid ${artStyle === style ? theme.primary : theme.border};
                      background: ${artStyle === style ? `${theme.primary}22` : 'transparent'};
                      color: ${artStyle === style ? theme.primary : theme.text};
                      cursor: pointer;
                      transition: all 0.2s ease;
                      text-transform: capitalize;
                      &:hover {
                        border-color: ${theme.primary};
                      }
                    `}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Topology */}
            <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
              <label css={css`font-weight: 500; font-size: 14px;`}>Mesh Topology</label>
              <div css={css`display: flex; gap: 12px;`}>
                {['triangle', 'quad'].map(type => (
                  <button
                    key={type}
                    onClick={() => setTopology(type)}
                    css={css`
                      padding: 8px 16px;
                      border-radius: 8px;
                      border: 1px solid ${topology === type ? theme.primary : theme.border};
                      background: ${topology === type ? `${theme.primary}22` : 'transparent'};
                      color: ${topology === type ? theme.primary : theme.text};
                      cursor: pointer;
                      transition: all 0.2s ease;
                      text-transform: capitalize;
                      &:hover {
                        border-color: ${theme.primary};
                      }
                    `}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Polycount */}
            <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
              <label css={css`font-weight: 500; font-size: 14px;`}>
                Target Polygon Count: {targetPolycount.toLocaleString()}
              </label>
              <input
                type="range"
                min="10000"
                max="300000"
                step="1000"
                value={targetPolycount}
                onChange={(e) => setTargetPolycount(parseInt(e.target.value))}
                css={css`
                  width: 100%;
                  accent-color: ${theme.primary};
                `}
              />
              <div css={css`
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                color: ${theme.textSecondary};
              `}>
                <span>10,000</span>
                <span>300,000</span>
              </div>
            </div>

            {/* Symmetry Mode */}
            <div css={css`display: flex; flex-direction: column; gap: 8px;`}>
              <label css={css`font-weight: 500; font-size: 14px;`}>Symmetry Mode</label>
              <div css={css`display: flex; gap: 12px;`}>
                {['off', 'auto', 'on'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSymmetryMode(mode)}
                    css={css`
                      padding: 8px 16px;
                      border-radius: 8px;
                      border: 1px solid ${symmetryMode === mode ? theme.primary : theme.border};
                      background: ${symmetryMode === mode ? `${theme.primary}22` : 'transparent'};
                      color: ${symmetryMode === mode ? theme.primary : theme.text};
                      cursor: pointer;
                      transition: all 0.2s ease;
                      text-transform: capitalize;
                      &:hover {
                        border-color: ${theme.primary};
                      }
                    `}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Options */}
            <div css={css`display: flex; flex-wrap: wrap; gap: 12px;`}>
              <button
                onClick={() => setShouldRemesh(!shouldRemesh)}
                css={css`
                  padding: 8px 16px;
                  border-radius: 8px;
                  border: 1px solid ${shouldRemesh ? theme.primary : theme.border};
                  background: ${shouldRemesh ? `${theme.primary}22` : 'transparent'};
                  color: ${shouldRemesh ? theme.primary : theme.text};
                  cursor: pointer;
                  transition: all 0.2s ease;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  &:hover {
                    border-color: ${theme.primary};
                  }
                `}
              >
                <span>{shouldRemesh ? '✓' : ''}</span>
                Enable Remeshing
              </button>

              <button
                onClick={() => setEnablePbr(!enablePbr)}
                disabled={artStyle === 'sculpture'}
                css={css`
                  padding: 8px 16px;
                  border-radius: 8px;
                  border: 1px solid ${enablePbr ? theme.primary : theme.border};
                  background: ${enablePbr ? `${theme.primary}22` : 'transparent'};
                  color: ${enablePbr ? theme.primary : theme.text};
                  cursor: ${artStyle === 'sculpture' ? 'not-allowed' : 'pointer'};
                  opacity: ${artStyle === 'sculpture' ? 0.5 : 1};
                  transition: all 0.2s ease;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  &:hover {
                    border-color: ${artStyle === 'sculpture' ? theme.border : theme.primary};
                  }
                `}
              >
                <span>{enablePbr ? '✓' : ''}</span>
                Enable PBR Maps
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div css={css`
              color: ${theme.error};
              padding: 12px;
              border-radius: 8px;
              background: ${theme.error}22;
              border: 1px solid ${theme.error};
            `}>
              {error}
            </div>
          )}

          {/* Progress Bar */}
          {isGenerating && (
            <div css={css`
              display: flex;
              flex-direction: column;
              gap: 8px;
            `}>
              <div css={css`
                height: 4px;
                background: ${theme.border};
                border-radius: 2px;
                overflow: hidden;
              `}>
                <div css={css`
                  height: 100%;
                  width: ${progress}%;
                  background: ${theme.primary};
                  transition: width 0.3s ease;
                `} />
              </div>
              <div css={css`
                text-align: center;
                color: ${theme.textSecondary};
                font-size: 14px;
              `}>
                {progress < 25 ? 'Starting preview generation...' :
                 progress < 50 ? 'Generating preview...' :
                 progress < 75 ? 'Starting refinement...' :
                 progress < 100 ? 'Refining model...' :
                 'Complete! Model added to inventory'}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateModel}
            disabled={isGenerating || !apiKey || !prompt}
            css={css`
              padding: 16px;
              border-radius: 8px;
              border: none;
              background: ${theme.primary};
              color: white;
              font-weight: bold;
              cursor: ${isGenerating ? 'not-allowed' : 'pointer'};
              opacity: ${isGenerating || !apiKey || !prompt ? 0.5 : 1};
              transition: all 0.2s ease;
              font-size: 16px;

              &:hover {
                opacity: ${isGenerating || !apiKey || !prompt ? 0.5 : 0.9};
                transform: ${isGenerating || !apiKey || !prompt ? 'none' : 'translateY(-1px)'};
              }
            `}
          >
            {isGenerating ? 'Generating...' : 'Generate Model'}
          </button>
        </div>
      )}
    </div>
  )
} 