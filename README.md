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