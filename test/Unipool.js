const { BN, time } = require("openzeppelin-test-helpers");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
use(solidity);
const Uni = artifacts.require("UniMock");
const Snx = artifacts.require("SnxMock");
const Unipool = artifacts.require("ReferralMock");

async function timeIncreaseTo(seconds) {
  const delay = 10 - new Date().getMilliseconds();
  await new Promise((resolve) => setTimeout(resolve, delay));
  await time.increaseTo(seconds);
}

const almostEqualDiv1e18 = function (expectedOrig, actualOrig) {
  const _1e18 = new BN("10").pow(new BN("18"));
  const expected = expectedOrig.div(_1e18);
  const actual = actualOrig.div(_1e18);
  this.assert(
    expected.eq(actual) ||
      expected.addn(1).eq(actual) ||
      expected.addn(2).eq(actual) ||
      actual.addn(1).eq(expected) ||
      actual.addn(2).eq(expected),
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
        var expected = new BN(value);
        var actual = new BN(this._obj);
        almostEqualDiv1e18.apply(this, [expected, actual]);
      } else {
        original.apply(this, arguments);
      }
    };
  });
});

contract("Unipool", function ([_, wallet1, wallet2, wallet3, wallet4]) {
  describe("Unipool", async function () {
    beforeEach(async function () {
      this.uni = await Uni.new();
      this.snx = await Snx.new();
      this.pool = await Unipool.new(this.uni.address, this.snx.address);

      await this.pool.setRewardDistribution(wallet1);

      await this.snx.mint(this.pool.address, web3.utils.toWei("1000000"));
      await this.uni.mint(wallet1, web3.utils.toWei("1000"));
      await this.uni.mint(wallet2, web3.utils.toWei("1000"));
      await this.uni.mint(wallet3, web3.utils.toWei("1000"));
      await this.uni.mint(wallet4, web3.utils.toWei("1000"));

      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), {
        from: wallet1,
      });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), {
        from: wallet2,
      });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), {
        from: wallet3,
      });
      await this.uni.approve(this.pool.address, new BN(2).pow(new BN(255)), {
        from: wallet4,
      });

      this.started = (await time.latest()).addn(10);
      await timeIncreaseTo(this.started);
    });

    it("Two stakers with the same stakes wait 1 w", async function () {
      // 72000 SNX per week for 3 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal("0");

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet1,
      });
      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet2,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal("0");

      await timeIncreaseTo(this.started.add(time.duration.weeks(1)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("36000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("36000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("36000"));
    });

    it("Two stakers with the different (1:3) stakes wait 1 w", async function () {
      // 72000 SNX per week
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await this.pool.balanceOf(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.balanceOf(wallet2)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal("0");

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet1,
      });
      await this.pool.methods["stake(uint256)"](web3.utils.toWei("3"), {
        from: wallet2,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal("0");

      await timeIncreaseTo(this.started.add(time.duration.weeks(1)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("18000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("18000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("54000"));
    });

    it("Two stakers with the different (1:3) stakes wait 2 weeks", async function () {
      //
      // 1x: +----------------+ = 72k for 1w + 18k for 2w
      // 3x:         +--------+ =  0k for 1w + 54k for 2w
      //

      // 72000 SNX per week
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet1,
      });

      await timeIncreaseTo(this.started.add(time.duration.weeks(1)));

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("3"), {
        from: wallet2,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("72000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("72000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("0"));

      // Forward to week 3 and notifyReward weekly
      for (let i = 1; i < 3; i++) {
        await timeIncreaseTo(this.started.add(time.duration.weeks(i + 1)));
        await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
          from: wallet1,
        });
      }

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("90000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("90000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("54000"));
    });

    it("Three stakers with the different (1:3:5) stakes wait 3 weeks", async function () {
      //
      // 1x: +----------------+--------+ = 18k for 1w +  8k for 2w + 12k for 3w
      // 3x: +----------------+          = 54k for 1w + 24k for 2w +  0k for 3w
      // 5x:         +-----------------+ =  0k for 1w + 40k for 2w + 60k for 3w
      //

      // 72000 SNX per week for 3 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet1,
      });
      await this.pool.methods["stake(uint256)"](web3.utils.toWei("3"), {
        from: wallet2,
      });

      await timeIncreaseTo(this.started.add(time.duration.weeks(1)));

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("5"), {
        from: wallet3,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("18000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("18000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("54000"));

      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });
      await timeIncreaseTo(this.started.add(time.duration.weeks(2)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("26000")); // 18k + 8k
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("26000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("78000"));
      expect(
        await this.pool.earned(wallet3)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("40000"));

      await this.pool.exit({ from: wallet2 });

      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });
      await timeIncreaseTo(this.started.add(time.duration.weeks(3)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("38000")); // 18k + 8k + 12k
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("38000"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("0"));
      expect(
        await this.pool.earned(wallet3)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("100000"));
    });

    it("One staker on 2 durations with gap", async function () {
      // 72000 SNX per week for 1 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet1,
      });

      await timeIncreaseTo(this.started.add(time.duration.weeks(2)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("72000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("72000"));

      // 72000 SNX per week for 1 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      await timeIncreaseTo(this.started.add(time.duration.weeks(3)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("144000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("144000"));

      const reward = await this.pool.getReward({ from: wallet1 });
      expect(reward.logs.length).to.be.eq(1);
      expect(reward.logs[0].event).to.be.eq("RewardPaid");
      expect(reward.logs[0].args["0"]).to.be.eq(wallet1);
      expect(reward.logs[0].args["1"]).to.be.bignumber.almostEqualDiv1e18(
        web3.utils.toWei("144000")
      );
    });

    it("One staker on 2 durations with gap, with referral", async function () {
      // 72000 SNX per week for 1 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      const tx = await this.pool.methods["stake(uint256,address)"](
        web3.utils.toWei("1"),
        wallet4,
        {
          from: wallet1,
        }
      );
      expect(tx.logs[1].event).to.be.eq("ReferralSet");
      expect(tx.logs[1].args["0"]).to.be.eq(wallet1);
      expect(tx.logs[1].args["1"]).to.be.eq(wallet4);

      await timeIncreaseTo(this.started.add(time.duration.weeks(2)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("72000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("72000"));

      // 72000 SNX per week for 1 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("72000"), {
        from: wallet1,
      });

      await timeIncreaseTo(this.started.add(time.duration.weeks(3)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("144000"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("144000"));

      const reward = await this.pool.getReward({ from: wallet1 });
      expect(reward.logs.length).to.be.eq(2);
      expect(reward.logs[0].event).to.be.eq("RewardPaid");
      expect(reward.logs[0].args["0"]).to.be.eq(wallet1);
      expect(reward.logs[0].args["1"]).to.be.bignumber.almostEqualDiv1e18(
        web3.utils.toWei("144000")
      );

      expect(reward.logs[1].event).to.be.eq("ReferralReward");
      expect(reward.logs[1].args["0"]).to.be.eq(wallet1);
      expect(reward.logs[1].args["1"]).to.be.eq(wallet4);
      expect(reward.logs[1].args["2"])
        // 1440 as it is 1% of 144000
        .to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("1440"));
    });

    it("Test stake edge case", async function () {
      await expect(
        this.pool.methods["stake(uint256,address)"](
          web3.utils.toWei("1"),
          wallet4,
          {
            from: wallet4,
          }
        )
      ).to.be.revertedWith("WRONG_REFERRAL");
      await expect(
        this.pool.methods["stake(uint256,address)"](
          web3.utils.toWei("1"),
          "0x0000000000000000000000000000000000000000",
          {
            from: wallet4,
          }
        )
      ).to.be.revertedWith("WRONG_REFERRAL");

      const tx = await this.pool.methods["stake(uint256,address)"](
        web3.utils.toWei("1"),
        wallet2,
        {
          from: wallet4,
        }
      );
      expect(tx.logs[1].event).to.be.eq("ReferralSet");
      expect(tx.logs[1].args["0"]).to.be.eq(wallet4);
      expect(tx.logs[1].args["1"]).to.be.eq(wallet2);

      const tx2 = await this.pool.methods["stake(uint256,address)"](
        web3.utils.toWei("1"),
        wallet3,
        {
          from: wallet4,
        }
      );
      // expect ReferralSet not to be thrown
      expect(tx2.logs.length).to.be.eq(1);
      expect(tx2.logs[0].event).to.be.eq("Staked");
    });

    it("Notify Reward Amount from mocked distribution to 10,000", async function () {
      // 10000 SNX per week for 1 weeks
      await this.pool.notifyRewardAmount(web3.utils.toWei("10000"), {
        from: wallet1,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await this.pool.balanceOf(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.balanceOf(wallet2)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal("0");

      await this.pool.methods["stake(uint256)"](web3.utils.toWei("1"), {
        from: wallet1,
      });
      await this.pool.methods["stake(uint256)"](web3.utils.toWei("3"), {
        from: wallet2,
      });

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18("0");
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal("0");
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal("0");

      await timeIncreaseTo(this.started.add(time.duration.weeks(1)));

      expect(
        await this.pool.rewardPerToken()
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("2500"));
      expect(
        await this.pool.earned(wallet1)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("2500"));
      expect(
        await this.pool.earned(wallet2)
      ).to.be.bignumber.almostEqualDiv1e18(web3.utils.toWei("7500"));
    });
  });
});
