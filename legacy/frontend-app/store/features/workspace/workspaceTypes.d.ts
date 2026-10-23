import { Project, DragTarget, Graph, EdgeIdMap, NodeTypeEnum } from '@/app/types/main';
import { Id } from '@/app/types/common'


export type SelectedItemType = 'node' | 'project' | 'abs' | 'edge'

export interface CurrentSelectedItem { 
  type: SelectedItemType; 
  id: Id | null 
}

export type CurrentBrushSelection = Id[]

export type Explanation = {heading: string | null, text: string | null}


export interface WorkspaceState {
    currentProjectId: Id | null;
    currentSelectedItem: CurrentSelectedItem;
    currentBrushSelection: CurrentBrushSelection;
    currentBranchName: string;
    dragTarget: DragTarget;
    graphProjects: Project[];
    absProjects: Project[];
    explanation: Explanation
    windowSize: {
      width: number;
      height: number;
    };
    selectionMenu: Pos | null,
    rightClickMenu: Pos | null,
    clipboard: { nodeIds: Id[], edgeIds: Id[] },
    multiConnect: Id[],
    openTabs: Set<Id>,
    thumbnailBeingDragged: null | [NodeTypeEnum, Id?]
  }
