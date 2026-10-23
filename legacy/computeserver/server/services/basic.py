"""Basic services, such as topologically sorting a graph."""

from computeserver.server.protos.value_pb2 import NestedArray
from computeserver.server.services.file_utils.nested_array import convert_from_nested_array
import tensorflow as tf
# from server.types.graph import Graph, Node
from computeserver.server.protos.graph_pb2 import Graph
from computeserver.server.protos.node_pb2 import Node
from computeserver.server.types.value import TensorType


def topological_sort(node_ids: list[str], graph: Graph) -> list[str]:
    """
    Performs topological sorting on a subset of nodes in the graph.
    
    Returns a list of node IDs in topological order (dependencies come before dependents).
    Removes abstraction nodes from consideration.
    
    Raises ValueError if the graph contains a cycle.
    """
    node_ids = remove_abs_nodes(node_ids, graph)
    visited: set[str] = set()  # To keep track of visited nodes
    stack = []       # Will contain the topologically sorted elements
    in_process: set[str] = set()  # To detect cycles

    def dfs(node_id: str | None):
        if node_id is None:
            return
        if node_id in in_process:
            raise ValueError(f"Cycle detected in the graph involving node '{node_id}'")
        if node_id not in visited:
            visited.add(node_id)
            in_process.add(node_id)
            # Get and process dependencies that are in our subset of interest
            deps = [dep for dep in get_dependencies(node_id, graph) if dep in node_ids]
            for neighbor in deps:
                dfs(neighbor)
            in_process.remove(node_id)
            stack.append(node_id)

    for node_id in node_ids:
        if node_id not in visited:
            dfs(node_id)

    return stack


def remove_abs_nodes(node_ids: list[str], graph: Graph):
    node_id_map = graph.nodeIdMap
    """Remove abstraction node ids from a list of ids"""
    ids_to_keep: list[str] = []
    for node_id in node_ids:
        node = node_id_map.get(node_id)
        if node and not is_abs_node(node):
            ids_to_keep.append(node_id)
    return ids_to_keep


def get_dependencies(node_id: str, graph: Graph):
    """Get the Ids of the nodes that input into the given node"""
    node_id_map = graph.nodeIdMap
    edge_id_map = graph.edgeIdMap
    node = node_id_map[node_id]
    incoming = node.incomingEdges
    dependencies: list[str] = []
    for edge_id in incoming:
        edge = edge_id_map[edge_id]
        if edge:
            start_node_id = edge.startNodeId
            if start_node_id: 
                dependencies.append(start_node_id)
    return dependencies


def get_descendants(abs_node_id: str, graph: Graph): 
    node_id_map = graph.nodeIdMap
    """Get all base nodes that are descendant of the abs node"""
    abs_node = node_id_map[abs_node_id]
    children = list(abs_node.children)
    if not contains_abs_nodes(children, graph): 
        return children
    # If there are abs nodes, return their descendants plus the base nodes in children
    remaining_abs_node_ids = get_abs_nodes(children, graph)
    remaining_descendants = []
    for rem_abs_node_id in remaining_abs_node_ids:
        remaining_descendants.extend(get_descendants(rem_abs_node_id, graph)) 
    base_nodes = remove_abs_nodes(children, graph)
    all = base_nodes + remaining_descendants
    if 'ca3e8242bacc7548' in all:
        print('help')
    return  all


def contains_abs_nodes(node_ids: list[str], graph: Graph):
    """Does this list of node ids contain any ids of abs nodes"""
    return any(is_abs_node(graph.nodeIdMap[node_id]) for node_id in node_ids)



def get_abs_nodes(node_ids: list[str], graph: Graph) -> list[str]:
    """Given a list of node ids return, only the ids for abs nodes"""
    return [node_id for node_id in node_ids if is_abs_node(graph.nodeIdMap[node_id])]



def is_abs_node(node: Node):
    """
    Checks if node obj is Abs Node
    """
    return len(node.children) > 0



def convert_to_list(value: TensorType | NestedArray | tf.Tensor | tf.Variable ) -> TensorType:

    if isinstance(value, list): #TensorType
        return value

    if isinstance(value, NestedArray):
        return convert_from_nested_array(value)

    if isinstance(value, (tf.Tensor, tf.Variable)):
        val = value.numpy().tolist()
        if isinstance(val, (int, float)):
            return [val]
        return val
    
    raise ValueError("Unsupported type for conversion to list. Expected TensorType, NestedArray, tf.Tensor, or tf.Variable.")
    



def get_display_node_ids(graph: Graph):
    """Return a list of display node ids"""
    return [node_id for node_id, node in graph.nodeIdMap.items() if node.metadata == "display"]



def is_rectangular(arr: TensorType):
    """
    Check if a multidimensional array is rectangular (all sub-arrays at each level have equal length).
    """
    if not isinstance(arr, list):
        return True  # Base case: non-array elements are considered "rectangular"
    
    if len(arr) == 0:
        return True  # Empty arrays are considered rectangular
    
    # Get shape of first element
    first_element_shape = get_shape(arr[0])
    
    # Check if all elements have the same shape and are rectangular
    for element in arr:
        element_shape = get_shape(element)
        if not is_equal_shape(element_shape, first_element_shape) or not is_rectangular(element):
            return False
    
    return True


def get_shape(arr: TensorType):
    """Get the shape of a nested array"""
    shape: list[int] = []
    current = arr
    while isinstance(current, list):
        shape.append(len(current))
        if len(current) == 0:
            break
        current = current[0]
    return shape


def is_equal_shape(shape1: list[int], shape2: list[int]):
    """Check if two shapes are equal"""
    return len(shape1) == len(shape2) and all(dim1 == dim2 for dim1, dim2 in zip(shape1, shape2))



def truncate_array(array: TensorType, max_elems: int = 100, max_string_length: int = 10) -> TensorType:
    """
    Truncate a multidimensional array to have at most max_elems in each dimension.
    The last element of each dimension is preserved, and cut elements are represented by "...N..."
    where N is the count of omitted elements.
    """
    def _truncate_recursive(arr: TensorType , depth=0) -> TensorType:
        # Base case: if we have a scalar or have reached a primitive type
        if not hasattr(arr, '__len__') or isinstance(arr, (str, bytes)):
            if isinstance(arr, (int, float)) and len(str(arr)) > max_string_length:
                return float(format(arr, f'.{max_string_length}g'))
            return arr
        
        # If the array is too long, truncate it
        if len(arr) > max_elems:
            # Keep first (max_elems-1) elements and the last element
            first_part = [_truncate_recursive(item, depth+1) for item in arr[:max_elems-1]]
            last_part = [_truncate_recursive(arr[-1], depth+1)]
            
            # Calculate omitted count
            omitted_slice = arr[max_elems-1:-1]
            omitted_count = 0
            for item in omitted_slice:
                if isinstance(item, str):
                    # Check if item is already an omitted count string
                    import re
                    match = re.match(r'\.\.\.(\d+)\.\.\.', item)
                    if match:
                        omitted_count += int(match.group(1)) + 1
                        continue
                omitted_count += 1
                
            # Insert the ellipsis with count
            return first_part + [f"...{omitted_count}..."] + last_part
        else:
            # If array is not too long, just process each element recursively
            return [_truncate_recursive(item, depth+1) for item in arr]
    
    return _truncate_recursive(array)