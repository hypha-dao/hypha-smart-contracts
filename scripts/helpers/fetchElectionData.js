const fetch = require('node-fetch')

const fetchElectionData = async (daoName, endpointUrl = "https://alpha-stts.tekit.io/graphql") => {
    var myHeaders = new Headers();
    myHeaders.append("Accept-Encoding", "gzip, deflate, br");
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Connection", "keep-alive");
    myHeaders.append("DNT", "1");
    myHeaders.append("Origin", "file://");
    
    var raw = JSON.stringify({
      "query": `query {\n  getDao(details_daoName_n: \"${daoName}\") {\n    docId\n\n    ueUpcoming {\n      docId\n      ueStartrnd {\n        ueGroupLnk {\n          docId\n        }\n      }\n    }\n    ueOngoing {\n      docId\n\n      # ueStartrnd {\n      #   docId\n      #   ueGroupLnk {\n      #     docId\n      #     ueVote {\n      #       docId\n      #       details_voterId_i\n      #       details_votedId_i\n      #     }\n      #     ueGroupWin {\n      #       docId\n      #     }\n      #   }\n      # }\n\n      ueCurrnd {\n        docId\n        ueGroupLnk {\n          docId\n          ueRdMember {\n            docId\n            details_member_n\n          }\n          ueGroupWin {\n            docId\n          }\n        }\n      }\n    }\n#     ueElection {\n#       docId\n#       ueRound {\n#         docId\n#         nextround {\n#           docId\n#         }\n#         ueGroupLnk {\n#           docId\n#           ueVote {\n#             docId\n#             details_voterId_i\n#             details_votedId_i\n#           }\n#           ueGroupWin {\n#             docId\n#           }\n#         }\n#       }\n#       ueStartrnd {\n#         docId\n#         ueGroupLnk {\n#           docId\n#           ueVote {\n#             docId\n#             details_voterId_i\n#             details_votedId_i\n#           }\n#           ueGroupWin {\n#             docId\n#           }\n#         }\n#       }\n\n#       ueCurrnd {\n#         docId\n#         ueGroupLnk {\n#           docId\n#           ueRdMember {\n#             docId\n#             details_member_n\n#           }\n#           ueGroupWin {\n#             docId\n#           }\n#         }\n#       }\n#     }\n  }\n}\n`
    });
    
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    

    const res = await fetch(endpointUrl, requestOptions)
    const parsedResponse = await res.json();

    return parsedResponse
}

module.exports = fetchElectionData


/////////////// Data may look like this
// const roundOneData2 = {
//     "data": {
//       "getDao": {
//         "docId": "41567",
//         "ueUpcoming": [],
//         "ueOngoing": [
//           {
//             "docId": "41578",
//             "ueStartrnd": [
//               {
//                 "docId": "41579",
//                 "ueGroupLnk": [
//                   {
//                     "docId": "41705",
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41706",
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41707",
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41708",
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41709",
//                     "ueGroupWin": []
//                   }
//                 ]
//               }
//             ],
//             "ueCurrnd": [
//               {
//                 "docId": "41579",
//                 "ueGroupLnk": [
//                   {
//                     "docId": "41705",
//                     "ueRdMember": [
//                       {
//                         "docId": "41293",
//                         "details_member_n": "hupetest1241"
//                       },
//                       {
//                         "docId": "41307",
//                         "details_member_n": "hupetest1314"
//                       },
//                       {
//                         "docId": "41313",
//                         "details_member_n": "hupetest1323"
//                       },
//                       {
//                         "docId": "41329",
//                         "details_member_n": "hupetest1343"
//                       },
//                       {
//                         "docId": "41335",
//                         "details_member_n": "hupetest1412"
//                       }
//                     ],
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41706",
//                     "ueRdMember": [
//                       {
//                         "docId": "41289",
//                         "details_member_n": "hupetest1233"
//                       },
//                       {
//                         "docId": "41303",
//                         "details_member_n": "hupetest1312"
//                       },
//                       {
//                         "docId": "41317",
//                         "details_member_n": "hupetest1331"
//                       },
//                       {
//                         "docId": "41321",
//                         "details_member_n": "hupetest1333"
//                       },
//                       {
//                         "docId": "41331",
//                         "details_member_n": "hupetest1344"
//                       }
//                     ],
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41707",
//                     "ueRdMember": [
//                       {
//                         "docId": "41287",
//                         "details_member_n": "hupetest1232"
//                       },
//                       {
//                         "docId": "41301",
//                         "details_member_n": "hupetest1311"
//                       },
//                       {
//                         "docId": "41311",
//                         "details_member_n": "hupetest1322"
//                       },
//                       {
//                         "docId": "41315",
//                         "details_member_n": "hupetest1324"
//                       },
//                       {
//                         "docId": "41325",
//                         "details_member_n": "hupetest1341"
//                       }
//                     ],
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41708",
//                     "ueRdMember": [
//                       {
//                         "docId": "41297",
//                         "details_member_n": "hupetest1243"
//                       },
//                       {
//                         "docId": "41299",
//                         "details_member_n": "hupetest1244"
//                       },
//                       {
//                         "docId": "41309",
//                         "details_member_n": "hupetest1321"
//                       },
//                       {
//                         "docId": "41327",
//                         "details_member_n": "hupetest1342"
//                       },
//                       {
//                         "docId": "41333",
//                         "details_member_n": "hupetest1411"
//                       }
//                     ],
//                     "ueGroupWin": []
//                   },
//                   {
//                     "docId": "41709",
//                     "ueRdMember": [
//                       {
//                         "docId": "41291",
//                         "details_member_n": "hupetest1234"
//                       },
//                       {
//                         "docId": "41295",
//                         "details_member_n": "hupetest1242"
//                       },
//                       {
//                         "docId": "41305",
//                         "details_member_n": "hupetest1313"
//                       },
//                       {
//                         "docId": "41319",
//                         "details_member_n": "hupetest1332"
//                       },
//                       {
//                         "docId": "41323",
//                         "details_member_n": "hupetest1334"
//                       }
//                     ],
//                     "ueGroupWin": []
//                   }
//                 ]
//               }
//             ]
//           }
//         ],
//         "ueElection": [
//           {
//             "docId": "41578"
//           }
//         ]
//       }
//     },
//     "extensions": {
//       "touched_uids": 128
//     }
//   }
 