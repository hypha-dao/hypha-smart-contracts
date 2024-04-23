# Hypha Staking Contract - Documentation

## Overview
The staking contract allows any Telos account to stake any amount of HYPHA tokens on any DAO. 

It keeps track of each individual stake in the stakes table, of the total staked on a DAO in the daoaccounts table and of potential account balances in the accounts table. 

## Deployment
The staking contract is deployed to stake.hypha

## Functions
- Stake
- Unstake
- Refund
- (on transfer of HYPHA token) 

## Tables
**accounts**: account balances for stakers 

**daoaccounts**: balances of DAOs - each dao is referenced by their short name, and total stake quantity

**stakes**: a table that contains all stakes - id, from (the staker), to (the dao staked to), quantity.

## Usage

### Staking an amount of HYPHA

Staking is done by sending Hypha tokens to the contract, then invoking the "stake" function with the same amount. 

#### Example
Given a user aaa111111111 and a DAO with short name dao111111111
The user wants to stake 10 Hypha on this DAO. 

1. User  aaa111111111 transfers "10.00 HYPHA" to stake.hypha

```
{
    "account": "hypha.hypha",
    "name": "transfer",
    "authorization": [
        {
            "actor": "aaa111111111",
            "permission": "active"
        }
    ],
    "data": {
        "from": "aaa111111111",
        "to": "stake.hypha",
        "quantity": "10.00 HYPHA",
        "memo": ""
    }
}

```

2. User aaa111111111 invokes the function "stake" the following parameters 
```
{
    "account": "stake.hypha",
    "name": "stake",
    "authorization": [{
        "actor": "aaa111111111",
        "permission": "active"
    }
    ],
    "data": {
        "from": "aaa111111111",
        "to": "dao111111111",
        "quantity": "10.00 HYPHA"
    },
}
```

### Unstaking

The reverse of staking
```
{
    "account": "stake.hypha",
    "name": "unstake",
    "authorization": [{
        "actor": "aaa111111111",
        "permission": "active"
    }
    ],
    "data": {
        "from": "aaa111111111",
        "to": "dao111111111",
        "quantity": "10.00 HYPHA"
    },
}

```

### Get a refund

Unstaking does not send money directly back to the user. 

It needs to be followed by a call to refund. Refund refunds the user back tokens up to the amount they have as free balance in the "accounts" table. 

Refund always refunds the entire free balance of a user. 

```
    [[eosio::action]] void refund(name account);
{
    "account": "stake.hypha",
    "name": "refund",
    "authorization": [{
        "actor": "aaa111111111",
        "permission": "active"
    }
    ],
    "data": {
        "account": "aaa111111111",
    },
}

```
