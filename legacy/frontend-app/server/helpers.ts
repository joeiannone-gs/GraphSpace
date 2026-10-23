import { ForwardDeltas, Graph, NodeIdMap, Project } from '../types/main'
import { Node } from '../types/main'
import { getBackwardDeltasTemplate, getForwarddDeltasTemplate } from "@/app/templates"
import { Id, Tensor } from "@/app/types/common"
import Root from "@/app/proto/compiled"














export const ensureNodeDefaults = (node: Node) => {
    const defaultNode = {
        parent: null,
        incomingEdges: [],
        outgoingEdges: [],
    }

    Object.keys(defaultNode).forEach((key ) => {
        if (node[key] === undefined) {
            node[key] = defaultNode[key];
        }
    })

}



export const ensureGraphDefaults = (graph: Graph) => {
    if (!graph.nodeIdMap) {
        graph["nodeIdMap"] = {}
    }

    if (!graph.edgeIdMap) {
        graph["edgeIdMap"] = {}
    }

    if (!graph.gradientPathMap) {
        graph["gradientPathMap"] = { map: {}}
    }

    delete graph.nodeIdMap["blank"]; //Server needs at least one obj in so it sometimes creates "blank"
    
    Object.values(graph.nodeIdMap).forEach((node: Node) => {
        ensureNodeDefaults(node);
        
    });

    if (Object.isFrozen(graph.nodeIdMap) || !Object.isExtensible(graph.nodeIdMap)) {
        console.warn(`nodeidmap frozen or non-extensible`);
      }

    if (Object.isFrozen(graph.edgeIdMap) || !Object.isExtensible(graph.edgeIdMap)) {
    console.warn(`edgeidmap frozen or non-extensible`);
    }
    
    
    delete graph.edgeIdMap["blank"]


}


export const ensureProjectDefaults = (project: Project) => {
    const branches = project.branches

    if (!project.commits) {
        project["commits"] = {}
    }

    let branchOrder: Id[] = []

    const mainBranchId = Object.keys(branches).find(id => branches[id].name === "main")
    const remainingIds = Object.keys(branches).filter(id => branches[id].name !== "main")
    if (mainBranchId) {
        branchOrder = [mainBranchId, ...remainingIds]
    }

    Object.values(branches).forEach((branch) => {
        branch.backwardDeltas = getBackwardDeltasTemplate()
        branch.forwardDeltas = getForwarddDeltasTemplate()
    });

    project["branchOrder"] = branchOrder
}



export const cleanProject = (graphProject: Project) => {
    const cleanedProject = {
        ...graphProject
    }
    return cleanedProject
}


export const isDeltasEmpty = (deltas: ForwardDeltas) => {
    let numDeltas = 
        Object.keys(deltas.add.edgeIdMap).length + 
        Object.keys(deltas.add.nodeIdMap).length + 
        deltas.delete.nodeIdMap.length + 
        deltas.delete.edgeIdMap.length +
        Object.keys(deltas.update.edgeIdMap).length +
        Object.keys(deltas.update.nodeIdMap).length;

    if ('name' in deltas.update) numDeltas++
    if ('description' in deltas.update) numDeltas++

    return numDeltas == 0
}


export function convertNestedArray(nestedArray: Root.INestedArray): any[] {
    if (nestedArray.arrayOfValues) {
        return nestedArray.arrayOfValues.values?.map(value => {
            if (value.floatValue !== undefined) {
                return value.floatValue;
            } else if (value.stringValue !== undefined) {
                return value.stringValue;
            }
            return null;
        }) || [];
    } else if (nestedArray.arrayOfNestedArrays) {
        return nestedArray.arrayOfNestedArrays.nestedArrays?.map(convertNestedArray) || [];
    }
    return [];
}









