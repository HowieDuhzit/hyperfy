import { css } from '@firebolt-dev/css'
import { cyberpunkTheme } from '../../theme/cyberpunk'

export function AppWindow({ app, onClose, children }) {
  return (
    <div css={css`
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: ${cyberpunkTheme.background};
      ${cyberpunkTheme.common.grid}
      animation: windowOpen 0.3s ease-out;

      @keyframes windowOpen {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `}>
      {/* Window Header */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: ${cyberpunkTheme.cardBg};
        border-bottom: ${cyberpunkTheme.border};
        position: relative;
        ${cyberpunkTheme.common.effects.scanline}
      `}>
        <button
          onClick={onClose}
          css={css`
            background: none;
            border: ${cyberpunkTheme.border};
            color: ${cyberpunkTheme.primary};
            width: 24px;
            height: 24px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            
            &:hover {
              background: ${cyberpunkTheme.gradient.primary};
              border-color: ${cyberpunkTheme.primary};
              box-shadow: ${cyberpunkTheme.glow};
            }
          `}
        >
          ←
        </button>

        <div css={css`
          display: flex;
          align-items: center;
          gap: 8px;
        `}>
          <span css={css`
            font-size: 20px;
          `}>
            {app.icon}
          </span>
          <span css={css`
            ${cyberpunkTheme.common.text.title}
            font-size: 16px;
          `}>
            {app.name}
          </span>
        </div>

        {/* Header Decorative Elements */}
        <div css={css`
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 200px;
          pointer-events: none;
          overflow: hidden;
          opacity: 0.5;

          &::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            background: linear-gradient(90deg, transparent, ${cyberpunkTheme.primary}22);
          }

          &::after {
            content: '';
            position: absolute;
            top: 50%;
            right: 20px;
            width: 40px;
            height: 1px;
            background: ${cyberpunkTheme.primary};
            box-shadow: ${cyberpunkTheme.glow};
          }
        `} />
      </div>

      {/* Window Content */}
      <div css={css`
        flex: 1;
        overflow: hidden;
        position: relative;
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(
            to bottom,
            ${cyberpunkTheme.background} 0%,
            transparent 100%
          );
          pointer-events: none;
          opacity: 0.5;
          z-index: 1;
        }

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(
            to top,
            ${cyberpunkTheme.background} 0%,
            transparent 100%
          );
          pointer-events: none;
          opacity: 0.5;
          z-index: 1;
        }
      `}>
        {children}
      </div>
    </div>
  )
} 