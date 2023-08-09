#include "../include/staking.hpp"

void staking::reset()
{
  require_auth(get_self());
  #ifdef LOCAL_TEST
      utils::delete_table<accounts_table>(get_self(), get_self().value);
      utils::delete_table<dao_accounts_table>(get_self(), get_self().value);
      utils::delete_table<stakes_table>(get_self(), get_self().value);
  #else
      check(false, "reset is only active in testing");
  #endif
}

[[eosio::action]]
void staking::stake(name from, name to, asset quantity) {
    require_auth(from);

    accounts_table accounts(get_self(), get_self().value);
    auto from_account_itr = accounts.find(from.value);
    check(from_account_itr != accounts.end(), "From account does not exist");

    dao_accounts_table dao_accounts(get_self(), get_self().value);
    auto to_account_itr = dao_accounts.find(to.value);
    if (to_account_itr == dao_accounts.end()) {
        dao_accounts.emplace(from, [&](auto& acc) {
            acc.account_name = to;
            acc.balance = quantity;
        });
    } else {
        dao_accounts.modify(to_account_itr, from, [&](auto& acc) {
            acc.balance += quantity;
        });
    }

    accounts.modify(from_account_itr, from, [&](auto& acc) {
        check(acc.balance >= quantity, "Insufficient balance");
        acc.balance -= quantity;
    });

    stakes_table stakes(get_self(), get_self().value);
    auto stake_itr = stakes.find((from.value << 32) | to.value);
    if (stake_itr == stakes.end()) {
        stakes.emplace(from, [&](auto& entry) {
            entry.id = stakes.available_primary_key();
            entry.account_name = from;
            entry.beneficiary = to;
            entry.quantity = quantity;
        });
    } else {
        stakes.modify(stake_itr, from, [&](auto& entry) {
            entry.quantity += quantity;
        });
    }
}

[[eosio::action]]
void staking::unstake(name from, name to, asset quantity) {
    require_auth(from);

    stakes_table stakes(get_self(), get_self().value);
    auto stake_itr = stakes.find((from.value << 32) | to.value);
    check(stake_itr != stakes.end(), "Stake entry not found");

    check(stake_itr->quantity >= quantity, "Insufficient staked quantity");

    dao_accounts_table dao_accounts(get_self(), get_self().value);
    auto to_account_itr = dao_accounts.find(to.value);
    check(to_account_itr != dao_accounts.end(), "To account not found");

    accounts_table accounts(get_self(), get_self().value);
    auto from_account_itr = accounts.find(from.value);
    check(from_account_itr != accounts.end(), "From account not found");

    stakes.modify(stake_itr, from, [&](auto& entry) {
        entry.quantity -= quantity;
    });

    dao_accounts.modify(to_account_itr, from, [&](auto& acc) {
        check(acc.balance >= quantity, "Insufficient balance");
        acc.balance -= quantity;
    });

    accounts.modify(from_account_itr, from, [&](auto& acc) {
        acc.balance += quantity;
    });
}

[[eosio::on_notify("hypha.hypha::transfer")]]
void staking::on_transfer(name from, name to, asset quantity, std::string memo) {
    if (to != get_self()) {
        // Ignore transfers not intended for this contract
        return;
    }

    require_auth(from);

    accounts_table accounts(get_self(), get_self().value);
    auto account_itr = accounts.find(from.value);

    if (account_itr == accounts.end()) {
        // Create a new account entry if it doesn't exist
        accounts.emplace(get_self(), [&](auto& acc) {
            acc.account_name = from;
            acc.balance = quantity;
        });
    } else {
        // Update the existing account's balance
        accounts.modify(account_itr, get_self(), [&](auto& acc) {
            acc.balance += quantity;
        });
    }
}
