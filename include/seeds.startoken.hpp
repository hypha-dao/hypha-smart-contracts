/**
 *  @file
 *  @copyright defined in eos/LICENSE.txt
 */
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
// #include <tables.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>
#include <eosio/symbol.hpp>
#include <eosio/transaction.hpp>

#include <string>

namespace eosiosystem {
   class system_contract;
}

using namespace eosio;
using std::string;

   /**
    * startoken contract
    * 
    * based on token.seeds
    *
    * @details eosio.token contract defines the structures and actions that allow users to create, issue, and manage
    * tokens on eosio based blockchains.
    * @{
    */
   class [[eosio::contract("startoken")]] startoken : public contract {
      public:
         using contract::contract;
         startoken(name receiver, name code, datastream<const char*> ds)
            :  contract(receiver, code, ds),
               circulating(receiver, receiver.value)
               {}
         
         /**
          * Create action.
          *
          * @details Allows `issuer` account to create a token in supply of `maximum_supply`.
          * @param issuer - the account that creates the token,
          * @param maximum_supply - the maximum supply set for the token created.
          *
          * @pre Token symbol has to be valid,
          * @pre Token symbol must not be already created,
          * @pre max_supply has to be smaller than the maximum supply allowed by the system: 1^62 - 1.
          * @pre Initial supply must be positive;
          *
          * If validation is successful a new entry in statstable for token symbol scope gets created.
          */
         [[eosio::action]]
         void create( const name&   issuer, const asset&  max_supply );
         /**
          * Issue action.
          *
          * @details This action issues to `to` account a `quantity` of tokens.
          *
          * @param to - the account to issue tokens to, it must be the same as the issuer,
          * @param quantity - the amount of tokens to be issued,
          * @memo - the memo string that accompanies the token issue transaction.
          */
         [[eosio::action]]
         void issue( const name& to, const asset& quantity, const string& memo );

         /**
          * Retire action.
          *
          * @details The opposite for create action, if all validations succeed,
          * it debits the statstable.supply amount.
          *
          * @param quantity - the quantity of tokens to retire,
          * @param memo - the memo string to accompany the transaction.
          */
         [[eosio::action]]
         void retire( const asset& quantity, const string& memo );

        /**
         * Burn action.
         *
         * @details The opposite for issue action, if all validations succeed,
         * it debits the statstable.supply amount.
         *
         * @param from - the account to burn from,
         * @param quantity - the quantity of tokens to be burned.
         */
         [[eosio::action]]
         void burn( const name& from, const asset& quantity );

        /**
         * Admin action - delete stale balance
         *
         * @details Same as burn action but with admin priveleges.
         *
         * @param from - the account to burn from,
         * @param quantity - the quantity of tokens to be burned.
         */
         [[eosio::action]]
         void delbalance( const name& from, const asset& quantity );

         /**
          * Transfer action.
          *
          * @details Allows `from` account to transfer to `to` account the `quantity` tokens.
          * One account is debited and the other is credited with quantity tokens.
          *
          * @param from - the account to transfer from,
          * @param to - the account to be transferred to,
          * @param quantity - the quantity of tokens to be transferred,
          * @param memo - the memo string to accompany the transaction.
          */
         [[eosio::action]]
         void transfer( const name&    from,
                        const name&    to,
                        const asset&   quantity,
                        const string&  memo );

         /**
          * Open action.
          *
          * @details Allows `ram_payer` to create an account `owner` with zero balance for
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
         void open( const name& owner, const symbol& symbol, const name& ram_payer );

         /**
          * Close action.
          *
          * @details This action is the opposite for open, it closes the account `owner`
          * for token `symbol`.
          *
          * @param owner - the owner account to execute the close action for,
          * @param symbol - the symbol of the token to execute the close action for.
          *
          * @pre The pair of owner plus symbol has to exist otherwise no action is executed,
          * @pre If the pair of owner plus symbol exists, the balance has to be zero.
          */
         [[eosio::action]]
         void close( const name& owner, const symbol& symbol );

         /**
          * Get supply method.
          *
          * @details Gets the supply for token `sym_code`, created by `token_contract_account` account.
          *
          * @param token_contract_account - the account to get the supply for,
          * @param sym_code - the symbol to get the supply for.
          */
         static asset get_supply( const name& token_contract_account, const symbol_code& sym_code )
         {
            stats statstable( token_contract_account, sym_code.raw() );
            const auto& st = statstable.get( sym_code.raw() );
            return st.supply;
         }

         /**
          * Get balance method.
          *
          * @details Get the balance for a token `sym_code` created by `token_contract_account` account,
          * for account `owner`.
          *
          * @param token_contract_account - the token creator account,
          * @param owner - the account for which the token balance is returned,
          * @param sym_code - the token for which the balance is returned.
          */
         static asset get_balance( const name& token_contract_account, const name& owner, const symbol_code& sym_code )
         {
            accounts accountstable( token_contract_account, owner.value );
            const auto& ac = accountstable.get( sym_code.raw() );
            return ac.balance;
         }

         using create_action = eosio::action_wrapper<"create"_n, &startoken::create>;
         using issue_action = eosio::action_wrapper<"issue"_n, &startoken::issue>;
         using retire_action = eosio::action_wrapper<"retire"_n, &startoken::retire>;
         using burn_action = eosio::action_wrapper<"burn"_n, &startoken::burn>;
         using transfer_action = eosio::action_wrapper<"transfer"_n, &startoken::transfer>;
         using open_action = eosio::action_wrapper<"open"_n, &startoken::open>;
         using close_action = eosio::action_wrapper<"close"_n, &startoken::close>;

      private:
         symbol stars_symbol = symbol("STARS", 4);
         symbol seeds_symbol = symbol("SEEDS", 4);

         struct [[eosio::table]] account {
            asset    balance;

            uint64_t primary_key()const { return balance.symbol.code().raw(); }
         };

         struct [[eosio::table]] currency_stats {
            asset    supply;
            asset    max_supply;
            name     issuer;

            uint64_t primary_key()const { return supply.symbol.code().raw(); }
         };
         
         typedef eosio::multi_index< "accounts"_n, account > accounts;
         typedef eosio::multi_index< "stat"_n, currency_stats > stats;

         void sub_balance( const name& owner, const asset& value );
         void add_balance( const name& owner, const asset& value, const name& ram_payer );

         TABLE circulating_supply_table {
            uint64_t id;
            uint64_t total;
            uint64_t circulating;
            uint64_t primary_key()const { return id; }
         };
    
         typedef singleton<"circulating"_n, circulating_supply_table> circulating_supply_tables;
         typedef eosio::multi_index<"circulating"_n, circulating_supply_table> dump_for_circulating;
      
      circulating_supply_tables circulating;

   };
   

EOSIO_DISPATCH(startoken, (create)(issue)(transfer)(open)(close)(retire)(burn)(delbalance) )
