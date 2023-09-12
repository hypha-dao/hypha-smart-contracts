#pragma once

#include <eosio/eosio.hpp>
#include <document_graph/document_graph.hpp>

using namespace eosio;

namespace hypha
{
    name getDaoName();
    DocumentGraph getGraph();
}
