#include "../include/paycpu.hpp"

void paycpu::payforcpu(name account) {
    require_auth(account);
    require_auth(_self);

    // Retrieve the contract name from the configs table
    configs_singleton configs(_self, _self.value);
    auto c = configs.get_or_create(_self, config{});

    // Get the contract name from the config table entry
    name contractName = c.contractName;

    // Check if the provided account exists in the members table of the specified contract
    members_table members(contractName, contractName.value);
    auto member = members.find(account.value);
    eosio::check(member != members.end(), "Account not found in members table");

}

void paycpu::configure(name contractName) {
    require_auth(_self);

    configs_singleton configs(_self, _self.value);
    auto c = configs.get_or_create(_self, config{});

    c.contractName = contractName;

    configs.set(c, _self);
}
