import { css } from '@firebolt-dev/css'
import { cyberpunkTheme } from '../../theme/cyberpunk'

export function AppLauncher({ apps, activeApp, onLaunch }) {
  return (
    <div css={css`
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 20px;
      ${cyberpunkTheme.common.grid}
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, transparent 0%, ${cyberpunkTheme.background} 100%);
        pointer-events: none;
      }
    `}>
      {/* Header */}
      <div css={css`
        text-align: center;
        ${cyberpunkTheme.common.effects.scanline}
      `}>
        <h1 css={css`
          ${cyberpunkTheme.common.text.title}
          font-size: 24px;
          margin: 0;
        `}>
          HyperFone OS
        </h1>
        <div css={css`
          ${cyberpunkTheme.common.text.subtitle}
          font-size: 12px;
          opacity: 0.7;
        `}>
          v1.0.0
        </div>
      </div>

      {/* App Grid */}
      <div css={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 20px;
        padding: 20px;
        overflow-y: auto;
        ${cyberpunkTheme.common.scrollbar}
      `}>
        {apps.map(app => (
          <button
            key={app.id}
            onClick={() => onLaunch(app.id)}
            css={css`
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
              padding: 12px;
              background: ${cyberpunkTheme.cardBg};
              border: ${cyberpunkTheme.border};
              border-radius: 12px;
              cursor: pointer;
              transition: all 0.3s ease;
              position: relative;
              overflow: hidden;
              
              ${app.id === activeApp && `
                background: ${cyberpunkTheme.gradient.primary};
                border-color: ${cyberpunkTheme.primary};
                box-shadow: ${cyberpunkTheme.glow};
              `}
              
              &:hover {
                transform: translateY(-2px) scale(1.05);
                box-shadow: ${cyberpunkTheme.glow};

                &::before {
                  transform: translateY(0);
                }

                .app-icon {
                  animation: float 2s infinite ease-in-out;
                }
              }

              &::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: ${cyberpunkTheme.gradient.accent};
                transform: translateY(-100%);
                transition: transform 0.3s ease;
              }
            `}
          >
            <div 
              className="app-icon"
              css={css`
                font-size: 24px;
                transition: transform 0.3s ease;
              `}
            >
              {app.icon}
            </div>
            <div css={css`
              ${cyberpunkTheme.common.text.body}
              font-size: 12px;
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
            `}>
              {app.name}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div css={css`
        text-align: center;
        padding: 10px;
        ${cyberpunkTheme.common.text.subtitle}
        font-size: 10px;
        opacity: 0.5;
        ${cyberpunkTheme.common.effects.scanline}
      `}>
        SYSTEM STATUS: OPTIMAL
      </div>
    </div>
  )
} 