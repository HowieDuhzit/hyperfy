import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'

export function StatusBar({ theme, batteryLevel, isCharging, currentTime }) {
  // Format time to show only hours and minutes with AM/PM
  const formatTime = (date) => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes
    return `${displayHours}:${displayMinutes} ${ampm}`
  }

  // Use local state to track time
  const [time, setTime] = useState(new Date())

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 60000) // Update every minute instead of every second
    return () => clearInterval(timer)
  }, [])

  return (
    <div css={css`
      height: 32px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${theme.background}aa;
      backdrop-filter: blur(10px);
      border-bottom: 1px solid ${theme.primary}22;
      position: relative;
      z-index: 3;

      &:before {
        content: '';
        position: absolute;
        left: 16px;
        right: 16px;
        top: 100%;
        height: 2px;
        background: linear-gradient(
          to right,
          transparent,
          ${theme.primary},
          transparent
        );
        opacity: 0.5;
      }
    `}>
      {/* Left side - Time */}
      <div css={css`
        font-family: 'Courier New', monospace;
        font-size: 14px;
        color: ${theme.text};
        display: flex;
        align-items: center;
        gap: 8px;
        
        &:before {
          content: '>';
          color: ${theme.primary};
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}>
        {formatTime(time)}
      </div>

      {/* Center - System Status */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: ${theme.primary};
      `}>
        <span>HyperFone</span>
        <span css={css`
          width: 6px;
          height: 6px;
          background: ${theme.primary};
          border-radius: 50%;
          animation: pulse 2s infinite;
          
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}/>
      </div>

      {/* Right side - Battery */}
      <div css={css`
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: ${theme.text};
      `}>
        <div css={css`
          width: 40px;
          height: 16px;
          border: 1px solid ${theme.primary};
          border-radius: 2px;
          padding: 2px;
          position: relative;
          
          &:after {
            content: '';
            position: absolute;
            right: -4px;
            top: 50%;
            transform: translateY(-50%);
            width: 2px;
            height: 8px;
            background: ${theme.primary};
            border-radius: 0 2px 2px 0;
          }
        `}>
          <div css={css`
            height: 100%;
            width: ${batteryLevel * 100}%;
            background: ${batteryLevel > 0.2 ? theme.primary : theme.error};
            border-radius: 1px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;

            ${isCharging && `
              &:before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 200%;
                height: 100%;
                background: linear-gradient(
                  90deg,
                  transparent,
                  ${theme.text}44,
                  transparent
                );
                animation: charging 1.5s infinite linear;
              }

              @keyframes charging {
                0% { transform: translateX(0); }
                100% { transform: translateX(50%); }
              }
            `}
          `}/>
        </div>
        <span>{Math.round(batteryLevel * 100)}%</span>
      </div>
    </div>
  )
} 