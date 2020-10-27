import { time } from "openzeppelin-test-helpers";
import { use, expect } from "chai";
import { solidity, deployContract } from "ethereum-waffle";
import { Signer } from "ethers";

import { ethers, network } from "hardhat";
import { constants, BigNumber } from "ethers";
import TimeTraveler from "../utils/TimeTraveler";
use(solidity);

import uniArtifact from "../artifacts/contracts/mock/UniMock.sol/UniMock.json";
import SnxArtifact from "../artifacts/contracts/mock/SnxMock.sol/SnxMock.json";
import ReferralMockArtifact from "../artifacts/contracts/mock/ReferralMock.sol/ReferralMock.json";
import RewardEscrowArtifact from "../artifacts/contracts/RewardEscrow.sol/RewardEscrow.json";

import { UniMock } from "../typechain/UniMock";
import { SnxMock } from "../typechain/SnxMock";
import { ReferralMock } from "../typechain/ReferralMock";
import { RewardEscrow } from "../typechain/RewardEscrow";
import { parseEther } from "ethers/lib/utils";


async function timeIncreaseTo(seconds) {
  const delay = 10 - new Date().getMilliseconds();
  await new Promise((resolve) => setTimeout(resolve, delay));
  await time.increaseTo(seconds);
}

const almostEqualDiv1e18 = function (expectedOrig, actualOrig) {
  const _1e18 = constants.WeiPerEther;
  const expected = expectedOrig.div(_1e18);
  const actual = actualOrig.div(_1e18);
  this.assert(
    expected.eq(actual) ||
      expected.add(1).eq(actual) ||
      expected.add(2).eq(actual) ||
      actual.add(1).eq(expected) ||
      actual.add(2).eq(expected),
    "expected #{act} to be almost equal #{exp}",
    "expected #{act} to be different from #{exp}",
    expectedOrig.toString(),
    actualOrig.toString()
  );
};

