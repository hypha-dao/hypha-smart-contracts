#include <upvote_election/graph.hpp>

namespace hypha
{
    name getDaoName()
    {
        // TODO: Make this configurable, maybe in a table, etc.
        return "dao.hypha"_n;
    }

    DocumentGraph getGraph()
    {
        return hypha::DocumentGraph(getDaoName());
    }
}
