"Slice"

import tensorflow as tf
import numpy as np
from computeserver.server.services.basic import get_shape
from computeserver.server.types.value import TensorType, TypicalValue
from computeserver.server.protos.node_pb2 import Node, Metadata
from computeserver.server.types.value import ValueMap

 

def slice_op(_value: TypicalValue, input_values: list[TypicalValue], metadata: Metadata):
    """Slice a tensor"""
    
   

    to_be_sliced = input_values[0]
    slice_per_axis = [[int(elem) for elem in row.elems] for row in metadata.values['slice'].matrixValue.rows]

    shape = to_be_sliced.shape if isinstance(to_be_sliced, tf.Tensor) else get_shape(to_be_sliced)

    start = [x[0] for x in slice_per_axis]    # get all start values
    stop = [x[1] if x[1] != -1 else shape[i] for i, x in enumerate(slice_per_axis)]      # replace -1s with full length of that axis
    strides = [x[2] for x in slice_per_axis] 

    
    if isinstance(to_be_sliced, tf.Tensor):
      
        sliced_tensor = tf.strided_slice(to_be_sliced, 
            begin=start, 
            end=stop, 
            strides=strides)

        return sliced_tensor

   
    #This is necessary for values that are not rectangular
    sliced_array = slice_list(to_be_sliced, start, stop, strides) 

    if isinstance(sliced_array, list) and len(sliced_array) == 1:
        return sliced_array[0]
        
    return sliced_array
    

def slice_list(lst: TensorType, start: list[int], stop: list[int], stride: list[int]):
    """
    Slice a nested list using start, stop, stride parameters for each dimension.
    """
    if not isinstance(lst, list):
        return lst
        
    if not start:
        return lst
        
    # Get slice parameters for current dimension
    s = start[0]
    e = stop[0] 
    step = stride[0]
    
    # Slice current dimension
    sliced = lst[s:e:step]
    
    # Recursively slice remaining dimensions
    if len(start) > 1:
        return [slice_list(x, start[1:], stop[1:], stride[1:]) for x in sliced]
    return sliced
