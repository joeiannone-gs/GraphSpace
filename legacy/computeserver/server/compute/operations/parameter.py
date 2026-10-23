"""Parameter"""

import tensorflow as tf

from computeserver.server.protos.node_pb2 import Metadata, Node
from computeserver.server.types.value import TypicalValue, ValueMap


def parameter(value: TypicalValue, input_values: list[TypicalValue], metadata: Metadata):
    """Parameter nodes update their value to minimize a loss abstraction node"""

    size_array = [int(elem) for elem in metadata.values['shape'].arrayValue.elems]

    variable = value if value is not None else []

    if not isinstance(variable, tf.Variable):
        starting_tensor = tf.random.normal(size_array)
        variable = tf.Variable(starting_tensor, trainable=True) # Trainable variables are automatically watched by gradient tape

    return variable
