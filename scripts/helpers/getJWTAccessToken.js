const fetch = require('node-fetch');
const { gQLApiKeyEndpoints } = require('../helper');
require('dotenv').config()

const graphQlJwtApiUrl = gQLApiKeyEndpoints[process.env.EOSIO_NETWORK]

// How to: Include the token into headers like this:
// {
//     "X-Dgraph-AccessToken": ...
// }
const getJWTAccessToken = async () => {
    var requestOptions = {
        method: 'GET',
        redirect: 'follow'
      };

      // console.log("getting token from " + graphQlJwtApiUrl)
      
    const res = await fetch(graphQlJwtApiUrl, requestOptions)
      
    const json = await res.json();
    
    const accessJWT = json.accessJWT

    // console.log("ACCESS: " + accessJWT)

    return accessJWT
}

// getJWTAccessToken() // TESTING

module.exports = getJWTAccessToken
