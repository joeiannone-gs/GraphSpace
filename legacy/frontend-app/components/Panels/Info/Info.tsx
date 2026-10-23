import { useSelector } from "react-redux";
import { MainInfoOverlay } from "./MainInfoOverlay";
import { PanelBase } from "../PanelBase/PanelBase";
import { RootState } from "@/app/store/store";
import { selectPanelPositionAndSize } from "@/app/store/features/panels/selectors";
import { PropertiesInfoOverlay } from "./PropertiesInfoOverlay";




export function Info() {

    const { size } = useSelector((state: RootState) => selectPanelPositionAndSize(state, "Info"))
    const isCollapsed = useSelector((state: RootState) => !state.panels.expanded.info)


    return (
        <PanelBase panelName="Info">
            <MainInfoOverlay height={isCollapsed ? size[1] /2 : size[1] / 3} />
            {!isCollapsed && <PropertiesInfoOverlay height={size[1] / 2} />}
        </PanelBase>
    )
}