"""Array operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import Node, Metadata
from computeserver.server.types.value import TypicalValue, ValueMap


def array(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
    """Create an array from input values"""
    
    if not input_values or all(v is None for v in input_values):
        return []
    
    # Filter out None values
    valid_inputs = [v for v in input_values if v is not None]
    return tf.stack(valid_inputs)
 
