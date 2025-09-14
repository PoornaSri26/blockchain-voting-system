const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const Web3 = require('web3');
const DIDManager = require('../identity/didManager');
const CredentialService = require('../identity/credentialService');
const ZKProofGenerator = require('../crypto/zkProofGenerator');
const { PaillierEncryption } = require('../crypto/homomorphicEncryption');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
let web3, didManager, credentialService, zkProofGenerator, homomorphicEncryption;
let votingSystemContract, identityRegistryContract, zkProofsContract;

async function initializeServices() {
    try {
        // Initialize Web3
        web3 = new Web3(process.env.TESTNET_RPC_URL || 'http://localhost:8545');
        
        // Initialize DID Manager
        didManager = new DIDManager(
            process.env.TESTNET_RPC_URL || 'http://localhost:8545',
            process.env.DID_REGISTRY_ADDRESS,
            process.env.MNEMONIC
        );

        // Initialize Credential Service
        credentialService = new CredentialService({
            databasePath: process.env.VERAMO_DATABASE_PATH || './veramo-db',
            secretKey: process.env.JWT_SECRET,
            rpcUrl: process.env.TESTNET_RPC_URL || 'http://localhost:8545',
            registryAddress: process.env.DID_REGISTRY_ADDRESS
        });
        await credentialService.initialize();

        // Initialize ZK Proof Generator
        zkProofGenerator = new ZKProofGenerator(
            process.env.ZK_CIRCUIT_PATH || './circuits',
            process.env.ZK_PROVING_KEY_PATH || './proving_keys',
            process.env.ZK_VERIFICATION_KEY_PATH || './verification_keys'
        );
        await zkProofGenerator.initialize();

        // Initialize Homomorphic Encryption
        homomorphicEncryption = new PaillierEncryption();
        homomorphicEncryption.generateKeys();

        console.log('All services initialized successfully');
    } catch (error) {
        console.error('Failed to initialize services:', error);
        process.exit(1);
    }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
            web3: !!web3,
            didManager: !!didManager,
            credentialService: !!credentialService,
            zkProofGenerator: !!zkProofGenerator,
            homomorphicEncryption: !!homomorphicEncryption
        }
    });
});

// Identity Management Routes

// Create DID for voter
app.post('/api/identity/create-did', async (req, res) => {
    try {
        const { userAddress, publicKey, alias } = req.body;
        
        // Create DID using Veramo
        const didResult = await credentialService.createVoterDID(alias || userAddress);
        
        res.json({
            success: true,
            did: didResult.did,
            controllerKeyId: didResult.controllerKeyId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Issue voting eligibility credential
app.post('/api/identity/issue-credential', async (req, res) => {
    try {
        const { issuerDID, subjectDID, voterData } = req.body;
        
        const credential = await credentialService.issueVotingEligibilityCredential(
            issuerDID,
            subjectDID,
            voterData
        );
        
        res.json({
            success: true,
            credential: credential
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verify credential
app.post('/api/identity/verify-credential', async (req, res) => {
    try {
        const { credential } = req.body;
        
        const result = await credentialService.verifyCredential(credential);
        
        res.json({
            success: true,
            verified: result.verified,
            error: result.error
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create verifiable presentation
app.post('/api/identity/create-presentation', async (req, res) => {
    try {
        const { holderDID, credentials, challenge, domain } = req.body;
        
        const presentation = await credentialService.createVotingPresentation(
            holderDID,
            credentials,
            challenge,
            domain
        );
        
        res.json({
            success: true,
            presentation: presentation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Zero-Knowledge Proof Routes

// Generate voting eligibility proof
app.post('/api/zk/generate-eligibility-proof', async (req, res) => {
    try {
        const { voterData, electionId } = req.body;
        
        const proof = await zkProofGenerator.generateVotingEligibilityProof(
            voterData,
            electionId
        );
        
        res.json({
            success: true,
            proof: proof
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate anonymous vote proof
app.post('/api/zk/generate-vote-proof', async (req, res) => {
    try {
        const { voteData, voterSecret, electionId } = req.body;
        
        const proof = await zkProofGenerator.generateAnonymousVoteProof(
            voteData,
            voterSecret,
            electionId
        );
        
        res.json({
            success: true,
            proof: proof
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verify ZK proof
app.post('/api/zk/verify-proof', async (req, res) => {
    try {
        const { circuitName, proof, publicSignals } = req.body;
        
        const isValid = await zkProofGenerator.verifyProof(
            circuitName,
            proof,
            publicSignals
        );
        
        res.json({
            success: true,
            valid: isValid
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Homomorphic Encryption Routes

// Get public key for encryption
app.get('/api/encryption/public-key', (req, res) => {
    try {
        const publicKey = homomorphicEncryption.exportPublicKey();
        
        res.json({
            success: true,
            publicKey: publicKey
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Encrypt vote
app.post('/api/encryption/encrypt-vote', (req, res) => {
    try {
        const { vote } = req.body;
        
        const encryptedVote = homomorphicEncryption.encrypt(vote);
        
        res.json({
            success: true,
            encryptedVote: encryptedVote
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Tally encrypted votes
app.post('/api/encryption/tally-votes', (req, res) => {
    try {
        const { encryptedVotes } = req.body;
        
        const tally = homomorphicEncryption.tallyEncryptedVotes(encryptedVotes);
        
        res.json({
            success: true,
            encryptedTally: tally
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Blockchain Interaction Routes

// Get election info
app.get('/api/election/:electionId', async (req, res) => {
    try {
        const { electionId } = req.params;
        
        // This would interact with the deployed smart contract
        // For now, return mock data
        const electionInfo = {
            id: electionId,
            name: 'Mock Election',
            description: 'A demonstration election',
            startTime: Date.now() + 86400000, // Tomorrow
            endTime: Date.now() + 172800000, // Day after tomorrow
            state: 'Setup',
            candidates: ['Alice', 'Bob', 'Charlie'],
            registeredVoters: 0,
            totalVotes: 0
        };
        
        res.json({
            success: true,
            election: electionInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Register voter for election
app.post('/api/election/:electionId/register', async (req, res) => {
    try {
        const { electionId } = req.params;
        const { voterAddress, didHash, credentialHash, merkleProof } = req.body;
        
        // This would interact with the smart contract
        // For now, return success
        res.json({
            success: true,
            message: 'Voter registered successfully',
            transactionHash: '0x' + require('crypto').randomBytes(32).toString('hex')
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Cast vote
app.post('/api/election/:electionId/vote', async (req, res) => {
    try {
        const { electionId } = req.params;
        const { commitment, zkProof } = req.body;
        
        // This would interact with the smart contract
        // For now, return success
        res.json({
            success: true,
            message: 'Vote cast successfully',
            transactionHash: '0x' + require('crypto').randomBytes(32).toString('hex')
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get election results
app.get('/api/election/:electionId/results', async (req, res) => {
    try {
        const { electionId } = req.params;
        
        // This would interact with the smart contract
        // For now, return mock results
        const results = {
            candidates: ['Alice', 'Bob', 'Charlie'],
            voteCounts: [150, 200, 100],
            totalVotes: 450,
            published: true
        };
        
        res.json({
            success: true,
            results: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/build')));

// Catch all handler for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Initialize services and start server
initializeServices().then(() => {
    app.listen(PORT, () => {
        console.log(`Blockchain Voting System server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;
