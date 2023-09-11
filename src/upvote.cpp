#include <upvote.hpp>
// #include <dao.hpp>

#include <numeric>
#include <algorithm>

// #include "badges/badges.hpp"

#include "upvote_election/upvote_common.hpp"
// #include "recurring_activity.hpp"

// #include <member.hpp>

// #ifdef USE_UPVOTE_ELECTIONS

// namespace hypha {

// using upvote_election::UpvoteElection;
// using upvote_election::UpvoteElectionData;
// using upvote_election::ElectionRound;
// using upvote_election::ElectionRoundData;
// using upvote_election::VoteGroup;
// using upvote_election::VoteGroupData;
// namespace upvote_common = upvote_election::common;
    
    using UpvoteElection = hypha::upvote_election::UpvoteElection;
    using UpvoteElectionData = hypha::upvote_election::UpvoteElectionData;
    using ElectionRound = hypha::upvote_election::ElectionRound;
    using ElectionRoundData = hypha::upvote_election::ElectionRoundData;
    using VoteGroup = hypha::upvote_election::VoteGroup;
    using VoteGroupData = hypha::upvote_election::VoteGroupData;

    using ContentGroups = hypha::ContentGroups;
    using ContentWrapper = hypha::ContentWrapper;
    using Document = hypha::Document;

namespace upvote_common = hypha::upvote_election::common;


namespace items {
    inline constexpr auto SYSTEM_BADGE_ID = "badge_id";
    inline constexpr auto UPVOTE_ELECTION_ID = "election_id";
}
using eosio::time_point;

std::map<int64_t, ElectionRoundData> upvote::getRounds(ContentGroups& electionConfig, time_point& endDate) 
{    
    auto cw = ContentWrapper(electionConfig);
    //Store rounds groups sorted by their round id, in case they aren't sorted
    std::map<int64_t, ElectionRoundData> rounds;

    for (size_t i = 0; i < electionConfig.size(); ++i) {
        auto& group = electionConfig[i];
        if (cw.getGroupLabel(group) == upvote_common::groups::ROUND) {
            
            ElectionRoundData data;

            data.passing_count = cw.getOrFail(
                i,
                upvote_common::items::PASSING_AMOUNT
            ).second->getAs<int64_t>();

            EOS_CHECK(
                data.passing_count >= 1,
                "Passing count must be greater or equal to 1"
            )

            data.type = cw.getOrFail(
                i,
                upvote_common::items::ROUND_TYPE
            ).second->getAs<std::string>();

            EOS_CHECK(
                data.type == upvote_common::round_types::CHIEF || 
                data.type == upvote_common::round_types::HEAD || 
                data.type == upvote_common::round_types::DELEGATE,
                // TODO fix string, print type
                "Invalid round type: "
            );

            auto roundId = cw.getOrFail(
                i,
                upvote_common::items::ROUND_ID
            ).second->getAs<int64_t>();
            
            //Let's check if the round was already defined
            EOS_CHECK(
                rounds.count(roundId) == 0,
                "Duplicated round entry in election_config"
            );

            auto duration = cw.getOrFail(
                i,
                upvote_common::items::ROUND_DURATION
            ).second->getAs<int64_t>();

            data.duration = duration;

            endDate += eosio::seconds(duration);

            rounds.insert({roundId, data});
        }
    }

    return rounds;
}

static constexpr int64_t getDelegatePower(int64_t roundId) {
    return roundId * 1 << roundId;
}

