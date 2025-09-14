# Blockchain Voting System API Documentation

## Overview

This document provides comprehensive API documentation for the Blockchain Voting System, including smart contract interfaces, backend API endpoints, and client integration guides.

## Smart Contract APIs

### VotingSystem Contract

#### Core Functions

##### `createElection(string name, string description, uint256 startTime, uint256 endTime, uint256 registrationDeadline, string[] candidates, bytes32 voterMerkleRoot)`
Creates a new election with specified parameters.

**Parameters:**
- `name`: Election name
- `description`: Election description
- `startTime`: Unix timestamp for election start
- `endTime`: Unix timestamp for election end
- `registrationDeadline`: Unix timestamp for registration deadline
- `candidates`: Array of candidate names
- `voterMerkleRoot`: Merkle root of eligible voters

**Access:** Election Admin only

##### `registerVoter(uint256 electionId, bytes32 didHash, bytes32 credentialHash, bytes32[] merkleProof)`
Registers a voter for a specific election.

**Parameters:**
- `electionId`: Election identifier
- `didHash`: Hash of voter's DID
- `credentialHash`: Hash of voter's credential
- `merkleProof`: Merkle proof of voter eligibility

##### `castVote(uint256 electionId, bytes32 commitment, bytes zkProof)`
Casts a vote using commitment scheme.

**Parameters:**
- `electionId`: Election identifier
- `commitment`: Vote commitment hash
- `zkProof`: Zero-knowledge proof of vote validity

##### `revealVote(uint256 electionId, string candidate, uint256 nonce)`
Reveals a previously cast vote.

**Parameters:**
- `electionId`: Election identifier
- `candidate`: Candidate name
- `nonce`: Random nonce used in commitment

#### View Functions

##### `getElectionInfo(uint256 electionId) returns (ElectionInfo)`
Returns detailed election information.

##### `getResults(uint256 electionId) returns (ElectionResults)`
Returns election results (only after results are published).

##### `isVoterRegistered(uint256 electionId, address voter) returns (bool)`
Checks if a voter is registered for an election.

### IdentityRegistry Contract

#### Core Functions

##### `registerDID(string didUri, bytes32 publicKeyHash, string serviceEndpoint)`
Registers a new DID for the caller.

##### `issueCredential(bytes32 credentialId, address subject, string credentialType, bytes32 claimHash, uint256 expirationDate, bytes signature)`
Issues a verifiable credential.

**Access:** Trusted Issuer only

##### `verifyCredential(bytes32 credentialId) returns (bool)`
Verifies if a credential is valid and not revoked.

### ZKVotingProofs Contract

#### Core Functions

##### `verifyProof(bytes32 proofId, Proof proof, uint256[] publicSignals)`
Verifies a zero-knowledge proof.

**Access:** Authorized Verifier only

##### `registerNullifier(bytes32 nullifier)`
Registers a nullifier to prevent double-spending.

## Backend API Endpoints

### Base URL: `http://localhost:3000/api`

### Identity Management

#### `POST /identity/create-did`
Creates a new DID for a user.

**Request Body:**
```json
{
  "userAddress": "0x...",
  "serviceEndpoint": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "did": "did:ethr:0x...",
  "didDocument": {...}
}
```

#### `POST /identity/issue-credential`
Issues a verifiable credential.

**Request Body:**
```json
{
  "subjectDid": "did:ethr:0x...",
  "credentialType": "VotingEligibility",
  "claims": {...},
  "expirationDate": "2024-12-31T23:59:59Z"
}
```

#### `POST /identity/verify-credential`
Verifies a credential.

**Request Body:**
```json
{
  "credential": {...}
}
```

### Zero-Knowledge Proofs

#### `POST /zk/generate-proof`
Generates a zero-knowledge proof.

**Request Body:**
```json
{
  "circuitName": "voting",
  "inputs": {
    "vote": 1,
    "nullifier": "0x...",
    "secret": "0x..."
  }
}
```

#### `POST /zk/verify-proof`
Verifies a zero-knowledge proof.

**Request Body:**
```json
{
  "proof": {...},
  "publicSignals": [1, 2, 3]
}
```

### Voting Operations

#### `GET /voting/elections`
Retrieves all elections.

**Query Parameters:**
- `status`: Filter by election status (created, registration, voting, tallying, completed)
- `limit`: Number of results to return
- `offset`: Pagination offset

#### `POST /voting/register`
Registers a voter for an election.

