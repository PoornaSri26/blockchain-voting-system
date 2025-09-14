import React from 'react';
import GovernmentVotingInterface from './components/GovernmentVotingInterface';
import { Toaster } from './components/ui/toaster';

const App: React.FC = () => {
  return (
    <div className="min-h-screen">
      <GovernmentVotingInterface />
      <Toaster />
    </div>
  );
};

export default App;
