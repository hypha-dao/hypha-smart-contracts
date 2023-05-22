const { execSync } = require("child_process");

function execute(command, ignoreFail = false) {
  try {
    return execSync(command, {
      encoding: "utf8",
    });
  } catch (e) {
    if (!ignoreFail) {
      throw e;
    }
    return "";
  }
}

const fixTime = async (chain) => {
  const name = "qtest" + chain.port;
  execute(`docker cp ${process.cwd()}/test/time/restart.sh ${name}:/app/node`);
};

module.exports = { fixTime };
