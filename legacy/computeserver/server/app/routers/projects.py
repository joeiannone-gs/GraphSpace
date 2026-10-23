from fastapi import APIRouter, File, Query
from typing import Annotated

from computeserver.server.protos import wrapper_pb2

from computeserver.server.services.file_utils.graph import apply_deltas, create_graph, delete_graph, write_graph_to_file
from computeserver.server.services.file_utils.deltas import write_deltas_to_file
from computeserver.server.services.file_utils.safe_tensors import create_safe_tensor_file
import computeserver.server.database.database_operations as db



router = APIRouter()


router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)




@router.post("/create")
async def create_project(user_id: Annotated[str, Query()], file: Annotated[bytes, File()]):

    messages = wrapper_pb2.MessageList()
    messages.ParseFromString(file)
    project_pb = messages.list[0].projectPB

    main_branch_id = list(project_pb.branches.keys())[0]
    create_graph(user_id, main_branch_id)
    create_safe_tensor_file(user_id, main_branch_id)
    db.create_project(project_pb)

    return { "user_id": user_id }


@router.post('/delete')
async def delete_project(project_id: str):
    db.delete_project(project_id)
    return { "project_id": project_id }


@router.post('/create-commit')
async def create_commit(user_id: str, project_id: str, branch_id: str, commit_id: str, file: Annotated[bytes, File()]):

    messages = wrapper_pb2.MessageList()
    messages.ParseFromString(file)

    commit_pb = messages.list[0].commitPB
    backward_deltas_pb = messages.list[1].backwardDeltasPB

    latest_commit_id = db.get_latest_commit_id(project_id, branch_id)
    if latest_commit_id:
        db.append_id_to_commit_next(project_id, latest_commit_id, commit_id)
    db.set_branch_latest_commit_id(project_id, branch_id, commit_id)
    write_deltas_to_file(user_id, commit_id, backward_deltas_pb.SerializeToString())
    db.insert_commit(project_id, commit_pb, commit_id)

    return {"user_id": user_id, "branch_id": branch_id, "commit_id": commit_id}


@router.post("/create-branch")
async def create_branch(user_id: str, project_id: str, branch_id: str, file: Annotated[bytes, File()] ):

    messages = wrapper_pb2.MessageList()
    messages.ParseFromString(file)

    branch_pb = messages.list[0].branchPB
    graph_pb = messages.list[1].graphPB

    write_graph_to_file(user_id, branch_id, graph_pb)

    db.insert_branch(project_id,branch_pb, branch_id)

    return {"user_id": user_id, "branch_id": branch_id}


@router.post("/delete-branch")
async def delete_branch(user_id: str, project_id: str, branch_id: str):
    db.delete_branch(project_id, branch_id)
    delete_graph(user_id, branch_id)

    return {"user_id": user_id, "branch_id": branch_id}



@router.post("/update-branch-name")
async def update_branch_name(project_id: str, branch_id: str, new_name: str):
    db.update_branch_name(project_id, branch_id, new_name)

    return { "branch_id": branch_id, "new_name": new_name }



@router.post("/graph-deltas")
async def graph_deltas(user_id: str, branch_id: str, file: Annotated[bytes, File()]):
    
    messages = wrapper_pb2.MessageList()
    messages.ParseFromString(file)

    forward_deltas = messages.list[0].forwardDeltasPB
    backward_deltas  = messages.list[1].backwardDeltasPB

    apply_deltas(user_id, branch_id, forward_deltas)

    write_deltas_to_file(user_id, branch_id, backward_deltas.SerializeToString())

    return {"user_id": user_id, "branch_id": branch_id}