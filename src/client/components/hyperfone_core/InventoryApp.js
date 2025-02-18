/*
 * Core Inventory App
 * Built-in inventory management for Hyperfy
 */

import { css } from '@firebolt-dev/css'
import { useState, useEffect, useRef } from 'react'
import { useAuthContext } from '../../components/AuthProvider'
import { uuid } from '../../../core/utils'
import * as THREE from '../../../core/extras/three'
import { PencilIcon, InfinityIcon, BoxIcon, GlobeIcon } from 'lucide-react'

// Simple 3D preview component
function ModelPreview({ blueprint, size = 150 }) {
  const containerRef = useRef()

  useEffect(() => {
    if (!containerRef.current || !blueprint) return
    
    const blueprintData = window.world.blueprints.get(blueprint)
    if (!blueprintData?.model) return

    // Create basic Three.js setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
    camera.position.set(0, 0.5, 2)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(size, size)
    renderer.setClearColor(0x000000, 0)
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)

    // Add light
    const light = new THREE.AmbientLight(0xffffff, 1)
    scene.add(light)

    // Get model from loader
    const model = window.world.loader.get('model', blueprintData.model)
    if (model?.scene) {
      const modelScene = model.scene.clone()
      scene.add(modelScene)

      // Auto-scale model
      const box = new THREE.Box3().setFromObject(modelScene)
      const modelSize = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z)
      const scale = 1 / maxDim
      modelScene.scale.setScalar(scale)

      // Center model
      const center = box.getCenter(new THREE.Vector3())
      modelScene.position.sub(center.multiplyScalar(scale))

      // Animation loop
      function animate() {
        modelScene.rotation.y += 0.01
        renderer.render(scene, camera)
        return requestAnimationFrame(animate)
      }
      const animationFrame = animate()

      return () => {
        cancelAnimationFrame(animationFrame)
        renderer.dispose()
        containerRef.current?.remove()
      }
    }

    return () => {
      renderer.dispose()
      containerRef.current?.remove()
    }
  }, [blueprint, size])

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: size, 
        height: size,
        background: '#000'
      }} 
    />
  )
}

