import { css } from '@firebolt-dev/css'
import { cyberpunkTheme } from '../../theme/cyberpunk'

export function HyperFone({ children }) {
  return (
    <div css={css`
      width: 100%;
      height: 100%;
      background: ${cyberpunkTheme.background};
      ${cyberpunkTheme.common.grid}
      position: relative;
      overflow: hidden;
      font-family: 'Courier New', monospace;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, transparent 0%, ${cyberpunkTheme.background} 100%);
        pointer-events: none;
      }

      /* Global Styles */
      * {
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: ${cyberpunkTheme.primary}44 rgba(0, 255, 157, 0.1);
      }

      /* Global Scrollbar */
      *::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      *::-webkit-scrollbar-track {
        background: rgba(0, 255, 157, 0.1);
        border-radius: 4px;
      }

      *::-webkit-scrollbar-thumb {
        background: ${cyberpunkTheme.primary}44;
        border-radius: 4px;
        
        &:hover {
          background: ${cyberpunkTheme.primary}66;
        }
      }

      /* Global Button Styles */
      button {
        ${cyberpunkTheme.common.button}
      }

      /* Global Input Styles */
      input, select, textarea {
        ${cyberpunkTheme.common.input}
      }

      /* Global Link Styles */
      a {
        color: ${cyberpunkTheme.primary};
        text-decoration: none;
        transition: all 0.2s ease;
        
        &:hover {
          text-shadow: ${cyberpunkTheme.textGlow};
        }
      }
    `}>
      {/* Phone Frame */}
      <div css={css`
        position: absolute;
        inset: 0;
        pointer-events: none;
        border: ${cyberpunkTheme.border};
        border-radius: 16px;
        box-shadow: ${cyberpunkTheme.glow};
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 20px;
          background: ${cyberpunkTheme.cardBg};
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
          border: ${cyberpunkTheme.border};
          border-top: none;
        }

        &::after {
          content: '';
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 8px;
          background: ${cyberpunkTheme.primary};
          border-radius: 50%;
          box-shadow: ${cyberpunkTheme.glow};
          animation: pulse 2s infinite ease-in-out;
        }
      `}>
        {/* Phone Frame Corners */}
        <div css={css`
          position: absolute;
          inset: 0;
          pointer-events: none;

          &::before, &::after {
            content: '';
            position: absolute;
            width: 40px;
            height: 40px;
            border: ${cyberpunkTheme.border};
            opacity: 0.5;
          }

          &::before {
            top: -1px;
            left: -1px;
            border-right: none;
            border-bottom: none;
            border-top-left-radius: 16px;
          }

          &::after {
            top: -1px;
            right: -1px;
            border-left: none;
            border-bottom: none;
            border-top-right-radius: 16px;
          }
        `} />
        <div css={css`
          position: absolute;
          inset: 0;
          pointer-events: none;

          &::before, &::after {
            content: '';
            position: absolute;
            width: 40px;
            height: 40px;
            border: ${cyberpunkTheme.border};
            opacity: 0.5;
          }

          &::before {
            bottom: -1px;
            left: -1px;
            border-right: none;
            border-top: none;
            border-bottom-left-radius: 16px;
          }

          &::after {
            bottom: -1px;
            right: -1px;
            border-left: none;
            border-top: none;
            border-bottom-right-radius: 16px;
          }
        `} />
      </div>

      {/* Content Container */}
      <div css={css`
        position: relative;
        width: 100%;
        height: 100%;
        padding: 20px;
        overflow: hidden;
        z-index: 1;
      `}>
        {children}
      </div>
    </div>
  )
} 