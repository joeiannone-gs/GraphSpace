"""Display input node values in a chart"""

import tensorflow as tf
from computeserver.server.protos.node_pb2 import Node
from computeserver.server.types.value import ValueMap

def display(node_id_map: dict[int, Node], input_ids: list[int], values: ValueMap):
    """
    Format inputting node values to be an array of points.  
    Valid inputs: 
        1) a single 2d array e.g. [[x, y1, y2, ... yn], [x, y1, y2, ... yn], ...]
        2) an array of xs [x1, x2, x3, ...] followed by different arrays of ys
    For the seconds case, no modification is needed given that this is already 
    in the needed format. The second case will be need to be transformed.
    """

    # First check if there are multiple inputs or just one
    # If there's just one,
    #   If it is a 2d array,    
    #       make an array out of each index of each point, 
    #       return an array of these
    # If there are multiple make sure that they are 1d arrays of the same length
    #   return an array of these
        
    # Collect the input values from the node_id_map using the input_ids
    input_values = [values.get(node_id_map[node_id].valuePointer) for node_id in input_ids]


    if len(input_values) == 1:
        # Only one input
        return tf.transpose(input_values[0])
    else:
        # Multiple inputs
        combined_tensor = tf.concat(input_values, axis = 1)
        final_tensor = tf.transpose(combined_tensor)
        return final_tensor
       