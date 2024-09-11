# Pangea Testnet Deploy 

## Permissions Actions

### dao.hypha permissions - add scheduler, linkauth

#### 1 Add scheduler permission

```json
{
      "account": "eosio",
      "name": "updateauth",
      "authorization": [
        {
          "actor": "dao.hypha",
          "permission": "owner"
        }
      ],
      "data": {
        "account": "dao.hypha",
        "permission": "scheduler",
        "parent": "active",
        "auth": {
          "threshold": 1,
          "waits": [],
          "accounts": [],
          "keys": [
            {
              "key": "EOS6Cmu3MiVXvXAnz3NFZ7sBztGh38Em7FsifT8in7XwMXhNePgNE",
              "weight": 1
            }
          ]
        }
      }
    }
```
#### 2 Link auth

```json
{
    "account": "eosio",
    "name": "linkauth",
    "authorization": [
      {
        "actor": "dao.hypha",
        "permission": "owner"
      }
    ],
    "data": {
      "account": "dao.hypha",
      "code": "dao.hypha",
      "type": "removedtx",
      "requirement": "scheduler"
    }
  }
  ```