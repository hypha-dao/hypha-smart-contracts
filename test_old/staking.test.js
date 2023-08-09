const { describe } = require('riteway');
const { eos, names, sleep, isLocal } = require('../scripts/helper'); // Replace with your own helper functions

const { staking, firstuser, seconduser, thirduser, fourthuser, hyphatoken } = names;

const setup = async () => {
  
  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset contracts on mainnet or testnet");
    return;
  }

  console.log("init contracts");
  const contract = await eos.contract(staking);
  const tokenContract = await eos.contract(hyphatoken);

  console.log("reset contract");
  await contract.reset({ authorization: `${staking}@active` }); // Reset contract tables

  return { contract, tokenContract };
};

const getAccountsEntry = async (account) => {
  const accountsTable = await eos.getTableRows({
    code: staking,
    scope: staking,
    table: 'accounts',
    lower_bound: account,
    upper_bound: account,
    json: true
  });
  return accountsTable.rows[0];
};

const getDaoAccountsEntry = async (account) => {
  const daoAccountsTable = await eos.getTableRows({
    code: staking,
    scope: staking,
    table: 'daoaccounts',
    lower_bound: account,
    upper_bound: account,
    json: true
  });
  return daoAccountsTable.rows[0];
};

const getStakeEntryForAccount = async (account) => {
  const stakesTable = await eos.getTableRows({
    code: staking,
    scope: staking,
    table: 'stakes',
    index_position: 3,  // Use the index for 'account'
    key_type: 'i64',
    lower_bound: account,
    upper_bound: account,
    json: true
  });
  return stakesTable.rows.length > 0 ? stakesTable.rows[0] : null;
};

describe('Stake Contract', async assert => {

  describe('Staking and Unstaking', async assert => {
    const { contract, tokenContract } = await setup();

    describe('Staking', async assert => {
      const stakedAmount = "100.00 HYPHA";

      console.log('transfer ')
      await tokenContract.transfer(firstuser, staking, stakedAmount, "initial transfer", { authorization: `${firstuser}@active` });

      console.log('stake')
      await contract.stake(firstuser, fourthuser, stakedAmount, { authorization: `${firstuser}@active` });

      const accountsEntry = await getAccountsEntry(firstuser);
      const daoAccountsEntry = await getDaoAccountsEntry(fourthuser);
      const stakeEntry = await getStakeEntryForAccount(firstuser);

      assert({
          given: 'Staking action',
          should: 'increase balance, create staking entry, and update daoaccount balance',
          actual: {
              accountBalance: accountsEntry.balance,
              stakeEntry: stakeEntry,
              daoAccountBalance: daoAccountsEntry.balance
          },
          expected: {
              accountBalance: "0.00 HYPHA", 
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
        const unstakedAmount = "30.00 HYPHA";

        await contract.unstake(firstuser, fourthuser, unstakedAmount, { authorization: `${firstuser}@active` });

        const accountsEntry = await getAccountsEntry(firstuser);
        const daoAccountsEntry = await getDaoAccountsEntry(fourthuser);
        const stakeEntry = await getStakeEntryForAccount(firstuser);
  
        
        assert({
            given: 'Unstaking action',
            should: 'decrease balance, remove staking entry, and update daoaccount balance',
            actual: {
                accountBalance: accountsEntry.balance,
                stakeEntry: stakeEntry,
                daoAccountBalance: daoAccountsEntry.balance
            },
            expected: {
              accountBalance: "30.00 HYPHA", 
              stakeEntry: {
                  id: 0,
                  account_name: firstuser,
                  beneficiary: fourthuser,
                  quantity: "70.00 HYPHA", 
              },
              daoAccountBalance: "70.00 HYPHA"
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
