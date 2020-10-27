import { Signer, constants, BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";
import { deployContract, solidity } from "ethereum-waffle";
import { use, expect } from "chai";

use(solidity);

import { RewardEscrow } from "../typechain/RewardEscrow";
import { SnxMock } from "../typechain/SnxMock";

import RewardEscrowArtifact from "../artifacts/contracts/RewardEscrow.sol/RewardEscrow.json";
import SnxMockArtifact from "../artifacts/contracts/mock/SnxMock.sol/SnxMock.json";
import { parseEther } from "ethers/lib/utils";


describe.only('RewardEscrow', function() {
    this.timeout(3000000);
	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

    let owner:string;
    let ownerSigner: Signer;
    let rewardContractAccount:string;
    let rewardContractAccountSigner: Signer;
    let account1:string;
    let account1Signer: Signer;
    let account2:string;
    let account2Signer: Signer;
    let signers: Signer[];
    let rewardEscrow: RewardEscrow;
    let synthetix: SnxMock;
    let rewardContract: string;
    let timeTraveler: TimeTraveler;

	// Run once at beginning - snapshots will take care of resetting this before each test
	before(async () => {
        signers = await ethers.getSigners();
        owner = await signers[0].getAddress();
        rewardContractAccount = await signers[1].getAddress();
        account1 = await signers[2].getAddress();
        account2 = await signers[3].getAddress();

        [
            ownerSigner,
            rewardContractAccountSigner,
            account1Signer,
            account2Signer
        ] = signers;

        synthetix = await deployContract(signers[0], SnxMockArtifact) as SnxMock;
        rewardEscrow = await deployContract(signers[0], RewardEscrowArtifact, [synthetix.address]) as RewardEscrow

        synthetix.mint(owner, parseEther("1000000"));

        timeTraveler = new TimeTraveler(network.provider);

        await timeTraveler.snapshot();
    });
    
    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

	describe('Constructor & Settings ', async () => {
		it('should set synthetix on contructor', async () => {
			const synthetixAddress = await rewardEscrow.dough();
			expect(synthetixAddress).to.eq(synthetix.address);
		});

		it('should set owner on contructor', async () => {
			const ownerAddress = await rewardEscrow.owner();
			expect(ownerAddress).to.eq(owner);
		});

		it('should allow owner to set dough', async () => {
			await rewardEscrow.setDough(constants.AddressZero);
			const doughAddress = await rewardEscrow.dough();
			expect(doughAddress, constants.AddressZero);
		});
	});

	describe('Given there are no escrow entries', async () => {
		it('then numVestingEntries should return 0', async () => {
			expect(await rewardEscrow.numVestingEntries(account1)).to.eq(0);
		});
		it('then getNextVestingEntry should return 0', async () => {
			const nextVestingEntry = await rewardEscrow.getNextVestingEntry(account1);
			expect(nextVestingEntry[0]).to.eq(0);
			expect(nextVestingEntry[1]).to.eq(0);
		});
		it('then vest should do nothing and not revert', async () => {
			await rewardEscrow.connect(account1Signer).vest();
			expect(await rewardEscrow.totalVestedAccountBalance(account1)).to.eq(0);
		});
	});

	describe('Functions', async () => {
		beforeEach(async () => {
			// Ensure only FeePool Address can call rewardEscrow.appendVestingEntry()
			await rewardEscrow.addRewardsContract(rewardContractAccount);
			const isRewardContract = await rewardEscrow.isRewardContract(rewardContractAccount);
			expect(isRewardContract).to.be.true;
		});

		describe('Vesting Schedule Writes', async () => {
			it('should not create a vesting entry with a zero amount', async () => {
				// Transfer of SNX to the escrow must occur before creating an entry
				await synthetix.transfer(rewardEscrow.address, parseEther("1"));

				await expect(rewardEscrow.connect(rewardContractAccount).appendVestingEntry(account1, parseEther('0'))).to.be.revertedWith("Quantity cannot be zero");
			});

			it('should not create a vesting entry if there is not enough SNX in the contracts balance', async () => {
				// Transfer of SNX to the escrow must occur before creating an entry
				await synthetix.transfer(rewardEscrow.address, parseEther('1'));
				await expect(rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('10'))).to.be.revertedWith(" Must be enough balance in the contract to provide for the vesting entry");
			});
		});

		describe('Vesting Schedule Reads ', async () => {
			beforeEach(async () => {
				// Transfer of SNX to the escrow must occur before creating a vestinng entry
				await synthetix.transfer(rewardEscrow.address, parseEther('6000'));

				// Add a few vesting entries as the feepool address
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1000'));
				await timeTraveler.increaseTime(WEEK);
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('2000'));
				await timeTraveler.increaseTime(WEEK);
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('3000'));
			});

			it('should append a vesting entry and increase the contracts balance', async () => {
				const balanceOfRewardEscrow = await synthetix.balanceOf(rewardEscrow.address);
				expect(balanceOfRewardEscrow).to.eq(parseEther('6000'));
			});

			it('should get an accounts total Vested Account Balance', async () => {
				const balanceOf = await rewardEscrow.balanceOf(account1);
				expect(balanceOf).to.eq(parseEther('6000'));
			});

			it('should get an accounts number of vesting entries', async () => {
				const numVestingEntries = await rewardEscrow.numVestingEntries(account1);
				expect(numVestingEntries).to.eq(3);
			});

			it('should get an accounts vesting schedule entry by index', async () => {
				let vestingScheduleEntry;
				vestingScheduleEntry = await rewardEscrow.getVestingScheduleEntry(account1, 0);
				expect(vestingScheduleEntry[1]).to.eq(parseEther('1000'));

				vestingScheduleEntry = await rewardEscrow.getVestingScheduleEntry(account1, 1);
				expect(vestingScheduleEntry[1]).to.eq(parseEther('2000'));

				vestingScheduleEntry = await rewardEscrow.getVestingScheduleEntry(account1, 2);
				expect(vestingScheduleEntry[1]).to.eq(parseEther('3000'));
			});

			it('should get an accounts vesting time for a vesting entry index', async () => {
                const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
                // One year minus two weeks and a day
				const oneYearAhead = BigNumber.from(timestamp + DAY * 349);
				expect(await rewardEscrow.getVestingTime(account1, 0)).to.be.at.least(oneYearAhead);
				expect(await rewardEscrow.getVestingTime(account1, 1)).to.be.at.least(oneYearAhead);
				expect(await rewardEscrow.getVestingTime(account1, 2)).to.be.at.least(oneYearAhead);
			});

			it('should get an accounts vesting quantity for a vesting entry index', async () => {
				expect(await rewardEscrow.getVestingQuantity(account1, 0)).to.eq(parseEther('1000'));
				expect(await rewardEscrow.getVestingQuantity(account1, 1)).to.eq(parseEther('2000'));
				expect(await rewardEscrow.getVestingQuantity(account1, 2)).to.eq(parseEther('3000'));
			});
	    });

		describe('Partial Vesting', async () => {
			beforeEach(async () => {
				// Transfer of SNX to the escrow must occur before creating a vestinng entry
				await synthetix.transfer(rewardEscrow.address, parseEther('6000'));

				// Add a few vesting entries as the feepool address
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1000'));
				await timeTraveler.increaseTime(WEEK);
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('2000'));
				await timeTraveler.increaseTime(WEEK);
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('3000'));

				// fastForward to vest only the first weeks entry
				await timeTraveler.increaseTime(YEAR - WEEK * 2);

				// Vest
				await rewardEscrow.connect(account1Signer).vest();
			});

			it('should get an accounts next vesting entry index', async () => {
				expect(await rewardEscrow.getNextVestingIndex(account1)).to.eq(1);
			});

			it('should get an accounts next vesting entry', async () => {
				const vestingScheduleEntry = await rewardEscrow.getNextVestingEntry(account1);
				expect(vestingScheduleEntry[1]).to.eq(parseEther('2000'));
			});

			it('should get an accounts next vesting time', async () => {
                const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
				const fiveDaysAhead = BigNumber.from(timestamp + DAY * 5);
				expect(await rewardEscrow.getNextVestingTime(account1)).to.be.at.least(fiveDaysAhead);
			});

			it('should get an accounts next vesting quantity', async () => {
				const nextVestingQuantity = await rewardEscrow.getNextVestingQuantity(account1);
				expect(nextVestingQuantity).to.eq(parseEther('2000'));
			});
		});

		describe('Vesting', async () => {
			beforeEach(async () => {
				// Transfer of SNX to the escrow must occur before creating a vestinng entry
				await synthetix.transfer(rewardEscrow.address, parseEther('6000'));

				// Add a few vesting entries as the feepool address
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1000'));
				await timeTraveler.increaseTime(WEEK);
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('2000'));
				await timeTraveler.increaseTime(WEEK);
				await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('3000'));

				// Need to go into the future to vest
				await timeTraveler.increaseTime(YEAR + WEEK * 3);
			});

			it('should vest and transfer snx from contract to the user', async () => {
				await rewardEscrow.connect(account1Signer).vest();

				// Check user has all their vested SNX
				expect(await synthetix.balanceOf(account1)).to.eq(parseEther('6000'));

				// Check rewardEscrow does not have any SNX
				expect(await synthetix.balanceOf(rewardEscrow.address)).to.eq(parseEther('0'));
			});

			it('should vest and emit a Vest event', async () => {
				const vestTransaction = await (await rewardEscrow.connect(account1Signer).vest()).wait(1);

				// Vested(msg.sender, now, total);
                const vestedEvent = vestTransaction.events.find(event => event.event === 'Vested');
                expect(vestedEvent.args.beneficiary).to.eq(account1);
                expect(vestedEvent.args.value).to.eq(parseEther('6000'));
			});

			it('should vest and update totalEscrowedAccountBalance', async () => {
				// This account should have an escrowedAccountBalance
				let escrowedAccountBalance = await rewardEscrow.totalEscrowedAccountBalance(account1);
				expect(escrowedAccountBalance).to.eq(parseEther('6000'));

				// Vest
				await rewardEscrow.connect(account1Signer).vest();

				// This account should not have any amount escrowed
				escrowedAccountBalance = await rewardEscrow.totalEscrowedAccountBalance(account1);
				expect(escrowedAccountBalance).to.eq(parseEther('0'));
			});

			it('should vest and update totalVestedAccountBalance', async () => {
				// This account should have zero totalVestedAccountBalance
				let totalVestedAccountBalance = await rewardEscrow.totalVestedAccountBalance(account1);
				expect(totalVestedAccountBalance).to.eq(parseEther('0'));

				// Vest
				await rewardEscrow.connect(account1Signer).vest();

				// This account should have vested its whole amount
				totalVestedAccountBalance = await rewardEscrow.totalVestedAccountBalance(account1);
				expect(totalVestedAccountBalance).to.eq(parseEther('6000'));
			});

			it('should vest and update totalEscrowedBalance', async () => {
				await rewardEscrow.connect(account1Signer).vest();
				// There should be no Escrowed balance left in the contract
				expect(await rewardEscrow.totalEscrowedBalance()).to.eq(parseEther('0'));
			});
        });
        

        // TODO testing append vesting entries within a week


        // TODO testing add and removing vesting windows

		describe('Stress Test', () => {
			it('should not create more than MAX_VESTING_ENTRIES vesting entries', async () => {
				const MAX_VESTING_ENTRIES = 260; // await rewardEscrow.MAX_VESTING_ENTRIES();

				// Transfer of SNX to the escrow must occur before creating an entry
				await synthetix.transfer(rewardEscrow.address, parseEther('265'));

				// append the MAX_VESTING_ENTRIES to the schedule
				for (let i = 0; i < MAX_VESTING_ENTRIES + 1; i++) {
					await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1'), {gasLimit: 1000000});
					await timeTraveler.increaseTime(WEEK + 60);
				}
				// assert adding 1 more above the MAX_VESTING_ENTRIES fails
				await expect(rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1'))).to.be.revertedWith("Vesting schedule is too long");
			}).timeout(60e3);

			it('should be able to vest 52 week * 5 years vesting entries', async () => {
				// Transfer of SNX to the escrow must occur before creating an entry
				await synthetix.transfer(rewardEscrow.address, parseEther('260'));

				const MAX_VESTING_ENTRIES = 260; // await rewardEscrow.MAX_VESTING_ENTRIES();

				// Append the MAX_VESTING_ENTRIES to the schedule
				for (let i = 0; i < MAX_VESTING_ENTRIES; i++) {
					await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1'), { gasLimit: 1000000});
					await timeTraveler.increaseTime(WEEK + 60);
				}

				// Need to go into the future to vest
				await timeTraveler.increaseTime(YEAR * 100);

				// Vest
				await rewardEscrow.connect(account1Signer).vest();

				// Check user has all their vested SNX
				expect(await synthetix.balanceOf(account1)).to.eq(parseEther('260'));

				// Check rewardEscrow does not have any SNX
				expect(await synthetix.balanceOf(rewardEscrow.address)).to.eq(parseEther('0'));

				// This account should have vested its whole amount
				expect(await rewardEscrow.totalEscrowedAccountBalance(account1)).to.eq(parseEther('0'));

				// This account should have vested its whole amount
				expect(await rewardEscrow.totalVestedAccountBalance(account1)).to.eq(parseEther('260'));
			}).timeout(60e3);

			it('should be able to read an accounts schedule of 5 vesting entries', async () => {
				// Transfer of SNX to the escrow must occur before creating an entry
				await synthetix.transfer(rewardEscrow.address, parseEther('5'));

				const VESTING_ENTRIES = 5;

				// Append the VESTING_ENTRIES to the schedule
				for (let i = 0; i < VESTING_ENTRIES; i++) {
					await rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1'));
					await timeTraveler.increaseTime(WEEK + 60);
				}

				// Get the vesting Schedule
				const accountSchedule = await rewardEscrow.checkAccountSchedule(account1);

				// Check accountSchedule entries
				for (let i = 1; i < VESTING_ENTRIES; i += 2) {
					if (accountSchedule[i]) {
						expect(accountSchedule[i]).to.eq(parseEther('1'));
					}
				}
			}).timeout(60e3);

			it('should be able to read the full account schedule 52 week * 5 years vesting entries', async () => {
				// Transfer of SNX to the escrow must occur before creating an entry
				await synthetix.transfer(rewardEscrow.address, parseEther('260'));

				const MAX_VESTING_ENTRIES = 260; // await rewardEscrow.MAX_VESTING_ENTRIES();

				// Append the MAX_VESTING_ENTRIES to the schedule
				for (let i = 0; i < MAX_VESTING_ENTRIES; i++) {
					rewardEscrow.connect(rewardContractAccountSigner).appendVestingEntry(account1, parseEther('1'), {gasLimit: 1000000});
					await timeTraveler.increaseTime(WEEK + 60);
				}

				// Get the vesting Schedule
				const accountSchedule = await rewardEscrow.checkAccountSchedule(account1);

				// Check accountSchedule entries
				for (let i = 1; i < MAX_VESTING_ENTRIES; i += 2) {
					expect(accountSchedule[i]).to.eq(parseEther('1'));
				}
			}).timeout(60e3);
		});
	});
});
