import { css } from '@firebolt-dev/css'
import { useState, useRef, useEffect } from 'react'
import { themes, defaultWallpaper } from './themes'
import { hyperFoneOS } from '../hyperfoneOS'
import { useAuthContext } from '../../components/AuthProvider'
import { createClient } from 'matrix-js-sdk'
import moment from 'moment'
import { v4 as uuid } from 'uuid'

// Add developer mode state
const DEVELOPER_MODE_TAPS = 7

export function Settings({ 
  theme,
  currentTheme, 
  setCurrentTheme, 
  currentWallpaper, 
  setCurrentWallpaper,
  customThemes,
  addCustomTheme,
  removeCustomTheme,
  customWallpapers,
  addCustomWallpaper,
  removeCustomWallpaper,
  isDraggable,
  setIsDraggable,
  opacity,
  setOpacity,
  setIsOpen,
  handleOpenClose,
  animationSettings,
  setAnimationSettings
}) {
  const { user, status, connectWallet, disconnectWallet, SUPPORTED_WALLETS } = useAuthContext()
  const [activeSection, setActiveSection] = useState('general')
  const [isCreatingTheme, setIsCreatingTheme] = useState(false)
  const [newTheme, setNewTheme] = useState({
    id: '',
    name: '',
    primary: '#7928CA',
    background: '#1a1a1a',
    text: '#ffffff',
    error: '#ff4444',
    border: '#333333'
  })
  const fileInputRef = useRef(null)
  const [profilePicture, setProfilePicture] = useState(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [matrixUsername, setMatrixUsername] = useState('')
  const [matrixPassword, setMatrixPassword] = useState('')
  const [matrixClient, setMatrixClient] = useState(null)
  const [matrixError, setMatrixError] = useState(null)
  const [connectedAccounts, setConnectedAccounts] = useState({
    matrix: false,
    twitter: false,
    github: false
  })
  const profilePicInputRef = useRef(null)
  const [xProfile, setXProfile] = useState(null)
  const [xError, setXError] = useState(null)

  // Add developer mode state
  const [buildTaps, setBuildTaps] = useState(0)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false)
  const buildTapTimeout = useRef(null)

  // Add effect to initialize username from player data
  useEffect(() => {
    if (window.world?.entities?.player?.data?.user?.name) {
      setUsername(window.world.entities.player.data.user.name)
    }
  }, [])

  // Initialize Matrix client
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
      setMatrixClient(client)
      setConnectedAccounts(prev => ({ ...prev, matrix: true }))
    }
  }, [])

  // Initialize X connection from localStorage
  useEffect(() => {
    const savedXSession = localStorage.getItem('hyperfy_x_session')
    if (savedXSession) {
      try {
        const session = JSON.parse(savedXSession)
        setXProfile(session)
        setConnectedAccounts(prev => ({ ...prev, twitter: true }))
        // Update profile with X data
        if (session.profile_image_url) setProfilePicture(session.profile_image_url)
        if (session.name) setUsername(session.name)
        if (session.description) setBio(session.description)
      } catch (err) {
        console.error('Failed to load X session:', err)
        // Clear invalid session data
        localStorage.removeItem('hyperfy_x_session')
      }
    }
  }, [])

  // Initialize connectedAccounts state
  useEffect(() => {
    const savedConnections = localStorage.getItem('hyperfy_connected_accounts')
    if (savedConnections) {
      try {
        const connections = JSON.parse(savedConnections)
        setConnectedAccounts(prev => ({ ...prev, ...connections }))
      } catch (err) {
        console.error('Failed to load connected accounts:', err)
      }
    }
  }, [])

  // Save connected accounts state
  useEffect(() => {
    localStorage.setItem('hyperfy_connected_accounts', JSON.stringify(connectedAccounts))
  }, [connectedAccounts])

  // Handle Matrix login
  const handleMatrixLogin = async () => {
    try {
      setMatrixError(null)
      const formattedUsername = matrixUsername.startsWith('@') ? matrixUsername : `@${matrixUsername}:matrix.org`
      
      const client = createClient({
        baseUrl: 'https://matrix.org'
      })

      const response = await client.login('m.login.password', {
        user: formattedUsername,
        password: matrixPassword,
        initial_device_display_name: 'Hyperfy Chat App'
      })

      // Save session
      localStorage.setItem('hyperfy_matrix_session', JSON.stringify({
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id
      }))

      setMatrixClient(client)
      setConnectedAccounts(prev => ({ ...prev, matrix: true }))
      setMatrixPassword('') // Clear password for security
    } catch (err) {
      console.error('Failed to login to Matrix:', err)
      setMatrixError('Failed to login. Please check your credentials and try again.')
    }
  }

  // Handle Matrix logout
  const handleMatrixLogout = async () => {
    try {
      if (matrixClient) {
        await matrixClient.logout()
      }
      localStorage.removeItem('hyperfy_matrix_session')
      setMatrixClient(null)
      setConnectedAccounts(prev => ({ ...prev, matrix: false }))
      setMatrixUsername('')
      setMatrixPassword('')
      setMatrixError(null)
    } catch (err) {
      console.error('Failed to logout from Matrix:', err)
      setMatrixError('Failed to logout. Please try again.')
    }
  }

  // Update animation settings
  const updateAnimationSettings = (updates) => {
    const newSettings = { ...animationSettings, ...updates }
    setAnimationSettings(newSettings)
    localStorage.setItem('hyperfy_animation_settings', JSON.stringify(newSettings))
  }

  // Handle build number tap
  const handleBuildTap = () => {
    clearTimeout(buildTapTimeout.current)
    
    setBuildTaps(prev => {
      const newTaps = prev + 1
      if (newTaps === DEVELOPER_MODE_TAPS) {
        setIsDeveloperMode(true)
        hyperFoneOS.setState({ isDeveloperMode: true })
        return 0
      }
      return newTaps
    })

    buildTapTimeout.current = setTimeout(() => {
      setBuildTaps(0)
    }, 2000)
  }

  // Load developer mode state
  useEffect(() => {
    setIsDeveloperMode(hyperFoneOS.state.isDeveloperMode || false)
  }, [])

  // Add developer mode section to sections array
  const sections = [
    { id: 'profile', name: 'User Profile', icon: '👤' },
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'display', name: 'Display & Theme', icon: '🎨' },
    { id: 'animation', icon: '✨', label: 'Animation' },
    { id: 'window', icon: '🪟', label: 'Window' },
    { id: 'privacy', name: 'Privacy & Security', icon: '🔒' },
    { id: 'sound', name: 'Sound & Haptics', icon: '🔊' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'storage', name: 'Storage', icon: '💾' },
    { id: 'battery', name: 'Battery', icon: '🔋' },
    { id: 'about', name: 'About Device', icon: 'ℹ️' },
    ...(isDeveloperMode ? [{ id: 'developer', name: 'Developer Options', icon: '🛠️' }] : [])
  ]

  const systemInfo = hyperFoneOS.getSystemInfo()

  const handleCreateTheme = () => {
    if (!newTheme.id || !newTheme.name) return
    hyperFoneOS.addCustomTheme(newTheme)
    setNewTheme({
      id: '',
      name: '',
      primary: '#7928CA',
      background: '#1a1a1a',
      text: '#ffffff',
      error: '#ff4444',
      border: '#333333'
    })
  }

  const handleWallpaperUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Please upload an image smaller than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const wallpaperId = `wallpaper-${Date.now()}`
      addCustomWallpaper({
        id: wallpaperId,
        name: file.name.split('.')[0],
        url: event.target.result
      })
      setCurrentWallpaper(wallpaperId)
    }
    reader.readAsDataURL(file)
    
    // Reset input
    e.target.value = ''
  }

  const handleProfilePicUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Please upload an image smaller than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setProfilePicture(event.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleConnectX = async () => {
    try {
      setXError(null)
      
      // Mock X API response for demo
      const mockXProfile = {
        id: '123456789',
        name: 'Hyperfy User',
        username: 'hyperfyuser',
        profile_image_url: 'https://pbs.twimg.com/profile_images/default_profile.png',
        description: 'Web3 enthusiast exploring the metaverse through @hyperfy',
        followers_count: 1000,
        following_count: 500,
        created_at: '2024-01-01T00:00:00.000Z'
      }

      // Save X session
      localStorage.setItem('hyperfy_x_session', JSON.stringify(mockXProfile))
      
      // Update state
      setXProfile(mockXProfile)
      setConnectedAccounts(prev => ({ ...prev, twitter: true }))
      
      // Update profile with X data
      setProfilePicture(mockXProfile.profile_image_url)
      setUsername(mockXProfile.name)
      setBio(mockXProfile.description)
    } catch (err) {
      console.error('Failed to connect to X:', err)
      setXError('Failed to connect to X. Please try again.')
    }
  }

  const handleDisconnectX = () => {
    try {
      // Clear X session
      localStorage.removeItem('hyperfy_x_session')
      
      // Reset state
      setXProfile(null)
      setConnectedAccounts(prev => ({ ...prev, twitter: false }))
      setXError(null)
      
      // Reset profile if it was using X data
      if (xProfile) {
        setProfilePicture(null)
        setUsername('')
        setBio('')
      }
    } catch (err) {
      console.error('Failed to disconnect from X:', err)
      setXError('Failed to disconnect from X. Please try again.')
    }
  }

  const handleConnectAccount = async (platform) => {
    try {
      if (platform === 'phantom') {
        if (user?.type === SUPPORTED_WALLETS.PHANTOM) {
          // When disconnecting, just call disconnectWallet
          await disconnectWallet()
        } else {
          // When connecting, first check if Phantom is installed
          if (!window?.phantom?.solana) {
            alert('Please install Phantom wallet to connect')
            return
          }
          // Then try to connect
          await connectWallet(SUPPORTED_WALLETS.PHANTOM)
        }
        return
      }

      if (platform === 'twitter') {
        if (connectedAccounts.twitter) {
          handleDisconnectX()
        } else {
          handleConnectX()
        }
        return
      }

      // Handle other platforms with mock connection
      setConnectedAccounts(prev => ({
        ...prev,
        [platform]: !prev[platform]
      }))
    } catch (err) {
      console.error('Failed to connect account:', err)
      // Show error to user
      alert(`Failed to connect ${platform}: ${err.message}`)
    }
  }

  const allThemes = { ...themes, ...customThemes }

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            {/* Profile Picture & Basic Info */}
            <SettingGroup title="Profile Information" theme={theme}>
              <div css={css`
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 20px;
              `}>
                {/* Profile Picture */}
                <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 20px;
                `}>
                  <div css={css`
                    width: 80px;
                    height: 80px;
                    border-radius: 40px;
                    overflow: hidden;
                    background: ${theme.background}dd;
                    border: 2px solid ${theme.primary}44;
                    position: relative;
                  `}>
                    {profilePicture ? (
                      <img 
                        src={profilePicture} 
                        alt="Profile"
                        css={css`
                          width: 100%;
                          height: 100%;
                          object-fit: cover;
                        `}
                      />
                    ) : (
                      <div css={css`
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 32px;
                      `}>
                        👤
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => profilePicInputRef.current?.click()}
                    css={css`
                      background: ${theme.primary}22;
                      border: 1px solid ${theme.primary}44;
                      color: ${theme.primary};
                      padding: 8px 16px;
                      border-radius: 8px;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        background: ${theme.primary}33;
                        border-color: ${theme.primary};
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    Change Picture
                  </button>
                  <input
                    ref={profilePicInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePicUpload}
                    css={css`display: none;`}
                  />
                </div>

                {/* Username */}
                <div css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                `}>
                  <label css={css`
                    color: ${theme.text}aa;
                    font-size: 14px;
                  `}>
                    Username
                  </label>
                  <div css={css`
                    display: flex;
                    gap: 8px;
                  `}>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      css={css`
                        flex: 1;
                        background: ${theme.background}dd;
                        border: 1px solid ${theme.primary}44;
                        color: ${theme.text};
                        padding: 12px;
                        border-radius: 8px;
                        font-size: 14px;
                        
                        &:focus {
                          outline: none;
                          border-color: ${theme.primary};
                        }
                      `}
                    />
                    <button
                      onClick={() => handleSaveUsername(username)}
                      css={css`
                        background: ${theme.primary}22;
                        border: 1px solid ${theme.primary}44;
                        color: ${theme.primary};
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        
                        &:hover {
                          background: ${theme.primary}33;
                          border-color: ${theme.primary};
                          transform: translateY(-2px);
                        }
                      `}
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Bio */}
                <div css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                `}>
                  <label css={css`
                    color: ${theme.text}aa;
                    font-size: 14px;
                  `}>
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    css={css`
                      background: ${theme.background}dd;
                      border: 1px solid ${theme.primary}44;
                      color: ${theme.text};
                      padding: 12px;
                      border-radius: 8px;
                      font-size: 14px;
                      min-height: 100px;
                      resize: vertical;
                      
                      &:focus {
                        outline: none;
                        border-color: ${theme.primary};
                      }
                    `}
                  />
                </div>
              </div>
            </SettingGroup>

            {/* Connected Accounts */}
            <SettingGroup title="Connected Accounts" theme={theme}>
              <div css={css`
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
              `}>
                {/* X Account */}
                <div css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 12px;
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}44;
                  border-radius: 8px;
                `}>
                  <div css={css`
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  `}>
                    <div css={css`
                      font-size: 24px;
                    `}>
                      𝕏
                    </div>
                    <div css={css`
                      display: flex;
                      flex-direction: column;
                    `}>
                      <div css={css`
                        font-size: 14px;
                        color: ${theme.text};
                      `}>
                        X (Twitter)
                      </div>
                      {xProfile && (
                        <div css={css`
                          font-size: 12px;
                          color: ${theme.text}88;
                        `}>
                          @{xProfile.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleConnectAccount('twitter')}
                    css={css`
                      background: ${connectedAccounts.twitter ? theme.error : theme.primary}22;
                      border: 1px solid ${connectedAccounts.twitter ? theme.error : theme.primary}44;
                      color: ${connectedAccounts.twitter ? theme.error : theme.primary};
                      padding: 8px 16px;
                      border-radius: 8px;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        background: ${connectedAccounts.twitter ? theme.error : theme.primary}33;
                        border-color: ${connectedAccounts.twitter ? theme.error : theme.primary};
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    {connectedAccounts.twitter ? 'Disconnect' : 'Connect'}
                  </button>
                </div>

                {/* Matrix Account */}
                <div css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 12px;
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}44;
                  border-radius: 8px;
                `}>
                  <div css={css`
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  `}>
                    <div css={css`
                      font-size: 24px;
                    `}>
                      💬
                    </div>
                    <div css={css`
                      display: flex;
                      flex-direction: column;
                    `}>
                      <div css={css`
                        font-size: 14px;
                        color: ${theme.text};
                      `}>
                        Matrix Chat
                      </div>
                      {matrixClient && (
                        <div css={css`
                          font-size: 12px;
                          color: ${theme.text}88;
                        `}>
                          {matrixUsername}
                        </div>
                      )}
                    </div>
                  </div>
                  {!connectedAccounts.matrix ? (
                    <div css={css`
                      display: flex;
                      gap: 8px;
                    `}>
                      <input
                        type="text"
                        value={matrixUsername}
                        onChange={(e) => setMatrixUsername(e.target.value)}
                        placeholder="Username"
                        css={css`
                          background: ${theme.background}dd;
                          border: 1px solid ${theme.primary}44;
                          color: ${theme.text};
                          padding: 8px;
                          border-radius: 8px;
                          font-size: 14px;
                          width: 120px;
                          
                          &:focus {
                            outline: none;
                            border-color: ${theme.primary};
                          }
                        `}
                      />
                      <input
                        type="password"
                        value={matrixPassword}
                        onChange={(e) => setMatrixPassword(e.target.value)}
                        placeholder="Password"
                        css={css`
                          background: ${theme.background}dd;
                          border: 1px solid ${theme.primary}44;
                          color: ${theme.text};
                          padding: 8px;
                          border-radius: 8px;
                          font-size: 14px;
                          width: 120px;
                          
                          &:focus {
                            outline: none;
                            border-color: ${theme.primary};
                          }
                        `}
                      />
                      <button
                        onClick={handleMatrixLogin}
                        css={css`
                          background: ${theme.primary}22;
                          border: 1px solid ${theme.primary}44;
                          color: ${theme.primary};
                          padding: 8px 16px;
                          border-radius: 8px;
                          font-size: 14px;
                          cursor: pointer;
                          transition: all 0.2s ease;
                          
                          &:hover {
                            background: ${theme.primary}33;
                            border-color: ${theme.primary};
                            transform: translateY(-2px);
                          }
                        `}
                      >
                        Connect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleMatrixLogout}
                      css={css`
                        background: ${theme.error}22;
                        border: 1px solid ${theme.error}44;
                        color: ${theme.error};
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        
                        &:hover {
                          background: ${theme.error}33;
                          border-color: ${theme.error};
                          transform: translateY(-2px);
                        }
                      `}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                {matrixError && (
                  <div css={css`
                    color: ${theme.error};
                    font-size: 14px;
                    padding: 8px;
                    background: ${theme.error}22;
                    border-radius: 8px;
                  `}>
                    {matrixError}
                  </div>
                )}

                {/* Phantom Wallet */}
                <div css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 12px;
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}44;
                  border-radius: 8px;
                `}>
                  <div css={css`
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  `}>
                    <div css={css`
                      font-size: 24px;
                    `}>
                      👻
                    </div>
                    <div css={css`
                      display: flex;
                      flex-direction: column;
                    `}>
                      <div css={css`
                        font-size: 14px;
                        color: ${theme.text};
                      `}>
                        Phantom Wallet
                      </div>
                      {user?.type === SUPPORTED_WALLETS.PHANTOM && user?.publicKey && (
                        <div css={css`
                          font-size: 12px;
                          color: ${theme.text}88;
                        `}>
                          {user.publicKey.toString().slice(0, 4)}...{user.publicKey.toString().slice(-4)}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleConnectAccount('phantom')}
                    css={css`
                      background: ${user?.type === SUPPORTED_WALLETS.PHANTOM ? theme.error : theme.primary}22;
                      border: 1px solid ${user?.type === SUPPORTED_WALLETS.PHANTOM ? theme.error : theme.primary}44;
                      color: ${user?.type === SUPPORTED_WALLETS.PHANTOM ? theme.error : theme.primary};
                      padding: 8px 16px;
                      border-radius: 8px;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        background: ${user?.type === SUPPORTED_WALLETS.PHANTOM ? theme.error : theme.primary}33;
                        border-color: ${user?.type === SUPPORTED_WALLETS.PHANTOM ? theme.error : theme.primary};
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    {user?.type === SUPPORTED_WALLETS.PHANTOM ? 'Disconnect' : 'Connect'}
                  </button>
                </div>

                {/* GitHub Account */}
                <div css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 12px;
                  background: ${theme.background}dd;
                  border: 1px solid ${theme.primary}44;
                  border-radius: 8px;
                `}>
                  <div css={css`
                    display: flex;
                    align-items: center;
                    gap: 12px;
                  `}>
                    <div css={css`
                      font-size: 24px;
                    `}>
                      ⌨️
                    </div>
                    <div css={css`
                      display: flex;
                      flex-direction: column;
                    `}>
                      <div css={css`
                        font-size: 14px;
                        color: ${theme.text};
                      `}>
                        GitHub
                      </div>
                      {connectedAccounts.github && (
                        <div css={css`
                          font-size: 12px;
                          color: ${theme.text}88;
                        `}>
                          Connected
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleConnectAccount('github')}
                    css={css`
                      background: ${connectedAccounts.github ? theme.error : theme.primary}22;
                      border: 1px solid ${connectedAccounts.github ? theme.error : theme.primary}44;
                      color: ${connectedAccounts.github ? theme.error : theme.primary};
                      padding: 8px 16px;
                      border-radius: 8px;
                      font-size: 14px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      
                      &:hover {
                        background: ${connectedAccounts.github ? theme.error : theme.primary}33;
                        border-color: ${connectedAccounts.github ? theme.error : theme.primary};
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    {connectedAccounts.github ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>
            </SettingGroup>
          </div>
        )

      case 'general':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Language & Region" theme={theme}>
              <SettingItem
                icon="🌐"
                title="System Language"
                value="English (US)"
                onClick={() => {}}
                theme={theme}
              />
              <SettingItem
                icon="🕒"
                title="Time Zone"
                value="UTC-05:00 Eastern Time"
                onClick={() => {}}
                theme={theme}
              />
              <SettingItem
                icon="📅"
                title="Date Format"
                value="MM/DD/YYYY"
                onClick={() => {}}
                theme={theme}
              />
            </SettingGroup>

            <SettingGroup title="Accessibility" theme={theme}>
              <SettingToggle
                icon="🔍"
                title="Zoom"
                description="Enable screen zoom gestures"
                value={false}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="👆"
                title="Draggable Window"
                description="Enable window dragging with touch/mouse"
                value={isDraggable}
                onChange={setIsDraggable}
                theme={theme}
              />
            </SettingGroup>

            <SettingGroup title="Auto-Lock" theme={theme}>
              <SettingSelect
                icon="⏰"
                title="Auto-Lock Timer"
                value="5 minutes"
                options={["Never", "1 minute", "5 minutes", "15 minutes", "30 minutes"]}
                onChange={() => {}}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'display':
        return (
            <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Wallpaper" theme={theme}>
              <div css={css`
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 15px;
                padding: 10px;
                `}>
                  <button
                  onClick={() => fileInputRef.current?.click()}
                    css={css`
                    aspect-ratio: 1;
                    background: ${theme.background}44;
                    border: 2px dashed ${theme.primary}44;
                      border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                      cursor: pointer;
                    font-size: 24px;
                      transition: all 0.2s ease;
                      
                      &:hover {
                      background: ${theme.background}66;
                      border-color: ${theme.primary}88;
                      }
                    `}
                  >
                  +
                  </button>
                  <button
                    onClick={() => {
                      const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                      addCustomWallpaper({
                        id: `color-${Date.now()}`,
                        name: 'Random Color',
                        url: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='${randomColor}'/></svg>`,
                        isColor: true,
                        color: randomColor
                      });
                    }}
                    css={css`
                      aspect-ratio: 1;
                      background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff);
                      border: 2px solid ${theme.border};
                      border-radius: 12px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      cursor: pointer;
                      font-size: 16px;
                      color: white;
                      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                      transition: all 0.2s ease;
                      overflow: hidden;
                      
                      &:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px ${theme.primary}33;
                      }

                      &:after {
                        content: '🎨';
                        font-size: 24px;
                      }
                    `}
                  />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleWallpaperUpload}
                  css={css`display: none;`}
                />
                {Object.entries({ default: defaultWallpaper, ...customWallpapers }).map(([id, wallpaper]) => (
                  <button
                    key={id}
                    onClick={() => setCurrentWallpaper(id)}
                    css={css`
                      aspect-ratio: 1;
                      background-image: url(${wallpaper.url});
                      background-size: cover;
                      background-position: center;
                      border: 2px solid ${currentWallpaper === id ? theme.primary : theme.border};
                      border-radius: 12px;
                      cursor: pointer;
                      transition: all 0.2s ease;
                      position: relative;
                      overflow: hidden;
                      
                      &:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px ${theme.primary}33;

                        .delete-button {
                          opacity: 1;
                        }
                      }

                      ${currentWallpaper === id && `
                        box-shadow: 0 0 0 2px ${theme.background}, 0 0 0 4px ${theme.primary};
                      `}
                    `}
                  >
                    {id !== 'default' && (
                      <button
                        className="delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentWallpaper === id) {
                            setCurrentWallpaper('default');
                          }
                          removeCustomWallpaper(id);
                        }}
                        css={css`
                          position: absolute;
                          top: 5px;
                          right: 5px;
                          width: 24px;
                          height: 24px;
                          border-radius: 12px;
                          background: ${theme.error || '#ff4444'};
                          border: none;
                          color: white;
                          font-size: 14px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          cursor: pointer;
                          opacity: 0;
                          transition: all 0.2s ease;
                          z-index: 2;

                          &:hover {
                            transform: scale(1.1);
                          }
                        `}
                      >
                        ×
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup title="Theme" theme={theme}>
          <div css={css`
            display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
                padding: 10px;
              `}>
                <button
                  onClick={() => setIsCreatingTheme(true)}
                  css={css`
                    background: ${theme.background}44;
                    border: 2px dashed ${theme.primary}44;
                    border-radius: 12px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    
                    &:hover {
                      background: ${theme.background}66;
                      border-color: ${theme.primary}88;
                      transform: translateY(-2px);
                    }
                  `}
                >
                  <div css={css`
                    font-size: 24px;
                  `}>+</div>
                  <div css={css`
                    font-size: 12px;
                    text-align: center;
                  `}>Create Theme</div>
                </button>

                {Object.entries({ ...themes, ...customThemes }).map(([id, themeData]) => {
                  const darkVariant = themeData.variants?.dark || themeData;
                  const lightVariant = themeData.variants?.light || themeData;
                  return (
                    <button
                      key={id}
                      onClick={() => setCurrentTheme(id)}
                      css={css`
                        background: ${darkVariant.background};
                        border: 2px solid ${currentTheme === id ? theme.primary : darkVariant.border};
                        border-radius: 12px;
                        padding: 15px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        position: relative;
                        overflow: hidden;
                        
                        &:hover {
                          transform: translateY(-2px);
                          box-shadow: 0 5px 15px ${darkVariant.primary}33;

                          .delete-button {
                            opacity: 1;
                          }
                        }

                        ${currentTheme === id && `
                          box-shadow: 0 0 0 2px ${theme.background}, 0 0 0 4px ${theme.primary};
                        `}
                      `}
                    >
                      {!themes[id] && (
                  <button
                          className="delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (currentTheme === id) {
                              setCurrentTheme('hyperfy');
                            }
                            removeCustomTheme(id);
                          }}
                    css={css`
                      position: absolute;
                            top: 5px;
                            right: 5px;
                      width: 24px;
                      height: 24px;
                      border-radius: 12px;
                            background: ${theme.error || '#ff4444'};
                      border: none;
                            color: white;
                      font-size: 14px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      cursor: pointer;
                            opacity: 0;
                      transition: all 0.2s ease;
                            z-index: 2;
                      
                      &:hover {
                        transform: scale(1.1);
                      }
                    `}
                  >
                    ×
                  </button>
                )}
                      <div css={css`
                        display: flex;
                        gap: 4px;
                        margin-bottom: 10px;
                      `}>
                        <div css={css`
                          flex: 1;
                          height: 60px;
                          background: ${darkVariant.primary};
                          border-radius: 8px;
                          position: relative;
                          overflow: hidden;
                          
                          &:before {
                            content: '';
                            position: absolute;
                            inset: 0;
                            background: ${darkVariant.background};
                            opacity: 0.8;
                          }
                        `} />
                        <div css={css`
                          flex: 1;
                          height: 60px;
                          background: ${lightVariant.primary};
                          border-radius: 8px;
                          position: relative;
                          overflow: hidden;
                          
                          &:before {
                            content: '';
                            position: absolute;
                            inset: 0;
                            background: ${lightVariant.background};
                            opacity: 0.8;
                          }
                        `} />
                      </div>
                      <div css={css`
                        color: ${darkVariant.text};
                        font-size: 12px;
                        text-align: center;
                      `}>
                        {themeData.name || id}
                      </div>
                    </button>
                  );
                })}
              </div>
            </SettingGroup>

            <SettingGroup title="Display" theme={theme}>
              <SettingSlider
                icon="☀️"
                title="Window Transparency"
                description="Adjust the window's transparency level"
                value={opacity}
                onChange={(value) => setOpacity(value)}
                theme={theme}
              />
              <SettingToggle
                icon="🌓"
                title="Dark Mode"
                description="Switch between light and dark theme"
                value={hyperFoneOS.state.isDarkMode}
                onChange={(enabled) => {
                  hyperFoneOS.setState({ isDarkMode: enabled });
                }}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'animation':
        return (
          <div css={css`
            padding: 20px;
            color: ${theme.text};
          `}>
            <h2 css={css`
              margin: 0 0 20px 0;
              font-size: 24px;
              font-weight: 600;
            `}>
              Animation Settings
            </h2>

            {/* Duration Slider */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Animation Duration: {animationSettings.duration}ms
              </label>
              <input
                type="range"
                min="200"
                max="2000"
                step="100"
                value={animationSettings.duration}
                onChange={(e) => updateAnimationSettings({ duration: Number(e.target.value) })}
                css={css`
                  width: 100%;
                  height: 4px;
                  border-radius: 2px;
                  background: ${theme.primary}44;
                  appearance: none;
                  outline: none;

                  &::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: ${theme.primary};
                    cursor: pointer;
                    border: 2px solid ${theme.background};
                    box-shadow: 0 0 10px ${theme.primary}66;
                  }
                `}
              />
            </div>

            {/* Animation Curve Selector */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Animation Style
              </label>
              <div css={css`
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 10px;
              `}>
                {[
                  { id: 'linear', label: 'Linear', curve: 'cubic-bezier(0, 0, 1, 1)' },
                  { id: 'ease', label: 'Ease', curve: 'cubic-bezier(0.4, 0, 0.2, 1)' },
                  { id: 'bounce', label: 'Bounce', curve: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
                  { id: 'snap', label: 'Snap', curve: 'cubic-bezier(0.4, 0, 0.6, 1)' }
                ].map(style => (
                  <button
                    key={style.id}
                    onClick={() => updateAnimationSettings({ curve: style.id })}
                    css={css`
                      background: ${animationSettings.curve === style.id ? theme.primary : 'transparent'};
                      color: ${animationSettings.curve === style.id ? theme.background : theme.text};
                      border: 1px solid ${theme.primary};
                      padding: 8px;
                      border-radius: 6px;
                      cursor: pointer;
                      transition: all 0.2s ${style.curve};
                      
                      &:hover {
                        background: ${theme.primary}22;
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Toggle */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
              `}>
                <input
                  type="checkbox"
                  checked={animationSettings.rotation}
                  onChange={(e) => updateAnimationSettings({ rotation: e.target.checked })}
                  css={css`
                    width: 20px;
                    height: 20px;
                    border-radius: 4px;
                    border: 2px solid ${theme.primary};
                    appearance: none;
                    outline: none;
                    cursor: pointer;
                    position: relative;
                    
                    &:checked {
                      background: ${theme.primary};
                      
                      &:after {
                        content: '✓';
                        position: absolute;
                        color: ${theme.background};
                        font-size: 14px;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                      }
                    }
                  `}
                />
                Enable Rotation Effect
              </label>
            </div>

            {/* Preview Button */}
            <button
              onClick={() => {
                // Close the phone with animation
                handleOpenClose(false)
                hyperFoneOS.closeApp()
                hyperFoneOS.lock()
                
                // Reopen after animation duration
                setTimeout(() => {
                  handleOpenClose(true)
                  hyperFoneOS.unlock()
                  hyperFoneOS.launchApp('settings')
                }, animationSettings.duration + 100)
              }}
              css={css`
                background: ${theme.primary};
                color: ${theme.background};
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
                
                &:hover {
                  opacity: 0.9;
                  transform: translateY(-2px);
                }
              `}
            >
              Preview Animation
            </button>
          </div>
        )

      case 'window':
        return (
          <div css={css`
            padding: 20px;
            color: ${theme.text};
          `}>
            <h2 css={css`
              margin: 0 0 20px 0;
              font-size: 24px;
              font-weight: 600;
            `}>
              Window Settings
            </h2>

            {/* Window Position */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Window Position
              </label>
              <input
                type="text"
                value={hyperFoneOS.state.windowPosition}
                onChange={(e) => {
                  const [x, y] = e.target.value.split(',').map(Number)
                  hyperFoneOS.setState({
                    windowPosition: { x, y }
                  })
                }}
                css={css`
                  background: ${theme.background}44;
                  border: 1px solid ${theme.border};
                  border-radius: 4px;
                  color: ${theme.text};
                  padding: 6px 12px;
                  font-size: 14px;
                  outline: none;
                  
                  &:focus {
                    border-color: ${theme.primary};
                  }
                `}
              />
            </div>

            {/* Window Size */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Window Size
              </label>
              <input
                type="text"
                value={hyperFoneOS.state.windowSize}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number)
                  hyperFoneOS.setState({
                    windowSize: { width, height }
                  })
                }}
                css={css`
                  background: ${theme.background}44;
                  border: 1px solid ${theme.border};
                  border-radius: 4px;
                  color: ${theme.text};
                  padding: 6px 12px;
                  font-size: 14px;
                  outline: none;
                  
                  &:focus {
                    border-color: ${theme.primary};
                  }
                `}
              />
            </div>

            {/* Window Transparency */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Window Transparency
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={hyperFoneOS.state.windowTransparency}
                onChange={(e) => {
                  hyperFoneOS.setState({
                    windowTransparency: parseInt(e.target.value)
                  })
                }}
                css={css`
                  width: 100%;
                  height: 4px;
                  background: ${theme.primary}44;
                  appearance: none;
                  outline: none;

                  &::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: ${theme.primary};
                    cursor: pointer;
                    border: 2px solid ${theme.background};
                    box-shadow: 0 0 10px ${theme.primary}66;
                  }
                `}
              />
            </div>

            {/* Window Border */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Window Border
              </label>
              <input
                type="text"
                value={hyperFoneOS.state.windowBorder}
                onChange={(e) => {
                  hyperFoneOS.setState({
                    windowBorder: e.target.value
                  })
                }}
                css={css`
                  background: ${theme.background}44;
                  border: 1px solid ${theme.border};
                  border-radius: 4px;
                  color: ${theme.text};
                  padding: 6px 12px;
                  font-size: 14px;
                  outline: none;
                  
                  &:focus {
                    border-color: ${theme.primary};
                  }
                `}
              />
            </div>

            {/* Window Shadow */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Window Shadow
              </label>
              <input
                type="text"
                value={hyperFoneOS.state.windowShadow}
                onChange={(e) => {
                  hyperFoneOS.setState({
                    windowShadow: e.target.value
                  })
                }}
                css={css`
                  background: ${theme.background}44;
                  border: 1px solid ${theme.border};
                  border-radius: 4px;
                  color: ${theme.text};
                  padding: 6px 12px;
                  font-size: 14px;
                  outline: none;
                  
                  &:focus {
                    border-color: ${theme.primary};
                  }
                `}
              />
            </div>

            {/* Window Corner Radius */}
            <div css={css`margin-bottom: 30px;`}>
              <label css={css`
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
              `}>
                Window Corner Radius
              </label>
              <input
                type="text"
                value={hyperFoneOS.state.windowCornerRadius}
                onChange={(e) => {
                  hyperFoneOS.setState({
                    windowCornerRadius: e.target.value
                  })
                }}
                css={css`
                  background: ${theme.background}44;
                  border: 1px solid ${theme.border};
                  border-radius: 4px;
                  color: ${theme.text};
                  padding: 6px 12px;
                  font-size: 14px;
                  outline: none;
                  
                  &:focus {
                    border-color: ${theme.primary};
                  }
                `}
              />
            </div>
          </div>
        )

      case 'privacy':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Security" theme={theme}>
              <SettingToggle
                icon="🔐"
                title="Face ID"
                description="Use facial recognition to unlock device"
                value={false}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="👆"
                title="Fingerprint"
                description="Use fingerprint to unlock device"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
              <SettingItem
                icon="🔑"
                title="Change Passcode"
                onClick={() => {}}
                theme={theme}
              />
            </SettingGroup>

            <SettingGroup title="Privacy" theme={theme}>
              <SettingToggle
                icon="📍"
                title="Location Services"
                description="Allow apps to use your location"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="📸"
                title="Camera Access"
                description="Allow apps to use the camera"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="🎤"
                title="Microphone Access"
                description="Allow apps to use the microphone"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
            </SettingGroup>

            <SettingGroup title="App Permissions" theme={theme}>
              <SettingItem
                icon="📱"
                title="App Permissions"
                description="Manage individual app permissions"
                onClick={() => {}}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'sound':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Volume" theme={theme}>
              <SettingSlider
                icon="🔊"
                title="Media Volume"
                value={75}
                onChange={() => {}}
                theme={theme}
              />
              <SettingSlider
                icon="🔔"
                title="Notification Volume"
                value={60}
                onChange={() => {}}
                theme={theme}
              />
              <SettingSlider
                icon="⏰"
                title="Alarm Volume"
                value={100}
                onChange={() => {}}
                theme={theme}
              />
            </SettingGroup>

            <SettingGroup title="Sound Effects" theme={theme}>
              <SettingToggle
                icon="🎵"
                title="Keyboard Sounds"
                description="Play sound when typing"
                value={false}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="📳"
                title="Haptic Feedback"
                description="Vibrate on touch"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'notifications':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Notification Settings" theme={theme}>
              <SettingToggle
                icon="🔕"
                title="Do Not Disturb"
                description="Silence notifications"
                value={false}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="🔔"
                title="Show Previews"
                description="Show notification content on lock screen"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
            </SettingGroup>

            <SettingGroup title="App Notifications" theme={theme}>
              {Object.values(hyperFoneOS.state.installedApps).map(app => (
                <SettingToggle
                  key={app.id}
                  icon={app.icon}
                  title={app.name}
                  description="Allow notifications"
                  value={true}
                  onChange={() => {}}
                  theme={theme}
                />
              ))}
            </SettingGroup>
          </div>
        )

      case 'storage':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Storage Usage" theme={theme}>
              <div css={css`
                padding: 15px;
                background: ${theme.background}44;
                border-radius: 12px;
              `}>
                <div css={css`
                  margin-bottom: 15px;
                  display: flex;
                  justify-content: space-between;
                  color: ${theme.text};
                `}>
                  <span>Used: {systemInfo.usedStorage}</span>
                  <span>Available: {systemInfo.availableStorage}</span>
                </div>
                <div css={css`
                  height: 8px;
                  background: ${theme.background};
                  border-radius: 4px;
                  overflow: hidden;
                `}>
                  <div css={css`
                    width: 20%;
                    height: 100%;
                    background: ${theme.primary};
                  `}/>
                </div>
              </div>
            </SettingGroup>

            <SettingGroup title="Storage Management" theme={theme}>
              <SettingItem
                icon="🧹"
                title="Clear Cache"
                description="Free up space by clearing app caches"
                onClick={() => {}}
                theme={theme}
              />
              <SettingItem
                icon="📱"
                title="App Storage"
                description="View and manage app storage"
                onClick={() => {}}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'battery':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Battery Status" theme={theme}>
              <div css={css`
                padding: 20px;
                background: ${theme.background}44;
                border-radius: 12px;
                text-align: center;
              `}>
                <div css={css`
                  font-size: 48px;
                  margin-bottom: 10px;
                `}>
                  {systemInfo.isCharging ? '⚡' : '🔋'}
                </div>
                <div css={css`
                  font-size: 24px;
                  color: ${theme.text};
                  margin-bottom: 5px;
                `}>
                  {Math.round(systemInfo.batteryLevel * 100)}%
                </div>
                <div css={css`
                  color: ${theme.textSecondary};
                  font-size: 14px;
                `}>
                  {systemInfo.isCharging ? 'Charging' : 'Not Charging'}
                </div>
              </div>
            </SettingGroup>

            <SettingGroup title="Battery Optimization" theme={theme}>
              <SettingToggle
                icon="🔋"
                title="Low Power Mode"
                description="Reduce power consumption"
                value={false}
                onChange={() => {}}
                theme={theme}
              />
              <SettingToggle
                icon="📊"
                title="Background App Refresh"
                description="Allow apps to refresh in background"
                value={true}
                onChange={() => {}}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'about':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Device Information" theme={theme}>
              <div css={css`
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 10px;
              `}>
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}>
                  <span css={css`color: ${theme.text};`}>Device Name</span>
                  <span css={css`color: ${theme.textSecondary};`}>HyperFone</span>
                </div>
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}>
                  <span css={css`color: ${theme.text};`}>Model</span>
                  <span css={css`color: ${theme.textSecondary};`}>HF-2024</span>
                </div>
                <div css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}>
                  <span css={css`color: ${theme.text};`}>OS Version</span>
                  <span css={css`color: ${theme.textSecondary};`}>HyperFoneOS 1.0</span>
                </div>
              </div>
            </SettingGroup>

            <SettingGroup title="Software" theme={theme}>
              <SettingItem
                icon="🤖"
                title="OS Version"
                value={`${systemInfo.osName} ${systemInfo.osVersion}`}
                onClick={() => {}}
                theme={theme}
              />
              <div css={css`
                display: flex;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid ${theme.border}22;
                gap: 12px;
                
                &:last-child {
                  border-bottom: none;
                }
              `}>
                <span 
                  onClick={handleBuildTap}
                  css={css`
                    font-size: 20px;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                    
                    &:hover {
                      transform: scale(1.2);
                    }
                  `}
                >
                  🏗️
                </span>
                <div css={css`flex: 1;`}>Build Number</div>
                <div css={css`
                  color: ${theme.textSecondary};
                  font-size: 14px;
                `}>
                  {systemInfo.buildNumber}
                </div>
              </div>
            </SettingGroup>

            <SettingGroup title="Hardware" theme={theme}>
              <SettingItem
                icon="💻"
                title="Processor"
                value={systemInfo.cpu}
                onClick={() => {}}
                theme={theme}
              />
              <SettingItem
                icon="🎮"
                title="Graphics"
                value={systemInfo.gpu}
                onClick={() => {}}
                theme={theme}
              />
              <SettingItem
                icon="🧠"
                title="Memory"
                value={systemInfo.ram}
                onClick={() => {}}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      case 'developer':
        return (
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}>
            <SettingGroup title="Developer Options" theme={theme}>
              <SettingToggle
                icon="🔍"
                title="Show World Inspector"
                description="Display hierarchy and details of world objects"
                value={hyperFoneOS.state.showWorldInspector}
                onChange={(value) => hyperFoneOS.setState({ showWorldInspector: value })}
                theme={theme}
              />
              <SettingToggle
                icon="🎯"
                title="Show Object Bounds"
                description="Display bounding boxes around objects"
                value={hyperFoneOS.state.showObjectBounds}
                onChange={(value) => hyperFoneOS.setState({ showObjectBounds: value })}
                theme={theme}
              />
              <SettingToggle
                icon="📊"
                title="Show Performance Stats"
                description="Display FPS and performance metrics"
                value={hyperFoneOS.state.showPerformanceStats}
                onChange={(value) => hyperFoneOS.setState({ showPerformanceStats: value })}
                theme={theme}
              />
            </SettingGroup>
          </div>
        )

      default:
        return null
    }
  }

  // Modify username save logic
  const handleSaveUsername = (newUsername) => {
    if (!newUsername || newUsername === username) return
    
    // Update chat name using /name command
    const msg = {
      id: uuid(),
      from: null,
      fromId: null,
      body: `/name ${newUsername}`,
      createdAt: moment().toISOString(),
    }
    window.world.chat.add(msg, true)
    
    // Update local state
    setUsername(newUsername)
  }

  return (
    <div css={css`
      display: flex;
      height: 100%;
      color: ${theme.text};
      overflow: hidden;
    `}>
      {/* Sidebar */}
      <div css={css`
        width: 200px;
        background: ${theme.background}44;
        backdrop-filter: blur(10px);
        border-right: 1px solid ${theme.border};
        padding: 20px 10px;
        overflow-y: auto;

        &::-webkit-scrollbar {
          width: 4px;
        }
        
        &::-webkit-scrollbar-track {
          background: ${theme.background}44;
        }
        
        &::-webkit-scrollbar-thumb {
          background: ${theme.primary}44;
          border-radius: 2px;
        }
      `}>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            css={css`
              width: 100%;
              padding: 12px;
              background: ${activeSection === section.id ? theme.primary : 'transparent'};
              border: 1px solid ${activeSection === section.id ? theme.primary : theme.border}44;
              border-radius: 8px;
              color: ${activeSection === section.id ? theme.background : theme.text};
              text-align: left;
              cursor: pointer;
              margin-bottom: 8px;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              gap: 8px;
              font-family: 'Courier New', monospace;
              
              &:hover {
                background: ${activeSection === section.id ? theme.primary : theme.primary}22;
                border-color: ${theme.primary};
              }
            `}
          >
            <span>{section.icon}</span>
            <span>{section.name}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div css={css`
        flex: 1;
        padding: 20px;
        overflow-y: auto;

        &::-webkit-scrollbar {
          width: 4px;
        }
        
        &::-webkit-scrollbar-track {
          background: ${theme.background}44;
        }
        
        &::-webkit-scrollbar-thumb {
          background: ${theme.primary}44;
          border-radius: 2px;
        }
      `}>
        {renderSectionContent()}
      </div>
    </div>
  )
}

