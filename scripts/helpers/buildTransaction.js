const { JsonRpc, Api, Serialize } = require('eosjs')

const fetch = require('node-fetch')
const util = require('util')
const zlib = require('zlib')

const textEncoder = new util.TextEncoder()
const textDecoder = new util.TextDecoder()

const { SigningRequest } = require("eosio-signing-request")

async function buildTransaction(actions, endpoint = 'https://mainnet.telos.net') {

    const rpc = new JsonRpc(endpoint, {
        fetch
    })

    const eos = new Api({
        rpc,
        textDecoder,
        textEncoder,
    })

    const opts = {
        textEncoder,
        textDecoder,
        zlib: {
            deflateRaw: (data) => new Uint8Array(zlib.deflateRawSync(Buffer.from(data))),
            inflateRaw: (data) => new Uint8Array(zlib.inflateRawSync(Buffer.from(data))),
        },
        abiProvider: {
            getAbi: async (account) => (await eos.getAbi(account))
        }
    }

    const info = await rpc.get_info();
    const head_block = await rpc.get_block(info.last_irreversible_block_num);
    const chainId = info.chain_id;

    // Note: Only 1 hour expiration - the problem with longer expirations is that we may get a "transaction expiration too far
    // in the future" error. 
    const expiration = Serialize.timePointSecToDate(Serialize.dateToTimePointSec(head_block.timestamp) + 3600 )
        
    const transaction = {
        expiration,
        ref_block_num: head_block.block_num & 0xffff, // 
        ref_block_prefix: head_block.ref_block_prefix,
        max_net_usage_words: 0,
        delay_sec: 0,
        context_free_actions: [],
        actions: actions,
        transaction_extensions: [],
        signatures: [],
        context_free_data: []
    };
    const request = await SigningRequest.create({ transaction, chainId }, opts);
    const uri = request.encode();
    return uri
}

module.exports = buildTransaction