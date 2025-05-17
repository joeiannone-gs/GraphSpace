"""Database Operations"""
import sqlite3
from typing import Callable

# from server.types.project import Branch, Commit, Project

from computeserver.server.protos import project_pb2



conn = sqlite3.connect('users.db')
# conn = sqlite3.connect(':memory:')

cursor = conn.cursor()



# CREATING 


def insert_user(user_id: str, username: str):
    with conn: 
        cursor.execute("INSERT INTO Users VALUES (:id, :username)", {"id": user_id, "username": username})

def insert_project(project: project_pb2.Project):

    with conn: 
        cursor.execute("""
            INSERT INTO Projects
            VALUES (:id, :ownerId, :isAbsNode)
        """, (project.id, project.ownerId, project.SerializeToString()))


def insert_commit(project_id: str, commit: project_pb2.Commit, commit_id: str):
    read_or_edit_project(project_id, lambda project: project.commits[commit_id].CopyFrom(commit))


def insert_branch(project_id: str, branch: project_pb2.Branch, branch_id: str):
    read_or_edit_project(project_id, lambda project: project.branches[branch_id].CopyFrom(branch))



def create_project(project: project_pb2.Project): 

    with conn:
        project_blob = project.SerializeToString()
        
        cursor.execute("""
            INSERT INTO Projects (id, ownerId, protobufBinary)
            VALUES (:id, :ownerId, :protobufBinary)
        """, {"id": project.id, "ownerId": project.ownerId, "protobufBinary": project_blob})
    


# DELETING 
def delete_project(project_id: str):
    with conn: 
        cursor.execute("DELETE FROM Projects WHERE id = :project_id", {"project_id": project_id})


def delete_branch(project_id: str, branch_id: str):
    def callback(project: project_pb2.Project): 
        del project.branches[branch_id]
    
    read_or_edit_project(project_id, callback)


# UPDATING 
def update_branch_name(project_id: str, branch_id: str, new_name: str):
    def callback(project: project_pb2.Project): 
        project.branches[branch_id].name = new_name
    
    read_or_edit_project(project_id, callback)


def set_branch_latest_commit_id(project_id: str, branch_id: str, commit_id: str):
    def callback(project: project_pb2.Project): 
        project.branches[branch_id].latestCommitId = commit_id
    
    read_or_edit_project(project_id, callback)


def append_id_to_commit_next(project_id: str, commit_id: str, id_to_append: str):
    def callback(project: project_pb2.Project): 
        project.commits[commit_id].nextCommitIds.append(id_to_append)
    
    read_or_edit_project(project_id, callback)



# RETRIEVING

def get_latest_commit_id(project_id: str, branch_id: str):

    latest = ''

    def callback(project: project_pb2.Project): 
        nonlocal latest
        latest = project.branches[branch_id].latestCommitId
    
    read_or_edit_project(project_id, callback)

    return latest


def get_projects_of_user(user_id: str):
    projects_list: list[project_pb2.Project] = []
    with conn:
        cursor.execute("""
            SELECT id, protobufBinary FROM Projects 
            WHERE ownerId = :user_id
        """, {"user_id": user_id})
        
        projects_data = cursor.fetchall()
        
        for project_data in projects_data:
            _project_id, project_blob = project_data
            project = project_pb2.Project()
            project.ParseFromString(project_blob)
            projects_list.append(project)
            
    return projects_list


def read_or_edit_project(project_id: str, callback: Callable[[project_pb2.Project], None]):
    with conn:
        cursor.execute("SELECT protobufBinary FROM Projects WHERE id = :project_id", {"project_id": project_id})
        project_blob = cursor.fetchone()
        
        if project_blob is not None:
            project = project_pb2.Project()
            project.ParseFromString(project_blob[0])
            
            callback(project)
            
            updated_project_blob = project.SerializeToString()
            
            cursor.execute("UPDATE Projects SET protobufBinary = :protoblob WHERE id = :project_id", 
                        {"protoblob": updated_project_blob, "project_id": project_id})