void upvote::createRounds(name dao, UpvoteElection& election, std::map<int64_t, ElectionRoundData>& rounds, time_point startDate, time_point endDate) 
{
    std::unique_ptr<ElectionRound> prevRound;

    bool hasChief = false;

    for (auto& [roundId, roundData] : rounds) {
        
        roundData.delegate_power = getDelegatePower(roundId);

        roundData.start_date = startDate;

        startDate += eosio::seconds(roundData.duration);

        roundData.end_date = startDate;

        if (roundData.type == upvote_common::round_types::HEAD) {
            EOS_CHECK(
                prevRound && prevRound->getType() == upvote_common::round_types::CHIEF,
                "There has to be a Chief round previous to Head Delegate round"
            );
        }
        else {
            // TODO fix string
            // EOS_CHECK(
            //     !hasChief,
            //     to_str("Cannot create ", roundData.type, "type rounds after a Chief round")
            // );
            EOS_CHECK(
                !hasChief,
                "Cannot create type rounds after a Chief round"
            );

            hasChief = hasChief || roundData.type == upvote_common::round_types::CHIEF;
        }

        auto electionRound = std::make_unique<ElectionRound>(
            dao,
            election.getId(),
            roundData
        );

        if (prevRound) {
            
            EOS_CHECK(
                prevRound->getPassingCount() > electionRound->getPassingCount(),
                "Passing count has to be decremental"
            );

            prevRound->setNextRound(electionRound.get());
        }
        else {
            election.setStartRound(electionRound.get());
        }

        prevRound = std::move(electionRound);
    }

    EOS_CHECK(
        prevRound->getType() == upvote_common::round_types::CHIEF ||
        prevRound->getType() == upvote_common::round_types::HEAD,
        "Last round must be of type Chief or Head"
    )

    //Verify we have a chief round
    election.getChiefRound();

    //At the end both start date and end date should be the same
    EOS_CHECK(
        startDate == endDate,
        // to_str("End date missmatch: ", startDate, " ", endDate)
        "End date missmatch: startDate == endDate"
    );
}

void upvote::scheduleElectionUpdate(name dao, UpvoteElection& election, time_point date)
{
    if (date < eosio::current_time_point()) return;

    //Schedule a trx to close the proposal
    // TODO: MOVE TO dao.hypha action? I mean.. 
    eosio::transaction trx;
    trx.actions.emplace_back(eosio::action(
        eosio::permission_level(dao, eosio::name("active")),
        dao,
        eosio::name("updateupvelc"),
        std::make_tuple(election.getId(), true)
    ));

    EOS_CHECK (
        date > eosio::current_time_point(),
        "Can only schedule for dates in the future"
    );

    constexpr auto aditionalDelaySec = 10;
    trx.delay_sec = (date - eosio::current_time_point()).to_seconds() + aditionalDelaySec;

    auto nextID = getUniqueTxId(); // dhoSettings->getSettingOrDefault("next_schedule_id", int64_t(0));

    // note: nextId is a unuqie ID for this transaction, since it's being sent
    // asynchronously. Not sure why we use the next_schedule_id for this - we could simply 
    // just use a fixed number here

    trx.send(nextID, dao);

    // dhoSettings->setSetting(Content{"next_schedule_id", nextID + 1});
}

uint64_t upvote::getUniqueTxId() {
    auto counter_itr = counters.find(0); // assuming only one row with a fixed primary key

    uint64_t current_id;
    if (counter_itr == counters.end()) {
        current_id = 0;
        counters.emplace(get_self(), [&](auto& c) {
            c.key = 0;
            c.count = 1;
        });
    } else {
        current_id = counter_itr->count;
        counters.modify(counter_itr, same_payer, [&](auto& c) {
            c.count += 1;
        });
    }

    return current_id;
}


void upvote::assignDelegateBadges(
    name dao, 
    uint64_t daoId, 
    uint64_t electionId, 
    const std::vector<uint64_t>& chiefDelegates, 
    std::optional<uint64_t> headDelegate, 
    eosio::transaction* trx)
{
    //Generate proposals for each one of the delegates

    auto createAssignment = [&](const std::string& title, uint64_t member, uint64_t badge) {

        Member mem(dao, member);
        // auto memAccount = mem.getAccount();

        // TODO: Check this rewrite of member mem.getAccount - get account name of member using member id
        Document doc = Document(dao, member);
        eosio::name memAccount = doc.getContentWrapper().getOrFail(DETAILS, MEMBER_STRING)->getAs<eosio::name>();


        auto action = eosio::action(
            eosio::permission_level(dao, eosio::name("active")),
            dao,
            eosio::name("propose"),
            std::make_tuple(
                daoId, 
                dao.get_self(), 
                common::ASSIGN_BADGE,
                ContentGroups{
                    ContentGroup{
                        Content{ CONTENT_GROUP_LABEL, DETAILS },
                        Content{ TITLE, title },
                        Content{ DESCRIPTION, title },
                        Content{ ASSIGNEE, memAccount },
                        Content{ BADGE_STRING, static_cast<int64_t>(badge) },
                        Content{ items::UPVOTE_ELECTION_ID, static_cast<int64_t>(electionId) }
                }},
                true
            )
        );

        if (trx) {
            trx->actions.emplace_back(std::move(action));
        }
        else {
            action.send();
        }
    };

    auto chiefBadgeEdge = Edge::get(dao.get_self(), dao.getRootID(), upvote_common::links::CHIEF_DELEGATE);
    auto chiefBadge = TypedDocument::withType(dao, chiefBadgeEdge.getToNode(), common::BADGE_NAME);

    auto headBadgeEdge = Edge::get(dao.get_self(), dao.getRootID(), upvote_common::links::HEAD_DELEGATE);
    auto headBadge = TypedDocument::withType(dao, headBadgeEdge.getToNode(), common::BADGE_NAME);

    for (auto& chief : chiefDelegates) {
        createAssignment("Chief Delegate", chief, chiefBadge.getID());
    }

    if (headDelegate) {
        createAssignment("Head Delegate", *headDelegate, headBadge.getID());
    }
}

