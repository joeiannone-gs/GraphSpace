"""Pop operation"""


from computeserver.server.protos.node_pb2 import  Metadata
from computeserver.server.types.value import TypicalValue


def pop(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """Pop an item from a stack"""

    input = input_values[0]

    if isinstance(input, list):
        return input.pop()
    else:
        # Handle the case where input is not a list
        return input
 
