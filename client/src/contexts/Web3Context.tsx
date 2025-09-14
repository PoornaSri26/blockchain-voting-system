import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Web3 from 'web3';
import { toast } from 'react-toastify';

// Import MetaMask detect provider with type assertion
const detectEthereumProvider = require('@metamask/detect-provider') as () => Promise<any>;

interface Web3ContextType {
  web3: Web3 | null;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Web3 on component mount
  useEffect(() => {
    initializeWeb3();
    setupEventListeners();
  }, []);

  const initializeWeb3 = async () => {
    try {
      const provider = await detectEthereumProvider();
      
      if (provider) {
        const web3Instance = new Web3(provider as any);
        setWeb3(web3Instance);
        
        // Check if already connected
        const accounts = await web3Instance.eth.getAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
          
          const networkId = await web3Instance.eth.getChainId();
          setChainId(Number(networkId));
        }
      } else {
        toast.error('Please install MetaMask or another Web3 wallet');
      }
    } catch (error) {
      console.error('Failed to initialize Web3:', error);
      toast.error('Failed to initialize Web3 connection');
    }
  };

  const setupEventListeners = () => {
    if (window.ethereum) {
      // Account changed
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
        } else {
          setAccount(null);
          setIsConnected(false);
        }
      });

      // Chain changed
      window.ethereum.on('chainChanged', (chainId: string) => {
        setChainId(parseInt(chainId, 16));
        window.location.reload(); // Recommended by MetaMask
      });

      // Connection
      window.ethereum.on('connect', (connectInfo: { chainId: string }) => {
        setChainId(parseInt(connectInfo.chainId, 16));
      });

      // Disconnection
      window.ethereum.on('disconnect', () => {
        setAccount(null);
        setIsConnected(false);
        setChainId(null);
      });
    }
  };

  const connectWallet = async () => {
    if (!web3) {
      toast.error('Web3 not initialized');
      return;
    }

    setIsLoading(true);
    
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        
        const networkId = await web3.eth.getChainId();
        setChainId(Number(networkId));
        
        toast.success('Wallet connected successfully');
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      if (error.code === 4001) {
        toast.error('Please connect to MetaMask');
      } else {
        toast.error('Failed to connect wallet');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    setChainId(null);
    toast.info('Wallet disconnected');
  };

  const switchNetwork = async (targetChainId: number) => {
    if (!web3) {
      toast.error('Web3 not initialized');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Network not added to MetaMask
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [getNetworkConfig(targetChainId)],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
          toast.error('Failed to add network to wallet');
        }
      } else {
        console.error('Failed to switch network:', error);
        toast.error('Failed to switch network');
      }
    }
  };

  const getNetworkConfig = (chainId: number) => {
    const configs: { [key: number]: any } = {
      5: {
        chainId: '0x5',
        chainName: 'Goerli Test Network',
        nativeCurrency: {
          name: 'Goerli Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['https://goerli.infura.io/v3/'],
        blockExplorerUrls: ['https://goerli.etherscan.io/'],
      },
      11155111: {
        chainId: '0xaa36a7',
        chainName: 'Sepolia Test Network',
        nativeCurrency: {
          name: 'Sepolia Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        blockExplorerUrls: ['https://sepolia.etherscan.io/'],
      },
    };

    return configs[chainId];
  };

  const value: Web3ContextType = {
    web3,
    account,
    chainId,
    isConnected,
    isLoading,
    connectWallet,
    disconnectWallet,
    switchNetwork,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum: any;
  }
}
