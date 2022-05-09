from brownie import *
from rich import print
import csv

abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"stateMutability":"payable","type":"fallback"},{"inputs":[{"internalType":"address","name":"_value","type":"address"}],"name":"addressToBytes32","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_value","type":"bytes32"}],"name":"bytes32ToAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getProxyOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_key","type":"bytes32"}],"name":"readAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_key","type":"bytes32"}],"name":"readBool","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{
"internalType":"address","name":"_newImplementation","type":"address"}],"name":"setImplementation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newOwner","type":"address"}],"name":"setProxyOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_key","type":"bytes32"}],"name":"storageRead",
"outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"}]

proxy_address = '0x63cbd1858bd79de1a06c3c26462db360b834912d'
safe_address = '0x6458A23B020f489651f2777Bd849ddEd34DfCcd2'
timelock_address = '0x6Bd0D8c8aD8D3F1f97810d5Cc57E9296db73DC45'
vedough_address = '0xE6136F2e90EeEA7280AE5a0a8e6F48Fb222AF945'

def fetch_state_prev():
    edough = Contract.from_explorer(proxy_address, silent=True)

    # fetching state variables
    return {
        'dough': edough.dough(),
        'totalEscrowedBalance': edough.totalEscrowedBalance() 
    }

def fetch_state_upgrade():
    edough = RewardEscrow.at(proxy_address, owner=safe_address)
    edough.setTimelock(timelock_address)

    # fetching state variables
    return {
        'dough': edough.dough(),
        'totalEscrowedBalance': edough.totalEscrowedBalance(),
        'sharesTimeLock': edough.sharesTimeLock()
    }


def change_implementation(account):
    proxy = Contract.from_abi("PProxy", proxy_address, abi, owner=account)
    
    impl = RewardEscrow.deploy({'from': account})
    proxy.setImplementation(impl)

def get_addresses(f):
    csv_reader = csv.reader(open(f, 'r'), delimiter=',')
    return [r[0] for r in list(csv_reader)]

def main():
    account = accounts.at('0x3bfda5285416eb06ebc8bc0abf7d105813af06d0', force=True)

    previous_state = fetch_state_prev()

    change_implementation(account)

    upgrade_state = fetch_state_upgrade()

    state_changes = list( set(upgrade_state.keys()).difference(set(previous_state.keys())) )

    print('[yellow]Previous state:')
    print(f'   ├ dough: {previous_state["dough"]}')
    print(f'   ┕ totalEscrowedBalance: {previous_state["totalEscrowedBalance"]}')
    print()
    print('[yellow]Upgraded state:')
    print(f'   ├ dough: {upgrade_state["dough"]}')
    print(f'   ├ totalEscrowedBalance: {upgrade_state["totalEscrowedBalance"]}')
    print(f'   ┕ sharesTimeLock: {upgrade_state["sharesTimeLock"]}')
    print()
    print('State Changes')

    for k in state_changes:
        print(f'[green]   + state[{k}] = {upgrade_state[k]}')
    
    print()
    print(f'[yellow]E2E Testing...')
    
    addresses = get_addresses('./scripts/edough-holders.csv')
    edough = RewardEscrow.at(proxy_address)

    timelock = Contract.from_explorer(timelock_address, owner=safe_address)
    timelock.setWhitelisted(edough, True)

    something_off = []
    total_staked = 0
    for addr in addresses:
        addr_account = accounts.at(addr, force=True)
        
        n_entries = edough.numVestingEntries(addr)
        
        # get available vesting amount
        total_to_get = 0                
        for i in range(n_entries):
            entry = edough.getVestingScheduleEntry(addr, i)

            if entry[0] > 0 and entry[1] > 0:
                activation_time = entry[0] - 15724800
                
                if chain[-1].timestamp >= activation_time:
                    total_to_get += entry[1]

        if total_to_get > 0:
            total_staked += total_to_get
            vedough = interface.ERC20(vedough_address)
            balance_before = vedough.balanceOf(addr)
            edough.migrateToVeDOUGH({'from': addr_account})
            balance_after = vedough.balanceOf(addr)
            delta = balance_after - balance_before
            if delta != total_to_get:
                something_off.append({'addr': addr, 'total_to_get': total_to_get, 'delta': delta})

    print(f'Total staked veDOUGH after bridging every possible vesting entry: {(total_staked / 10 ** 18):,.2f}')
    print(f'Found {len(something_off)} inaccuracies:')

    for inaccuracy in something_off:
        diff = inaccuracy["total_to_get"] - inaccuracy["delta"]
        color = 'green' if diff > 0 else 'red'
        print(f'Something is off with {inaccuracy["addr"]}: expected [green]{inaccuracy["total_to_get"]}[/green] got [red]{inaccuracy["delta"]}[/red] ([{color}]diff[/{color}])')