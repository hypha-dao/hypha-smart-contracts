#include <deferredtrx.hpp>

void deferredtrx::reset()
{
    require_auth(get_self());
#ifdef LOCAL_TEST
    utils::delete_table<deferred_actions_tables>(get_self(), get_self().value);
    utils::delete_table<testdtrx_tables>(get_self(), get_self().value);
#else
    check(false, "reset is only active in testing");
#endif
}

// Action to choose and execute the next action
// Note: anybody can call this - fails if there is no action to execute.
void deferredtrx::executenext() {

    deferred_actions_tables deftrx(get_self(), get_self().value);

    auto idx = deftrx.get_index<"bytime"_n>();
    auto itr = idx.begin();

    if (itr != idx.end() && itr->execute_time <= current_time_point()) {

        // Note: We can't use the public constructor because it will misinterpret the 
        // data and pack it again - data is already in packed format. 
        eosio::action act;
        act.account = itr->account;
        act.name = itr->action_name;
        act.authorization = itr->auth;
        act.data = itr->data;

        act.send();
        
        idx.erase(itr);
    }
    else {
        eosio::check(false, "No deferred actions to execute at this time.");
    }
}

// Action to add a new entry to the table
void deferredtrx::addaction(eosio::time_point_sec execute_time, std::vector<permission_level> auth, name account, name action_name, std::vector<char> packed_data) {
    
    require_auth(get_self());

    deferred_actions_tables deftrx(get_self(), get_self().value);

    deftrx.emplace(get_self(), [&](auto& row) {
        row.id = deftrx.available_primary_key();
        row.execute_time = execute_time;
        row.auth = auth;
        row.account = account;
        row.action_name = action_name;
        row.data = packed_data;
    });
}
// Action to add a new entry to the table
void deferredtrx::schedule_deferred_action(eosio::time_point_sec execute_time, eosio::action action) {
    
    deferred_actions_tables deftrx(get_self(), get_self().value);

    deftrx.emplace(get_self(), [&](auto& row) {
        row.id = deftrx.available_primary_key();
        row.execute_time = execute_time;
        row.auth = action.authorization;
        row.account = action.account;
        row.action_name = action.name;
        row.data = action.data;
    });
}


void deferredtrx::addtest(time_point_sec execute_time, uint64_t number, std::string text) {
    require_auth(get_self());

    // 1 - Create an action object 
    eosio::action act(
        eosio::permission_level(get_self(), eosio::name("active")),
        eosio::name("deftrx.hypha"),
        eosio::name("testdtrx"),
        std::make_tuple(number, text)
    );
    
    /// This is what we want to use inside the contract
    schedule_deferred_action(execute_time, act);

}

void deferredtrx::testdtrx(uint64_t number, std::string text) {
    require_auth(get_self());

    testdtrx_tables testdtrx(get_self(), get_self().value);

    // Add the new entry to the testdtrx table
    testdtrx.emplace(get_self(), [&](auto& row) {
        row.id = testdtrx.available_primary_key();
        row.number = number;
        row.text = text;
    });
}
