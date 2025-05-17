

from pydantic import BaseModel
from typing import Any
import tensorflow as tf

from server.protos.node_pb2 import Metadata, NodeTypeEnum
from server.types.value import TensorType

class Edge(BaseModel):
    startNodeId: str
    endNodeId: str
    startPos: list[float] = []
    endPos: list[float] = []


class Node(BaseModel):
    name: str
    explanation: str
    position: list[float] = []
    type: NodeTypeEnum
    metadata: dict[str, Any] = {}
    outgoingEdges: list[str]
    incomingEdges: list[str]
    children: list[str]
    childrenScale: float | None = None
    parent: str | None = None
    valuePointer: str
    value: tf.Tensor | TensorType | None








type NodeIdMap = dict[str, Node]
type EdgeIdMap = dict[str, Edge]
type Path = dict[str, list[str]]


class Graph(BaseModel):
    name: str
    description: str
    nodeIdMap: NodeIdMap = {}
    edgeIdMap: EdgeIdMap = {}


