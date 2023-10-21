#include "../include/paycpu.hpp"

ACTION paycpu::payforcpu(name account) {
    require_auth(account);
    require_auth(_self);

    configs_singleton configs(_self, _self.value);
    auto conf = configs.get();
    name contractName = conf.contractName;

    members_table members(contractName, contractName.value);
    auto member = members.find(account.value);
    if (member == members.end()) {
        // if we can't find the member, see if it's a new account
        check_new_member(account);
    }
}

ACTION paycpu::configure(name contractName) {
    require_auth(_self);

    configs_singleton configs(_self, _self.value);
    auto configEntry = configs.get_or_create(_self, config{});

    configEntry.contractName = contractName;

    configs.set(configEntry, _self);
}

ACTION paycpu::newacct(name account) {
    require_auth(get_self());

    new_members_table members_table(get_self(), get_self().value);

    auto member_itr = members_table.find(account.value);
    eosio::check(member_itr == members_table.end(), "Account already exists.");

    members_table.emplace(get_self(), [&](auto& member) {
        member.name = account;
        member.created_at = eosio::current_time_point();
        member.used = 0;  
    });

}

void paycpu::check_new_member(const eosio::name& account_name) {

    new_members_table members_table(get_self(), get_self().value);
    auto member_itr = members_table.find(account_name.value);

    eosio::check(member_itr != members_table.end(), "Not a Hypha account.");

    eosio::time_point_sec current_time = eosio::current_time_point();

    uint32_t account_age_seconds = (current_time.sec_since_epoch() - member_itr->created_at.sec_since_epoch());

    eosio::check(account_age_seconds <= (48 * 3600), "You have 48 hours to sign up.");

    eosio::check(member_itr->used < 3, "The 'used' count has reached the limit of 3.");

    // If all checks pass, increase the 'used' count by 1
    members_table.modify(member_itr, account_name, [&](auto& member) {
        member.used += 1;
    });
}

