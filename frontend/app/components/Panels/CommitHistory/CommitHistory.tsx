import { CommitPanelOverlays } from "./CommitPanelOverlays";
import { PanelBase } from "../PanelBase/PanelBase";






export function CommitHistory() {

    return (
        <PanelBase panelName="Commit History">
            <CommitPanelOverlays />
        </PanelBase>
    )
}