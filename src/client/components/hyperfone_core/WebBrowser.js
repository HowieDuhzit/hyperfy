/*
 * Core Web Browser App
 * Built-in browser functionality for Hyperfy
 */

import { css } from '@firebolt-dev/css'
import { useState, useEffect, useRef } from 'react'
import React from 'react'

// Add this at the top, after imports
const scrollbarStyle = css`
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(85, 27, 249, 0.3);
    border-radius: 3px;
    transition: background 0.2s ease;
    
    &:hover {
      background: rgba(85, 27, 249, 0.5);
    }
  }
  
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(85, 27, 249, 0.3) rgba(0, 0, 0, 0.1);
`

// Tab component
const Tab = React.memo(({ tab, isActive, onActivate, onClose }) => {
  return (
    <div
      onClick={onActivate}
      css={css`
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: ${isActive ? 'rgba(85, 27, 249, 0.1)' : 'transparent'};
        border: 1px solid ${isActive ? '#551bf9' : 'transparent'};
        border-radius: 8px;
        cursor: pointer;
        min-width: 100px;
        max-width: 200px;
        transition: all 0.2s ease;
        
        &:hover {
          background: ${isActive ? 'rgba(85, 27, 249, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
        }
      `}
    >
      <img 
        src={tab.favicon || 'default-favicon.png'} 
        alt=""
        css={css`
          width: 16px;
          height: 16px;
          object-fit: contain;
        `}
      />
      <div css={css`
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: white;
        font-size: 13px;
      `}>
        {tab.title || tab.url}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        css={css`
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          opacity: 0.6;
          
          &:hover {
            opacity: 1;
          }
        `}
      >
        ×
      </button>
    </div>
  )
})

