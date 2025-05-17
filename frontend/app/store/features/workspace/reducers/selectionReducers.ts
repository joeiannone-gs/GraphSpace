
import { PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "../workspaceSlice";
import { WorkspaceState, SelectedItemType } from "../workspaceTypes";
import { Id } from "@/app/types/common";
import { DragTarget, DragTargetType } from '@/app/types/main';
import { NodeTypeEnum } from "@/app/proto/compiled";



 const updateCurrentProjectId = (state: WorkspaceState, action: PayloadAction<{ id: Id }>) => {
    const { id } = action.payload;
    state.currentProjectId = id;
    state.currentSelectedItem = { type: 'project', id}
};

 const updateCurrentSelectedItem = (state: WorkspaceState, action: PayloadAction<{ type: SelectedItemType, id: Id | null}>): void => {
    const {type, id} = action.payload;
    state.currentSelectedItem.type = type;
    state.currentSelectedItem.id = id;
};


 const updateDragTarget = (state: WorkspaceState, action: PayloadAction<{ type: DragTargetType, id: Id | null }>) => {
    const { type, id } = action.payload;
    state.dragTarget.type = type
    state.dragTarget.id = id
};

 const updateCurrentBranchName = (state: WorkspaceState, action: PayloadAction<{ name: string }>) => {
    const { name } = action.payload;
    state.currentBranchName = name;
};

 const resetSelection = (state: WorkspaceState) => {
    state.currentSelectedItem = initialState.currentSelectedItem;
    state.currentBranchName = initialState.currentBranchName;
    state.dragTarget = initialState.dragTarget;
    state.currentBrushSelection = initialState.currentBrushSelection;
};


const updateExplanation = (state: WorkspaceState, action: PayloadAction<{heading: string | null, text: string | null}>) => {
    state.explanation = action.payload;
};

const updateThumbnailBeingDragged = (state: WorkspaceState, action: PayloadAction<{ value: [NodeTypeEnum, Id?] | null }>) => {
    const { value } = action.payload
    state.thumbnailBeingDragged = value
}


 export default {
    updateExplanation,
    updateCurrentProjectId,
    updateCurrentSelectedItem,
    updateDragTarget,
    updateCurrentBranchName,
    resetSelection,
    updateThumbnailBeingDragged
};

