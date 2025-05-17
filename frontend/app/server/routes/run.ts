import { selectCurrentBranch } from "@/app/store/features/workspace/selectors/commitHistory"
import {  selectCurrentGraphId } from "@/app/store/features/workspace/selectors/project"
import { resetDeltasForBranch } from "@/app/store/features/workspace/workspaceSlice"
import store from "@/app/store/store"
import { sendAndHandle, emitWSAndHandle } from "../handle"
import { USER_ID } from '../constants'

import Root, { NodeTypeEnum } from "@/app/proto/compiled"
import { NodeAccumulator } from "@/app/store/features/workspace/thunks/accumulators"
import { getCurrentGraph } from "@/app/components/Workspace/graphGetters"
import { graphController } from "@/app/globalObjs"
import { ApplyAccumulatorCommand } from "@/app/components/Workspace/commands"
import _ from "lodash"





export function emitRunGraph() {
    const state = store.getState()
    const dispatch = store.dispatch

    const adjListPointer = selectCurrentGraphId(state.workspace)
    const branch = selectCurrentBranch(state.workspace)
    const deltas = branch?.forwardDeltas
    const gradientPathMap = getCurrentGraph().gradientPathMap
    
    if (deltas && adjListPointer) {
        
        
        const forwardDeltasPB = Root.ForwardDeltas.create(deltas)
        const gradientPathMapClone = _.cloneDeep(gradientPathMap)
        // Delete edgeIds from gradientPathMap clone to avoid sending unnecessary data
        if (gradientPathMapClone && gradientPathMapClone.map) {
            for (const key in gradientPathMapClone.map) {
                if (gradientPathMapClone.map[key] && gradientPathMapClone.map[key].edgeIds) {
                    delete gradientPathMapClone.map[key].edgeIds;
                }
            }
        }
        const gradientPathMapPB = Root.Path.create(gradientPathMapClone)
        // gradientPathMapPB.map = {};
        // if (gradientPathMap) {
        //     for (const [entry, params] of Object.entries(gradientPathMap)) {
        //         gradientPathMapPB.map[entry] = Root.Elems.create({ ids: params });
        //     }
        // }
        
        // Create wrappers for each
        const deltasWrapper = Root.Wrapper.create()
        deltasWrapper.forwardDeltasPB = forwardDeltasPB
        
        const pathWrapper = Root.Wrapper.create()
        pathWrapper.pathPB = gradientPathMapPB
        
        // Create message list and add wrappers
        const messages = Root.MessageList.create()
        messages.list.push(deltasWrapper)
        messages.list.push(pathWrapper)
        

        sendAndHandle(
            `run/prepare/${adjListPointer}`, 
            "POST", 
            [["user_id", USER_ID], ["graph_id", adjListPointer]],
            messages
        ).then(() => {

            dispatch(resetDeltasForBranch({ name: branch.name, deltaType: 'forwardDeltas'}))

            emitWSAndHandle(`run/start/${adjListPointer}`)
        })
    }
}

export function emitPauseGraph() {
    const state = store.getState()
    const adjListPointer = selectCurrentGraphId(state.workspace)
    sendAndHandle(`run/pause/${adjListPointer}`, "POST")

}

export let shouldRecieveStream = true
export function emitResetGraph() {
    const state = store.getState()
    const adjListPointer = selectCurrentGraphId(state.workspace)
    if (adjListPointer) {
        shouldRecieveStream = false
        sendAndHandle(`run/reset/${adjListPointer}`, "POST", [["user_id", USER_ID], ["graph_id", adjListPointer]]).then(() => {
            clearGraph()
            shouldRecieveStream = true
        })
    }
}

function clearGraph() {
    const state = store.getState();
    const graph = getCurrentGraph()
    
        
    if (graph) {
        // Create a node accumulator to track all parameter nodes
        const nodeAccumulator = new NodeAccumulator()
        
        // Find all parameter nodes and set their display values to null
        Object.entries(graph.nodeIdMap).forEach(([nodeId, node]) => {
            if (Number(node.type) === NodeTypeEnum.PARAMETER) {
                nodeAccumulator.createEntry('update', nodeId, 'displayValue', null)
            }
        });
        graphController.addCommand( new ApplyAccumulatorCommand(nodeAccumulator))
    }
    
}