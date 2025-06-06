#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <tables/account.hpp>
#include <tables/currency_stats.hpp>

#include <string>

namespace hypha {

    using namespace eosio;
    using namespace std;

    /**
    * eosio.token contract defines the structures and actions that allow users to create, issue, and manage
    * tokens on EOSIO based blockchains.
    */
class [[eosio::contract("voice.hypha")]] voice : public eosio::contract {
    public:
        using contract::contract;

        /**
        * Migrates from old single tenant tables to the multitenant table (stat_v2).
        * @param tenant target tenant to put the results in
        */
        [[eosio::action]]
        void migratestat(const name& tenant);

        /**
        * Migrates from old single tenant tables to the multitenant table (account_v2).
        * @param tenant target tenant to put the results in
        * @param accounts Accounts to migrate
        */
        [[eosio::action]]
        void migrateacc(const name& tenant, const std::vector<name> accounts);

        [[eosio::action]]
        void del(const name& tenant, const asset&   symbol);

        /**
         * @brief Removes the token balance of an account within an specific DAO
         * 
         * @param tenant Owner tenant of the token
         * @param accout Account to remove the balance from 
         * @param symbol Symbol of the token 
         */
        [[eosio::action]]
        void delbal(const name& tenant, const name& account, const symbol& symbol);

        /**
         * Allows `issuer` account to create a token in supply of `maximum_supply`. If validation is successful a new entry in statstable for token symbol scope gets created.
         *
         * @param issuer - the account that creates the token,
         * @param maximum_supply - the maximum supply set for the token created.
         *
         * @pre Token symbol has to be valid,
         * @pre Token symbol must not be already created,
         * @pre maximum_supply has to be smaller than the maximum supply allowed by the system: 1^62 - 1.
         * @pre Maximum supply must be positive;
         */
        [[eosio::action]]
        void create( const name&    tenant,
                     const name&    issuer,
                     const asset&   maximum_supply,
                     const uint64_t decay_period,
                     const uint64_t decay_per_period_x10M);

        /**
         *  This action issues to `to` account a `quantity` of tokens.
         *
         * @param to - the account to issue tokens to, it must be the same as the issuer,
         * @param quntity - the amount of tokens to be issued,
         * @memo - the memo string that accompanies the token issue transaction.
         */
        [[eosio::action]]
        void issue(
            const name& tenant,
            const name& to,
            const asset& quantity,
            const string& memo);

        /**
          * Allows `from` account to transfer to `to` account the `quantity` tokens.
          * One account is debited and the other is credited with quantity tokens.
          *
          * @param from - the account to transfer from,
          * @param to - the account to be transferred to,
          * @param quantity - the quantity of tokens to be transferred,
          * @param memo - the memo string to accompany the transaction.
          */
        [[eosio::action]]
        void transfer( const name&    tenant,
                       const name&    from,
                       const name&    to,
                       const asset&   quantity,
                       const string&  memo );


        // Runs decaying actions
        ACTION decay(const name& tenant, const name& owner, symbol symbol);

        /**
         * @brief Edits the decay config values
         * 
         * @param tenant 
         * @param symbol 
         * @param new_decay_period 
         * @param new_decay_per_periox_x10m 
         * @return ACTION 
         */
        ACTION moddecay(const name& tenant, symbol symbol, uint64_t new_decay_period, uint64_t new_decay_per_periox_x10m);

        /**
         * Allows `ram_payer` to create an account `owner` with zero balance for
         * token `symbol` at the expense of `ram_payer`.
         *
         * @param owner - the account to be created,
         * @param symbol - the token to be payed with by `ram_payer`,
         * @param ram_payer - the account that supports the cost of this action.
         *
         * More information can be read [here](https://github.com/EOSIO/eosio.contracts/issues/62)
         * and [here](https://github.com/EOSIO/eosio.contracts/issues/61).
         */
        [[eosio::action]]
        void open(const name& tenant, const name& owner, const symbol& symbol, const name& ram_payer);

        /**
         * This action is the opposite for open, it closes the account `owner`
         * for token `symbol`.
         *
         * @param owner - the owner account to execute the close action for,
         * @param symbol - the symbol of the token to execute the close action for.
         *
         * @pre The pair of owner plus symbol has to exist otherwise no action is executed,
         * @pre If the pair of owner plus symbol exists, the balance has to be zero.
         */
        [[eosio::action]]
        void close(const name& tenant, const name& owner, const symbol& symbol );

        static asset get_supply(const name& tenant, const name& token_contract_account, const symbol_code& sym_code )
        {
            stats statstable( token_contract_account, sym_code.raw() );
            auto index = statstable.get_index<name("bykey")>();
            const auto& st = index.get( currency_statsv2::build_key(tenant, sym_code));
            return st.supply;
        }

        static asset get_balance(const name& tenant, const name& token_contract_account, const name& owner, const symbol_code& sym_code )
        {
            accounts accountstable( token_contract_account, owner.value );
            auto index = accountstable.get_index<name("bykey")>();
            const auto& ac = index.get( accountv2::build_key(tenant, sym_code));
            return ac.balance;
        }

        using create_action = eosio::action_wrapper<"create"_n, &voice::create>;
        using issue_action = eosio::action_wrapper<"issue"_n, &voice::issue>;
        using open_action = eosio::action_wrapper<"open"_n, &voice::open>;
        using close_action = eosio::action_wrapper<"close"_n, &voice::close>;
    private:

        void sub_balance(const name& tenant, const name& owner, const asset& value );
        void add_balance(const name& tenant, const name& owner, const asset& value, const name& ram_payer );
        void update_issued(const name& tenant, const asset& quantity);

        static uint64_t get_current_time();
    };

}
