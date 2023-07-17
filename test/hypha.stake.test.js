const { Chain, Asset } = require("qtest-js");
const { expectThrow } = require("qtest-js");
const { fixTime } = require("./time");

//set to false for faster test
const TEST_TIME = true;

const { assert } = require('chai');
const { Chain } = require('qtest');

describe('Staking Contract', () => {
  let chain;
  let stakingContract;
  let accounts;

  before(async () => {
    chain = await Chain.setupChain('EOS');
    stakingContract = await chain.system.setContract({
      abi: './contracts/build/stake.abi',
      wasm: './contracts/build/stake.wasm',
    });

    // Access test accounts
    accounts = chain.accounts;
  });

  it('should stake tokens', async () => {
    const fromAccount = accounts[1];
    const toAccount = accounts[2];
    const quantity = '10.0000 EOS';

    // Initial balances
    const initialFromBalance = await getAccountBalance(fromAccount);
    const initialToBalance = await getAccountBalance(toAccount);
    const initialStake = await getStake(fromAccount, toAccount);

    // Stake tokens
    await stakingContract.stake(fromAccount, toAccount, quantity);

    // Verify balances
    const finalFromBalance = await getAccountBalance(fromAccount);
    const finalToBalance = await getAccountBalance(toAccount);
    const finalStake = await getStake(fromAccount, toAccount);

    assert.equal(
      finalFromBalance - initialFromBalance,
      -quantity,
      'From account balance decreased correctly'
    );
    assert.equal(
      finalToBalance - initialToBalance,
      quantity,
      'To account balance increased correctly'
    );

    assert.equal(
      finalStake - initialStake,
      quantity,
      'Stake quantity increased correctly'
    );
  });

  it('should unstake tokens', async () => {
    const fromAccount = accounts[1];
    const toAccount = accounts[2];
    const quantity = '5.0000 EOS';

    // Initial balances
    const initialFromBalance = await getAccountBalance(fromAccount);
    const initialToBalance = await getAccountBalance(toAccount);
    const initialStake = await getStake(fromAccount, toAccount);

    // Unstake tokens
    await stakingContract.unstake(fromAccount, toAccount, quantity);

    // Verify balances
    const finalFromBalance = await getAccountBalance(fromAccount);
    const finalToBalance = await getAccountBalance(toAccount);
    const finalStake = await getStake(fromAccount, toAccount);

    assert.equal(
      finalFromBalance - initialFromBalance,
      quantity,
      'From account balance increased correctly'
    );
    assert.equal(
      finalToBalance - initialToBalance,
      -quantity,
      'To account balance decreased correctly'
    );

    assert.equal(
      finalStake - initialStake,
      -quantity,
      'Stake quantity decreased correctly'
    );
  });

  async function getAccountBalance(account) {
    const accountsTable = await chain.getTableRows({
      code: 'stakingContractAccount',
      scope: account.name,
      table: 'accounts',
      json: true,
    });

    const accountEntry = accountsTable.find((entry) => entry.account_name === account.name);
    return accountEntry ? accountEntry.balance : '0.0000 EOS';
  }

  async function getStake(fromAccount, toAccount) {
    const stakesTable = await chain.getTableRows({
      code: 'stakingContractAccount',
      scope: getStakeScope(fromAccount, toAccount),
      table: 'stakes',
      json: true,
    });

    const stakeEntry = stakesTable.find(
      (entry) => entry.account_name === fromAccount.name && entry.beneficiary === toAccount.name
    );
    return stakeEntry ? stakeEntry.quantity : '0.0000 EOS';
  }

  function getStakeScope(fromAccount, toAccount) {
    const fromValue = fromAccount.name.value;
    const toValue = toAccount.name.value;
    return (fromValue << 32) | toValue;
  }
});

