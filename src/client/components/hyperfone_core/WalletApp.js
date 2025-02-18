import { css } from '@firebolt-dev/css'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuthContext } from '../../components/AuthProvider'
import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  clusterApiUrl
} from '@solana/web3.js'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { hyperFoneOS } from '../hyperfoneOS'
import { resolve, getAllDomains } from '@bonfida/spl-name-service'

// Browser-safe environment configuration
const getEnvConfig = () => {
  // Default values
  const defaults = {
    QUICKNODE_ENDPOINT: 'https://soft-morning-lake.solana-mainnet.quiknode.pro/24bf45ad826c76cc7c7397e3ba580b9cd0159447/',
    QUICKNODE_WS_ENDPOINT: 'wss://soft-morning-lake.solana-mainnet.quiknode.pro/24bf45ad826c76cc7c7397e3ba580b9cd0159447/',
    DEFAULT_NETWORK: 'mainnet-beta',
    IS_DEVELOPMENT: false
  };

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return defaults;
  }

  // Get environment variables from window.__ENV__ if available
  const windowEnv = window.__ENV__ || {};

  return {
    ...defaults,
    ...windowEnv,
    IS_DEVELOPMENT: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  };
};

const ENV_CONFIG = getEnvConfig();

// Network configuration based on environment
const NETWORK_CONFIG = {
  'mainnet-beta': {
    name: 'Mainnet',
    endpoint: ENV_CONFIG.QUICKNODE_ENDPOINT,
    wsEndpoint: ENV_CONFIG.QUICKNODE_WS_ENDPOINT
  },
  'testnet': {
    name: 'Testnet',
    endpoint: 'https://api.testnet.solana.com',
    wsEndpoint: 'wss://api.testnet.solana.com'
  },
  'devnet': {
    name: 'Devnet',
    endpoint: 'https://api.devnet.solana.com',
    wsEndpoint: 'wss://api.devnet.solana.com'
  }
};

