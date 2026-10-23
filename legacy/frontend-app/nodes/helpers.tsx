import { nodeTypes, categories } from "./nodeTypes";
import { NodeTypeEnum } from "../proto/compiled";





//Get name and explanation from nodeType (type)
export const getNameAndExplanation = (nodeType: NodeTypeEnum) => {
    const nodeTypeInfo = nodeTypes[nodeType];
    return {
        name: nodeTypeInfo.name,
        explanation: nodeTypeInfo.explanation
    };
}



export const getMetadata = (nodeType: NodeTypeEnum) => {
    // Get node type information
    const nodeTypeInfo = nodeTypes[nodeType];
    if (!nodeTypeInfo) return undefined;

    // Return metadata
    return nodeTypeInfo.metadata;
}
