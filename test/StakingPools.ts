import chai from "chai";
import chaiSubset from "chai-subset";
import {solidity} from "ethereum-waffle";
import {ethers} from "hardhat";
import {BigNumber, BigNumberish, ContractFactory, Signer, constants, providers} from "ethers";

import {StakingPools} from "../typechain/StakingPools";
import {Erc20Mock} from "../typechain/Erc20Mock";
import {RewardEscrow} from "../typechain/RewardEscrow";
import {RewardEscrowFactory} from "../typechain/RewardEscrowFactory";
import {StakingPoolsFactory} from "../typechain/StakingPoolsFactory";
import { formatEther, parseEther } from "ethers/lib/utils";

const mineBlocks = async (
    provider: providers.JsonRpcProvider,
    numberBlocks: number
  ): Promise<any> => {
    for (let i = 0; i < numberBlocks; i++) {
      await provider.send("evm_mine", []);
    }
    return Promise.resolve();
};


const MAXIMUM_U256 = constants.MaxUint256;
const ZERO_ADDRESS = constants.AddressZero;

chai.use(solidity);
chai.use(chaiSubset);

const {expect} = chai;

let stakingPoolsFactory: StakingPoolsFactory;
let ERC20MockFactory: ContractFactory;
let rewardEscrowFactory: RewardEscrowFactory;

