#!/usr/bin/env node

const program = require('commander');
var fs = require('fs');
const fetch = require('node-fetch'); // Added for making HTTP requests

// Assuming helper.js contains the eos object and other necessary constants
const { eos, names, accounts, getTableRows } = require('./helper'); // Adjust imports as needed

// Constants
const HYPERION_HISTORY_ENDPOINT = 'https://eos.hyperion.eosrio.io/v2'; // Updated endpoint
let RAM_PRICE_EOS_PER_KB = 0.4106; // Default, will try to update dynamically
const EOS_PRICE_USD = 0.56; // Example: current price of Vault (EOS) is around $0.56 - $0.58
const mainAccount = 'hypha';

/**
 * Fetches the current RAM price in EOS per KB from the eosio.rammarket table.
 */
const fetchRamPricePerKb = async () => {
    try {
        const ramMarketData = await eos.rpc.get_table_rows({
            json: true,
            code: 'eosio',
            scope: 'eosio',
            table: 'rammarket',
            limit: 1,
        });
        if (ramMarketData && ramMarketData.rows && ramMarketData.rows.length > 0) {
            const market = ramMarketData.rows[0];
            const quoteBalance = parseFloat(market.quote.balance.split(' ')[0]);
            const baseBalance = parseFloat(market.base.balance.split(' ')[0]);
            if (baseBalance > 0) {
                return (quoteBalance / baseBalance) * 1024; // Price per KB
            }
        }
    } catch (error) {
        console.warn("Could not fetch dynamic RAM price, using default. Error:", error.message);
    }
    return RAM_PRICE_EOS_PER_KB; // Fallback to default
};

/**
 * Finds accounts created by the specified account by querying Hyperion history.
 * @param {string} creatorAccount - The account name that created other accounts.
 * @returns {Promise<string[]>} - A list of account names created by creatorAccount.
 */
