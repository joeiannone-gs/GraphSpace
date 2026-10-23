



# All Node Types
from computeserver.server.protos.node_pb2 import NodeTypeEnum


ALL_NODE_TYPES = {
    "add",
    "subtract",
    "multiply",
    "divide",
    "value",
    "square",
    "average",
    "parameter",
    "relu",
    "slice",
    "import",
    "chart",
    "flatten",
    "array", 
    "image",
    "stack",
    "pop", 
    "dot"
}


# Nodes whos values should be stored in the safe tensor file
# All values from the client are are expected to be rectangular arrays
SHOULD_STORE_VALUE = { NodeTypeEnum.VALUE, NodeTypeEnum.IMPORT}



# Nodes that recieve updates on the frontend
SHOULD_RECEIVE_UPDATES = {
    NodeTypeEnum.PARAMETER,
    NodeTypeEnum.SLICE,
    NodeTypeEnum.IMAGE,
    NodeTypeEnum.VALUE,
    NodeTypeEnum.POP
}

SHOULD_RECEIVE_STREAMING_UPDATES = {
    NodeTypeEnum.PARAMETER,
    NodeTypeEnum.AVERAGE
}



OMIT_THRESHOLD = 10 * 1024 * 1024  # 10MB in bytes
