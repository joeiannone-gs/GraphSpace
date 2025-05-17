import { useCallback } from "react";
import { useDispatch, useSelector } from 'react-redux';
import store, { AppDispatch, RootState } from "@/app/store/store";
import { pasteFromClipboard } from "@/app/store/features/workspace/thunks/create/project";
import { screenToWorld } from "@/app/services/math";
import { updateRightClickMenu } from "@/app/store/features/workspace/workspaceSlice";
import { Menu } from "../reusableComponents/Menu";
import { accessoryState } from "@/app/globalObjs";

export function RightClickMenu() {
    const dispatch: AppDispatch = useDispatch();

    const clear = useCallback(() => {
        dispatch(updateRightClickMenu(null));
    }, [dispatch]);

    const menu = useSelector((state: RootState) => state.workspace.rightClickMenu);

    const handleOptionClick = useCallback((option: string) => {
        const viewportValues = accessoryState.viewportValues

        switch (option) {
            case 'Paste':
                const eventPos = screenToWorld(menu!, viewportValues);
                pasteFromClipboard(eventPos)
                clear();
                break;
        }
    }, [dispatch, menu, clear]);

    return (
        <>
            {menu && <Menu
                options={['Paste']}
                optionHandler={handleOptionClick}
                pos={menu}
                onClose={clear}
                />}
        </>
    );
}
