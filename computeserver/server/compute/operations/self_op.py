"""
Self. This means that the graph in the parent abstraction
node is copied into this node (the node becomes an abstraction node)
"""

from computecomputeserver.server.computeserver.server.services.compute import generate_id, remove_lists_nums_from_list
from computecomputeserver.server.computeserver.server.services.basic import topological_sort,  remove_abs_nodes, has_children
from ..constants import ID_LENGTH


def self_op(node_id, remaining_nodes, graph):
    """
    Self. This becomes an abstraction node, with children that
    mirror the graph inside this node's parent.
    """

    nodes = graph.nodeIdMap
    paths = graph.paths
    nodes_length = len(nodes)
    node = nodes[node_id]
    inputs = node.get('inputNodes')

    parent_index = node['parentIndex']
    #If no parent, return
    if parent_index == -1 or not has_children(nodes[parent_index]):
        raise ValueError("Self node has no parent or parent does not have children")

    mirror_index = node['mirrorIndex']
    mirror_node = nodes[mirror_index]
    mirror_children = mirror_node.get('children')
    mirror_children = remove_abs_nodes(nodes, mirror_children, type_to_keep='self')
    # List comp to get the dictionary of original indexes to mirror copy indexes
    # (nodes_length + index is new index when clones are appended)
    original_to_mirror = {
        id_index: nodes_length + index for index, id_index in enumerate(mirror_children)
    }
    # original_to_mirror = {}
    # for index, mirror_child_index in enumerate(mirror_children):
    #     m_i = nodes[mirror_child_index].get('mirrorIndex')
    #     original_to_mirror[m_i] = nodes_length + index

    # Need granular control to deep clone only partially
    # TODO: a way to communicate newly created nodes/create new IDs for the frontend/db
    # Because cloned nodes are only kept track of by index
    new_paths = []
    for original_index, _m_i in original_to_mirror.items():

        create_clone(nodes, original_index, original_to_mirror, paths, new_paths, node_id)

    # Because nodes_length is before we added the clones, so onwards is just clones
    clone_indexes = list(range(nodes_length, len(nodes)))



    # We need to make sure clones of nodes that have inputNodes
    # in a self abs node, have the self base node as an input
    add_correct_self_to_input_nodes(nodes, clone_indexes)


    # We now need to correct the edges going into and out of the self base node
    # (they need to connect to the children of the abstraction node, instead of the self base node)
    # This involves finding the right node and changing its input nodes to the currect indexes

    update_outgoing_edges(nodes, clone_indexes, mirror_children, node_id, mirror_index)
    update_incoming_edges(nodes, clone_indexes, mirror_children, inputs, mirror_index)

    # Create abs and add clones as children
    new_self_abs = create_self_abs(clone_indexes, mirror_index , parent_index)
    # Delete self node (replace with self abstraction node)
    nodes[node_id] = new_self_abs

    # Create new, topsort with remaining nodes and new clones
    unsorted = clone_indexes + remaining_nodes
    # Remove all nodes in paths from nodes we will compute
    path_nodes_removed = remove_lists_nums_from_list(unsorted, new_paths)

    new_top_sort = topological_sort(path_nodes_removed, nodes)
    print("Self node topsort: " + str(new_top_sort))
    return new_top_sort


def add_correct_self_to_input_nodes(nodes, clone_indexes):
    """
    Update the inputs of clones that are mirroring nodes
    getting an output from a self abs node
    """
    self_node_clones = [i for i in clone_indexes if nodes[i]['type'] == 'self']

    for self_node_index in self_node_clones:
        self_node = nodes[self_node_index]
        # FOR INPUTS
        # get nodes going into base self node
        base_self_node = nodes[self_node.get('mirrorIndex')]
        nodes_going_in = get_incoming_nodes(nodes, base_self_node.get('children'))
        # get clones that mirror those nodes
        going_in_mirrors = [
            i for i in clone_indexes if nodes[i].get('mirrorIndex') in nodes_going_in
        ]
        # Set inputNodes of self node clone as those
        self_node["inputNodes"] = going_in_mirrors

        # FOR OUTPUTS
        # find clones that have mirror nodes with inputs that are children of base self abs node
        outgoing_clones = []
        for clone_index in clone_indexes:
            clone = nodes[clone_index]
            clone_mirror = nodes[clone.get('mirrorIndex')]
            mirror_inputs = clone_mirror.get("inputNodes", [])
            for input_index in mirror_inputs:
                # if the input node is a child of the base self abs node
                if nodes[input_index].get('parentIndex') == self_node.get('mirrorIndex'):
                    outgoing_clones.append(clone_index)
        # add self node clone as input for each outgoing clone
        for outgoing in outgoing_clones:
            nodes[outgoing]["inputNodes"].append(self_node_index)


