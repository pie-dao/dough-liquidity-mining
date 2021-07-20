# DOUGH liquidity mining

DOUGH liquidity mining contracts.

DOUGH token address: [0xad32a8e6220741182940c5abf610bde99e737b2d](https://etherscan.io/address/0xad32a8e6220741182940c5abf610bde99e737b2d)


## RewardEscrow

Forked of the [Synthetix Rewards Escrow contract](https://github.com/Synthetixio/synthetix/blob/develop/contracts/RewardEscrow.sol).

The contract was changed to allow multiple contracts to append vesting entries and for it to be upgraded.

### Admin functionality

#### Setting the DOUGH token

To allow for the dough token to be migrated it can be changed by the ``owner``.

```solidity
function setDough(address _dough) external
```

#### Adding reward contracts

For a contract to be able to add vesting entries it needs to be whitelisted by the ``owner``.

```solidity
function addRewardsContract(address _rewardContract) external
```

#### Removing reward contracts

A reward contract can be removed by the owner.

```solidity
function removeRewardsContract(address _rewardContract) external
```

### Integration

#### Appending vesting entries

Whitelisted contracts (use ``addRewardsContract``) can add vesting entries for accounts. Before calling this function ``quantity`` amount of tokens should be transfered to the rewardsEscrow.

```solidity
function appendVestingEntry(address account, uint quantity) external
```

#### Withdrawing vested eDOUGH

Using this function a user can withdraw vested dough from all vested entries.

```solidity
function vest() external
```

### Getters


#### Fetch the number of vesting entries attached to an account

```solidity
function numVestingEntries(address account) external
```

#### Fetching a specific vesting entry

```solidity
function getVestingScheduleEntry(address account, uint index) external
```

#### Get the timestamp when an entry vests

```solidity
function getVestingTime(address account, uint index) external
```

#### Get the amount of tokens of a vesting entry

```solidity
function getVestingQuantity(address account, uint index) external
```

#### Get the index of the next vesting entry that will vest for an account

```solidity
function getNextVestingIndex(address account) external
```

#### Get the next vesting entry that will vest for an account

```solidity
function getNextVestingEntry(address account) external
```

#### Get the time the next vesting entry will vest for an account

```solidity
function getNextVestingTime(address account) external
```

#### Get the quantity of the next vesting entry that will vest for account

```solidity
function getNextVestingQuantity(address account) external
```

#### Fetch all vesting entries of an account

```solidity
function checkAccountSchedule(address account) external
```

#### ERC20 compatible functions

```solidity
function balanceOf(address account) external
```

```solidity
function totalSupply() external
```

## StakingPools

The staking used currently used is a fork of the [contract made by Alchemix](https://github.com/alchemix-finance/alchemix-protocol/blob/master/contracts/StakingPools.sol).

What we've added:

- Upgradeablity using the OpenZeppelin upgradable contracts
- Refferal system
- Easy Getter to fetch all LP positions
- Configurable escrow percentage
- Configurable exit fee percentage


### Admin functions

#### Setting a new governance address

Setting the governance address is a two step process. First the old ``governance`` address needs to set a new pending address:

```solidity
function setPendingGovernance(address _pendingGovernance) external
```

After this the new ``governance`` address can accept it:

```solidity
function acceptGovernance() external
```

#### Set the reward rate

The reward rate sets the amount of tokens in total to disperse per block. Only the ``governance`` address can call this.

```solidity
function setRewardRate(uint256 _rewardRate) external
```

#### Creating a new pool

A new token which can be staked can be added by the ``governance`` address. By default the ``escrowPercentage``, ``exitFeePercentage`` and ``rewardWeight`` will be set to 0

```solidity
function createPool(IERC20 _token) external returns (uint256 newPoolId)
```

#### Setting pool params 

When a new pool is added ``escrowPercentage``, ``exitFeePercentage`` and ``rewardWeight`` will be set to 0. It can be updated by the ``governance`` address by calling the following functions:

All functions update all pools at the same time. Make sure you know the order of the pools.

The reward weights determin how the ``rewardRate`` is split up between pools

```solidity
function setRewardWeights(uint256[] calldata _rewardWeights) external
```

The escrow percentages determin what percentage of rewards are locked in the ``RewardEscrow`` contract

```solidity
function setEscrowPercentages(uint256[] calldata _escrowPercentages) external
```

The exit fee percentages how much of an exit fee is charged when unstaking

```solidity
function setExitFeePercentages(uint256[] calldata _exitFeePercentages) external
```

#### Setting the address which receives the exit fees

Can only be called by the ``governance`` address.

```solidity
function setExitFeeReceiver(address _exitFeeReceiver) external
```

#### Setting referrer values

Addresses which would like to participate in the referral program for liquidity mining need to be whitelisted by the ``governance`` address.

```solidity
function setReferrerValues(address _referrer, uint256 _referralPercentage, uint256 _referralEscrowPercentage) external
```

### Integration

#### Deposit

Approve the deposit token first and call to deposit.

```solidity
function deposit(uint256 _poolId, uint256 _depositAmount) external;
```

To pass the referrer on deposit call.

```solidity
function depositReferred(uint256 _poolId, uint256 _depositAmount, address _referrer) external;
```

#### Withdraw

Withdraw deposit token and rewards

```solidity
function withdraw(uint256 _poolId, uint256 _withdrawAmount) external
```

#### Claim

Claim rewards

```solidity
function claim(uint256 _poolId) external
```

#### Claim referrer rewards

Claim rewards earned as a referrer

```solidity
function claimReferralRewards() external
```

#### Withdraw without rewards

In case the reward token somehow becomes untransferable you can withdraw forfeiting your rewards

```solidity
function emergencyExit(uint256 _poolId) external
```

#### Getters

Get the amount of DOUGH released every block to the pools

```solidity
function rewardRate() external view returns (uint256)
```

The total weight of all pools combined

```solidity
function totalRewardWeight() external view returns (uint256)
```

Total amount of reward pools

```solidity
function poolCount() external view returns (uint256)
```

Get the deposit token for a pool

```solidity
function getPoolToken(uint256 _poolId) external view returns (IERC20)
```

Get the reward weight of a pool

```solidity
function getPoolRewardWeight(uint256 _poolId) external view returns (uint256)
```

Get the percentage of rewards that are escrowed for a pool

```solidity
function getPoolEscrowPercentage(uint256 _poolId) external view returns (uint256)
```

Get the exit fee of a pool

```solidity
function getPoolExitFeePercentage(uint256 _poolId) external view returns (uint256)
```

Get the reward per block for this pool

```solidity
function getPoolRewardRate(uint256 _poolId) external view returns (uint256)
```

Get all global and account pool info

```solidity
function getPools(address _account) external view returns (Pool.ViewData[] memory) 
```

Get the total deposited for a pool by an account

```solidity
function getStakeTotalDeposited(address _account, uint256 _poolId) external view returns (uint256)
```

Get the amount of unclaimed rewards for an account

```solidity
function getStakeTotalUnclaimed(address _account, uint256 _poolId) external view returns (uint256)
```