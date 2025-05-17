import { NodeTypeEnum } from "@/app/proto/compiled";
import { NODE_RADIUS } from "@/app/sizing/nodes"
import { Id, Slice, Tensor } from "@/app/types/common"
import { Graph, NodeIdMap, Node } from "@/app/types/main"
import { Container, Sprite, Text } from "pixi.js";
import { assets } from "../Manager/hooks/usePixiAssets";
import { chart } from "@/app/nodes/nodeDisplays/chart";
import { importDisplay } from "@/app/nodes/nodeDisplays/import";
import { parameter } from "@/app/nodes/nodeDisplays/parameter";
import { value } from "@/app/nodes/nodeDisplays/value";
import { convertMatrixValue } from "@/app/proto/helpers";
import { image } from "@/app/nodes/nodeDisplays/image";
import { slice } from "@/app/nodes/nodeDisplays/slice";
import { getInputNodeDisplayValues } from "./graphGetters";
import { accessoryState, graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "./commands";
import { createText } from "@/app/nodes/nodeDisplays/components/helpers";
import { getColoring } from "@/app/services/getColoring";




export async function updateDisplay(graph: Graph, id: Id) {

    const node = graph.nodeIdMap[id]
    

    let newDisplayChild = new Container();

    switch (Number(node.type)) {
        case NodeTypeEnum.ABS:
            const purpose = node.metadata?.values?.['purpose']?.stringValue
            if (node.label) node.container?.removeChild(node.label)
            if (purpose === 'loss' || purpose === 'predictor') {
                const height = 100
                node.label = createText(NODE_RADIUS * 2, height, purpose, getColoring(true).nodeColoring.abs)
                node.label.position.set(0, - (NODE_RADIUS + height/2))
                node.container?.addChild(node.label)
            }
            return;
        case NodeTypeEnum.PARAMETER:
            if (node.displayValue || node.metadata) {
                const data = node.displayValue as Tensor
                const shape = node.metadata?.values?.["shape"]?.arrayValue?.elems ?? []
                newDisplayChild = await parameter(data, shape)
            }
        break
        case NodeTypeEnum.ADD:
            newDisplayChild = getImage(NodeTypeEnum.ADD);
        break
        case NodeTypeEnum.SUBTRACT:
            newDisplayChild = getImage(NodeTypeEnum.SUBTRACT);
        break
        case NodeTypeEnum.MULTIPLY:
            newDisplayChild = getImage(NodeTypeEnum.MULTIPLY);
        break
        case NodeTypeEnum.DIVIDE:
            newDisplayChild = getImage(NodeTypeEnum.DIVIDE);
        break
        case NodeTypeEnum.VALUE:
            if (node.displayValue) {
                newDisplayChild = value(node.displayValue);
            }
        break
        case NodeTypeEnum.SQUARE:
            newDisplayChild = getImage(NodeTypeEnum.SQUARE);
        break
        case NodeTypeEnum.AVERAGE:
            newDisplayChild = getImage(NodeTypeEnum.AVERAGE);;
        break
        case NodeTypeEnum.RELU:
            newDisplayChild = getImage(NodeTypeEnum.RELU);
        break
        case NodeTypeEnum.SIGMOID:
            newDisplayChild = getImage(NodeTypeEnum.SIGMOID);
        break
        case NodeTypeEnum.DOT:
            newDisplayChild = getImage(NodeTypeEnum.DOT);
        break
        case NodeTypeEnum.SLICE:
            const allInputNodeDisplayValues = getInputNodeDisplayValues( id) ?? []
            const inputNodeDisplayValue = allInputNodeDisplayValues[0]//Get first input
            const sliceArray = convertMatrixValue(node.metadata?.values?.["slice"]?.matrixValue) as Slice
            const sliceArrowSprite = getImage('sliceArrow');
            newDisplayChild = await slice(node.displayValue, inputNodeDisplayValue, sliceArray, sliceArrowSprite);
        break
        case NodeTypeEnum.IMPORT:
            const clear = () => { 
                // store.dispatch(changeIndividualNodeProperty({ id: id, property: 'metadata', newValue: null}))
                graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'metadata', null ))
                // store.dispatch(updateNodeDisplayValue(id, null)) 
            }
            const uploadedFileName = node.metadata?.values?.["fileName"]?.stringValue as string
            const dropIcon = getImage('dropIcon');
            newDisplayChild = await importDisplay(uploadedFileName , dropIcon, node.displayValue, clear);
        break
        case NodeTypeEnum.CHART:
            if (node.displayValue) {
                const endPositionsOfIncomingEdges = node.incomingEdges?.map((edgeId) => graph.edgeIdMap[edgeId].endPos) ?? []
                const viewportScale = accessoryState.viewportValues!.scale ?? 1
                newDisplayChild = chart(node.displayValue as number[][], node.position, viewportScale, endPositionsOfIncomingEdges);
            }
        break
        case NodeTypeEnum.FLATTEN:
            newDisplayChild = getImage(NodeTypeEnum.FLATTEN);
        break
        case NodeTypeEnum.ARRAY:
            newDisplayChild = getImage(NodeTypeEnum.ARRAY);
        break
        case NodeTypeEnum.IMAGE:
            if (node.displayValue) {
                newDisplayChild = image(node.displayValue as number[][]);
            }
        break
        case NodeTypeEnum.STACK:
            newDisplayChild = getImage(NodeTypeEnum.STACK);
        break
        case NodeTypeEnum.POP:
            newDisplayChild = getImage(NodeTypeEnum.POP);
        break
        default:
            console.log('Unhandled node type')
        break
    }


    if (node.mainDisplay) { 
        node.mainDisplay.removeChildren()
    } else {
        node.mainDisplay = new Container()
    }
    node.mainDisplay.addChild(newDisplayChild)

}


function getImage(name: string | number) {
    if (assets) {
        const sprite = Sprite.from(assets[name])
        sprite.anchor.set(0.5);
        sprite.eventMode = 'none'
        return sprite;
    } else {
        return new Sprite()
    }
}


export function updateDisplayObjScaleAndPosition(id: Id, graph: Graph) {

    const node = graph.nodeIdMap[id]
    const scale = getNodeScale(id, graph.nodeIdMap)

    const newX = node.position[0] + NODE_RADIUS * scale
    const newY = node.position[1] + NODE_RADIUS * scale
    if (node.container!.x != newX || node.container!.y != newX) {
        node.container!.x = newX 
        node.container!.y = newY
        node.thumbnailContainer.x = newX
        node.thumbnailContainer.y = newY
        node.commitContainer.x = newX
        node.commitContainer.y = newY
    }
    

    node.container!.scale.set(scale)
    node.thumbnailContainer!.scale.set(scale)
    node.commitContainer!.scale.set(scale)
}

export function getNodeScale(id: Id, nodeIdMap: NodeIdMap) {
    const node = nodeIdMap[id] 
    const parentNodeId = node?.parent
    const parent = parentNodeId ? nodeIdMap[parentNodeId] : null
    const scale = parent?.childrenScale ?? 1
    return scale
}  

