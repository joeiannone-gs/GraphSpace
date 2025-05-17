import store from '../store/store'
import { selectAllAbsProjects, selectAllGraphProjects, selectProjectById } from '../store/features/workspace/selectors/project'
import workspaceSlice, { createAbsProject, createGraphProject, setBackwardDeltas, updateCurrentProjectId } from '../store/features/workspace/workspaceSlice'
import { Project, Graph, NestedArray } from '../types/main'
import { selectCommitById } from '../store/features/workspace/selectors/commitHistory'
import { BackwardDeltas } from '../types/main'
import Root from '@/app/proto/compiled'
import { convertNestedArray, ensureGraphDefaults, ensureProjectDefaults } from './helpers'
import { calculateGradientPaths, setBackPropEdges } from '../store/features/workspace/helpers'
import { applyBackwardDeltas } from '../services/deltas'
import _ from 'lodash'
import { pending } from '../nodes/nodeDisplays/components/web-workers/workerHelper'
import { EdgeAccumulator, NodeAccumulator } from '../store/features/workspace/thunks/accumulators'
import { shouldRecieveStream } from './routes/run'
import { getCurrentGraph } from '../components/Workspace/graphGetters'
import { graphController, graphs } from '../globalObjs'
import { populateGraphDisplayObjs } from '../components/Workspace/graphDisplayObjs'
import { ApplyAccumulatorCommand } from '../components/Workspace/commands'
import { Tensor } from '../types/common'
import { updateNodeDisplayValue } from '../store/features/workspace/thunks/update/nodes'



export function processMessage(message: Root.Wrapper) {
    const asObj = Root.Wrapper.toObject(message) 

    const args = message.args
    const dispatch = store.dispatch
    const state  = store.getState() 


    switch(message.event) {
        case Root.Wrapper.Event.GRAPH: {
                const graphObj = asObj.graphPB as Graph 

                const [projectId, pointer ] = args

                //Convert protobuff binary to graph object
                ensureGraphDefaults(graphObj)
            
                //calculate gradient paths for each loss node
                const lossIds = Object.keys(graphObj.nodeIdMap).filter(id => graphObj.nodeIdMap[id].metadata?.values?.['purpose']?.stringValue === 'loss');
                
                
                // Initialize gradient paths for each loss node
                lossIds.forEach(id => {
                        const gradientPathMap = calculateGradientPaths(id, graphObj.nodeIdMap, graphObj.edgeIdMap);
                        // Combine gradient paths into the graph's gradientPathMap
                        graphObj.gradientPathMap.map = Object.assign(graphObj.gradientPathMap.map, gradientPathMap.map);

                        for (let [entry, pathElems] of Object.entries(gradientPathMap.map)) {
                            const edgeAccumulator = setBackPropEdges(pathElems, true)
                            graphController.addCommand(new ApplyAccumulatorCommand(edgeAccumulator))
                        }
                });
                
            
                graphs[pointer] = graphObj
                graphController.switchGraph(pointer)


                console.log('Received graph event');
            }
            break;
        case Root.Wrapper.Event.USER_PROJECT: {
                const project = asObj.projectPB as Project
         
                const allGraphProjects = selectAllGraphProjects(state.workspace);
                const allAbsProject = selectAllAbsProjects(state.workspace);
                const all = [...allGraphProjects, ...allAbsProject];
                
                const existingProject = all.find(p => p.id === project.id);
                if (existingProject) {
                    console.log('got existing project')
                    return;
                }

                ensureProjectDefaults(project)
         
                if (project.isAbsNode) {
                    dispatch(createAbsProject({project}))
                } else {
                    dispatch(createGraphProject({ project }))
                }
                //If there is not a current user graph or abs node set it as this project
                if (!state.workspace.currentProjectId) {
                    dispatch(updateCurrentProjectId({id: project.id}))
                    dispatch(workspaceSlice.actions.openTab({projectId: project.id}))
                } 
                // Handle user project event
                console.log('Received user project event');
            }
            break;
        case Root.Wrapper.Event.BACKWARD_DELTAS: {
                const deltas = asObj.backwardDeltasPB as BackwardDeltas;
                const [projectId, commitId, nextCommitId] = args

                
                const commit = selectCommitById(state.workspace, commitId)
                const branchName = commit?.branchName
                const currentSave = getCurrentGraph(projectId, branchName)
                const project = selectProjectById(state.workspace, projectId)
            
                    if (project) {
                        let graph: Graph;
                        if (!nextCommitId && currentSave) { //if no nextCommitId then this is the latest commit
                            graph = applyBackwardDeltas(currentSave, deltas);
                            //set deltas (which are equivalently uncommitted changes) 
                            dispatch(setBackwardDeltas({ backwardDeltas: deltas}))
                        } else if (nextCommitId) {
                            const nextGraph = graphs[nextCommitId];
                            graph = applyBackwardDeltas(nextGraph, deltas);
                        } else {
                            throw new Error('Cannot apply backward deltas: nextCommitId is null and currentSave is undefined');
                        }
                        // dispatch(addGraphToProjectGraphs({ projectId, pointer: commitId, graphObj: graph }));
                        // populateGraphDisplayObjs(graph)
                        graphs[commitId] = graph

                    }
                // Handle backward deltas event
                console.log('Received backward deltas event');
            }
            break;
        case Root.Wrapper.Event.UPDATE_DISPLAY_VALUE:
            if (message.nestedArrayPB) {
                const newValue = asObj.nestedArrayPB as NestedArray
                const asTensor = convertNestedArray(newValue)
                const [id] = args
                // graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'displayValue', asTensor ))
                const graph = getCurrentGraph()
                updateNodeDisplayValue(graph ,id, asTensor, false)

                // Handle update display value event
                console.log('Received update display value event');
            }
            break;
        case Root.Wrapper.Event.UPDATE_STREAMING_DISPLAY_VALUE:
            const numberOfPendingDisplayUpdates = pending.size
            if (message.nestedArrayPB && shouldRecieveStream) {
                const newValue = asObj.nestedArrayPB as NestedArray
                const asTensor = convertNestedArray(newValue)
                
                if (asTensor.length > 0 ) {
                    
                    const [id] = args
                    
                    // const nodeAccumulator = new NodeAccumulator()
                    // nodeAccumulator.createEntry('add', id, "displayValue", [asTensor])
                    const oldVal = getCurrentGraph()?.nodeIdMap?.[id]?.displayValue as Tensor[]
                    const stream = [...oldVal ?? [], asTensor]
                    graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'displayValue', stream ))
                    
                    // Handle update streaming display value event
                    console.log('Received update streaming display value event');
                }
            }
            break;
        default:
            console.log('Unknown event type:', message.event);
            break;
    }
}





