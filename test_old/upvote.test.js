const { describe } = require('riteway')
const { eos, names, getTableRows, initContracts, sha256, fromHexString, isLocal, ramdom64ByteHexString, createKeypair, getBalance, sleep } = require('../scripts/helper')

const { daoContract, owner, firstuser, seconduser, thirduser, voice_token, husd_token, hyphatoken } = names
var crypto = require('crypto');
const { create } = require('domain');

const randomAccountName = () => {
  let length = 12
  var result = '';
  var characters = 'abcdefghijklmnopqrstuvwxyz1234';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const runAction = async ({contractName = "dao.hypha", action, data, actor}) => {

  console.log("About to run action:", action, "with data:", JSON.stringify(data));

  actor = actor ?? contractName

  return eos.api.transact({
    actions: [{
      account: contractName,
      name: action,
      authorization: [{
        actor: actor,
        permission: 'active',
      }],
      data: data,
    }]
  }, {
    blocksBehind: 3,
    expireSeconds: 30,
  });
}

const getItem = (label, value, type=Types.String) => (
  {
    "label": label,
    "value": [
        type,
        value
    ]
  }
)

const Types = {
  Int: 'int64',
  String: 'string',
  Checksum: 'checksum256',
  Asset: 'asset',
  Name: 'name',
  TimePoint: 'time_point',
} 

const sleepFor = async (ms) => {
  console.log("Sleeping for:", ms/1000, "seconds");
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  })
}

const setSetting = async (setting, value) => {
  return runAction({action: 'setsetting', data: { 
    key: setting, 
    value, 
    group: null}});
}

const initializeDHO = async () => {


  await sleepFor(2000);

  result = await setSetting('governance_token_contract', [Types.Name, voice_token]);
  
  console.log('Set DHO setting result:', result);

  result = await setSetting('reward_token_contract', [Types.Name, hyphatoken]);
  
  console.log('Set DHO setting result:', result);

  result = await setSetting('peg_token_contract', [Types.Name, husd_token]);
  
  console.log('Set DHO setting result:', result);

  result = await setSetting('treasury_contract', [Types.Name, 'mttrsryhypha']);
  
  console.log('Set setting result:', result);

  await sleepFor(2000);
}


const createDAOParams = ({
  dao_name,
  dao_title,
  dao_description,
  voting_duration_sec,
  peg_token,
  voice_token,
  reward_token,
  reward_token_max_supply,
  reward_to_peg_ratio,
  period_duration_sec,
  onboarder_account,
  voting_alignment_x100,
  voting_quorum_x100,
  period_count,
  primary_color,
}) => {
    return [[
      getItem('content_group_label', 'details', Types.String),
      getItem('dao_name', dao_name, Types.Name),
      getItem('dao_title', dao_title, Types.String),
      getItem('dao_description', dao_description, Types.String),
      getItem('voting_duration_sec', voting_duration_sec, Types.Int),
      getItem('peg_token', peg_token, Types.Asset),
      getItem('voice_token', voice_token, Types.Asset),
      getItem('reward_token', reward_token, Types.Asset),
      getItem('reward_token_max_supply', reward_token_max_supply, Types.Asset),
      getItem('reward_to_peg_ratio', reward_to_peg_ratio, Types.Asset),
      getItem('period_duration_sec', period_duration_sec, Types.Int),
      getItem('voting_alignment_x100', voting_alignment_x100, Types.Int),
      getItem('voting_quorum_x100', voting_quorum_x100, Types.Int),
      getItem('voice_token_decay_period', 200, Types.Int),
      getItem('voice_token_decay_per_period_x10M', 200000000, Types.Int),
      getItem('voice_token_multiplier', 3, Types.Int),
      getItem('treasury_token_multiplier', 2, Types.Int),
      getItem('utility_token_multiplier', 1, Types.Int),
      getItem('onboarder_account', onboarder_account, Types.Name),
      getItem('period_count', period_count, Types.Int),
      getItem('content_group_label', 'style', Types.String),
      getItem('primary_color', primary_color, Types.String),
      getItem('secondary_color', primary_color, Types.String),
      getItem('text_color', primary_color, Types.String),
      getItem('logo', 'random.png', Types.String),
      getItem('content_group_label', 'settings', Types.String),
      getItem('governance_token_contract', "voice.hypha", Types.String),
      
    ]]
  
}

describe('run upvote election', async assert => {

  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
    return
  }

  const newAccount = randomAccountName()
  console.log("New account " + newAccount)
  const keyPair = await createKeypair()
  console.log("new account keys: " + JSON.stringify(keyPair, null, 2))
  const newAccountPublicKey = keyPair.public

  const contract = await eos.contract(daoContract)

  // reset contract
  console.log("reset " + daoContract)
  await contract.reset({ authorization: `${daoContract}@active` })

  // create root
  console.log("create root " + daoContract)
  await contract.createroot('test root', { authorization: `${daoContract}@active` });

  // init initial settings
  console.log("set intial settings ")
  await initializeDHO()

  // create dao
  console.log("create dao " + "testdao")
  const params = createDAOParams({
    contract: daoContract,
    dao_name: "testdao",
    dao_title: "Test Ttle",
    dao_description: "Test descriptuin",
    voting_duration_sec: 60,
    peg_token: "10.00 HUSD",
    voice_token: "10.00 HVOICE",
    reward_token: "100.00 HYPHA",
    reward_token_max_supply: "1.00 HYPHA",
    reward_to_peg_ratio: "1.0 HUSD",
    period_duration_sec: 500,
    onboarder_account: owner,
    voting_alignment_x100: 80,
    voting_quorum_x100: 20,
    period_count: 12,
    primary_color: "#000000",
  })
  console.log("DAO params " + JSON.stringify(params, null, 2))
  await contract.createdao(params, { authorization: `${owner}@active` });


  assert({
    given: 'create account',
    should: 'a new account has been created on the blockchain',
    actual: account.account_name,
    expected: newAccount
  })


})




