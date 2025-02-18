import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'
import { hyperFoneOS } from '../hyperfoneOS'

export function HomeScreen({ theme, setActiveApp, installedApps, layout, hiddenApps, setIsOpen }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draggedApp, setDraggedApp] = useState(null)
  const [currentPage, setCurrentPage] = useState(() => layout.currentPage)
  const [showHiddenApps, setShowHiddenApps] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState(null)
  const [touchStartTime, setTouchStartTime] = useState(0)

  // Get visible apps for current page
  const getVisibleApps = () => {
    const page = layout.pages.find(p => p.id === currentPage)
    if (!page) return []

    return page.apps
      .filter(id => !hiddenApps.includes(id))
      .map(id => ({
        id,
        ...installedApps[id]
      }))
      .filter(app => app.name)
  }

  // Get hidden apps
  const getHiddenApps = () => {
    return hiddenApps
      .map(id => ({
        id,
        ...installedApps[id]
      }))
      .filter(app => app.name)
  }

  const handleDragStart = (e, appId) => {
    if (!isEditing) return
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', appId)
    setDraggedApp(appId)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedApp || !isEditing) return
    
    const currentPageObj = layout.pages.find(p => p.id === currentPage)
    if (!currentPageObj) return
    
    // Get the actual indices
    const oldIndex = currentPageObj.apps.indexOf(draggedApp)
    if (oldIndex === -1) return // App not found
    
    // Create new array with reordered apps
    const newApps = [...currentPageObj.apps]
    newApps.splice(oldIndex, 1) // Remove from old position
    newApps.splice(index, 0, draggedApp) // Insert at new position
    
    // Update layout through hyperFoneOS
    hyperFoneOS.updateHomePageApps(currentPage, newApps)
  }

  const handleDragEnd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedApp(null)
  }

  const toggleAppVisibility = (appId) => {
    const app = installedApps[appId]
    if (app?.isSystem) return
    
    if (hiddenApps.includes(appId)) {
      hyperFoneOS.showApp(appId)
    } else {
      hyperFoneOS.hideApp(appId)
    }
  }

  // Handle long press
  const handleTouchStart = (e, app) => {
    e.preventDefault()
    const timer = setTimeout(() => {
      setIsEditing(true)
    }, 500)
    setLongPressTimer(timer)
    setTouchStartTime(Date.now())
  }

  const handleTouchEnd = (e, app) => {
    e.preventDefault()
    clearTimeout(longPressTimer)
    if (Date.now() - touchStartTime < 500 && !isEditing) {
      setActiveApp(app.id)
    }
  }

  const handleMouseDown = (e, app) => {
    if (isEditing) return
    e.preventDefault()
    const timer = setTimeout(() => {
      setIsEditing(true)
    }, 500)
    setLongPressTimer(timer)
    setTouchStartTime(Date.now())
  }

  const handleMouseUp = (e, app) => {
    if (isEditing) return
    e.preventDefault()
    clearTimeout(longPressTimer)
    if (Date.now() - touchStartTime < 500 && !isEditing) {
      setActiveApp(app.id)
    }
  }

  const handleMouseLeave = () => {
    clearTimeout(longPressTimer)
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
      padding: 20px;
      background: ${theme.background}11;
      backdrop-filter: blur(20px);
      border-radius: 12px;
      color: ${theme.text};
      overflow: hidden;
    `}>
      {/* Control Buttons Group */}
      <div css={css`
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 10px;
        z-index: 100;
      `}>
        <button
          onClick={() => {
            hyperFoneOS.setState({ activeApp: 'settings' });
          }}
          css={css`
            width: 40px;
            height: 40px;
            border-radius: 20px;
            background: ${theme.background}88;
            border: 1px solid ${theme.primary}44;
            color: ${theme.primary};
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            
            &:hover {
              background: ${theme.primary}22;
              border-color: ${theme.primary};
              box-shadow: 0 0 20px ${theme.primary}44;
              transform: translateY(-2px);
            }

            &:active {
              transform: scale(0.95);
            }
          `}
        >
          ⚙️
        </button>

        <button
          onClick={() => hyperFoneOS.lock()}
          css={css`
            width: 40px;
            height: 40px;
            border-radius: 20px;
            background: ${theme.background}88;
            border: 1px solid ${theme.primary}44;
            color: ${theme.primary};
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            
            &:hover {
              background: ${theme.primary}22;
              border-color: ${theme.primary};
              box-shadow: 0 0 20px ${theme.primary}44;
              transform: translateY(-2px);
            }

            &:active {
              transform: scale(0.95);
            }
          `}
        >
          {'🔒'}
        </button>

        <button
          onClick={() => {
            hyperFoneOS.closeApp();
            hyperFoneOS.lock();
            setIsOpen(false);
          }}
          css={css`
            width: 40px;
            height: 40px;
            border-radius: 20px;
            background: ${theme.background}88;
            border: 1px solid ${theme.error}44;
            color: ${theme.error};
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            
            &:hover {
              background: ${theme.error}22;
              border-color: ${theme.error};
              box-shadow: 0 0 20px ${theme.error}44;
              transform: translateY(-2px);
            }

            &:active {
              transform: scale(0.95);
            }
          `}
        >
          ⚡
        </button>
      </div>

      {/* Edit Mode Toggle */}
      {isEditing && (
        <div css={css`
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 20px;
        `}>
          <button
            css={css`
              background: ${theme.primary}22;
              border: 1px solid ${theme.primary}44;
              color: ${theme.primary};
              font-family: 'Courier New', monospace;
              font-size: 14px;
              cursor: pointer;
              padding: 8px 16px;
              border-radius: 8px;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              backdrop-filter: blur(10px);
              
              &:hover {
                background: ${theme.primary}33;
                border-color: ${theme.primary};
                box-shadow: 0 0 20px ${theme.primary}44;
                transform: translateY(-2px);
              }
            `}
            onClick={() => {
              setIsEditing(false)
              setShowHiddenApps(false)
            }}
          >
            DONE
          </button>
          <button
            css={css`
              background: ${theme.primary}22;
              border: 1px solid ${theme.primary}44;
              color: ${theme.primary};
              font-family: 'Courier New', monospace;
              font-size: 14px;
              cursor: pointer;
              padding: 8px 16px;
              border-radius: 8px;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              backdrop-filter: blur(10px);
              
              &:hover {
                background: ${theme.primary}33;
                border-color: ${theme.primary};
                box-shadow: 0 0 20px ${theme.primary}44;
                transform: translateY(-2px);
              }
            `}
            onClick={() => setShowHiddenApps(!showHiddenApps)}
          >
            {showHiddenApps ? 'HIDE_APPS' : 'SHOW_HIDDEN'}
          </button>
        </div>
      )}

      {/* Page Selector */}
      <div css={css`
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        overflow-x: auto;
        padding-bottom: 10px;
        
        &::-webkit-scrollbar {
          height: 4px;
        }
        
        &::-webkit-scrollbar-track {
          background: ${theme.background}44;
          border-radius: 2px;
        }
        
        &::-webkit-scrollbar-thumb {
          background: ${theme.primary}44;
          border-radius: 2px;
        }
      `}>
        {layout.pages.map(page => (
          <div
            key={page.id}
            css={css`
              position: relative;
              display: flex;
              align-items: center;
              gap: 4px;
            `}
          >
            <button
              css={css`
                background: ${currentPage === page.id ? theme.primary : 'transparent'};
                border: 1px solid ${currentPage === page.id ? theme.primary : theme.primary}44;
                color: ${currentPage === page.id ? theme.background : theme.primary};
                padding: 8px 16px;
                border-radius: 8px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                
                &:hover {
                  background: ${theme.primary}22;
                  border-color: ${theme.primary};
                  box-shadow: 0 0 20px ${theme.primary}44;
                  transform: translateY(-2px);
                }
              `}
              onClick={() => setCurrentPage(page.id)}
            >
              {page.name}
            </button>
            {isEditing && page.id !== 'main' && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete page "${page.name}"?`)) {
                    hyperFoneOS.deleteHomePage(page.id)
                    if (currentPage === page.id) {
                      setCurrentPage('main')
                    }
                  }
                }}
                css={css`
                  width: 24px;
                  height: 24px;
                  padding: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}44;
                  color: ${theme.primary};
                  font-size: 14px;
                  border-radius: 8px;
                  cursor: pointer;
                  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                  backdrop-filter: blur(10px);
                  
                  &:hover {
                    background: ${theme.error}22;
                    border-color: ${theme.error};
                    color: ${theme.error};
                    box-shadow: 0 0 20px ${theme.error}44;
                    transform: translateY(-2px);
                  }
                `}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {isEditing && (
          <button
            css={css`
              background: none;
              border: 1px dashed ${theme.primary}44;
              color: ${theme.primary};
              padding: 8px 16px;
              border-radius: 8px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              cursor: pointer;
              white-space: nowrap;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              backdrop-filter: blur(10px);
              
              &:hover {
                border-color: ${theme.primary};
                box-shadow: 0 0 20px ${theme.primary}44;
                transform: translateY(-2px);
              }
            `}
            onClick={() => {
              const name = prompt('Enter page name:')
              if (name) {
                const newPageId = hyperFoneOS.createHomePage(name)
                setCurrentPage(newPageId)
              }
            }}
          >
            + NEW_PAGE
          </button>
        )}
      </div>

      {/* App Grid */}
      <div css={css`
        flex: 1;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 24px;
        padding: 24px;
        justify-items: center;
        align-content: start;
        overflow-y: auto;
        
        @media (min-width: 768px) {
          grid-template-columns: repeat(6, 1fr);
        }

        &::-webkit-scrollbar {
          width: 4px;
        }
        
        &::-webkit-scrollbar-track {
          background: ${theme.background}44;
          border-radius: 2px;
        }
        
        &::-webkit-scrollbar-thumb {
          background: ${theme.primary}44;
          border-radius: 2px;
        }
      `}>
        {getVisibleApps().map((app, index) => (
          <div
            key={app.id}
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, app.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            css={css`
              position: relative;
              opacity: ${draggedApp === app.id ? 0.5 : 1};
              width: 80px;
              cursor: ${isEditing ? 'grab' : 'default'};
              transition: opacity 0.2s ease;
              
              &:active {
                cursor: grabbing;
              }
              
              ${isEditing && css`
                animation: wiggle 1s ease infinite;
                @keyframes wiggle {
                  0% { transform: rotate(0deg); }
                  25% { transform: rotate(-2deg); }
                  75% { transform: rotate(2deg); }
                  100% { transform: rotate(0deg); }
                }
              `}
            `}
          >
            <button
              onTouchStart={(e) => handleTouchStart(e, app)}
              onTouchEnd={(e) => handleTouchEnd(e, app)}
              onMouseDown={(e) => handleMouseDown(e, app)}
              onMouseUp={(e) => handleMouseUp(e, app)}
              onMouseLeave={handleMouseLeave}
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                width: 100%;
                background: none;
                border: none;
                color: ${theme.text};
                cursor: ${isEditing ? 'move' : 'pointer'};
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                user-select: none;
                -webkit-user-select: none;
                -webkit-touch-callout: none;
                pointer-events: ${isEditing ? 'none' : 'auto'};
                
                &:hover {
                  transform: ${isEditing ? 'none' : 'scale(1.1)'};
                }
              `}
            >
              <div css={css`
                width: 64px;
                height: 64px;
                background: ${theme.background}dd;
                backdrop-filter: blur(10px);
                border: 1px solid ${theme.primary}44;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                position: relative;
                overflow: hidden;
                box-shadow: 
                  0 4px 12px ${theme.primary}22,
                  inset 0 0 0 1px ${theme.primary}22;
                
                &:before {
                  content: '';
                  position: absolute;
                  inset: 0;
                  background: linear-gradient(
                    135deg,
                    transparent,
                    ${theme.primary}22,
                    transparent
                  );
                }

                &:after {
                  content: '';
                  position: absolute;
                  inset: -1px;
                  border: 1px solid ${theme.primary}22;
                  border-radius: 16px;
                  background: linear-gradient(
                    135deg,
                    transparent,
                    ${theme.primary}11,
                    transparent
                  );
                }
              `}>
                {app.icon}
              </div>
              <div css={css`
                font-size: 12px;
                font-family: 'Courier New', monospace;
                text-align: center;
                color: ${theme.text};
                text-shadow: 0 2px 4px ${theme.background};
                background: ${theme.background}88;
                padding: 4px 8px;
                border-radius: 4px;
                backdrop-filter: blur(4px);
              `}>
                {app.name}
              </div>
            </button>
            {isEditing && !app.isSystem && (
              <button
                onClick={() => toggleAppVisibility(app.id)}
                css={css`
                  position: absolute;
                  top: -8px;
                  right: -8px;
                  width: 24px;
                  height: 24px;
                  border-radius: 12px;
                  background: ${theme.background}ee;
                  border: 1px solid ${theme.primary}44;
                  color: ${theme.primary};
                  font-size: 14px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                  backdrop-filter: blur(10px);
                  box-shadow: 0 2px 8px ${theme.primary}22;
                  z-index: 10;
                  
                  &:hover {
                    background: ${theme.primary}22;
                    border-color: ${theme.primary};
                    box-shadow: 0 0 20px ${theme.primary}44;
                    transform: scale(1.1);
                  }
                `}
              >
                {hiddenApps.includes(app.id) ? '+' : '×'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Dock */}
      <div css={css`
        position: relative;
        margin: 20px auto;
        padding: 12px;
        background: ${theme.background}88;
        backdrop-filter: blur(20px);
        border-radius: 20px;
        border: 1px solid ${theme.primary}22;
        display: flex;
        gap: 16px;
        justify-content: center;
        box-shadow: 
          0 4px 24px ${theme.primary}22,
          inset 0 0 0 1px ${theme.primary}22;

        &:before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            ${theme.primary}11,
            transparent
          );
          border-radius: 20px;
          pointer-events: none;
        }
      `}>
        {getVisibleApps().slice(0, 4).map(app => (
          <button
            key={app.id}
            onClick={() => setActiveApp(app.id)}
            css={css`
              width: 56px;
              height: 56px;
              background: ${theme.background}dd;
              border: 1px solid ${theme.primary}44;
              border-radius: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              position: relative;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 
                0 4px 12px ${theme.primary}22,
                inset 0 0 0 1px ${theme.primary}22;

              &:hover {
                transform: translateY(-4px) scale(1.05);
                box-shadow: 
                  0 8px 24px ${theme.primary}44,
                  inset 0 0 0 1px ${theme.primary}44;
              }

              &:active {
                transform: scale(0.95);
              }

              &:before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(
                  135deg,
                  transparent,
                  ${theme.primary}22,
                  transparent
                );
                border-radius: 14px;
              }
            `}
          >
            {app.icon}
          </button>
        ))}
      </div>

      {/* Hidden Apps Section */}
      {isEditing && showHiddenApps && getHiddenApps().length > 0 && (
        <div css={css`
          margin-top: 20px;
          padding: 20px;
          border-top: 1px solid ${theme.primary}22;
          background: ${theme.background}11;
          backdrop-filter: blur(10px);
          border-radius: 12px;
        `}>
          <div css={css`
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: ${theme.primary};
            margin-bottom: 20px;
            text-shadow: 0 0 10px ${theme.primary}44;
          `}>
            HIDDEN_APPS
          </div>
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 20px;
            justify-items: center;
          `}>
            {getHiddenApps().map(app => (
              <div
                key={app.id}
                css={css`
                  position: relative;
                  width: 80px;
                `}
              >
                <button
                  css={css`
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    background: none;
                    border: none;
                    color: ${theme.text};
                    opacity: 0.5;
                    transition: opacity 0.2s ease;

                    &:hover {
                      opacity: 0.8;
                    }
                  `}
                >
                  <div css={css`
                    width: 60px;
                    height: 60px;
                    background: ${theme.background}dd;
                    backdrop-filter: blur(10px);
                    border: 1px solid ${theme.primary}44;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 28px;
                    box-shadow: 
                      0 4px 12px ${theme.primary}22,
                      inset 0 0 0 1px ${theme.primary}22;
                  `}>
                    {app.icon}
                  </div>
                  <div css={css`
                    font-size: 12px;
                    font-family: 'Courier New', monospace;
                    text-align: center;
                    text-shadow: 0 2px 4px ${theme.background};
                  `}>
                    {app.name}
                  </div>
                </button>
                <button
                  onClick={() => toggleAppVisibility(app.id)}
                  css={css`
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 12px;
                    background: ${theme.background}ee;
                    border: 1px solid ${theme.primary}44;
                    color: ${theme.primary};
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 2px 8px ${theme.primary}22;
                    
                    &:hover {
                      background: ${theme.primary}22;
                      border-color: ${theme.primary};
                      box-shadow: 0 0 20px ${theme.primary}44;
                      transform: scale(1.1);
                    }
                  `}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 