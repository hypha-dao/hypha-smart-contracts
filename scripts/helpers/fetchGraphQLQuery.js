const fetch = require('node-fetch');
require('dotenv').config()
const { graphQLEndpoint } = require('../helper');
const getJWTAccessToken = require('./getJWTAccessToken');


const tokenCache = {
  token: undefined,
  date: undefined
}

    // get a new access token - no idea how long they're valid for...
const getToken = async () => {
  const fetchNew = tokenCache.date == undefined || ((new Date() - tokenCache.date) / 60000 > 5) 
  if (fetchNew) {
    const jwtToken = await getJWTAccessToken()
    tokenCache.token = jwtToken
    tokenCache.date = new Date()
  }
  return tokenCache.token
}

const fetchGraphQLQuery = async (query, endpointUrl = graphQLEndpoint) => {

    const jwtToken = await getToken()
    console.log("got token " + jwtToken)

    var myHeaders = new Headers();
    myHeaders.append("Accept-Encoding", "gzip, deflate, br");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("DNT", "1");
    myHeaders.append("Origin", "file://");

    myHeaders.append("X-Dgraph-AccessToken", jwtToken); 
        
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({"query" : query}) ,
      redirect: 'follow'
    };
    

    const res = await fetch(endpointUrl, requestOptions)
    const parsedResponse = await res.json();
    return parsedResponse
}

module.exports = fetchGraphQLQuery

