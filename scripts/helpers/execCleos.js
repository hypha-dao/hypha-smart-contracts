// {
//     "account": `"${daoContract}"`,
//     "name": "castupvote",
//     "authorization": [{
//         "actor": `"${membername}"`,
//         "permission": "active"
//     }
//     ],
//     "data": {
//         "round_id": `${roundId}`,
//         "group_id": `${groupId}`,
//         "voter": `"${membername}"`,
//         "voted_id": `${votingForId}`
//     },
// }

const { exec } = require('child_process');

const execCleos = async (actions = [], endPoint) => {
  // Convert actions array to JSON string
  const actionsJson = JSON.stringify(actions);

  // Construct the cleos command
  const cleosCommand = `cleos -u ${endPoint} push transaction '{"actions": ${actionsJson}}'`;

  console.log("Executing command: " + cleosCommand);

  return new Promise((resolve, reject) => {
    exec(cleosCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing cleos: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`cleos stderr: ${stderr}`);
        reject(new Error(stderr));
        return;
      }
      console.log(`cleos stdout: ${stdout}`);
      resolve(stdout);
    });
  });
};

module.exports = execCleos;
