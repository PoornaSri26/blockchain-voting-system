const { Resolver } = require('did-resolver');
const { getResolver } = require('ethr-did-resolver');
const { createJWT, verifyJWT } = require('did-jwt');
const { createVerifiableCredentialJwt, createVerifiablePresentationJwt, verifyCredential } = require('did-jwt-vc');
const { EthrDID } = require('ethr-did');
const Web3 = require('web3');

class DIDManager {
    constructor(web3Provider, registryAddress, privateKey) {
        this.web3 = new Web3(web3Provider);
        this.registryAddress = registryAddress;
        this.privateKey = privateKey;
        
        // Set up DID resolver
        const providerConfig = {
            rpcUrl: web3Provider,
            registry: registryAddress
        };
        
        this.didResolver = new Resolver(getResolver(providerConfig));
        
        // Create issuer DID
        this.issuerDID = new EthrDID({
            identifier: this.web3.eth.accounts.privateKeyToAccount(privateKey).address,
            privateKey: privateKey,
            registry: registryAddress,
            rpcUrl: web3Provider
        });
    }

    /**
     * Create a new DID for a user
     */
    async createDID(userAddress, publicKey) {
        try {
            const did = new EthrDID({
                identifier: userAddress,
                registry: this.registryAddress,
                rpcUrl: this.web3.currentProvider.host
            });

            const didDocument = {
                '@context': ['https://www.w3.org/ns/did/v1'],
                id: did.did,
                verificationMethod: [{
                    id: `${did.did}#controller`,
                    type: 'EcdsaSecp256k1VerificationKey2019',
                    controller: did.did,
                    publicKeyHex: publicKey
                }],
                authentication: [`${did.did}#controller`],
                assertionMethod: [`${did.did}#controller`],
                service: [{
                    id: `${did.did}#voting-service`,
                    type: 'VotingService',
                    serviceEndpoint: process.env.VOTING_SERVICE_ENDPOINT || 'https://voting.example.com'
                }]
            };

            return {
                did: did.did,
                document: didDocument,
                address: userAddress
            };
        } catch (error) {
            throw new Error(`Failed to create DID: ${error.message}`);
        }
    }

    /**
     * Issue a Verifiable Credential for voting eligibility
     */
    async issueVotingCredential(subjectDID, voterData) {
        try {
            const credentialSubject = {
                id: subjectDID,
                votingEligibility: {
                    eligible: true,
                    jurisdiction: voterData.jurisdiction,
                    voterID: voterData.voterID,
                    registrationDate: new Date().toISOString(),
                    expirationDate: voterData.expirationDate
                },
                personalInfo: {
                    // Only include necessary hashed information for privacy
                    citizenshipHash: this.hashPersonalInfo(voterData.citizenship),
                    ageVerification: voterData.age >= 18,
                    residencyHash: this.hashPersonalInfo(voterData.residency)
                }
            };

            const vcPayload = {
                sub: subjectDID,
                iss: this.issuerDID.did,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(new Date(voterData.expirationDate).getTime() / 1000),
                vc: {
                    '@context': [
                        'https://www.w3.org/2018/credentials/v1',
                        'https://voting-credentials.example.com/v1'
                    ],
                    type: ['VerifiableCredential', 'VotingEligibilityCredential'],
                    credentialSubject: credentialSubject
                }
            };

            const vcJwt = await createVerifiableCredentialJwt(vcPayload, this.issuerDID);
            
            return {
                credential: vcJwt,
                credentialId: this.generateCredentialId(vcJwt),
                subject: subjectDID,
                issuer: this.issuerDID.did,
                issuanceDate: new Date().toISOString(),
                expirationDate: voterData.expirationDate
            };
        } catch (error) {
            throw new Error(`Failed to issue voting credential: ${error.message}`);
        }
    }

    /**
     * Verify a Verifiable Credential
     */
    async verifyCredential(credentialJwt) {
        try {
            const verificationResult = await verifyCredential(credentialJwt, this.didResolver);
            
            return {
                verified: verificationResult.verified,
                payload: verificationResult.payload,
                issuer: verificationResult.issuer,
                errors: verificationResult.errors || []
            };
        } catch (error) {
            throw new Error(`Failed to verify credential: ${error.message}`);
        }
    }

