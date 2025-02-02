require('dotenv').config()
const { exec } = require('child_process')
const { promisify } = require('util')
const fse = require('fs-extra')
var fs = require('fs');
var dir = './tmp';
const path = require('path');
const { isLocal, isTelosTestnet } = require('./helper');


const existsAsync = promisify(fs.exists)
const mkdirAsync = promisify(fs.mkdir)
const unlinkAsync = promisify(fs.unlink)
const execAsync = promisify(exec)

const command = ({ contract, source, include, dir, contractSourceName }) => {
  const volume = dir
  let cmd = ""
  let inc = include == "" ? "./include" : include

  contractSourceName = contractSourceName ?? contract
  console.log("XX compiling ... " + contractSourceName)

  const testingFlag = isLocal() ? " -DLOCAL_TEST" : ""
  const testnetFlag = isTelosTestnet() ? " -DIS_TELOS_TESTNET" : ""
if (process.env.COMPILER === 'local') {
  if (contractSourceName == "voice_token") {
    const args = contractSourceName + testingFlag + testnetFlag
    // TODO - grab additional source files and additional import locations using the contract name
    // list impportDirectories = ["include", "./document-graph/include", ...]
    // list sourcefiles = ["./src/upvote_election/election_round.cpp", "./src/upvote_election/graph.cpp", ...]
    // then generate the command from that
    console.log("compiling voice token... " + args)

    const contractName = "voice.hypha"

    const sourceFiles = [
      "./src/voice/decay.cpp",
      "./src/voice/voice.cpp",
    ]

    cmd = `eosio-cpp -abigen -I ./include/voice -I ./include/voice/tables -contract ${contractName} -o ./artifacts/voice_token.wasm ${sourceFiles.join(" ")}`

    console.log("command: " + cmd)


  } else if (contractSourceName == "upvote") {
    const args = contractSourceName + testingFlag + testnetFlag
    // TODO - grab additional source files and additional import locations using the contract name
    // list impportDirectories = ["include", "./document-graph/include", ...]
    // list sourcefiles = ["./src/upvote_election/election_round.cpp", "./src/upvote_election/graph.cpp", ...]
    // then generate the command from that
    console.log("compiling upvate... " + args)

    const sourceFiles = [
      "./src/upvote.cpp",
      "./src/upvote_election/election_round.cpp",
      "./src/upvote_election/graph.cpp",
      "./src/upvote_election/typed_document.cpp",
      "./src/upvote_election/upvote_election.cpp",
      "./src/upvote_election/vote_group.cpp",
      "./document-graph/src/document_graph/content.cpp",
      "./document-graph/src/document_graph/content_wrapper.cpp",
      "./document-graph/src/document_graph/document.cpp",
      "./document-graph/src/document_graph/document_graph.cpp",
      "./document-graph/src/document_graph/edge.cpp",
      "./document-graph/src/document_graph/util.cpp",
      "./document-graph/src/logger/logger.cpp",
    ]

    cmd = `eosio-cpp -abigen -I ./include -I ./document-graph/include -contract ${args} -o ./artifacts/upvote.wasm ${sourceFiles.join(" ")}`

    console.log("command: " + cmd)

  } else if (contractSourceName == "joinhypha") {
      const args = contractSourceName + testingFlag + testnetFlag
      console.log("compiling joinhypha... " + args)

      const sourceFiles = [
        "./src/hypha.accountcreator.cpp",
        "./document-graph/src/document_graph/content.cpp",
        "./document-graph/src/document_graph/content_wrapper.cpp",
        "./document-graph/src/document_graph/document.cpp",
        "./document-graph/src/document_graph/document_graph.cpp",
        "./document-graph/src/document_graph/edge.cpp",
        "./document-graph/src/document_graph/util.cpp",
        // "./document-graph/src/logger/logger.cpp",
        ]

      cmd = `eosio-cpp -abigen -I ./include -I ./document-graph/include -contract ${args} -o ./artifacts/${contract}.wasm ${sourceFiles.join(" ")}`

      console.log("command: " + cmd)

    } else {
    // normal contracts...
      cmd = "eosio-cpp -abigen -O=s --lto-opt=O3 --no-missing-ricardian-clause --fmerge-all-constants -I " + inc + " -I ./document-graph/include" + " -contract " + contractSourceName + testingFlag + testnetFlag + " -o ./artifacts/" + contract + ".wasm " + source; 
    }
  } else {
    cmd = `docker run --rm --name eosio.cdt_v1.7.0-rc1 --volume ${volume}:/project -w /project eostudio/eosio.cdt:v1.7.0-rc1 /bin/bash -c "echo 'starting';eosio-cpp -abigen -I ${inc} -contract ${contract} -o ./artifacts/${contract}.wasm ${source}"`
  }
  console.log("compiler command: " + cmd);
  return cmd
}

