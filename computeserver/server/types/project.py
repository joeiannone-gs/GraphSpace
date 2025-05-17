from pydantic import BaseModel





class Branch(BaseModel):
    id: str | None = None
    name: str
    latestCommitId: str | None = None
    projectId: str 


class Commit(BaseModel):
    id: str | None = None
    message: str = "New Commit"
    timestamp: str
    branchName: str
    prevCommitId: str | None = None
    nextCommitIds: list[str] | None = None


class Project(BaseModel):
    id: str
    ownerId: str
    isAbsNode: bool = False
    branches: dict[str, Branch] = {}
    commits: dict[str, Commit] = {}


