import asyncio
from computeserver.server.types.value import ValueMap
from typing import Annotated
from fastapi import APIRouter, File, WebSocket
import tensorflow as tf
from computeserver.server.app.routers.utils import create_wrapper
from computeserver.server.compute.RunningGraph import RunningGraph
from computeserver.server.compute.helpers import retrieve_values
from computeserver.server.nodes.data_flow import SHOULD_RECEIVE_STREAMING_UPDATES, SHOULD_RECEIVE_UPDATES
from computeserver.server.protos import wrapper_pb2
from computeserver.server.services.basic import convert_to_list
from computeserver.server.services.file_utils.graph import apply_deltas, get_graph_as_proto_message
from computeserver.server.services.file_utils.nested_array import convert_to_nested_array





router = APIRouter(
    prefix="/run",
    tags=["run"]
)

LEARNING_RATE = 0.0001
OPTIMIZE_INTERVAL = 0.001

running_graphs: dict[str, RunningGraph] = {}




@router.post("/prepare/{graph_id}")
async def pepare_graph(user_id: str, graph_id: str, file: Annotated[bytes, File()] ):

    if graph_id in running_graphs.keys():
        return { "user_id": user_id, "graph_id": graph_id}

    messages = wrapper_pb2.MessageList()
    messages.ParseFromString(file)

    forward_deltas_pb = messages.list[0].forwardDeltasPB
    gradient_path_map_pb =  messages.list[1].pathPB

    graph_message = apply_deltas(user_id, graph_id, forward_deltas_pb)
        
    values = retrieve_values(user_id, graph_id, graph_message)

    running_graph = RunningGraph(graph_message, gradient_path_map_pb, LEARNING_RATE, values, OPTIMIZE_INTERVAL)
    running_graphs[graph_id] = running_graph

    return { "user_id": user_id, "graph_id": graph_id}




@router.websocket("/start/{graph_id}")
async def run_graph(graph_id: str, websocket: WebSocket):

    await websocket.accept()

    running_graph = running_graphs[graph_id]
    running_graph.start()

    while True:
        await asyncio.sleep(0.01)
        message_list = wrapper_pb2.MessageList()
        while not running_graph.update_queue.empty():
            node_type, node_id, new_value = running_graph.update_queue.get()
            
            if isinstance(new_value, (tf.Tensor, tf.Variable)):
                new_value = convert_to_list(new_value)

            if node_type in SHOULD_RECEIVE_STREAMING_UPDATES:
                event_type = wrapper_pb2.Wrapper.UPDATE_STREAMING_DISPLAY_VALUE
            else:
                event_type = wrapper_pb2.Wrapper.UPDATE_DISPLAY_VALUE
            payload = convert_to_nested_array(new_value)
            message_list.list.append( create_wrapper(event_type, payload, [node_id]) )
            # serialized = create_wrapper(event_type, payload, [node_id]).SerializeToString()
            # await websocket.send_bytes(serialized)
        
        serialized = message_list.SerializeToString()
        await websocket.send_bytes(serialized)

        if not running_graph.thread.is_alive():
            break

    running_graph.executing_event.clear()
    del running_graphs[graph_id]

    await websocket.close()





    
    
@router.post("/pause/{graph_id}")
async def pause_graph(graph_id: str):
    graph = running_graphs[graph_id]
    graph.executing_event.clear()
    print('graph paused')
    return { "graphId": graph_id }


@router.post("/reset/{graph_id}")
async def reset_graph(user_id: str, graph_id: str):

    graph = running_graphs.get(graph_id, None)
    if graph:
        graph.executing_event.clear()
        del running_graphs[graph_id]

    return { "user_id": user_id, "graph_id": graph_id}










