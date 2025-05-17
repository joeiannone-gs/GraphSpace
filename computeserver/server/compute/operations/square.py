"""Square operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import Node, Metadata
from computeserver.server.types.value import TypicalValue, ValueMap

def square(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """Square the input tensor"""

    input_val = input_values[0] if input_values[0] is not None else []
    return tf.square(input_val)

