const fetch = require('node-fetch');
require('dotenv').config()

const graphQlJwtApiUrl = process.env.GRAPHQL_JWT_API_EOS_MAINNET

// How to: Include the token into headers like this:
// {
//     "X-Dgraph-AccessToken": ...
// }
const getJWTAccessToken = async () => {
    var requestOptions = {
        method: 'GET',
        redirect: 'follow'
      };
      
    const res = await fetch(graphQlJwtApiUrl, requestOptions)
      
    const json = await res.json();
    
    const accessJWT = json.accessJWT

    // console.log("ACCESS: " + accessJWT)

    return accessJWT
}

// getJWTAccessToken() // TESTING

module.exports = getJWTAccessToken
