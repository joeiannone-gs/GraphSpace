"""Print to console"""

from computeserver.server.protos.node_pb2 import Node
from computeserver.server.types.value import ValueMap

def console(nodes: list[Node], input_ids: list[int], values: ValueMap):
    """Print to console (assumes one input)"""

    # Assumes one input
    input_id = input_ids[0]
    input_value = values.get(nodes[input_id].valuePointer)
    print("VALUE: " + str(input_value.numpy()))
