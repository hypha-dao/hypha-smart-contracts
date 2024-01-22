#include <deferredtrx.hpp>

// Action to execute the stored action based on id
// void deferredtrx::executeactn(uint64_t id) {
//     require_auth(get_self());

//     actions_table actions(get_self(), get_self().value);
//     auto itr = actions.find(id);
//     if (itr != actions.end()) {
//         eosio::time_point_sec current_time = eosio::current_time_point();
//         if (current_time >= itr->execute_time) {
//             action(itr->auth, itr->account, itr->action_name, itr->data).send();
//             actions.erase(itr);
//         }
//         else {
//             eosio::check(false, "Action cannot be executed yet. Wait until execute_time.");
//         }
//     }
//     else {
//         eosio::check(false, "Action with provided ID not found.");
//     }
// }

// Action to choose and execute the next action
// Note: anybody can call this - fails if there is no action to execute.
void deferredtrx::executenext() {

    actions_table actions(get_self(), get_self().value);

    auto idx = actions.get_index<"bytime"_n>();
    auto itr = idx.begin();

    if (itr != idx.end() && itr->execute_time <= current_time_point()) {
        //executeactn(itr->id);
        action(
            itr->auth, 
            itr->account, 
            itr->action_name, 
            itr->data).send();
        idx.erase(itr);
    }
    else {
        eosio::check(false, "No actions to execute at this time.");
    }
}

// Action to add a new entry to the table
void deferredtrx::addaction(eosio::time_point_sec execute_time, permission_level auth, name account, name action_name, std::vector<char> packed_data) {
    
    require_auth(get_self());

    actions_table actions(get_self(), get_self().value);

    actions.emplace(get_self(), [&](auto& row) {
        row.id = actions.available_primary_key();
        row.execute_time = execute_time;
        row.auth = auth;
        row.account = account;
        row.action_name = action_name;
        row.data = packed_data;
    });
}


void deferredtrx::testdtrx(uint64_t number, std::string text) {
    require_auth(get_self());

    testdtrx_table testdtrx(get_self(), get_self().value);

    // Add the new entry to the testdtrx table
    testdtrx.emplace(get_self(), [&](auto& row) {
        row.id = testdtrx.available_primary_key();
        row.number = number;
        row.text = text;
    });
}
