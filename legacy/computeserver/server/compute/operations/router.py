"""Router"""
from computecomputeserver.server.computeserver.server.services.compute import calc_condition, get_path
from computecomputeserver.server.computeserver.server.services.basic import topological_sort

def router(node_id, remaining_nodes, input_ids, graph):
    """Route computation depending on the input values and the specified conditional"""
    node = graph.nodeIdMap[node_id]
    if len(input_ids) == 2:

        # Calculate condition
        left = graph.nodeIdMap[input_ids[0]].get('value').numpy()
        right = graph.nodeIdMap[input_ids[1]].get('value').numpy()
        operator = node['typeInfo'][0]

        condition = calc_condition(left, right, operator)

        # Get list of node indexes for active path
        path = get_path(condition, node, graph.paths)

        # Create list of remaining nodes in top_sort array,
        # append this list to active path (+1 so does not include router node )
        unsorted = path + remaining_nodes

        # top_sort new unsorted list, ignore dependencies that
        # aren't in list (would already be marked computed)
        sorted_path = topological_sort(unsorted, graph)
        print("routing topsort: " + str(sorted_path))
        # Return new toposort
        return sorted_path
