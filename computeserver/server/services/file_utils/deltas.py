from .helpers import get_file_path, write_file_with_directory_check
from computeserver.server.protos.deltas_pb2 import BackwardDeltas






def write_deltas_to_file(user_id: str, pointer: str, deltas_buffer: bytes) -> None:
    """Write deltas to a binary protocol buffer file"""
    file_path = get_file_path(user_id, 'deltas', pointer)
    write_file_with_directory_check(file_path, deltas_buffer)



def get_deltas_message(user_id: str, pointer: str):
    """Get deltas message from file"""
    file_path = get_file_path(user_id, 'deltas', pointer)
    try:
        with open(file_path, 'rb') as f:
            deltas_buffer = f.read()
            forward_deltas = BackwardDeltas()
            forward_deltas.ParseFromString(deltas_buffer)
            return forward_deltas
    except FileNotFoundError:
        pass



def get_deltas_binary(user_id: str, pointer: str):
    """Get stored protobuf binary"""
    file_path = get_file_path(user_id, 'deltas', pointer)
    try:
        with open(file_path, 'rb') as f:
            return f.read()
    except FileNotFoundError:
        return None
