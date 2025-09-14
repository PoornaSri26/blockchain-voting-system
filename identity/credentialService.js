const { Agent, createAgent, IDIDManager, IKeyManager, IDataStore, ICredentialPlugin } = require('@veramo/core');
const { KeyManager } = require('@veramo/key-manager');
const { DIDManager } = require('@veramo/did-manager');
const { EthrDIDProvider } = require('@veramo/did-provider-ethr');
const { DIDResolverPlugin } = require('@veramo/did-resolver');
const { getResolver: ethrDidResolver } = require('ethr-did-resolver');
const { CredentialPlugin } = require('@veramo/credential-w3c');
const { DataStore, DataStoreORM } = require('@veramo/data-store');
const { KeyManagementSystem, SecretBox } = require('@veramo/kms-local');
const { createConnection } = require('typeorm');

class CredentialService {
    constructor(config) {
        this.config = config;
        this.agent = null;
        this.initialized = false;
    }

    /**
     * Initialize the Veramo agent with all necessary plugins
     */
    async initialize() {
        try {
            // Create database connection
            const dbConnection = await createConnection({
                type: 'sqlite',
                database: this.config.databasePath || './veramo-db/database.sqlite',
                synchronize: true,
                logging: false,
                entities: require('@veramo/data-store').Entities,
            });

            // Create the agent
            this.agent = createAgent({
                plugins: [
                    new KeyManager({
                        store: new DataStore(dbConnection),
                        kms: {
                            local: new KeyManagementSystem(
                                new SecretBox(this.config.secretKey || 'your-secret-key-here')
                            ),
                        },
                    }),
                    new DIDManager({
                        store: new DataStore(dbConnection),
                        defaultProvider: 'did:ethr:goerli',
                        providers: {
                            'did:ethr:goerli': new EthrDIDProvider({
                                defaultKms: 'local',
                                network: 'goerli',
                                rpcUrl: this.config.rpcUrl || 'https://goerli.infura.io/v3/your-project-id',
                                registry: this.config.registryAddress,
                            }),
                        },
                    }),
                    new DIDResolverPlugin({
                        resolver: ethrDidResolver({
                            networks: [
                                {
                                    name: 'goerli',
                                    rpcUrl: this.config.rpcUrl || 'https://goerli.infura.io/v3/your-project-id',
                                    registry: this.config.registryAddress,
                                },
                            ],
                        }),
                    }),
                    new CredentialPlugin(),
                    new DataStoreORM(dbConnection),
                ],
            });

            this.initialized = true;
            console.log('Credential Service initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize credential service: ${error.message}`);
        }
    }

    /**
     * Create a new DID for a voter
     */
    async createVoterDID(alias) {
        if (!this.initialized) await this.initialize();

        try {
            const identifier = await this.agent.didManagerCreate({
                alias: alias,
                provider: 'did:ethr:goerli',
                kms: 'local',
            });

            return {
                did: identifier.did,
                controllerKeyId: identifier.controllerKeyId,
                keys: identifier.keys,
                services: identifier.services,
            };
        } catch (error) {
            throw new Error(`Failed to create voter DID: ${error.message}`);
        }
    }

    /**
     * Issue a voting eligibility credential
     */
    async issueVotingEligibilityCredential(issuerDID, subjectDID, voterData) {
        if (!this.initialized) await this.initialize();

        try {
            const credential = await this.agent.createVerifiableCredential({
                credential: {
                    '@context': [
                        'https://www.w3.org/2018/credentials/v1',
                        'https://voting-system.example.com/credentials/v1'
                    ],
                    type: ['VerifiableCredential', 'VotingEligibilityCredential'],
                    issuer: { id: issuerDID },
                    credentialSubject: {
                        id: subjectDID,
                        votingEligibility: {
                            eligible: true,
                            jurisdiction: voterData.jurisdiction,
                            voterRegistrationNumber: voterData.voterRegistrationNumber,
                            registrationDate: voterData.registrationDate,
                            expirationDate: voterData.expirationDate,
                        },
                        biometricHash: voterData.biometricHash, // For additional security
                        residencyProof: voterData.residencyProofHash,
                        citizenshipProof: voterData.citizenshipProofHash,
                    },
                    issuanceDate: new Date().toISOString(),
                    expirationDate: voterData.expirationDate,
                },
                proofFormat: 'jwt',
            });

            // Store the credential
            await this.agent.dataStoreSaveVerifiableCredential({
                verifiableCredential: credential,
            });

            return credential;
        } catch (error) {
            throw new Error(`Failed to issue voting eligibility credential: ${error.message}`);
        }
    }

    /**
     * Issue an election participation credential
     */
    async issueElectionParticipationCredential(issuerDID, subjectDID, electionData) {
        if (!this.initialized) await this.initialize();

        try {
            const credential = await this.agent.createVerifiableCredential({
                credential: {
                    '@context': [
                        'https://www.w3.org/2018/credentials/v1',
                        'https://voting-system.example.com/credentials/v1'
                    ],
                    type: ['VerifiableCredential', 'ElectionParticipationCredential'],
                    issuer: { id: issuerDID },
                    credentialSubject: {
                        id: subjectDID,
                        electionParticipation: {
                            electionId: electionData.electionId,
                            electionName: electionData.electionName,
                            eligibleToVote: true,
                            registrationConfirmed: true,
                            ballotAccess: electionData.ballotTypes || ['general'],
                        },
                        voterCategory: electionData.voterCategory || 'general',
                        specialRequirements: electionData.specialRequirements || [],
                    },
                    issuanceDate: new Date().toISOString(),
                    expirationDate: electionData.electionEndDate,
                },
                proofFormat: 'jwt',
            });

            await this.agent.dataStoreSaveVerifiableCredential({
                verifiableCredential: credential,
            });

            return credential;
        } catch (error) {
            throw new Error(`Failed to issue election participation credential: ${error.message}`);
        }
    }

    /**
     * Verify a verifiable credential
     */
    async verifyCredential(credential) {
        if (!this.initialized) await this.initialize();

        try {
            const result = await this.agent.verifyCredential({
                credential: credential,
            });

            return {
                verified: result.verified,
                error: result.error,
                verifiableCredential: result.verifiableCredential,
            };
        } catch (error) {
            throw new Error(`Failed to verify credential: ${error.message}`);
        }
    }

    /**
     * Create a verifiable presentation for voting
     */
    async createVotingPresentation(holderDID, credentials, challenge, domain) {
        if (!this.initialized) await this.initialize();

        try {
            const presentation = await this.agent.createVerifiablePresentation({
                presentation: {
                    '@context': ['https://www.w3.org/2018/credentials/v1'],
                    type: ['VerifiablePresentation'],
                    holder: holderDID,
                    verifiableCredential: credentials,
                },
                challenge: challenge,
                domain: domain,
                proofFormat: 'jwt',
            });

            return presentation;
        } catch (error) {
            throw new Error(`Failed to create voting presentation: ${error.message}`);
        }
    }

    /**
     * Verify a verifiable presentation
     */
    async verifyPresentation(presentation, challenge, domain) {
        if (!this.initialized) await this.initialize();

        try {
            const result = await this.agent.verifyPresentation({
                presentation: presentation,
                challenge: challenge,
                domain: domain,
            });

            return {
                verified: result.verified,
                error: result.error,
                verifiablePresentation: result.verifiablePresentation,
            };
        } catch (error) {
            throw new Error(`Failed to verify presentation: ${error.message}`);
        }
    }

    /**
     * Get all credentials for a DID
     */
    async getCredentialsForDID(did) {
        if (!this.initialized) await this.initialize();

        try {
            const credentials = await this.agent.dataStoreORMGetVerifiableCredentials({
                where: [
                    { column: 'subject', value: [did] },
                ],
            });

            return credentials;
        } catch (error) {
            throw new Error(`Failed to get credentials for DID: ${error.message}`);
        }
    }

    /**
     * Revoke a credential
     */
    async revokeCredential(credentialId, reason) {
        if (!this.initialized) await this.initialize();

        try {
            // In a production system, this would interact with a revocation registry
            const revocationRecord = {
                credentialId: credentialId,
                revokedAt: new Date().toISOString(),
                reason: reason,
                status: 'revoked',
            };

            // Store revocation record (would be stored in blockchain or distributed registry)
            console.log('Credential revoked:', revocationRecord);

            return revocationRecord;
        } catch (error) {
            throw new Error(`Failed to revoke credential: ${error.message}`);
        }
    }

    /**
     * Check if a credential is revoked
     */
    async isCredentialRevoked(credentialId) {
        try {
            // In production, this would check against a revocation registry
            // For now, return false (not revoked)
            return false;
        } catch (error) {
            throw new Error(`Failed to check revocation status: ${error.message}`);
        }
    }

    /**
     * Generate a selective disclosure presentation
     */
    async createSelectiveDisclosurePresentation(holderDID, credential, disclosureMap, challenge, domain) {
        if (!this.initialized) await this.initialize();

        try {
            // Create a new credential with only the disclosed fields
            const originalCredential = credential.verifiableCredential || credential;
            const disclosedCredential = {
                ...originalCredential,
                credentialSubject: this.selectivelyDisclose(
                    originalCredential.credentialSubject,
                    disclosureMap
                ),
            };

            const presentation = await this.agent.createVerifiablePresentation({
                presentation: {
                    '@context': ['https://www.w3.org/2018/credentials/v1'],
                    type: ['VerifiablePresentation', 'SelectiveDisclosurePresentation'],
                    holder: holderDID,
                    verifiableCredential: [disclosedCredential],
                },
                challenge: challenge,
                domain: domain,
                proofFormat: 'jwt',
            });

            return presentation;
        } catch (error) {
            throw new Error(`Failed to create selective disclosure presentation: ${error.message}`);
        }
    }

    /**
     * Helper function for selective disclosure
     */
    selectivelyDisclose(credentialSubject, disclosureMap) {
        const disclosed = {};
        
        for (const [key, shouldDisclose] of Object.entries(disclosureMap)) {
            if (shouldDisclose && credentialSubject[key] !== undefined) {
                disclosed[key] = credentialSubject[key];
            }
        }

        return disclosed;
    }

    /**
     * Batch verify multiple credentials
     */
    async batchVerifyCredentials(credentials) {
        if (!this.initialized) await this.initialize();

        try {
            const results = await Promise.all(
                credentials.map(credential => this.verifyCredential(credential))
            );

            return results;
        } catch (error) {
            throw new Error(`Failed to batch verify credentials: ${error.message}`);
        }
    }

    /**
     * Get DID document
     */
    async resolveDID(did) {
        if (!this.initialized) await this.initialize();

        try {
            const didDocument = await this.agent.resolveDid({ didUrl: did });
            return didDocument;
        } catch (error) {
            throw new Error(`Failed to resolve DID: ${error.message}`);
        }
    }
}

module.exports = CredentialService;
