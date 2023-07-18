#include <eosio/eosio.hpp>
// #include <contracts.hpp>
#include <eosio/singleton.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/permission.hpp>
#include <eosio/asset.hpp>
#include <abieos_numeric.hpp>
// #include <tables.hpp>

using std::string;
using namespace eosio;
using abieos::authority;
using abieos::keystring_authority;
using std::make_tuple;

CONTRACT joinhypha : public contract {
   public:
      using contract::contract;

      // **Note** This needs to be manually set before deploying to a different chain

      /// Telos
      // asset net_stake = asset(5000, symbol("TLOS", 4)); // 0.5 TLOS
      // asset cpu_stake = asset(5000, symbol("TLOS", 4)); // 0.5 TLOS

      /// EOS
      asset net_stake = asset(1000, symbol("EOS", 4)); // 0.1 EOS
      asset cpu_stake = asset(1000, symbol("EOS", 4)); // 0.1 EOS

      struct [[eosio::table ]] config {
         name                       account_creator_contract   ;
         name                       account_creator_oracle     ;
         std::map<name, uint8_t>    settings                   ;
      };

      typedef singleton<"config"_n, config> config_table;
      typedef multi_index<"config"_n, config> config_table_placeholder;

      ACTION setconfig ( const name& account_creator_contract, const name& account_creator_oracle );
      ACTION setsetting ( const name& setting_name, const uint8_t& setting_value );
      ACTION pause ();
      ACTION activate ();
      
      ACTION create ( const name& account_to_create, const string& key);

    private: 
      void create_account(name account, string publicKey);

};
