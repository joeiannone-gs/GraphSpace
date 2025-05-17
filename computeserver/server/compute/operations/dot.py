"""Dot operation"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import  Metadata
from computeserver.server.types.value import TypicalValue

def dot(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):

    left = input_values[0] if input_values[0] is not None else []
    right = input_values[1] if input_values[1] is not None else []

    result = tf.tensordot(left, right, axes=1)
    return result