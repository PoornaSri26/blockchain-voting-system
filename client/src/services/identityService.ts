import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

interface DIDResult {
  did: string;
  controllerKeyId: string;
}

interface CredentialData {
  jurisdiction: string;
  voterRegistrationNumber: string;
  registrationDate: string;
  expirationDate: string;
}

interface VoterCredential {
  did: string;
  credential: string;
  isValid: boolean;
}

class IdentityService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // DID Management
  async createDID(userAddress: string, alias?: string): Promise<DIDResult> {
    try {
      const response = await this.apiClient.post('/identity/create-did', {
        userAddress,
        alias: alias || `voter_${userAddress.slice(-8)}`,
      });

      if (response.data.success) {
        return {
          did: response.data.did,
          controllerKeyId: response.data.controllerKeyId,
        };
      } else {
        throw new Error(response.data.error || 'Failed to create DID');
      }
    } catch (error) {
      console.error('Failed to create DID:', error);
      throw new Error('Failed to create decentralized identity');
    }
  }

  // Credential Management
  async issueVotingCredential(subjectDID: string, voterData: CredentialData): Promise<any> {
    try {
      const response = await this.apiClient.post('/identity/issue-credential', {
        issuerDID: process.env.REACT_APP_ISSUER_DID || 'did:ethr:0x123...', // Default issuer
        subjectDID,
        voterData,
      });

      if (response.data.success) {
        // Store credential locally for future use
        const credential = response.data.credential;
        localStorage.setItem(`voter_credential_${subjectDID}`, JSON.stringify({
          did: subjectDID,
          credential: credential,
          isValid: true,
          issuedAt: new Date().toISOString(),
        }));

        return credential;
      } else {
        throw new Error(response.data.error || 'Failed to issue credential');
      }
    } catch (error) {
      console.error('Failed to issue voting credential:', error);
      throw new Error('Failed to issue voting credential');
    }
  }

  async verifyCredential(credential: string): Promise<{ verified: boolean; error?: string }> {
    try {
      const response = await this.apiClient.post('/identity/verify-credential', {
        credential,
      });

      return {
        verified: response.data.verified,
        error: response.data.error,
      };
    } catch (error) {
      console.error('Failed to verify credential:', error);
      return {
        verified: false,
        error: 'Failed to verify credential',
      };
    }
  }

  async createPresentation(
    holderDID: string,
    credentials: string[],
    challenge: string,
    domain: string
  ): Promise<string> {
    try {
      const response = await this.apiClient.post('/identity/create-presentation', {
        holderDID,
        credentials,
        challenge,
        domain,
      });

      if (response.data.success) {
        return response.data.presentation;
      } else {
        throw new Error(response.data.error || 'Failed to create presentation');
      }
    } catch (error) {
      console.error('Failed to create presentation:', error);
      throw new Error('Failed to create verifiable presentation');
    }
  }

  // Zero-Knowledge Proof Generation
  async generateEligibilityProof(voterCredential: VoterCredential, electionId: string): Promise<any> {
    try {
      const voterData = {
        secret: this.generateVoterSecret(voterCredential.did),
        voterID: voterCredential.did,
        citizenship: 'US', // This would come from the credential
        age: 25, // This would come from the credential
        jurisdiction: 'Default',
      };

      const response = await this.apiClient.post('/zk/generate-eligibility-proof', {
        voterData,
        electionId,
      });

      if (response.data.success) {
        return response.data.proof;
      } else {
        throw new Error(response.data.error || 'Failed to generate eligibility proof');
      }
    } catch (error) {
      console.error('Failed to generate eligibility proof:', error);
      throw new Error('Failed to generate eligibility proof');
    }
  }

  async generateVoteProof(
    voterCredential: VoterCredential,
    candidate: string,
    electionId: string
  ): Promise<any> {
    try {
      const voterSecret = this.generateVoterSecret(voterCredential.did);
      
      const voteData = {
        candidate,
        merkleRoot: '0x123...', // This would come from the election contract
        merkleProof: [], // This would be generated based on voter eligibility
        merkleIndex: 0,
      };

      const response = await this.apiClient.post('/zk/generate-vote-proof', {
        voteData,
        voterSecret,
        electionId,
      });

      if (response.data.success) {
        return response.data.proof;
      } else {
        throw new Error(response.data.error || 'Failed to generate vote proof');
      }
    } catch (error) {
      console.error('Failed to generate vote proof:', error);
      throw new Error('Failed to generate anonymous vote proof');
    }
  }

  async verifyZKProof(circuitName: string, proof: any, publicSignals: any[]): Promise<boolean> {
    try {
      const response = await this.apiClient.post('/zk/verify-proof', {
        circuitName,
        proof,
        publicSignals,
      });

      return response.data.success && response.data.valid;
    } catch (error) {
      console.error('Failed to verify ZK proof:', error);
      return false;
    }
  }

  // Utility Functions
  private generateVoterSecret(did: string): string {
    // In a real implementation, this would be derived from the user's private key
    // For demo purposes, we'll use a deterministic hash
    const crypto = require('crypto-js');
    return crypto.SHA256(did + 'voter_secret_salt').toString();
  }

  // Local Storage Management
  getStoredCredential(userAddress: string): VoterCredential | null {
    try {
      const stored = localStorage.getItem(`voter_credential_${userAddress}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to get stored credential:', error);
    }
    return null;
  }

  storeCredential(userAddress: string, credential: VoterCredential): void {
    try {
      localStorage.setItem(`voter_credential_${userAddress}`, JSON.stringify(credential));
    } catch (error) {
      console.error('Failed to store credential:', error);
    }
  }

  removeStoredCredential(userAddress: string): void {
    try {
      localStorage.removeItem(`voter_credential_${userAddress}`);
    } catch (error) {
      console.error('Failed to remove stored credential:', error);
    }
  }

  // Biometric Integration (placeholder for future implementation)
  async captureBiometric(): Promise<string> {
    // This would integrate with WebAuthn or other biometric APIs
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('mock_biometric_hash_' + Date.now());
      }, 1000);
    });
  }

  async verifyBiometric(storedHash: string, currentHash: string): Promise<boolean> {
    // This would perform actual biometric verification
    return storedHash === currentHash;
  }

  // QR Code Generation for Verification
  generateVerificationQR(credential: VoterCredential): string {
    const verificationData = {
      did: credential.did,
      credentialHash: this.hashCredential(credential.credential),
      timestamp: Date.now(),
    };

    return JSON.stringify(verificationData);
  }

  private hashCredential(credential: string): string {
    const crypto = require('crypto-js');
    return crypto.SHA256(credential).toString();
  }

  // Selective Disclosure
  async createSelectiveDisclosure(
    credential: string,
    fieldsToDisclose: string[]
  ): Promise<string> {
    try {
      // This would create a presentation with only the specified fields
      // For now, return the full credential
      return credential;
    } catch (error) {
      console.error('Failed to create selective disclosure:', error);
      throw new Error('Failed to create selective disclosure');
    }
  }
}

export const identityService = new IdentityService();
