import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { StakingPoolsFactory } from "../typechain/StakingPoolsFactory";

task("deploy-staking-pools")
    .setAction(async(taskArgs, { ethers }) => {
        const stakingPoolsFactory = await ethers.getContractFactory("StakingPools") as StakingPoolsFactory;
        const stakingPools = await stakingPoolsFactory.deploy();

        console.log(`staking pools deployed: ${stakingPools.address}`);
});

task("initialize-staking-pools")
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