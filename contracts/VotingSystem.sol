// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VotingSystem
 * @dev Core smart contract for blockchain-based voting with privacy and security features
 */
contract VotingSystem is AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // Roles
    bytes32 public constant ELECTION_ADMIN_ROLE = keccak256("ELECTION_ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Election states
    enum ElectionState { Setup, Registration, Voting, Tallying, Completed, Cancelled }

    // Voter registration status
    enum VoterStatus { NotRegistered, Registered, Voted, Disqualified }

    struct Election {
        uint256 id;
        string name;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 registrationDeadline;
        ElectionState state;
        string[] candidates;
        mapping(address => VoterStatus) voterStatus;
        mapping(string => uint256) results;
        uint256 totalVotes;
        uint256 registeredVoters;
        bytes32 merkleRoot; // For voter eligibility verification
        bool resultsPublished;
    }

    struct Vote {
        bytes32 commitment; // Hash commitment for privacy
        bytes zkProof; // Zero-knowledge proof
        uint256 timestamp;
        bool revealed;
    }

    struct VoterCredential {
        bytes32 didHash; // Decentralized Identifier hash
        bytes32 credentialHash; // Verifiable Credential hash
        uint256 registrationTime;
        bool isValid;
    }

    // State variables
    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(address => VoterCredential) public voterCredentials;
    mapping(bytes32 => bool) public usedCommitments;
    
    uint256 public currentElectionId;
    uint256 public electionCounter;
    
    // ZK Verification key (simplified - in production would use proper ZK library)
    bytes32 public zkVerificationKey;

    // Events
    event ElectionCreated(uint256 indexed electionId, string name, uint256 startTime, uint256 endTime);
    event VoterRegistered(uint256 indexed electionId, address indexed voter, bytes32 didHash);
    event VoteCast(uint256 indexed electionId, address indexed voter, bytes32 commitment);
    event VoteRevealed(uint256 indexed electionId, address indexed voter, string candidate);
    event ElectionStateChanged(uint256 indexed electionId, ElectionState newState);
    event ResultsPublished(uint256 indexed electionId, string[] candidates, uint256[] voteCounts);

    // Modifiers
    modifier onlyElectionAdmin() {
        require(hasRole(ELECTION_ADMIN_ROLE, msg.sender), "Not an election admin");
        _;
    }

    modifier onlyValidator() {
        require(hasRole(VALIDATOR_ROLE, msg.sender), "Not a validator");
        _;
    }

    modifier validElection(uint256 _electionId) {
        require(_electionId <= electionCounter && _electionId > 0, "Invalid election ID");
        _;
    }

    modifier inState(uint256 _electionId, ElectionState _state) {
        require(elections[_electionId].state == _state, "Invalid election state");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ELECTION_ADMIN_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
        electionCounter = 0;
    }

    /**
     * @dev Create a new election
     */
    function createElection(
        string memory _name,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _registrationDeadline,
        string[] memory _candidates,
        bytes32 _merkleRoot
    ) external onlyElectionAdmin {
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_registrationDeadline < _startTime, "Registration must end before voting");
        require(_candidates.length >= 2, "Must have at least 2 candidates");

        electionCounter++;
        Election storage newElection = elections[electionCounter];
        
        newElection.id = electionCounter;
        newElection.name = _name;
        newElection.description = _description;
        newElection.startTime = _startTime;
        newElection.endTime = _endTime;
        newElection.registrationDeadline = _registrationDeadline;
        newElection.state = ElectionState.Setup;
        newElection.candidates = _candidates;
        newElection.merkleRoot = _merkleRoot;
        newElection.totalVotes = 0;
        newElection.registeredVoters = 0;
        newElection.resultsPublished = false;

        // Initialize candidate results
        for (uint i = 0; i < _candidates.length; i++) {
            newElection.results[_candidates[i]] = 0;
        }

        emit ElectionCreated(electionCounter, _name, _startTime, _endTime);
    }

    /**
     * @dev Register a voter with DID and Verifiable Credentials
     */
    function registerVoter(
        uint256 _electionId,
        bytes32 _didHash,
        bytes32 _credentialHash,
        bytes32[] memory _merkleProof
    ) external validElection(_electionId) inState(_electionId, ElectionState.Registration) {
        require(block.timestamp <= elections[_electionId].registrationDeadline, "Registration period ended");
        require(elections[_electionId].voterStatus[msg.sender] == VoterStatus.NotRegistered, "Already registered");
        
        // Verify voter eligibility using Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _didHash));
        require(verifyMerkleProof(_merkleProof, elections[_electionId].merkleRoot, leaf), "Invalid eligibility proof");

        // Store voter credentials
        voterCredentials[msg.sender] = VoterCredential({
            didHash: _didHash,
            credentialHash: _credentialHash,
            registrationTime: block.timestamp,
            isValid: true
        });

        elections[_electionId].voterStatus[msg.sender] = VoterStatus.Registered;
        elections[_electionId].registeredVoters++;

        emit VoterRegistered(_electionId, msg.sender, _didHash);
    }

    /**
     * @dev Cast a vote using commitment scheme for privacy
     */
    function castVote(
        uint256 _electionId,
        bytes32 _commitment,
        bytes memory _zkProof
    ) external validElection(_electionId) inState(_electionId, ElectionState.Voting) nonReentrant {
        require(block.timestamp >= elections[_electionId].startTime, "Voting not started");
        require(block.timestamp <= elections[_electionId].endTime, "Voting period ended");
        require(elections[_electionId].voterStatus[msg.sender] == VoterStatus.Registered, "Not registered to vote");
        require(!usedCommitments[_commitment], "Commitment already used");

        // Verify zero-knowledge proof (simplified - would use proper ZK library)
        require(verifyZKProof(_zkProof, _commitment), "Invalid zero-knowledge proof");

        votes[_electionId][msg.sender] = Vote({
            commitment: _commitment,
            zkProof: _zkProof,
            timestamp: block.timestamp,
            revealed: false
        });

        elections[_electionId].voterStatus[msg.sender] = VoterStatus.Voted;
        usedCommitments[_commitment] = true;

        emit VoteCast(_electionId, msg.sender, _commitment);
    }

    /**
     * @dev Reveal vote during tallying phase
     */
    function revealVote(
        uint256 _electionId,
        string memory _candidate,
        uint256 _nonce
    ) external validElection(_electionId) inState(_electionId, ElectionState.Tallying) {
        require(elections[_electionId].voterStatus[msg.sender] == VoterStatus.Voted, "No vote to reveal");
        require(!votes[_electionId][msg.sender].revealed, "Vote already revealed");

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(_candidate, _nonce, msg.sender));
        require(votes[_electionId][msg.sender].commitment == expectedCommitment, "Invalid reveal");

        // Verify candidate exists
        bool validCandidate = false;
        for (uint i = 0; i < elections[_electionId].candidates.length; i++) {
            if (keccak256(bytes(elections[_electionId].candidates[i])) == keccak256(bytes(_candidate))) {
                validCandidate = true;
                break;
            }
        }
        require(validCandidate, "Invalid candidate");

        votes[_electionId][msg.sender].revealed = true;
        elections[_electionId].results[_candidate]++;
        elections[_electionId].totalVotes++;

        emit VoteRevealed(_electionId, msg.sender, _candidate);
    }

    /**
     * @dev Change election state (admin only)
     */
    function changeElectionState(
        uint256 _electionId,
        ElectionState _newState
    ) external onlyElectionAdmin validElection(_electionId) {
        elections[_electionId].state = _newState;
        emit ElectionStateChanged(_electionId, _newState);
    }

    /**
     * @dev Publish election results
     */
    function publishResults(uint256 _electionId) 
        external 
        onlyElectionAdmin 
        validElection(_electionId) 
        inState(_electionId, ElectionState.Tallying) 
    {
        require(!elections[_electionId].resultsPublished, "Results already published");

        elections[_electionId].resultsPublished = true;
        elections[_electionId].state = ElectionState.Completed;

        string[] memory candidates = elections[_electionId].candidates;
        uint256[] memory voteCounts = new uint256[](candidates.length);
        
        for (uint i = 0; i < candidates.length; i++) {
            voteCounts[i] = elections[_electionId].results[candidates[i]];
        }

        emit ResultsPublished(_electionId, candidates, voteCounts);
    }

    /**
     * @dev Get election results
     */
    function getResults(uint256 _electionId) 
        external 
        view 
        validElection(_electionId) 
        returns (string[] memory candidates, uint256[] memory voteCounts, uint256 totalVotes) 
    {
        require(elections[_electionId].resultsPublished, "Results not published yet");
        
        candidates = elections[_electionId].candidates;
        voteCounts = new uint256[](candidates.length);
        
        for (uint i = 0; i < candidates.length; i++) {
            voteCounts[i] = elections[_electionId].results[candidates[i]];
        }
        
        totalVotes = elections[_electionId].totalVotes;
    }

    /**
     * @dev Verify Merkle proof for voter eligibility
     */
    function verifyMerkleProof(
        bytes32[] memory _proof,
        bytes32 _root,
        bytes32 _leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = _leaf;
        
        for (uint256 i = 0; i < _proof.length; i++) {
            bytes32 proofElement = _proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        
        return computedHash == _root;
    }

    /**
     * @dev Verify zero-knowledge proof (simplified implementation)
     */
    function verifyZKProof(bytes memory _proof, bytes32 _commitment) internal view returns (bool) {
        // Simplified ZK verification - in production would use proper ZK library like Circom/snarkjs
        // This is a placeholder that always returns true for demonstration
        // Real implementation would verify the actual ZK proof
        return _proof.length > 0 && _commitment != bytes32(0);
    }

    /**
     * @dev Set ZK verification key (admin only)
     */
    function setZKVerificationKey(bytes32 _key) external onlyElectionAdmin {
        zkVerificationKey = _key;
    }

    /**
     * @dev Emergency pause (admin only)
     */
    function pause() external onlyElectionAdmin {
        _pause();
    }

    /**
     * @dev Unpause (admin only)
     */
    function unpause() external onlyElectionAdmin {
        _unpause();
    }

    /**
     * @dev Get election info
     */
    function getElectionInfo(uint256 _electionId) 
        external 
        view 
        validElection(_electionId) 
        returns (
            string memory name,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            ElectionState state,
            string[] memory candidates,
            uint256 registeredVoters,
            uint256 totalVotes
        ) 
    {
        Election storage election = elections[_electionId];
        return (
            election.name,
            election.description,
            election.startTime,
            election.endTime,
            election.state,
            election.candidates,
            election.registeredVoters,
            election.totalVotes
        );
    }
}
