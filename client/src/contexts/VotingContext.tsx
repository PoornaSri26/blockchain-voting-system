import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { blockchainService } from '../services/mockBlockchainService';

interface Election {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  candidates: Array<{
    id: string;
    name: string;
    party: string;
    imageUrl?: string;
  }>;
}

interface VotingContextType {
  election: Election | null;
  isRegistered: boolean;
  hasVoted: boolean;
  isLoading: boolean;
  
  // Election management
  loadElection: () => Promise<void>;
  
  // Voter registration
  registerVoter: (citizenId: string) => Promise<{ success: boolean; publicKey?: string; error?: string }>;
  checkRegistrationStatus: (citizenId: string) => Promise<boolean>;
  
  // Voting
  castVote: (candidateId: string, citizenId: string) => Promise<{ success: boolean; transactionHash?: string; error?: string }>;
  
  // Results
  getResults: () => Promise<any>;
  getBlockchainStats: () => any;
}

const VotingContext = createContext<VotingContextType | undefined>(undefined);

interface VotingProviderProps {
  children: ReactNode;
}

export const VotingProvider: React.FC<VotingProviderProps> = ({ children }) => {
  const [election, setElection] = useState<Election | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load election data on component mount
  useEffect(() => {
    loadElection();
  }, []);

  // Load election from the mock service
  const loadElection = async () => {
    setIsLoading(true);
    try {
      const config = blockchainService.getElectionStatus();
      const candidates = blockchainService.getCandidates();
      
      const electionData: Election = {
        id: '1',
        title: config.title,
        description: config.description,
        startTime: config.startTime,
        endTime: config.endTime,
        isActive: config.isActive,
        candidates: candidates
      };
      
      setElection(electionData);
    } catch (error) {
      console.error('Failed to load election:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Register voter using mock service
  const registerVoter = async (citizenId: string) => {
    setIsLoading(true);
    try {
      const result = await blockchainService.registerVoter(citizenId);
      if (result.success) {
        setIsRegistered(true);
      }
      return result;
    } catch (error) {
      console.error('Failed to register voter:', error);
      return { success: false, error: 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  // Check if voter is registered
  const checkRegistrationStatus = async (citizenId: string) => {
    try {
      const isEligible = blockchainService.validateVoterEligibility(citizenId);
      setIsRegistered(isEligible);
      return isEligible;
    } catch (error) {
      console.error('Failed to check registration status:', error);
      return false;
    }
  };

  // Cast vote using mock service
  const castVote = async (candidateId: string, citizenId: string) => {
    setIsLoading(true);
    try {
      const result = await blockchainService.castVote(candidateId, citizenId);
      if (result.success) {
        setHasVoted(true);
      }
      return result;
    } catch (error) {
      console.error('Failed to cast vote:', error);
      return { success: false, error: 'Vote casting failed' };
    } finally {
      setIsLoading(false);
    }
  };

  // Get election results
  const getResults = async () => {
    try {
      return blockchainService.getResults();
    } catch (error) {
      console.error('Failed to get election results:', error);
      return null;
    }
  };

  // Get blockchain stats
  const getBlockchainStats = () => {
    return blockchainService.getBlockchainStats();
  };

  const value: VotingContextType = {
    election,
    isRegistered,
    hasVoted,
    isLoading,
    loadElection,
    registerVoter,
    checkRegistrationStatus,
    castVote,
    getResults,
    getBlockchainStats,
  };

  return (
    <VotingContext.Provider value={value}>
      {children}
    </VotingContext.Provider>
  );
};

export const useVoting = (): VotingContextType => {
  const context = useContext(VotingContext);
  if (context === undefined) {
    throw new Error('useVoting must be used within a VotingProvider');
  }
  return context;
};
