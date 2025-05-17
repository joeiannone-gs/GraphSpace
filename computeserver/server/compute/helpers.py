"""Helpers for graph computation"""
from computeserver.server.compute.RunningGraph import ValueMap
from computeserver.server.nodes.data_flow import  SHOULD_STORE_VALUE
from computeserver.server.protos import graph_pb2
from computeserver.server.protos.value_pb2 import NestedArray
from computeserver.server.services.compute import generate_id
from computeserver.server.services.file_utils.general import get_node_value
from computeserver.server.services.file_utils.nested_array import convert_from_nested_array


def retrieve_values(user_id: str, graph_id: str, graph: graph_pb2.Graph) -> ValueMap:
    """Replace pointers with actual values"""

    values: ValueMap = {}
    
    for node in graph.nodeIdMap.values():

        if node.type in SHOULD_STORE_VALUE:
            val = get_node_value(user_id, graph_id, node.metadata, False)
            if val != None:
                if isinstance(val, NestedArray):
                    val = convert_from_nested_array(val)
                pointer = node.valuePointer or generate_id(16)
                node.valuePointer = pointer
                values[pointer] = val
        
    return values