// #ifdef EOS_BUILD
void upvote::importelct(uint64_t dao_id, bool deferred)
{
    verifyDaoType(dao_id);
    checkAdminsAuth(dao_id);

    //Schedule a trx to archive and to crate new badges
    eosio::transaction trx;

    //Remove existing Head Delegate/Chief Delegate badges if any
    auto cleanBadgesOf = [&](const name& badgeEdge) {
        auto badgeId = Edge::get(get_self(), getRootID(), badgeEdge).getToNode();

        auto badgeAssignmentEdges = getGraph().getEdgesFrom(badgeId, common::ASSIGNMENT);

        //Filter out those that are not from the specified DAO
        auto badgeAssignments = std::vector<uint64_t>{};
        badgeAssignments.reserve(badgeAssignmentEdges.size());

        std::transform(
            badgeAssignmentEdges.begin(),
            badgeAssignmentEdges.end(),
            std::back_inserter(badgeAssignments),
            [](const Edge& edge){
                return edge.to_node;
            }
        );

        badgeAssignments.erase(
            std::remove_if(
                badgeAssignments.begin(),
                badgeAssignments.end(),
                [&](uint64_t id) { 
                    return !Edge::exists(get_self(), id, dao_id, common::DAO);
                }
            ),
            badgeAssignments.end()
        );

        for (auto& id : badgeAssignments) {
            auto doc = TypedDocument::withType(*this, id, common::ASSIGN_BADGE);

            auto cw = doc.getContentWrapper();

            cw.insertOrReplace(*cw.getGroupOrFail(SYSTEM), Content {
                "force_archive",
                1
            });

            cw.insertOrReplace(*cw.getGroupOrFail(DETAILS), Content {
                END_TIME,
                eosio::current_time_point()
            });

            doc.update();

            trx.actions.emplace_back(eosio::action(
                eosio::permission_level(get_self(), eosio::name("active")),
                get_self(),
                eosio::name("archiverecur"),
                std::make_tuple(id)
            ));
        }
    };

    cleanBadgesOf(upvote_common::links::HEAD_DELEGATE);
    cleanBadgesOf(upvote_common::links::CHIEF_DELEGATE);

    struct [[eosio::table("elect.state"), eosio::contract("genesis.eden")]] election_state_v0 {
        name lead_representative;
        std::vector<name> board;
        eosio::block_timestamp_type last_election_time;  
    };

    using election_state_singleton = eosio::singleton<"elect.state"_n, std::variant<election_state_v0>>;

    election_state_singleton election_s("genesis.eden"_n, 0);
    auto state = election_s.get();

    std::vector<uint64_t> chiefs;
    std::optional<uint64_t> head = 0;

    std::visit([&](election_state_v0& election){
        
        //If we want to prevent head del to be twice in the board array
        //we can use a simple find condition, for now it doesn't
        //matter if the head del is duplicated as we only assign one head 
        //variable
        // if (std::find(
        //     election.board.begin(), 
        //     election.board.end(), 
        //     election.lead_representative
        // ) == election.board.end()) {
        //     election.board.push_back(election.lead_representative);
        // }

        for (auto& mem : election.board) {
            if (mem) {
                auto member = getOrCreateMember(mem);

                //Make community member if not core or communnity member already
                if (!Member::isMember(*this, dao_id, mem) &&
                    !Member::isCommunityMember(*this, dao_id, mem)) {
                    Edge(get_self(), get_self(), dao_id, member.getID(), common::COMMEMBER);
                }

                if (mem == election.lead_representative) {
                    head = member.getID();
                }
                else {
                    chiefs.push_back(member.getID());
                }
            }
        }
    }, state);

    //Send election id as 0 meaning that election was done outside
    assignDelegateBadges(*this, dao_id, 0, chiefs, head, &trx);

    //Trigger all cleanup and propose actions
    if (deferred) {
        constexpr auto aditionalDelaySec = 5; // TODO: 5 seconds delay is a lot! Why?
        trx.delay_sec = aditionalDelaySec;

        //auto dhoSettings = getSettingsDocument();


        // multiple DAOs could be firing simultaneously - we should
        // use a hash of the object, or another unique id of the object

        auto nextID = getUniqueTxId(); // dhoSettings->getSettingOrDefault("next_schedule_id", int64_t(0));

        trx.send(nextID, get_self());

        // dhoSettings->setSetting(Content{"next_schedule_id", nextID + 1});
    }
    else {
        for (auto& action : trx.actions) {
            action.send();
        }
    }
    
}
// #endif

