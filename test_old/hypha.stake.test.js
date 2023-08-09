const { describe } = require('riteway');
const { eos, names, sleep } = require('../scripts/helper'); // Replace with your own helper functions

const { stake, firstuser, seconduser, thirduser, fourthuser } = names;

const setup = async () => {
  
  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset contracts on mainnet or testnet");
    return;
  }

  console.log("init contracts");
  const contract = await eos.contract(stake);
  const tokenContract = await eos.contract(hyphatoken);

  console.log("reset contract");
  await contract.reset({ authorization: `${stake}@active` }); // Reset contract tables

  return { contract, tokenContract };
};

describe('Stake Contract', async assert => {
  //const contract = await setup();

  describe('Staking and Unstaking', async assert => {
    const { contract, tokenContract } = await setup();

    describe('Staking', async assert => {
        const stakedAmount = "100.00 HYPHA";

        await contract.stake(firstuser, fourthuser, stakedAmount, { authorization: `${firstuser}@active` });

        const accounts = await getAccountsTable();
        const daoAccounts = await getDaoAccountsTable();
        const stakes = await getStakesTable();

        assert({
            given: 'Staking action',
            should: 'increase balance, create stake entry, and update daoaccount balance',
            actual: {
                accountBalance: accounts[firstuser].balance,
                stakeEntry: stakes[0],
                daoAccountBalance: daoAccounts[fourthuser].balance
            },
            expected: {
                accountBalance: "9900.00 HYPHA", // Adjust this based on the previous account balance
                stakeEntry: {
                    id: 0,
                    account_name: firstuser,
                    beneficiary: fourthuser,
                    quantity: stakedAmount
                },
                daoAccountBalance: stakedAmount
            }
        });
    });

    describe('Unstaking', async assert => {
        const unstakedAmount = "50.00 HYPHA";

        await contract.unstake(firstuser, fourthuser, unstakedAmount, { authorization: `${firstuser}@active` });

        const accounts = await getAccountsTable();
        const daoAccounts = await getDaoAccountsTable();
        const stakes = await getStakesTable();

        assert({
            given: 'Unstaking action',
            should: 'decrease balance, remove stake entry, and update daoaccount balance',
            actual: {
                accountBalance: accounts[firstuser].balance,
                stakeEntry: stakes.length,
                daoAccountBalance: daoAccounts[fourthuser].balance
            },
            expected: {
                accountBalance: "9950.00 HYPHA", // Adjust this based on the previous account balance
                stakeEntry: 0,
                daoAccountBalance: "50.00 HYPHA" // Adjust this based on the previous staked amount
            }
        });
    });
});
  
  describe('Transfer Notification', async assert => {
    // Test cases for transfer notification
    // Use assert to check expected behavior
  });

  describe('Boundary Cases', async assert => {
    // Test cases for edge cases and boundary values
    // Use assert to check expected behavior
  });

  describe('Beneficiary Filtering', async assert => {
    // Test cases for querying by beneficiary
    // Use assert to check expected behavior
  });

  describe('Table Updates', async assert => {
    // Test cases for verifying table updates
    // Use assert to check expected behavior
  });
});
