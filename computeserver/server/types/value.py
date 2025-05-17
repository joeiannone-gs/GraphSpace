import tensorflow as tf

# BaseType = TypeVar('BaseType', int, float, str) #str for elipses (...)
type TensorType = list[TensorType] | float | str
type ValueMap = dict[str, tf.Tensor | TensorType]

type TypicalValue = TensorType | tf.Tensor | tf.Variable | None
 