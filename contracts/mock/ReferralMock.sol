pragma solidity ^0.5.0;

import "../ReferralRewards.sol";


contract ReferralMock is ReferralRewards {

    constructor(IERC20 uniToken, IERC20 doughToken, address _rewardEscrow) public {
        uni = uniToken;
        dough = doughToken;
        rewardEscrow = RewardEscrow(_rewardEscrow);
    }
}