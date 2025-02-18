import { css } from '@firebolt-dev/css'
import { useState } from 'react'
import { hyperFoneOS } from '../hyperfoneOS'

export function LockScreen({ theme, onUnlock, setIsOpen }) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragProgress(0)
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const progress = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setDragProgress(progress)
    
    if (progress >= 0.9) {
      onUnlock()
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragProgress(0)
  }

  return (
    <div css={css`
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 40px 20px;
      position: relative;
      overflow: hidden;
    `}>
      {/* Logo */}
      <div css={css`
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      `}>
        <div css={css`
          font-size: 192px; /* Increased from 64px to 192px (3x) */
          background: linear-gradient(135deg, ${theme.primary}, ${theme.text});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 30px ${theme.primary}66);
          animation: pulse 2s infinite;

          @keyframes pulse {
            0% {
              transform: scale(1);
              filter: drop-shadow(0 0 30px ${theme.primary}66);
            }
            50% {
              transform: scale(1.1);
              filter: drop-shadow(0 0 60px ${theme.primary}88);
            }
            100% {
              transform: scale(1);
              filter: drop-shadow(0 0 30px ${theme.primary}66);
            }
          }
        `}>
          ⚡
        </div>
      </div>

      {/* Controls Container */}
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
      `}>
        {/* Slide to unlock */}
        <div css={css`
          width: 280px;
          height: 60px;
          background: ${theme.background}88;
          border: 1px solid ${theme.primary}44;
          border-radius: 30px;
          position: relative;
          cursor: pointer;
          overflow: hidden;
          backdrop-filter: blur(10px);
          box-shadow: 
            0 0 20px ${theme.primary}22,
            inset 0 0 20px ${theme.primary}22;

          /* Animated border */
          &:before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 32px;
            background: linear-gradient(90deg, 
              ${theme.primary}00, 
              ${theme.primary}66, 
              ${theme.primary}00
            );
            animation: borderGlow 3s linear infinite;
            z-index: -1;
          }

          /* Grid overlay */
          &:after {
            content: '';
            position: absolute;
            inset: 0;
            background-image: 
              linear-gradient(90deg, ${theme.primary}11 1px, transparent 1px),
              linear-gradient(0deg, ${theme.primary}11 1px, transparent 1px);
            background-size: 10px 10px;
            opacity: 0.5;
          }

          @keyframes borderGlow {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Progress bar */}
          <div css={css`
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: ${dragProgress * 100}%;
            background: linear-gradient(90deg,
              ${theme.primary}22,
              ${theme.primary}44
            );
            transition: ${isDragging ? 'none' : 'all 0.3s ease'};

            &:after {
              content: '';
              position: absolute;
              right: 0;
              top: 0;
              bottom: 0;
              width: 20px;
              background: linear-gradient(90deg,
                ${theme.primary}00,
                ${theme.primary}44
              );
            }
          `} />

          {/* Handle */}
          <div css={css`
            position: absolute;
            left: calc(${dragProgress * 100}% + 23px);
            top: 50%;
            transform: translate(-50%, -50%);
            width: 46px;
            height: 46px;
            background: ${theme.background};
            border: 2px solid ${theme.primary};
            border-radius: 23px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: ${isDragging ? 'none' : 'all 0.3s ease'};
            box-shadow: 
              0 0 10px ${theme.primary}44,
              inset 0 0 10px ${theme.primary}44;

            /* Rotating inner ring */
            &:before {
              content: '';
              position: absolute;
              inset: 4px;
              border-radius: 50%;
              border: 2px solid transparent;
              border-top-color: ${theme.primary};
              border-left-color: ${theme.primary};
              animation: rotate 2s linear infinite;
            }

            /* Arrow icon */
            &:after {
              content: '⚡';
              color: ${theme.primary};
              font-size: 16px;
              text-shadow: 0 0 10px ${theme.primary};
            }

            @keyframes rotate {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `} />

          {/* Text overlay */}
          <div css={css`
            position: absolute;
            width: 100%;
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: ${theme.primary};
            line-height: 60px;
            letter-spacing: 2px;
            text-shadow: 0 0 10px ${theme.primary}66;
            opacity: ${1 - dragProgress};
            transition: opacity 0.3s ease;
            pointer-events: none;
            z-index: 2;
          `}>
            SLIDE TO UNLOCK
          </div>
        </div>

        {/* Power Button */}
        <button
          onClick={() => {
            hyperFoneOS.closeApp()
            hyperFoneOS.lock()
            setIsOpen(false)
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
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            box-shadow: 
              0 0 20px ${theme.error}44,
              inset 0 0 20px ${theme.error}44;
            margin-top: 10px;
            
            &:hover {
              background: ${theme.error}22;
              border-color: ${theme.error};
              box-shadow: 0 0 10px ${theme.error}44;
            }

            &:active {
              transform: scale(0.95);
            }
          `}
        >
          ⚡
        </button>
      </div>
    </div>
  )
} 