// Helper Components
function SettingGroup({ title, children, theme }) {
  return (
    <div css={css`
      background: ${theme.background}22;
      border-radius: 12px;
      overflow: hidden;
    `}>
          <div css={css`
        padding: 15px;
        color: ${theme.primary};
        font-family: 'Courier New', monospace;
        font-size: 14px;
        border-bottom: 1px solid ${theme.border}44;
      `}>
        {title}
      </div>
      <div>
        {children}
      </div>
    </div>
  )
}

function SettingItem({ icon, title, value, description, onClick, isEditable, theme }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (editValue && editValue.trim()) {
        onClick(editValue.trim());
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  return (
    <button
      onClick={() => isEditable && setIsEditing(true)}
      css={css`
        width: 100%;
        padding: 15px;
        background: none;
        border: none;
        border-bottom: 1px solid ${theme.border}22;
        color: ${theme.text};
        text-align: left;
        cursor: ${isEditable ? 'pointer' : 'default'};
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.2s ease;
        
        &:last-child {
          border-bottom: none;
        }
        
        &:hover {
          background: ${isEditable ? theme.primary + '11' : 'none'};
        }
      `}
    >
      <span css={css`font-size: 20px;`}>{icon}</span>
      <div css={css`flex: 1;`}>
        <div>{title}</div>
        {description && (
          <div css={css`
            font-size: 12px;
            color: ${theme.textSecondary};
            margin-top: 4px;
          `}>
            {description}
          </div>
        )}
      </div>
      {value && (
        <div css={css`
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${theme.textSecondary};
          font-size: 14px;
        `}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (editValue && editValue.trim()) {
                  onClick(editValue.trim());
                }
                setIsEditing(false);
              }}
              css={css`
                background: ${theme.background}44;
                border: 1px solid ${theme.primary};
                border-radius: 4px;
                color: ${theme.text};
                padding: 4px 8px;
                font-size: 14px;
                font-family: inherit;
                width: 200px;
                outline: none;
                
                &:focus {
                  box-shadow: 0 0 0 2px ${theme.primary}33;
                }
              `}
            />
          ) : (
            <>
              {value}
              {isEditable && (
                <span css={css`
                  color: ${theme.primary};
                  font-size: 12px;
                `}>
                  ✎
                </span>
              )}
            </>
          )}
        </div>
      )}
    </button>
  );
}

