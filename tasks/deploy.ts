import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { RewardEscrow } from "../typechain/RewardEscrow";
import { RewardEscrowFactory } from "../typechain/RewardEscrowFactory";
import { StakingPoolsFactory } from "../typechain/StakingPoolsFactory";

task("deploy-staking-pools", "Deploy the staking pools contract (no proxy)")
    .setAction(async(taskArgs, { ethers }) => {
        const stakingPoolsFactory = await ethers.getContractFactory("StakingPools") as StakingPoolsFactory;
        const stakingPools = await stakingPoolsFactory.deploy();

        console.log(`staking pools deployed: ${stakingPools.address}`);
});

task("initialize-staking-pools", "Initialize an unintialized deployed staking pool")
    .addParam("stakingPools", "address of the contract to initialize")
    .addParam("reward", "address of the reward token")
    .addParam("rewardSource", "address where the rewards come from")
    .addParam("exitFeeReceiver", "address receiving the exit fees")
    .addParam("rewardEscrow", "address of the reward escrow address")
    .addParam("governance", "address of the governance")
    .setAction(async(taskArgs, {ethers}) => {
        const stakingPoolsFactory = await ethers.getContractFactory("StakingPools") as StakingPoolsFactory;
        const stakingPools = stakingPoolsFactory.attach(taskArgs.stakingPools);

        const tx = await stakingPools.initialize(
            taskArgs.reward,
            taskArgs.rewardSource,
            taskArgs.exitFeeReceiver,
            taskArgs.rewardEscrow,
            taskArgs.governance
        );

        console.log(`Contract initialized at ${tx.hash}`)
});

task("deploy-reward-escrow", "Deploy the dough escrow contract")
    .addParam("dough", "address of the DOUGH token")
    .setAction(async(taskArgs, {ethers}) => {
        const rewardEscrowFactory = await ethers.getContractFactory("RewardEscrow") as RewardEscrowFactory;

        const rewardEscrow = await rewardEscrowFactory.deploy() as RewardEscrow;

        const tx = await rewardEscrow["initialize(address,string,string)"](
            taskArgs.dough,
            "eDOUGH",
            "eDOUGH"
        );

        console.log(`Intialised at: ${tx.hash}`);
});

task("upgrade-reward-escrow", "Upgrade the dough escrow contract")
    .addParam("rewardProxy")
    .setAction(async(taskArgs, {ethers}) => {
        const rewardEscrowFactory = await ethers.getContractFactory("RewardEscrow") as RewardEscrowFactory;
        const rewardEscrow = await rewardEscrowFactory.deploy() as RewardEscrow;
        console.log(`deployed at: ${rewardEscrow.address}`)
    });