**Request Body:**
```json
{
  "electionId": 1,
  "voterAddress": "0x...",
  "merkleProof": ["0x...", "0x..."]
}
```

#### `POST /voting/cast-vote`
Casts a vote in an election.

**Request Body:**
```json
{
  "electionId": 1,
  "commitment": "0x...",
  "zkProof": "0x..."
}
```

### Encryption Services

#### `POST /encryption/encrypt`
Encrypts data using homomorphic encryption.

**Request Body:**
```json
{
  "data": 42,
  "scheme": "paillier"
}
```

#### `POST /encryption/decrypt`
Decrypts homomorphically encrypted data.

**Request Body:**
```json
{
  "encryptedData": "0x...",
  "privateKey": "0x...",
  "scheme": "paillier"
}
```

## Client Integration

### Web3 Connection

```javascript
import { ethers } from 'ethers';

// Connect to MetaMask
const provider = new ethers.providers.Web3Provider(window.ethereum);
await provider.send("eth_requestAccounts", []);
const signer = provider.getSigner();

// Connect to contracts
const votingSystem = new ethers.Contract(
  VOTING_SYSTEM_ADDRESS,
  VOTING_SYSTEM_ABI,
  signer
);
```

### Voting Workflow

```javascript
// 1. Register voter
const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(userDid));
const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(credential));
const merkleProof = await getMerkleProof(userAddress);

await votingSystem.registerVoter(
  electionId,
  didHash,
  credentialHash,
  merkleProof
);

// 2. Generate vote commitment
const nonce = Math.floor(Math.random() * 1000000);
const commitment = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ['string', 'uint256', 'address'],
    [candidate, nonce, voterAddress]
  )
);

// 3. Generate ZK proof
const zkProof = await generateZKProof({
  vote: candidateIndex,
  nullifier: nullifier,
  secret: secret
});

// 4. Cast vote
await votingSystem.castVote(electionId, commitment, zkProof);

// 5. Reveal vote (during tallying phase)
await votingSystem.revealVote(electionId, candidate, nonce);
```

## Error Codes

### Smart Contract Errors

- `NotElectionAdmin`: Caller is not an election administrator
- `InvalidElectionState`: Operation not allowed in current election state
- `NotRegistered`: Voter is not registered for the election
- `AlreadyVoted`: Voter has already cast a vote
- `InvalidProof`: Zero-knowledge proof verification failed
- `ElectionNotFound`: Election with given ID does not exist

### API Error Codes

- `400`: Bad Request - Invalid input parameters
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Resource already exists
- `500`: Internal Server Error - Server-side error

## Rate Limits

- Identity operations: 10 requests per minute per IP
- Voting operations: 5 requests per minute per user
- Query operations: 100 requests per minute per IP

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## WebSocket Events

### Real-time Election Updates

Connect to: `ws://localhost:3000/ws/elections`

**Events:**
- `election_created`: New election created
- `voter_registered`: New voter registered
- `vote_cast`: Vote cast (anonymized)
- `election_state_changed`: Election state updated
- `results_published`: Election results published

## SDK Usage

### JavaScript SDK

```javascript
import { VotingSystemSDK } from '@blockchain-voting/sdk';

const sdk = new VotingSystemSDK({
  rpcUrl: 'http://localhost:8545',
  apiUrl: 'http://localhost:3000/api',
  contractAddresses: {
    votingSystem: '0x...',
    identityRegistry: '0x...',
    zkProofs: '0x...'
  }
});

// Initialize with wallet
await sdk.connect(provider);

// Register voter
await sdk.registerVoter(electionId, merkleProof);

// Cast vote
await sdk.castVote(electionId, candidate);
```

## Testing

### Unit Tests

Run smart contract tests:
```bash
npm run test:contracts
```

Run API tests:
```bash
npm run test:api
```

### Integration Tests

Run full integration tests:
```bash
npm run test:integration
```

## Security Considerations

1. **Private Key Management**: Never expose private keys in client-side code
2. **Rate Limiting**: Implement proper rate limiting to prevent abuse
3. **Input Validation**: Always validate and sanitize input parameters
4. **ZK Proof Verification**: Ensure all ZK proofs are properly verified
5. **Access Control**: Implement proper role-based access control
6. **Audit Trails**: Maintain comprehensive audit logs

## Support

For technical support and questions:
- GitHub Issues: [Repository Issues](https://github.com/your-repo/issues)
- Documentation: [Full Documentation](https://docs.blockchain-voting.com)
- Email: support@blockchain-voting.com
