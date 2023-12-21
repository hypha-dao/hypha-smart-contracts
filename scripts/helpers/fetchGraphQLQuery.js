const fetch = require('node-fetch');
require('dotenv').config()
const { graphQLEndpoint } = require('../helper');

const fetchGraphQLQuery = async (query, endpointUrl = graphQLEndpoint) => {
    var myHeaders = new Headers();
    myHeaders.append("Accept-Encoding", "gzip, deflate, br");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("DNT", "1");
    myHeaders.append("Origin", "file://");
    myHeaders.append("X-Dgraph-AccessToken", process.env.GRAPHQL_JWT_TOKEN); // fill in token - not we can also fetch a token...
        
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

