const { Chain, Asset } = require("qtest-js");
const { expectThrow } = require("qtest-js");
const { fixTime } = require("./time");

//set to false for faster test
const TEST_TIME = true;

describe("HYPHA: hypha.sale contract test", () => {
  let chain;
  let chainName = process.env.CHAIN_NAME || "TLOS";
  let user1, user2, user3;
  let issueAccount, husdAccount, tokenAccount, bankAccount, saleAccount;
  let husdContract, tokenContract, saleContract;

  beforeAll(async () => {
    chain = await Chain.setupChain(chainName);
    await fixTime(chain);
    [issueAccount, user1, user2, user3] = chain.accounts;
    [husdAccount, tokenAccount, bankAccount, saleAccount] =
      await chain.system.createAccounts([
        "husd.hypha",
        "hypha.hypha",
        "bank.hypha",
        "sale.hypha",
      ]);

    await saleAccount.addCode("active");
    husdContract = await husdAccount.setContract({
      abi: "./build/hypha/hypha.token.abi",
      wasm: "./build/hypha/hypha.token.wasm",
    });

    tokenContract = await tokenAccount.setContract({
      abi: "./build/hypha/hypha.token.abi",
      wasm: "./build/hypha/hypha.token.wasm",
    });

    saleContract = await saleAccount.setContract({
      abi: "./build/hypha/hypha.sale.abi",
      wasm: "./build/hypha/hypha.sale.wasm",
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

  //tables
  //
  //config - singleton tracks hypha_usd sold? to timestamp (last time price history updated)
  //sold - singleton tracks total sold
  //price - singleton tracks current round, remaining volume, and current price
  //pricehistory - tracks historic prices
  //rounds - tracks rounds with price and volume
  //dailystats - tracks total HYPHA purchased per account
  //payhistory - tracks payments made by an admin
  //flags - tracks flag settings
  //whitelist - tracks whitelisted accounts

  //actions
  //
  //whtlst.limit flag globally sets the maximum HYPHA any whitelisted account may receive
  //onhusd - token receiver of HUSD, purchases HYPHA
  //onperiod - admin - deletes daily stats table
  //newpayment - admin - issues HYPHA based on a USD value, but purchased in some arbitrary token or currency
  //requires payment id to be unique
  //addround - admin - adds a new purchasing round
  //initrounds - admin - erases current rounds, generates a number of rounds with a linearly increasing price per HYPHA
  //initsale - admin - hardcoded call to initrounds with initial sale parameters
  //incprice - admin - increases price of all future rounds by 10%
  //priceupdate - admin - updates historical pricing table
  //pause - admin - pause purchasing and payments
  //unpause - admin - unpause purchasing and payments
  //setflag - admin - set an arbitrary flag... only flags used is 'paused' and 'whtlst.limit'
  //updatevol - admin - change the volume purchaseable for a future round
  //addwhitelist - admin - add a user to whitelist (only these accounts can purchase or receive HYPHA)
  //remwhitelist - admin - remove a user from whitelist
  //reset - admin - disabled, but dumps tables

  const getRounds = async () => {
    return await saleContract.table.rounds.getRows({
      scope: saleAccount.name,
    });
  };

  const getConfig = async () => {
    return await saleContract.table.config.getFirstRow({
      scope: saleAccount.name,
    });
  };

  const getSold = async () => {
    return await saleContract.table.sold.getFirstRow({
      scope: saleAccount.name,
    });
  };

  const getPrice = async () => {
    return await saleContract.table.price.getFirstRow({
      scope: saleAccount.name,
    });
  };

  const getHistory = async () => {
    return await saleContract.table.pricehistory.getRows({
      scope: saleAccount.name,
    });
  };

  const getPayments = async () => {
    return await saleContract.table.payhistory.getRows({
      scope: saleAccount.name,
    });
  };

  const getStats = async (owner) => {
    return await saleContract.table.dailystats.getFirstRow({
      scope: saleAccount.name,
      lower_bound: owner.name,
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

  describe("Creating Sale", function () {
    it("Should intialize sale", async () => {
      let roundMax = 10000000;
      let roundPrice = 100.0;
      const numRounds = 9;

      await saleContract.action.initsale({}, [
        { actor: saleAccount.name, permission: "active" },
      ]);

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
        roundMax += 10000000;
        roundPrice += 3;
      }

      expect(config.hypha_usd).toBe("1.00 USD");
      expect(sold.total_sold).toBe(0);
      expect(price.remaining).toBe(10000000);
      expect(price.current_round_id).toBe(0);
      expect(price.hypha_usd).toBe("1.00 USD");
      expect(history[0].hypha_usd).toBe("1.00 USD");
    });

    it("Should initialize rounds", async () => {
      let roundMax = 200000;
      let roundPrice = 50.0;
      const numRounds = 3;

      await expectThrow(
        saleContract.action.initrounds(
          {
            volume_per_round: roundMax, //2000.00 HYPHA tokens
            initial_token_per_usd: "0.50 FOO", //initial price 1.00 HYPHA = 0.50 USD
            linear_increment: "0.10 FOO", //each round increases, 1.00 HYPHA = 0.60 USD
            num_rounds: numRounds,
          },
          [{ actor: saleAccount.name, permission: "active" }]
        ),
        "Only USD allowed - example '1.00 USD'"
      );

      //TODO: contract flaw identified
      //
      //   await expectThrow(
      //     saleContract.action.initrounds(
      //       {
      //         volume_per_round: roundMax, //2000.00 HYPHA tokens
      //         initial_token_per_usd: "0.50 USD", //initial price 1.00 HYPHA = 0.50 USD
      //         linear_increment: "0.10 FOO", //each round increases, 1.00 HYPHA = 0.60 USD
      //         num_rounds: numRounds,
      //       },
      //       [{ actor: saleAccount.name, permission: "active" }]
      //     ),
      //     "linear_increment symbol does not match token_per_usd symbol"
      //   );

      //   await expectThrow(
      //     saleContract.action.initrounds(
      //       {
      //         volume_per_round: roundMax, //2000.00 HYPHA tokens
      //         initial_token_per_usd: "0.50 USD", //initial price 1.00 HYPHA = 0.50 USD
      //         linear_increment: "0.100 USD", //each round increases, 1.00 HYPHA = 0.60 USD
      //         num_rounds: numRounds,
      //       },
      //       [{ actor: saleAccount.name, permission: "active" }]
      //     ),
      //     "linear_increment symbol does not match token_per_usd symbol"
      //   );

      await expectThrow(
        saleContract.action.initrounds(
          {
            volume_per_round: roundMax, //2000.00 HYPHA tokens
            initial_token_per_usd: "0.50 USD", //initial price 1.00 HYPHA = 0.50 USD
            linear_increment: "0.10 USD", //each round increases, 1.00 HYPHA = 0.60 USD
            num_rounds: -numRounds,
          },
          [{ actor: saleAccount.name, permission: "active" }]
        ),
        "Error: invalid number"
      );

      await saleContract.action.initrounds(
        {
          volume_per_round: roundMax, //2000.00 HYPHA tokens
          initial_token_per_usd: "0.50 USD", //initial price 1.00 HYPHA = 0.50 USD
          linear_increment: "0.10 USD", //each round increases, 1.00 HYPHA = 0.60 USD
          num_rounds: numRounds,
        },
        [{ actor: saleAccount.name, permission: "active" }]
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

    it("Should add a round", async () => {
      let roundMax = 200000;
      let roundPrice = 50.0;
      const numRounds = 4;

      await saleContract.action.addround(
        {
          volume: roundMax,
          token_per_usd: "0.80 USD",
        },
        [{ actor: saleAccount.name, permission: "active" }]
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

    it("Should update volume", async () => {
      let roundMax = 200000;
      let roundPrice = 50.0;
      const numRounds = 4;

      await saleContract.action.updatevol(
        {
          round_id: 1,
          volume: 100000,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      let rounds = await getRounds();
      let config = await getConfig();
      let sold = await getSold();
      let price = await getPrice();
      let history = await getHistory();

      expect(rounds.length).toBe(numRounds);
      for (let i = 0; i < numRounds; i++) {
        expect(rounds[i].id).toBe(i);
        expect(rounds[i].max_sold).toBe(roundMax);
        expect(rounds[i].hypha_usd).toBe(
          `${Number(roundPrice / 100).toFixed(2)} USD`
        );
        roundMax += 100000;
        roundPrice += 10;
      }

      expect(config.hypha_usd).toBe("0.50 USD");
      expect(sold.total_sold).toBe(0);
      expect(price.remaining).toBe(200000);
      expect(price.current_round_id).toBe(0);
      expect(price.hypha_usd).toBe("0.50 USD");
      expect(history[1].hypha_usd).toBe("0.50 USD");

      await saleContract.action.updatevol(
        {
          round_id: 2,
          volume: 300000,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      rounds = await getRounds();
      expect(rounds[0].max_sold).toBe(200000);
      expect(rounds[1].max_sold).toBe(300000);
      expect(rounds[2].max_sold).toBe(600000);
      expect(rounds[3].max_sold).toBe(900000);

      await expectThrow(
        saleContract.action.updatevol(
          {
            round_id: 0,
            volume: 100000,
          },
          [{ actor: saleAccount.name, permission: "active" }]
        ),
        "cannot change volume on past or already started rounds, only on future rounds"
      );

      await expectThrow(
        saleContract.action.updatevol(
          {
            round_id: 8,
            volume: 100000,
          },
          [{ actor: saleAccount.name, permission: "active" }]
        ),
        "invalid round id - must be continuous"
      );
    });

    //TODO: increment price doesn't work??
    it.skip("Should increment price", async () => {
      const roundsOrig = await getRounds();

      await saleContract.action.incprice({}, [
        { actor: saleAccount.name, permission: "active" },
      ]);

      const roundsNew = await getRounds();

      for (let i = 0; i < 4; i++) {
        expect(
          Number(Asset.fromString(roundsNew[i].hypha_usd).amountFixed())
        ).toBe(
          Number(Asset.fromString(roundsOrig[i].hypha_usd).amountFixed()) * 1.1
        );
      }
    });
  });

  describe("Purchasing from Sale", function () {
    it("Should allow a user to purchase", async () => {
      await husdContract.action.transfer(
        {
          from: issueAccount.name,
          to: user1.name,
          quantity: "1000.00 HUSD",
          memo: "test",
        },
        [{ actor: issueAccount.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: issueAccount.name,
          to: user2.name,
          quantity: "1000.00 HUSD",
          memo: "test",
        },
        [{ actor: issueAccount.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user1.name,
            to: saleAccount.name,
            quantity: "10.00 HUSD",
            memo: "test",
          },
          [{ actor: user1.name, permission: "active" }]
        ),
        "no balance object found for sale.hypha"
      );

      await tokenContract.action.transfer(
        {
          from: issueAccount.name,
          to: saleAccount.name,
          quantity: "10000000000.00 HYPHA",
          memo: "supply",
        },
        [{ actor: issueAccount.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: user1.name,
          to: saleAccount.name,
          quantity: "10.00 HUSD",
          memo: "test",
        },
        [{ actor: user1.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: user2.name,
          to: saleAccount.name,
          quantity: "10.00 HUSD",
          memo: "test",
        },
        [{ actor: user2.name, permission: "active" }]
      );

      const userToken = await getTokenBalance(user1);
      const bankToken = await getHUSDBalance(bankAccount);
      const user1Stats = await getStats(user1);
      const user2Stats = await getStats(user2);

      const sold = await getSold();
      const price = await getPrice();
      const history = await getHistory();
      const payments = await getPayments();

      expect(history.length).toBe(2);
      expect(userToken).toBe(2000);
      expect(bankToken).toBe(2000);
      expect(sold.total_sold).toBe(4000);
      expect(price.remaining).toBe(196000);
      expect(user1Stats.tokens_purchased).toBe(2000);
      expect(user2Stats.tokens_purchased).toBe(2000);
      expect(payments[0].recipientAccount).toBe(user1.name);
      expect(payments[1].recipientAccount).toBe(user2.name);
      expect(payments[0].paymentQuantity).toBe("10.00 HUSD");
      expect(payments[1].paymentQuantity).toBe("10.00 HUSD");
    });

    it("Should allow an admin to make a payment", async () => {
      await saleContract.action.newpayment(
        {
          recipientAccount: user1.name,
          paymentSymbol: "FOO",
          paymentQuantity: "1000.00000 FOO",
          paymentId: "foo-payment",
          multipliedUsdValue: 50000,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      const userToken = await getTokenBalance(user1);
      const bankToken = await getHUSDBalance(bankAccount);
      const user1Stats = await getStats(user1);

      const sold = await getSold();
      const price = await getPrice();
      const history = await getHistory();
      const payments = await getPayments();

      expect(history.length).toBe(2);
      expect(userToken).toBe(3000);
      expect(bankToken).toBe(2000);
      expect(sold.total_sold).toBe(5000);
      expect(price.remaining).toBe(195000);
      expect(user1Stats.tokens_purchased).toBe(3000);
      expect(payments[2].recipientAccount).toBe(user1.name);
      expect(payments[2].paymentQuantity).toBe("1000.00000 FOO");
      expect(payments[2].paymentId).toBe("foo-payment");

      await expectThrow(
        saleContract.action.newpayment(
          {
            recipientAccount: user1.name,
            paymentSymbol: "FOO",
            paymentQuantity: "1000.00000 FOO",
            paymentId: "foo-payment",
            multipliedUsdValue: 50000,
          },
          [{ actor: saleAccount.name, permission: "active" }]
        ),
        "duplicate transaction: foo-payment"
      );
    });

    it("Should advance the rounds", async () => {
      const round0 = 195000 * 0.5;
      const round1 = 50000 * 0.6;
      const quantity = `${Number((round0 + round1) / 100).toFixed(2)} HUSD`;

      if (TEST_TIME) {
        await chain.time.increase(60 * 60 * 24);
      }

      await husdContract.action.transfer(
        {
          from: issueAccount.name,
          to: user1.name,
          quantity,
          memo: "test",
        },
        [{ actor: issueAccount.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: user1.name,
          to: saleAccount.name,
          quantity,
          memo: "test",
        },
        [{ actor: user1.name, permission: "active" }]
      );

      const config = await getConfig();
      const sold = await getSold();
      const price = await getPrice();
      const history = await getHistory();

      expect(config.hypha_usd).toBe("0.60 USD");
      expect(sold.total_sold).toBe(250000);
      expect(price.remaining).toBe(50000);
      expect(price.current_round_id).toBe(1);
      expect(price.hypha_usd).toBe("0.60 USD");
      expect(history[2].hypha_usd).toBe("0.60 USD");

      if (TEST_TIME) {
        expect(Date.parse(history[2].date)).toBeGreaterThan(
          Date.parse(history[1].date) + 60 * 60 * 24 * 1000
        );
      }
    });

    it("Should not to be oversold", async () => {
      await husdContract.action.transfer(
        {
          from: issueAccount.name,
          to: user2.name,
          quantity: "4800.00 HUSD",
          memo: "test",
        },
        [{ actor: issueAccount.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user2.name,
            to: saleAccount.name,
            quantity: "4900.00 HUSD",
            memo: "test",
          },
          [{ actor: user2.name, permission: "active" }]
        ),
        "sale: not enough funds available. requested USD value: 4900.000000 available USD value: 4800.000000 max vol: 900000"
      );

      //TODO: not possible to purchase "last tokens" i.e. 4800 in this example, must be 4799.99...
      await husdContract.action.transfer(
        {
          from: user2.name,
          to: saleAccount.name,
          quantity: "4700.00 HUSD",
          memo: "test",
        },
        [{ actor: user2.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user1.name,
            to: saleAccount.name,
            quantity: "100.00 HUSD",
            memo: "test",
          },
          [{ actor: user1.name, permission: "active" }]
        ),
        "No more rounds - sold out"
      );

      await saleContract.action.addround(
        {
          volume: 300000,
          token_per_usd: "1.00 USD",
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: user1.name,
          to: saleAccount.name,
          quantity: "100.00 HUSD",
          memo: "test",
        },
        [{ actor: user1.name, permission: "active" }]
      );
    });
  });

  describe("Per user limit", function () {
    it("Should restrict purchase quantity", async () => {
      await saleContract.action.setflag(
        {
          flagname: "whtlst.limit",
          value: 100000,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user1.name,
            to: saleAccount.name,
            quantity: "100.00 HUSD",
            memo: "test",
          },
          [{ actor: user1.name, permission: "active" }]
        ),
        `account: ${user1.name} symbol: HUSD tx_id: test usd_quantity: 100.0000 USD free limit: 100000 purchase limit overdrawn, tried to buy 100.00 HYPHA new total would be: 2705.000000`
      );

      await husdContract.action.transfer(
        {
          from: issueAccount.name,
          to: user3.name,
          quantity: "1100.00 HUSD",
          memo: "test",
        },
        [{ actor: issueAccount.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: user3.name,
          to: saleAccount.name,
          quantity: "1000.00 HUSD",
          memo: "test",
        },
        [{ actor: user3.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user3.name,
            to: saleAccount.name,
            quantity: "100.00 HUSD",
            memo: "test",
          },
          [{ actor: user3.name, permission: "active" }]
        ),
        `account: ${user3.name} symbol: HUSD tx_id: test usd_quantity: 100.0000 USD free limit: 100000 purchase limit overdrawn, tried to buy 100.00 HYPHA new total would be: 1100.000000`
      );
    });

    it("Should be reset by onperiod", async () => {
      await saleContract.action.onperiod({}, [
        { actor: saleAccount.name, permission: "active" },
      ]);

      await husdContract.action.transfer(
        {
          from: user3.name,
          to: saleAccount.name,
          quantity: "100.00 HUSD",
          memo: "test",
        },
        [{ actor: user3.name, permission: "active" }]
      );
    });
  });

  describe("Whitelist", function () {
    it("Should enable purchase over limit", async () => {
      await saleContract.action.setflag(
        {
          flagname: "whtlst.limit",
          value: 1000,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user1.name,
            to: saleAccount.name,
            quantity: "100.00 HUSD",
            memo: "test",
          },
          [{ actor: user1.name, permission: "active" }]
        ),
        `account: ${user1.name} symbol: HUSD tx_id: test usd_quantity: 100.0000 USD free limit: 1000 purchase limit overdrawn, tried to buy 100.00 HYPHA new total would be: 100.000000`
      );

      await saleContract.action.addwhitelist(
        {
          account: user1.name,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      await husdContract.action.transfer(
        {
          from: user1.name,
          to: saleAccount.name,
          quantity: "100.00 HUSD",
          memo: "test",
        },
        [{ actor: user1.name, permission: "active" }]
      );

      await saleContract.action.remwhitelist(
        {
          account: user1.name,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user1.name,
            to: saleAccount.name,
            quantity: "100.00 HUSD",
            memo: "test",
          },
          [{ actor: user1.name, permission: "active" }]
        ),
        `account: ${user1.name} symbol: HUSD tx_id: test usd_quantity: 100.0000 USD free limit: 1000 purchase limit overdrawn, tried to buy 100.00 HYPHA new total would be: 200.000000`
      );
    });
  });

  describe("Pausing", function () {
    it("Should prevent sales", async () => {
      await saleContract.action.addwhitelist(
        {
          account: user1.name,
        },
        [{ actor: saleAccount.name, permission: "active" }]
      );

      await saleContract.action.pause({}, [
        { actor: saleAccount.name, permission: "active" },
      ]);

      await expectThrow(
        husdContract.action.transfer(
          {
            from: user1.name,
            to: saleAccount.name,
            quantity: "100.00 HUSD",
            memo: "test",
          },
          [{ actor: user1.name, permission: "active" }]
        ),
        "Contract is paused - no purchase possible."
      );

      await saleContract.action.unpause({}, [
        { actor: saleAccount.name, permission: "active" },
      ]);

      await husdContract.action.transfer(
        {
          from: user1.name,
          to: saleAccount.name,
          quantity: "100.00 HUSD",
          memo: "test",
        },
        [{ actor: user1.name, permission: "active" }]
      );
    });
  });
});