function SettingToggle({ icon, title, description, value, onChange, theme }) {
  return (
    <div
      css={css`
        padding: 15px;
        border-bottom: 1px solid ${theme.border}22;
        display: flex;
        align-items: center;
        gap: 12px;
        
        &:last-child {
          border-bottom: none;
        }
      `}
    >
      <span css={css`font-size: 20px;`}>{icon}</span>
      <div css={css`flex: 1;`}>
        <div>{title}</div>
        {description && (
          <div css={css`
            font-size: 12px;
            color: ${theme.textSecondary};
            margin-top: 4px;
          `}>
            {description}
          </div>
        )}
      </div>
                <button
        onClick={() => onChange(!value)}
                  css={css`
          width: 44px;
          height: 24px;
          background: ${value ? theme.primary : theme.border}44;
          border: 1px solid ${value ? theme.primary : theme.border};
          border-radius: 12px;
                    cursor: pointer;
          padding: 2px;
                    transition: all 0.2s ease;
                    
                    &:hover {
            filter: brightness(1.1);
          }
        `}
      >
                  <div css={css`
          width: 18px;
          height: 18px;
          background: ${value ? theme.primary : theme.textSecondary};
          border-radius: 9px;
          transform: translateX(${value ? '20px' : '0'});
          transition: all 0.2s ease;
        `}/>
      </button>
                  </div>
  )
}