def create_clone(nodes, original_index, original_to_mirror, paths, new_paths, parent):
    """Create a clone of a node given the original. Appends clone to end of node list"""
    original = nodes[original_index]
    clone = {}
    clone['id'] = generate_id(ID_LENGTH)
    # clone['id'] = "S" + generate_id(2) + "B" + original.get('id')
    clone['type'] = original['type']
    # Not all nodes have typeInfo
    type_info = original.get('typeInfo')
    if type_info is not None:
        clone['typeInfo'] = [i for i in type_info]


    # Only copy value if constant
    input_nodes = original.get('inputNodes')
    if input_nodes is None or len(input_nodes) == 0:
        if original.get("type") != "self":
            clone['value'] = original['value']
    else:
        clone['value'] = ""
        # Update input node indexes to correct (cloned) indexes and Remove inputs from self nodes
        clone['inputNodes'] = [
            original_to_mirror.get(i)
            for i in original['inputNodes']
            if i in original_to_mirror and nodes[i].get('type') != 'self'
        ]



    # Update mirror indexes
    clone["mirrorIndex"] = original.get("mirrorIndex")

    # Parent index
    clone["parentIndex"] = parent

    # If router node, create new path with clones and store pointer to path
    if original["type"] == "router":
        type_info = original["typeInfo"]
        true_path_index = int(type_info[1])
        false_path_index = int(type_info[2])
        # Get actual paths
        true_path_array = paths[true_path_index]
        false_path_array = paths[false_path_index]
        # Convert original indexes to cloned indexes
        cloned_true_path = [original_to_mirror[i] for i in true_path_array]
        cloned_false_path = [original_to_mirror[i] for i in false_path_array]
        # Append paths to paths list and add their index to typeInfo
        paths.append(cloned_true_path)
        new_paths.append(cloned_true_path)
        clone['typeInfo'][1] = len(paths) - 1
        paths.append(cloned_false_path)
        new_paths.append(cloned_false_path)
        clone['typeInfo'][2] = len(paths) - 1

    # Add to node's list (they're just appended at the end of the node list)
    nodes.append(clone)


def get_incoming_nodes(nodes, children):
    """
    Nodes going into an abstraction node.
    Equal to the inputNodes indexes that are not in children
    """
    nodes_going_in = []
    for child_index in children:
        child = nodes[child_index]
        input_nodes = child.get('inputNodes', [])
        for input_index in input_nodes:
            if input_index not in children:
                nodes_going_in.append(input_index)
    return nodes_going_in



def create_self_abs(children, mirror_index, parent_index):
    """
    Create a self abstraction node with given children as children
    """
    # Create self ABS node for the new cloned nodes (this essentially replaces the self base node)
    new_self_abs = {}
    new_self_abs['id'] = generate_id(ID_LENGTH)
    new_self_abs['type'] = 'self'
    # add new clone node IDs to be children
    new_self_abs['children'] = children
    new_self_abs['mirrorIndex'] = mirror_index
    new_self_abs["parentIndex"] = parent_index
    return new_self_abs


def update_outgoing_edges(nodes, clone_indexes, _mirror_children, node_index, mirror_index):
    """Replace relevant input of sibilings to input the new children of the self node"""
    # Get node with self node as input

    # Get siblings of self node
    self_node = nodes[node_index]
    sibling_indexes = nodes[self_node.get('parentIndex')].get('children')
    # Get list of nodes w/ self node as input
    indexes_with_self_as_input = [
        index for index in sibling_indexes if node_index in nodes[index].get('inputNodes', [])
    ]
    for index in indexes_with_self_as_input:
        # Get mirror of node
        mirror = nodes[index].get('mirrorIndex')
        # Get input that is child of base self abs node
        mirror_inputs = nodes[mirror].get('inputNodes')
        input_that_is_child = [
            nodes[i] for i in mirror_inputs if nodes[i].get('parentIndex') == mirror_index
        ][0]
        # Get clone that mirrors the same mirror node
        child_mirroring = input_that_is_child.get('mirrorIndex')
        clone_also_mirroring = [
            i for i in clone_indexes if nodes[i].get("mirrorIndex") == child_mirroring
        ][0]
        # Replace input
        inputs = nodes[index]["inputNodes"]
        inputs[inputs.index(node_index)] = clone_also_mirroring


def update_incoming_edges(nodes, clone_indexes, mirror_children, inputs, _mirror_index):
    """Update inputNodes of children to include the nodes going into the self node"""
    for index in inputs:
        input_node = nodes[index]
        mirror = input_node.get("mirrorIndex")
        # get child of base self abs node that has mirror as input
        has_mirror_as_input = [
            i for i in mirror_children if mirror in nodes[i].get('inputNodes', [])
        ][0]
        # get clone that mirrors same node that that node mirrors
        mirror_of = nodes[has_mirror_as_input].get('mirrorIndex')
        input_node = [i for i in clone_indexes if nodes[i].get('mirrorIndex') == mirror_of ][0]
        # Set input of clone to input of self node
        nodes[input_node]["inputNodes"].append(index)