export function WebBrowser({ theme }) {
  const DEFAULT_HOMEPAGE = 'https://token.hyperfy.xyz/'
  const [tabs, setTabs] = useState([{ id: Date.now(), url: DEFAULT_HOMEPAGE, title: 'New Tab', icon: '🌐', loading: false }])
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)
  const [bookmarks, setBookmarks] = useState([])
  const [urlInput, setUrlInput] = useState(DEFAULT_HOMEPAGE)
  const [homepage, setHomepage] = useState(() => {
    const saved = localStorage.getItem('hyperfy_browser_homepage')
    return saved || DEFAULT_HOMEPAGE
  })
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const iframeRefs = useRef({})

  // Save homepage to localStorage
  useEffect(() => {
    localStorage.setItem('hyperfy_browser_homepage', homepage)
  }, [homepage])

  // Load bookmarks from localStorage
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('hyperfy_browser_bookmarks')
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks))
    }
  }, [])

  // Save bookmarks to localStorage
  useEffect(() => {
    localStorage.setItem('hyperfy_browser_bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])

  const getActiveTab = () => tabs.find(tab => tab.id === activeTabId)

  const updateTab = (tabId, updates) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, ...updates } : tab
    ))
  }

  const handleIframeLoad = (tabId) => {
    const iframe = iframeRefs.current[tabId]
    if (!iframe) return

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc) {
        updateTab(tabId, { loading: false })
        return
      }

      // Update URL first
      const currentUrl = iframe.contentWindow.location.href
      if (currentUrl !== 'about:blank') {
        setUrlInput(currentUrl)
        updateTab(tabId, { url: currentUrl })
      }

      // Initial title update
      const title = doc.title || currentUrl || 'New Tab'
      updateTab(tabId, { 
        title,
        loading: false 
      })

      // Initial favicon update
      const updateFavicon = () => {
        const favicon = doc.querySelector('link[rel="icon"]') || 
                       doc.querySelector('link[rel="shortcut icon"]') ||
                       doc.querySelector('link[rel="apple-touch-icon"]')
        if (favicon && favicon.href) {
          updateTab(tabId, { icon: favicon.href })
        }
      }
      updateFavicon()

      // Set up title observer
      const titleObserver = new MutationObserver(() => {
        const newTitle = doc.title || currentUrl || 'New Tab'
        updateTab(tabId, { title: newTitle })
      })
      titleObserver.observe(doc.querySelector('title') || doc.head || doc, {
        subtree: true,
        characterData: true,
        childList: true
      })

      // Set up favicon observer
      const faviconObserver = new MutationObserver(() => {
        updateFavicon()
      })
      faviconObserver.observe(doc.head || doc, {
        subtree: true,
        attributes: true,
        childList: true
      })

      // Clean up observers when tab changes or closes
      const cleanup = () => {
        titleObserver.disconnect()
        faviconObserver.disconnect()
      }

      // Store cleanup function
      return cleanup
    } catch (err) {
      console.error('Error updating tab info:', err)
      updateTab(tabId, { 
        loading: false,
        title: urlInput || 'New Tab',
        icon: '🌐'
      })
    }
  }

  // Handle tab changes
  useEffect(() => {
    let cleanup = null

    const activeTab = getActiveTab()
    if (activeTab) {
      const iframe = iframeRefs.current[activeTab.id]
      if (iframe && iframe.contentDocument) {
        cleanup = handleIframeLoad(activeTab.id)
      }
    }

    return () => {
      if (cleanup) cleanup()
    }
  }, [activeTabId])

  const addNewTab = () => {
    const newTab = { 
      id: Date.now(), 
      url: homepage,
      title: 'New Tab',
      icon: '🌐',
      loading: false 
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
    setUrlInput(homepage)
  }

  const closeTab = (tabId) => {
    if (tabs.length === 1) {
      // If it's the last tab, create a new empty tab
      const newTab = { 
        id: Date.now(), 
        url: homepage,
        title: 'New Tab',
        icon: '🌐',
        loading: false 
      }
      setTabs([newTab])
      setActiveTabId(newTab.id)
      setUrlInput(homepage)
    } else {
      // Remove the tab and switch to the previous one if necessary
      const tabIndex = tabs.findIndex(tab => tab.id === tabId)
      const newTabs = tabs.filter(tab => tab.id !== tabId)
      if (tabId === activeTabId) {
        const newActiveTab = newTabs[Math.max(0, tabIndex - 1)]
        setActiveTabId(newActiveTab.id)
        setUrlInput(newActiveTab.url || homepage)
      }
      setTabs(newTabs)
    }
  }

  const navigateToUrl = (url, tabId = activeTabId) => {
    // Add https:// if no protocol is specified
    let fullUrl = url
    if (!/^https?:\/\//i.test(url) && url !== '') {
      fullUrl = 'https://' + url
    }

    updateTab(tabId, { 
      url: fullUrl, 
      loading: true,
      title: 'Loading...',
      icon: '🌐'
    })
    setUrlInput(fullUrl)

    // Reset iframe to force reload
    const iframe = iframeRefs.current[tabId]
    if (iframe) {
      iframe.src = 'about:blank'
      setTimeout(() => {
        iframe.src = fullUrl
      }, 0)
    }
  }

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    navigateToUrl(urlInput)
  }

  const addBookmark = () => {
    const activeTab = getActiveTab()
    if (!activeTab?.url) return

    const newBookmark = {
      id: Date.now(),
      url: activeTab.url,
      title: activeTab.title,
      icon: activeTab.icon
    }

    setBookmarks(prev => [...prev, newBookmark])
  }

  const removeBookmark = (bookmarkId) => {
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId))
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${theme.background};
      color: ${theme.text};
    `}>
      {/* Browser Header */}
      <div css={css`
        padding: 8px;
        background: ${theme.background};
        border-bottom: 1px solid ${theme.border};
      `}>
        {/* Tab Bar */}
        <div css={css`
          display: flex;
          gap: 2px;
          margin-bottom: 8px;
          overflow-x: auto;
          &::-webkit-scrollbar {
            height: 2px;
          }
          &::-webkit-scrollbar-thumb {
            background: ${theme.border};
          }
        `}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id)
                setUrlInput(tab.url || '')
              }}
              css={css`
                flex: 0 0 180px;
                padding: 6px 10px;
                background: ${tab.id === activeTabId ? theme.border : 'transparent'};
                border-radius: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                position: relative;
                overflow: hidden;
                white-space: nowrap;
                transition: all 0.2s ease;
                
                &:hover {
                  background: ${theme.border};
                }
              `}
            >
              {tab.loading ? (
                <div css={css`
                  width: 14px;
                  height: 14px;
                  border: 2px solid ${theme.primary};
                  border-radius: 50%;
                  border-top-color: transparent;
                  animation: spin 1s linear infinite;
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}/>
              ) : (
                <img 
                  src={tab.icon} 
                  alt=""
                  width="14"
                  height="14"
                  onError={(e) => {
                    e.target.onerror = null
                    updateTab(tab.id, { icon: '🌐' })
                  }}
                  css={css`
                    width: 14px;
                    height: 14px;
                    object-fit: contain;
                  `}
                />
              )}
              <span css={css`
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 12px;
              `}>
                {tab.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                css={css`
                  padding: 2px;
                  background: none;
                  border: none;
                  color: ${theme.text};
                  opacity: 0.6;
                  cursor: pointer;
                  font-size: 14px;
                  
                  &:hover {
                    opacity: 1;
                  }
                `}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addNewTab}
            css={css`
              padding: 6px 10px;
              background: none;
              border: none;
              color: ${theme.text};
              cursor: pointer;
              opacity: 0.6;
              font-size: 14px;
              
              &:hover {
                opacity: 1;
                background: ${theme.border};
                border-radius: 6px;
              }
            `}
          >
            +
          </button>
        </div>

        {/* Navigation Bar */}
        <div css={css`
          display: flex;
          gap: 8px;
          align-items: center;
        `}>
          <button
            onClick={() => navigateToUrl(homepage)}
            css={css`
              padding: 6px;
              background: none;
              border: none;
              color: ${theme.text};
              cursor: pointer;
              opacity: 0.6;
              font-size: 16px;
              
              &:hover {
                opacity: 1;
              }
            `}
            title="Go to homepage"
          >
            🏠
          </button>
          <form
            onSubmit={handleUrlSubmit}
            css={css`
              flex: 1;
              display: flex;
              gap: 8px;
            `}
          >
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL or search"
              css={css`
                flex: 1;
                padding: 6px 10px;
                background: ${theme.background};
                border: 1px solid ${theme.border};
                border-radius: 6px;
                color: ${theme.text};
                font-size: 13px;
                
                &:focus {
                  outline: none;
                  border-color: ${theme.primary};
                }
              `}
            />
          </form>
          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            css={css`
              padding: 6px;
              background: none;
              border: none;
              color: ${theme.text};
              cursor: pointer;
              opacity: ${showBookmarks ? 1 : 0.6};
              font-size: 16px;
              
              &:hover {
                opacity: 1;
              }
            `}
            title="Toggle bookmarks"
          >
            {showBookmarks ? '★' : '☆'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            css={css`
              padding: 6px;
              background: none;
              border: none;
              color: ${theme.text};
              cursor: pointer;
              opacity: ${showSettings ? 1 : 0.6};
              font-size: 16px;
              
              &:hover {
                opacity: 1;
              }
            `}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div css={css`
        flex: 1;
        display: flex;
        position: relative;
      `}>
        {/* Browser Content */}
        <div css={css`
          flex: 1;
          position: relative;
        `}>
          {tabs.map(tab => (
            <iframe
              key={tab.id}
              ref={el => iframeRefs.current[tab.id] = el}
              src={tab.url}
              css={css`
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: none;
                display: ${tab.id === activeTabId ? 'block' : 'none'};
              `}
              onLoad={() => handleIframeLoad(tab.id)}
            />
          ))}
        </div>

        {/* Bookmarks Sidebar */}
        {showBookmarks && (
          <div css={css`
            width: 240px;
            background: ${theme.background};
            border-left: 1px solid ${theme.border};
            display: flex;
            flex-direction: column;
          `}>
            <div css={css`
              padding: 12px;
              border-bottom: 1px solid ${theme.border};
              display: flex;
              justify-content: space-between;
              align-items: center;
            `}>
              <span css={css`font-size: 14px; font-weight: 500;`}>Bookmarks</span>
              <button
                onClick={addBookmark}
                css={css`
                  padding: 4px 8px;
                  background: ${theme.primary};
                  border: none;
                  border-radius: 4px;
                  color: white;
                  font-size: 12px;
                  cursor: pointer;
                  
                  &:hover {
                    opacity: 0.9;
                  }
                `}
              >
                Add
              </button>
            </div>
            <div css={css`
              flex: 1;
              overflow-y: auto;
              padding: 8px;
              
              &::-webkit-scrollbar {
                width: 4px;
              }
              &::-webkit-scrollbar-thumb {
                background: ${theme.border};
                border-radius: 2px;
              }
            `}>
              {bookmarks.length === 0 ? (
                <div css={css`
                  padding: 20px;
                  text-align: center;
                  color: ${theme.textSecondary};
                  font-size: 13px;
                `}>
                  No bookmarks yet
                </div>
              ) : (
                bookmarks.map(bookmark => (
                  <div
                    key={bookmark.id}
                    onClick={() => navigateToUrl(bookmark.url)}
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      padding: 8px;
                      cursor: pointer;
                      border-radius: 4px;
                      
                      &:hover {
                        background: ${theme.border};
                      }
                    `}
                  >
                    <img 
                      src={bookmark.icon} 
                      alt=""
                      width="16"
                      height="16"
                      onError={(e) => {
                        e.target.onerror = null
                        e.target.src = '🌐'
                      }}
                      css={css`
                        width: 16px;
                        height: 16px;
                        object-fit: contain;
                      `}
                    />
                    <span css={css`
                      flex: 1;
                      font-size: 13px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    `}>
                      {bookmark.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeBookmark(bookmark.id)
                      }}
                      css={css`
                        padding: 2px;
                        background: none;
                        border: none;
                        color: ${theme.text};
                        opacity: 0;
                        cursor: pointer;
                        font-size: 14px;
                        
                        div:hover & {
                          opacity: 0.6;
                        }
                        
                        &:hover {
                          opacity: 1 !important;
                        }
                      `}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div css={css`
            width: 300px;
            background: ${theme.background};
            border-left: 1px solid ${theme.border};
            display: flex;
            flex-direction: column;
          `}>
            <div css={css`
              padding: 12px;
              border-bottom: 1px solid ${theme.border};
              font-size: 14px;
              font-weight: 500;
            `}>
              Browser Settings
            </div>
            <div css={css`
              flex: 1;
              overflow-y: auto;
              padding: 16px;
              
              &::-webkit-scrollbar {
                width: 4px;
              }
              &::-webkit-scrollbar-thumb {
                background: ${theme.border};
                border-radius: 2px;
              }
            `}>
              <div css={css`
                margin-bottom: 20px;
              `}>
                <label css={css`
                  display: block;
                  font-size: 13px;
                  margin-bottom: 8px;
                  color: ${theme.textSecondary};
                `}>
                  Homepage
                </label>
                <input
                  type="text"
                  value={homepage}
                  onChange={(e) => setHomepage(e.target.value)}
                  css={css`
                    width: 100%;
                    padding: 8px;
                    background: ${theme.background};
                    border: 1px solid ${theme.border};
                    border-radius: 4px;
                    color: ${theme.text};
                    font-size: 13px;
                    
                    &:focus {
                      outline: none;
                      border-color: ${theme.primary};
                    }
                  `}
                />
              </div>
              
              <button
                onClick={() => setHomepage(DEFAULT_HOMEPAGE)}
                css={css`
                  width: 100%;
                  padding: 8px;
                  background: ${theme.primary};
                  border: none;
                  border-radius: 4px;
                  color: white;
                  font-size: 13px;
                  cursor: pointer;
                  
                  &:hover {
                    opacity: 0.9;
                  }
                `}
              >
                Reset to Default
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 