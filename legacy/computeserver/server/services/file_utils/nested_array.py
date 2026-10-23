from computeserver.server.types.value import TensorType
from .helpers import get_file_path, write_file_with_directory_check


from computeserver.server.protos.nested_array_store_pb2 import NestedArrayEntry, NestedArrayStore
from computeserver.server.protos.value_pb2 import NestedArray




def create_nested_array_proto(user_id: str, graph_id: str):
    """Create a new jagged array proto file for a graph"""
    file_path = get_file_path(user_id, 'nested_array', graph_id)
    nested_array_proto: NestedArrayStore = NestedArrayStore()
    write_file_with_directory_check(file_path, nested_array_proto.SerializeToString())
    return nested_array_proto


def update_nested_array_entry(user_id: str, graph_id: str, pointer: str, value: NestedArray, truncated: NestedArray | None = None):
    """Update or add an entry in the jagged array proto file"""
    file_path = get_file_path(user_id, 'nested_array', graph_id)
    nested_array_message = NestedArrayStore()
    
    try:
        with open(file_path, 'rb') as f:
            nested_array_message.ParseFromString(f.read())
    except FileNotFoundError:
        nested_array_message = create_nested_array_proto(user_id, graph_id)
    
    entry = NestedArrayEntry()
    entry.value = value
    if truncated:
        entry.trunctated_value = truncated
    
    # Add or update the entry in the map
    nested_array_message.map[pointer].CopyFrom(entry)
    
    # Write the updated proto back to file
    write_file_with_directory_check(file_path, nested_array_message.SerializeToString())
    
    return pointer



def get_nested_array_entry(pointer: str, public: bool = False, name: str | None = None, user_id: str | None = None):
    """Retrieve a specific nested array entry from either user or public directory"""
    if public:
        file_path = get_file_path(None, 'nested-array', pointer, public=True)
    else:
        if not user_id or not name:
            return None
        file_path = get_file_path(user_id, 'nested-array', name)
    
    try:
        with open(file_path, 'rb') as f:
            nested_array_map = NestedArrayStore()
            nested_array_map.ParseFromString(f.read())
        
        if pointer in nested_array_map.map:
            return nested_array_map.map[pointer]
    except FileNotFoundError:
        pass
        
    return None


def convert_from_nested_array(arr: NestedArray) -> TensorType:
    if arr.HasField('arrayOfValues'):
        return [value.floatValue if value.HasField('floatValue') else value.stringValue for value in arr.arrayOfValues.values]
    elif arr.HasField('arrayOfNestedArrays'):
        return [convert_from_nested_array(nested) for nested in arr.arrayOfNestedArrays.nestedArrays]
    else:
        return []


def convert_to_nested_array(arr: TensorType) -> NestedArray:
    nested_array = NestedArray()
    if isinstance(arr, list) and all(isinstance(item, (int, float, str)) for item in arr):
        array_of_values = nested_array.arrayOfValues
        for item in arr:
            value = array_of_values.values.add()
            if isinstance(item, (int, float)):
                value.floatValue = float(item)
            elif isinstance(item, str):
                value.stringValue = item
    elif isinstance(arr, list):
        array_of_nested_arrays = nested_array.arrayOfNestedArrays
        for item in arr:
            nested_array_item = convert_to_nested_array(item)
            array_of_nested_arrays.nestedArrays.append(nested_array_item)
    return nested_array