require("chai").use(function (chai, utils) {
  chai.Assertion.overwriteMethod("almostEqualDiv1e18", function (original) {
    return function (value) {
      if (utils.flag(this, "bignumber")) {
        var expected = BigNumber.from(value);
        var actual = BigNumber.from(this._obj);
        almostEqualDiv1e18.apply(this, [expected, actual]);
      } else {
        original.apply(this, arguments);
      }
    };
  });
});


  describe("Unipool", async function () {
    this.timeout(3000000);

    let uni: UniMock;
    let snx: SnxMock;
    let rewardEscrow: RewardEscrow;
    let pool: ReferralMock;
    let signers:Signer[] = [];
    let timeTraveler: TimeTraveler;
    let wallet1;
    let wallet2;
    let wallet3;
    let wallet4;

    const WEEK = 60 * 60 * 24 * 7;

    before(async() => {
      signers = await ethers.getSigners();
      uni = (await deployContract(signers[0], uniArtifact)) as UniMock;
      snx = (await deployContract(signers[0], SnxArtifact)) as SnxMock;
      rewardEscrow = (await deployContract(signers[0], RewardEscrowArtifact, [snx.address])) as RewardEscrow;

      pool = (await deployContract(signers[0], ReferralMockArtifact, [uni.address, snx.address, rewardEscrow.address])) as ReferralMock;
      await rewardEscrow.addRewardsContract(pool.address);

      wallet1 = await signers[0].getAddress();
      wallet2 = await signers[1].getAddress();
      wallet3 = await signers[2].getAddress();
      wallet4 = await signers[3].getAddress();
      
      await pool.setRewardDistribution(wallet1);
      //Set escrow percentage to 0
      pool.setEscrowPercentage(0);

      await snx.mint(pool.address, parseEther("1000000"));
      await uni.mint(wallet1, parseEther("1000"));
      await uni.mint(wallet2, parseEther("1000"));
      await uni.mint(wallet3, parseEther("1000"));
      await uni.mint(wallet4, parseEther("1000"));

      await uni.approve(pool.address, constants.MaxUint256);
      await uni.connect(signers[1]).approve(pool.address, constants.MaxUint256);
      await uni.connect(signers[2]).approve(pool.address, constants.MaxUint256);
      await uni.connect(signers[3]).approve(pool.address, constants.MaxUint256);

      timeTraveler = new TimeTraveler(network.provider);

      await timeTraveler.snapshot();
    });

    beforeEach(async function () {
      await timeTraveler.revertSnapshot();
    });

    it("Two stakers with the same stakes wait 1 w", async function () {
      // 72000 SNX per week for 3 weeks
      await pool.notifyRewardAmount(parseEther("72000"))

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(0);
      expect(await pool.earned(wallet1)).to.eq("0");
      expect(await pool.earned(wallet2)).to.eq("0");

      await pool["stake(uint256)"](parseEther("1"));
      await pool.connect(signers[1])["stake(uint256)"](parseEther("1"));

      // @ts-ignore
      expect((await pool.rewardPerToken())).to.be.bignumber.almostEqualDiv1e18(0);
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(0);
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(0);

      await timeTraveler.increaseTime(WEEK);

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("36000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("36000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("36000"));
    });

    it("Two stakers with the different (1:3) stakes wait 1 w", async function () {
      // 72000 SNX per week
      await pool.notifyRewardAmount(parseEther("72000"));

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await pool.balanceOf(wallet1)).to.eq("0");
      expect(await pool.balanceOf(wallet2)).to.eq("0");
      expect(await pool.earned(wallet1)).to.eq("0");
      expect(await pool.earned(wallet2)).to.eq("0");

      await pool["stake(uint256)"](parseEther("1"));
      await pool.connect(signers[1])["stake(uint256)"](parseEther("3"));

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18("0");
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18("0");
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18("0");

      await timeTraveler.increaseTime(WEEK);

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("18000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("18000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("54000"));
    });

    it("Two stakers with the different (1:3) stakes wait 2 weeks", async function () {
      //
      // 1x: +----------------+ = 72k for 1w + 18k for 2w
      // 3x:         +--------+ =  0k for 1w + 54k for 2w
      //

      // 72000 SNX per week
      await pool.notifyRewardAmount(parseEther("72000"));

      await pool["stake(uint256)"](parseEther("1"));

      await timeTraveler.increaseTime(WEEK);

      await pool.connect(signers[1])["stake(uint256)"](parseEther("3"));

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("72000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("72000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("0"));

      // Forward to week 3 and notifyReward weekly
      for (let i = 1; i < 3; i++) {
        await timeTraveler.increaseTime(WEEK);
        await pool.notifyRewardAmount(parseEther("72000"));
      }

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("90000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("90000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("54000"));
    });

    it("Three stakers with the different (1:3:5) stakes wait 3 weeks", async function () {
      //
      // 1x: +----------------+--------+ = 18k for 1w +  8k for 2w + 12k for 3w
      // 3x: +----------------+          = 54k for 1w + 24k for 2w +  0k for 3w
      // 5x:         +-----------------+ =  0k for 1w + 40k for 2w + 60k for 3w
      //

      // 72000 SNX per week for 3 weeks
      await pool.notifyRewardAmount(parseEther("72000"));

      await pool["stake(uint256)"](parseEther("1"));
      await pool.connect(signers[1])["stake(uint256)"](parseEther("3"));

      await timeTraveler.increaseTime(WEEK);

      await pool.connect(signers[2])["stake(uint256)"](parseEther("5"));

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("18000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("18000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("54000"));

      await pool.notifyRewardAmount(parseEther("72000"));
      await timeTraveler.increaseTime(WEEK * 2);

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("26000")); // 18k + 8k
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("26000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("78000"));
      // @ts-ignore
      expect(await pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(parseEther("40000"));

      await pool.connect(signers[1]).exit();

      await pool.notifyRewardAmount(parseEther("72000"));
      
      await timeTraveler.increaseTime(WEEK * 3);

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("38000")); // 18k + 8k + 12k
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("38000"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("0"));
      // @ts-ignore
      expect(await pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(parseEther("100000"));
    });

    it("One staker on 2 durations with gap", async function () {
      // 72000 SNX per week for 1 weeks
      await pool.notifyRewardAmount(parseEther("72000"));

      await pool["stake(uint256)"](parseEther("1"));

      await timeTraveler.increaseTime(WEEK * 2);

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("72000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("72000"));

      // 72000 SNX per week for 1 weeks
      await pool.notifyRewardAmount(parseEther("72000"));

      await timeTraveler.increaseTime(WEEK * 3);
      
      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("144000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("144000"));

      const reward = await pool.getReward();

      const events = (await reward.wait()).events;

      expect(events.length).to.be.eq(2);
      expect(events[1].event).to.eq("RewardPaid");
      expect(events[1].args["0"]).to.eq(wallet1);
      // @ts-ignore
      expect(events[1].args["1"]).to.be.bignumber.almostEqualDiv1e18(parseEther("144000"));
    });

    it("One staker on 2 durations with gap, with referral", async function () {
      // 72000 SNX per week for 1 weeks
      await pool.notifyRewardAmount(parseEther("72000"));

      const tx = await (await pool["stake(uint256,address)"](parseEther("1"),wallet4)).wait();
      let events = tx.events
      let event = events[4];
      expect(event.event).to.eq("ReferralSet");
      expect(event.args["0"]).to.be.eq(wallet1);
      expect(event.args["1"]).to.be.eq(wallet4);

      timeTraveler.increaseTime(WEEK * 2);
      
      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("72000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("72000"));

      // 72000 SNX per week for 1 weeks
      await pool.notifyRewardAmount(parseEther("72000"));

      await timeTraveler.increaseTime(WEEK * 3);
      
      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("144000"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("144000"));

      const reward = await pool.getReward();
      event = (await reward.wait()).events[1];

      expect(event.event).to.be.eq("RewardPaid");
      expect(event.args["0"]).to.be.eq(wallet1);
      // @ts-ignore
      expect(event.args["1"]).to.be.bignumber.almostEqualDiv1e18(
        parseEther("144000")
      );

      const referralRewardEvent = (await reward.wait()).events[2];

      expect(referralRewardEvent.event).to.eq("ReferralReward");
      expect(referralRewardEvent.args["0"]).to.eq(wallet1);
      expect(referralRewardEvent.args["1"]).to.eq(wallet4);
      // @ts-ignore
      expect(referralRewardEvent.args["2"]).to.be.bignumber.almostEqualDiv1e18(parseEther("1440"));
    });

    it("Test stake edge case", async function () {
      const txSameEvents = (await (await pool.connect(signers[3])["stake(uint256,address)"](parseEther("1"), wallet4)).wait()).events;

      expect(txSameEvents.length).to.eq(4);
      expect(txSameEvents[3].event).to.be.eq("Staked");

      const txZeroEvents = (await (await pool.connect(signers[3])["stake(uint256,address)"](parseEther("1"), "0x0000000000000000000000000000000000000000")).wait()).events;
      expect(txZeroEvents.length).to.be.eq(4);
      expect(txZeroEvents[3].event).to.be.eq("Staked");

      const txEvents = (await (await pool.connect(signers[3])["stake(uint256,address)"](parseEther("1"), wallet2)).wait()).events;
      expect(txEvents[4].event).to.be.eq("ReferralSet");
      expect(txEvents[4].args["0"]).to.be.eq(wallet4);
      expect(txEvents[4].args["1"]).to.be.eq(wallet2);

      const tx2Events = (await (await pool.connect(signers[3])["stake(uint256,address)"](parseEther("1"), wallet3)).wait()).events;
      // expect ReferralSet not to be thrown
      expect(tx2Events.length).to.be.eq(4);
      expect(tx2Events[3].event).to.be.eq("Staked");
    });

    it("Notify Reward Amount from mocked distribution to 10,000", async function () {
      // 10000 SNX per week for 1 weeks
      await pool.notifyRewardAmount(parseEther("10000"));

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await pool.balanceOf(wallet1)).to.eq("0");
      expect(await pool.balanceOf(wallet2)).to.eq("0");
      expect(await pool.earned(wallet1)).to.eq("0");
      expect(await pool.earned(wallet2)).to.eq("0");

      await pool["stake(uint256)"](parseEther("1"));
      await pool.connect(signers[1])["stake(uint256)"](parseEther("3"));
      
      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18("0");
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18("0");
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18("0");

      await timeTraveler.increaseTime(WEEK);

      // @ts-ignore
      expect(await pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(parseEther("2500"));
      // @ts-ignore
      expect(await pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(parseEther("2500"));
      // @ts-ignore
      expect(await pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(parseEther("7500"));
    });

    // TODO partial escrow of rewards
  });
