#!/bin/bash

echo "starting nodeos with name test_node on docker container"
echo "make sure the docker container is running"

dune -s test_node

./create_all_accounts.sh