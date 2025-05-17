import { Pos } from "@/app/types/common"
import { createSelector } from "@reduxjs/toolkit"
import { calculateCommitHistoryPanel, calculateHubPanel, calculateInfoPanel, calculateMyGraphSpacePanel } from "@/app/services/positioningAndSizing"
import { RootState } from "@/app/store/store"

export const selectPanelPositionAndSize = createSelector(
  [
    (state: RootState) => state.workspace.windowSize,
    (state: RootState) => state.panels.expanded,
    (state: RootState) => state.panels.horizontalCollapse,
    (_: RootState, panelName: string) => panelName
  ],
  (windowSize, expanded, horizontalCollapse, panelName) => {
    let isCollapsed: boolean;
    let isHorizontalCollapse: boolean;

    switch (panelName) {
      case 'My Graph Space':
        isCollapsed = !expanded.myGraphSpace
        isHorizontalCollapse = horizontalCollapse.myGraphSpace
        break
      case 'Info':
        isCollapsed = !expanded.info
        isHorizontalCollapse = horizontalCollapse.info
        break
      case 'HUB':
        isCollapsed = expanded.myGraphSpace
        isHorizontalCollapse = horizontalCollapse.hub
        break
      case 'Commit History':
        isCollapsed = expanded.info
        isHorizontalCollapse = horizontalCollapse.commitHistory
        break
      default:
        isCollapsed = false
        isHorizontalCollapse = false
    }

    switch (panelName) {
      case 'My Graph Space':
        return calculateMyGraphSpacePanel(windowSize, isCollapsed, isHorizontalCollapse)
      case 'Info':
        return calculateInfoPanel(windowSize, isCollapsed, isHorizontalCollapse)
      case 'HUB':
        return calculateHubPanel(windowSize, isCollapsed, isHorizontalCollapse)
      case 'Commit History':
        return calculateCommitHistoryPanel(windowSize, isCollapsed, isHorizontalCollapse)
      default:
        return { size: [0, 0] as [number, number], pos: [0, 0] as Pos }
    }
  }
)




