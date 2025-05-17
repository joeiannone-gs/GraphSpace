import os
import uuid 

from computeserver.server.types.value import TensorType
import tensorflow as tf 
from safetensors.tensorflow import save_file, load_file, safe_open
from .helpers import get_file_path



def create_safe_tensor_file(user_id: str, adj_list_id: str) -> None:
    """Create a new safe tensor file for an adjList"""
    file_path = get_file_path(user_id, 'safe_tensors', adj_list_id, 'safetensors')
    save_file({}, file_path, metadata={"blank": "blank"})


def delete_safe_tensor_file(user_id: str, adj_list_id: str) -> None:
    """Delete the safe tensor file for an adjList"""
    file_path = get_file_path(user_id, 'safe_tensors', adj_list_id, 'safetensors')
    try:
        os.remove(file_path)
    except FileNotFoundError:
        pass


def update_safe_tensor_value(user_id: str, adj_list_id: str, new_value: TensorType, value_pointer: str | None = None, metadata: dict[str, str] | None = None):
    """Update a value in the safe tensor file for an adjList"""
    file_path = get_file_path(user_id, 'safe_tensors', adj_list_id, 'safetensors')

    loaded = load_file(file_path)
    
    if not value_pointer:
        value_pointer = str(uuid.uuid4())

    loaded[value_pointer] = tf.convert_to_tensor(new_value, dtype=tf.float16)
    save_file(loaded, file_path, metadata=metadata)

    return value_pointer


def get_safe_tensor_value(file_pointer: str, user_id: str | None = None, 
                         value_pointer: str | None = None, 
                         public: bool = False) :
    """Get a value from the safe tensor file for an adjList"""
    resource_type = 'tensors' if public else 'safe_tensors'
    extension = 'safetensors'

    if public:
        file_path = get_file_path(None, resource_type, file_pointer, extension, public=True)
        value_pointer = file_pointer
    else:
        file_path = get_file_path(user_id, resource_type, file_pointer, extension)
    
    loaded = load_file(file_path)

    if value_pointer is None:
        return None

    tensor = loaded[value_pointer]
    
    return tensor


def get_safe_tensor_metadata(file_pointer: str, user_id: str | None = None, public: bool = False) -> dict[str, str]:
    """Get metadata from the safe tensor file for an adjList"""
    resource_type = 'tensors' if public else 'safe_tensors'
    extension = 'safetensors'
    
    if public:
        file_path = get_file_path(None, resource_type, file_pointer, extension, public=True)
    else:
        file_path = get_file_path(user_id, resource_type, file_pointer, extension)
    
    with safe_open(file_path, framework="tf") as f:
        return f.metadata() or {}
