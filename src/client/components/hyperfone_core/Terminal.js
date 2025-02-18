import { css } from '@firebolt-dev/css'
import React, { useState, useEffect, useRef } from 'react'

export function Terminal({ theme, socket }) {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    const handleOutput = (data) => {
      setHistory(prev => [...prev, { type: 'output', content: data.output }])
    }

    const handleError = (data) => {
      setHistory(prev => [...prev, { type: 'error', content: data.error }])
    }

    socket.on('terminal:output', handleOutput)
    socket.on('terminal:error', handleError)

    return () => {
      socket.off('terminal:output', handleOutput)
      socket.off('terminal:error', handleError)
    }
  }, [socket])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add command to history
    setHistory(prev => [...prev, { type: 'command', content: input }])
    setCommandHistory(prev => [input, ...prev])
    setHistoryIndex(-1)

    // Send command to server
    socket.emit('terminal:command', { command: input })

    // Clear input
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${theme.background}dd;
      border: 1px solid ${theme.primary}33;
      border-radius: 8px;
      overflow: hidden;
      font-family: 'Courier New', monospace;
    `}>
      {/* Terminal Output */}
      <div
        ref={terminalRef}
        css={css`
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          
          &::-webkit-scrollbar {
            width: 8px;
          }
          &::-webkit-scrollbar-track {
            background: ${theme.background}44;
          }
          &::-webkit-scrollbar-thumb {
            background: ${theme.primary}44;
            border-radius: 4px;
          }
        `}
      >
        {history.map((item, i) => (
          <div
            key={i}
            css={css`
              margin-bottom: 8px;
              color: ${item.type === 'error' ? theme.error || '#ff4444' : 
                      item.type === 'command' ? theme.primary : 
                      theme.text};
              ${item.type === 'command' ? `
                &::before {
                  content: '> ';
                  color: ${theme.primary};
                }
              ` : ''}
            `}
          >
            <pre css={css`
              margin: 0;
              white-space: pre-wrap;
              word-break: break-all;
              font-size: 14px;
            `}>
              {item.content}
            </pre>
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        css={css`
          display: flex;
          padding: 16px;
          background: ${theme.background}ee;
          border-top: 1px solid ${theme.primary}33;
        `}
      >
        <div css={css`
          color: ${theme.primary};
          margin-right: 8px;
        `}>
          &gt;
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          css={css`
            flex: 1;
            background: none;
            border: none;
            color: ${theme.text};
            font-family: inherit;
            font-size: 14px;
            
            &:focus {
              outline: none;
            }
          `}
        />
      </form>
    </div>
  )
} 