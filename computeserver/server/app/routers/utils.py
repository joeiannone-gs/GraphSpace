

# from server.types.graph import Edge, Node, Graph
from computeserver.server.protos import  deltas_pb2, project_pb2, value_pb2, wrapper_pb2, graph_pb2



type PayloadType = project_pb2.Project | graph_pb2.Graph | value_pb2.NestedArray | deltas_pb2.BackwardDeltas | None

def create_wrapper(event_type: wrapper_pb2.Wrapper.Event, payload: PayloadType, args: list[str] | None = None):
    """Create and serialize a wrapper message with the given event type and content."""
    wrapper = wrapper_pb2.Wrapper()
    wrapper.event = event_type
    
    if payload:
        if event_type == wrapper_pb2.Wrapper.USER_PROJECT:
            wrapper.projectPB.CopyFrom(payload)
        elif event_type == wrapper_pb2.Wrapper.GRAPH:
            wrapper.graphPB.CopyFrom(payload)
        elif event_type == wrapper_pb2.Wrapper.UPDATE_DISPLAY_VALUE:
            wrapper.nestedArrayPB.CopyFrom(payload)
        elif event_type == wrapper_pb2.Wrapper.UPDATE_STREAMING_DISPLAY_VALUE:
            wrapper.nestedArrayPB.CopyFrom(payload)
        elif event_type == wrapper_pb2.Wrapper.BACKWARD_DELTAS:
            wrapper.backwardDeltasPB.CopyFrom(payload)

    if args: wrapper.args.extend(args)

    return wrapper


