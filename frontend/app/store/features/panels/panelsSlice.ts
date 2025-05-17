import { Id, Pos, Size } from '@/app/types/common'
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { InfoBox, PanelState } from './panelsTypes'



const initialState: PanelState = {
    darkMode: true,
    expanded: {'myGraphSpace': false, 'info': false},
    horizontalCollapse: {'myGraphSpace': false, 'hub': false, 'info': false, 'commitHistory': false },
    isInAddingNodeRefMode: false,
    topWorkspaceText: '',
    nodeRefBeingHovered: null,
    safeToDelete: true,
    infoBox: {"heading": null, "body": null, "position": null, side: "right" }
}

export const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
       
        updateExpanded: (state, action: PayloadAction<{panel:"myGraphSpace" | "hub" | "info" | "commitHistory", value: boolean}>) => {
            const { panel, value } = action.payload;
            if (panel === 'myGraphSpace' || panel === 'info') {
                state.expanded[panel] = value;
            }
            else if (panel === "hub") {
                state.expanded.myGraphSpace = !value;
            } 
            else if (panel === "commitHistory") {
                state.expanded.info = !value;
            }
        },
        updateHorizontalCollapse:  (state, action: PayloadAction<{panel: "myGraphSpace" | "hub" | "info" | "commitHistory" , value: boolean}>) => {
            state.horizontalCollapse[action.payload.panel] = action.payload.value
        },
        updateDarkMode: (state, action: PayloadAction<boolean>) => {
            state.darkMode = action.payload
        },
        //Other
        updateIsInAddingNodeRefMode: (state, action: PayloadAction<boolean>) => {
            state.isInAddingNodeRefMode = action.payload
        },
        updateTopWorkspaceText: (state, action: PayloadAction<string>) => {
            state.topWorkspaceText = action.payload
        },
        clearTopWorkspaceText: (state) => {
            state.topWorkspaceText = ''
        },
        updateNodeRefBeingHovered: (state, action: PayloadAction<Id | null>) => {
            state.nodeRefBeingHovered = action.payload
        },
        updateSafeToDelete: (state, action: PayloadAction<boolean>) => {
            state.safeToDelete = action.payload
        },
        //Info box
        updateInfoBox: (state, action: PayloadAction<InfoBox>) => {
            state.infoBox = action.payload
        },
        clearInfoBox: (state) => {
            state.infoBox = {heading: null, body: null, position: null, side: "right"}
        }
       
    }
})

export const {
    updateExpanded,
    updateHorizontalCollapse,
    updateDarkMode,
    updateIsInAddingNodeRefMode,
    updateTopWorkspaceText,
    clearTopWorkspaceText,
    updateNodeRefBeingHovered,
    updateSafeToDelete,
    updateInfoBox, 
    clearInfoBox
} = uiSlice.actions;

export default uiSlice

