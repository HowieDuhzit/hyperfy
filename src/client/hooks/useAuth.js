import { useState, useEffect, createContext, useContext } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { getHandleAndRegistryKey, reverseLookup, getAllDomains, NameRegistryState } from '@bonfida/spl-name-service'
import { ethers } from 'ethers'

const STORAGE_KEY = 'hyperfy_auth'
const AuthContext = createContext(null)

// Chain RPC endpoints from environment variables
const RPC_ENDPOINTS = {
  solana: {
    mainnet: process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    wsEndpoint: process.env.SOLANA_WS_ENDPOINT || 'wss://api.mainnet-beta.solana.com'
  },
  ethereum: {
    mainnet: process.env.ETHEREUM_RPC_ENDPOINT || 'https://mainnet.infura.io/v3/YOUR_INFURA_ID',
    wsEndpoint: process.env.ETHEREUM_WS_ENDPOINT || 'wss://mainnet.infura.io/ws/v3/YOUR_INFURA_ID'
  },
  polygon: {
    mainnet: process.env.POLYGON_RPC_ENDPOINT || 'https://polygon-rpc.com',
    wsEndpoint: process.env.POLYGON_WS_ENDPOINT || 'wss://polygon-rpc.com'
  },
  base: {
    mainnet: process.env.BASE_RPC_ENDPOINT || 'https://mainnet.base.org',
    wsEndpoint: process.env.BASE_WS_ENDPOINT || 'wss://mainnet.base.org'
  }
}

// Chain connections with improved configuration
const CONNECTIONS = {
  solana: null // Initialize lazily to avoid connection issues
}

// Initialize Solana connection lazily
const getSolanaConnection = () => {
  if (!CONNECTIONS.solana) {
    CONNECTIONS.solana = new Connection(RPC_ENDPOINTS.solana.mainnet, {
      commitment: 'confirmed',
      wsEndpoint: RPC_ENDPOINTS.solana.wsEndpoint,
      disableRetryOnRateLimit: false,
      confirmTransactionInitialTimeout: 60000
    })
  }
  return CONNECTIONS.solana
}

// Supported wallet types
const SUPPORTED_WALLETS = {
  PHANTOM: 'phantom',
  METAMASK: 'metamask'
}

// Check if wallet is available
const isWalletAvailable = (type) => {
  switch (type) {
    case SUPPORTED_WALLETS.PHANTOM:
      return typeof window !== 'undefined' && 
             window?.phantom?.solana && 
             window.phantom.solana.isPhantom
    case SUPPORTED_WALLETS.METAMASK:
      return typeof window !== 'undefined' && 
             typeof window.ethereum !== 'undefined'
    default:
      return false
  }
}

async function fetchSNSDomains(address) {
  try {
    const pubKey = new PublicKey(address)
    let domains = []

    // Try to get the reverse lookup first (primary domain)
    try {
      const { pubkey } = await reverseLookup(CONNECTIONS.solana, pubKey)
      const { registry } = await NameRegistryState.retrieve(CONNECTIONS.solana, pubkey)
      if (registry?.data) {
        const nameBytes = new Uint8Array(registry.data)
        const nullIndex = nameBytes.indexOf(0)
        const length = nullIndex === -1 ? nameBytes.length : nullIndex
        const decoder = new TextDecoder()
        const name = decoder.decode(nameBytes.slice(0, length))
        if (name && !name.includes('.')) {
          domains.push(name + '.sol')
        }
      }
    } catch (err) {
      console.log('No primary domain found')
    }

    // Then try to get all domains
    try {
      const domainKeys = await getAllDomains(CONNECTIONS.solana, pubKey)
      if (domainKeys && domainKeys.length > 0) {
        const domainPromises = domainKeys.map(async (key) => {
          try {
            const { registry } = await NameRegistryState.retrieve(CONNECTIONS.solana, key)
            if (registry?.data) {
              const nameBytes = new Uint8Array(registry.data)
              const nullIndex = nameBytes.indexOf(0)
              const length = nullIndex === -1 ? nameBytes.length : nullIndex
              const decoder = new TextDecoder()
              const name = decoder.decode(nameBytes.slice(0, length))
              if (name && !name.includes('.')) {
                return name + '.sol'
              }
            }
            return null
          } catch (err) {
            console.log('Failed to retrieve domain name:', err)
            return null
          }
        })

        const resolvedDomains = await Promise.all(domainPromises)
        domains.push(...resolvedDomains.filter(Boolean))
      }
    } catch (err) {
      console.log('No additional domains found')
    }

    // Remove duplicates
    const uniqueDomains = [...new Set(domains)]
    console.log('Found SNS domains:', uniqueDomains)
    return uniqueDomains

  } catch (err) {
    console.error('Failed to fetch SNS domains:', err)
    return []
  }
}

