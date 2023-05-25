#include "../include/paycpu.hpp"

void paycpu::payforcpu(name account) {
    require_auth(account);
    require_auth(_self);

    // Check if the provided account exists in the members table of dao.hypha contract
    members_table members("dao.hypha"_n, "dao.hypha"_n.value);
    auto member = members.find(account.value);
    eosio::check(member != members.end(), "Account not found in members table of dao.hypha contract");

}
