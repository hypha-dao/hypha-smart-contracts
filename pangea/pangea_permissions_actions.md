# Pangea Testnet Deploy 

## Permissions Actions

### dao.hypha permissions

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

  #### 3. add autoenroll

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
        "permission": "autoenroll",
        "parent": "active",
        "auth": {
          "threshold": 1,
          "waits": [],
          "accounts": [
            {
              "permission": {
                "actor": "join.hypha",
                "permission": "eosio.code"
              },
              "weight": 1
            }
          ],
          "keys": []
        }
      }
    }
  ``` 
#### 4 link auth auto enroll 

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
      "type": "autoenroll",
      "requirement": "autoenroll"
    }
  }
```

  ### voice.hypha

  #### add dao.hypha@eosio.code

  ```json
  {
    "account": "eosio",
    "name": "updateauth",
    "authorization": [
      {
        "actor": "voice.hypha",
        "permission": "owner"
      }
    ],
    "data": {
      "account": "voice.hypha",
      "permission": "active",
      "parent": "owner",
      "auth": {
        "threshold": 1,
        "waits": [],
        "accounts": [
          {
            "permission": {
              "actor": "dao.hypha",
              "permission": "eosio.code"
            },
            "weight": 1
          },
          {
            "permission": {
              "actor": "gov.tmy",
              "permission": "active"
            },
            "weight": 1
          },
          {
            "permission": {
              "actor": "voice.hypha",
              "permission": "eosio.code"
            },
            "weight": 1
          }
        ],
        "keys": [
          {
            "key": "EOS5DMPJ4DsJ2Vc4f7g5o8z9o5HswcpXrE4C58r7wxxzZgYxQn8rB",
            "weight": 1
          }
        ]
      }
    }
  }
  ```

  ### hypha.hypha

  #### add dao.hypha@eosio.code

  ```json
    {
    "account": "eosio",
    "name": "updateauth",
    "authorization": [
      {
        "actor": "hypha.hypha",
        "permission": "owner"
      }
    ],
    "data": {
      "account": "hypha.hypha",
      "permission": "active",
      "parent": "owner",
      "auth": {
        "threshold": 1,
        "waits": [],
        "accounts": [
          {
            "permission": {
              "actor": "dao.hypha",
              "permission": "eosio.code"
            },
            "weight": 1
          },
          {
            "permission": {
              "actor": "gov.tmy",
              "permission": "active"
            },
            "weight": 1
          },
          {
            "permission": {
              "actor": "hypha.hypha",
              "permission": "eosio.code"
            },
            "weight": 1
          }
        ],
        "keys": [
          {
            "key": "EOS5DMPJ4DsJ2Vc4f7g5o8z9o5HswcpXrE4C58r7wxxzZgYxQn8rB",
            "weight": 1
          }
        ]
      }
    }
  }
  ```

  ### husd.hypha

  #### add dao.hypha@eosio.code

  ```json
    {
    "account": "eosio",
    "name": "updateauth",
    "authorization": [
      {
        "actor": "husd.hypha",
        "permission": "owner"
      }
    ],
    "data": {
      "account": "husd.hypha",
      "permission": "active",
      "parent": "owner",
      "auth": {
        "threshold": 1,
        "waits": [],
        "accounts": [
          {
            "permission": {
              "actor": "dao.hypha",
              "permission": "eosio.code"
            },
            "weight": 1
          },
          {
            "permission": {
              "actor": "gov.tmy",
              "permission": "active"
            },
            "weight": 1
          },
          {
            "permission": {
              "actor": "husd.hypha",
              "permission": "eosio.code"
            },
            "weight": 1
          }
        ],
        "keys": [
          {
            "key": "EOS5DMPJ4DsJ2Vc4f7g5o8z9o5HswcpXrE4C58r7wxxzZgYxQn8rB",
            "weight": 1
          }
        ]
      }
    }
  }
  ```