    /**
     * Create a Verifiable Presentation for voting
     */
    async createVotingPresentation(holderDID, credentials, challenge, domain) {
        try {
            const vpPayload = {
                sub: holderDID,
                iss: holderDID,
                aud: domain,
                iat: Math.floor(Date.now() / 1000),
                nonce: challenge,
                vp: {
                    '@context': ['https://www.w3.org/2018/credentials/v1'],
                    type: ['VerifiablePresentation'],
                    verifiableCredential: credentials
                }
            };

            // Note: In production, this would be signed by the holder's private key
            const vpJwt = await createVerifiablePresentationJwt(vpPayload, this.issuerDID);
            
            return vpJwt;
        } catch (error) {
            throw new Error(`Failed to create presentation: ${error.message}`);
        }
    }

    /**
     * Generate zero-knowledge proof for anonymous voting
     */
    async generateAnonymousVoteProof(voterDID, electionId, vote, secret) {
        try {
            // This is a simplified implementation
            // In production, would use proper ZK libraries like circom/snarkjs
            
            const commitment = this.web3.utils.keccak256(
                this.web3.eth.abi.encodeParameters(
                    ['string', 'uint256', 'string'],
                    [vote, secret, voterDID]
                )
            );

            const nullifier = this.web3.utils.keccak256(
                this.web3.eth.abi.encodeParameters(
                    ['string', 'uint256'],
                    [voterDID, electionId]
                )
            );

            // Simplified proof structure
            const proof = {
                commitment: commitment,
                nullifier: nullifier,
                publicSignals: [electionId, commitment],
                proof: {
                    a: [this.generateRandomField(), this.generateRandomField()],
                    b: [[this.generateRandomField(), this.generateRandomField()], [this.generateRandomField(), this.generateRandomField()]],
                    c: [this.generateRandomField(), this.generateRandomField()]
                }
            };

            return proof;
        } catch (error) {
            throw new Error(`Failed to generate ZK proof: ${error.message}`);
        }
    }

    /**
     * Resolve a DID to its document
     */
    async resolveDID(did) {
        try {
            const result = await this.didResolver.resolve(did);
            return result.didDocument;
        } catch (error) {
            throw new Error(`Failed to resolve DID: ${error.message}`);
        }
    }

    /**
     * Hash personal information for privacy
     */
    hashPersonalInfo(info) {
        return this.web3.utils.keccak256(this.web3.utils.utf8ToHex(info + process.env.HASH_SALT));
    }

    /**
     * Generate a unique credential ID
     */
    generateCredentialId(credentialJwt) {
        return this.web3.utils.keccak256(credentialJwt);
    }

    /**
     * Generate random field element for ZK proofs
     */
    generateRandomField() {
        return this.web3.utils.randomHex(32);
    }

    /**
     * Validate voter eligibility based on credentials
     */
    async validateVoterEligibility(presentation, electionRequirements) {
        try {
            // Verify the presentation
            const verificationResult = await verifyCredential(presentation, this.didResolver);
            
            if (!verificationResult.verified) {
                return { eligible: false, reason: 'Invalid presentation' };
            }

            const credentials = verificationResult.payload.vp.verifiableCredential;
            
            // Check for voting eligibility credential
            const votingCredential = credentials.find(cred => 
                cred.vc && cred.vc.type.includes('VotingEligibilityCredential')
            );

            if (!votingCredential) {
                return { eligible: false, reason: 'No voting eligibility credential found' };
            }

            // Verify credential is not expired
            const now = Math.floor(Date.now() / 1000);
            if (votingCredential.exp && votingCredential.exp < now) {
                return { eligible: false, reason: 'Voting credential expired' };
            }

            // Check jurisdiction requirements
            const credentialSubject = votingCredential.vc.credentialSubject;
            if (electionRequirements.jurisdiction && 
                credentialSubject.votingEligibility.jurisdiction !== electionRequirements.jurisdiction) {
                return { eligible: false, reason: 'Jurisdiction mismatch' };
            }

            return { 
                eligible: true, 
                voterID: credentialSubject.votingEligibility.voterID,
                jurisdiction: credentialSubject.votingEligibility.jurisdiction
            };
        } catch (error) {
            return { eligible: false, reason: `Validation error: ${error.message}` };
        }
    }

    /**
     * Revoke a credential
     */
    async revokeCredential(credentialId, reason) {
        try {
            // In production, this would interact with a revocation registry
            const revocationEntry = {
                credentialId: credentialId,
                revokedAt: new Date().toISOString(),
                reason: reason,
                revokedBy: this.issuerDID.did
            };

            // Store revocation (would be in blockchain or distributed registry)
            console.log('Credential revoked:', revocationEntry);
            
            return revocationEntry;
        } catch (error) {
            throw new Error(`Failed to revoke credential: ${error.message}`);
        }
    }
}

module.exports = DIDManager;
