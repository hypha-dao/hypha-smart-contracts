const fetch = require('node-fetch');
const { graphQLEndpoint } = require('../helper');

const fetchGraphQLQuery = async (query, endpointUrl = graphQLEndpoint) => {
    var myHeaders = new Headers();
    myHeaders.append("Accept-Encoding", "gzip, deflate, br");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("DNT", "1");
    myHeaders.append("Origin", "file://");
        
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