function SettingSlider({ icon, title, description, value, onChange, theme }) {
  return (
    <div
                  css={css`
        padding: 15px;
        border-bottom: 1px solid ${theme.border}22;
        
        &:last-child {
          border-bottom: none;
        }
      `}
    >
      <div css={css`
                    display: flex;
                    align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      `}>
        <span css={css`font-size: 20px;`}>{icon}</span>
        <div>{title}</div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        css={css`
          width: 100%;
          height: 4px;
          background: ${theme.border};
          border-radius: 2px;
          outline: none;
          appearance: none;
          
          &::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: ${theme.primary};
            border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    
                    &:hover {
                      transform: scale(1.1);
            }
          }
        `}
      />
    </div>
  )
}

function SettingSelect({ icon, title, value, options, onChange, theme }) {
  return (
    <div
      css={css`
        padding: 15px;
        border-bottom: 1px solid ${theme.border}22;
        display: flex;
        align-items: center;
        gap: 12px;
        
        &:last-child {
          border-bottom: none;
        }
      `}
    >
      <span css={css`font-size: 20px;`}>{icon}</span>
      <div css={css`flex: 1;`}>{title}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        css={css`
          background: ${theme.background}44;
          border: 1px solid ${theme.border};
          color: ${theme.text};
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          outline: none;
          
          &:focus {
            border-color: ${theme.primary};
          }
        `}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
} 