// Component definition
export function WalletApp() {
  // State declarations
  const [activeTab, setActiveTab] = useState('tokens');
  const [selectedNetwork, setSelectedNetwork] = useState('mainnet-beta');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [balance, setBalance] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [nfts, setNfts] = useState([]);
  const [prices, setPrices] = useState({});
  const [solDomain, setSolDomain] = useState(null);
  const [sendForm, setSendForm] = useState({
    token: null,
    address: '',
    amount: ''
  });

  const { user, disconnectWallet, connectWallet, SUPPORTED_WALLETS } = useAuthContext();

  // Helper functions
  const getConnection = useCallback((network = ENV_CONFIG.DEFAULT_NETWORK) => {
    const config = NETWORK_CONFIG[network];
    if (!config) {
      throw new Error(`Invalid network: ${network}`);
    }
    return new Connection(config.endpoint, {
      commitment: 'confirmed',
      wsEndpoint: config.wsEndpoint,
      confirmTransactionInitialTimeout: 60000
    });
  }, []);

  // Fetch account data (SOL balance, tokens, NFTs)
  const fetchAccountData = useCallback(async () => {
    if (!user?.publicKey) return;
    
    try {
      setIsLoading(true);
      const connection = getConnection(selectedNetwork);
      const publicKey = new PublicKey(user.publicKey);

      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      setBalance(solBalance / LAMPORTS_PER_SOL);

      // Fetch tokens and NFTs using QuickNode API
      const response = await connection.rpcRequest('qn_fetchTokens', [
        publicKey.toString(),
        {
          page: 1,
          perPage: 1000,
          includeZeroBalance: true
        }
      ]);

      if (response.result) {
        const tokens = [];
        const nftMints = [];

        // Process tokens and identify NFTs
        for (const token of response.result.tokens) {
          const decimals = token.tokenInfo?.decimals || 0;
          const balance = token.balance || 0;

          // NFTs have 0 decimals and balance of 1
          if (decimals === 0 && balance === 1) {
            nftMints.push(token.mint);
          } else {
            tokens.push({
              mint: token.mint,
              symbol: token.tokenInfo?.symbol || 'Unknown',
              name: token.tokenInfo?.name || 'Unknown Token',
              balance: balance / Math.pow(10, decimals),
              decimals,
              image: token.tokenInfo?.image || null,
              verified: token.tokenInfo?.verified || false,
              coingeckoId: token.tokenInfo?.coingeckoId || null
            });
          }
        }

        // Sort tokens by balance
        tokens.sort((a, b) => b.balance - a.balance);
        setTokens(tokens);

        // Fetch NFT metadata
        if (nftMints.length > 0) {
          const nftResponse = await connection.rpcRequest('qn_fetchNFTs', [
            publicKey.toString(),
            {
              page: 1,
              perPage: 1000,
              mintAccounts: nftMints
            }
          ]);

          if (nftResponse.result?.assets) {
            const nfts = nftResponse.result.assets.map(nft => ({
              mint: nft.mint,
              name: nft.name || 'Unnamed NFT',
              collection: nft.collectionName || 'Unknown Collection',
              image: nft.image || null,
              attributes: nft.attributes || [],
              description: nft.description || '',
              tokenStandard: nft.tokenStandard || '',
              royalty: nft.royalty || 0,
              creators: nft.creators || []
            }));

            // Sort NFTs by collection and name
            nfts.sort((a, b) => {
              if (a.collection === b.collection) {
                return a.name.localeCompare(b.name);
              }
              return a.collection.localeCompare(b.collection);
            });

            setNfts(nfts);
          }
        }
      }

      // Fetch .sol domain
      try {
        const domains = await getAllDomains(connection, publicKey);
        if (domains && domains.length > 0) {
          // Sort by length to get the shortest domain
          domains.sort((a, b) => a.length - b.length);
          const primaryDomain = domains[0];
          if (!primaryDomain.endsWith('.sol')) {
            setSolDomain(primaryDomain + '.sol');
          } else {
            setSolDomain(primaryDomain);
          }
        }
      } catch (err) {
        console.error('Error fetching .sol domain:', err);
      }

    } catch (err) {
      console.error('Error fetching account data:', err);
      setConnectionError('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.publicKey, selectedNetwork, getConnection]);

  // Fetch token prices
  const fetchTokenPrices = useCallback(async () => {
    try {
      const coingeckoIds = tokens
        .filter(token => token.coingeckoId)
        .map(token => token.coingeckoId);

      if (coingeckoIds.length > 0) {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd`
        );
        const data = await response.json();
        setPrices(data);
      }
    } catch (err) {
      console.error('Error fetching token prices:', err);
    }
  }, [tokens]);

  // Effect to fetch data when wallet is connected or network changes
  useEffect(() => {
    if (user?.publicKey) {
      fetchAccountData();
    }
  }, [user?.publicKey, selectedNetwork, fetchAccountData]);

  // Effect to fetch token prices when token list changes
  useEffect(() => {
    if (tokens.length > 0) {
      fetchTokenPrices();
    }
  }, [tokens, fetchTokenPrices]);

  const handleNetworkSelect = useCallback(async () => {
    try {
      setIsLoading(true);
      setConnectionError('');
      await connectWallet(SUPPORTED_WALLETS.PHANTOM);
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setConnectionError(err.message || 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  }, [connectWallet]);

  // Render
  if (user?.type !== SUPPORTED_WALLETS.PHANTOM) {
    return (
      <div css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 20px;
        padding: 20px;
        background: rgba(0, 0, 0, 0.2);
      `}>
        <h2>Connect Your Wallet</h2>
        {connectionError && (
          <div css={css`color: #ff4444;`}>{connectionError}</div>
        )}
        <button 
          onClick={handleNetworkSelect}
          disabled={isLoading}
          css={css`
            background: #551bf9;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            opacity: ${isLoading ? 0.7 : 1};
            transition: all 0.2s ease;
            
            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(85, 27, 249, 0.2);
            }
          `}
        >
          {isLoading ? 'Connecting...' : 'Connect Phantom Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div css={css`
      padding: 20px;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `}>
      {/* Header */}
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      `}>
        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 8px;
        `}>
          <div css={css`
            display: flex;
            align-items: center;
            gap: 12px;
          `}>
            <h2 css={css`margin: 0;`}>Wallet</h2>
            {solDomain && (
              <div css={css`
                font-size: 14px;
                color: #551bf9;
              `}>
                {solDomain}
              </div>
            )}
          </div>
          <div css={css`
            font-size: 24px;
            font-weight: 500;
          `}>
            {balance.toFixed(4)} SOL
          </div>
        </div>
        <button
          onClick={disconnectWallet}
          css={css`
            background: rgba(255, 68, 68, 0.1);
            color: #ff4444;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              background: rgba(255, 68, 68, 0.2);
            }
          `}
        >
          Disconnect
        </button>
      </div>

      {/* Tabs */}
      <div css={css`
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
      `}>
        <button
          onClick={() => setActiveTab('tokens')}
          css={css`
            background: ${activeTab === 'tokens' ? '#551bf9' : 'rgba(85, 27, 249, 0.1)'};
            color: ${activeTab === 'tokens' ? 'white' : '#551bf9'};
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              background: ${activeTab === 'tokens' ? '#551bf9' : 'rgba(85, 27, 249, 0.2)'};
            }
          `}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab('nfts')}
          css={css`
            background: ${activeTab === 'nfts' ? '#551bf9' : 'rgba(85, 27, 249, 0.1)'};
            color: ${activeTab === 'nfts' ? 'white' : '#551bf9'};
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              background: ${activeTab === 'nfts' ? '#551bf9' : 'rgba(85, 27, 249, 0.2)'};
            }
          `}
        >
          NFTs
        </button>
      </div>

      {/* Content */}
      <div css={css`
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 12px;
      `}>
        {isLoading ? (
          <div css={css`
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
          `}>
            Loading...
          </div>
        ) : activeTab === 'tokens' ? (
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
          `}>
            {tokens.map(token => (
              <div key={token.mint} css={css`
                background: rgba(0, 0, 0, 0.2);
                padding: 16px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                
                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }
              `}>
                <div css={css`
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                `}>
                  {token.image && (
                    <img 
                      src={token.image} 
                      alt={token.symbol}
                      css={css`
                        width: 24px;
                        height: 24px;
                        border-radius: 12px;
                      `}
                    />
                  )}
                  <div css={css`font-weight: 500;`}>{token.symbol}</div>
                </div>
                <div css={css`
                  font-size: 14px;
                  color: rgba(255, 255, 255, 0.7);
                `}>
                  Balance: {token.balance.toFixed(4)}
                </div>
                {prices[token.coingeckoId] && (
                  <div css={css`
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.5);
                    margin-top: 4px;
                  `}>
                    ${(token.balance * prices[token.coingeckoId].usd).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div css={css`
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
          `}>
            {nfts.map(nft => (
              <div 
                key={nft.mint}
                onClick={() => setSelectedNFT(nft)}
                css={css`
                  background: rgba(0, 0, 0, 0.2);
                  padding: 12px;
                  border-radius: 8px;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  
                  &:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                  }
                `}
              >
                <img 
                  src={nft.image} 
                  alt={nft.name}
                  css={css`
                    width: 100%;
                    aspect-ratio: 1;
                    object-fit: cover;
                    border-radius: 4px;
                    margin-bottom: 8px;
                  `}
                />
                <div css={css`font-weight: 500;`}>{nft.name}</div>
                <div css={css`
                  font-size: 14px;
                  color: rgba(255, 255, 255, 0.7);
                `}>
                  {nft.collection}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div css={css`
        display: flex;
        gap: 12px;
        margin-top: 20px;
      `}>
        <button
          onClick={() => setShowSendModal(true)}
          css={css`
            flex: 1;
            background: #551bf9;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(85, 27, 249, 0.2);
            }
          `}
        >
          Send
        </button>
        <button
          onClick={() => setShowReceiveModal(true)}
          css={css`
            flex: 1;
            background: rgba(85, 27, 249, 0.1);
            color: #551bf9;
            border: none;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              background: rgba(85, 27, 249, 0.2);
            }
          `}
        >
          Receive
        </button>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div css={css`
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        `}>
          <div css={css`
            background: #1a1b23;
            border-radius: 12px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
          `}>
            <h3 css={css`margin: 0 0 20px 0;`}>Send {activeTab === 'nfts' ? 'NFT' : 'Token'}</h3>
            
            {activeTab === 'tokens' && (
              <div css={css`
                margin-bottom: 16px;
              `}>
                <label css={css`
                  display: block;
                  margin-bottom: 8px;
                  font-size: 14px;
                  color: rgba(255, 255, 255, 0.7);
                `}>
                  Select Token
                </label>
                <select
                  value={sendForm.token?.mint || ''}
                  onChange={(e) => {
                    const token = tokens.find(t => t.mint === e.target.value);
                    setSendForm(prev => ({ ...prev, token }));
                  }}
                  css={css`
                    width: 100%;
                    padding: 8px;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: white;
                    margin-bottom: 16px;
                  `}
                >
                  <option value="">Select a token</option>
                  {tokens.map(token => (
                    <option key={token.mint} value={token.mint}>
                      {token.symbol} ({token.balance.toFixed(4)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'nfts' && selectedNFT && (
              <div css={css`
                margin-bottom: 16px;
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 8px;
              `}>
                <img 
                  src={selectedNFT.image} 
                  alt={selectedNFT.name}
                  css={css`
                    width: 100%;
                    height: 200px;
                    object-fit: contain;
                    border-radius: 4px;
                    margin-bottom: 8px;
                  `}
                />
                <div css={css`font-weight: 500;`}>{selectedNFT.name}</div>
                <div css={css`
                  font-size: 14px;
                  color: rgba(255, 255, 255, 0.7);
                `}>
                  {selectedNFT.collection}
                </div>
              </div>
            )}

            <div css={css`margin-bottom: 16px;`}>
              <label css={css`
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
              `}>
                Recipient Address
              </label>
              <input
                type="text"
                value={sendForm.address}
                onChange={(e) => setSendForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter Solana address or .sol domain"
                css={css`
                  width: 100%;
                  padding: 8px;
                  background: rgba(0, 0, 0, 0.2);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 6px;
                  color: white;
                `}
              />
            </div>

            {activeTab === 'tokens' && (
              <div css={css`margin-bottom: 24px;`}>
                <label css={css`
                  display: block;
                  margin-bottom: 8px;
                  font-size: 14px;
                  color: rgba(255, 255, 255, 0.7);
                `}>
                  Amount
                </label>
                <input
                  type="number"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount"
                  css={css`
                    width: 100%;
                    padding: 8px;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: white;
                  `}
                />
              </div>
            )}

            <div css={css`
              display: flex;
              gap: 12px;
            `}>
              <button
                onClick={() => setShowSendModal(false)}
                css={css`
                  flex: 1;
                  padding: 12px;
                  background: rgba(255, 255, 255, 0.1);
                  border: none;
                  border-radius: 6px;
                  color: white;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  
                  &:hover {
                    background: rgba(255, 255, 255, 0.2);
                  }
                `}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!isValidSendForm()}
                css={css`
                  flex: 1;
                  padding: 12px;
                  background: #551bf9;
                  border: none;
                  border-radius: 6px;
                  color: white;
                  cursor: pointer;
                  opacity: ${!isValidSendForm() ? 0.5 : 1};
                  transition: all 0.2s ease;
                  
                  &:hover {
                    transform: ${isValidSendForm() ? 'translateY(-2px)' : 'none'};
                    box-shadow: ${isValidSendForm() ? '0 4px 12px rgba(85, 27, 249, 0.2)' : 'none'};
                  }
                `}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div css={css`
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        `}>
          <div css={css`
            background: #1a1b23;
            border-radius: 12px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            text-align: center;
          `}>
            <h3 css={css`margin: 0 0 20px 0;`}>Receive</h3>
            
            <div css={css`
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              display: inline-block;
            `}>
              <QRCode
                value={user.publicKey}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div css={css`
              background: rgba(0, 0, 0, 0.2);
              padding: 12px;
              border-radius: 6px;
              font-family: monospace;
              word-break: break-all;
              margin-bottom: 20px;
              font-size: 14px;
            `}>
              {user.publicKey}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(user.publicKey);
                // TODO: Show copy confirmation
              }}
              css={css`
                width: 100%;
                padding: 12px;
                background: rgba(85, 27, 249, 0.1);
                border: none;
                border-radius: 6px;
                color: #551bf9;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-bottom: 12px;
                
                &:hover {
                  background: rgba(85, 27, 249, 0.2);
                }
              `}
            >
              Copy Address
            </button>

            <button
              onClick={() => setShowReceiveModal(false)}
              css={css`
                width: 100%;
                padding: 12px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
                
                &:hover {
                  background: rgba(255, 255, 255, 0.2);
                }
              `}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
const isValidSendForm = () => {
  if (activeTab === 'tokens') {
    return sendForm.token && 
           sendForm.address && 
           sendForm.amount && 
           Number(sendForm.amount) > 0 && 
           Number(sendForm.amount) <= sendForm.token.balance;
  } else {
    return selectedNFT && sendForm.address;
  }
};

const handleSend = async () => {
  try {
    setIsLoading(true);
    const connection = getConnection(selectedNetwork);
    const fromPubkey = new PublicKey(user.publicKey);
    let toPubkey;

    // Resolve .sol domain if address ends with .sol
    if (sendForm.address.endsWith('.sol')) {
      try {
        const resolvedAddress = await resolve(connection, sendForm.address);
        if (!resolvedAddress) {
          throw new Error('Could not resolve .sol domain');
        }
        toPubkey = new PublicKey(resolvedAddress);
      } catch (err) {
        throw new Error('Invalid .sol domain');
      }
    } else {
      try {
        toPubkey = new PublicKey(sendForm.address);
      } catch (err) {
        throw new Error('Invalid recipient address');
      }
    }

    // Create and send transaction
    if (activeTab === 'tokens') {
      // TODO: Implement token transfer
      throw new Error('Token transfers not yet implemented');
    } else {
      // TODO: Implement NFT transfer
      throw new Error('NFT transfers not yet implemented');
    }

    setShowSendModal(false);
    // TODO: Show success message
  } catch (err) {
    console.error('Send failed:', err);
    setConnectionError(err.message);
  } finally {
    setIsLoading(false);
  }
}; 