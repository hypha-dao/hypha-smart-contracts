# Hypha Contracts + Testing framework

# Setup

### Git

```
git submodule init
git submodule update
```

### New Compile and Test Directions

Initialize packages

```
yarn install
```

Compile contracts (requires latest CDT installed)
[https://github.com/AntelopeIO/cdt]

```
mkdir build
cd build
cmake ..
make
```

Run tests (requires Docker installed)
[https://docs.docker.com/engine/install/]

```
yarn run test
```

### Environment

The .env file contains keys for local, testnet, and potentially mainnet

It also contains a compiler setting - use either local compiler or Docker based compiler

Copy the example to .env

```
cp .env.example .env
```

### Compiler Setup in .env file

The COMPILER variable can either be docker or local - if you have eos-cpp installed on your local machine you can use local, if you want to use a docker container make sure docker is running and it'll do everything for you.

### Tools Setup

```
npm install
```

### Start single-node local test network

The local testnet is required for unit tests.

```
nodeos -e -p eosio --plugin eosio::producer_plugin --plugin eosio::producer_api_plugin --plugin eosio::chain_api_plugin --plugin eosio::http_plugin --plugin eosio::history_plugin --plugin eosio::history_api_plugin --filter-on="*" --access-control-allow-origin='*' --access-control-allow-headers "*" --contracts-console --http-validate-host=false --delete-all-blocks --delete-state-history --verbose-http-errors >> nodeos.log 2>&1
```

### Create local testnet owner account

This requires a wallet capable of signing the "create account" action, for example `cleos`.

```
cleos wallet create --to-console
cleos wallet import --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3 # LOCAL_PRIVATE_KEY in .env file
cleos create account eosio owner EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV # Public key matching above
```

# Deploy Tools

Use the do.js script to

### init all contracts and deploy them on local network

```
./scripts/do.js init
```

### update contract permissions

This command will update all permissions for a contract

It will check if a permission is already set and only set permissions that
have been added or have been changed.

Permissions for a contract can affect other contracts, example give contract A eosio.code permission
on contract B.

Permissions are defined in helper.js / contractPermissions

```
./scripts/do.js permissions <contract>
```

### Compile, deploy, or test a contract

```
./scripts/do.js compile harvest => compiles harvest.cpp
```

```
./scripts/do.js deploy joinhypha => deploys account creator contract
```

```
./scripts/do.js test harvest => run unit tests on harvest contract
```

```
./scripts/do.js run harvest => compile, deploy, and run unit tests
```

### Specify more than one contract -

Contract is a varadic parameter

```
./scripts/do.js run accounts onboarding organization
```

### Deploy on Telos testnet

```
EOSIO_NETWORK=telosTestnet ./scripts/do.js deploy joinhypha
```

### Deploy on Telos mainnet

```
EOSIO_NETWORK=telosMainnet ./scripts/do.js deploy joinhypha
```

### Deploy on EOS mainnet

Note: For EOS deployment, make sure to call powerup on the contract that will
be deployed, so it has enough CPU and NET.

```
EOSIO_NETWORK=eosMainnet ./scripts/do.js deploy joinhypha
```

### Deploy on EOS Jungle 4 testnet

Note: For EOS test deployment, make sure to call powerup on the contract that will
be deployed, so it has enough CPU and NET.
Use faucet and powerup on EOS jungle 4 website: https://monitor4.jungletestnet.io/#home

```
EOSIO_NETWORK=eosTestnet ./scripts/do.js deploy joinhypha
```

### usage do.js

```
./scripts/do.js <command> <contract name> [additional contract names...]
command = compile | deploy | test | run
```

### run a contract - compile, then deploy

This is good for local iterations.

```
example:
./scripts/do.js run harvest => compiles seeds.harvest.cpp, deploys it
```

### generate contract documentation

This command will generate html automatically based on the contract ABI files.

The <comment> tags inside the documents will be left untouched, even when they are regenerated.

This will generate docs only for the `accounts` contract.

```
./scripts/do.js docsgen accounts:
```

This will generate all contracts:

```
./scripts/do.js docsgen all
```

This will regenerate the index.html file:

```
./scripts/do.js docsgen index
```
