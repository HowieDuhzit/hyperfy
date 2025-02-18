import { css } from '@firebolt-dev/css'
import React, { useState, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'

export function FileExplorerApp({ theme, world }) {
  const [currentPath, setCurrentPath] = useState('')
  const [contents, setContents] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const socket = useSocket()
  const [isAdmin, setIsAdmin] = useState(false)

  // Check if user is admin
  useEffect(() => {
    if (world?.network?.socket?.player?.data?.user?.roles) {
      const roles = world.network.socket.player.data.user.roles
      setIsAdmin(roles.includes('admin') || roles.includes('~admin'))
    }
  }, [world?.network?.socket?.player?.data?.user?.roles])

  useEffect(() => {
    if (!socket) return

    const handleFileList = (data) => {
      // Filter contents based on admin status
      const filteredContents = isAdmin ? data.contents : data.contents.filter(item => !item.path.startsWith('/root'))
      setContents(filteredContents)
      setLoading(false)
    }

    const handleError = (err) => {
      setError(err.message)
      setLoading(false)
      setDownloadProgress(null)
    }

    const handleDownloadStart = ({ name, size }) => {
      setDownloadProgress({ name, size, received: 0, chunks: [] })
    }

    const handleDownloadChunk = (chunk) => {
      setDownloadProgress(prev => {
        if (!prev) return null
        return {
          ...prev,
          received: prev.received + chunk.length,
          chunks: [...prev.chunks, chunk]
        }
      })
    }

    const handleDownloadComplete = () => {
      if (!downloadProgress) return
      
      // Combine chunks and create download
      const blob = new Blob(downloadProgress.chunks, { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadProgress.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setDownloadProgress(null)
    }

    socket.on('fileList', handleFileList)
    socket.on('fileError', handleError)
    socket.on('fileDownloadStart', handleDownloadStart)
    socket.on('fileDownloadChunk', handleDownloadChunk)
    socket.on('fileDownloadComplete', handleDownloadComplete)

    // Request initial directory contents
    socket.emit('fileList', { path: currentPath, isAdmin })

    return () => {
      socket.off('fileList', handleFileList)
      socket.off('fileError', handleError)
      socket.off('fileDownloadStart', handleDownloadStart)
      socket.off('fileDownloadChunk', handleDownloadChunk)
      socket.off('fileDownloadComplete', handleDownloadComplete)
    }
  }, [socket, currentPath, isAdmin])

  const handleNavigate = (path) => {
    // Prevent non-admin users from accessing root directory
    if (!isAdmin && path.startsWith('/root')) {
      setError('Access denied: Root access requires admin privileges')
      return
    }
    setLoading(true)
    setError(null)
    setCurrentPath(path)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Prevent non-admin users from uploading to root directory
    if (!isAdmin && currentPath.startsWith('/root')) {
      setError('Access denied: Root access requires admin privileges')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', currentPath)
      formData.append('isAdmin', isAdmin)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      // Refresh directory contents
      socket.emit('fileList', { path: currentPath, isAdmin })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDownload = (path) => {
    // Prevent non-admin users from downloading from root directory
    if (!isAdmin && path.startsWith('/root')) {
      setError('Access denied: Root access requires admin privileges')
      return
    }
    socket.emit('fileDownload', { path, isAdmin })
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${theme.background}ee;
      color: ${theme.text};
      font-family: 'Courier New', monospace;
    `}>
      {/* Header */}
      <div css={css`
        padding: 16px;
        background: ${theme.background}dd;
        border-bottom: 1px solid ${theme.primary}33;
      `}>
        <h1 css={css`
          margin: 0;
          font-size: 24px;
          color: ${theme.primary};
        `}>
          HyperFone File Explorer
        </h1>
      </div>

      {/* Navigation */}
      <div css={css`
        padding: 8px 16px;
        display: flex;
        gap: 8px;
        align-items: center;
        background: ${theme.background}bb;
        border-bottom: 1px solid ${theme.primary}22;
      `}>
        <button
          onClick={() => handleNavigate(currentPath.split('/').slice(0, -1).join('/'))}
          css={css`
            background: ${theme.primary}22;
            border: 1px solid ${theme.primary}44;
            color: ${theme.text};
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-family: inherit;
            
            &:hover {
              background: ${theme.primary}33;
            }
          `}
        >
          ↑ Up
        </button>
        <div css={css`
          color: ${theme.primary};
        `}>
          /
        </div>
        {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
          <React.Fragment key={i}>
            <button
              onClick={() => handleNavigate(arr.slice(0, i + 1).join('/'))}
              css={css`
                background: none;
                border: none;
                color: ${theme.text};
                padding: 4px 8px;
                cursor: pointer;
                font-family: inherit;
                
                &:hover {
                  color: ${theme.primary};
                }
              `}
            >
              {part}
            </button>
            {i < arr.length - 1 && (
              <div css={css`color: ${theme.primary};`}>/</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div css={css`
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      `}>
        {error ? (
          <div css={css`
            color: ${theme.error || '#ff4444'};
            padding: 16px;
            background: ${theme.background}dd;
            border: 1px solid ${theme.error || '#ff4444'}44;
            border-radius: 4px;
          `}>
            {error}
          </div>
        ) : loading ? (
          <div css={css`
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100px;
            color: ${theme.text}88;
          `}>
            Loading...
          </div>
        ) : contents.length === 0 ? (
          <div css={css`
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100px;
            color: ${theme.text}88;
          `}>
            Empty directory
          </div>
        ) : (
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
          `}>
            {contents.map((item) => (
              <div
                key={item.path}
                css={css`
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}33;
                  border-radius: 4px;
                  padding: 12px;
                  cursor: ${item.type === 'directory' ? 'pointer' : 'default'};
                  
                  &:hover {
                    border-color: ${theme.primary}66;
                  }
                `}
                onClick={() => {
                  if (item.type === 'directory') {
                    handleNavigate(item.path)
                  }
                }}
              >
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 8px;
                `}>
                  <div css={css`
                    font-size: 24px;
                  `}>
                    {item.type === 'directory' ? '📁' : '📄'}
                  </div>
                  {item.type === 'file' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(item.path)
                      }}
                      css={css`
                        background: ${theme.primary}22;
                        border: 1px solid ${theme.primary}44;
                        color: ${theme.text};
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        
                        &:hover {
                          background: ${theme.primary}33;
                        }
                      `}
                    >
                      ⬇️
                    </button>
                  )}
                </div>
                <div css={css`
                  font-size: 14px;
                  word-break: break-all;
                `}>
                  {item.name}
                </div>
                <div css={css`
                  font-size: 12px;
                  color: ${theme.text}88;
                  margin-top: 4px;
                `}>
                  {item.type === 'file' ? formatSize(item.size) : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Download Progress */}
      {downloadProgress && (
        <div css={css`
          position: fixed;
          bottom: 16px;
          right: 16px;
          background: ${theme.background}ee;
          border: 1px solid ${theme.primary}44;
          border-radius: 4px;
          padding: 16px;
          min-width: 300px;
        `}>
          <div css={css`
            margin-bottom: 8px;
            font-size: 14px;
          `}>
            Downloading {downloadProgress.name}
          </div>
          <div css={css`
            width: 100%;
            height: 4px;
            background: ${theme.background};
            border-radius: 2px;
            overflow: hidden;
          `}>
            <div
              css={css`
                height: 100%;
                background: ${theme.primary};
                width: ${(downloadProgress.received / downloadProgress.size) * 100}%;
                transition: width 0.2s ease;
              `}
            />
          </div>
          <div css={css`
            margin-top: 8px;
            font-size: 12px;
            color: ${theme.text}88;
          `}>
            {Math.round((downloadProgress.received / downloadProgress.size) * 100)}%
          </div>
        </div>
      )}
    </div>
  )
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${Math.round(size * 10) / 10} ${units[unit]}`
} 