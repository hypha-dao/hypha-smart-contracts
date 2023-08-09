#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "./utils.hpp"

using namespace eosio;

class [[eosio::contract]] staking : public contract
{
public:
    using contract::contract;

    [[eosio::action]] void stake(name from, name to, asset quantity);

    [[eosio::action]] void unstake(name from, name to, asset quantity);

    [[eosio::action]] void reset();

    [[eosio::on_notify("hypha.hypha::transfer")]] void on_transfer(name from, name to, asset quantity, std::string memo);

private:
    struct [[eosio::table]] account
    {
        name account_name;
        asset balance;

        uint64_t primary_key() const { return account_name.value; }
    };
    typedef eosio::multi_index<"accounts"_n, account> accounts_table;

    struct [[eosio::table]] dao_account
    {
        name account_name;
        asset balance;

        uint64_t primary_key() const { return account_name.value; }
    };
    typedef eosio::multi_index<name("daoaccounts"), dao_account> dao_accounts_table;

    struct [[eosio::table]] stake_entry
    {
        uint64_t id;
        name account_name;
        name beneficiary;
        asset quantity;

        uint64_t primary_key() const { return id; }
        uint64_t by_beneficiary() const { return beneficiary.value; }
        uint64_t by_account() const { return account_name.value; }
        uint64_t by_account_beneficiary() const { return (account_name.value << 32) | beneficiary.value; }
    };

    typedef eosio::multi_index<name("stakes"), stake_entry,
                               indexed_by<name("beneficiary"), const_mem_fun<stake_entry, uint64_t, &stake_entry::by_beneficiary>>,
                               indexed_by<name("account"), const_mem_fun<stake_entry, uint64_t, &stake_entry::by_account>>,
                               indexed_by<name("accountben"), const_mem_fun<stake_entry, uint64_t, &stake_entry::by_account_beneficiary>>>
        stakes_table;
};
