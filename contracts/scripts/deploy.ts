import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC");

  // Deploy FamilyRegistry
  const FamilyRegistry = await ethers.getContractFactory("FamilyRegistry");
  const registry = await FamilyRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("FamilyRegistry deployed to:", registryAddress);

  // Deploy PostApprovalQueue
  const PostApprovalQueue = await ethers.getContractFactory("PostApprovalQueue");
  const queue = await PostApprovalQueue.deploy(deployer.address, registryAddress);
  await queue.waitForDeployment();
  const queueAddress = await queue.getAddress();
  console.log("PostApprovalQueue deployed to:", queueAddress);

  console.log("\n--- Add to .env ---");
  console.log("VITE_CONTRACT_FAMILY_REGISTRY=" + registryAddress);
  console.log("VITE_CONTRACT_POST_APPROVAL=" + queueAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
