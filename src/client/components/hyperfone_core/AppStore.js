import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'

export function AppStore({ theme, installedApps, onInstallApp, onUninstallApp }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchApps()
  }, [])

  const fetchApps = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch the apps directory contents from GitHub
      const response = await fetch('https://api.github.com/repos/HowieDuhzit/HyperFone_Apps/contents/')
      const data = await response.json()
      
      // Process each app file
      const appData = await Promise.all(data
        .filter(item => item.name.endsWith('.js'))
        .map(async (item) => {
          // Fetch the app's source code
          const sourceResponse = await fetch(item.download_url)
          const sourceCode = await sourceResponse.text()
          
          // Extract metadata from comments at the top of the file
          const metadataMatch = sourceCode.match(/\/\*\s*({[\s\S]*?})\s*\*\//)
          if (!metadataMatch) return null
          
          try {
            const metadata = JSON.parse(metadataMatch[1])
            return {
              id: item.name.replace('.js', ''),
              sourceCode,
              installed: installedApps.includes(item.name.replace('.js', '')),
              ...metadata
            }
          } catch (err) {
            console.error('Error parsing app metadata:', err)
            return null
          }
        }))

      setApps(appData.filter(app => app !== null))
    } catch (err) {
      setError('Failed to load apps. Please try again later.')
      console.error('Error fetching apps:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = async (app) => {
    try {
      // Install the app
      await onInstallApp({
        id: app.id,
        name: app.name,
        description: app.description,
        version: app.version,
        author: app.author,
        icon: app.icon,
        category: app.category,
        sourceCode: app.sourceCode,
        permissions: app.permissions || []
      })
      
      // Update the app's installed status
      setApps(apps.map(a => 
        a.id === app.id 
          ? { ...a, installed: true }
          : a
      ))
    } catch (err) {
      console.error('Error installing app:', err)
      alert('Failed to install app. Please try again.')
    }
  }

  const handleUninstall = async (app) => {
    try {
      await onUninstallApp(app.id)
      
      // Update the app's installed status
      setApps(apps.map(a => 
        a.id === app.id 
          ? { ...a, installed: false }
          : a
      ))
    } catch (err) {
      console.error('Error uninstalling app:', err)
      alert('Failed to uninstall app. Please try again.')
    }
  }

  if (loading) {
    return (
      <div css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${theme.text};
      `}>
        Loading apps...
      </div>
    )
  }

  if (error) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${theme.text};
        gap: 20px;
        padding: 20px;
      `}>
        <div>{error}</div>
        <button
          css={css`
            background: ${theme.primary};
            color: ${theme.background};
            border: none;
            padding: 10px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            
            &:hover {
              filter: brightness(1.1);
              transform: translateY(-2px);
            }
          `}
          onClick={fetchApps}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 20px;
      color: ${theme.text};
      overflow-y: auto;
    `}>
      <h2 css={css`
        margin: 0 0 20px 0;
        font-size: 24px;
        font-weight: 600;
      `}>
        App Store
      </h2>
      
      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 20px;
      `}>
        {apps.map(app => (
          <div
            key={app.id}
            css={css`
              background: ${theme.border};
              border-radius: 16px;
              padding: 15px;
              display: flex;
              flex-direction: column;
              gap: 10px;
              transition: all 0.2s ease;
              
              &:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px ${theme.primary}22;
              }
            `}
          >
            <div css={css`
              width: 60px;
              height: 60px;
              background: ${theme.background};
              border-radius: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
            `}>
              {app.icon || '📱'}
            </div>
            
            <div>
              <div css={css`
                font-weight: 600;
                margin-bottom: 4px;
              `}>
                {app.name}
              </div>
              <div css={css`
                font-size: 12px;
                color: ${theme.textSecondary};
              `}>
                v{app.version}
              </div>
              {app.description && (
                <div css={css`
                  font-size: 12px;
                  color: ${theme.textSecondary};
                  margin-top: 4px;
                `}>
                  {app.description}
                </div>
              )}
              {app.author && (
                <div css={css`
                  font-size: 12px;
                  color: ${theme.textSecondary};
                  margin-top: 4px;
                `}>
                  by {app.author}
                </div>
              )}
            </div>
            
            <button
              css={css`
                background: ${app.installed ? 'transparent' : theme.primary};
                color: ${app.installed ? theme.primary : theme.background};
                border: ${app.installed ? `1px solid ${theme.primary}` : 'none'};
                padding: 8px;
                border-radius: 12px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
                
                &:hover {
                  background: ${app.installed ? `${theme.primary}22` : theme.primary};
                  filter: ${app.installed ? 'none' : 'brightness(1.1)'};
                }
              `}
              onClick={() => app.installed ? handleUninstall(app) : handleInstall(app)}
            >
              {app.installed ? 'Uninstall' : 'Install'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
} 