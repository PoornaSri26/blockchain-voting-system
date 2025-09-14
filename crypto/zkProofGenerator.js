const circomlib = require('circomlib');
const snarkjs = require('snarkjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ZKProofGenerator {
    constructor(circuitPath, provingKeyPath, verificationKeyPath) {
        this.circuitPath = circuitPath;
        this.provingKeyPath = provingKeyPath;
        this.verificationKeyPath = verificationKeyPath;
        this.circuits = new Map();
        this.provingKeys = new Map();
        this.verificationKeys = new Map();
    }

    /**
     * Initialize ZK circuits and keys
     */
    async initialize() {
        try {
            // Load voting eligibility circuit
            await this.loadCircuit('voting_eligibility', 'voting_eligibility.wasm', 'voting_eligibility_final.zkey');
            
            // Load anonymous vote circuit
            await this.loadCircuit('anonymous_vote', 'anonymous_vote.wasm', 'anonymous_vote_final.zkey');
            
            // Load batch verification circuit
            await this.loadCircuit('batch_verify', 'batch_verify.wasm', 'batch_verify_final.zkey');
            
            console.log('ZK Proof Generator initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize ZK Proof Generator: ${error.message}`);
        }
    }

    /**
     * Load a specific circuit and its keys
     */
    async loadCircuit(circuitName, wasmFile, zkeyFile) {
        try {
            const wasmPath = path.join(this.circuitPath, wasmFile);
            const zkeyPath = path.join(this.provingKeyPath, zkeyFile);
            
            // In production, these files would exist. For demo, we'll simulate
            if (fs.existsSync(wasmPath) && fs.existsSync(zkeyPath)) {
                this.circuits.set(circuitName, wasmPath);
                this.provingKeys.set(circuitName, zkeyPath);
            } else {
                // Create mock circuit data for demonstration
                this.circuits.set(circuitName, { mock: true, name: circuitName });
                this.provingKeys.set(circuitName, { mock: true, name: circuitName });
            }
            
            // Load verification key
            const vkeyPath = path.join(this.verificationKeyPath, `${circuitName}_verification_key.json`);
            if (fs.existsSync(vkeyPath)) {
                const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
                this.verificationKeys.set(circuitName, vkey);
            } else {
                // Mock verification key
                this.verificationKeys.set(circuitName, this.generateMockVerificationKey());
            }
        } catch (error) {
            throw new Error(`Failed to load circuit ${circuitName}: ${error.message}`);
        }
    }

    /**
     * Generate proof for voting eligibility
     */
    async generateVotingEligibilityProof(voterData, electionId) {
        try {
            const circuitInputs = {
                // Private inputs (known only to voter)
                voterSecret: this.hashToField(voterData.secret),
                voterID: this.hashToField(voterData.voterID),
                citizenship: this.hashToField(voterData.citizenship),
                age: voterData.age,
                
                // Public inputs
                electionId: electionId,
                minAge: 18,
                jurisdictionHash: this.hashToField(voterData.jurisdiction),
                
                // Nullifier to prevent double registration
                nullifier: this.generateNullifier(voterData.secret, electionId, 'registration')
            };

            const proof = await this.generateProof('voting_eligibility', circuitInputs);
            
            return {
                proof: proof.proof,
                publicSignals: proof.publicSignals,
                nullifier: circuitInputs.nullifier,
                commitment: this.generateCommitment(voterData.secret, electionId)
            };
        } catch (error) {
            throw new Error(`Failed to generate voting eligibility proof: ${error.message}`);
        }
    }

    /**
     * Generate proof for anonymous voting
     */
    async generateAnonymousVoteProof(voteData, voterSecret, electionId) {
        try {
            const circuitInputs = {
                // Private inputs
                voterSecret: this.hashToField(voterSecret),
                vote: this.encodeVote(voteData.candidate),
                nonce: this.generateRandomNonce(),
                
                // Public inputs
                electionId: electionId,
                candidateCommitment: this.hashToField(voteData.candidate),
                
                // Nullifier to prevent double voting
                nullifier: this.generateNullifier(voterSecret, electionId, 'voting'),
                
                // Merkle tree proof of voter eligibility
                merkleRoot: voteData.merkleRoot,
                merkleProof: voteData.merkleProof,
                merkleIndex: voteData.merkleIndex
            };

            const proof = await this.generateProof('anonymous_vote', circuitInputs);
            
            return {
                proof: proof.proof,
                publicSignals: proof.publicSignals,
                nullifier: circuitInputs.nullifier,
                voteCommitment: this.generateVoteCommitment(voteData.candidate, circuitInputs.nonce, voterSecret)
            };
        } catch (error) {
            throw new Error(`Failed to generate anonymous vote proof: ${error.message}`);
        }
    }

    /**
     * Generate batch verification proof for multiple votes
     */
    async generateBatchVerificationProof(votes, merkleRoot) {
        try {
            const batchSize = votes.length;
            const circuitInputs = {
                // Array of vote commitments
                voteCommitments: votes.map(vote => this.hashToField(vote.commitment)),
                
                // Array of nullifiers
                nullifiers: votes.map(vote => vote.nullifier),
                
                // Merkle root for voter eligibility
                merkleRoot: merkleRoot,
                
                // Batch size
                batchSize: batchSize
            };

            const proof = await this.generateProof('batch_verify', circuitInputs);
            
            return {
                proof: proof.proof,
                publicSignals: proof.publicSignals,
                batchSize: batchSize,
                merkleRoot: merkleRoot
            };
        } catch (error) {
            throw new Error(`Failed to generate batch verification proof: ${error.message}`);
        }
    }

    /**
     * Generate a generic ZK proof
     */
    async generateProof(circuitName, inputs) {
        try {
            const circuit = this.circuits.get(circuitName);
            const provingKey = this.provingKeys.get(circuitName);
            
            if (!circuit || !provingKey) {
                throw new Error(`Circuit or proving key not found for ${circuitName}`);
            }

            // If using mock circuits (for demonstration)
            if (circuit.mock) {
                return this.generateMockProof(inputs);
            }

            // Real snarkjs proof generation
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                inputs,
                circuit,
                provingKey
            );

            return {
                proof: this.formatProofForSolidity(proof),
                publicSignals: publicSignals
            };
        } catch (error) {
            throw new Error(`Failed to generate proof: ${error.message}`);
        }
    }

    /**
     * Verify a ZK proof
     */
    async verifyProof(circuitName, proof, publicSignals) {
        try {
            const verificationKey = this.verificationKeys.get(circuitName);
            
            if (!verificationKey) {
                throw new Error(`Verification key not found for ${circuitName}`);
            }

            // If using mock verification key
            if (verificationKey.mock) {
                return this.verifyMockProof(proof, publicSignals);
            }

            // Real snarkjs verification
            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );

            return isValid;
        } catch (error) {
            throw new Error(`Failed to verify proof: ${error.message}`);
        }
    }

    /**
     * Generate commitment for vote privacy
     */
    generateCommitment(secret, electionId) {
        return this.hashToField(`${secret}_${electionId}_commitment`);
    }

    /**
     * Generate vote commitment
     */
    generateVoteCommitment(candidate, nonce, secret) {
        return this.hashToField(`${candidate}_${nonce}_${secret}`);
    }

    /**
     * Generate nullifier to prevent double actions
     */
    generateNullifier(secret, electionId, action) {
        return this.hashToField(`${secret}_${electionId}_${action}_nullifier`);
    }

    /**
     * Hash string to field element
     */
    hashToField(input) {
        const hash = crypto.createHash('sha256').update(input.toString()).digest('hex');
        // Convert to field element (mod prime field)
        return BigInt('0x' + hash) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    }

    /**
     * Encode vote as field element
     */
    encodeVote(candidate) {
        return this.hashToField(candidate);
    }

    /**
     * Generate random nonce
     */
    generateRandomNonce() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Format proof for Solidity contract
     */
    formatProofForSolidity(proof) {
        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    /**
     * Generate mock proof for demonstration
     */
    generateMockProof(inputs) {
        const mockProof = {
            a: [this.generateRandomField(), this.generateRandomField()],
            b: [
                [this.generateRandomField(), this.generateRandomField()],
                [this.generateRandomField(), this.generateRandomField()]
            ],
            c: [this.generateRandomField(), this.generateRandomField()]
        };

        const publicSignals = Object.values(inputs).filter(input => 
            typeof input === 'number' || typeof input === 'bigint'
        );

        return { proof: mockProof, publicSignals };
    }

    /**
     * Verify mock proof
     */
    verifyMockProof(proof, publicSignals) {
        // Simple validation for mock proofs
        return proof && proof.a && proof.b && proof.c && publicSignals;
    }

    /**
     * Generate mock verification key
     */
    generateMockVerificationKey() {
        return {
            mock: true,
            alpha: [this.generateRandomField(), this.generateRandomField()],
            beta: [
                [this.generateRandomField(), this.generateRandomField()],
                [this.generateRandomField(), this.generateRandomField()]
            ],
            gamma: [
                [this.generateRandomField(), this.generateRandomField()],
                [this.generateRandomField(), this.generateRandomField()]
            ],
            delta: [
                [this.generateRandomField(), this.generateRandomField()],
                [this.generateRandomField(), this.generateRandomField()]
            ],
            ic: [
                [this.generateRandomField(), this.generateRandomField()],
                [this.generateRandomField(), this.generateRandomField()]
            ]
        };
    }

    /**
     * Generate random field element
     */
    generateRandomField() {
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create Merkle tree for voter eligibility
     */
    createVoterMerkleTree(voters) {
        const leaves = voters.map(voter => 
            this.hashToField(`${voter.address}_${voter.voterID}`)
        );

        return this.buildMerkleTree(leaves);
    }

    /**
     * Build Merkle tree from leaves
     */
    buildMerkleTree(leaves) {
        if (leaves.length === 0) return null;
        if (leaves.length === 1) return { root: leaves[0], tree: [leaves] };

        const tree = [leaves];
        let currentLevel = leaves;

        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
                const parent = this.hashToField(`${left}_${right}`);
                nextLevel.push(parent);
            }
            tree.push(nextLevel);
            currentLevel = nextLevel;
        }

        return {
            root: currentLevel[0],
            tree: tree
        };
    }

    /**
     * Generate Merkle proof for a leaf
     */
    generateMerkleProof(tree, leafIndex) {
        const proof = [];
        let currentIndex = leafIndex;

        for (let level = 0; level < tree.tree.length - 1; level++) {
            const currentLevel = tree.tree[level];
            const isRightNode = currentIndex % 2 === 1;
            const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

            if (siblingIndex < currentLevel.length) {
                proof.push({
                    hash: currentLevel[siblingIndex],
                    isRight: !isRightNode
                });
            }

            currentIndex = Math.floor(currentIndex / 2);
        }

        return proof;
    }

    /**
     * Verify Merkle proof
     */
    verifyMerkleProof(leaf, proof, root) {
        let computedHash = leaf;

        for (const proofElement of proof) {
            if (proofElement.isRight) {
                computedHash = this.hashToField(`${computedHash}_${proofElement.hash}`);
            } else {
                computedHash = this.hashToField(`${proofElement.hash}_${computedHash}`);
            }
        }

        return computedHash === root;
    }
}

module.exports = ZKProofGenerator;
