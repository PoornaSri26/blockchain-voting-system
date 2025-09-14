const { ethers } = require('hardhat');

async function main() {
  console.log('Starting deployment of Blockchain Voting System contracts...');

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Deploy ZKVotingProofs contract first
  console.log('\n1. Deploying ZKVotingProofs contract...');
  const ZKVotingProofs = await ethers.getContractFactory('ZKVotingProofs');
  const zkProofs = await ZKVotingProofs.deploy();
  await zkProofs.deployed();
  console.log('ZKVotingProofs deployed to:', zkProofs.address);

  // Deploy IdentityRegistry contract
  console.log('\n2. Deploying IdentityRegistry contract...');
  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.deployed();
  console.log('IdentityRegistry deployed to:', identityRegistry.address);

  // Deploy VotingSystem contract
  console.log('\n3. Deploying VotingSystem contract...');
  const VotingSystem = await ethers.getContractFactory('VotingSystem');
  const votingSystem = await VotingSystem.deploy();
  await votingSystem.deployed();
  console.log('VotingSystem deployed to:', votingSystem.address);

  // Set up initial permissions and configurations
  console.log('\n4. Setting up initial permissions...');

  // Add deployer as trusted issuer in IdentityRegistry
  await identityRegistry.addTrustedIssuer(deployer.address);
  console.log('Added deployer as trusted issuer');

  // Add VotingSystem as authorized verifier in ZKVotingProofs
  await zkProofs.addAuthorizedVerifier(votingSystem.address);
  console.log('Added VotingSystem as authorized verifier');

  // Grant ELECTION_ADMIN_ROLE to deployer in VotingSystem
  const ELECTION_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('ELECTION_ADMIN_ROLE'));
  await votingSystem.grantRole(ELECTION_ADMIN_ROLE, deployer.address);
  console.log('Granted ELECTION_ADMIN_ROLE to deployer');

  // Save deployment information
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      ZKVotingProofs: zkProofs.address,
      IdentityRegistry: identityRegistry.address,
      VotingSystem: votingSystem.address
    },
    deploymentTime: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  console.log('\n5. Deployment Summary:');
  console.log('='.repeat(50));
  console.log('Network:', deploymentInfo.network.name, `(Chain ID: ${deploymentInfo.network.chainId})`);
  console.log('Deployer:', deploymentInfo.deployer);
  console.log('Block Number:', deploymentInfo.blockNumber);
  console.log('Deployment Time:', deploymentInfo.deploymentTime);
  console.log('\nContract Addresses:');
  console.log('- ZKVotingProofs:', deploymentInfo.contracts.ZKVotingProofs);
  console.log('- IdentityRegistry:', deploymentInfo.contracts.IdentityRegistry);
  console.log('- VotingSystem:', deploymentInfo.contracts.VotingSystem);

  // Save deployment info to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `deployment-${deploymentInfo.network.name}-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log('\nDeployment info saved to:', deploymentFile);

  // Generate client configuration
  const clientConfig = {
    contracts: {
      [deploymentInfo.network.name]: {
        votingSystem: deploymentInfo.contracts.VotingSystem,
        identityRegistry: deploymentInfo.contracts.IdentityRegistry,
        zkProofs: deploymentInfo.contracts.ZKVotingProofs
      }
    },
    network: {
      name: deploymentInfo.network.name,
      chainId: deploymentInfo.network.chainId
    }
  };

  const clientConfigFile = path.join(__dirname, '..', 'client', 'src', 'config', 'contracts.json');
  const clientConfigDir = path.dirname(clientConfigFile);
  if (!fs.existsSync(clientConfigDir)) {
    fs.mkdirSync(clientConfigDir, { recursive: true });
  }
  
  fs.writeFileSync(clientConfigFile, JSON.stringify(clientConfig, null, 2));
  console.log('Client configuration saved to:', clientConfigFile);

  console.log('\n✅ Deployment completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Update your .env file with the contract addresses');
  console.log('2. Verify contracts on Etherscan (if on public network)');
  console.log('3. Start the backend server and client application');
  console.log('4. Test the complete voting workflow');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