const compile = async ({ contract, source, include = "", contractSourceName }) => {
  // make sure source exists

  // const contractFound = await existsAsync(source)
  // if (!contractFound) {
  //   throw new Error('Contract not found: ' + contract + ' No source file: ' + source);
  // }

  const dir = process.cwd() + "/"
  // check directory
  // if (!dir.endsWith("seeds-smart-contracts/")) {
  //   throw new Error("You have to run from seeds-smart-contracts directory - comment out this line if installed in a different named folder ;)")
  // }
  const artifacts = dir + "artifacts"
  const buildDir = dir + "build/hypha"

  // make sure artifacts exists
  const artifactsFound = await existsAsync(artifacts)
  if (!artifactsFound) {
    console.log("creating artifacts directory...")
    await mkdirAsync(artifacts)
  }

  const buildDirFound = await existsAsync(buildDir)
  if (!buildDirFound) {
    console.log("creating build directory...")
    await mkdirAsync(buildDir, { recursive: true })
  }

  // clean build folder
  await deleteIfExists(artifacts + "/" + contract + ".wasm")
  await deleteIfExists(artifacts + "/" + contract + ".abi")

  // copy document-graph submodule to the project's paths
  const docGraphInclude = dir + 'include/document_graph'
  const docGraphSrc = dir + 'src/document_graph'

  // const docGraphIncludeFound = await existsAsync(docGraphInclude)
  // const docGraphSrcFound = await existsAsync(docGraphSrc)

  // if (!docGraphIncludeFound) {
  //   fse.copySync(dir + 'document-graph/include/document_graph', docGraphInclude, { overwrite: true }, (err) => {
  //     if (err) {
  //       throw new Error('' + err)
  //     } else {
  //       console.log("document graph submodule include prepared")
  //     }
  //   })
  // }

  // if (!docGraphSrcFound) {
  //   fse.copySync(dir + 'document-graph/src/document_graph', docGraphSrc, { overwrite: true }, (err) => {
  //     if (err) {
  //       throw new Error('' + err)
  //     } else {
  //       console.log("document graph submodule src prepared")
  //     }
  //   })
  // }

  // run compile
  const execCommand = command({ contract, source, include, dir, contractSourceName })
  await execAsync(execCommand)

  // copy files to build dir for unit testing
  copyFiles(artifacts, buildDir, buildFileMap)
}

const buildFileMap = {
  'login.abi': 'login.abi',
  'login.wasm': 'login.wasm',
  'joinhypha.abi': 'hypha.joinhypha.abi',
  'joinhypha.wasm': 'hypha.joinhypha.wasm',
  'paycpu.abi': 'hypha.paycpu.abi',
  'paycpu.wasm': 'hypha.paycpu.wasm',
  
  'sale.abi': 'hypha.sale.abi',
  'sale.wasm': 'hypha.sale.wasm',
  'launch_sale.abi': 'hypha.sale.abi',
  'launch_sale.wasm': 'hypha.sale.wasm',

  'tier_vesting.wasm': 'tier_vesting.wasm',
  'tier_vesting.abi': 'tier_vesting.abi',
  'staking.wasm': 'staking.wasm',
  'staking.abi': 'staking.abi',
  'upvote.wasm': 'upvote.wasm',
  'upvote.abi': 'upvote.abi',
}

function copyFiles(sourceDir, destinationDir, fileMap) {
  // Read the contents of the source directory
  fs.readdir(sourceDir, (err, files) => {
    if (err) {
      console.error('Error reading source directory:', err);
      return;
    }

    // Copy each file to the destination directory
    files.forEach((file) => {
      const sourcePath = path.join(sourceDir, file);
      const destinationFile = fileMap[file]
      if (!destinationFile) {
        // console.log('incomplete map missing ' + file + ' map: ' + fileMap)
        // console.log('ignored')
        return
        //throw 'incomplete map'
      }
      const destinationPath = path.join(destinationDir, destinationFile);

      // Create a read stream from the source file
      const readStream = fs.createReadStream(sourcePath);

      // Create a write stream to the destination file
      const writeStream = fs.createWriteStream(destinationPath);

      // Pipe the read stream to the write stream to perform the copy
      readStream.pipe(writeStream);

      // Log a message when the file copy is complete
      writeStream.on('finish', () => {
        //console.log(`Copied ${file} to ${destinationDir}`);
      });
    });
  });
}

const deleteIfExists = async (file) => {
  const fileExists = await existsAsync(file)
  if (fileExists) {
    try {
      await unlinkAsync(file)
      //console.log("deleted existing ", file)
    } catch (err) {
      console.error("delete file error: " + err)
    }
  }
}

module.exports = compile
