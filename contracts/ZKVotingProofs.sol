// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKVotingProofs
 * @dev Zero-knowledge proof verification for anonymous voting
 */
contract ZKVotingProofs {
    
    struct VerifyingKey {
        uint256[2] alpha;
        uint256[2][2] beta;
        uint256[2][2] gamma;
        uint256[2][2] delta;
        uint256[][] ic;
    }

    struct Proof {
        uint256[2] a;
        uint256[2] b;
        uint256[2] c;
    }

    struct VoteProof {
        Proof proof;
        uint256[] publicInputs;
        bytes32 nullifierHash;
        bytes32 commitmentHash;
    }

    mapping(bytes32 => VerifyingKey) public verifyingKeys;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(address => bool) public authorizedVerifiers;

    event ProofVerified(bytes32 indexed proofId, address indexed verifier, bool result);
    event NullifierUsed(bytes32 indexed nullifier);
    event VerifyingKeySet(bytes32 indexed keyId, address indexed setter);

    modifier onlyAuthorized() {
        require(authorizedVerifiers[msg.sender], "Not authorized verifier");
        _;
    }

    constructor() {
        authorizedVerifiers[msg.sender] = true;
    }

    /**
     * @dev Set verifying key for a specific circuit
     */
    function setVerifyingKey(
        bytes32 _keyId,
        uint256[2] memory _alpha,
        uint256[2][2] memory _beta,
        uint256[2][2] memory _gamma,
        uint256[2][2] memory _delta,
        uint256[][] memory _ic
    ) external onlyAuthorized {
        verifyingKeys[_keyId] = VerifyingKey({
            alpha: _alpha,
            beta: _beta,
            gamma: _gamma,
            delta: _delta,
            ic: _ic
        });

        emit VerifyingKeySet(_keyId, msg.sender);
    }

    /**
     * @dev Verify a zero-knowledge proof for voting eligibility
     */
    function verifyVoteEligibility(
        bytes32 _circuitId,
        VoteProof memory _voteProof
    ) external returns (bool) {
        require(!usedNullifiers[_voteProof.nullifierHash], "Nullifier already used");
        
        bool isValid = verifyProof(
            _circuitId,
            _voteProof.proof,
            _voteProof.publicInputs
        );

        if (isValid) {
            usedNullifiers[_voteProof.nullifierHash] = true;
            emit NullifierUsed(_voteProof.nullifierHash);
        }

        emit ProofVerified(
            keccak256(abi.encodePacked(_voteProof.proof.a, _voteProof.proof.b, _voteProof.proof.c)),
            msg.sender,
            isValid
        );

        return isValid;
    }

    /**
     * @dev Verify a generic zero-knowledge proof
     */
    function verifyProof(
        bytes32 _keyId,
        Proof memory _proof,
        uint256[] memory _publicInputs
    ) public view returns (bool) {
        VerifyingKey memory vk = verifyingKeys[_keyId];
        require(vk.alpha[0] != 0 || vk.alpha[1] != 0, "Verifying key not set");

        // Simplified verification - in production would use proper pairing library
        // This is a placeholder for demonstration purposes
        return _proof.a[0] != 0 && _proof.b[0][0] != 0 && _proof.c[0] != 0;
    }

    /**
     * @dev Batch verify multiple proofs
     */
    function batchVerifyProofs(
        bytes32 _keyId,
        Proof[] memory _proofs,
        uint256[][] memory _publicInputs
    ) external view returns (bool[] memory) {
        require(_proofs.length == _publicInputs.length, "Mismatched array lengths");
        
        bool[] memory results = new bool[](_proofs.length);
        
        for (uint i = 0; i < _proofs.length; i++) {
            results[i] = verifyProof(_keyId, _proofs[i], _publicInputs[i]);
        }
        
        return results;
    }

    /**
     * @dev Generate commitment hash for vote privacy
     */
    function generateCommitment(
        string memory _candidate,
        uint256 _nonce,
        address _voter
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_candidate, _nonce, _voter));
    }

    /**
     * @dev Generate nullifier hash to prevent double voting
     */
    function generateNullifier(
        bytes32 _secret,
        uint256 _electionId
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret, _electionId));
    }

    /**
     * @dev Add authorized verifier
     */
    function addAuthorizedVerifier(address _verifier) external onlyAuthorized {
        authorizedVerifiers[_verifier] = true;
    }

    /**
     * @dev Remove authorized verifier
     */
    function removeAuthorizedVerifier(address _verifier) external onlyAuthorized {
        authorizedVerifiers[_verifier] = false;
    }

    /**
     * @dev Check if nullifier has been used
     */
    function isNullifierUsed(bytes32 _nullifier) external view returns (bool) {
        return usedNullifiers[_nullifier];
    }
}
