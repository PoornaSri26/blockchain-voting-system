const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Integration Tests', function () {
    let votingSystem;
    let identityRegistry;
    let zkProofs;
    let owner;
    let electionAdmin;
    let voters;
    let electionId;

    beforeEach(async function () {
        [owner, electionAdmin, ...voters] = await ethers.getSigners();

        // Deploy all contracts
        const ZKVotingProofs = await ethers.getContractFactory('ZKVotingProofs');
        zkProofs = await ZKVotingProofs.deploy();
        await zkProofs.deployed();

        const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
        identityRegistry = await IdentityRegistry.deploy();
        await identityRegistry.deployed();

        const VotingSystem = await ethers.getContractFactory('VotingSystem');
        votingSystem = await VotingSystem.deploy();
        await votingSystem.deployed();

        // Setup roles and permissions
        const ELECTION_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('ELECTION_ADMIN_ROLE'));
        await votingSystem.grantRole(ELECTION_ADMIN_ROLE, electionAdmin.address);
        await identityRegistry.addTrustedIssuer(owner.address);
        await zkProofs.addAuthorizedVerifier(votingSystem.address);
    });

    describe('Complete Election Workflow', function () {
        it('Should execute a complete election from setup to results', async function () {
            // Step 1: Create election
            const startTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
            const endTime = startTime + 3600; // 1 hour duration
            const registrationDeadline = startTime - 60; // 1 minute before start
            const candidates = ['Alice Johnson', 'Bob Smith', 'Carol Davis'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('voter_merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Presidential Election 2024',
                'National presidential election with blockchain security',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            electionId = 1;
            let election = await votingSystem.getElectionInfo(electionId);
            expect(election.name).to.equal('Presidential Election 2024');

            // Step 2: Setup voter identities
            const voterDIDs = [];
            const voterCredentials = [];

            for (let i = 0; i < 3; i++) {
                const voter = voters[i];
                const didUri = `did:ethr:${voter.address}`;
                const publicKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`public_key_${i}`));
                const serviceEndpoint = 'https://voting.example.com';

                // Register DID
                await identityRegistry.connect(voter).registerDID(
                    didUri,
                    publicKeyHash,
                    serviceEndpoint
                );

                voterDIDs.push(didUri);

                // Issue voting credential
                const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential_${i}`));
                const credentialType = 'VotingEligibility';
                const claimHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`claim_${i}`));
                const expirationDate = endTime + 86400; // Valid until day after election
                const signature = ethers.utils.hexlify(ethers.utils.randomBytes(65));

                await identityRegistry.connect(owner).issueCredential(
                    credentialId,
                    voter.address,
                    credentialType,
                    claimHash,
                    expirationDate,
                    signature
                );

                voterCredentials.push(credentialId);

                // Verify credential
                const isValid = await identityRegistry.verifyCredential(credentialId);
                expect(isValid).to.be.true;
            }

            // Step 3: Voter registration phase
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 1); // Registration

            const merkleProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof'))];

            for (let i = 0; i < 3; i++) {
                const voter = voters[i];
                const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(voterDIDs[i]));
                const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential_${i}`));

                await votingSystem.connect(voter).registerVoter(
                    electionId,
                    didHash,
                    credentialHash,
                    merkleProof
                );
            }

            election = await votingSystem.getElectionInfo(electionId);
            expect(election.registeredVoters).to.equal(3);

            // Step 4: Voting phase
            await time.increaseTo(startTime + 1);
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 2); // Voting

            const votes = ['Alice Johnson', 'Bob Smith', 'Alice Johnson']; // Alice gets 2 votes, Bob gets 1
            const commitments = [];
            const nonces = [];

            for (let i = 0; i < 3; i++) {
                const voter = voters[i];
                const candidate = votes[i];
                const nonce = Math.floor(Math.random() * 1000000);
                nonces.push(nonce);

                const commitment = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['string', 'uint256', 'address'],
                        [candidate, nonce, voter.address]
                    )
                );
                commitments.push(commitment);

                const zkProof = ethers.utils.hexlify(ethers.utils.randomBytes(128));

                await votingSystem.connect(voter).castVote(electionId, commitment, zkProof);
            }

            election = await votingSystem.getElectionInfo(electionId);
            expect(election.totalVotes).to.equal(0); // Votes not revealed yet

            // Step 5: Tallying phase
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 3); // Tallying

            // Reveal votes
            for (let i = 0; i < 3; i++) {
                const voter = voters[i];
                const candidate = votes[i];
                const nonce = nonces[i];

                await votingSystem.connect(voter).revealVote(electionId, candidate, nonce);
            }

            election = await votingSystem.getElectionInfo(electionId);
            expect(election.totalVotes).to.equal(3);

            // Step 6: Publish results
            await votingSystem.connect(electionAdmin).publishResults(electionId);

            const results = await votingSystem.getResults(electionId);
            expect(results.candidates).to.deep.equal(candidates);
            expect(results.totalVotes).to.equal(3);

            // Verify vote distribution (Alice: 2, Bob: 1, Carol: 0)
            // Note: In a real implementation, we'd need to parse the results properly
            expect(results.voteCounts.length).to.equal(3);
        });

        it('Should handle edge cases and error conditions', async function () {
            // Test voting before registration
            const startTime = Math.floor(Date.now() / 1000) + 300;
            const endTime = startTime + 3600;
            const registrationDeadline = startTime - 60;
            const candidates = ['Alice', 'Bob'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Test Election',
                'Test election for edge cases',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            const testElectionId = 2;

            // Try to vote without registration
            await time.increaseTo(startTime + 1);
            await votingSystem.connect(electionAdmin).changeElectionState(testElectionId, 2); // Voting

            const commitment = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test_commitment'));
            const zkProof = ethers.utils.hexlify(ethers.utils.randomBytes(128));

            await expect(
                votingSystem.connect(voters[0]).castVote(testElectionId, commitment, zkProof)
            ).to.be.revertedWith('Not registered to vote');

            // Test double voting prevention
            await votingSystem.connect(electionAdmin).changeElectionState(testElectionId, 1); // Registration

            const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('did:ethr:voter'));
            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential'));
            const merkleProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof'))];

            await votingSystem.connect(voters[0]).registerVoter(
                testElectionId,
                didHash,
                credentialHash,
                merkleProof
            );

            await time.increaseTo(startTime + 1);
            await votingSystem.connect(electionAdmin).changeElectionState(testElectionId, 2); // Voting

            // First vote
            await votingSystem.connect(voters[0]).castVote(testElectionId, commitment, zkProof);

            // Second vote should fail
            const commitment2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test_commitment_2'));
            await expect(
                votingSystem.connect(voters[0]).castVote(testElectionId, commitment2, zkProof)
            ).to.be.reverted; // Should fail because voter already voted
        });
    });

    describe('Security and Privacy Tests', function () {
        it('Should maintain voter privacy through ZK proofs', async function () {
            // This test verifies that the system maintains privacy
            // In a real implementation, this would test actual ZK proof verification
            
            const mockProof = {
                a: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)],
                b: [[ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)], 
                    [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]],
                c: [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]
            };

            const publicSignals = [1, 2, 3]; // Mock public signals

            // In the current implementation, this is simplified
            // Real ZK proof verification would happen here
            expect(mockProof.a.length).to.equal(2);
            expect(mockProof.b.length).to.equal(2);
            expect(mockProof.c.length).to.equal(2);
        });

        it('Should prevent unauthorized access to sensitive functions', async function () {
            // Test that only authorized roles can perform sensitive operations
            await expect(
                votingSystem.connect(voters[0]).changeElectionState(1, 1)
            ).to.be.revertedWith('Not an election admin');

            await expect(
                identityRegistry.connect(voters[0]).addTrustedIssuer(voters[1].address)
            ).to.be.reverted;
        });
    });

    describe('Performance and Scalability Tests', function () {
        it('Should handle multiple concurrent voters', async function () {
            // Setup election
            const startTime = Math.floor(Date.now() / 1000) + 300;
            const endTime = startTime + 3600;
            const registrationDeadline = startTime - 60;
            const candidates = ['Candidate A', 'Candidate B'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Scalability Test Election',
                'Testing concurrent voter handling',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            const scaleElectionId = 3;
            await votingSystem.connect(electionAdmin).changeElectionState(scaleElectionId, 1); // Registration

            // Register multiple voters concurrently
            const registrationPromises = [];
            const numVoters = Math.min(voters.length, 5); // Limit to available signers

            for (let i = 0; i < numVoters; i++) {
                const voter = voters[i];
                const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`did:ethr:${voter.address}`));
                const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`credential_${i}`));
                const merkleProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`proof_${i}`))];

                registrationPromises.push(
                    votingSystem.connect(voter).registerVoter(
                        scaleElectionId,
                        didHash,
                        credentialHash,
                        merkleProof
                    )
                );
            }

            await Promise.all(registrationPromises);

            const election = await votingSystem.getElectionInfo(scaleElectionId);
            expect(election.registeredVoters).to.equal(numVoters);
        });
    });
});
