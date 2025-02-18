import { css } from '@firebolt-dev/css'
import React, { useState } from 'react'
import { WorldInspector } from './WorldInspector'

export function DeveloperApp({ theme }) {
  const [activeTab, setActiveTab] = useState('inspector')

  const tabs = [
    { id: 'inspector', name: 'World Inspector', icon: '🔍' },
    { id: 'performance', name: 'Performance', icon: '📊' },
    { id: 'console', name: 'Console', icon: '💻' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inspector':
        return <WorldInspector theme={theme} />

      case 'performance':
        return (
          <div css={css`
            padding: 20px;
            color: ${theme.textSecondary};
          `}>
            Performance monitoring coming soon...
          </div>
        )

      case 'console':
        return (
          <div css={css`
            padding: 20px;
            color: ${theme.textSecondary};
          `}>
            Console coming soon...
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: ${theme.background};
      color: ${theme.text};
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px;
        border-bottom: 1px solid ${theme.border};
      `}>
        <span css={css`font-size: 24px;`}>🛠️</span>
        <h1 css={css`
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        `}>
          Developer Tools
        </h1>
      </div>

      {/* Tabs */}
      <div css={css`
        display: flex;
        gap: 10px;
        padding: 10px 20px;
        border-bottom: 1px solid ${theme.border};
      `}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            css={css`
              background: ${activeTab === tab.id ? theme.primary + '22' : 'transparent'};
              border: 1px solid ${activeTab === tab.id ? theme.primary : theme.border};
              color: ${theme.text};
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: all 0.2s ease;
              
              &:hover {
                background: ${theme.primary}22;
                border-color: ${theme.primary};
              }
            `}
          >
            <span>{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div css={css`
        flex: 1;
        overflow: auto;
      `}>
        {renderTabContent()}
      </div>
    </div>
  )
} 