const findHyphaAccounts = async (creatorAccount) => {
    const createdAccounts = new Set();
    let skip = 0;
    const limit = 100; // Number of actions to fetch per page
    let moreActionsExist = true;

    console.log(`Fetching 'newaccount' actions created by ${creatorAccount} using Hyperion API...`);

    while (moreActionsExist) {
        // Hyperion API endpoint for getting actions:
        // We query the 'eosio' account for 'newaccount' actions where 'act.data.creator' is our creatorAccount.
        const url = `https://eos.hyperion.eosrio.io/v2/history/get_actions?account=${creatorAccount}&name=newaccount&skip=${skip}&limit=100&sort=asc`
        console.log(`Fetching URL: ${url}`); // Uncomment for debugging

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error ${response.status} from Hyperion: ${errorText}. URL: ${url}`);
                moreActionsExist = false; // Stop trying on this error
                break;
            }
            const data = await response.json();

            if (data.actions && data.actions.length > 0) {
                data.actions.forEach(actionEntry => {
                    if (actionEntry.act.name === 'newaccount') {
                        const newAccountName = actionEntry.act.data.newact;
                        if (newAccountName) {
                            console.log(`Adding account: ${newAccountName}`); // Already added by user edit
                            createdAccounts.add(newAccountName);
                        } else {
                            console.warn("Found newaccount action by creator, but 'newact' or 'name' field is missing in data:", actionEntry.act.data);
                        }
                    }
                });

                if (data.actions.length < limit) {
                    moreActionsExist = false; // This was the last page
                } else {
                    skip += limit; // Increment skip for the next page
                }
            } else {
                moreActionsExist = false; // No more actions found
            }

            // Optional: Add a small delay to be polite to the API endpoint if making many calls
            // await new Promise(resolve => setTimeout(resolve, 100)); 

        } catch (error) {
            console.error(`Error fetching/processing actions for ${creatorAccount} from Hyperion: ${error.message}. URL: ${url}`);
            moreActionsExist = false; // Stop trying on network error or JSON parse error
        }
    }

    console.log(`Found ${createdAccounts.size} accounts created by ${creatorAccount} from Hyperion history.`);
    return Array.from(createdAccounts);
};

const calculateAccountValue = async () => {
    console.log(`Starting value calculation for accounts related to: ${mainAccount}`);

    RAM_PRICE_EOS_PER_KB = await fetchRamPricePerKb();
    console.log(`Using RAM Price: ${RAM_PRICE_EOS_PER_KB.toFixed(6)} EOS/KB`);
    console.log(`Using EOS Price: $${EOS_PRICE_USD.toFixed(2)}/EOS`);

    // Initialize summary variables
    let grandTotalLiquidEos = 0;
    let grandTotalRamValueEos = 0;
    let grandTotalStakedOrRefundingEosConditional = 0;
    let grandTotalStakedOrRefundingEosUnconditional = 0;
    let targetAccounts = []; // Declare here for wider scope

    try {
        const discoveredAccounts = await findHyphaAccounts(mainAccount);
        const initialAccounts = [
            mainAccount,
            names.daoContract,
            names.joinhypha,
            names.oracleuser,
            names.tier_vesting,
            names.launch_sale,
            names.paycpu,
            ...(Object.values(accounts).filter(acc => typeof acc === 'string' && acc.endsWith('.hypha')))
        ];
        targetAccounts = Array.from(new Set([...initialAccounts, ...discoveredAccounts]
            .filter(acc => acc && typeof acc === 'string'))
        );

        console.log("Target accounts to check:", targetAccounts);

        for (const accountName of targetAccounts) {
            if (!accountName) {
                console.warn("Skipping invalid account name.");
                continue;
            }
            console.log(`
--- Processing account: ${accountName} ---`);

            try {
                const accountInfo = await eos.rpc.get_account(accountName);

                const ramUsageBytes = accountInfo.ram_usage;
                const ramUsageKb = ramUsageBytes / 1024;
                const ramValueEos = ramUsageKb * RAM_PRICE_EOS_PER_KB;
                const ramValueUsd = ramValueEos * EOS_PRICE_USD;
                console.log(`RAM Usage: ${ramUsageKb.toFixed(2)} KB / ${(accountInfo.ram_quota / 1024).toFixed(2)} KB`);
                console.log(`RAM Value: ${ramValueEos.toFixed(4)} EOS (~$${ramValueUsd.toFixed(2)} USD)`);

                const liquidBalanceStr = accountInfo.core_liquid_balance || "0.0000 EOS";
                const liquidBalance = parseFloat(liquidBalanceStr.split(' ')[0]);
                const liquidValueUsd = liquidBalance * EOS_PRICE_USD;
                console.log(`Liquid Balance: ${liquidBalance.toFixed(4)} EOS (~$${liquidValueUsd.toFixed(2)} USD)`);

                let totalStakedEos = 0;
                if (accountInfo.total_resources && accountInfo.total_resources.cpu_weight && accountInfo.total_resources.net_weight) {
                    const cpuStaked = parseFloat(accountInfo.total_resources.cpu_weight.split(' ')[0]);
                    const netStaked = parseFloat(accountInfo.total_resources.net_weight.split(' ')[0]);
                    totalStakedEos = cpuStaked + netStaked;
                }
                let refundingEos = 0;
                if (accountInfo.refund_request) {
                    const cpuRefunding = parseFloat(accountInfo.refund_request.cpu_amount.split(' ')[0]);
                    const netRefunding = parseFloat(accountInfo.refund_request.net_amount.split(' ')[0]);
                    refundingEos = cpuRefunding + netRefunding;
                }
                const totalStakedOrRefundingEos = totalStakedEos + refundingEos;
                const stakedValueUsd = totalStakedOrRefundingEos * EOS_PRICE_USD;
                console.log(`Staked (CPU+NET): ${totalStakedEos.toFixed(4)} EOS`);
                console.log(`Refunding (CPU+NET): ${refundingEos.toFixed(4)} EOS`);
                console.log(`Total Staked/Refunding: ${totalStakedOrRefundingEos.toFixed(4)} EOS (~$${stakedValueUsd.toFixed(2)} USD)`);

                const currentAccountTotalValueEos = liquidBalance + totalStakedOrRefundingEos + ramValueEos;
                const currentAccountTotalValueUsd = currentAccountTotalValueEos * EOS_PRICE_USD;
                console.log(`Total Retrievable Value for ${accountName}: ${currentAccountTotalValueEos.toFixed(4)} EOS (~$${currentAccountTotalValueUsd.toFixed(2)} USD)`);

                // Accumulate for summary
                grandTotalLiquidEos += liquidBalance;
                grandTotalRamValueEos += ramValueEos;
                grandTotalStakedOrRefundingEosUnconditional += totalStakedOrRefundingEos;

                if (stakedValueUsd <= 1000) {
                    grandTotalStakedOrRefundingEosConditional += totalStakedOrRefundingEos;
                } else {
                    console.log(`  (Staked value for ${accountName} of $${stakedValueUsd.toFixed(2)} exceeds $1000, excluded from conditional staked summary)`);
                }

                if (accountInfo.last_code_update && accountInfo.last_code_update !== '1970-01-01T00:00:00.000') {
                    console.log(`${accountName} is a contract.`);
                } else {
                    console.log(`${accountName} is not a contract (no code deployed).`);
                }
            } catch (accountError) {
                console.error(`Error processing account ${accountName}:`, accountError.message);
                if (accountError.json) {
                    console.error(`Details:`, JSON.stringify(accountError.json, null, 2));
                }
            }
        } // End of for loop

    } catch (error) {
        console.error("Error in calculateAccountValue main try block:", error.message);
        if (error.json) {
            console.error("Error details:", JSON.stringify(error.json, null, 2));
        }
    } // End of main try-catch block

    // --- Print Summary --- 
    console.log(`

--- Overall Summary (across ${targetAccounts.length} processed accounts) ---`);

    const grandTotalLiquidUsd = grandTotalLiquidEos * EOS_PRICE_USD;
    console.log(`Total Liquid:                  ${grandTotalLiquidEos.toFixed(4)} EOS (~$${grandTotalLiquidUsd.toFixed(2)} USD)`);

    const grandTotalRamValueUsd = grandTotalRamValueEos * EOS_PRICE_USD;
    console.log(`Total RAM Value:               ${grandTotalRamValueEos.toFixed(4)} EOS (~$${grandTotalRamValueUsd.toFixed(2)} USD)`);

    const grandTotalStakedUsdUnconditional = grandTotalStakedOrRefundingEosUnconditional * EOS_PRICE_USD;
    console.log(`Total Staked (Unconditional):  ${grandTotalStakedOrRefundingEosUnconditional.toFixed(4)} EOS (~$${grandTotalStakedUsdUnconditional.toFixed(2)} USD)`);

    const grandTotalStakedUsdConditional = grandTotalStakedOrRefundingEosConditional * EOS_PRICE_USD;
    console.log(`Total Staked (Conditional):    ${grandTotalStakedOrRefundingEosConditional.toFixed(4)} EOS (~$${grandTotalStakedUsdConditional.toFixed(2)} USD)`);
    console.log(`  (Conditional: Ignores individual account staked values > $1000 USD)`);

    const grandOverallValueEosUnconditional = grandTotalLiquidEos + grandTotalRamValueEos + grandTotalStakedOrRefundingEosUnconditional;
    const grandOverallValueUsdUnconditional = grandOverallValueEosUnconditional * EOS_PRICE_USD;
    console.log(`----------------------------------------------------------------`);
    console.log(`GRAND TOTAL (Unconditional):   ${grandOverallValueEosUnconditional.toFixed(4)} EOS (~$${grandOverallValueUsdUnconditional.toFixed(2)} USD)`);

    const grandOverallValueEosConditional = grandTotalLiquidEos + grandTotalRamValueEos + grandTotalStakedOrRefundingEosConditional;
    const grandOverallValueUsdConditional = grandOverallValueEosConditional * EOS_PRICE_USD;
    console.log(`GRAND TOTAL (Conditional):     ${grandOverallValueEosConditional.toFixed(4)} EOS (~$${grandOverallValueUsdConditional.toFixed(2)} USD)`);
    console.log(`----------------------------------------------------------------`);

}; // End of calculateAccountValue function

program
    .command('calculate_value')
    .description('Calculate RAM, free coins, staked coins, and total value for hypha related EOS accounts.')
    .action(calculateAccountValue);

program.parse(process.argv);

var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
    program.help();
} 