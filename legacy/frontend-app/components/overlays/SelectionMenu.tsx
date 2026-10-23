
import { useCallback } from "react";
import { useDispatch, useSelector } from 'react-redux';
import store, { AppDispatch, RootState } from "@/app/store/store";
import { createAbstractionNode } from "@/app/store/features/workspace/thunks/create/nodes";
import { deleteEdges } from "@/app/store/features/workspace/thunks/delete/edges";
import { deleteNodes } from "@/app/store/features/workspace/thunks/delete/nodes";
import { multiConnectCreateEdges } from "@/app/store/features/workspace/thunks/create/edges";
import { clearMultiConnect, updateClipboard, updateMultiConnect, updateSelectionMenu } from "@/app/store/features/workspace/workspaceSlice";
import { updateTopWorkspaceText } from "@/app/store/features/panels/panelsSlice";
import { Menu } from "../reusableComponents/Menu";
import { getCurrentGraph, getNodesAndEdgesWithinBrush } from "../Workspace/graphGetters";
import { accessoryState } from "@/app/globalObjs";

export function SelectionMenu() {
    const dispatch: AppDispatch = useDispatch();

    const clear = useCallback(() => {
        dispatch(updateSelectionMenu(null));
        accessoryState.brush = [];
    }, [dispatch]);

    const menu = useSelector((state: RootState) => state.workspace.selectionMenu);

    const handleOptionClick = useCallback((option: string) => {
        
        const { nodesWithinBrush, edgesWithinBrush } =  getNodesAndEdgesWithinBrush()



        if (nodesWithinBrush.length > 0) {
            switch (option) {
                case 'Create Abstraction Node':
                    createAbstractionNode(getCurrentGraph(), nodesWithinBrush)
                    break;
                case 'Multiconnect':
                    if (store.getState().workspace.multiConnect.length === 0) {
                        dispatch(updateMultiConnect({nodeIds: nodesWithinBrush}));
                        dispatch(updateTopWorkspaceText("Select nodes to connect"));
                    } else {
                        dispatch(updateTopWorkspaceText(""));
                        multiConnectCreateEdges(getCurrentGraph(), nodesWithinBrush)
                        dispatch(clearMultiConnect({}));
                    }
                    break;
                case 'Copy':
                    dispatch(updateClipboard({ nodeIds: nodesWithinBrush, edgeIds: edgesWithinBrush}));
                    break;
            }
        } 
        if (option === 'Delete') {
            deleteNodes(getCurrentGraph(), nodesWithinBrush)
            deleteEdges(getCurrentGraph(), edgesWithinBrush)
        }


        clear()
    }, [])

    return (
        <>
        {menu && <Menu
            options={['Create Abstraction Node', 'Multiconnect', 'Copy', 'Delete']}
            optionHandler={handleOptionClick}
            pos={menu}
            onClose={clear}
            />}
        </>
    );
}
