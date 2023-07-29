## Pay for CPU

Overview: Hypha members can use our pay cpu contract and the payforcpu permission to preload actions and pay for the transaction

## First signer pays

Important to consider is that the first signer in the transaction will be paying - so paycpu.hypha@payforcpu must be the first authorization in the first action of the transaction

## Example Transaction

```
cleos -u http://mainnet.telos.net push transaction -j '{
    "actions": [
        {
            "account": "paycpu.hypha",
            "name": "payforcpu",
            "authorization": [
                {
                    "actor": "paycpu.hypha",
                    "permission": "payforcpu"
                },
                {
                    "actor": "illumination",
                    "permission": "active"
                }
            ],
            "data": {
                "account": "illumination"
            }
        },
        {
            "account": "eosio.token",
            "name": "transfer",
            "authorization": [
                {
                    "actor": "illumination",
                    "permission": "active"
                }
            ],
            "data": {
                "from": "illumination",
                "to": "dao.hypha",
                "quantity": "0.0001 TLOS",
                "memo": "test"
            }
        }
    ]
}'
```
