// docGraph.js
// a primitive document graph API

const { eos, names, getTableRows, isLocal } = require('../scripts/helper')

const { daoContract } = names

// documents cache is indexed by id
const documentCache = new Map();

// keep edges cache in a list since we search by id, to_node, from_node, and edge_name
const edgesCache = [];

// Function to fetch and cache data for the "documents" table.
// const sampleDoc = {
//     "id": 34,
//     "creator": "dao.hypha",
//     "content_groups": "[[.., .., ..]]"
// }

// Function to fetch and cache data for the "edges" table (similar to the "documents" function).

// const sampleEdge = {
//     "id": "594700601685",
//     "from_node": 143,
//     "to_node": 22,
//     "edge_name": "dao",

//     // indexing information for smart contract
//     "from_node_edge_name_index": "8456217534",
//     "from_node_to_node_index": "9113964776",
//     "to_node_edge_name_index": "48095504269",

//     // meta info
//     "created_date": "2023-10-03T17:49:56.000",
//     "creator": "x4kzig3hzg1t",
//     "contract": "dao.hypha"
// }


// Function to update the cache for the "documents" table with the latest data.
async function updateDocumentCache() {
    try {
        let lowerBound = documentCache.size > 0 ? Math.max(...documentCache.keys()) + 1 : 0; // Start from the highest cached ID + 1

        const params = {
            code: daoContract,
            scope: daoContract,
            table: 'documents',
            lower_bound: lowerBound,
            limit: 200, // Adjust the limit as needed
        }
        console.log("params: " + JSON.stringify(params, null, 2))
        while (true) {
            const response = await getTableRows({
                code: daoContract,
                scope: daoContract,
                table: 'documents',
                lower_bound: lowerBound,
                limit: 200, // Adjust the limit as needed
            });

            if (response.rows.length === 0) {
                // No more records to fetch
                break;
            }

            // Update the cache with the newly fetched data.
            for (const row of response.rows) {
                documentCache[row.id] = row;
                lowerBound = row.id + 1; // Update the lower bound for the next iteration
            }
        }
        //console.log("docs " + JSON.stringify(documentCache, null, 2))
    } catch (error) {
        console.error('Error updating documents cache:', error);
        throw error;
    }
}

// Function to update the cache for the "edges" table (similar to the "updateDocumentCache" function).
async function updateEdgesCache() {
    try {
        let lowerBound = edgesCache.length > 0 ? edgesCache[edgesCache.length - 1].id + 1 : 0; // Start from the highest cached ID + 1

        while (true) {
            const response = await getTableRows({
                code: daoContract, // Contract name
                scope: daoContract, // Table name
                table: 'edges', // Table name
                lower_bound: lowerBound,
                limit: 200,
            });

            if (response.rows.length === 0) {
                // No more records to fetch
                break;
            }

            // Update the cache with the newly fetched data.
            for (const row of response.rows) {
                edgesCache.push(row);
                lowerBound = row.id + 1; // Update the lower bound for the next iteration
            }
        }

        //console.log("edges: " + JSON.stringify(edgesCache, null, 2))

    } catch (error) {
        console.error('Error updating edges cache:', error);
        throw error;
    }
}

// Function to find all edges with a given from_node and edge_name.
function findEdgesByFromNodeAndEdgeName(fromNode, edgeName) {
    return edgesCache.filter(edge => edge.from_node === fromNode && edge.edge_name === edgeName);
}

// Function to find all edges with a given to_node and edge_name.
function findEdgesByToNodeAndEdgeName(toNode, edgeName) {
    return edgesCache.filter(edge => edge.to_node === toNode && edge.edge_name === edgeName);
}

function findEdgeById(id) {
    const res = edgesCache.filter(edge => edge.id === id);
    if (res.length > 0) {
        return res[0]
    } else {
        console.log("edge id " + id + " not found")
        return undefined
    }
}

module.exports = { documentCache, edgesCache, updateDocumentCache, updateEdgesCache, findEdgeById, findEdgesByFromNodeAndEdgeName, findEdgesByToNodeAndEdgeName }