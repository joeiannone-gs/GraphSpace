"""ReLU operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import Node, Metadata
from computeserver.server.types.value import TypicalValue, ValueMap


def relu(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """ReLU activation function"""

    input_val = input_values[0] if input_values[0] is not None else []
    return tf.nn.relu(input_val)
    
