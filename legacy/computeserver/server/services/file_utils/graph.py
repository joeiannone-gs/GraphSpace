import os

from computeserver.server.protos.deltas_pb2 import ForwardDeltas
from computeserver.server.protos.graph_pb2 import Graph
from computeserver.server.protos.node_pb2 import Node
from computeserver.server.protos.edge_pb2 import Edge
from .helpers import get_file_path, write_file_with_directory_check



def create_graph(user_id: str, graph_id: str) -> None:
    """Create a new graph binary file using Protocol Buffers"""
    file_path = get_file_path(user_id, 'graphs', graph_id)
    graph = Graph()  
    write_file_with_directory_check(file_path, graph.SerializeToString())


def get_graph_as_proto_message(user_id: str, graph_id: str) -> Graph:
    graph = Graph()
    binary = get_graph_binary(user_id, graph_id)
    graph.ParseFromString(binary)
    return graph
    

def get_graph_binary(user_id: str, graph_id: str) -> bytes:
    """Get the stored binary for a graph"""
    file_path = get_file_path(user_id, 'graphs', graph_id)
    try:
        with open(file_path, 'rb') as f:
            return f.read()
    except FileNotFoundError:
        # Create and then return the binary
        create_graph(user_id, graph_id)
        return get_graph_binary(user_id, graph_id)


def write_graph_to_file(user_id: str, graph_id: str, graph: Graph) -> None:
    """Write the graph to a binary protocol buffer file"""
    file_path = get_file_path(user_id, 'graphs', graph_id)
    write_file_with_directory_check(file_path, graph.SerializeToString())


def delete_graph(user_id: str, pointer: str) -> None:
    """Delete the graph binary and safe tensor files for a pointer"""
    graph_path = get_file_path(user_id, 'graphs', pointer)
    safe_tensor_path = get_file_path(user_id, 'safeTensors', pointer, 'safetensors')
    
    for path in [graph_path, safe_tensor_path]:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass



def apply_deltas(user_id: str, graph_id: str, deltas: ForwardDeltas):
    """
    Apply deltas to a graph
    This includes: 
        - 'add' -> Add some object to some map (nodeIdMap, edgeIdMap, etc.) in a graph (adjList)
        - 'delete'-> Delete some object from some map in a graph
        - 'update'-> Update some property of some object in some graph
    This is all the information that is needed to describe a change from one graph
    to another.
    """
    print("Recieved Deltas")

    graph_pb = get_graph_as_proto_message(user_id, graph_id)


    # Add 
    for id, node in deltas.add.nodeIdMap.items(): 
        graph_pb.nodeIdMap[id].CopyFrom(node)

    for id, edge in deltas.add.edgeIdMap.items(): 
        graph_pb.edgeIdMap[id].CopyFrom(edge)
    
    # Delete
    for id in deltas.delete.nodeIdMap:
        if id in graph_pb.nodeIdMap:
            del graph_pb.nodeIdMap[id]

    for id in deltas.delete.edgeIdMap:
        if id in graph_pb.edgeIdMap:
            del graph_pb.edgeIdMap[id]
            
    # Update
    for entry, updated in deltas.update.nodeIdMap.items():
        if entry in graph_pb.nodeIdMap:
            node = graph_pb.nodeIdMap[entry]
            update_field(node, updated)
        
    for entry, updated in deltas.update.edgeIdMap.items():
        if entry in graph_pb.edgeIdMap:
            edge = graph_pb.edgeIdMap[entry]
            update_field(edge, updated)

    name_change = deltas.update.name
    if name_change and name_change != "":
        graph_pb.name = name_change

    description_change = deltas.update.description
    if description_change and description_change != "":
        graph_pb.description = description_change
    
    #Store
    write_graph_to_file(user_id, graph_id, graph_pb)

    return graph_pb



def update_field(obj: Node | Edge, updated: Node | Edge):

    for field, value in updated.ListFields():
        attr = getattr(obj, field.name)
        if field.label == field.LABEL_REPEATED:
            attr[:] = value
        else:
            if isinstance(value, (int, float, str, bool)):  # Check if value is a primitive
                setattr(obj, field.name, value)
            else:
                attr.CopyFrom(value)  # Assume it's a proto message