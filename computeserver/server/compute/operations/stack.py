"""Stack operation"""

import copy
from computeserver.server.protos.node_pb2 import Metadata
from computeserver.server.types.value import TypicalValue



def stack(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """Create a stack from an array"""

    input = input_values[0]
    input = input if input is not None else []

    deep_copy = copy.deepcopy(input)
    return deep_copy
