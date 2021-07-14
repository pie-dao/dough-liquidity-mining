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