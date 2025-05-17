import ast

from computeserver.server.types.value import TensorType

from .safe_tensors import get_safe_tensor_metadata, get_safe_tensor_value
from .nested_array import get_nested_array_entry
from computeserver.server.protos.node_pb2 import Metadata

#saveType, pointer, fileName, fileSize

def get_node_value(user_id: str, graph_id: str, metadata: Metadata, truncated_if_available: bool = False):

    pointer = metadata.values['pointer'].stringValue
    save_type = metadata.values['saveType'].stringValue
    is_public = 'public' in pointer
    file_pointer = pointer if is_public else graph_id

    if metadata.values['saveType'].stringValue == 'tensor':
        if truncated_if_available:
            tensor_metadata = get_safe_tensor_metadata(file_pointer, user_id, public=is_public) #this is a safe tensor's metadata
            truncated = tensor_metadata.get('truncated')
            if metadata and truncated:
                res: TensorType = ast.literal_eval(truncated)
                return res
        val = get_safe_tensor_value(file_pointer, user_id, pointer, is_public)
        return val
        
    elif save_type == 'list':
        nested_array_entry = get_nested_array_entry(pointer, is_public, None, user_id)
        if nested_array_entry:
            if truncated_if_available and nested_array_entry.trunctated_value:
                return nested_array_entry.trunctated_value
            return nested_array_entry.value

    return None

