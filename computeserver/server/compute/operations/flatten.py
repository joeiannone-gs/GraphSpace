"""Flatten operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import  Metadata
from computeserver.server.types.value import TypicalValue


def flatten(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """Flatten a tensor to 1D"""
    
    input_val = input_values[0] if input_values[0] is not None else []
    
    if input_val == []:
        return []
    
    return tf.reshape(input_val, [-1])
    
