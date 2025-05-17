import { Id, Tensor } from "@/app/types/common";
import { getDepth } from "@/app/services/math";
import { NodeTypeEnum } from "@/app/proto/compiled";
import { convertMatrixValue, metadataToPb } from "@/app/proto/helpers";
import { graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "@/app/components/Workspace/commands";
import { Graph } from "@/app/types/main";
import { getInputNodeDisplayValues } from "@/app/components/Workspace/graphGetters";





//affected is if the data flowing into a node is changed.
// 1) if start node changes -> only affected node is end node
// 2) if end node changes -> prev and new end node are affected
// 3) if edge deleted -> end node affected
// 4) if incoming node value changed (not from server sending an update but from the user putting in a new value)
export function dataflowChangeSideEffects(graph: Graph, affectedNodes: Set<Id>) {

    for (let nodeId of affectedNodes) {
        const node = graph.nodeIdMap[nodeId]

        switch (Number(node?.type)){
            case NodeTypeEnum.SLICE:
                const input = getInputNodeDisplayValues(nodeId)[0]
                if (input) {
                    let sliceArray = []
                    
                    const DEFAULT_AXIS_SLICE = [0, -1, 1]
                    const numDim = getDepth(input as Tensor)
                    sliceArray = Array(numDim).fill(0).map(() => [...DEFAULT_AXIS_SLICE])
                    
                    graphController.addCommand(new ApplyAccumulatorCommand(nodeId, 'node', 'metadata', metadataToPb([sliceArray], ["slice"]) ) )
                }
            break
        }

    }

}