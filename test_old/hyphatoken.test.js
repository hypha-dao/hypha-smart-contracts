const { describe } = require('riteway')
const { eos, names, getTableRows, initContracts, sha256, fromHexString, isLocal, ramdom64ByteHexString, createKeypair, getBalance, sleep, keyProvider } = require('../scripts/helper')

const { hyphatoken, firstuser, seconduser, thirduser } = names


const randomSymbolName = () => {
  let length = 7
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

describe('change issuer', async assert => {

  if (!isLocal()) {
    console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
    return
  }

  const contract = await eos.contract(hyphatoken)
  const symbol = randomSymbolName()
  console.log("testing symbol " + symbol)

  await contract.create(hyphatoken,'10000000.00 ' + symbol, { authorization: `${hyphatoken}@active` });
  await contract.changeissuer(symbol, firstuser, { authorization: `${hyphatoken}@active` });

  const stat = (await getTableRows({
    code: hyphatoken,
    scope: symbol,
    table: 'stat'
  })).rows[0]

  //console.log("tablerows " + JSON.stringify(stat, null, 2))

  assert({
    given: 'change issuer',
    should: 'new issuer',
    actual: stat.issuer,
    expected: firstuser
  })

})