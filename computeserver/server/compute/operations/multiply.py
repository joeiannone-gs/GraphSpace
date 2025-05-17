"""Multiply"""
import tensorflow as tf

from computeserver.server.protos.node_pb2 import Metadata
from computeserver.server.types.value import TypicalValue


def multiply(_value: TypicalValue, input_values: list[TypicalValue], _metadata: Metadata):
  """Multiply (element-wise)."""

  left = input_values[0] if input_values[0] is not None else []
  right = input_values[1] if input_values[1] is not None else []
  result = tf.multiply(left, right)
  return result
