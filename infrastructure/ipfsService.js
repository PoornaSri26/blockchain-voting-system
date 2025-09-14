const { create } = require('ipfs-http-client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class IPFSService {
    constructor(config = {}) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 5001,
            protocol: config.protocol || 'http',
            ...config
        };
        this.ipfs = null;
        this.initialized = false;
    }

    /**
     * Initialize IPFS client
     */
    async initialize() {
        try {
            this.ipfs = create({
                host: this.config.host,
                port: this.config.port,
                protocol: this.config.protocol
            });

            // Test connection
            const version = await this.ipfs.version();
            console.log(`Connected to IPFS node version: ${version.version}`);
            
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize IPFS: ${error.message}`);
        }
    }

    /**
     * Store election documents on IPFS
     */
    async storeElectionDocument(electionId, documentType, content) {
        if (!this.initialized) await this.initialize();

        try {
            const document = {
                electionId: electionId,
                documentType: documentType, // 'manifesto', 'rules', 'candidates', 'results'
                content: content,
                timestamp: Date.now(),
                hash: crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')
            };

            const result = await this.ipfs.add(JSON.stringify(document));
            
            return {
                hash: result.cid.toString(),
                path: result.path,
                size: result.size,
                documentHash: document.hash
            };
        } catch (error) {
            throw new Error(`Failed to store election document: ${error.message}`);
        }
    }

    /**
     * Store voter credentials backup (encrypted)
     */
    async storeCredentialBackup(voterAddress, encryptedCredential) {
        if (!this.initialized) await this.initialize();

        try {
            const backup = {
                voterAddress: voterAddress,
                encryptedCredential: encryptedCredential,
                timestamp: Date.now(),
                backupId: crypto.randomUUID()
            };

            const result = await this.ipfs.add(JSON.stringify(backup));
            
            return {
                hash: result.cid.toString(),
                backupId: backup.backupId
            };
        } catch (error) {
            throw new Error(`Failed to store credential backup: ${error.message}`);
        }
    }

    /**
     * Store election audit trail
     */
    async storeAuditTrail(electionId, auditData) {
        if (!this.initialized) await this.initialize();

        try {
            const auditRecord = {
                electionId: electionId,
                auditData: auditData,
                timestamp: Date.now(),
                merkleRoot: this.calculateMerkleRoot(auditData),
                signature: this.signAuditData(auditData)
            };

            const result = await this.ipfs.add(JSON.stringify(auditRecord));
            
            return {
                hash: result.cid.toString(),
                merkleRoot: auditRecord.merkleRoot,
                signature: auditRecord.signature
            };
        } catch (error) {
            throw new Error(`Failed to store audit trail: ${error.message}`);
        }
    }

    /**
     * Store ZK circuit files
     */
    async storeZKCircuit(circuitName, circuitData) {
        if (!this.initialized) await this.initialize();

        try {
            const circuit = {
                name: circuitName,
                wasm: circuitData.wasm,
                zkey: circuitData.zkey,
                verificationKey: circuitData.verificationKey,
                timestamp: Date.now(),
                version: circuitData.version || '1.0.0'
            };

            const result = await this.ipfs.add(JSON.stringify(circuit));
            
            return {
                hash: result.cid.toString(),
                circuitName: circuitName,
                version: circuit.version
            };
        } catch (error) {
            throw new Error(`Failed to store ZK circuit: ${error.message}`);
        }
    }

    /**
     * Retrieve document from IPFS
     */
    async retrieveDocument(hash) {
        if (!this.initialized) await this.initialize();

        try {
            const chunks = [];
            for await (const chunk of this.ipfs.cat(hash)) {
                chunks.push(chunk);
            }
            
            const content = Buffer.concat(chunks).toString();
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to retrieve document: ${error.message}`);
        }
    }

    /**
     * Pin important documents to ensure availability
     */
    async pinDocument(hash) {
        if (!this.initialized) await this.initialize();

        try {
            await this.ipfs.pin.add(hash);
            return { pinned: true, hash: hash };
        } catch (error) {
            throw new Error(`Failed to pin document: ${error.message}`);
        }
    }

    /**
     * Create and store election metadata
     */
    async storeElectionMetadata(electionData) {
        if (!this.initialized) await this.initialize();

        try {
            const metadata = {
                ...electionData,
                storedAt: Date.now(),
                ipfsVersion: await this.ipfs.version(),
                contentHash: crypto.createHash('sha256').update(JSON.stringify(electionData)).digest('hex')
            };

            const result = await this.ipfs.add(JSON.stringify(metadata));
            await this.pinDocument(result.cid.toString());
            
            return {
                hash: result.cid.toString(),
                contentHash: metadata.contentHash,
                pinned: true
            };
        } catch (error) {
            throw new Error(`Failed to store election metadata: ${error.message}`);
        }
    }

    /**
     * Store encrypted vote batch for backup
     */
    async storeVoteBatch(electionId, encryptedVotes, batchNumber) {
        if (!this.initialized) await this.initialize();

        try {
            const batch = {
                electionId: electionId,
                batchNumber: batchNumber,
                encryptedVotes: encryptedVotes,
                voteCount: encryptedVotes.length,
                timestamp: Date.now(),
                batchHash: crypto.createHash('sha256').update(JSON.stringify(encryptedVotes)).digest('hex')
            };

            const result = await this.ipfs.add(JSON.stringify(batch));
            
            return {
                hash: result.cid.toString(),
                batchNumber: batchNumber,
                voteCount: batch.voteCount,
                batchHash: batch.batchHash
            };
        } catch (error) {
            throw new Error(`Failed to store vote batch: ${error.message}`);
        }
    }

    /**
     * Create distributed backup of election results
     */
    async storeElectionResults(electionId, results, signatures) {
        if (!this.initialized) await this.initialize();

        try {
            const resultRecord = {
                electionId: electionId,
                results: results,
                signatures: signatures,
                timestamp: Date.now(),
                resultHash: crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex'),
                verified: this.verifyResultSignatures(results, signatures)
            };

            const result = await this.ipfs.add(JSON.stringify(resultRecord));
            await this.pinDocument(result.cid.toString());
            
            return {
                hash: result.cid.toString(),
                resultHash: resultRecord.resultHash,
                verified: resultRecord.verified,
                pinned: true
            };
        } catch (error) {
            throw new Error(`Failed to store election results: ${error.message}`);
        }
    }

    /**
     * Get IPFS node status
     */
    async getNodeStatus() {
        if (!this.initialized) await this.initialize();

        try {
            const [version, id, stats] = await Promise.all([
                this.ipfs.version(),
                this.ipfs.id(),
                this.ipfs.stats.repo()
            ]);

            return {
                version: version.version,
                nodeId: id.id,
                addresses: id.addresses,
                repoSize: stats.repoSize,
                storageMax: stats.storageMax,
                numObjects: stats.numObjects,
                connected: true
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * List all pinned documents
     */
    async listPinnedDocuments() {
        if (!this.initialized) await this.initialize();

        try {
            const pinned = [];
            for await (const pin of this.ipfs.pin.ls()) {
                pinned.push({
                    hash: pin.cid.toString(),
                    type: pin.type
                });
            }
            return pinned;
        } catch (error) {
            throw new Error(`Failed to list pinned documents: ${error.message}`);
        }
    }

    /**
     * Calculate Merkle root for audit data
     */
    calculateMerkleRoot(data) {
        // Simplified Merkle root calculation
        const leaves = Array.isArray(data) ? data : [data];
        const hashes = leaves.map(leaf => 
            crypto.createHash('sha256').update(JSON.stringify(leaf)).digest('hex')
        );
        
        while (hashes.length > 1) {
            const newHashes = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = hashes[i + 1] || left;
                const combined = crypto.createHash('sha256').update(left + right).digest('hex');
                newHashes.push(combined);
            }
            hashes.splice(0, hashes.length, ...newHashes);
        }
        
        return hashes[0];
    }

    /**
     * Sign audit data (simplified)
     */
    signAuditData(data) {
        // In production, this would use proper cryptographic signing
        const dataString = JSON.stringify(data);
        return crypto.createHash('sha256').update(dataString + 'audit_signature_salt').digest('hex');
    }

    /**
     * Verify result signatures (simplified)
     */
    verifyResultSignatures(results, signatures) {
        // In production, this would verify actual cryptographic signatures
        return signatures && signatures.length > 0;
    }

    /**
     * Create content-addressed storage for large files
     */
    async storeFile(filePath, metadata = {}) {
        if (!this.initialized) await this.initialize();

        try {
            const fileContent = fs.readFileSync(filePath);
            const fileMetadata = {
                filename: path.basename(filePath),
                size: fileContent.length,
                mimeType: this.getMimeType(filePath),
                uploadedAt: Date.now(),
                ...metadata
            };

            // Store file content
            const fileResult = await this.ipfs.add(fileContent);
            
            // Store metadata
            const metadataResult = await this.ipfs.add(JSON.stringify(fileMetadata));

            return {
                fileHash: fileResult.cid.toString(),
                metadataHash: metadataResult.cid.toString(),
                filename: fileMetadata.filename,
                size: fileMetadata.size
            };
        } catch (error) {
            throw new Error(`Failed to store file: ${error.message}`);
        }
    }

    /**
     * Get MIME type for file
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.json': 'application/json',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

module.exports = IPFSService;
