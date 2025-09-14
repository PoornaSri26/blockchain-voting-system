const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('IdentityRegistry', function () {
    let identityRegistry;
    let owner;
    let issuer;
    let user1;
    let user2;

    const IDENTITY_ISSUER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('IDENTITY_ISSUER_ROLE'));

    beforeEach(async function () {
        [owner, issuer, user1, user2] = await ethers.getSigners();

        const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
        identityRegistry = await IdentityRegistry.deploy();
        await identityRegistry.deployed();

        // Add trusted issuer
        await identityRegistry.addTrustedIssuer(issuer.address);
    });

    describe('DID Management', function () {
        it('Should register a new DID', async function () {
            const didUri = 'did:ethr:0x123...';
            const publicKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_key'));
            const serviceEndpoint = 'https://voting.example.com';

            await expect(
                identityRegistry.connect(user1).registerDID(
                    didUri,
                    publicKeyHash,
                    serviceEndpoint
                )
            ).to.emit(identityRegistry, 'DIDRegistered');

            const didDocument = await identityRegistry.didDocuments(user1.address);
            expect(didDocument.didUri).to.equal(didUri);
            expect(didDocument.isActive).to.be.true;
        });

        it('Should update an existing DID', async function () {
            const didUri = 'did:ethr:0x123...';
            const publicKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_key'));
            const serviceEndpoint = 'https://voting.example.com';

            // Register DID first
            await identityRegistry.connect(user1).registerDID(
                didUri,
                publicKeyHash,
                serviceEndpoint
            );

            // Update DID
            const newServiceEndpoint = 'https://new-voting.example.com';
            await expect(
                identityRegistry.connect(user1).updateDID(
                    didUri,
                    publicKeyHash,
                    newServiceEndpoint
                )
            ).to.emit(identityRegistry, 'DIDUpdated');

            const didDocument = await identityRegistry.didDocuments(user1.address);
            expect(didDocument.serviceEndpoint).to.equal(newServiceEndpoint);
        });

        it('Should deactivate a DID', async function () {
            const didUri = 'did:ethr:0x123...';
            const publicKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_key'));
            const serviceEndpoint = 'https://voting.example.com';

            // Register DID first
            await identityRegistry.connect(user1).registerDID(
                didUri,
                publicKeyHash,
                serviceEndpoint
            );

            // Deactivate DID
            await expect(
                identityRegistry.connect(user1).deactivateDID()
            ).to.emit(identityRegistry, 'DIDDeactivated');

            const didDocument = await identityRegistry.didDocuments(user1.address);
            expect(didDocument.isActive).to.be.false;
        });
    });

    describe('Credential Management', function () {
        beforeEach(async function () {
            // Register DID for user1
            const didUri = 'did:ethr:0x123...';
            const publicKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_key'));
            const serviceEndpoint = 'https://voting.example.com';

            await identityRegistry.connect(user1).registerDID(
                didUri,
                publicKeyHash,
                serviceEndpoint
            );
        });

        it('Should issue a verifiable credential', async function () {
            const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential_1'));
            const credentialType = 'VotingEligibility';
            const claimHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('claim_data'));
            const expirationDate = Math.floor(Date.now() / 1000) + 86400; // 24 hours
            const signature = ethers.utils.hexlify(ethers.utils.randomBytes(65));

            await expect(
                identityRegistry.connect(issuer).issueCredential(
                    credentialId,
                    user1.address,
                    credentialType,
                    claimHash,
                    expirationDate,
                    signature
                )
            ).to.emit(identityRegistry, 'CredentialIssued');

            const credential = await identityRegistry.credentials(credentialId);
            expect(credential.subject).to.equal(user1.address);
            expect(credential.credentialType).to.equal(credentialType);
        });

        it('Should revoke a credential', async function () {
            const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential_1'));
            const credentialType = 'VotingEligibility';
            const claimHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('claim_data'));
            const expirationDate = Math.floor(Date.now() / 1000) + 86400;
            const signature = ethers.utils.hexlify(ethers.utils.randomBytes(65));

            // Issue credential first
            await identityRegistry.connect(issuer).issueCredential(
                credentialId,
                user1.address,
                credentialType,
                claimHash,
                expirationDate,
                signature
            );

            // Revoke credential
            await expect(
                identityRegistry.connect(issuer).revokeCredential(credentialId)
            ).to.emit(identityRegistry, 'CredentialRevoked');

            const credential = await identityRegistry.credentials(credentialId);
            expect(credential.isRevoked).to.be.true;
        });

        it('Should verify credential validity', async function () {
            const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential_1'));
            const credentialType = 'VotingEligibility';
            const claimHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('claim_data'));
            const expirationDate = Math.floor(Date.now() / 1000) + 86400;
            const signature = ethers.utils.hexlify(ethers.utils.randomBytes(65));

            // Issue credential
            await identityRegistry.connect(issuer).issueCredential(
                credentialId,
                user1.address,
                credentialType,
                claimHash,
                expirationDate,
                signature
            );

            const isValid = await identityRegistry.verifyCredential(credentialId);
            expect(isValid).to.be.true;
        });
    });

    describe('Voting Credential Validation', function () {
        it('Should validate voting credentials', async function () {
            // Register DID
            const didUri = 'did:ethr:0x123...';
            const publicKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('public_key'));
            const serviceEndpoint = 'https://voting.example.com';

            await identityRegistry.connect(user1).registerDID(
                didUri,
                publicKeyHash,
                serviceEndpoint
            );

            // Issue voting credential
            const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('voting_credential'));
            const credentialType = 'VotingEligibility';
            const claimHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('voting_claim'));
            const expirationDate = Math.floor(Date.now() / 1000) + 86400;
            const signature = ethers.utils.hexlify(ethers.utils.randomBytes(65));

            await identityRegistry.connect(issuer).issueCredential(
                credentialId,
                user1.address,
                credentialType,
                claimHash,
                expirationDate,
                signature
            );

            const hasValidCredentials = await identityRegistry.hasValidVotingCredentials(user1.address);
            expect(hasValidCredentials).to.be.true;
        });
    });

    describe('Access Control', function () {
        it('Should restrict credential issuance to trusted issuers', async function () {
            const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential_1'));
            const credentialType = 'VotingEligibility';
            const claimHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('claim_data'));
            const expirationDate = Math.floor(Date.now() / 1000) + 86400;
            const signature = ethers.utils.hexlify(ethers.utils.randomBytes(65));

            await expect(
                identityRegistry.connect(user1).issueCredential(
                    credentialId,
                    user2.address,
                    credentialType,
                    claimHash,
                    expirationDate,
                    signature
                )
            ).to.be.reverted;
        });

        it('Should allow admin to add trusted issuers', async function () {
            await expect(
                identityRegistry.addTrustedIssuer(user1.address)
            ).to.emit(identityRegistry, 'TrustedIssuerAdded');

            const isTrusted = await identityRegistry.trustedIssuers(user1.address);
            expect(isTrusted).to.be.true;
        });
    });
});
