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

[[eosio::action]] void staking::stake(name from, name to, asset quantity)
{
    require_auth(from);

    check(quantity.amount > 0, "Can only stake positive values");

    accounts_table accounts(get_self(), get_self().value);
    auto from_account_itr = accounts.find(from.value);
    check(from_account_itr != accounts.end(), "From account has no balance");
    check(from_account_itr->balance.symbol == quantity.symbol, "Wrong symbol");
    check(from_account_itr->balance >= quantity, "Insufficient balance");

    dao_accounts_table dao_accounts(get_self(), get_self().value);
    auto to_account_itr = dao_accounts.find(to.value);
    if (to_account_itr == dao_accounts.end())
    {
        dao_accounts.emplace(get_self(), [&](auto &acc)
                             {
            acc.account_name = to;
            acc.balance = quantity; });
    }
    else
    {
        dao_accounts.modify(to_account_itr, from, [&](auto &acc)
                            { acc.balance += quantity; });
    }

    accounts.modify(from_account_itr, from, [&](auto &acc)
                    {
        acc.balance -= quantity; });

    stakes_table stakes(get_self(), get_self().value);
    auto accountben_index = stakes.get_index<name("accountben")>();
    auto stake_itr = accountben_index.find((from.value << 32) | to.value);

    if (stake_itr == accountben_index.end())
    {
        stakes.emplace(get_self(), [&](auto &entry)
                       {
            entry.id = stakes.available_primary_key();
            entry.account_name = from;
            entry.beneficiary = to;
            entry.quantity = quantity; });
    }
    else
    {
        accountben_index.modify(stake_itr, from, [&](auto &entry)
                      { entry.quantity += quantity; });
    }
}

[[eosio::action]] void staking::unstake(name from, name to, asset quantity)
{
    require_auth(from);

    check(quantity.amount > 0, "Can only unstake positive values");

    stakes_table stakes(get_self(), get_self().value);
    auto accountben_index = stakes.get_index<name("accountben")>();
    auto stake_itr = accountben_index.find((from.value << 32) | to.value);

    check(stake_itr != accountben_index.end(), "Stake entry not found");
    check(stake_itr->account_name == from, "Only stake owner can unstake"); // would be nice to have this error message
    check(stake_itr->quantity.symbol == quantity.symbol, "Wrong symbol in quantity");
    check(stake_itr->quantity >= quantity, "Insufficient staked quantity");

    dao_accounts_table dao_accounts(get_self(), get_self().value);
    auto to_account_itr = dao_accounts.find(stake_itr->beneficiary.value);
    check(to_account_itr != dao_accounts.end(), "DAO account not found");

    accounts_table accounts(get_self(), get_self().value);
    auto from_account_itr = accounts.find(from.value);
    check(from_account_itr != accounts.end(), "From account not found");

    if (stake_itr->quantity.amount == quantity.amount) {
        accountben_index.erase(stake_itr);
    } else {
        accountben_index.modify(stake_itr, from, [&](auto &entry)
                    { entry.quantity -= quantity; });
    }

    dao_accounts.modify(to_account_itr, from, [&](auto &acc)
                        {
        check(acc.balance >= quantity, "Insufficient balance");
        acc.balance -= quantity; });

    accounts.modify(from_account_itr, from, [&](auto &acc)
                    { acc.balance += quantity; });
}

[[eosio::on_notify("hypha.hypha::transfer")]] void staking::on_transfer(name from, name to, asset quantity, std::string memo)
{
    if (to != get_self())
    {
        // Ignore transfers not intended for this contract
        return;
    }

    require_auth(from);

    accounts_table accounts(get_self(), get_self().value);
    auto account_itr = accounts.find(from.value);

    if (account_itr == accounts.end())
    {
        // Create a new account entry if it doesn't exist
        accounts.emplace(get_self(), [&](auto &acc)
                         {
            acc.account_name = from;
            acc.balance = quantity; });
    }
    else
    {
        // Update the existing account's balance
        accounts.modify(account_itr, get_self(), [&](auto &acc)
                        { acc.balance += quantity; });
    }
}

const name token_contract = "hypha.hypha"_n;

[[eosio::action]]
void staking::refund(name account) {
    require_auth(account);

    accounts_table accounts(get_self(), get_self().value);
    auto account_itr = accounts.find(account.value);

    check(account_itr != accounts.end(), "Account not found");
    check(account_itr->balance.amount > 0, "No balance to refund");

    asset balance_to_refund = account_itr->balance;
    accounts.modify(account_itr, account, [&](auto &acc) {
        acc.balance = asset(0, balance_to_refund.symbol);
    });

    action(
        permission_level{get_self(), name("active")},
        token_contract, name("transfer"),
        std::make_tuple(get_self(), account, balance_to_refund, std::string("Refund"))
    ).send();
}
