

from fastapi import APIRouter, Response

from computeserver.server.app.routers.utils import create_wrapper
import computeserver.server.database.database_operations as db
from computeserver.server.nodes.data_flow import SHOULD_STORE_VALUE
from computeserver.server.protos.value_pb2 import NestedArray
from computeserver.server.services.basic import convert_to_list
from computeserver.server.services.file_utils.graph import get_graph_as_proto_message
from computeserver.server.services.file_utils.deltas import get_deltas_message
from computeserver.server.services.file_utils.general import get_node_value
from computeserver.server.protos import project_pb2, wrapper_pb2
from computeserver.server.services.file_utils.nested_array import convert_to_nested_array


router = APIRouter()


router = APIRouter(
    prefix="/connect",
    tags=["connect"],
)


def connect_helper(projects: list[project_pb2.Project], user_id: str):


    message_list = wrapper_pb2.MessageList()


    for project in projects:

        message_list.list.append( create_wrapper(wrapper_pb2.Wrapper.USER_PROJECT, project, []) )

        # Get graph binaries. For each, send that
        pointers = project.branches.keys()
        # For each pointer, get binary and send as tuple (project_id, adj_list_pointer, binary_data), and send node values
        for p in pointers: 
            # Send graph proto
            graph_message = get_graph_as_proto_message(user_id, graph_id=p)
            message_list.list.append( create_wrapper(wrapper_pb2.Wrapper.GRAPH, graph_message, [project.id, p]))
            # Send node tensor values
            graph = get_graph_as_proto_message(user_id, p)
            nodes = graph.nodeIdMap
            node_ids = [node_id for node_id, node in nodes.items() if node.type in SHOULD_STORE_VALUE]
            for id in node_ids:
                metadata = nodes[id].metadata
                save_type = metadata.values['saveType'].stringValue
                if (save_type == 'tensor' or save_type == 'list'):
                    val = get_node_value(user_id, p, metadata, True)
                    if val != None:
                        if not isinstance(val, NestedArray):
                            val = convert_to_nested_array(convert_to_list(val) ) 
                        message_list.list.append( create_wrapper(wrapper_pb2.Wrapper.UPDATE_DISPLAY_VALUE, val, [id]))
    

        # Send delta proto for each commit 
        commit_id_map = project.commits
        branches = project.branches
        calculated_commits: set[str] = set() #bc branches. Ensures not sending the same commit.
        
        # Get latest commits from each branch (instead of iterating thorough commits, this method gurantees proper ordering)
        for branch_id, branch in branches.items():
            latest_commit_id = branch.latestCommitId
            if latest_commit_id:
                # send latest_commit_id with branch deltas buffer (uncommitted changes to get first latest commit)
                calculated_commits.add(latest_commit_id) 
                deltas = get_deltas_message(user_id, branch_id)
                message_list.list.append( create_wrapper(wrapper_pb2.Wrapper.BACKWARD_DELTAS, deltas, [project.id,  latest_commit_id, ""] ))
                current = latest_commit_id
                commit = commit_id_map.get(current)
                prev_commit_id = commit.prevCommitId if commit else None

                while current: # send commit_ids with their NEXT commit's deltas, so sending prev_commit_id along with deltas of the commit after that one
                    if prev_commit_id and (prev_commit_id not in calculated_commits):
                        calculated_commits.add(prev_commit_id)
                        deltas = get_deltas_message(user_id, current)

                        message_list.list.append( create_wrapper(wrapper_pb2.Wrapper.BACKWARD_DELTAS, deltas, [project.id,  prev_commit_id, current]))
                        
                        current = prev_commit_id
                        prev_commit_id = commit_id_map.get(current, None)
                        prev_commit_id = prev_commit_id.prevCommitId if prev_commit_id else None
                    else: 
                        current = None

    return message_list


@router.get("/{user_id}")
async def connect(user_id: str):
    projects =  db.get_projects_of_user(user_id)
    message_list = connect_helper(projects, user_id)
    return Response(
        content=message_list.SerializeToString(), 
        media_type="application/octet-stream", 
        headers={
            "X-Event-Type": "connect",
            "Access-Control-Expose-Headers": "*"
        }
    )

    
    