//Check if we need to update an ongoing elections status:
//upcoming -> ongoing
//ongoing -> finished
//or change the current round
void upvote::updateupvelc(uint64_t election_id, bool reschedule)
{
    //eosio::require_auth();
    UpvoteElection election(*this, election_id);

    auto status = election.getStatus();

    auto now = eosio::current_time_point();

    auto daoId = election.getDaoID();

    auto setupCandidates = [&](uint64_t roundId, const std::vector<uint64_t>& members){
        election_vote_table elctn_t(get_self(), roundId);

        for (auto& memId : members) {
            elctn_t.emplace(get_self(), [memId](ElectionVote& vote) {
                vote.total_amount = 0;
                vote.account_id = memId;
            });
        }
    };

    if (status == upvote_common::upvote_status::UPCOMING) {
        auto start = election.getStartDate();

        //Let's update as we already started
        if (start <= now) {
            
            Edge::get(get_self(), daoId, election.getId(), upvote_common::links::UPCOMING_ELECTION).erase();
            
            Edge(get_self(), get_self(), daoId, election.getId(), upvote_common::links::ONGOING_ELECTION);

            election.setStatus(upvote_common::upvote_status::ONGOING);
            
            auto startRound = election.getStartRound();
            election.setCurrentRound(&startRound);

            //Setup all candidates
            auto delegates = getGraph().getEdgesFrom(daoId, badges::common::links::DELEGATE);

            std::vector<uint64_t> delegateIds;
            delegateIds.reserve(delegates.size());
            
            for (auto& delegate : delegates) {
                delegateIds.push_back(delegate.getToNode());
                startRound.addCandidate(delegate.getToNode());
            }

            setupCandidates(startRound.getId(), delegateIds);

            scheduleElectionUpdate(*this, election, startRound.getEndDate());
        }
        else if (reschedule) {
            scheduleElectionUpdate(*this, election, start);
        }
    }
    else if (status == upvote_common::upvote_status::ONGOING) {
        auto currentRound = election.getCurrentRound();
        auto end = currentRound.getEndDate();
        if (end <= now) {
            
            auto winners = currentRound.getWinners();
            
            for (auto& winner : winners) {
                Edge(get_self(), get_self(), currentRound.getId(), winner, upvote_common::links::ROUND_WINNER);
            }

            Edge::get(get_self(), election_id, upvote_common::links::CURRENT_ROUND).erase();

            if (auto nextRound = currentRound.getNextRound()) {

                election.setCurrentRound(nextRound.get());

                setupCandidates(nextRound->getId(), winners);

                for (auto& winner : winners) {
                    nextRound->addCandidate(winner);
                }

                scheduleElectionUpdate(*this, election, nextRound->getEndDate());
            }
            else {
                Edge::get(get_self(), daoId, election.getId(), upvote_common::links::ONGOING_ELECTION).erase();

                Edge(get_self(), get_self(), daoId, election.getId(), upvote_common::links::PREVIOUS_ELECTION);
                
                //TODO: Setup head & chief badges
                
                if (currentRound.getType() == upvote_common::round_types::HEAD) {
                    //Get previous round for chief delegates
                    auto chiefs = election.getChiefRound().getWinners();

                    //Remove head delegate
                    chiefs.erase(
                        std::remove_if(
                            chiefs.begin(), 
                            chiefs.end(), 
                            [head = winners.at(0)](uint64_t id){ return id == head; }
                        ),
                        chiefs.end()
                    );

                    assignDelegateBadges(*this, daoId, election.getId(), chiefs, winners.at(0));
                }
                //No head delegate
                else {
                    assignDelegateBadges(*this, daoId, election.getId(), winners, std::nullopt);
                }
                

                election.setStatus(upvote_common::upvote_status::FINISHED);
            }
        }
        else if (reschedule){
            scheduleElectionUpdate(*this, election, end);
        }
    }
    else {
        EOS_CHECK(
            false,
            "Election already finished or canceled"
        )   
    }

    election.update();
}

