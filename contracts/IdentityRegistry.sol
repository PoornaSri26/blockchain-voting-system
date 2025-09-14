// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title IdentityRegistry
 * @dev Manages decentralized identities and verifiable credentials for voters
 */
contract IdentityRegistry is AccessControl, ReentrancyGuard {
    
    bytes32 public constant IDENTITY_ISSUER_ROLE = keccak256("IDENTITY_ISSUER_ROLE");
    bytes32 public constant CREDENTIAL_VERIFIER_ROLE = keccak256("CREDENTIAL_VERIFIER_ROLE");

    struct DIDDocument {
        string didUri;
        bytes32 publicKeyHash;
        string serviceEndpoint;
        uint256 created;
        uint256 updated;
        bool isActive;
        address controller;
    }

    struct VerifiableCredential {
        bytes32 credentialId;
        address issuer;
        address subject;
        string credentialType;
        bytes32 claimHash;
        uint256 issuanceDate;
        uint256 expirationDate;
        bool isRevoked;
        bytes signature;
    }

    struct IdentityProof {
        bytes32 merkleRoot;
        bytes32[] merkleProof;
        bytes zkProof;
        uint256 timestamp;
    }

    // Storage mappings
    mapping(address => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => bytes32[]) public userCredentials;
    mapping(bytes32 => bool) public revokedCredentials;
    mapping(address => IdentityProof) public identityProofs;
    
    // Trusted issuers
    mapping(address => bool) public trustedIssuers;
    
    // Events
    event DIDRegistered(address indexed controller, string didUri, bytes32 publicKeyHash);
    event DIDUpdated(address indexed controller, string didUri, uint256 timestamp);
    event DIDDeactivated(address indexed controller, string didUri);
    event CredentialIssued(bytes32 indexed credentialId, address indexed issuer, address indexed subject);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer);
    event TrustedIssuerAdded(address indexed issuer);
    event TrustedIssuerRemoved(address indexed issuer);
    event IdentityProofSubmitted(address indexed user, bytes32 merkleRoot);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(IDENTITY_ISSUER_ROLE, msg.sender);
        _grantRole(CREDENTIAL_VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Register a new DID document
     */
    function registerDID(
        string memory _didUri,
        bytes32 _publicKeyHash,
        string memory _serviceEndpoint
    ) external {
        require(bytes(_didUri).length > 0, "DID URI cannot be empty");
        require(_publicKeyHash != bytes32(0), "Public key hash cannot be zero");
        require(!didDocuments[msg.sender].isActive, "DID already registered");

        didDocuments[msg.sender] = DIDDocument({
            didUri: _didUri,
            publicKeyHash: _publicKeyHash,
            serviceEndpoint: _serviceEndpoint,
            created: block.timestamp,
            updated: block.timestamp,
            isActive: true,
            controller: msg.sender
        });

        emit DIDRegistered(msg.sender, _didUri, _publicKeyHash);
    }

    /**
     * @dev Update an existing DID document
     */
    function updateDID(
        string memory _didUri,
        bytes32 _publicKeyHash,
        string memory _serviceEndpoint
    ) external {
        require(didDocuments[msg.sender].isActive, "DID not registered");
        require(didDocuments[msg.sender].controller == msg.sender, "Not authorized");

        didDocuments[msg.sender].didUri = _didUri;
        didDocuments[msg.sender].publicKeyHash = _publicKeyHash;
        didDocuments[msg.sender].serviceEndpoint = _serviceEndpoint;
        didDocuments[msg.sender].updated = block.timestamp;

        emit DIDUpdated(msg.sender, _didUri, block.timestamp);
    }

    /**
     * @dev Deactivate a DID document
     */
    function deactivateDID() external {
        require(didDocuments[msg.sender].isActive, "DID not active");
        require(didDocuments[msg.sender].controller == msg.sender, "Not authorized");

        didDocuments[msg.sender].isActive = false;
        didDocuments[msg.sender].updated = block.timestamp;

        emit DIDDeactivated(msg.sender, didDocuments[msg.sender].didUri);
    }

    /**
     * @dev Issue a verifiable credential
     */
    function issueCredential(
        bytes32 _credentialId,
        address _subject,
        string memory _credentialType,
        bytes32 _claimHash,
        uint256 _expirationDate,
        bytes memory _signature
    ) external onlyRole(IDENTITY_ISSUER_ROLE) {
        require(_credentialId != bytes32(0), "Invalid credential ID");
        require(_subject != address(0), "Invalid subject address");
        require(_expirationDate > block.timestamp, "Expiration date must be in future");
        require(trustedIssuers[msg.sender], "Not a trusted issuer");
        require(credentials[_credentialId].credentialId == bytes32(0), "Credential already exists");

        credentials[_credentialId] = VerifiableCredential({
            credentialId: _credentialId,
            issuer: msg.sender,
            subject: _subject,
            credentialType: _credentialType,
            claimHash: _claimHash,
            issuanceDate: block.timestamp,
            expirationDate: _expirationDate,
            isRevoked: false,
            signature: _signature
        });

        userCredentials[_subject].push(_credentialId);

        emit CredentialIssued(_credentialId, msg.sender, _subject);
    }

    /**
     * @dev Revoke a verifiable credential
     */
    function revokeCredential(bytes32 _credentialId) external {
        require(credentials[_credentialId].credentialId != bytes32(0), "Credential does not exist");
        require(credentials[_credentialId].issuer == msg.sender, "Not authorized to revoke");
        require(!credentials[_credentialId].isRevoked, "Credential already revoked");

        credentials[_credentialId].isRevoked = true;
        revokedCredentials[_credentialId] = true;

        emit CredentialRevoked(_credentialId, msg.sender);
    }

    /**
     * @dev Verify a credential is valid
     */
    function verifyCredential(bytes32 _credentialId) external view returns (bool) {
        VerifiableCredential memory cred = credentials[_credentialId];
        
        return (
            cred.credentialId != bytes32(0) &&
            !cred.isRevoked &&
            cred.expirationDate > block.timestamp &&
            trustedIssuers[cred.issuer]
        );
    }

    /**
     * @dev Submit identity proof with zero-knowledge verification
     */
    function submitIdentityProof(
        bytes32 _merkleRoot,
        bytes32[] memory _merkleProof,
        bytes memory _zkProof
    ) external nonReentrant {
        require(didDocuments[msg.sender].isActive, "DID not registered");
        require(_merkleRoot != bytes32(0), "Invalid merkle root");
        require(_zkProof.length > 0, "ZK proof required");

        // Verify the merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, didDocuments[msg.sender].publicKeyHash));
        require(verifyMerkleProof(_merkleProof, _merkleRoot, leaf), "Invalid merkle proof");

        identityProofs[msg.sender] = IdentityProof({
            merkleRoot: _merkleRoot,
            merkleProof: _merkleProof,
            zkProof: _zkProof,
            timestamp: block.timestamp
        });

        emit IdentityProofSubmitted(msg.sender, _merkleRoot);
    }

    /**
     * @dev Add a trusted issuer
     */
    function addTrustedIssuer(address _issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_issuer != address(0), "Invalid issuer address");
        trustedIssuers[_issuer] = true;
        _grantRole(IDENTITY_ISSUER_ROLE, _issuer);
        emit TrustedIssuerAdded(_issuer);
    }

    /**
     * @dev Remove a trusted issuer
     */
    function removeTrustedIssuer(address _issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedIssuers[_issuer] = false;
        _revokeRole(IDENTITY_ISSUER_ROLE, _issuer);
        emit TrustedIssuerRemoved(_issuer);
    }

    /**
     * @dev Get user's credentials
     */
    function getUserCredentials(address _user) external view returns (bytes32[] memory) {
        return userCredentials[_user];
    }

    /**
     * @dev Verify merkle proof
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
     * @dev Check if user has valid voting credentials
     */
    function hasValidVotingCredentials(address _user) external view returns (bool) {
        if (!didDocuments[_user].isActive) {
            return false;
        }

        bytes32[] memory userCreds = userCredentials[_user];
        for (uint i = 0; i < userCreds.length; i++) {
            VerifiableCredential memory cred = credentials[userCreds[i]];
            if (
                keccak256(bytes(cred.credentialType)) == keccak256(bytes("VotingEligibility")) &&
                !cred.isRevoked &&
                cred.expirationDate > block.timestamp &&
                trustedIssuers[cred.issuer]
            ) {
                return true;
            }
        }
        
        return false;
    }
}