export function InventoryApp() {
  const { user } = useAuthContext()
  const [items, setItems] = useState([])
  const [worldItems, setWorldItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingName, setEditingName] = useState(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [activeTab, setActiveTab] = useState('inventory')
  const [infiniteItems, setInfiniteItems] = useState(new Set())
  
  // Refs for 3D rendering
  const modelContainersRef = useRef(new Map())
  const renderersRef = useRef(new Map())
  const scenesRef = useRef(new Map())
  const camerasRef = useRef(new Map())
  const modelsRef = useRef(new Map())

  // Load inventory items
  useEffect(() => {
    loadInventory()
  }, [user])

  // Load world items
  useEffect(() => {
    const updateWorldItems = () => {
      const items = []
      
      // Get all entities using get() and filter
      const allEntities = []
      for (let i = 0; i < 1000; i++) { // Reasonable limit to prevent infinite loops
        const entity = window.world.entities.get(i)
        if (!entity) continue
        
        // Only include app entities that have blueprints
        if (entity.type === 'app' && entity.blueprint) {
          const blueprint = window.world.blueprints.get(entity.blueprint)
          if (blueprint) {
            items.push({
              id: entity.id,
              blueprint: entity.blueprint,
              name: blueprint.name || 'Unnamed Item',
              description: blueprint.description || '',
              position: entity.base.position.toArray(),
              model: blueprint.model
            })
          }
        }
      }
      
      console.log('Found world items:', items)
      setWorldItems(items)
    }

    // Initial load
    updateWorldItems()

    // Subscribe to entity changes
    const onAdd = () => {
      console.log('Entity added')
      updateWorldItems()
    }
    const onRemove = () => {
      console.log('Entity removed')
      updateWorldItems()
    }
    window.world.entities.on('add', onAdd)
    window.world.entities.on('remove', onRemove)

    return () => {
      window.world.entities.off('add', onAdd)
      window.world.entities.off('remove', onRemove)
    }
  }, [])

  // Setup 3D rendering for each item
  useEffect(() => {
    // Cleanup old renderers
    renderersRef.current.forEach(renderer => renderer.dispose())
    renderersRef.current.clear()
    scenesRef.current.clear()
    camerasRef.current.clear()
    modelsRef.current.clear()

    const cleanupFunctions = []

    // Setup new renderers for each item
    const setupRenderer = async (containerId, blueprint) => {
      const container = modelContainersRef.current.get(containerId)
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return null

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      container.innerHTML = ''
      container.appendChild(renderer.domElement)

      // Create scene with cyberpunk atmosphere
      const scene = new THREE.Scene()
      
      // Add fog for depth
      scene.fog = new THREE.FogExp2(0x000000, 0.15)
      
      // Create camera
      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
      camera.position.set(0, 0.5, 2)
      camera.lookAt(0, 0, 0)

      // Add cyberpunk lighting
      const ambientLight = new THREE.AmbientLight(0x551bf9, 0.4)
      scene.add(ambientLight)
      
      const mainLight = new THREE.DirectionalLight(0x00ffff, 0.8)
      mainLight.position.set(1, 2, 3)
      scene.add(mainLight)
      
      const backLight = new THREE.DirectionalLight(0xff00ff, 0.5)
      backLight.position.set(-1, 1, -2)
      scene.add(backLight)

      // Add grid floor for preview window only
      if (containerId === 'details') {
        const grid = new THREE.GridHelper(4, 10, 0x551bf9, 0x551bf944)
        grid.position.y = -0.5
        scene.add(grid)
      }

      // Store refs
      renderersRef.current.set(containerId, renderer)
      scenesRef.current.set(containerId, scene)
      camerasRef.current.set(containerId, camera)

      // Load model if blueprint exists
      if (blueprint && window.world?.blueprints) {
        try {
          const blueprintData = window.world.blueprints.get(blueprint)
          if (!blueprintData) {
            console.warn('Blueprint not found:', blueprint)
            return null
          }

          // Try to get the model from the loader
          let model = window.world.loader.get('model', blueprintData.model)
          if (!model) {
            // If not found, try to load it
            model = await window.world.loader.load('model', blueprintData.model)
          }

          if (model) {
            // Create a group to hold the model
            const group = new THREE.Group()
            
            // Clone the model scene
            const modelScene = model.scene.clone()
            group.add(modelScene)
            
            // Scale and center the model
            const box = new THREE.Box3().setFromObject(group)
            const size = box.getSize(new THREE.Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            const scale = 1 / maxDim
            group.scale.setScalar(scale)
            
            const center = box.getCenter(new THREE.Vector3())
            group.position.sub(center.multiplyScalar(scale))
            
            // Add to scene
            scene.add(group)
            modelsRef.current.set(containerId, group)

            // Adjust camera based on container
            if (containerId === 'details') {
              camera.position.z = 3
            } else {
              camera.position.z = 2
            }

            // Start animation loop
            let animationFrame
            const animate = () => {
              animationFrame = requestAnimationFrame(animate)
              if (modelsRef.current.has(containerId)) {
                const model = modelsRef.current.get(containerId)
                if (model) {
                  model.rotation.y += 0.01
                }
              }
              renderer.render(scene, camera)
            }
            animate()

            // Return cleanup function
            return () => {
              cancelAnimationFrame(animationFrame)
              renderer.dispose()
              renderer.forceContextLoss()
              renderer.domElement.remove()
              container.innerHTML = ''
            }
          }
        } catch (err) {
          console.warn('Failed to load model for item:', blueprint, err)
        }
      }

      // If we get here without returning a cleanup function, create a default one
      return () => {
        renderer.dispose()
        renderer.forceContextLoss()
        renderer.domElement.remove()
        container.innerHTML = ''
      }
    }

    // Setup renderers for inventory items
    const setupItems = async () => {
      for (const item of items) {
        const cleanup = await setupRenderer(item.id, item.blueprint)
        if (cleanup) cleanupFunctions.push(cleanup)
      }

      // Setup renderer for details preview if an item is selected
      if (selectedItem) {
        const cleanup = await setupRenderer('details', selectedItem.blueprint)
        if (cleanup) cleanupFunctions.push(cleanup)
      }
    }

    setupItems()

    // Cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup()
        }
      })
    }
  }, [items, selectedItem])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      items.forEach(item => {
        const container = modelContainersRef.current.get(item.id)
        const renderer = renderersRef.current.get(item.id)
        const camera = camerasRef.current.get(item.id)
        
        if (container && renderer && camera) {
          const width = container.clientWidth
          const height = container.clientHeight
          
          if (width > 0 && height > 0) {
            renderer.setSize(width, height)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
          }
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [items])

  // Load inventory from storage
  const loadInventory = async () => {
    try {
      setIsLoading(true)
      const savedItems = localStorage.getItem('hyperfy_inventory')
      if (savedItems) {
        setItems(JSON.parse(savedItems))
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Failed to load inventory:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Save inventory to storage
  const saveInventory = (newItems) => {
    try {
      localStorage.setItem('hyperfy_inventory', JSON.stringify(newItems))
    } catch (err) {
      console.error('Failed to save inventory:', err)
    }
  }

  // Add item to inventory
  const addItem = (newItem) => {
    // Get the blueprint data if available
    let itemData = { ...newItem }
    if (newItem.blueprint && window.world?.blueprints) {
      try {
        const blueprint = window.world.blueprints.get(newItem.blueprint)
        if (blueprint) {
          // Get model and try to find a good name
          let model = window.world.loader.get('model', blueprint.model)
          let itemName = 'Unnamed Item'
          
          if (model?.scene) {
            // Try to find the best name by traversing the scene
            model.scene.traverse(node => {
              // Skip empty names or common technical names
              if (!node.name || 
                  node.name.toLowerCase().includes('scene') || 
                  node.name.toLowerCase().includes('root') ||
                  node.name.toLowerCase() === 'rigidbody') {
                return
              }
              
              // Found a good name
              itemName = node.name
                .replace(/_/g, ' ')  // Replace underscores with spaces
                .replace(/([A-Z])/g, ' $1') // Add spaces before capitals
                .trim()
            })
          }

          itemData = {
            ...itemData,
            model: blueprint.model,
            name: itemName,
            description: blueprint.description || ''
          }
        }
      } catch (err) {
        console.warn('Failed to get blueprint data:', err)
      }
    }

    const updatedItems = [...items]
    const existingItem = updatedItems.find(item => 
      // Match by blueprint instead of id to stack similar items
      item.blueprint === itemData.blueprint
    )
    
    if (existingItem) {
      existingItem.quantity += 1
    } else {
      updatedItems.push({
        ...itemData,
        id: uuid(),
        quantity: 1
      })
    }
    
    setItems(updatedItems)
    saveInventory(updatedItems)
  }

  // Remove item from inventory
  const removeItem = (itemId, quantity = 1) => {
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity - quantity)
        }
      }
      return item
    }).filter(item => item.quantity > 0)
    
    setItems(updatedItems)
    saveInventory(updatedItems)
    
    if (selectedItem?.id === itemId && !updatedItems.find(i => i.id === itemId)) {
      setSelectedItem(null)
    }
  }

  // Handle item selection
  const handleSelectItem = (item) => {
    setSelectedItem(item)
  }

  // Handle item use with infinite check
  const handleUseItem = async (item) => {
    try {
      const data = {
        id: uuid(),
        type: 'app',
        blueprint: item.blueprint,
        position: [0, 1, 0],
        quaternion: [0, 0, 0, 1],
        mover: window.world.network.id,
        uploader: null,
      }
      window.world.entities.add(data, true)
      
      // Only remove item if not infinite
      if (!infiniteItems.has(item.id)) {
        removeItem(item.id, 1)
      }
    } catch (err) {
      console.error('Failed to use item:', err)
    }
  }

  // Handle item drop with infinite check
  const handleDropItem = async (item) => {
    try {
      const player = window.world.entities.player
      const position = [...player.base.position.toArray()]
      position[1] += 0.5
      
      const data = {
        id: uuid(),
        type: 'app',
        blueprint: item.blueprint,
        position,
        quaternion: [0, 0, 0, 1],
        mover: null,
        uploader: null,
        scale: [0.3, 0.3, 0.3],
      }
      window.world.entities.add(data, true)
      
      // Only remove item if not infinite
      if (!infiniteItems.has(item.id)) {
        removeItem(item.id, 1)
      }
    } catch (err) {
      console.error('Failed to drop item:', err)
    }
  }

  // Handle name edit
  const startEditingName = (item) => {
    console.log('Start editing name for item:', item.id) // Debug log
    setEditingName(item.id)
    setEditingNameValue(item.name || '')
  }

  const saveEditingName = () => {
    console.log('Saving name:', editingName, editingNameValue) // Debug log
    if (!editingName) return

    const updatedItems = items.map(item => {
      if (item.id === editingName) {
        const updatedItem = {
          ...item,
          name: editingNameValue || 'Unnamed Item'
        }
        // If this is the selected item, update it too
        if (selectedItem?.id === item.id) {
          setSelectedItem(updatedItem)
        }
        return updatedItem
      }
      return item
    })

    setItems(updatedItems)
    saveInventory(updatedItems)
    setEditingName(null)
  }

  // Handle picking up world item
  const handlePickupWorldItem = (item) => {
    try {
      // Add to inventory
      window.hyperFoneInventory.addItem({
        blueprint: item.blueprint,
        name: item.name,
        description: item.description
      })

      // Remove from world
      const entity = window.world.entities.get(item.id)
      if (entity) {
        entity.destroy(true)
      }
    } catch (err) {
      console.error('Failed to pick up item:', err)
    }
  }

  // Toggle infinite status for an item
  const toggleInfinite = (itemId) => {
    setInfiniteItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Check if user is admin
  const isAdmin = user?.roles?.includes('admin')

  // Expose methods for external use
  window.hyperFoneInventory = {
    addItem,
    removeItem,
    getItems: () => items,
    useItem: handleUseItem,
    dropItem: handleDropItem
  }

  if (isLoading) {
    return (
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #00ffff;
        font-family: 'Courier New', monospace;
        text-shadow: 0 0 10px #00ffff;
      `}>
        LOADING...
      </div>
    )
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      color: #00ffff;
      font-family: 'Courier New', monospace;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: 
          linear-gradient(90deg, #00ffff03 1px, transparent 1px) 0 0 / 20px 20px,
          linear-gradient(0deg, #00ffff03 1px, transparent 1px) 0 0 / 20px 20px;
        pointer-events: none;
        z-index: 0;
      }

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.8) 100%);
        pointer-events: none;
        z-index: 0;
      }
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        padding: 15px;
        border-bottom: 1px solid #00ffff22;
        background: rgba(0, 0, 0, 0.5);
        position: relative;
        z-index: 1;
      `}>
        <div css={css`
          display: flex;
          gap: 10px;
        `}>
          <button
            onClick={() => setActiveTab('inventory')}
            css={css`
              background: ${activeTab === 'inventory' ? '#00ffff11' : 'transparent'};
              border: 1px solid ${activeTab === 'inventory' ? '#00ffff' : '#00ffff44'};
              color: ${activeTab === 'inventory' ? '#00ffff' : '#00ffff88'};
              padding: 8px 16px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              position: relative;
              overflow: hidden;

              &:hover {
                border-color: #00ffff;
                color: #00ffff;
                text-shadow: 0 0 10px #00ffff;
              }

              &::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 1px;
                background: linear-gradient(90deg, transparent, #00ffff, transparent);
                transform: translateX(${activeTab === 'inventory' ? '0' : '-100%'});
                transition: transform 0.3s ease;
              }
            `}
          >
            <BoxIcon size={16} />
            INVENTORY [{items.length}]
          </button>
          <button
            onClick={() => setActiveTab('world')}
            css={css`
              background: ${activeTab === 'world' ? '#00ffff11' : 'transparent'};
              border: 1px solid ${activeTab === 'world' ? '#00ffff' : '#00ffff44'};
              color: ${activeTab === 'world' ? '#00ffff' : '#00ffff88'};
              padding: 8px 16px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              position: relative;
              overflow: hidden;

              &:hover {
                border-color: #00ffff;
                color: #00ffff;
                text-shadow: 0 0 10px #00ffff;
              }

              &::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 1px;
                background: linear-gradient(90deg, transparent, #00ffff, transparent);
                transform: translateX(${activeTab === 'world' ? '0' : '-100%'});
                transition: transform 0.3s ease;
              }
            `}
          >
            <GlobeIcon size={16} />
            WORLD [{worldItems.length}]
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div css={css`
        display: flex;
        flex: 1;
        position: relative;
        z-index: 1;
      `}>
        {/* Items Grid */}
        <div css={css`
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          
          &::-webkit-scrollbar {
            width: 8px;
          }
          
          &::-webkit-scrollbar-track {
            background: #00ffff11;
          }
          
          &::-webkit-scrollbar-thumb {
            background: #00ffff33;
            border-radius: 4px;
            
            &:hover {
              background: #00ffff66;
            }
          }
        `}>
          {(activeTab === 'inventory' ? items : worldItems).length === 0 ? (
            <div css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              height: 200px;
              color: #00ffff88;
              text-align: center;
              font-size: 14px;
              border: 1px dashed #00ffff44;
              border-radius: 8px;
              background: #00ffff06;
            `}>
              {activeTab === 'inventory' ? (
                <>NO ITEMS IN INVENTORY<br />RIGHT-CLICK OBJECTS TO COLLECT</>
              ) : (
                <>NO ITEMS IN WORLD</>
              )}
            </div>
          ) : (
            <div css={css`
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
              gap: 15px;
            `}>
              {(activeTab === 'inventory' ? items : worldItems).map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  css={css`
                    background: #00ffff08;
                    border: 1px solid ${selectedItem?.id === item.id ? '#00ffff' : '#00ffff22'};
                    border-radius: 4px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    
                    &:hover {
                      border-color: #00ffff;
                      transform: translateY(-2px);
                      box-shadow: 0 0 20px #00ffff22;

                      &::before {
                        opacity: 1;
                      }
                    }

                    &::before {
                      content: '';
                      position: absolute;
                      inset: 0;
                      background: linear-gradient(45deg, transparent, #00ffff11);
                      opacity: 0;
                      transition: opacity 0.2s ease;
                      pointer-events: none;
                    }
                  `}
                >
                  <ModelPreview blueprint={item.blueprint} />
                  <div css={css`
                    padding: 10px;
                    border-top: 1px solid #00ffff22;
                    background: #00000066;
                  `}>
                    <div css={css`
                      display: flex;
                      align-items: center;
                      gap: 8px;
                    `}>
                      {editingName === item.id ? (
                        <input
                          type="text"
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          onBlur={saveEditingName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditingName()
                            if (e.key === 'Escape') {
                              setEditingName(null)
                              setEditingNameValue('')
                            }
                          }}
                          autoFocus
                          css={css`
                            flex: 1;
                            background: #00000088;
                            border: 1px solid #00ffff;
                            color: #00ffff;
                            padding: 4px 8px;
                            font-family: 'Courier New', monospace;
                            font-size: 12px;
                            outline: none;
                            
                            &:focus {
                              box-shadow: 0 0 10px #00ffff44;
                            }
                          `}
                        />
                      ) : (
                        <div css={css`
                          color: #00ffff;
                          font-size: 12px;
                          font-weight: 500;
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          flex: 1;
                          display: flex;
                          align-items: center;
                          gap: 6px;
                        `}>
                          {item.name}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditingName(item)
                            }}
                            css={css`
                              background: none;
                              border: none;
                              padding: 2px;
                              color: #00ffff44;
                              cursor: pointer;
                              transition: all 0.2s;
                              opacity: 0;

                              &:hover {
                                color: #00ffff;
                                transform: scale(1.1);
                              }

                              ${selectedItem?.id === item.id ? 'opacity: 1;' : ''}
                              div:hover & {
                                opacity: 1;
                              }
                            `}
                          >
                            <PencilIcon size={12} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleInfinite(item.id)
                              }}
                              css={css`
                                background: none;
                                border: none;
                                padding: 2px;
                                color: ${infiniteItems.has(item.id) ? '#00ffff' : '#00ffff44'};
                                cursor: pointer;
                                transition: all 0.2s;
                                opacity: 0;

                                &:hover {
                                  color: #00ffff;
                                  transform: scale(1.1);
                                }

                                ${selectedItem?.id === item.id ? 'opacity: 1;' : ''}
                                div:hover & {
                                  opacity: 1;
                                }
                              `}
                            >
                              <InfinityIcon size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      {activeTab === 'inventory' && (
                        <div css={css`
                          font-size: 12px;
                          color: #00ffff88;
                          padding: 2px 6px;
                          border: 1px solid #00ffff44;
                          border-radius: 4px;
                          background: #00ffff11;
                        `}>
                          {infiniteItems.has(item.id) ? '∞' : item.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        {selectedItem && (
          <div css={css`
            width: 300px;
            background: #00000099;
            border-left: 1px solid #00ffff22;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            position: relative;
            overflow: hidden;

            &::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 2px;
              background: linear-gradient(90deg, transparent, #00ffff44, transparent);
            }
          `}>
            {/* Preview Container */}
            <div css={css`
              aspect-ratio: 1;
              width: 100%;
              background: #00000066;
              border: 1px solid #00ffff22;
              border-radius: 4px;
              overflow: hidden;
              position: relative;
            `}>
              <ModelPreview blueprint={selectedItem.blueprint} size={260} />
            </div>
            
            {/* Info Container */}
            <div css={css`
              flex: 1;
              min-height: 0;
              display: flex;
              flex-direction: column;
              gap: 15px;
              overflow-y: auto;
              padding-right: 5px;
              
              &::-webkit-scrollbar {
                width: 4px;
              }
              
              &::-webkit-scrollbar-track {
                background: #00ffff11;
              }
              
              &::-webkit-scrollbar-thumb {
                background: #00ffff33;
                border-radius: 2px;
                
                &:hover {
                  background: #00ffff66;
                }
              }
            `}>
              <div css={css`
                padding: 15px;
                background: #00ffff08;
                border: 1px solid #00ffff22;
                border-radius: 4px;
              `}>
                <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  margin-bottom: 10px;
                `}>
                  <h2 css={css`
                    color: #00ffff;
                    font-size: 18px;
                    margin: 0;
                    flex: 1;
                    text-shadow: 0 0 10px #00ffff44;
                  `}>
                    {selectedItem.name}
                  </h2>
                  {activeTab === 'inventory' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditingName(selectedItem)
                        }}
                        css={css`
                          background: none;
                          border: none;
                          padding: 4px;
                          color: #00ffff88;
                          cursor: pointer;
                          transition: all 0.2s;

                          &:hover {
                            color: #00ffff;
                            transform: scale(1.1);
                          }
                        `}
                      >
                        <PencilIcon size={16} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => toggleInfinite(selectedItem.id)}
                          css={css`
                            background: none;
                            border: none;
                            padding: 4px;
                            color: ${infiniteItems.has(selectedItem.id) ? '#00ffff' : '#00ffff88'};
                            cursor: pointer;
                            transition: all 0.2s;

                            &:hover {
                              color: #00ffff;
                              transform: scale(1.1);
                            }
                          `}
                        >
                          <InfinityIcon size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
                
                <p css={css`
                  color: #00ffff88;
                  font-size: 14px;
                  margin: 0;
                  line-height: 1.4;
                `}>
                  {selectedItem.description}
                  {activeTab === 'world' && selectedItem.position && (
                    <div css={css`
                      margin-top: 10px;
                      padding-top: 10px;
                      border-top: 1px solid #00ffff22;
                      font-family: monospace;
                    `}>
                      POS: [{selectedItem.position.map(n => n.toFixed(2)).join(', ')}]
                    </div>
                  )}
                  {activeTab === 'inventory' && infiniteItems.has(selectedItem.id) && (
                    <div css={css`
                      margin-top: 10px;
                      padding-top: 10px;
                      border-top: 1px solid #00ffff22;
                      color: #00ffff;
                      font-style: italic;
                    `}>
                      ∞ INFINITE ITEM
                    </div>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div css={css`
              display: flex;
              gap: 10px;
            `}>
              {activeTab === 'inventory' ? (
                <>
                  <button
                    onClick={() => handleUseItem(selectedItem)}
                    css={css`
                      flex: 1;
                      background: #00ffff11;
                      border: 1px solid #00ffff;
                      color: #00ffff;
                      padding: 12px;
                      font-family: 'Courier New', monospace;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s;
                      position: relative;
                      overflow: hidden;

                      &:hover {
                        background: #00ffff22;
                        text-shadow: 0 0 10px #00ffff;
                      }

                      &::before {
                        content: '';
                        position: absolute;
                        top: -2px;
                        left: -2px;
                        right: -2px;
                        bottom: -2px;
                        background: linear-gradient(45deg, transparent, #00ffff33, transparent);
                        opacity: 0;
                        transition: opacity 0.2s;
                      }

                      &:hover::before {
                        opacity: 1;
                      }
                    `}
                  >
                    PLACE
                  </button>
                  <button
                    onClick={() => handleDropItem(selectedItem)}
                    css={css`
                      background: #ff000011;
                      border: 1px solid #ff0000;
                      color: #ff0000;
                      padding: 12px;
                      font-family: 'Courier New', monospace;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s;

                      &:hover {
                        background: #ff000022;
                        text-shadow: 0 0 10px #ff0000;
                      }
                    `}
                  >
                    DROP
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handlePickupWorldItem(selectedItem)}
                  css={css`
                    flex: 1;
                    background: #00ffff11;
                    border: 1px solid #00ffff;
                    color: #00ffff;
                    padding: 12px;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;

                    &:hover {
                      background: #00ffff22;
                      text-shadow: 0 0 10px #00ffff;
                    }
                  `}
                >
                  PICK UP
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 