void upvote::cancelupvelc(uint64_t election_id)
{
    UpvoteElection election(*this, election_id);

    auto daoId = election.getDaoID();

    checkAdminsAuth(daoId);

    auto status = election.getStatus();

    bool isOngoing = status == upvote_common::upvote_status::ONGOING;

    EOS_CHECK(
        isOngoing ||
        status == upvote_common::upvote_status::UPCOMING,
        // to_str("Cannot cancel election with ", status, " status")
        "Cannot cancel election with status"
    );

    if (isOngoing) {
        election.getCurrentRound().erase();
        Edge::get(get_self(), daoId, election.getId(), upvote_common::links::ONGOING_ELECTION).erase();
    } 
    else {
        Edge::get(get_self(), daoId, election.getId(), upvote_common::links::UPCOMING_ELECTION).erase();
    }

    election.setStatus(upvote_common::upvote_status::CANCELED);

    election.update();
}

void upvote::castelctnvote(uint64_t round_id, name voter, std::vector<uint64_t> voted)
{
    eosio::require_auth(voter);

    //TODO: Cancel existing Delegate badges

    //Verify round_id is the same as the current round
    ElectionRound round(*this, round_id);

    UpvoteElection election = round.getElection();

    //Current round has to be defined
    auto currentRound = election.getCurrentRound();

    EOS_CHECK(
        currentRound.getId() == round_id,
        "You can only vote on the current round"
    );

    auto memberId = getMemberID(voter);

    EOS_CHECK(
        badges::hasVoterBadge(*this, election.getDaoID(), memberId) ||
        //Just enable voting to candidates if the round is not the first one
        (currentRound.isCandidate(memberId) && currentRound.getDelegatePower() > 0),
        "Only registered voters are allowed to perform this action"
    );

    auto votedEdge = Edge::getOrNew(get_self(), get_self(), round_id, memberId, eosio::name("voted"));

    if (voted.empty()) {
        votedEdge.erase();
        return;
    }

    if (auto voteGroup = VoteGroup::getFromRound(*this, round_id, memberId)) {
        voteGroup->castVotes(round, std::move(voted));
    }
    else {
        VoteGroup group(*this, memberId, VoteGroupData{
            .round_id = static_cast<int64_t>(round_id)
        });

        group.castVotes(round, std::move(voted));
    }
}

