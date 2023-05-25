#include "../include/paycpu.hpp"

ACTION paycpu::payforcpu(name account) {
    require_auth(account);
    require_auth(_self);

    configs_singleton configs(_self, _self.value);
    auto conf = configs.get();
    name contractName = conf.contractName;

    members_table members(contractName, contractName.value);
    auto member = members.find(account.value);
    check(member != members.end(), "Not a Hypha account");

}

ACTION paycpu::configure(name contractName) {
    require_auth(_self);

    configs_singleton configs(_self, _self.value);
    auto configEntry = configs.get_or_create(_self, config{});

    configEntry.contractName = contractName;

    configs.set(configEntry, _self);
}
