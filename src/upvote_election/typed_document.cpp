// #include <typed_document.hpp>
// #include <dao.hpp>
// #include <logger/logger.hpp>

#include "../../include/upvote/typed_document.hpp"

// TODO we can rename this class ExternalDocument and give it functions
// to interact with the dao contract from the outside - if that makes sense
// NIK
namespace hypha
{

    TypedDocument::TypedDocument(name dao, uint64_t id, eosio::name type)
    : m_dao(dao), document(Document(dao, id)), type(type)
    {
        validate();
    }

    TypedDocument::TypedDocument(name dao, eosio::name type)
    : m_dao(dao), type(type)
    {

    }

    TypedDocument::~TypedDocument()
    {

    }

    const std::string& TypedDocument::getNodeLabel()
    {
        // TRACE_FUNCTION()
        return document.getContentWrapper().getOrFail(
            SYSTEM,
            NODE_LABEL,
            "Typed document does not have a node label"
        )->getAs<std::string>();
    }

    Document& TypedDocument::getDocument()
    {
        return document;
    }

    uint64_t TypedDocument::getId() const
    {
        return document.getID();
    }

    void TypedDocument::initializeDocument(name dao, ContentGroups &content)
    {
        // TRACE_FUNCTION()
        // TODL: call dao.hypha
        document = Document(dao, dao, std::move(processContent(content)));
    }


    void TypedDocument::updateDocument(ContentGroups content)
    {
        document.getContentGroups() = std::move(processContent(content));
        document.update();
    }

    void TypedDocument::validate()
    {
        auto [idx, docType] = document.getContentWrapper().get(SYSTEM, TYPE);

        EOS_CHECK(idx != -1, "Content item labeled 'type' is required for this document but not found.");
        EOS_CHECK(docType->getAs<eosio::name>() == getType(),
                //   to_str("invalid document type. Expected: ", getType(),
                //                "; actual: ", docType->getAs<eosio::name>(), " for document: ", getId())
                // TODO
                  "invalid document type."
        )

        //For now we don't require a node label
        //getNodeLabel();
    }

    ContentGroups& TypedDocument::processContent(ContentGroups& content)
    {
        ContentWrapper wrapper(content);
        auto [systemIndex, contentGroup] = wrapper.getGroupOrCreate(SYSTEM);
        wrapper.insertOrReplace(systemIndex, Content(TYPE, getType()));
        wrapper.insertOrReplace(systemIndex, Content(NODE_LABEL, buildNodeLabel(content)));

        return wrapper.getContentGroups();
    }

    name TypedDocument::getDao() const
    {
        return m_dao;
    }

    Document TypedDocument::withType(name dao, uint64_t id, eosio::name type)
    {
        //Define a dummy class to instanciate the TypedDocument
        class DummyDocument : public TypedDocument {
            using TypedDocument::TypedDocument;
            const std::string buildNodeLabel(ContentGroups &content) override { return ""; }
        };

        //Use constructor to validate type
        Document doc = DummyDocument(dao, id, type).getDocument();
        return doc;
    }

    bool TypedDocument::documentExists(name dao, const uint64_t& id)
    {
        bool exists = Document::exists(dao, id);
        if (exists) {
            return true;
        }

        return {};
    }
    void TypedDocument::update()
    {
        // TODL: call dao.hypha
        document.update();
    }

    void TypedDocument::erase()
    {
        // TODL: call dao.hypha
        
        // previois code:
        // m_dao.getGraph().eraseDocument(getId());
    }

    eosio::name TypedDocument::getType()
    {
        return type;
    }

}
