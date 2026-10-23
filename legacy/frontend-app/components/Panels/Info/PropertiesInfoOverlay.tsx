import store, {  RootState } from "@/app/store/store";
import {  useSelector } from "react-redux";
import { SliceNode } from "./infoPanelNodeComponents/SliceNode";
import { ParameterNode } from "./infoPanelNodeComponents/ParameterNode";
import { AbstractionNode } from "./infoPanelNodeComponents/AbstractionNode";
import { GetData } from "./infoPanelNodeComponents/GetData";
import { NodeTypeEnum } from "@/app/proto/compiled";
import { getCurrentSelectedNode } from "../../Workspace/graphGetters";




export const PropertiesInfoOverlay = ({ height}: { height: number}) => {



    //* Selectors
    const currentSelectedItem = useSelector((state: RootState) => state.workspace.currentSelectedItem);
    const { id } = currentSelectedItem

    const node = getCurrentSelectedNode();
    if (!node || !id || !(currentSelectedItem.type == 'node' || currentSelectedItem.type == 'abs')) return null;
    
    return (
        <div style={{ height: height }}>
            {(() => {
                switch (node.type) {
                    case NodeTypeEnum.IMPORT:
                    case NodeTypeEnum.VALUE:
                        return <GetData id={id} />;
                    case NodeTypeEnum.PARAMETER:
                        return <ParameterNode id={id} />;
                    case NodeTypeEnum.SLICE:
                        return <SliceNode id={id} />;
                    case NodeTypeEnum.ABS:
                        return <AbstractionNode id={id} />;
                    default:
                        return null;
                }
            })()}
        </div>
    )
}




