const { describe } = require('riteway')
const { eos, names, getTableRows, initContracts, sha256, fromHexString, isLocal, ramdom64ByteHexString, createKeypair, getBalance, sleep } = require('../scripts/helper')

const { joinhypha, firstuser, seconduser, thirduser } = names
var crypto = require('crypto');

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

const generateSecret = async () => {
  // Generate a random secret (32 bytes)
  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);

  // Convert the secret to a checksum256 string
  const secretChecksum256 = await sha256(Buffer.from(secret));

  // Hash the secret using SHA256
  // Note: sha256 needs to be called on a byte buffer so we take our secret and convert it
  // back to a byte buffer, then hash that.
  const hashedSecret = sha256(Buffer.from(secretChecksum256, 'hex'))

  // verify here: 
  // https://emn178.github.io/online-tools/sha256.html - set input type to "hex"
  console.log('Generated Secret:', secretChecksum256)
  console.log('Hashed Secret:', hashedSecret)

  return {
    secret: secretChecksum256,
    hashedSecret
  }
}


describe('create account', async assert => {

  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
    return
  }

  const newAccount = randomAccountName()
  console.log("New account " + newAccount)
  const keyPair = await createKeypair()
  console.log("new account keys: " + JSON.stringify(keyPair, null, 2))
  const newAccountPublicKey = keyPair.public

  const contract = await eos.contract(joinhypha)

  console.log("set oracle account authorized to create accounts")
  await contract.setconfig(seconduser, seconduser, { authorization: `${joinhypha}@active` })

  console.log("activate")
  await contract.activate({ authorization: `${joinhypha}@active` })

  console.log("create")
  await contract.create(newAccount, newAccountPublicKey, { authorization: `${seconduser}@active` })

  var anybodyCanCreateAnAccount = false
  try {
    const acct2 = randomAccountName()
    console.log("creating acct " + acct2)
    await contract.create(acct2, newAccountPublicKey, { authorization: `${firstuser}@active` })
    anybodyCanCreateAnAccount = true;
  } catch (err) {
    console.log("expected error")
  }

  const config = await eos.getTableRows({
    code: joinhypha,
    scope: joinhypha,
    table: 'config',
    json: true
  })

  console.log("conig " + JSON.stringify(config))

  const account = await eos.getAccount(newAccount)

  console.log("new account exists: " + JSON.stringify(account))

  assert({
    given: 'create account',
    should: 'a new account has been created on the blockchain',
    actual: account.account_name,
    expected: newAccount
  })

  assert({
    given: 'create account by invalid oracle',
    should: 'oracle cant create accounts',
    actual: anybodyCanCreateAnAccount,
    expected: false
  })



})

const getLastInvitesRow = async () => await eos.getTableRows({
  code: joinhypha,
  scope: joinhypha,
  table: 'invites',
  json: true,
  reverse: true,
  limit: 1,
})

describe('test invite', async assert => {

  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
    return
  }

  const inviterAccount = firstuser
  const beneficiaryAccount = thirduser
  const secret = await generateSecret()
  
  const contract = await eos.contract(joinhypha)

  console.log("set oracle account authorized to create accounts")
  // await contract.setconfig(seconduser, seconduser, { authorization: `${joinhypha}@active` })

  console.log("activate")
  // await contract.activate({ authorization: `${joinhypha}@active` })

  console.log("set contract")
  await contract.setkv("dao.contract", ["name", "dao.hypha"], { authorization: `${joinhypha}@active` })

  console.log("createinvite")

  const lastInviteBeforeRows = getLastInvitesRow()
  console.log("lastInviteBeforeRows " + JSON.stringify(lastInviteBeforeRows, null, 2))

  await contract.createinvite(299, 'somedao', 'A Test Dao', inviterAccount, secret.hashedSecret, { authorization: `${inviterAccount}@active` })

  const invites = await getLastInvitesRow()

  console.log("invites " + JSON.stringify(invites, null, 2))
  const lastInvite = invites.rows[0]

  console.log("redeem invite")

  await contract.redeeminvite(beneficiaryAccount, secret.secret, { authorization: `${beneficiaryAccount}@active` })

  const lastInviteAfterRows = getLastInvitesRow()

  console.log('b4: ' + JSON.stringify(lastInviteBeforeRows, null, 2))
  console.log('after: ' + JSON.stringify(lastInviteAfterRows, null, 2))

  assert({
    given: 'create invite',
    should: 'a new invite has been created',
    actual: lastInvite,
    expected: {
      "invite_id": lastInvite.invite_id,
      "dao_id": 299,
      "dao_name": "somedao",
      "dao_fullname": "A Test Dao",
      "inviter": inviterAccount,
      "hashed_secret": secret.hashedSecret
    }
  })

  assert({
    given: 'redeem invite',
    should: 'the invite has been consumed',
    actual: lastInviteAfterRows,
    expected: lastInviteBeforeRows,
  })




})

