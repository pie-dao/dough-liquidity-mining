pragma solidity ^0.5.0;

import "../../contracts/ReferralRewards.sol";


contract ReferralMock is ReferralRewards {

    constructor(IERC20 uniToken, IERC20 snxToken) public {
        uni = uniToken;
        dough = snxToken;
    }
}