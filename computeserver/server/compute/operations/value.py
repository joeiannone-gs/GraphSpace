"""Value operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import Metadata
from computeserver.server.types.value import TypicalValue


def value(value: TypicalValue, _input_values: list[TypicalValue], _metadata: Metadata):
    """Value operation - returns the value itself, or creates a tensor from metadata if value is None"""
    
    if value is None:
        return tf.constant(0)
        
    return value


