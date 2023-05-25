require('dotenv').config(); 
const { Api, JsonRpc } = require('eosjs');
const { TextEncoder, TextDecoder } = require('util');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('isomorphic-fetch'); // Import the 'isomorphic-fetch' package


// Configure EOSJS with the endpoint URL and the private key of the account
const endpoint = 'https://mainnet.telos.net';  // Replace with your EOSIO endpoint URL

const contractPrivateKey = process.env.PAYCPU_KEY;
const targetPrivateKey = process.env.PRIVATE_KEY;

console.log("keys " + [contractPrivateKey, targetPrivateKey])

const signatureProvider = new JsSignatureProvider([
  contractPrivateKey,
  targetPrivateKey,
]);
const rpc = new JsonRpc(endpoint, { fetch });
const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

// Define the contract account and the target account
const contractAccount = 'paycpu.hypha';  // Replace with the account name of the paycpu contract
const targetAccount = 'testingseeds';  // Replace with the target account you want to pass to the payforcpu action

async function callPayForCpu() {
  try {
    // Get the account information to fetch the required authorization keys
    const account = await rpc.get_account(targetAccount);

    // Construct the transaction actions
    const actions = [{
      account: contractAccount,
      name: 'payforcpu',
      authorization: [
        { actor: contractAccount, permission: 'payforcpu' },  // Authorize the contract
        { actor: targetAccount, permission: 'active' },    // Authorize the target account
      ],
      data: {
        account: targetAccount,
      },
    }];

    // Construct the transaction
    const transaction = {
      actions,
    };

    // Sign and broadcast the transaction
    const result = await api.transact(transaction, {
      blocksBehind: 3,
      expireSeconds: 30,
    });

    console.log('Transaction ID:', result.transaction_id);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the payforcpu function
callPayForCpu();

// ❯ cleosm push action paycpu.hypha configure '{ "contractName":"dao.hypha" }' -p paycpu.hypha@active
// executed transaction: 71b9917b2ed9a24a3f15c35ad77effc3c5c86bba45563ae27f8ad02d86b2681c  104 bytes  3991 us
// #  paycpu.hypha <= paycpu.hypha::configure      {"contractName":"dao.hypha"}

// ❯ cleos get table paycpu.hypha paycpu.hypha configs
// {
//     "rows": [{
//         "contractName": "dao.hypha"
//       }
//     ],
//     "more": false,
//     "next_key": "",
//     "next_key_bytes": ""
//   }