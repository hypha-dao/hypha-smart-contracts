const { JsonRpc, Api, Serialize } = require('eosjs')
const fetch = require('node-fetch')
const { TextEncoder, TextDecoder } = require('util')
const Eos = require('../../scripts/eosjs-port')

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const rpc = new JsonRpc('https://mainnet.telos.net', {
    fetch
})

const eos = new Api({
    rpc,
    textDecoder,
    textEncoder,
})

const rpc_testnet = new JsonRpc('https://test.hypha.earth', {
    fetch
})

const eos_testnet = new Api({
    rpc_testnet,
    textDecoder,
    textEncoder,
})

const getEos = (endpoint = "https://mainnet.telos.net") => {
    const textEncoder = new TextEncoder()
    const textDecoder = new TextDecoder()

    const rpc = new JsonRpc(endpoint, {
        fetch
    })

    return new Api({
        rpc,
        textDecoder,
        textEncoder,
    })
}

const getEosPort = (endpoint = "https://mainnet.telos.net") => {

    const keyProvider = []

    const networks = {
        telosTestnet: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
        telosMainnet: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11'
      }

    const chainId = networks.telosMainnet

    const httpEndpoint = endpoint
      
    const config = {
        keyProvider,
        httpEndpoint,
        chainId
      }
      
    const eos = new Eos(config, false)

    return eos
      

}



module.exports = { eos, eos_testnet, getEos, getEosPort }