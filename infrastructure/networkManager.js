const Web3 = require('web3');
const { EventEmitter } = require('events');

class NetworkManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            networks: {
                development: {
                    rpcUrl: 'http://localhost:8545',
                    chainId: 1337,
                    name: 'Development'
                },
                goerli: {
                    rpcUrl: process.env.GOERLI_RPC_URL || 'https://goerli.infura.io/v3/your-project-id',
                    chainId: 5,
                    name: 'Goerli Testnet'
                },
                sepolia: {
                    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/your-project-id',
                    chainId: 11155111,
                    name: 'Sepolia Testnet'
                },
                mainnet: {
                    rpcUrl: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/your-project-id',
                    chainId: 1,
                    name: 'Ethereum Mainnet'
                }
            },
            ...config
        };
        
        this.connections = new Map();
        this.activeNetwork = null;
        this.healthCheckInterval = null;
    }

    /**
     * Initialize network connections
     */
    async initialize(networkName = 'development') {
        try {
            await this.connectToNetwork(networkName);
            this.startHealthChecks();
            console.log(`Network Manager initialized on ${networkName}`);
        } catch (error) {
            throw new Error(`Failed to initialize Network Manager: ${error.message}`);
        }
    }

    /**
     * Connect to a specific network
     */
    async connectToNetwork(networkName) {
        const networkConfig = this.config.networks[networkName];
        if (!networkConfig) {
            throw new Error(`Unknown network: ${networkName}`);
        }

        try {
            const web3 = new Web3(networkConfig.rpcUrl);
            
            // Test connection
            const chainId = await web3.eth.getChainId();
            if (Number(chainId) !== networkConfig.chainId) {
                throw new Error(`Chain ID mismatch. Expected ${networkConfig.chainId}, got ${chainId}`);
            }

            this.connections.set(networkName, {
                web3: web3,
                config: networkConfig,
                connected: true,
                lastHealthCheck: Date.now()
            });

            this.activeNetwork = networkName;
            this.emit('networkConnected', { network: networkName, chainId: chainId });
            
            return web3;
        } catch (error) {
            throw new Error(`Failed to connect to ${networkName}: ${error.message}`);
        }
    }

    /**
     * Get Web3 instance for active network
     */
    getWeb3(networkName = null) {
        const network = networkName || this.activeNetwork;
        const connection = this.connections.get(network);
        
        if (!connection || !connection.connected) {
            throw new Error(`No active connection to ${network}`);
        }
        
        return connection.web3;
    }

    /**
     * Switch to different network
     */
    async switchNetwork(networkName) {
        try {
            await this.connectToNetwork(networkName);
            this.emit('networkSwitched', { 
                from: this.activeNetwork, 
                to: networkName 
            });
        } catch (error) {
            throw new Error(`Failed to switch to ${networkName}: ${error.message}`);
        }
    }

    /**
     * Deploy contracts to multiple networks
     */
    async deployToMultipleNetworks(contractData, networks) {
        const deploymentResults = {};
        
        for (const networkName of networks) {
            try {
                const web3 = await this.connectToNetwork(networkName);
                const result = await this.deployContract(web3, contractData, networkName);
                deploymentResults[networkName] = result;
                
                this.emit('contractDeployed', {
                    network: networkName,
                    address: result.address,
                    transactionHash: result.transactionHash
                });
            } catch (error) {
                deploymentResults[networkName] = { error: error.message };
                this.emit('deploymentError', {
                    network: networkName,
                    error: error.message
                });
            }
        }
        
        return deploymentResults;
    }

    /**
     * Deploy contract to specific network
     */
    async deployContract(web3, contractData, networkName) {
        try {
            const accounts = await web3.eth.getAccounts();
            const deployAccount = accounts[0];
            
            if (!deployAccount) {
                throw new Error('No accounts available for deployment');
            }

            const contract = new web3.eth.Contract(contractData.abi);
            const gasEstimate = await contract.deploy({
                data: contractData.bytecode,
                arguments: contractData.constructorArgs || []
            }).estimateGas({ from: deployAccount });

            const deployedContract = await contract.deploy({
                data: contractData.bytecode,
                arguments: contractData.constructorArgs || []
            }).send({
                from: deployAccount,
                gas: Math.floor(gasEstimate * 1.2), // Add 20% buffer
                gasPrice: await web3.eth.getGasPrice()
            });

            return {
                address: deployedContract.options.address,
                transactionHash: deployedContract.transactionHash,
                network: networkName,
                deployedBy: deployAccount,
                gasUsed: gasEstimate
            };
        } catch (error) {
            throw new Error(`Contract deployment failed: ${error.message}`);
        }
    }

    /**
     * Monitor network health
     */
    startHealthChecks(interval = 30000) {
        this.healthCheckInterval = setInterval(async () => {
            for (const [networkName, connection] of this.connections) {
                try {
                    const latestBlock = await connection.web3.eth.getBlockNumber();
                    connection.lastHealthCheck = Date.now();
                    connection.latestBlock = latestBlock;
                    connection.connected = true;
                    
                    this.emit('healthCheck', {
                        network: networkName,
                        status: 'healthy',
                        latestBlock: latestBlock
                    });
                } catch (error) {
                    connection.connected = false;
                    this.emit('healthCheck', {
                        network: networkName,
                        status: 'unhealthy',
                        error: error.message
                    });
                }
            }
        }, interval);
    }

    /**
     * Stop health checks
     */
    stopHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Get network status
     */
    async getNetworkStatus(networkName = null) {
        const network = networkName || this.activeNetwork;
        const connection = this.connections.get(network);
        
        if (!connection) {
            return { connected: false, error: 'Network not initialized' };
        }

        try {
            const web3 = connection.web3;
            const [chainId, latestBlock, gasPrice, peerCount] = await Promise.all([
                web3.eth.getChainId(),
                web3.eth.getBlockNumber(),
                web3.eth.getGasPrice(),
                web3.eth.net.getPeerCount().catch(() => 0)
            ]);

            return {
                network: network,
                connected: connection.connected,
                chainId: Number(chainId),
                latestBlock: Number(latestBlock),
                gasPrice: gasPrice,
                peerCount: Number(peerCount),
                lastHealthCheck: connection.lastHealthCheck,
                rpcUrl: connection.config.rpcUrl
            };
        } catch (error) {
            return {
                network: network,
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Load balance across multiple RPC endpoints
     */
    async setupLoadBalancing(networkName, rpcUrls) {
        const networkConfig = this.config.networks[networkName];
        if (!networkConfig) {
            throw new Error(`Unknown network: ${networkName}`);
        }

        const connections = [];
        for (const rpcUrl of rpcUrls) {
            try {
                const web3 = new Web3(rpcUrl);
                const chainId = await web3.eth.getChainId();
                
                if (Number(chainId) === networkConfig.chainId) {
                    connections.push({
                        web3: web3,
                        rpcUrl: rpcUrl,
                        healthy: true,
                        responseTime: 0
                    });
                }
            } catch (error) {
                console.warn(`Failed to connect to ${rpcUrl}: ${error.message}`);
            }
        }

        if (connections.length === 0) {
            throw new Error('No healthy RPC endpoints available');
        }

        // Store load-balanced connections
        this.connections.set(`${networkName}_lb`, {
            connections: connections,
            currentIndex: 0,
            config: networkConfig,
            loadBalanced: true
        });

        return connections.length;
    }

    /**
     * Get load-balanced Web3 instance
     */
    getLoadBalancedWeb3(networkName) {
        const lbConnection = this.connections.get(`${networkName}_lb`);
        if (!lbConnection || !lbConnection.loadBalanced) {
            throw new Error(`No load-balanced connection for ${networkName}`);
        }

        // Round-robin selection
        const connection = lbConnection.connections[lbConnection.currentIndex];
        lbConnection.currentIndex = (lbConnection.currentIndex + 1) % lbConnection.connections.length;
        
        return connection.web3;
    }

    /**
     * Monitor transaction confirmations across networks
     */
    async monitorTransaction(txHash, networkName, requiredConfirmations = 12) {
        const web3 = this.getWeb3(networkName);
        
        return new Promise((resolve, reject) => {
            const checkConfirmations = async () => {
                try {
                    const receipt = await web3.eth.getTransactionReceipt(txHash);
                    if (!receipt) {
                        setTimeout(checkConfirmations, 5000);
                        return;
                    }

                    const currentBlock = await web3.eth.getBlockNumber();
                    const confirmations = currentBlock - receipt.blockNumber;

                    this.emit('transactionUpdate', {
                        txHash: txHash,
                        confirmations: confirmations,
                        required: requiredConfirmations,
                        network: networkName
                    });

                    if (confirmations >= requiredConfirmations) {
                        resolve({
                            txHash: txHash,
                            confirmations: confirmations,
                            receipt: receipt,
                            network: networkName
                        });
                    } else {
                        setTimeout(checkConfirmations, 5000);
                    }
                } catch (error) {
                    reject(error);
                }
            };

            checkConfirmations();
        });
    }

    /**
     * Estimate gas across multiple networks
     */
    async estimateGasMultiNetwork(contractCall, networks) {
        const estimates = {};
        
        for (const networkName of networks) {
            try {
                const web3 = this.getWeb3(networkName);
                const gasEstimate = await contractCall.estimateGas();
                const gasPrice = await web3.eth.getGasPrice();
                
                estimates[networkName] = {
                    gasEstimate: gasEstimate,
                    gasPrice: gasPrice,
                    estimatedCost: (BigInt(gasEstimate) * BigInt(gasPrice)).toString(),
                    network: networkName
                };
            } catch (error) {
                estimates[networkName] = {
                    error: error.message,
                    network: networkName
                };
            }
        }
        
        return estimates;
    }

    /**
     * Cleanup connections
     */
    async cleanup() {
        this.stopHealthChecks();
        
        for (const [networkName, connection] of this.connections) {
            if (connection.web3 && connection.web3.currentProvider) {
                try {
                    if (connection.web3.currentProvider.disconnect) {
                        connection.web3.currentProvider.disconnect();
                    }
                } catch (error) {
                    console.warn(`Error disconnecting from ${networkName}: ${error.message}`);
                }
            }
        }
        
        this.connections.clear();
        this.activeNetwork = null;
        this.emit('cleanup');
    }

    /**
     * Get all network statuses
     */
    async getAllNetworkStatuses() {
        const statuses = {};
        
        for (const networkName of Object.keys(this.config.networks)) {
            if (this.connections.has(networkName)) {
                statuses[networkName] = await this.getNetworkStatus(networkName);
            } else {
                statuses[networkName] = { connected: false, error: 'Not initialized' };
            }
        }
        
        return statuses;
    }
}

module.exports = NetworkManager;
