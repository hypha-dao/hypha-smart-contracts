const fetch = require('node-fetch');
const { graphQLEndpoint } = require('../helper');
const fetchGraphQLQuery = require('./fetchGraphQLQuery');
const query = `query MyQuery {
    getCursor(id: "c1") {
      id
      cursor
    }
  }
  `

const getLastBlock = async () => {
    const parsedResponse = await fetchGraphQLQuery(query)

    // console.log("getLastBlock output" + JSON.stringify(parsedResponse, null, 2))

    const cursorData = parsedResponse["data"]["getCursor"]["cursor"]
    // X_0B5mp4bX7KLQNq-wDexqWwLpcyBVxsVwrgLxdEj4rzoXTGjM7yAjN3PU-Ew6Dxi0HtTAuqi47EFi969pFRu9TpxO1s5CE6Ti9-woy6rrzsfPehb1gZcOozW7iMMNzRWDrUYAv-eLIB6tTia_XabkVka5MheGa12zpYpdACd_AS6HQ1xz30JZ3bha7D8tFFquQlReCknSilDzQofk0LPprQZqHMv24oYHw=__363215565__0__0"

    const numberPattern = /__(\d+)__0__0/;
    const match = cursorData.match(numberPattern);
    if (match) {
        // console.log("Extracted number:", match[1]);
        return  match[1]
    } else {
        console.log("No number found");
        return -1
    }

}

module.exports = getLastBlock

