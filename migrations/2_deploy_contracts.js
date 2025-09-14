const VotingSystem = artifacts.require("VotingSystem");
const IdentityRegistry = artifacts.require("IdentityRegistry");
const ZKVotingProofs = artifacts.require("ZKVotingProofs");

module.exports = async function (deployer, network, accounts) {
  // Deploy ZK Voting Proofs contract first
  await deployer.deploy(ZKVotingProofs);
  const zkProofs = await ZKVotingProofs.deployed();

  // Deploy Identity Registry
  await deployer.deploy(IdentityRegistry);
  const identityRegistry = await IdentityRegistry.deployed();

  // Deploy main Voting System contract
  await deployer.deploy(VotingSystem);
  const votingSystem = await VotingSystem.deployed();

  // Set up initial configuration
  console.log("Setting up initial configuration...");
  
  // Add deployer as trusted issuer in Identity Registry
  await identityRegistry.addTrustedIssuer(accounts[0]);
  
  // Add voting system as authorized verifier in ZK Proofs
  await zkProofs.addAuthorizedVerifier(votingSystem.address);
  
  console.log("Contracts deployed successfully:");
  console.log("VotingSystem:", votingSystem.address);
  console.log("IdentityRegistry:", identityRegistry.address);
  console.log("ZKVotingProofs:", zkProofs.address);
};
