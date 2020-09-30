const ReferralRewards = artifacts.require("./ReferralRewards.sol");

module.exports = function (deployer) {
  deployer.deploy(ReferralRewards);
};