describe.only("StakingPools", () => {
  let deployer: Signer;
  let governance: Signer;
  let exitFeeReceiver: Signer;
  let newGovernance: Signer;
  let rewardsSource: Signer;
  let signers: Signer[];

  let pools: StakingPools;
  let reward: Erc20Mock;
  let rewardEscrow: RewardEscrow;
  let rewardRate = 5000;
  

  before(async () => {
    stakingPoolsFactory = await ethers.getContractFactory("StakingPools") as StakingPoolsFactory;
    ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    rewardEscrowFactory = await ethers.getContractFactory("RewardEscrow") as RewardEscrowFactory;
  });

  beforeEach(async () => {
    [deployer, governance, exitFeeReceiver, newGovernance, rewardsSource, ...signers] = await ethers.getSigners();

    reward = (await ERC20MockFactory.connect(deployer).deploy(
      "Test Token",
      "TEST",
      18
    )) as Erc20Mock;
    
    await reward.mint(await rewardsSource.getAddress(), parseEther("100000000"));

    rewardEscrow = (await rewardEscrowFactory.connect(deployer).deploy());

    await rewardEscrow["initialize(address,string,string)"](reward.address, "eDOUGH", "eDOUGH");

    pools = (await stakingPoolsFactory.connect(deployer).deploy()) as StakingPools;
    await pools.initialize(
      reward.address,
      await rewardsSource.getAddress(),
      await exitFeeReceiver.getAddress(),
      rewardEscrow.address,
      await governance.getAddress()
    );

    await reward.connect(rewardsSource).approve(pools.address, constants.MaxUint256);
  });

  describe("initialize", () => {
    let stakingPools: StakingPools;

    beforeEach(async() => {
      stakingPools = await stakingPoolsFactory.deploy();
    });

    it("Initializing twice should fail", async() => {
      await stakingPools.initialize(
        reward.address,
        await rewardsSource.getAddress(),
        await exitFeeReceiver.getAddress(),
        rewardEscrow.address,
        await governance.getAddress()
      );

      await expect(stakingPools.initialize(
        constants.AddressZero,
        await rewardsSource.getAddress(),
        await exitFeeReceiver.getAddress(),
        rewardEscrow.address,
        await governance.getAddress()
      )).to.be.revertedWith("StakingPools: already initialized");
    });

    it("Initializing with zero address as reward token should fail", async() => {
      await expect(stakingPools.initialize(
        constants.AddressZero,
        await rewardsSource.getAddress(),
        await exitFeeReceiver.getAddress(),
        rewardEscrow.address,
        await governance.getAddress()
      )).to.be.revertedWith("StakingPools: reward address cannot be 0x0");
    });

    it("Initializing with zero address as reward source should fail", async() => {
      await expect(stakingPools.initialize(
        reward.address,
        constants.AddressZero,
        await exitFeeReceiver.getAddress(),
        rewardEscrow.address,
        await governance.getAddress()
      )).to.be.revertedWith("StakingPools: reward source address cannot be 0x0");
    });

    it("Initializing with zero address as exit fee receiver should fail", async() => {
      await expect(stakingPools.initialize(
        reward.address,
        await rewardsSource.getAddress(),
        constants.AddressZero,
        rewardEscrow.address,
        await governance.getAddress()
      )).to.be.revertedWith("StakingPools: exit fee receiver cannot be 0x0");
    });

    it("Initializing with zero address as reward escrow should fail", async() => {
      await expect(stakingPools.initialize(
        reward.address,
        await rewardsSource.getAddress(),
        await exitFeeReceiver.getAddress(),
        constants.AddressZero,
        await governance.getAddress()
      )).to.be.revertedWith("StakingPools: reward escrow cannot be 0x0");
    });

    it("Initializing with zero address as governance should fail", async() => {
      await expect(stakingPools.initialize(
        reward.address,
        await rewardsSource.getAddress(),
        await exitFeeReceiver.getAddress(),
        rewardEscrow.address,
        constants.AddressZero
      )).to.be.revertedWith("StakingPools: governance address cannot be 0x0");
    });
  });

  describe("set governance", () => {
    it("only allows governance", async () => {
      expect(pools.setPendingGovernance(await newGovernance.getAddress())).revertedWith(
        "StakingPools: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => {
        pools = pools.connect(governance);
      });

      it("prevents getting stuck", async () => {
        expect(pools.setPendingGovernance(ZERO_ADDRESS)).revertedWith(
          "StakingPools: pending governance address cannot be 0x0"
        );
      });

      it("sets the pending governance", async () => {
        await pools.setPendingGovernance(await newGovernance.getAddress());
        expect(await pools.governance()).equal(await governance.getAddress());
      });

      it("updates governance upon acceptance", async () => {
        await pools.setPendingGovernance(await newGovernance.getAddress());
        await pools.connect(newGovernance).acceptGovernance()
        expect(await pools.governance()).equal(await newGovernance.getAddress());
      });

      it("reverts on governace acceptance from wrong address", async() => {
        await pools.setPendingGovernance(await newGovernance.getAddress());
        await expect(pools.acceptGovernance()).to.be.revertedWith("StakingPools: only pending governance");
      });

      it("emits GovernanceUpdated event", async () => {
        await pools.setPendingGovernance(await newGovernance.getAddress());
        expect(pools.connect(newGovernance).acceptGovernance())
          .emit(pools, "GovernanceUpdated")
          .withArgs(await newGovernance.getAddress());
      });
    });
  });

  describe("set reward rate", () => {
    let newRewardRate: BigNumberish = 100000;

    it("only allows governance to call", async () => {
      expect(pools.setRewardRate(newRewardRate)).revertedWith(
        "StakingPools: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => (pools = pools.connect(governance)));

      it("updates reward rate", async () => {
        await pools.setRewardRate(newRewardRate);
        expect(await pools.rewardRate()).equal(newRewardRate);
      });

      it("emits RewardRateUpdated event", async () => {
        expect(pools.setRewardRate(newRewardRate))
          .emit(pools, "RewardRateUpdated")
          .withArgs(newRewardRate);
      });
    });
  });

  describe("Setting the exit fee receiver", async() => {
    it("Only governance can call", async() => {
      await expect(pools.setExitFeeReceiver(await signers[0].getAddress())).to.be.revertedWith("StakingPools: only governance");
    });

    context("when caller is governance", async () => {
      beforeEach(async () => (pools = pools.connect(governance)));

      it("Setting the exit fee receiver to the 0x0 address should fail", async() => {
        await expect(pools.setExitFeeReceiver(constants.AddressZero)).to.be.revertedWith("StakingPools: exit fee receiver address cannot be 0x0");
      });

      it("Setting the exit fee receiver", async() => {
        const newReceiver = await signers[0].getAddress();
        await pools.setExitFeeReceiver(newReceiver);
        const actualReceiver = await pools.exitFeeReceiver();

        expect(actualReceiver).to.eq(newReceiver);
      });
    });
  });

  describe("create pool", () => {
    let token: Erc20Mock;

    beforeEach(async () => {
      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;
    });

    it("only allows governance to call", async () => {
      expect(pools.createPool(token.address)).revertedWith(
        "StakingPools: only governance"
      );
    });

    context("when caller is governance", async () => {
      beforeEach(async () => (pools = pools.connect(governance)));

      it("emits PoolCreated event", async () => {
        expect(pools.createPool(token.address))
          .emit(pools, "PoolCreated")
          .withArgs(0, token.address);
      });

      it("Adding multiple pools", async() => {
        const token2 = (await ERC20MockFactory.connect(deployer).deploy(
          "Staking Token",
          "STAKE",
          18
        )) as Erc20Mock;

        const token3 = (await ERC20MockFactory.connect(deployer).deploy(
          "Staking Token",
          "STAKE",
          18
        )) as Erc20Mock;
        
        await pools.createPool(token.address);
        const poolCountBefore = await pools.poolCount();
        await pools.createPool(token2.address);
        await pools.createPool(token3.address);
        const poolCountAfter = await pools.poolCount();

        const pool1Token = await pools.getPoolToken(0);
        const pool2Token = await pools.getPoolToken(1);
        const pool3Token = await pools.getPoolToken(2);
        
        expect(poolCountAfter).to.eq(poolCountBefore.add(2));
        expect(pool1Token).to.eq(token.address);
        expect(pool2Token).to.eq(token2.address);
        expect(pool3Token).to.eq(token3.address);
      });

      context("when reusing token", async () => {
        it("reverts", async () => {
          await pools.createPool(token.address);
          expect(pools.createPool(token.address)).revertedWith("StakingPools: token already has a pool");
        });
      });
    });
  });

  describe("set pool reward weights", () => {
    it("only allows governance to call", async () => {
      expect(pools.setRewardRate([1])).revertedWith(
        "StakingPools: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => (pools = pools.connect(governance)));

      const shouldBehaveLikeSetRewardWeights = (
        rewardWeights: BigNumberish[]
      ) => {
        beforeEach(async () => {
          await pools.setRewardWeights(rewardWeights);
        });

        it("updates the total reward weight", async () => {
          const totalWeight = rewardWeights
            .map((value) => BigNumber.from(value))
            .reduce((acc, value) => acc.add(value), BigNumber.from(0));

          expect(await pools.totalRewardWeight()).equal(totalWeight);
        });

        it("updates the reward weights", async () => {
          for (let poolId = 0; poolId < rewardWeights.length; poolId++) {
            expect(await pools.getPoolRewardWeight(poolId)).equal(rewardWeights[poolId]);
          }
        });

        it("updating the reward weights with the same values should leave them unchanged", async() => {
          await pools.setRewardWeights(rewardWeights);
          
          for (let poolId = 0; poolId < rewardWeights.length; poolId++) {
            expect(await pools.getPoolRewardWeight(poolId)).equal(rewardWeights[poolId]);
          }
        });
        
      };

      it("getting the reward rate per pool should be correct", async() => {
        const tokenFactory = await ERC20MockFactory.connect(deployer)
        
        const token1 = await tokenFactory.deploy(
          "Staking Token",
          "STAKE",
          18
        ) as Erc20Mock;
        await pools.createPool(token1.address);
  
        const token2 = await tokenFactory.deploy(
          "Staking Token",
          "STAKE",
          18
        ) as Erc20Mock;
        await pools.createPool(token2.address);

        const totalRewardRate = parseEther("1");

        await pools.setRewardRate(totalRewardRate);
        await pools.setRewardWeights([1, 1]);
  
        const poolRewardRate = await pools.getPoolRewardRate(0);

        expect(poolRewardRate).to.eq(totalRewardRate.div(2));
      });

      it("reverts when weight array length mismatches", () => {
        expect(pools.setRewardWeights([1])).revertedWith(
          "StakingPools: weights length mismatch"
        );
      });

      context("with one pool", async () => {
        let token: Erc20Mock;

        beforeEach(async () => {
          token = (await ERC20MockFactory.connect(deployer).deploy(
            "Staking Token",
            "STAKE",
            18
          )) as Erc20Mock;
        });

        beforeEach(async () => {
          await pools.connect(governance).createPool(token.address);
        });

        shouldBehaveLikeSetRewardWeights([10000]);
      });

      context("with many pools", async () => {
        let numberPools = 5;
        let tokens: Erc20Mock[];

        beforeEach(async () => {
          tokens = new Array<Erc20Mock>();
          for (let i = 0; i < numberPools; i++) {
            tokens.push(
              (await ERC20MockFactory.connect(deployer).deploy(
                "Staking Token",
                "STAKE",
                18
              )) as Erc20Mock
            );
          }
        });

        beforeEach(async () => {
          for (let n = 0; n < numberPools; n++) {
            await pools
              .connect(governance)
              .createPool(tokens[n].address);
          }
        });

        shouldBehaveLikeSetRewardWeights([
          10000,
          20000,
          30000,
          40000,
          50000,
        ]);
      });
    });
  });

  describe("set pool escrow percentages", () => {
    it("only allows governance to call", async () => {
      expect(pools.setEscrowPercentages([1])).revertedWith(
        "StakingPools: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => (pools = pools.connect(governance)));

      const shouldBehaveLikeSetEscrowPercentages = (
        escrowPercentages: BigNumberish[]
      ) => {
        beforeEach(async () => {
          await pools.setEscrowPercentages(escrowPercentages);
        });

        it("updates the escrow percentages", async () => {
          for (let poolId = 0; poolId < escrowPercentages.length; poolId++) {
            expect(await pools.getPoolEscrowPercentage(poolId)).equal(escrowPercentages[poolId]);
          }
        });

        it("updating the escrow percentages with the same values should leave them unchanged", async() => {
          await pools.setEscrowPercentages(escrowPercentages);
          
          for (let poolId = 0; poolId < escrowPercentages.length; poolId++) {
            expect(await pools.getPoolEscrowPercentage(poolId)).equal(escrowPercentages[poolId]);
          }
        });
        
      };

      it("reverts when escrow percentages array length mismatches", () => {
        expect(pools.setEscrowPercentages([1])).revertedWith(
          "StakingPools: escrow percentages length mismatch"
        );
      });


      context("with one pool", async () => {
        let token: Erc20Mock;

        beforeEach(async () => {
          token = (await ERC20MockFactory.connect(deployer).deploy(
            "Staking Token",
            "STAKE",
            18
          )) as Erc20Mock;
        });

        beforeEach(async () => {
          await pools.connect(governance).createPool(token.address);
        });

        it("setting an escrow percentage above 100% (1e18) should fail", async() => {
          await expect(pools.connect(governance).setEscrowPercentages([parseEther("1.1")])).to.be.revertedWith("escrow percentage should be 100% max");
        });

        shouldBehaveLikeSetEscrowPercentages([10000]);
      });

      context("with many pools", async () => {
        let numberPools = 5;
        let tokens: Erc20Mock[];

        beforeEach(async () => {
          tokens = new Array<Erc20Mock>();
          for (let i = 0; i < numberPools; i++) {
            tokens.push(
              (await ERC20MockFactory.connect(deployer).deploy(
                "Staking Token",
                "STAKE",
                18
              )) as Erc20Mock
            );
          }
        });

        beforeEach(async () => {
          for (let n = 0; n < numberPools; n++) {
            await pools
              .connect(governance)
              .createPool(tokens[n].address);
          }
        });

        shouldBehaveLikeSetEscrowPercentages([
          10000,
          20000,
          30000,
          40000,
          50000,
        ]);
      });
    });
  });

  describe("set pool exit fee percentages", () => {
    it("only allows governance to call", async () => {
      expect(pools.setExitFeePercentages([1])).revertedWith(
        "StakingPools: only governance"
      );
    });

    context("when caller is governance", () => {
      beforeEach(async () => (pools = pools.connect(governance)));

      const shouldBehaveLikeSetExitFeePercentages = (
        exitFeePercentages: BigNumberish[]
      ) => {
        beforeEach(async () => {
          await pools.setExitFeePercentages(exitFeePercentages);
        });

        it("updates the exit fee percentages", async () => {
          for (let poolId = 0; poolId < exitFeePercentages.length; poolId++) {
            expect(await pools.getPoolExitFeePercentage(poolId)).equal(exitFeePercentages[poolId]);
          }
        });

        it("updating the exit fee percentages with the same values should leave them unchanged", async() => {
          await pools.setExitFeePercentages(exitFeePercentages);
          
          for (let poolId = 0; poolId < exitFeePercentages.length; poolId++) {
            expect(await pools.getPoolExitFeePercentage(poolId)).equal(exitFeePercentages[poolId]);
          }
        });
        
      };

      it("reverts when exit fee percentages array length mismatches", () => {
        expect(pools.setExitFeePercentages([1])).revertedWith(
          "StakingPools: exit fee percentages length mismatch"
        );
      });


      context("with one pool", async () => {
        let token: Erc20Mock;

        beforeEach(async () => {
          token = (await ERC20MockFactory.connect(deployer).deploy(
            "Staking Token",
            "STAKE",
            18
          )) as Erc20Mock;
        });

        beforeEach(async () => {
          await pools.connect(governance).createPool(token.address);
        });

        it("setting an exit fee percentage above 100% (1e18) should fail", async() => {
          await expect(pools.connect(governance).setExitFeePercentages([parseEther("1.1")])).to.be.revertedWith("StakingPools: exit fee percentage should be 100% max");
        });

        shouldBehaveLikeSetExitFeePercentages([10000]);
      });

      context("with many pools", async () => {
        let numberPools = 5;
        let tokens: Erc20Mock[];

        beforeEach(async () => {
          tokens = new Array<Erc20Mock>();
          for (let i = 0; i < numberPools; i++) {
            tokens.push(
              (await ERC20MockFactory.connect(deployer).deploy(
                "Staking Token",
                "STAKE",
                18
              )) as Erc20Mock
            );
          }
        });

        beforeEach(async () => {
          for (let n = 0; n < numberPools; n++) {
            await pools
              .connect(governance)
              .createPool(tokens[n].address);
          }
        });

        shouldBehaveLikeSetExitFeePercentages([
          10000,
          20000,
          30000,
          40000,
          50000,
        ]);
      });
    });
  });


  describe("deposit tokens", () => {
    let depositor: Signer;
    let token: Erc20Mock;

    beforeEach(async () => {
      [depositor, ...signers] = signers;
      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;
      await pools.connect(governance).createPool(token.address);
      await pools.connect(governance).setRewardWeights([1]);
    });

    const shouldBehaveLikeDeposit = (
      poolId: BigNumberish,
      amount: BigNumberish
    ) => {
      let startingTokenBalance: BigNumber;
      let startingTotalDeposited: BigNumber;
      let startingDeposited: BigNumber;

      beforeEach(async () => {
        startingTokenBalance = await token.balanceOf(await depositor.getAddress());
        startingTotalDeposited = await pools.getPoolTotalDeposited(0);
        startingDeposited = await pools.getStakeTotalDeposited(await depositor.getAddress(), 0);

        await token.approve(pools.address, amount);
        await pools.deposit(poolId, amount);
      });

      it("increments total deposited amount", async () => {
        expect(await pools.getPoolTotalDeposited(0))
          .equal(startingTotalDeposited.add(amount));
      });

      it("increments deposited amount", async () => {
        expect(await pools.getStakeTotalDeposited(await depositor.getAddress(), 0))
          .equal(startingDeposited.add(amount));
      });

      it("transfers deposited tokens", async () => {
        expect(await token.balanceOf(await depositor.getAddress()))
          .equal(startingTokenBalance.sub(amount));
      });
    };

    context("with no previous deposits", async () => {
      let depositAmount = 50000;

      beforeEach(async () => (pools = pools.connect(depositor)));
      beforeEach(async () => (token = token.connect(depositor)));

      beforeEach(async () => {
        await token.mint(await depositor.getAddress(), depositAmount);
      });

      shouldBehaveLikeDeposit(0, depositAmount);

      it("does not reward tokens", async () => {
        expect(await pools.getStakeTotalUnclaimed(await depositor.getAddress(), 0))
          .equal(0);
      });
    });

    context("with previous deposits", async () => {
      let initialDepositAmount = 50000;
      let depositAmount = 100000;

      beforeEach(async () => (pools = pools.connect(depositor)));
      beforeEach(async () => (token = token.connect(depositor)));

      beforeEach(async () => {
        await token.mint(
          await depositor.getAddress(),
          initialDepositAmount + depositAmount
        );
        await token.approve(pools.address, initialDepositAmount);
        await pools.deposit(0, initialDepositAmount);
      });

      shouldBehaveLikeDeposit(0, depositAmount);
    });
  });

  describe("withdraw tokens", () => {
    let depositor: Signer;
    let token: Erc20Mock;

    beforeEach(async () => {
      [depositor, ...signers] = signers;
      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;

      await pools.connect(governance).createPool(token.address);
      await pools.connect(governance).setRewardWeights([1]);
    });

    const shouldBehaveLikeWithdraw = (
      poolId: BigNumberish,
      amount: BigNumberish
    ) => {
      let startingTokenBalance: BigNumber;
      let startingTotalDeposited: BigNumber;
      let startingDeposited: BigNumber;

      beforeEach(async () => {
        startingTokenBalance = await token.balanceOf(await depositor.getAddress());
        startingTotalDeposited = await pools.getPoolTotalDeposited(0);
        startingDeposited = await pools.getStakeTotalDeposited(await depositor.getAddress(), 0);
      });

      beforeEach(async () => {
        await pools.withdraw(poolId, amount);
      });

      it("decrements total deposited amount", async () => {
        expect(await pools.getPoolTotalDeposited(0))
          .equal(startingTotalDeposited.sub(amount));
      });

      it("decrements deposited amount", async () => {
        expect(await pools.getStakeTotalDeposited(await depositor.getAddress(), 0))
          .equal(startingDeposited.sub(amount));
      });

      it("transfers deposited tokens", async () => {
        expect(await token.balanceOf(await depositor.getAddress())).equal(
          startingTokenBalance.add(amount)
        );
      });
    };

    context("with previous deposits", async () => {
      let depositAmount = 50000;
      let withdrawAmount = 25000;

      beforeEach(async () => {
        token = token.connect(depositor)
        await token.connect(deployer).mint(await depositor.getAddress(), MAXIMUM_U256.sub(depositAmount));
        await token.connect(depositor).approve(pools.address, MAXIMUM_U256);
        await token.mint(await depositor.getAddress(), depositAmount);
        await token.approve(pools.address, depositAmount);

        pools = pools.connect(depositor)
        await pools.deposit(0, depositAmount);
      });

      shouldBehaveLikeWithdraw(0, withdrawAmount)
    });
  });


  /// here
  describe("emergency exit tokens", () => {
    let depositor: Signer;
    let token: Erc20Mock;

    beforeEach(async () => {
      [depositor, ...signers] = signers;
      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;

      await pools.connect(governance).createPool(token.address);
      await pools.connect(governance).setRewardWeights([1]);
      await pools.connect(governance).setRewardRate(parseEther("1"));
      // reset reward approval to confirm emergency exit works
      await reward.connect(rewardsSource).approve(pools.address, 0);
    });

    const shouldBehaveLikeEmergencyExit = (
      poolId: BigNumberish,
    ) => {
      let startingTokenBalance: BigNumber;
      let startingTotalDeposited: BigNumber;
      let startingDeposited: BigNumber;

      beforeEach(async () => {
        startingTokenBalance = await token.balanceOf(await depositor.getAddress());
        startingTotalDeposited = await pools.getPoolTotalDeposited(0);
        startingDeposited = await pools.getStakeTotalDeposited(await depositor.getAddress(), 0);
      });

      beforeEach(async () => {
        await pools.emergencyExit(poolId);
      });

      it("decrements total deposited amount", async () => {
        expect(await pools.getPoolTotalDeposited(0))
          .equal(startingTotalDeposited.sub(startingDeposited));
      });

      it("decrements deposited amount", async () => {
        expect(await pools.getStakeTotalDeposited(await depositor.getAddress(), 0))
          .equal(0);
      });

      it("transfers deposited tokens", async () => {
        expect(await token.balanceOf(await depositor.getAddress())).equal(
          startingTokenBalance.add(startingDeposited)
        );
      });
    };

    context("with previous deposits", async () => {
      let depositAmount = 50000;

      beforeEach(async () => {
        token = token.connect(depositor)
        await token.connect(deployer).mint(await depositor.getAddress(), MAXIMUM_U256.sub(depositAmount));
        await token.connect(depositor).approve(pools.address, MAXIMUM_U256);
        await token.mint(await depositor.getAddress(), depositAmount);
        await token.approve(pools.address, depositAmount);

        pools = pools.connect(depositor)
        await pools.deposit(0, depositAmount);
      });

      shouldBehaveLikeEmergencyExit(0)
    });
  });

  describe.only("exit tokens", () => {
    let depositor: Signer;
    let token: Erc20Mock;

    beforeEach(async () => {
      [depositor, ...signers] = signers;
      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;

      await pools.connect(governance).createPool(token.address);
      await pools.connect(governance).setRewardWeights([1]);
    });

    const shouldBehaveLikeExit = (
      poolId: BigNumberish,
      exitFee: BigNumberish = 0
    ) => {
      let startingTokenBalance: BigNumber;
      let startingTotalDeposited: BigNumber;
      let startingDeposited: BigNumber;
      let expectedExitFee: BigNumber;

      beforeEach(async () => {
        startingTokenBalance = await token.balanceOf(await depositor.getAddress());
        startingTotalDeposited = await pools.getPoolTotalDeposited(0);
        startingDeposited = await pools.getStakeTotalDeposited(await depositor.getAddress(), 0);

        await pools.connect(governance).setExitFeePercentages([poolId]);
        expectedExitFee = startingDeposited.mul(exitFee).div(parseEther("1"));
      });

      beforeEach(async () => {
        await pools.exit(poolId);
      });

      it("decrements total deposited amount", async () => {
        expect(await pools.getPoolTotalDeposited(0))
          .equal(startingTotalDeposited.sub(startingDeposited));
      });

      it("decrements deposited amount", async () => {
        expect(await pools.getStakeTotalDeposited(await depositor.getAddress(), 0))
          .equal(0);
      });

      it("transfers deposited tokens", async () => {
        const tokenBalance = await token.balanceOf(await depositor.getAddress());
        // const expectedBalance = tokenBalance.sub()
        console.log("expectedExitFee", formatEther(expectedExitFee));
        console.log("tokenBalance", formatEther(tokenBalance));
        expect(tokenBalance).equal(
          startingTokenBalance.add(startingDeposited.sub(expectedExitFee))
        );
      });
    };

    context("with previous deposits", async () => {
      let depositAmount = 50000;

      beforeEach(async () => {
        token = token.connect(depositor)
        await token.connect(deployer).mint(await depositor.getAddress(), MAXIMUM_U256.sub(depositAmount));
        await token.connect(depositor).approve(pools.address, MAXIMUM_U256);
        await token.mint(await depositor.getAddress(), depositAmount);
        await token.approve(pools.address, depositAmount);

        pools = pools.connect(depositor)
        await pools.deposit(0, depositAmount);
      });

      shouldBehaveLikeExit(0)
    });

    context("with previous deposits and exit fee", async () => {
      let depositAmount = 50000;

      beforeEach(async () => {
        token = token.connect(depositor)
        await token.connect(deployer).mint(await depositor.getAddress(), depositAmount);
        await token.connect(depositor).approve(pools.address, MAXIMUM_U256);
        await token.mint(await depositor.getAddress(), depositAmount);
        await token.approve(pools.address, depositAmount);

        pools = pools.connect(depositor)
        await pools.deposit(0, depositAmount);
      });

      shouldBehaveLikeExit(0, parseEther("0.5"));
    });
  });

  describe("claim tokens", () => {
    let depositor: Signer;
    let token: Erc20Mock;

    let rewardWeight = 1;
    let depositAmount = 50000;
    let rewardRate = 1000;

    beforeEach(async () => {
      [depositor, ...signers] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;
    });

    beforeEach(async () => (token = token.connect(depositor)));

    beforeEach(async () => {
      await token.mint(await depositor.getAddress(), MAXIMUM_U256);
      await token.approve(pools.address, MAXIMUM_U256);
    });

    beforeEach(async () => (pools = pools.connect(governance)));

    beforeEach(async () => {
      await pools.createPool(token.address);
      await pools.setRewardWeights([rewardWeight]);
    });

    context("with deposit", () => {
      const EPSILON: number = 5;

      let elapsedBlocks = 1000;

      beforeEach(async () => {
        await pools.connect(governance).setRewardRate(rewardRate);
        pools = pools.connect(depositor)
        await pools.deposit(0, depositAmount);
        await mineBlocks(ethers.provider, elapsedBlocks);
        await pools.claim(0);
      });

      it("mints reward tokens", async () => {
        const rewardAmount = rewardRate * (elapsedBlocks + 1);

        expect(await reward.balanceOf(await depositor.getAddress()))
          .gte(rewardAmount - EPSILON)
          .lte(rewardAmount);
      });

      it("clears unclaimed amount", async () => {
        expect(await pools.getStakeTotalUnclaimed(await depositor.getAddress(), 0)).equal(0);
      });
    });

    context("with multiple deposits", () => {
      const EPSILON: number = 5;

      let elapsedBlocks = 100;

      beforeEach(async () => {
        await pools.connect(governance).setRewardRate(rewardRate);
        pools = pools.connect(depositor)
        await pools.deposit(0, depositAmount);
        await mineBlocks(ethers.provider, elapsedBlocks);
        await pools.deposit(0, depositAmount);
        await mineBlocks(ethers.provider, elapsedBlocks);
        await pools.claim(0);
      });

      it("mints reward tokens", async () => {
        const rewardAmount = rewardRate * (elapsedBlocks + elapsedBlocks + 2);

        expect(await reward.balanceOf(await depositor.getAddress()))
          .gte(rewardAmount - EPSILON)
          .lte(rewardAmount);
      });

      it("clears unclaimed amount", async () => {
        expect(await pools.getStakeTotalUnclaimed(await depositor.getAddress(), 0)).equal(0);
      });
    });
  });

  describe("get stake unclaimed amount", () => {
    let depositor: Signer;
    let token: Erc20Mock;

    let rewardWeight = 1;
    let depositAmount = 50000;
    let rewardRate = 5000;

    beforeEach(async () => {
      [depositor, ...signers] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Staking Token",
        "STAKE",
        18
      )) as Erc20Mock;
    });

    beforeEach(async () => (token = token.connect(depositor)));

    beforeEach(async () => {
      await token.mint(await depositor.getAddress(), MAXIMUM_U256);
      await token.approve(pools.address, MAXIMUM_U256);
    });

    beforeEach(async () => (pools = pools.connect(governance)));

    beforeEach(async () => {
      await pools.createPool(token.address);
      await pools.setRewardWeights([rewardWeight]);
      await pools.setRewardRate(rewardRate);
    });

    context("with deposit", () => {
      const EPSILON: number = 5;

      let elapsedBlocks = 100;

      beforeEach(async () => (pools = pools.connect(depositor)));

      beforeEach(async () => await pools.deposit(0, depositAmount));

      beforeEach(async () => {
        await mineBlocks(ethers.provider, elapsedBlocks);
      });

      it("properly calculates the balance", async () => {
        const rewardAmount = rewardRate * elapsedBlocks;

        expect(await pools.getStakeTotalUnclaimed(await depositor.getAddress(), 0)).equal(rewardAmount);
      });
    });

    context("with multiple deposits", () => {
      const EPSILON: number = 5;

      let elapsedBlocks = 100;

      beforeEach(async () => (pools = pools.connect(depositor)));

      beforeEach(async () => {
        await pools.deposit(0, depositAmount);
        await mineBlocks(ethers.provider, elapsedBlocks);
        await pools.deposit(0, depositAmount);
        await mineBlocks(ethers.provider, elapsedBlocks);
      });

      it("properly calculates the balance", async () => {
        const rewardAmount = rewardRate * (elapsedBlocks + elapsedBlocks + 1);

        expect(await pools.getStakeTotalUnclaimed(await depositor.getAddress(), 0))
          .gte(rewardAmount - EPSILON)
          .lte(rewardAmount);
      });
    });
  });
});