/*
election_config: [
    [
        { "label": "content_group_label", "value": ["string", "details"] },
        //Upvote start date-time
        { "label": "upvote_start_date_time", "value": ["timepoint", "..."] },
        //How much will chief/head Delegates hold their badges after upvote is finished
        { "label": "upvote_duration", "value": ["int64", 7776000] },
    ],
    [
        { "label":, "content_group_label", "value": ["string", "round"] },
        //Duration in seconds
        { "label": "duration", "value": ["int64", 9000] },
        //One of "delegate"|"chief"|"head"
        { "label": "type", "value": ["string", "delegate"] }, 
        //Number that indicates the order of this round, should start at 0 and increment by 1 for each round
        { "label": "round_id", "value": ["int64", 0] },
        //Number of candidates that will pass after the round is over
        { "label": "passing_count", "value": ["int64", 50] }

    ],
    [
        { "label":, "content_group_label", "value": ["string", "round"] },
        { "label": "duration", "value": ["int64", 9000] }, //Duration in seconds
        { "label": "type", "value": ["string", "chief"] },
        { "label": "round_id", "value": ["int64", 1] },
        { "label": "passing_count", "value": ["int64", 5] }
    ],
    [
        { "label":, "content_group_label", "value": ["string", "round"] },
        { "label": "duration", "value": ["int64", 9000] }, //Duration in seconds
        { "label": "type", "value": ["string", "head"] },
        { "label": "round_id", "value": ["int64", 1] },
        { "label": "passing_count", "value": ["int64", 1] }
    ]
]
*/
void upvote::createupvelc(uint64_t dao_id, ContentGroups& election_config)
{
    verifyDaoType(dao_id);
    checkAdminsAuth(dao_id);

    auto cw = ContentWrapper(election_config);

    auto startDate = cw.getOrFail(
        DETAILS, 
        upvote_common::items::UPVOTE_STARTDATE
    )->getAs<time_point>();

    auto duration = cw.getOrFail(
        DETAILS,
        upvote_common::items::UPVOTE_DURATION
    )->getAs<int64_t>();

    time_point endDate = startDate;

    //Will calculate also what is the endDate for the upvote election
    auto rounds = getRounds(election_config, endDate);

    UpvoteElection upvoteElection(*this, dao_id, UpvoteElectionData{
        .start_date = startDate,
        .end_date = endDate,
        .status = upvote_common::upvote_status::UPCOMING,
        .duration = duration
    });

    createRounds(*this, upvoteElection, rounds, startDate, endDate);

    scheduleElectionUpdate(*this, upvoteElection, startDate);
}

void upvote::editupvelc(uint64_t election_id, ContentGroups& election_config)
{
    //TODO: Change existing delegate badges
    //end time according to the new upvoteElection.getEndDate(), 
    //also reschedule for archive
    UpvoteElection upvoteElection(*this, election_id);
    auto daoId = upvoteElection.getDaoID();
    
    verifyDaoType(daoId);
    checkAdminsAuth(daoId);

    EOS_CHECK(
        upvoteElection.getStatus() == upvote_common::upvote_status::UPCOMING,
        "Only upcoming elections can be edited"
    );

    for (auto& rounds : upvoteElection.getRounds()) {
        rounds.erase();
    }

    auto cw = ContentWrapper(election_config);

    auto startDate = cw.getOrFail(
        DETAILS, 
        upvote_common::items::UPVOTE_STARTDATE
    )->getAs<time_point>();

    auto duration = cw.getOrFail(
        DETAILS,
        upvote_common::items::UPVOTE_DURATION
    )->getAs<int64_t>();

    time_point endDate = startDate;

    //Will calculate also what is the endDate for the upvote election
    auto rounds = getRounds(election_config, endDate);

    upvoteElection.setStartDate(startDate);
    upvoteElection.setEndDate(endDate);
    upvoteElection.setDuration(duration);
    upvoteElection.validate();
    upvoteElection.update();

    createRounds(*this, upvoteElection, rounds, startDate, endDate);

    scheduleElectionUpdate(*this, upvoteElection, startDate);
}

// } // namespace hypha



// // TODO: we either need this or some clever method to 
// // get the data we nede without importing the Settings object
// // We only need this to get the next schedule ID
// // NIK

// // only need it for this:
// //     auto nextID = dhoSettings->getSettingOrDefault("next_schedule_id", int64_t(0));

// Settings* dao::getSettingsDocument(uint64_t daoID)
// {
//   TRACE_FUNCTION();

//   //Check if it'S already loaded in cache
//   for (auto& settingsDoc : m_settingsDocs) {
//     if (settingsDoc->getRootID() == daoID) {
//       return settingsDoc.get();
//     }
//   }

//   //If not then we have to load it
//   auto edges = m_documentGraph.getEdgesFromOrFail(daoID, common::SETTINGS_EDGE);
//   EOS_CHECK(edges.size() == 1, "There should only exists only 1 settings edge from a dao node");

//   m_settingsDocs.emplace_back(std::make_unique<Settings>(
//     *this,
//     edges[0].to_node,
//     daoID
//     ));

//   return m_settingsDocs.back().get();
// }

// Settings* dao::getSettingsDocument()
// {
//   TRACE_FUNCTION();

//   return getSettingsDocument(getRootID());
// }


// // #endif