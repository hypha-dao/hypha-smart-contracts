#pragma once
#include <document_graph/document.hpp>
#include <eosio/name.hpp>
// #include <config/config.hpp>

// This can be rewritten to take a name - the dao contract name- as parameter, instead of a dao class.

using eosio::name;

namespace hypha
{
    class dao;

    class TypedDocument
    {
        public:
            TypedDocument(name dao, uint64_t id, eosio::name type);
            const std::string& getNodeLabel();
            Document& getDocument();
            uint64_t getId() const;
            virtual ~TypedDocument();
            void update();
            void erase();
            name& getDao() const;
            static Document withType(name dao, uint64_t id, eosio::name type);
        protected:
            TypedDocument(name dao, eosio::name type);
            void initializeDocument(name dao, ContentGroups &content);
            bool documentExists(name dao, const uint64_t& id);
            virtual const std::string buildNodeLabel(ContentGroups &content) = 0;
            void updateDocument(ContentGroups content);
            eosio::name getType();
            ContentWrapper getContentWrapper() { return document.getContentWrapper(); }
        private:
            name m_dao;
            Document document;
            void validate();
            ContentGroups& processContent(ContentGroups& content);
            eosio::name type;

    };

    // namespace document_types
    // {
    //     constexpr eosio::name VOTE = eosio::name("vote");
    //     constexpr eosio::name VOTE_TALLY = eosio::name("vote.tally");
    //     constexpr eosio::name COMMENT = eosio::name("comment");
    //     constexpr eosio::name COMMENT_SECTION = eosio::name("cmnt.section");
    //     constexpr eosio::name REACTION = eosio::name("reaction");
    // }
}
