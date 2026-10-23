import { BackwardDeltas, Branch, Commit, ForwardDeltas } from './types/main'
import { NodeTypeEnum } from './proto/compiled'
import _ from 'lodash'
import { Node } from './types/main'
import { Edge } from './types/main'
import { Graph, Project } from './types/main'


const graphTemplate: Graph = {
    "name": "New Graph",
    "description": "This graph...",
    "nodeIdMap": {},
    "edgeIdMap": {},
    "gradientPathMap": { map: {}}
}

export const getGraphTemplate = () => {
    return _.cloneDeep(graphTemplate)
}




const projectTemplate: Project = {
    "id": "",
    "ownerId": "",
    "isAbsNode": false,
    "commits": {},
    "branches": {},
    "branchOrder": []
}

export const getProjectTemplate = () => {
    return _.cloneDeep(projectTemplate)
}





const absNodeTemplate: Node = {
    position: [0, 0],
    type: NodeTypeEnum.ABS,
    metadata: { values: { "purpose": { stringValue: 'normal' } } },
    name: 'New Abstraction Node',
    explanation: 'This abstraction node...',
    children: [],
    childrenScale: 1,
    parent: ''
}

export const getAbsNodeTemplate = () => {
    return _.cloneDeep(absNodeTemplate)
}

const baseNodeTemplate: Node = {
    "position": [0, 0],
    "type": 0,
    "outgoingEdges": [],
    "incomingEdges": [],
    "parent": null,
    "children": [],
}

export const getBaseNodeTemplate = () => {
    return _.cloneDeep(baseNodeTemplate)
}

const backwardDeltasTemplate: BackwardDeltas ={
    "add": {
        "nodeIdMap": [],
        "edgeIdMap": [],
    },
    "delete": {
        "nodeIdMap": {},
        "edgeIdMap": {},
    } ,
    "update": {
        "nodeIdMap": {},
        "edgeIdMap": {},
    }
}

const forwardDeltasTemplate: ForwardDeltas ={
    "add": {
        "nodeIdMap": {},
        "edgeIdMap": {},
    },
    "delete": {
        "nodeIdMap": [],
        "edgeIdMap": [],
    } ,
    "update": {
        "nodeIdMap": {},
        "edgeIdMap": {},
    }
}

export const getBackwardDeltasTemplate = () => {
    return _.cloneDeep(backwardDeltasTemplate)
}

export const getForwarddDeltasTemplate = () => {
    return _.cloneDeep(forwardDeltasTemplate)
}

const branchTemplate: Branch = {
    "name": "temp",
    "latestCommitId": null,
    "backwardDeltas": backwardDeltasTemplate,
    "forwardDeltas": forwardDeltasTemplate
}

export const getBranchTemplate = () => {
    return _.cloneDeep(branchTemplate)
}

const commitTemplate: Commit = {
    "message": "",
    "timestamp": "",
    "branchName": "",
    "prevCommitId": "",
    "nextCommitIds": [],
    "backwardDeltas": backwardDeltasTemplate
}

export const getCommitTemplate = () => {
    return _.cloneDeep(commitTemplate)
}

const edgeTemplate: Edge = {
    "startNodeId": "",
    "startPos": [0, 0],
    "endNodeId": "",
    "endPos": [0, 0]
}

export const getEdgeTemplate = () => {
    return _.cloneDeep(edgeTemplate)
}