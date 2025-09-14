const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('VotingSystem', function () {
    let votingSystem;
    let identityRegistry;
    let zkProofs;
    let owner;
    let voter1;
    let voter2;
    let voter3;
    let electionAdmin;

    const ELECTION_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('ELECTION_ADMIN_ROLE'));
    const VALIDATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('VALIDATOR_ROLE'));

    beforeEach(async function () {
        [owner, voter1, voter2, voter3, electionAdmin] = await ethers.getSigners();

        // Deploy ZKVotingProofs contract
        const ZKVotingProofs = await ethers.getContractFactory('ZKVotingProofs');
        zkProofs = await ZKVotingProofs.deploy();
        await zkProofs.deployed();

        // Deploy IdentityRegistry contract
        const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
        identityRegistry = await IdentityRegistry.deploy();
        await identityRegistry.deployed();

        // Deploy VotingSystem contract
        const VotingSystem = await ethers.getContractFactory('VotingSystem');
        votingSystem = await VotingSystem.deploy();
        await votingSystem.deployed();

        // Grant roles
        await votingSystem.grantRole(ELECTION_ADMIN_ROLE, electionAdmin.address);
        await identityRegistry.addTrustedIssuer(owner.address);
    });

    describe('Election Creation', function () {
        it('Should create a new election', async function () {
            const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            const endTime = startTime + 86400; // 24 hours later
            const registrationDeadline = startTime - 1800; // 30 minutes before start
            const candidates = ['Alice', 'Bob', 'Charlie'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await expect(
                votingSystem.connect(electionAdmin).createElection(
                    'Test Election',
                    'A test election for demonstration',
                    startTime,
                    endTime,
                    registrationDeadline,
                    candidates,
                    merkleRoot
                )
            ).to.emit(votingSystem, 'ElectionCreated');

            const election = await votingSystem.getElectionInfo(1);
            expect(election.name).to.equal('Test Election');
            expect(election.candidates).to.deep.equal(candidates);
        });

        it('Should reject election with invalid timing', async function () {
            const startTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const endTime = startTime + 86400;
            const registrationDeadline = startTime - 1800;
            const candidates = ['Alice', 'Bob'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await expect(
                votingSystem.connect(electionAdmin).createElection(
                    'Invalid Election',
                    'Invalid timing',
                    startTime,
                    endTime,
                    registrationDeadline,
                    candidates,
                    merkleRoot
                )
            ).to.be.revertedWith('Start time must be in future');
        });
    });

    describe('Voter Registration', function () {
        let electionId;
        let merkleRoot;
        let merkleProof;

        beforeEach(async function () {
            const startTime = Math.floor(Date.now() / 1000) + 3600;
            const endTime = startTime + 86400;
            const registrationDeadline = startTime - 1800;
            const candidates = ['Alice', 'Bob', 'Charlie'];
            merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Test Election',
                'A test election',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            electionId = 1;
            
            // Change election state to Registration
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 1); // Registration

            // Create mock merkle proof
            merkleProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof1'))];
        });

        it('Should register a voter successfully', async function () {
            const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('did:ethr:voter1'));
            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential1'));

            await expect(
                votingSystem.connect(voter1).registerVoter(
                    electionId,
                    didHash,
                    credentialHash,
                    merkleProof
                )
            ).to.emit(votingSystem, 'VoterRegistered');

            const election = await votingSystem.getElectionInfo(electionId);
            expect(election.registeredVoters).to.equal(1);
        });

        it('Should reject duplicate registration', async function () {
            const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('did:ethr:voter1'));
            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential1'));

            // First registration
            await votingSystem.connect(voter1).registerVoter(
                electionId,
                didHash,
                credentialHash,
                merkleProof
            );

            // Second registration should fail
            await expect(
                votingSystem.connect(voter1).registerVoter(
                    electionId,
                    didHash,
                    credentialHash,
                    merkleProof
                )
            ).to.be.revertedWith('Already registered');
        });
    });

    describe('Voting Process', function () {
        let electionId;

        beforeEach(async function () {
            const startTime = Math.floor(Date.now() / 1000) + 100; // Soon
            const endTime = startTime + 86400;
            const registrationDeadline = startTime - 1800;
            const candidates = ['Alice', 'Bob', 'Charlie'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Test Election',
                'A test election',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            electionId = 1;

            // Register voters
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 1); // Registration
            
            const didHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('did:ethr:voter1'));
            const credentialHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential1'));
            const merkleProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof1'))];

            await votingSystem.connect(voter1).registerVoter(
                electionId,
                didHash1,
                credentialHash1,
                merkleProof
            );

            // Move to voting phase
            await time.increaseTo(startTime + 1);
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 2); // Voting
        });

        it('Should cast a vote successfully', async function () {
            const commitment = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('vote_commitment'));
            const zkProof = ethers.utils.hexlify(ethers.utils.randomBytes(128));

            await expect(
                votingSystem.connect(voter1).castVote(
                    electionId,
                    commitment,
                    zkProof
                )
            ).to.emit(votingSystem, 'VoteCast');
        });

        it('Should reject vote from unregistered voter', async function () {
            const commitment = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('vote_commitment'));
            const zkProof = ethers.utils.hexlify(ethers.utils.randomBytes(128));

            await expect(
                votingSystem.connect(voter2).castVote(
                    electionId,
                    commitment,
                    zkProof
                )
            ).to.be.revertedWith('Not registered to vote');
        });
    });

    describe('Vote Revelation and Tallying', function () {
        let electionId;
        let commitment;
        let nonce;

        beforeEach(async function () {
            const startTime = Math.floor(Date.now() / 1000) + 100;
            const endTime = startTime + 86400;
            const registrationDeadline = startTime - 1800;
            const candidates = ['Alice', 'Bob', 'Charlie'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Test Election',
                'A test election',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            electionId = 1;

            // Register and vote
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 1);
            
            const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('did:ethr:voter1'));
            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('credential1'));
            const merkleProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes('proof1'))];

            await votingSystem.connect(voter1).registerVoter(
                electionId,
                didHash,
                credentialHash,
                merkleProof
            );

            await time.increaseTo(startTime + 1);
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 2);

            // Cast vote
            nonce = 12345;
            const candidate = 'Alice';
            commitment = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ['string', 'uint256', 'address'],
                    [candidate, nonce, voter1.address]
                )
            );
            const zkProof = ethers.utils.hexlify(ethers.utils.randomBytes(128));

            await votingSystem.connect(voter1).castVote(electionId, commitment, zkProof);

            // Move to tallying phase
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 3);
        });

        it('Should reveal vote successfully', async function () {
            await expect(
                votingSystem.connect(voter1).revealVote(electionId, 'Alice', nonce)
            ).to.emit(votingSystem, 'VoteRevealed');

            const election = await votingSystem.getElectionInfo(electionId);
            expect(election.totalVotes).to.equal(1);
        });

        it('Should reject invalid vote revelation', async function () {
            await expect(
                votingSystem.connect(voter1).revealVote(electionId, 'Bob', nonce)
            ).to.be.revertedWith('Invalid reveal');
        });
    });

    describe('Results Publication', function () {
        let electionId;

        beforeEach(async function () {
            const startTime = Math.floor(Date.now() / 1000) + 100;
            const endTime = startTime + 86400;
            const registrationDeadline = startTime - 1800;
            const candidates = ['Alice', 'Bob', 'Charlie'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await votingSystem.connect(electionAdmin).createElection(
                'Test Election',
                'A test election',
                startTime,
                endTime,
                registrationDeadline,
                candidates,
                merkleRoot
            );

            electionId = 1;
            await votingSystem.connect(electionAdmin).changeElectionState(electionId, 3); // Tallying
        });

        it('Should publish results successfully', async function () {
            await expect(
                votingSystem.connect(electionAdmin).publishResults(electionId)
            ).to.emit(votingSystem, 'ResultsPublished');

            const results = await votingSystem.getResults(electionId);
            expect(results.candidates).to.deep.equal(['Alice', 'Bob', 'Charlie']);
        });

        it('Should reject duplicate result publication', async function () {
            await votingSystem.connect(electionAdmin).publishResults(electionId);

            await expect(
                votingSystem.connect(electionAdmin).publishResults(electionId)
            ).to.be.revertedWith('Results already published');
        });
    });

    describe('Access Control', function () {
        it('Should restrict election creation to admins only', async function () {
            const startTime = Math.floor(Date.now() / 1000) + 3600;
            const endTime = startTime + 86400;
            const registrationDeadline = startTime - 1800;
            const candidates = ['Alice', 'Bob'];
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('merkle_root'));

            await expect(
                votingSystem.connect(voter1).createElection(
                    'Unauthorized Election',
                    'Should fail',
                    startTime,
                    endTime,
                    registrationDeadline,
                    candidates,
                    merkleRoot
                )
            ).to.be.revertedWith('Not an election admin');
        });

        it('Should restrict state changes to admins only', async function () {
            await expect(
                votingSystem.connect(voter1).changeElectionState(1, 1)
            ).to.be.revertedWith('Not an election admin');
        });
    });
});