// Update auth token storage and parsing
const storeAuthToken = (data) => {
  try {
    // Validate required fields
    if (!data || !data.walletAddress || !data.walletType || !data.chainData) {
      throw new Error('Invalid auth data structure');
    }

    // Clean the data before storing
    const cleanData = {
      walletAddress: data.walletAddress,
      walletType: data.walletType,
      chainData: {
        name: data.chainData.name,
        chainId: data.chainData.chainId,
        rpcUrl: data.chainData.rpcUrl
      },
      timestamp: Date.now()
    };

    const serialized = JSON.stringify(cleanData);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.warn('Failed to store auth token:', err);
    localStorage.removeItem(STORAGE_KEY);
  }
};

const loadStoredAuth = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    // Try to parse the stored data
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (err) {
      // If it's not valid JSON, it might be an old format token
      // Remove it and return null
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Validate the parsed data structure
    if (!parsed || 
        typeof parsed !== 'object' || 
        !parsed.walletAddress || 
        !parsed.walletType || 
        !parsed.chainData ||
        !parsed.chainData.name ||
        !parsed.chainData.chainId ||
        !parsed.chainData.rpcUrl) {
      throw new Error('Invalid stored auth data structure');
    }

    // Check if the token is expired (24 hours)
    const tokenAge = Date.now() - (parsed.timestamp || 0);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      throw new Error('Auth token expired');
    }

    return parsed;
  } catch (err) {
    console.warn('Failed to load stored auth:', err);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export function useAuth() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('disconnected')
  const [domains, setDomains] = useState([])
  const [connectedChains, setConnectedChains] = useState([])
  const [activeChain, setActiveChain] = useState(null)

  // Connect wallet function
  const connectWallet = async (walletType, chainId = null) => {
    try {
      setStatus('connecting')

      let provider
      let walletAddress
      let chainData

      switch (walletType) {
        case SUPPORTED_WALLETS.PHANTOM:
          provider = window?.phantom?.solana
          if (!provider?.isPhantom) {
            throw new Error('Phantom wallet not found')
          }
          const resp = await provider.connect();
          walletAddress = resp.publicKey.toString();

          // Set up connection with proper config and retry logic
          const connection = new Connection(RPC_ENDPOINTS.solana.mainnet, {
            commitment: 'confirmed',
            disableRetryOnRateLimit: false,
            confirmTransactionInitialTimeout: 60000
          });

          // Verify connection with retries
          let isConnected = false;
          let retryCount = 0;
          const maxRetries = 3;

          while (!isConnected && retryCount < maxRetries) {
            try {
              const version = await connection.getVersion();
              console.log('Connection verified, version:', version);
              isConnected = true;
            } catch (err) {
              console.warn(`Connection attempt ${retryCount + 1} failed:`, err);
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (!isConnected) {
            throw new Error('Failed to establish connection after multiple attempts');
          }

          chainData = {
            name: 'solana',
            chainId: '1',
            rpcUrl: RPC_ENDPOINTS.solana.mainnet
          }
          break;

        case SUPPORTED_WALLETS.METAMASK:
          provider = window.ethereum
          if (!provider) {
            throw new Error('MetaMask not found')
          }

          // Request account access
          const accounts = await provider.request({ method: 'eth_requestAccounts' })
          walletAddress = accounts[0]

          // Switch to specified chain if provided
          if (chainId) {
            try {
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ethers.utils.hexValue(chainId) }],
              })
            } catch (switchError) {
              // Handle chain not added to MetaMask
              if (switchError.code === 4902) {
                const chainConfig = getChainConfig(chainId)
                if (chainConfig) {
                  await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [chainConfig],
                  })
                }
              } else {
                throw switchError
              }
            }
          }

          // Get current chain
          const currentChainId = await provider.request({ method: 'eth_chainId' })
          chainData = getChainData(parseInt(currentChainId, 16))
          break

        default:
          throw new Error('Unsupported wallet type')
      }

      // Create and store auth token
      const authToken = {
        walletAddress,
        walletType,
        chainData,
        timestamp: Date.now()
      };

      storeAuthToken(authToken);

      // Update state
      setUser({
        address: walletAddress,
        type: walletType,
        chain: chainData
      });
      setStatus('connected');
      setActiveChain(chainData.name);
      setConnectedChains(prev => [...prev, chainData.name]);

      // Fetch domains if Solana
      if (walletType === SUPPORTED_WALLETS.PHANTOM) {
        try {
          console.log('Fetching SNS domains for address:', walletAddress)
          const domains = await fetchSNSDomains(walletAddress)
          setDomains(domains)
        } catch (err) {
          console.log('No SNS domains found:', err)
          setDomains([])
        }
      }

    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setStatus('error');
      throw err;
    }
  };

  // Disconnect wallet function
  const disconnectWallet = () => {
    const provider = user?.type === SUPPORTED_WALLETS.PHANTOM 
      ? window?.phantom?.solana 
      : window.ethereum;

    if (provider) {
      if (user?.type === SUPPORTED_WALLETS.PHANTOM && provider.isPhantom) {
        provider.disconnect();
      }
    }

    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setStatus('disconnected');
    setDomains([]);
    setConnectedChains([]);
    setActiveChain(null);
  };

  // Listen for wallet connection changes
  useEffect(() => {
    function setupWalletListeners() {
      const phantomProvider = window?.phantom?.solana
      const metamaskProvider = window.ethereum

      if (phantomProvider?.isPhantom) {
        const handlePhantomDisconnect = () => {
          if (user?.type === SUPPORTED_WALLETS.PHANTOM) {
            disconnectWallet()
          }
        }
        
        phantomProvider.on('disconnect', handlePhantomDisconnect)
        phantomProvider.on('accountChanged', handlePhantomDisconnect)
        
        return () => {
          phantomProvider.off('disconnect', handlePhantomDisconnect)
          phantomProvider.off('accountChanged', handlePhantomDisconnect)
        }
      }

      if (metamaskProvider) {
        const handleMetaMaskDisconnect = () => {
          if (user?.type === SUPPORTED_WALLETS.METAMASK) {
            disconnectWallet()
          }
        }

        const handleChainChanged = (chainId) => {
          if (user?.type === SUPPORTED_WALLETS.METAMASK) {
            const chainData = getChainData(parseInt(chainId, 16))
            setUser(prev => ({
              ...prev,
              chain: chainData
            }))
            setActiveChain(chainData.name)
          }
        }

        metamaskProvider.on('disconnect', handleMetaMaskDisconnect)
        metamaskProvider.on('accountsChanged', handleMetaMaskDisconnect)
        metamaskProvider.on('chainChanged', handleChainChanged)

        return () => {
          metamaskProvider.removeListener('disconnect', handleMetaMaskDisconnect)
          metamaskProvider.removeListener('accountsChanged', handleMetaMaskDisconnect)
          metamaskProvider.removeListener('chainChanged', handleChainChanged)
        }
      }
    }

    const cleanup = setupWalletListeners()
    return () => cleanup?.()
  }, [user])

  // Check for stored auth token on mount
  useEffect(() => {
    const storedAuth = loadStoredAuth();
    if (storedAuth) {
      setUser({
        address: storedAuth.walletAddress,
        type: storedAuth.walletType,
        chain: storedAuth.chainData
      });
      setStatus('connected');
      setActiveChain(storedAuth.chainData.name);
      setConnectedChains([storedAuth.chainData.name]);
    }
  }, []);

  // Helper function to get chain configuration
  function getChainConfig(chainId) {
    switch (chainId) {
      case 1: // Ethereum Mainnet
        return {
          chainId: ethers.utils.hexValue(1),
          chainName: 'Ethereum Mainnet',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: [RPC_ENDPOINTS.ethereum.mainnet],
          blockExplorerUrls: ['https://etherscan.io']
        }
      case 137: // Polygon Mainnet
        return {
          chainId: ethers.utils.hexValue(137),
          chainName: 'Polygon Mainnet',
          nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18
          },
          rpcUrls: [RPC_ENDPOINTS.polygon.mainnet],
          blockExplorerUrls: ['https://polygonscan.com']
        }
      case 8453: // Base Mainnet
        return {
          chainId: ethers.utils.hexValue(8453),
          chainName: 'Base Mainnet',
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: [RPC_ENDPOINTS.base.mainnet],
          blockExplorerUrls: ['https://basescan.org']
        }
      default:
        return null
    }
  }

  // Helper function to get chain data
  function getChainData(chainId) {
    switch (chainId) {
      case 1:
        return {
          name: 'ethereum',
          chainId: '1',
          rpcUrl: RPC_ENDPOINTS.ethereum.mainnet
        }
      case 137:
        return {
          name: 'polygon',
          chainId: '137',
          rpcUrl: RPC_ENDPOINTS.polygon.mainnet
        }
      case 8453:
        return {
          name: 'base',
          chainId: '8453',
          rpcUrl: RPC_ENDPOINTS.base.mainnet
        }
      default:
        return {
          name: 'unknown',
          chainId: chainId.toString(),
          rpcUrl: null
        }
    }
  }

  return {
    user,
    status,
    domains,
    connectedChains,
    activeChain,
    connectWallet,
    disconnectWallet,
    setActiveChain,
    SUPPORTED_WALLETS
  }
}

export function AuthProvider({ children }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
} 