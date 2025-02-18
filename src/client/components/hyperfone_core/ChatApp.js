/*
 * Core Chat App
 * Built-in chat functionality for Hyperfy
 */

import { css } from '@firebolt-dev/css'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MatrixClient, createClient } from 'matrix-js-sdk'
import React from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

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

// Memoized Avatar component for better performance
const Avatar = React.memo(({ url, name, size = 32, fontSize = 14 }) => {
  const initial = name ? name[0].toUpperCase() : '?'
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33']
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0
  const [imgError, setImgError] = useState(false)
  
  return (
    <div css={css`
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${imgError || !url ? colors[colorIndex] : 'transparent'};
      background-image: ${!imgError && url ? `url(${url})` : 'none'};
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${fontSize}px;
      font-weight: 500;
      flex-shrink: 0;
    `}>
      {(imgError || !url) && initial}
    </div>
  )
})

// Video call component
const VideoCall = React.memo(({ roomId, client, selectedMembers, members, onClose, isSelectionMode = true }) => {
  const localVideoRef = useRef()
  const remoteVideoRefs = useRef({})
  const [callState, setCallState] = useState('initializing')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [activeMembers, setActiveMembers] = useState([])
  const [callErrors, setCallErrors] = useState({})
  const [privateRoomId, setPrivateRoomId] = useState(null)
  const [hasRemoteStream, setHasRemoteStream] = useState({})
  const [localSelectedMembers, setLocalSelectedMembers] = useState(selectedMembers)
  const [isCallActive, setIsCallActive] = useState(false)
  const callsRef = useRef({})
  const localStreamRef = useRef(null)

  // Handle call initialization
  const handleStartCall = async () => {
    if (isSelectionMode && localSelectedMembers.length === 0) {
      setCallErrors(prev => ({
        ...prev,
        general: 'Please select at least one member to call'
      }))
      return
    }
    setIsCallActive(true)
    await initializeCall()
  }

  // Initialize call with better error handling
  const initializeCall = async () => {
    try {
      // Get local media stream with specific constraints
      const localStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true 
      })
      
      localStreamRef.current = localStream
      
      // Immediately set up local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream
        try {
          await localVideoRef.current.play()
        } catch (err) {
          console.error('Failed to play local video:', err)
        }
      }

      // For channel-wide calls, use all members except self
      const callTargets = isSelectionMode ? 
        localSelectedMembers : 
        members
          .filter(m => m.id !== client.getUserId())
          .map(m => m.id)

      try {
        // Create private room for the call
        const createRoomResponse = await client.createRoom({
          preset: 'private_chat',
          invite: callTargets,
          name: 'Video Call',
          topic: isSelectionMode ? 'Private video call' : 'Channel-wide video call',
          initial_state: [{
            type: 'm.room.guest_access',
            state_key: '',
            content: {
              guest_access: 'forbidden'
            }
          }]
        })
        
        setPrivateRoomId(createRoomResponse.room_id)
        setCallState('connecting')

        // Wait for room to be fully synced
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Room sync timeout')), 10000)
          
          const checkRoom = () => {
            const room = client.getRoom(createRoomResponse.room_id)
            if (room && room.currentState) {
              clearTimeout(timeout)
              resolve()
            } else {
              setTimeout(checkRoom, 100)
            }
          }
          
          checkRoom()
        })

        // Initialize calls for each target with better error handling
        for (const memberId of callTargets) {
          try {
            const call = await client.createCall(createRoomResponse.room_id)
            if (!call) {
              throw new Error('Failed to create call object')
            }
            
            callsRef.current[memberId] = call
            
            // Set up call handlers with improved error handling
            call.on("state", (state) => {
              console.log(`Call state for ${memberId}:`, state)
              if (state === 'connected') {
                setActiveMembers(prev => [...prev, memberId])
                setCallState('active')
              } else if (state === 'ended') {
                // Handle call end gracefully
                delete callsRef.current[memberId]
                setActiveMembers(prev => prev.filter(id => id !== memberId))
                setHasRemoteStream(prev => {
                  const newState = { ...prev }
                  delete newState[memberId]
                  return newState
                })
              }
            })

            // Handle remote stream with better error checking
            call.on("stream", (stream) => {
              console.log(`Got stream for ${memberId}:`, stream)
              if (stream && stream.active) {
                const videoElement = document.createElement('video')
                videoElement.autoplay = true
                videoElement.playsInline = true
                videoElement.srcObject = stream
                
                // Store video element reference
                remoteVideoRefs.current[memberId] = videoElement
                
                // Try to play the stream immediately
                videoElement.play().catch(err => {
                  console.error(`Failed to play remote stream for ${memberId}:`, err)
                })
                
                setHasRemoteStream(prev => ({ ...prev, [memberId]: true }))
                setActiveMembers(prev => [...prev, memberId])
                setCallState('active')
              }
            })

            // Enhanced error handling
            call.on("error", (err) => {
              console.error(`Call error for ${memberId}:`, err)
              setCallErrors(prev => ({
                ...prev,
                [memberId]: err.message
              }))
              
              // Try to recover from error
              try {
                if (callsRef.current[memberId]) {
                  callsRef.current[memberId].hangup()
                  delete callsRef.current[memberId]
                }
                setActiveMembers(prev => prev.filter(id => id !== memberId))
                setHasRemoteStream(prev => {
                  const newState = { ...prev }
                  delete newState[memberId]
                  return newState
                })
              } catch (cleanupErr) {
                console.error('Error during call cleanup:', cleanupErr)
              }
            })

            // Place video call with local stream
            await call.placeVideoCall()
            console.log(`Placed call to ${memberId}`)
          } catch (err) {
            console.error(`Failed to call ${memberId}:`, err)
            setCallErrors(prev => ({
              ...prev,
              [memberId]: 'Failed to connect'
            }))
          }
        }
      } catch (err) {
        console.error('Failed to create private room:', err)
        setCallState('ended')
        setCallErrors(prev => ({
          ...prev,
          room: 'Failed to create private room'
        }))
      }
    } catch (err) {
      console.error('Failed to start video call:', err)
      setCallState('ended')
    }
  }

  // Enhanced cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop local video stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop()
          } catch (err) {
            console.error('Error stopping track:', err)
          }
        })
      }
      
      // Cleanup video elements
      Object.values(remoteVideoRefs.current).forEach(videoEl => {
        try {
          if (videoEl.srcObject) {
            videoEl.srcObject.getTracks().forEach(track => track.stop())
            videoEl.srcObject = null
          }
        } catch (err) {
          console.error('Error cleaning up video element:', err)
        }
      })
      
      // Hangup all calls
      Object.values(callsRef.current).forEach(call => {
        try {
          call.hangup()
        } catch (err) {
          console.error('Error hanging up call:', err)
        }
      })
      
      // Leave and forget private room
      if (privateRoomId) {
        client.leave(privateRoomId)
          .then(() => client.forget(privateRoomId))
          .catch(err => console.error('Error cleaning up room:', err))
      }
    }
  }, [client, privateRoomId])

  // Selection mode UI
  if (isSelectionMode && !isCallActive) {
    return (
      <div css={css`
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 1000;
        display: flex;
        flex-direction: column;
      `}>
        {/* Header */}
        <div css={css`
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.3);
        `}>
          <div css={css`
            color: white;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 10px;
          `}>
            <h3 css={css`margin: 0;`}>Start Video Call</h3>
            {callErrors.general && (
              <div css={css`
                color: #ff4444;
                font-size: 14px;
                margin-left: 10px;
              `}>
                {callErrors.general}
              </div>
            )}
          </div>
          <div css={css`display: flex; gap: 10px;`}>
            {localSelectedMembers.length > 0 && (
              <button
                onClick={handleStartCall}
                css={css`
                  background: #551bf9;
                  border: none;
                  color: white;
                  padding: 8px 16px;
                  border-radius: 4px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  &:hover { background: #6633ff; }
                `}
              >
                <span>📹</span>
                Call ({localSelectedMembers.length})
              </button>
            )}
            <button
              onClick={onClose}
              css={css`
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                &:hover { background: rgba(255, 255, 255, 0.2); }
              `}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Member Selection Grid */}
        <div css={css`
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          ${scrollbarStyle}
        `}>
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
          `}>
            {members
              .filter(member => member.id !== client.getUserId()) // Filter out yourself
              .map(member => (
                <div
                  key={member.id}
                  onClick={() => setLocalSelectedMembers(prev => 
                    prev.includes(member.id) 
                      ? prev.filter(id => id !== member.id)
                      : [...prev, member.id]
                  )}
                  css={css`
                    padding: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    background: ${localSelectedMembers.includes(member.id) ? 'rgba(85, 27, 249, 0.1)' : 'rgba(0, 0, 0, 0.2)'};
                    border: 1px solid ${localSelectedMembers.includes(member.id) ? '#551bf9' : 'transparent'};
                    transition: all 0.2s ease;
                    
                    &:hover {
                      background: ${localSelectedMembers.includes(member.id) ? 'rgba(85, 27, 249, 0.15)' : 'rgba(0, 0, 0, 0.3)'};
                      transform: translateY(-1px);
                    }
                  `}
                >
                  <div css={css`position: relative;`}>
                    <Avatar url={member.avatar} name={member.name} size={40} />
                    <div css={css`
                      width: 12px;
                      height: 12px;
                      border-radius: 50%;
                      background: ${member.presence === 'online' ? '#4CAF50' : 
                                  member.presence === 'unavailable' ? '#FFC107' : '#9E9E9E'};
                      border: 2px solid rgba(0, 0, 0, 0.2);
                      position: absolute;
                      bottom: -2px;
                      right: -2px;
                    `} />
                  </div>
                  <div css={css`flex: 1; min-width: 0;`}>
                    <div css={css`
                      color: white;
                      font-size: 14px;
                      font-weight: 500;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    `}>
                      {member.name}
                    </div>
                    <div css={css`
                      color: rgba(255, 255, 255, 0.6);
                      font-size: 12px;
                    `}>
                      {member.presence === 'online' ? 'Online' :
                       member.presence === 'unavailable' ? 'Away' : 'Offline'}
                    </div>
                  </div>
                  <div css={css`
                    width: 20px;
                    height: 20px;
                    border: 2px solid ${localSelectedMembers.includes(member.id) ? '#551bf9' : 'rgba(255, 255, 255, 0.2)'};
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: ${localSelectedMembers.includes(member.id) ? '#551bf9' : 'transparent'};
                    transition: all 0.2s ease;
                  `}>
                    {localSelectedMembers.includes(member.id) && (
                      <span css={css`
                        color: white;
                        font-size: 12px;
                      `}>✓</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    )
  }

  // Active call UI
  return (
    <div css={css`
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 1000;
      display: flex;
      flex-direction: column;
    `}>
      {/* Header */}
      <div css={css`
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(0, 0, 0, 0.3);
      `}>
        <div css={css`
          color: white;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        `}>
          <h3 css={css`margin: 0;`}>Video Call</h3>
          <div css={css`
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 12px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
          `}>
            {activeMembers.map(memberId => {
              const member = members.find(m => m.id === memberId)
              return (
                <div key={memberId} css={css`position: relative;`}>
                  <Avatar 
                    url={member?.avatar} 
                    name={member?.name || memberId} 
                    size={24} 
                    fontSize={10} 
                  />
                  <div css={css`
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #4CAF50;
                    border: 2px solid rgba(0, 0, 0, 0.2);
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                  `} />
                </div>
              )
            })}
          </div>
        </div>
        <button
          onClick={onClose}
          css={css`
            background: #ff4444;
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            &:hover { background: #ff6666; }
          `}
        >
          End Call
        </button>
      </div>

      {/* Video Grid */}
      <div css={css`
        flex: 1;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        padding: 20px;
        position: relative;
        overflow: auto;
      `}>
        {/* Remote Videos */}
        {Object.entries(remoteVideoRefs.current).map(([memberId, videoRef]) => {
          const member = members.find(m => m.id === memberId)
          return (
            <div
              key={memberId}
              css={css`
                background: #000;
                border-radius: 12px;
                overflow: hidden;
                position: relative;
                aspect-ratio: 16/9;
                min-height: 200px;
              `}
            >
              <video
                ref={el => {
                  if (el && videoRef?.srcObject) {
                    el.srcObject = videoRef.srcObject
                    el.play().catch(console.error)
                  }
                }}
                autoPlay
                playsInline
                css={css`
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                  background: #000;
                `}
              />
              {!hasRemoteStream[memberId] && (
                <div css={css`
                  position: absolute;
                  inset: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  background: rgba(0, 0, 0, 0.7);
                  gap: 10px;
                `}>
                  <Avatar 
                    url={member?.avatar} 
                    name={member?.name || memberId} 
                    size={64} 
                    fontSize={24} 
                  />
                  <div css={css`
                    color: white;
                    font-size: 14px;
                  `}>
                    {activeMembers.includes(memberId) ? 'Connecting video...' : 'Waiting for response...'}
                  </div>
                </div>
              )}
              <div css={css`
                position: absolute;
                bottom: 10px;
                left: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(0, 0, 0, 0.5);
                padding: 4px 8px;
                border-radius: 4px;
              `}>
                <Avatar url={member?.avatar} name={member?.name || memberId} size={24} fontSize={10} />
                <span css={css`color: white; font-size: 12px;`}>
                  {member?.name || memberId}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <div css={css`
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 200px;
        aspect-ratio: 16/9;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(255, 255, 255, 0.1);
        z-index: 1000;
      `}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          css={css`
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: scaleX(-1); // Mirror local video
            opacity: ${isVideoEnabled ? 1 : 0.5};
          `}
        />
        {!isVideoEnabled && (
          <div css={css`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.7);
            font-size: 24px;
          `}>
            🎥❌
          </div>
        )}
        <div css={css`
          position: absolute;
          bottom: 10px;
          left: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.5);
          padding: 4px 8px;
          border-radius: 4px;
        `}>
          <span css={css`color: white; font-size: 12px;`}>You</span>
        </div>
      </div>

      {/* Controls */}
      <div css={css`
        padding: 20px;
        display: flex;
        justify-content: center;
        gap: 20px;
        background: rgba(0, 0, 0, 0.3);
      `}>
        <button
          onClick={() => {
            const stream = localVideoRef.current?.srcObject
            if (stream) {
              stream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted
              })
              setIsMuted(!isMuted)
            }
          }}
          css={css`
            background: ${isMuted ? '#ff4444' : 'rgba(255, 255, 255, 0.1)'};
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 20px;
            &:hover { background: ${isMuted ? '#ff6666' : 'rgba(255, 255, 255, 0.2)'}; }
          `}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button
          onClick={() => {
            const stream = localVideoRef.current?.srcObject
            if (stream) {
              stream.getVideoTracks().forEach(track => {
                track.enabled = !isVideoEnabled
              })
              setIsVideoEnabled(!isVideoEnabled)
            }
          }}
          css={css`
            background: ${!isVideoEnabled ? '#ff4444' : 'rgba(255, 255, 255, 0.1)'};
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 20px;
            &:hover { background: ${!isVideoEnabled ? '#ff6666' : 'rgba(255, 255, 255, 0.2)'}; }
          `}
        >
          {isVideoEnabled ? '📹' : '❌'}
        </button>
      </div>
    </div>
  )
})

// Message Content component to handle different message types
const MessageContent = React.memo(({ content, sender, client }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)

  // Helper function to get proper download URL
  const getMediaUrl = (mxcUrl) => {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return null
    const serverAndMediaId = mxcUrl.slice(6) // Remove 'mxc://'
    return `https://matrix-client.matrix.org/_matrix/media/v3/download/${serverAndMediaId}`
  }

  // Helper function to get thumbnail URL
  const getThumbnailUrl = (mxcUrl, width = 800, height = 600) => {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return null
    const serverAndMediaId = mxcUrl.slice(6) // Remove 'mxc://'
    return `https://matrix-client.matrix.org/_matrix/media/v3/thumbnail/${serverAndMediaId}?width=${width}&height=${height}&method=scale`
  }

  // Handle different message types
  if (content.msgtype === 'm.image') {
    const imageUrl = getMediaUrl(content.url)
    const thumbnailUrl = content.info?.thumbnail_url ? 
      getMediaUrl(content.info.thumbnail_url) : 
      getThumbnailUrl(content.url)
    
    if (!imageUrl) return <div>Invalid image</div>

    console.log('Image URLs:', { imageUrl, thumbnailUrl, originalUrl: content.url }) // Debug log

    const handleDownload = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = content.body || 'image'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (err) {
        console.error('Failed to download:', err)
      }
    }

    return (
      <>
        <div css={css`
          position: relative;
          max-width: 300px;
          max-height: 300px;
          min-width: 100px;
          min-height: 100px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          
          &:hover .image-controls {
            opacity: 1;
          }
        `}
        onClick={() => setShowFullImage(true)}
        >
          {!imageLoaded && !imageError && (
            <div css={css`
              position: absolute;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: rgba(255, 255, 255, 0.6);
            `}>
              Loading...
            </div>
          )}
          <img
            src={thumbnailUrl}
            alt={content.body}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            css={css`
              width: 100%;
              height: 100%;
              object-fit: contain;
              opacity: ${imageLoaded ? 1 : 0};
              transition: opacity 0.2s ease;
            `}
          />
          <div className="image-controls" css={css`
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8px;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: space-between;
            gap: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
          `}>
            <span css={css`
              color: rgba(255, 255, 255, 0.8);
              font-size: 12px;
            `}>
              {formatFileSize(content.info?.size)}
            </span>
            <button
              onClick={handleDownload}
              css={css`
                color: white;
                text-decoration: none;
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.2);
                border: none;
                cursor: pointer;
                
                &:hover {
                  background: rgba(255, 255, 255, 0.3);
                }
              `}
            >
              Download
            </button>
          </div>
        </div>

        {showFullImage && (
          <div css={css`
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            cursor: zoom-out;
          `}
          onClick={() => setShowFullImage(false)}
          >
            <img
              src={imageUrl}
              alt={content.body}
              css={css`
                max-width: 90vw;
                max-height: 90vh;
                object-fit: contain;
                border-radius: 8px;
              `}
            />
            <div css={css`
              position: absolute;
              top: 20px;
              right: 20px;
              display: flex;
              gap: 10px;
            `}>
              <button
                onClick={handleDownload}
                css={css`
                  background: rgba(255, 255, 255, 0.2);
                  border: none;
                  color: white;
                  font-size: 14px;
                  cursor: pointer;
                  padding: 8px 16px;
                  border-radius: 4px;
                  &:hover { background: rgba(255, 255, 255, 0.3); }
                `}
              >
                Download
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFullImage(false)
                }}
                css={css`
                  background: none;
                  border: none;
                  color: white;
                  font-size: 24px;
                  cursor: pointer;
                  padding: 8px;
                  opacity: 0.8;
                  &:hover { opacity: 1; }
                `}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // Handle file messages
  if (content.msgtype === 'm.file') {
    const fileUrl = getMediaUrl(content.url)
    if (!fileUrl) return <div>Invalid file</div>

    const handleDownload = async (e) => {
      e.preventDefault()
      try {
        const response = await fetch(fileUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = content.filename || content.body || 'file'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (err) {
        console.error('Failed to download:', err)
      }
    }

    return (
      <div css={css`
        background: rgba(0, 0, 0, 0.2);
        padding: 10px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
      `}>
        <div css={css`
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        `}>
          📄
        </div>
        <div css={css`flex: 1;`}>
          <div css={css`
            color: white;
            font-size: 14px;
            margin-bottom: 4px;
            word-break: break-all;
          `}>
            {content.filename || content.body}
          </div>
          <div css={css`
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
          `}>
            {formatFileSize(content.info?.size)}
          </div>
        </div>
        <button
          onClick={handleDownload}
          css={css`
            color: white;
            text-decoration: none;
            font-size: 12px;
            padding: 6px 12px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            cursor: pointer;
            white-space: nowrap;
            
            &:hover {
              background: rgba(255, 255, 255, 0.3);
            }
          `}
        >
          Download
        </button>
      </div>
    )
  }

  // Regular text message with emoji support
  return (
    <div css={css`
      color: white;
      font-size: 14px;
      white-space: pre-wrap;
      word-break: break-word;
    `}>
      {content.formatted_body ? (
        <div dangerouslySetInnerHTML={{ __html: content.formatted_body }} />
      ) : (
        content.body
      )}
    </div>
  )
})

export function ChatApp() {
  const [client, setClient] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [roomStatus, setRoomStatus] = useState('')
  const [error, setError] = useState(null)
  const [rooms, setRooms] = useState([])
  const [members, setMembers] = useState([])
  const [showRoomList, setShowRoomList] = useState(true)
  const [showMemberList, setShowMemberList] = useState(true)
  const [isInVideoCall, setIsInVideoCall] = useState(false)
  const messagesEndRef = useRef(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef()
  const [selectedMembers, setSelectedMembers] = useState([])
  const [showCallOptions, setShowCallOptions] = useState(false)

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji.native)
    setShowEmojiPicker(false)
  }

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Enhanced message event handler to support images
  const handleMessageEvent = useCallback((event) => {
    if (event.getRoomId() === roomId && event.getType() === 'm.room.message') {
      setMessages(prev => [...prev, {
        id: event.getId(),
        sender: event.getSender(),
        content: event.getContent(),
        timestamp: event.getTs(),
      }])
    }
  }, [roomId])

  const handlePresenceEvent = useCallback((event, state) => {
    const userId = event.getSender()
    setMembers(prev => prev.map(member => 
      member.id === userId ? { ...member, presence: state } : member
    ))
  }, [])

  // Enhanced room update with debouncing
  const updateRooms = useCallback(() => {
    if (!client || !loggedIn) return
    
    const roomList = client.getRooms()
    const spaces = new Map() // Map to store spaces and their rooms
    spaces.set('No Space', []) // Default group for rooms not in any space
    
    // First, identify all spaces
    roomList.forEach(room => {
      const isSpace = room.getType() === 'm.space'
      if (isSpace) {
        spaces.set(room.roomId, [])
      }
    })

    // Then, organize rooms into spaces
    roomList.forEach(room => {
      const isSpace = room.getType() === 'm.space'
      if (!isSpace) {
        const parentEvents = room.currentState.getStateEvents('m.space.parent')
        let assigned = false
        
        // Check if room belongs to any space
        for (const event of parentEvents) {
          const spaceId = event.getStateKey()
          if (spaces.has(spaceId)) {
            const lastEvent = room.timeline[room.timeline.length - 1]
            const avatarUrl = room.getAvatarUrl(client.baseUrl, 64, 64, 'crop')
            const avatarEvent = room.currentState.getStateEvents('m.room.avatar')[0]
            
            spaces.get(spaceId).push({
              id: room.roomId,
              name: room.name || room.canonicalAlias || 'Unnamed Room',
              avatar: avatarUrl,
              avatarEventId: avatarEvent?.getId(),
              unreadCount: room.getUnreadNotificationCount(),
              lastMessage: lastEvent?.getContent()?.body || '',
              lastMessageTime: lastEvent?.getTs(),
              memberCount: room.getJoinedMemberCount(),
            })
            assigned = true
          }
        }

        // If room doesn't belong to any space, add to "No Space" group
        if (!assigned) {
          const lastEvent = room.timeline[room.timeline.length - 1]
          const avatarUrl = room.getAvatarUrl(client.baseUrl, 64, 64, 'crop')
          const avatarEvent = room.currentState.getStateEvents('m.room.avatar')[0]
          
          spaces.get('No Space').push({
            id: room.roomId,
            name: room.name || room.canonicalAlias || 'Unnamed Room',
            avatar: avatarUrl,
            avatarEventId: avatarEvent?.getId(),
            unreadCount: room.getUnreadNotificationCount(),
            lastMessage: lastEvent?.getContent()?.body || '',
            lastMessageTime: lastEvent?.getTs(),
            memberCount: room.getJoinedMemberCount(),
          })
        }
      }
    })

    // Convert spaces map to array and sort rooms within each space
    const organizedRooms = Array.from(spaces.entries()).map(([spaceId, rooms]) => {
      const space = spaceId === 'No Space' ? {
        id: 'No Space',
        name: 'Other Rooms',
        avatar: null
      } : {
        id: spaceId,
        name: client.getRoom(spaceId)?.name || 'Unnamed Space',
        avatar: client.getRoom(spaceId)?.getAvatarUrl(client.baseUrl, 64, 64, 'crop')
      }

      return {
        ...space,
        rooms: rooms.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
      }
    }).filter(space => space.rooms.length > 0) // Only show spaces with rooms

    setRooms(organizedRooms)
  }, [client, loggedIn])

  // Enhanced member list update
  const updateMembers = useCallback(async () => {
    if (!client || !roomId) return
    
    const room = client.getRoom(roomId)
    if (room) {
      const memberList = room.getMembers()
      const enhancedMembers = await Promise.all(memberList.map(async member => {
        const avatarUrl = member.getAvatarUrl(client.baseUrl, 64, 64, 'crop')
        const presence = await client.getPresence(member.userId).catch(() => null)
        const avatarEvent = room.currentState.getStateEvents('m.room.member', member.userId)
        
        return {
          id: member.userId,
          name: member.name,
          avatar: avatarUrl,
          avatarEventId: avatarEvent?.getId(),
          presence: presence?.presence || 'offline',
          lastActiveAgo: presence?.last_active_ago,
        }
      }))
      
      setMembers(enhancedMembers)
    }
  }, [client, roomId])

  // Debounced room update
  useEffect(() => {
    if (client && loggedIn) {
      let timeoutId
      const debouncedUpdate = () => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(updateRooms, 50) // Reduced from 100ms to 50ms
      }

      // Room events
      client.on('Room', debouncedUpdate)
      client.on('Room.timeline', debouncedUpdate)
      client.on('Room.name', debouncedUpdate)
      client.on('Room.avatar', debouncedUpdate)
      client.on('RoomMember.membership', debouncedUpdate)
      
      // Live message updates
      client.on('Room.timeline', handleMessageEvent)
      
      // Presence updates
      client.on('User.presence', handlePresenceEvent)

      // Avatar updates
      client.on('RoomMember.avatar', updateMembers)
      client.on('Room.avatar', updateRooms)

      // Set up periodic refresh intervals
      const roomRefreshInterval = setInterval(updateRooms, 30000) // Refresh room list every 30 seconds
      const memberRefreshInterval = setInterval(updateMembers, 15000) // Refresh member list every 15 seconds
      
      return () => {
        clearTimeout(timeoutId)
        clearInterval(roomRefreshInterval)
        clearInterval(memberRefreshInterval)
        client.removeListener('Room', debouncedUpdate)
        client.removeListener('Room.timeline', debouncedUpdate)
        client.removeListener('Room.name', debouncedUpdate)
        client.removeListener('Room.avatar', debouncedUpdate)
        client.removeListener('RoomMember.membership', debouncedUpdate)
        client.removeListener('Room.timeline', handleMessageEvent)
        client.removeListener('User.presence', handlePresenceEvent)
        client.removeListener('RoomMember.avatar', updateMembers)
        client.removeListener('Room.avatar', updateRooms)
      }
    }
  }, [client, loggedIn, updateRooms, handleMessageEvent, handlePresenceEvent, updateMembers])

  // Update members when room changes or on avatar updates
  useEffect(() => {
    updateMembers()
  }, [updateMembers])

  // Update rooms on avatar changes
  useEffect(() => {
    updateRooms()
  }, [updateRooms])

  // Memoized room list with priority room
  const sortedRooms = useMemo(() => {
    return rooms.map(space => ({
      ...space,
      rooms: [...space.rooms].sort((a, b) => {
        // First priority: Current room
        if (a.id === roomId) return -1
        if (b.id === roomId) return 1
        // Last priority: Sort by last message time
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
      })
    }))
  }, [rooms, roomId])

  // Handle room change with loading state
  const handleRoomChange = async (newRoomId) => {
    if (newRoomId === roomId) return;
    
    setMessages([]) // Clear messages while loading
    setRoomStatus('joining')
    
    try {
      const room = client.getRoom(newRoomId)
      if (!room) {
        await client.joinRoom(newRoomId)
      }
      setRoomId(newRoomId)
      setRoomStatus('joined')
      loadMessages(newRoomId)
      updateMembers()
    } catch (err) {
      console.error('Failed to change room:', err)
      setError('Failed to join room')
      setRoomStatus('error')
    }
  }

  // Load chat history for a specific room
  const loadMessages = (targetRoomId = roomId) => {
    if (!client) return;
    const room = client.getRoom(targetRoomId);
    if (room) {
      setMessages(room.timeline.map(event => ({
        id: event.getId(),
        sender: event.getSender(),
        content: event.getContent(),
        timestamp: event.getTs(),
      })));
    }
  };

  // Initialize Matrix client from saved session
  useEffect(() => {
    const savedMatrixSession = localStorage.getItem('hyperfy_matrix_session')
    if (savedMatrixSession) {
      const session = JSON.parse(savedMatrixSession)
      const client = createClient({
        baseUrl: 'https://matrix.org',
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId
      })
      setClient(client)
      setLoggedIn(true)
      client.startClient()

      // After login, join default room
      client.once('sync', async (state) => {
        if (state === 'PREPARED') {
          try {
            // Try to join or create a default room
            const createRoomResponse = await client.createRoom({
              name: 'Hyperfy Chat',
              visibility: 'public',
              preset: 'public_chat',
              room_alias_name: 'hyperfy-chat',
              topic: 'Official Hyperfy Chat Room'
            })
            setRoomId(createRoomResponse.room_id)
            setRoomStatus('joined')
            loadMessages(createRoomResponse.room_id)
          } catch (err) {
            console.error('Failed to create default room:', err)
            // Fallback to joined rooms
            try {
              const joinedRooms = await client.getJoinedRooms()
              if (joinedRooms.joined_rooms.length > 0) {
                setRoomId(joinedRooms.joined_rooms[0])
                setRoomStatus('joined')
                loadMessages(joinedRooms.joined_rooms[0])
              } else {
                // Create a new room as last resort
                const createRoomResponse = await client.createRoom({
                  name: 'My Chat Room',
                  visibility: 'public',
                  preset: 'public_chat',
                  topic: 'A new chat room'
                })
                setRoomId(createRoomResponse.room_id)
                setRoomStatus('joined')
                loadMessages(createRoomResponse.room_id)
              }
            } catch (joinErr) {
              console.error('Failed to join room:', joinErr)
              setError('Failed to connect to chat')
              setRoomStatus('error')
            }
          }
        }
      })
    } else {
      const client = createClient({
        baseUrl: 'https://matrix.org'
      })
      setClient(client)
    }
  }, [])

  // Handle sending messages
  const handleSend = async () => {
    if (!newMessage.trim() || !loggedIn || !roomId || roomStatus !== 'joined') return

    try {
      await client.sendTextMessage(roomId, newMessage)
      setNewMessage('')
      setError(null)
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Failed to send message. Please try again.')
    }
  }

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file || !client || !roomId) return

    try {
      // Upload the file content
      const response = await client.uploadContent(file, {
        type: file.type,
        name: file.name,
        onlyContentUri: true
      })

      if (file.type.startsWith('image/')) {
        // For images, create a thumbnail
        await client.sendMessage(roomId, {
          msgtype: 'm.image',
          body: file.name,
          url: response,
          info: {
            mimetype: file.type,
            size: file.size,
            w: 800, // Default width
            h: 600, // Default height
          }
        })
      } else {
        // For other files
        await client.sendMessage(roomId, {
          msgtype: 'm.file',
          body: file.name,
          filename: file.name,
          url: response,
          info: {
            mimetype: file.type,
            size: file.size,
          }
        })
      }
    } catch (err) {
      console.error('Failed to upload file:', err)
      setError('Failed to upload file. Please try again.')
    }
  }

  // Add handler for member selection
  const handleMemberSelect = (memberId) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  // Add handler for starting call
  const handleStartCall = () => {
    if (selectedMembers.length > 0) {
      setIsInVideoCall(true)
    } else {
      setError('Please select members to call')
    }
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      height: 100%;
      background: rgba(0, 0, 0, 0.1);
    `}>
      {!loggedIn ? (
        <div css={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 20px;
          padding: 20px;
        `}>
          <div css={css`
            text-align: center;
            margin-bottom: 20px;
          `}>
            <h2 css={css`
              color: white;
              margin-bottom: 10px;
            `}>Welcome to Hyperfy Chat</h2>
            <p css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 14px;
            `}>
              Please connect your Matrix account in Settings to continue.<br/>
              Don't have one? <a 
                href="https://app.element.io/#/register" 
                target="_blank" 
                rel="noopener noreferrer"
                css={css`
                  color: #551bf9;
                  text-decoration: none;
                  &:hover {
                    text-decoration: underline;
                  }
                `}
              >
                Create an account
              </a>
            </p>
          </div>
          <button
            onClick={() => hyperFoneOS.openSettings('profile')}
            css={css`
              background: #551bf9;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s ease;
              
              &:hover {
                opacity: 0.9;
                transform: translateY(-1px);
                box-shadow: 0 5px 15px rgba(85, 27, 249, 0.2);
              }
            `}
          >
            Open Settings
          </button>
        </div>
      ) : (
        <div css={css`
          display: flex;
          height: 100%;
          position: relative;
        `}>
          {/* Room List Sidebar */}
          {showRoomList && (
            <div css={css`
              width: 250px;
              background: rgba(0, 0, 0, 0.2);
              border-right: 1px solid rgba(255, 255, 255, 0.1);
              display: flex;
              flex-direction: column;
            `}>
              <div css={css`
                padding: 15px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-weight: 500;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}>
                Rooms
                <button
                  onClick={() => setShowRoomList(false)}
                  css={css`
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    padding: 4px;
                    &:hover { color: white; }
                  `}
                >
                  ←
                </button>
              </div>
              <div css={css`
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                ${scrollbarStyle}
              `}>
                {sortedRooms.map(space => (
                  <div key={space.id}>
                    {/* Space Header */}
                    <div css={css`
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      padding: 10px;
                      margin-bottom: 4px;
                      color: rgba(255, 255, 255, 0.8);
                      font-size: 12px;
                      font-weight: 500;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                    `}>
                      <Avatar url={space.avatar} name={space.name} size={20} fontSize={10} />
                      {space.name}
                    </div>

                    {/* Space Rooms */}
                    {space.rooms.map(room => (
                      <div
                        key={room.id}
                        onClick={() => handleRoomChange(room.id)}
                        css={css`
                          padding: 10px;
                          border-radius: 8px;
                          cursor: pointer;
                          background: ${room.id === roomId ? 'rgba(85, 27, 249, 0.1)' : 'transparent'};
                          border: 1px solid ${room.id === roomId ? '#551bf9' : 'transparent'};
                          display: flex;
                          gap: 12px;
                          align-items: center;
                          transition: all 0.2s ease;
                          margin-left: 12px;
                          
                          &:hover {
                            background: ${room.id === roomId ? 'rgba(85, 27, 249, 0.05)' : 'transparent'};
                            transform: translateX(2px);
                          }
                        `}
                      >
                        <Avatar url={room.avatar} name={room.name} size={40} />
                        <div css={css`flex: 1; min-width: 0;`}>
                          <div css={css`
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            gap: 8px;
                            margin-bottom: 4px;
                          `}>
                            <div css={css`
                              color: white;
                              font-weight: 500;
                              white-space: nowrap;
                              overflow: hidden;
                              text-overflow: ellipsis;
                            `}>
                              {room.name}
                            </div>
                            {room.unreadCount > 0 && (
                              <span css={css`
                                background: #551bf9;
                                color: white;
                                padding: 2px 6px;
                                border-radius: 10px;
                                font-size: 12px;
                                flex-shrink: 0;
                              `}>
                                {room.unreadCount}
                              </span>
                            )}
                          </div>
                          <div css={css`
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            gap: 8px;
                          `}>
                            <div css={css`
                              color: rgba(255, 255, 255, 0.6);
                              font-size: 12px;
                              white-space: nowrap;
                              overflow: hidden;
                              text-overflow: ellipsis;
                            `}>
                              {room.lastMessage}
                            </div>
                            {room.lastMessageTime && (
                              <div css={css`
                                color: rgba(255, 255, 255, 0.4);
                                font-size: 11px;
                                flex-shrink: 0;
                              `}>
                                {formatTime(room.lastMessageTime)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div css={css`
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
          `}>
            {/* Room Header */}
            <div css={css`
              padding: 15px;
              background: rgba(0, 0, 0, 0.2);
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-shrink: 0;
            `}>
              <div css={css`display: flex; align-items: center; gap: 10px;`}>
                {!showRoomList && (
                  <button
                    onClick={() => setShowRoomList(true)}
                    css={css`
                      background: none;
                      border: none;
                      color: rgba(255, 255, 255, 0.6);
                      cursor: pointer;
                      padding: 4px;
                      &:hover { color: white; }
                    `}
                  >
                    →
                  </button>
                )}
                <h2 css={css`
                  color: white;
                  font-size: 16px;
                  margin: 0;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                `}>
                  {roomStatus === 'joined' ? (
                    <>
                      <span css={css`
                        width: 8px;
                        height: 8px;
                        background: #4CAF50;
                        border-radius: 50%;
                      `} />
                      {rooms.find(r => r.id === roomId)?.name || 'Chat'}
                    </>
                  ) : (
                    <>
                      <span css={css`
                        width: 8px;
                        height: 8px;
                        background: #FFC107;
                        border-radius: 50%;
                        animation: pulse 1s infinite;
                        
                        @keyframes pulse {
                          0% { opacity: 0.4; }
                          50% { opacity: 1; }
                          100% { opacity: 0.4; }
                        }
                      `} />
                      Connecting...
                    </>
                  )}
                </h2>
              </div>
              <div css={css`display: flex; align-items: center; gap: 10px;`}>
                <div css={css`
                  position: relative;
                  display: flex;
                  gap: 4px;
                `}>
                  <button
                    onClick={() => {
                      setShowCallOptions(true)
                      setIsInVideoCall(true)
                      setSelectedMembers([])
                    }}
                    css={css`
                      background: none;
                      border: none;
                      color: rgba(255, 255, 255, 0.6);
                      cursor: pointer;
                      padding: 4px 8px;
                      border-radius: 4px;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                      
                      &:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: white;
                      }
                    `}
                  >
                    📹 Call Channel
                  </button>
                  <button
                    onClick={() => {
                      setShowCallOptions(true)
                      setIsInVideoCall(true)
                    }}
                    css={css`
                      background: none;
                      border: none;
                      color: rgba(255, 255, 255, 0.6);
                      cursor: pointer;
                      padding: 4px 8px;
                      border-radius: 4px;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                      
                      &:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: white;
                      }
                    `}
                  >
                    👥 Call Selected
                  </button>
                </div>
                <button
                  onClick={() => setShowMemberList(!showMemberList)}
                  css={css`
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    
                    &:hover {
                      background: rgba(255, 255, 255, 0.1);
                      color: white;
                    }
                  `}
                >
                  {showMemberList ? 'Hide Members' : 'Show Members'}
                </button>
              </div>
            </div>

            {/* Chat Content Area */}
            <div css={css`
              flex: 1;
              display: flex;
              overflow: hidden;
              position: relative;
            `}>
              {/* Messages Area */}
              <div css={css`
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                ${scrollbarStyle}
              `}>
                {messages.length === 0 && roomStatus === 'joining' ? (
                  <div css={css`
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 14px;
                  `}>
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div css={css`
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 14px;
                  `}>
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map(message => (
                    <div
                      key={message.id}
                      css={css`
                        display: flex;
                        flex-direction: ${message.sender === client.getUserId() ? 'row-reverse' : 'row'};
                        gap: 12px;
                        align-items: flex-end;
                        margin-bottom: 4px;
                      `}
                    >
                      <Avatar 
                        url={members.find(m => m.id === message.sender)?.avatar}
                        name={members.find(m => m.id === message.sender)?.name || message.sender}
                        size={36}
                      />
                      <div css={css`
                        background: ${message.sender === client.getUserId() ? '#551bf9' : 'rgba(255, 255, 255, 0.1)'};
                        padding: 10px 15px;
                        border-radius: 12px;
                        max-width: 70%;
                      `}>
                        <div css={css`
                          color: rgba(255, 255, 255, 0.8);
                          font-size: 13px;
                          font-weight: 500;
                          margin-bottom: 4px;
                        `}>
                          {members.find(m => m.id === message.sender)?.name || message.sender}
                        </div>
                        <MessageContent content={message.content} sender={message.sender} client={client} />
                        <div css={css`
                          color: rgba(255, 255, 255, 0.4);
                          font-size: 10px;
                          margin-top: 4px;
                        `}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Member List Sidebar */}
              {showMemberList && (
                <div css={css`
                  width: 200px;
                  background: rgba(0, 0, 0, 0.2);
                  border-left: 1px solid rgba(255, 255, 255, 0.1);
                  display: flex;
                  flex-direction: column;
                  flex-shrink: 0;
                `}>
                  <div css={css`
                    padding: 15px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    font-weight: 500;
                    flex-shrink: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  `}>
                    <span>Members ({members.length})</span>
                    {selectedMembers.length > 0 && (
                      <button
                        onClick={handleStartCall}
                        css={css`
                          background: #551bf9;
                          border: none;
                          color: white;
                          padding: 4px 8px;
                          border-radius: 4px;
                          font-size: 12px;
                          cursor: pointer;
                          display: flex;
                          align-items: center;
                          gap: 4px;
                          
                          &:hover {
                            background: #6633ff;
                          }
                        `}
                      >
                        <span>📹</span>
                        Call ({selectedMembers.length})
                      </button>
                    )}
                  </div>
                  <div css={css`
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    ${scrollbarStyle}
                  `}>
                    {members.map(member => (
                      <div
                        key={member.id}
                        onClick={() => member.id !== client.getUserId() && handleMemberSelect(member.id)}
                        css={css`
                          padding: 8px;
                          display: flex;
                          align-items: center;
                          gap: 10px;
                          border-radius: 6px;
                          cursor: ${member.id !== client.getUserId() ? 'pointer' : 'default'};
                          background: ${selectedMembers.includes(member.id) ? 'rgba(85, 27, 249, 0.1)' : 'transparent'};
                          border: 1px solid ${selectedMembers.includes(member.id) ? '#551bf9' : 'transparent'};
                          
                          &:hover {
                            background: ${member.id !== client.getUserId() ? 'rgba(255, 255, 255, 0.05)' : 'transparent'};
                          }
                        `}
                      >
                        <div css={css`position: relative;`}>
                          <Avatar url={member.avatar} name={member.name} size={32} />
                          <div css={css`
                            width: 10px;
                            height: 10px;
                            border-radius: 50%;
                            background: ${member.presence === 'online' ? '#4CAF50' : 
                                        member.presence === 'unavailable' ? '#FFC107' : '#9E9E9E'};
                            border: 2px solid rgba(0, 0, 0, 0.2);
                            position: absolute;
                            bottom: -2px;
                            right: -2px;
                          `} />
                        </div>
                        <div css={css`flex: 1; min-width: 0;`}>
                          <div css={css`
                            color: white;
                            font-size: 14px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                          `}>
                            {member.name}
                            {member.id === client.getUserId() && (
                              <span css={css`
                                font-size: 11px;
                                color: rgba(255, 255, 255, 0.4);
                              `}>
                                (You)
                              </span>
                            )}
                          </div>
                          {member.lastActiveAgo && member.presence !== 'online' && (
                            <div css={css`
                              color: rgba(255, 255, 255, 0.4);
                              font-size: 11px;
                            `}>
                              {formatLastActive(member.lastActiveAgo)}
                            </div>
                          )}
                        </div>
                        {member.id !== client.getUserId() && (
                          <div css={css`
                            width: 16px;
                            height: 16px;
                            border: 1.5px solid ${selectedMembers.includes(member.id) ? '#551bf9' : 'rgba(255, 255, 255, 0.2)'};
                            border-radius: 4px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: ${selectedMembers.includes(member.id) ? '#551bf9' : 'transparent'};
                            transition: all 0.2s ease;
                          `}>
                            {selectedMembers.includes(member.id) && (
                              <span css={css`
                                color: white;
                                font-size: 10px;
                              `}>✓</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div css={css`
              padding: 15px;
              background: rgba(0, 0, 0, 0.2);
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              display: flex;
              gap: 10px;
              position: relative;
              flex-shrink: 0;
            `}>
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                css={css`
                  background: none;
                  border: none;
                  color: rgba(255, 255, 255, 0.6);
                  cursor: pointer;
                  padding: 8px;
                  font-size: 20px;
                  transition: color 0.2s ease;
                  
                  &:hover {
                    color: white;
                  }
                `}
              >
                😊
              </button>
              
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  css={css`
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    z-index: 1000;
                  `}
                >
                  <Picker
                    data={data}
                    onEmojiSelect={handleEmojiSelect}
                    theme="dark"
                    previewPosition="none"
                    skinTonePosition="none"
                  />
                </div>
              )}

              <label
                css={css`
                  background: none;
                  border: none;
                  color: rgba(255, 255, 255, 0.6);
                  cursor: pointer;
                  padding: 8px;
                  font-size: 20px;
                  transition: color 0.2s ease;
                  
                  &:hover {
                    color: white;
                  }
                `}
              >
                📎
                <input
                  type="file"
                  onChange={e => handleFileUpload(e.target.files[0])}
                  css={css`display: none;`}
                />
              </label>

              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                css={css`
                  flex: 1;
                  background: rgba(0, 0, 0, 0.2);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 8px;
                  padding: 12px;
                  color: white;
                  font-size: 14px;
                  
                  &::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                  }
                  
                  &:focus {
                    outline: none;
                    border-color: #551bf9;
                  }
                `}
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || !loggedIn || !roomId || roomStatus !== 'joined'}
                css={css`
                  background: #551bf9;
                  border: none;
                  color: white;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-size: 14px;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  
                  &:hover:not(:disabled) {
                    background: #6633ff;
                    transform: translateY(-1px);
                  }
                  
                  &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                  }
                `}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Overlay */}
      {(isInVideoCall || showCallOptions) && (
        <VideoCall
          roomId={roomId}
          client={client}
          selectedMembers={selectedMembers}
          members={members}
          isSelectionMode={selectedMembers.length > 0}
          onClose={() => {
            setIsInVideoCall(false)
            setShowCallOptions(false)
            setSelectedMembers([])
          }}
        />
      )}
    </div>
  )
}

// Utility functions
function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString()
}

function formatLastActive(lastActiveAgo) {
  const minutes = Math.floor(lastActiveAgo / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
} 