describe("HYPHA: hypha.stake contract test", () => {
  let chain;
  let chainName = process.env.CHAIN_NAME || "TLOS";
  let user1, user2, user3;
  let issueAccount, husdAccount, tokenAccount, bankAccount, stakeAccount;
  let husdContract, tokenContract, stakeContract;

  beforeAll(async () => {
    chain = await Chain.setupChain(chainName);
    await fixTime(chain);
    [issueAccount, user1, user2, user3] = chain.accounts;
    [husdAccount, tokenAccount, bankAccount, stakeAccount] =
      await chain.system.createAccounts([
        "husd.hypha",
        "hypha.hypha",
        "bank.hypha",
        "stake.hypha",
      ]);

    await stakeAccount.addCode("active");
    husdContract = await husdAccount.setContract({
      abi: "./build/hypha/hypha.token.abi",
      wasm: "./build/hypha/hypha.token.wasm",
    });

    tokenContract = await tokenAccount.setContract({
      abi: "./build/hypha/hypha.token.abi",
      wasm: "./build/hypha/hypha.token.wasm",
    });

    stakeContract = await stakeAccount.setContract({
      abi: "./build/hypha/hypha.stake.abi",
      wasm: "./build/hypha/hypha.stake.wasm",
    });

    await husdContract.action.create(
      {
        issuer: issueAccount.name,
        max_supply: "10000000000.00 HUSD",
      },
      [{ actor: husdAccount.name, permission: "active" }]
    );

    await husdContract.action.issue(
      {
        to: issueAccount.name,
        quantity: "10000000000.00 HUSD",
        memo: "issue",
      },
      [{ actor: issueAccount.name, permission: "active" }]
    );

    await tokenContract.action.create(
      {
        issuer: issueAccount.name,
        max_supply: "10000000000.00 HYPHA",
      },
      [{ actor: tokenAccount.name, permission: "active" }]
    );

    await tokenContract.action.issue(
      {
        to: issueAccount.name,
        quantity: "10000000000.00 HYPHA",
        memo: "issue",
      },
      [{ actor: issueAccount.name, permission: "active" }]
    );
  }, 60000);

  afterAll(async () => {
    await chain.clear();
  }, 10000);


  const getDaoStakes = async () => {
    return await stakeContract.table.daoaccounts.getRows({
      scope: stakeAccount.name,
    });
  };

  const getHUSDBalance = async (owner) => {
    const row = await husdContract.table.accounts.getFirstRow({
      scope: owner.name,
    });

    return Number(Asset.fromString(row.balance).amountFixed()) * 100;
  };

  const getTokenBalance = async (owner) => {
    const row = await tokenContract.table.accounts.getFirstRow({
      scope: owner.name,
    });

    return Number(Asset.fromString(row.balance).amountFixed()) * 100;
  };

  describe("Staking and unstaking", function () {
    it("Stake something", async () => {

      await stakeContract.action.initsale({}, [
        { actor: stakeAccount.name, permission: "active" },
      ]);

      // TODO modify
      expect(rounds.length).toBe(numRounds);

      expect(config.hypha_usd).toBe("1.00 USD");
      expect(sold.total_sold).toBe(0);
      expect(price.remaining).toBe(10000000);
      expect(price.current_round_id).toBe(0);
      expect(price.hypha_usd).toBe("1.00 USD");
      expect(history[0].hypha_usd).toBe("1.00 USD");
    });

    it("Unstake", async () => {


      await expectThrow(
        stakeContract.action.initrounds(
          {
            volume_per_round: roundMax, //2000.00 HYPHA tokens
            initial_token_per_usd: "0.50 USD", //initial price 1.00 HYPHA = 0.50 USD
            linear_increment: "0.10 USD", //each round increases, 1.00 HYPHA = 0.60 USD
            num_rounds: -numRounds,
          },
          [{ actor: stakeAccount.name, permission: "active" }]
        ),
        "Error: invalid number"
      );

      await stakeContract.action.initrounds(
        {
          volume_per_round: roundMax, //2000.00 HYPHA tokens
          initial_token_per_usd: "0.50 USD", //initial price 1.00 HYPHA = 0.50 USD
          linear_increment: "0.10 USD", //each round increases, 1.00 HYPHA = 0.60 USD
          num_rounds: numRounds,
        },
        [{ actor: stakeAccount.name, permission: "active" }]
      );

      const rounds = await getRounds();
      const config = await getConfig();
      const sold = await getSold();
      const price = await getPrice();
      const history = await getHistory();

      expect(rounds.length).toBe(numRounds);
      for (let i = 0; i < numRounds; i++) {
        expect(rounds[i].id).toBe(i);
        expect(rounds[i].max_sold).toBe(roundMax);
        expect(rounds[i].hypha_usd).toBe(
          `${Number(roundPrice / 100).toFixed(2)} USD`
        );
        roundMax += 200000;
        roundPrice += 10;
      }

      expect(config.hypha_usd).toBe("0.50 USD");
      expect(sold.total_sold).toBe(0);
      expect(price.remaining).toBe(200000);
      expect(price.current_round_id).toBe(0);
      expect(price.hypha_usd).toBe("0.50 USD");
      expect(history[1].hypha_usd).toBe("0.50 USD");
    });

    it("Unstake illegal", async () => {
      await expectThrow(
        stakeContract.action.updatevol(
          {
            round_id: 0,
            volume: 100000,
          },
          [{ actor: stakeAccount.name, permission: "active" }]
        ),
        "cannot change volume on past or already started rounds, only on future rounds"
      );

      await expectThrow(
        stakeContract.action.updatevol(
          {
            round_id: 8,
            volume: 100000,
          },
          [{ actor: stakeAccount.name, permission: "active" }]
        ),
        "invalid round id - must be continuous"
      );
    });

  });


});
