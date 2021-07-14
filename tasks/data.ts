import { task } from "hardhat/config";

import { StakingPoolsFactory } from "../typechain/StakingPoolsFactory"

task("fetch-referral-data", "fetch referers and the amounts they refered")
    .addParam("contract", "StakingPools contract")
    .setAction(async(taskArgs, {ethers}) => {
        const signer = (await ethers.getSigners())[0];
        const stakingPools = (await new StakingPoolsFactory(signer)).attach(taskArgs.contract);

        const filter = stakingPools.filters.ReferrerSet(null, null);

        const events = await stakingPools.queryFilter(filter, 0, "latest");


        const users: any = {}; 

        for (const event of events) {
            // console.log(event);
            users[event.args.user] = {
                referrer: event.args.referrer
            }   
        }

        for (const address in users) {
            if (Object.prototype.hasOwnProperty.call(users, address)) {
                const element = users[address];
                const deposits = await stakingPools.getPools(address);

                // console.log(deposits);

                for (const deposit of deposits) {
                    users[address][deposit.token] = deposit.userDeposited.toString();
                }
            }
        }

        console.log(JSON.stringify(users, null, 2));

});