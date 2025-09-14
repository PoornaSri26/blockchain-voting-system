const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ZKVotingProofs', function () {
    let zkProofs;
    let owner;
    let verifier;
    let user1;
    let user2;

    const VERIFIER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('VERIFIER_ROLE'));

    beforeEach(async function () {
        [owner, verifier, user1, user2] = await ethers.getSigners();

        const ZKVotingProofs = await ethers.getContractFactory('ZKVotingProofs');
        zkProofs = await ZKVotingProofs.deploy();
        await zkProofs.deployed();

        // Add authorized verifier
        await zkProofs.addAuthorizedVerifier(verifier.address);
    });

    describe('Proof Verification', function () {
        it('Should verify a valid ZK proof', async function () {
            const mockProof = {
                a: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)],
                b: [[ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)], 
                    [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]],
                c: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]
            };

            const publicSignals = [1, 2, 3];
            const proofId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof_1'));

            await expect(
                zkProofs.connect(verifier).verifyProof(proofId, mockProof, publicSignals)
            ).to.emit(zkProofs, 'ProofVerified');

            const isVerified = await zkProofs.verifiedProofs(proofId);
            expect(isVerified).to.be.true;
        });

        it('Should reject duplicate proof verification', async function () {
            const mockProof = {
                a: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)],
                b: [[ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)], 
                    [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]],
                c: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]
            };

            const publicSignals = [1, 2, 3];
            const proofId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof_1'));

            // First verification
            await zkProofs.connect(verifier).verifyProof(proofId, mockProof, publicSignals);

            // Second verification should fail
            await expect(
                zkProofs.connect(verifier).verifyProof(proofId, mockProof, publicSignals)
            ).to.be.revertedWith('Proof already verified');
        });
    });

    describe('Nullifier Management', function () {
        it('Should register a nullifier', async function () {
            const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_1'));

            await expect(
                zkProofs.connect(verifier).registerNullifier(nullifier)
            ).to.emit(zkProofs, 'NullifierRegistered');

            const isUsed = await zkProofs.usedNullifiers(nullifier);
            expect(isUsed).to.be.true;
        });

        it('Should prevent double spending with nullifiers', async function () {
            const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_1'));

            // First registration
            await zkProofs.connect(verifier).registerNullifier(nullifier);

            // Second registration should fail
            await expect(
                zkProofs.connect(verifier).registerNullifier(nullifier)
            ).to.be.revertedWith('Nullifier already used');
        });

        it('Should check nullifier usage', async function () {
            const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_1'));

            // Initially not used
            let isUsed = await zkProofs.isNullifierUsed(nullifier);
            expect(isUsed).to.be.false;

            // Register nullifier
            await zkProofs.connect(verifier).registerNullifier(nullifier);

            // Now should be used
            isUsed = await zkProofs.isNullifierUsed(nullifier);
            expect(isUsed).to.be.true;
        });
    });

    describe('Commitment Hash Generation', function () {
        it('Should generate consistent commitment hashes', async function () {
            const vote = 'Alice Johnson';
            const nonce = 12345;
            const voter = user1.address;

            const commitment1 = await zkProofs.generateCommitmentHash(vote, nonce, voter);
            const commitment2 = await zkProofs.generateCommitmentHash(vote, nonce, voter);

            expect(commitment1).to.equal(commitment2);
        });

        it('Should generate different hashes for different inputs', async function () {
            const vote1 = 'Alice Johnson';
            const vote2 = 'Bob Smith';
            const nonce = 12345;
            const voter = user1.address;

            const commitment1 = await zkProofs.generateCommitmentHash(vote1, nonce, voter);
            const commitment2 = await zkProofs.generateCommitmentHash(vote2, nonce, voter);

            expect(commitment1).to.not.equal(commitment2);
        });
    });

    describe('Access Control', function () {
        it('Should restrict proof verification to authorized verifiers', async function () {
            const mockProof = {
                a: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)],
                b: [[ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)], 
                    [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]],
                c: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]
            };

            const publicSignals = [1, 2, 3];
            const proofId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof_1'));

            await expect(
                zkProofs.connect(user1).verifyProof(proofId, mockProof, publicSignals)
            ).to.be.revertedWith('Not an authorized verifier');
        });

        it('Should allow admin to add authorized verifiers', async function () {
            await expect(
                zkProofs.addAuthorizedVerifier(user1.address)
            ).to.emit(zkProofs, 'VerifierAdded');

            const isAuthorized = await zkProofs.authorizedVerifiers(user1.address);
            expect(isAuthorized).to.be.true;
        });

        it('Should allow admin to remove authorized verifiers', async function () {
            // Add verifier first
            await zkProofs.addAuthorizedVerifier(user1.address);

            // Remove verifier
            await expect(
                zkProofs.removeAuthorizedVerifier(user1.address)
            ).to.emit(zkProofs, 'VerifierRemoved');

            const isAuthorized = await zkProofs.authorizedVerifiers(user1.address);
            expect(isAuthorized).to.be.false;
        });
    });

    describe('Batch Operations', function () {
        it('Should handle batch proof verification', async function () {
            const proofIds = [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof_1')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof_2')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof_3'))
            ];

            for (let i = 0; i < proofIds.length; i++) {
                const mockProof = {
                    a: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)],
                    b: [[ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)], 
                        [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]],
                    c: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]
                };

                const publicSignals = [i + 1, i + 2, i + 3];

                await zkProofs.connect(verifier).verifyProof(proofIds[i], mockProof, publicSignals);
            }

            // Verify all proofs are registered
            for (const proofId of proofIds) {
                const isVerified = await zkProofs.verifiedProofs(proofId);
                expect(isVerified).to.be.true;
            }
        });

        it('Should handle batch nullifier registration', async function () {
            const nullifiers = [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_1')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_2')),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_3'))
            ];

            for (const nullifier of nullifiers) {
                await zkProofs.connect(verifier).registerNullifier(nullifier);
            }

            // Verify all nullifiers are registered
            for (const nullifier of nullifiers) {
                const isUsed = await zkProofs.usedNullifiers(nullifier);
                expect(isUsed).to.be.true;
            }
        });
    });
});
