import { css } from '@firebolt-dev/css'
import React, { useState, useEffect } from 'react'

export function WorldInspector({ theme }) {
  const [worldData, setWorldData] = useState(null)
  const [selectedObject, setSelectedObject] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState(new Set())

  // Update world data periodically
  useEffect(() => {
    const updateWorldData = () => {
      const world = window.world
      if (!world) return

      const data = {
        systems: {},
        entities: [],
        components: {}
      }

      // Get systems
      world.systems.forEach(system => {
        data.systems[system.constructor.name] = {
          type: 'system',
          name: system.constructor.name,
          items: system.items instanceof Map ? Array.from(system.items.entries()) : system.items,
          hot: system.hot instanceof Set ? Array.from(system.hot) : system.hot
        }
      })

      // Get entities
      world.entities.items.forEach((entity, id) => {
        data.entities.push({
          id,
          type: entity.data.type,
          blueprint: entity.data.blueprint,
          position: entity.base?.position?.toArray(),
          rotation: entity.base?.quaternion?.toArray(),
          scale: entity.base?.scale?.toArray()
        })
      })

      // Get components
      Object.entries(world.components).forEach(([name, component]) => {
        data.components[name] = {
          type: 'component',
          name,
          factory: component.toString()
        }
      })

      setWorldData(data)
    }

    const interval = setInterval(updateWorldData, 1000)
    updateWorldData()

    return () => clearInterval(interval)
  }, [])

  const toggleNode = (id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const renderValue = (value) => {
    if (Array.isArray(value)) {
      return `[${value.map(v => typeof v === 'number' ? v.toFixed(2) : v).join(', ')}]`
    }
    if (typeof value === 'object' && value !== null) {
      return '{...}'
    }
    return String(value)
  }

  const renderObject = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return null

    return Object.entries(obj).map(([key, value]) => {
      const id = `${path}${key}`
      const isExpanded = expandedNodes.has(id)
      const hasChildren = value && typeof value === 'object'

      return (
        <div 
          key={id}
          css={css`
            margin-left: 20px;
          `}
        >
          <div 
            onClick={() => {
              if (hasChildren) toggleNode(id)
              setSelectedObject(value)
            }}
            css={css`
              display: flex;
              align-items: center;
              gap: 5px;
              padding: 2px 5px;
              cursor: pointer;
              border-radius: 4px;
              
              &:hover {
                background: ${theme.primary}22;
              }
            `}
          >
            {hasChildren && (
              <span css={css`
                font-family: monospace;
                color: ${theme.primary};
              `}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            <span css={css`
              color: ${theme.text};
              font-family: monospace;
            `}>
              {key}:
            </span>
            <span css={css`
              color: ${theme.textSecondary};
              font-family: monospace;
            `}>
              {renderValue(value)}
            </span>
          </div>
          {isExpanded && hasChildren && renderObject(value, `${id}.`)}
        </div>
      )
    })
  }

  const renderDetails = (obj) => {
    if (!obj) return null

    return (
      <div css={css`
        padding: 10px;
        background: ${theme.background}88;
        border-radius: 8px;
        border: 1px solid ${theme.border};
      `}>
        <h3 css={css`
          margin: 0 0 10px 0;
          color: ${theme.text};
          font-size: 14px;
        `}>
          Object Details
        </h3>
        <pre css={css`
          margin: 0;
          color: ${theme.textSecondary};
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-all;
        `}>
          {JSON.stringify(obj, null, 2)}
        </pre>
      </div>
    )
  }

  if (!worldData) {
    return (
      <div css={css`
        padding: 20px;
        color: ${theme.textSecondary};
      `}>
        Loading world data...
      </div>
    )
  }

  return (
    <div css={css`
      display: flex;
      height: 100%;
      gap: 20px;
      padding: 20px;
      color: ${theme.text};
      font-size: 12px;
    `}>
      {/* Tree View */}
      <div css={css`
        flex: 1;
        overflow: auto;
        background: ${theme.background}88;
        border-radius: 8px;
        border: 1px solid ${theme.border};
        padding: 10px;
      `}>
        <h3 css={css`margin: 0 0 10px 0;`}>World Hierarchy</h3>
        {renderObject(worldData)}
      </div>

      {/* Details Panel */}
      <div css={css`
        width: 300px;
        overflow: auto;
      `}>
        {renderDetails(selectedObject)}
      </div>
    </div>
  )
} 