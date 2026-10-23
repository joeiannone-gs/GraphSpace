"""Average operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import Node, Metadata
from computeserver.server.types.value import TypicalValue, ValueMap


def average(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """Average of input values"""
    
 
    
    # Stack inputs and average along axis 0
    result = tf.reduce_mean(input_values[0])
    return result

