import { Pos, Size } from "@/app/types/common";
import { NodeIdMap, EdgeIdMap } from '@/app/types/main';
import { Id } from "@/app/types/common";


export type InfoBox = {heading: string | null, body: string | text, position: Pos | null, side: "right" | "left"}

export interface PanelState {
    darkMode: boolean;
    
    expanded: {myGraphSpace: boolean, info: boolean};
    horizontalCollapse: {myGraphSpace: boolean, hub: boolean, info: boolean, commitHistory: boolean };
    isInAddingNodeRefMode: boolean,
    topWorkspaceText: string,
    nodeRefBeingHovered: Id | null,
    safeToDelete: boolean,
    infoBox: InfoBox
}



