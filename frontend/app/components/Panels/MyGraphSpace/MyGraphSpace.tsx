import { useSelector } from "react-redux";
import { Thumbnail } from "../../reusableComponents/Thumbnails/Thumbnail";
import { ThumbnailContainer } from "../../reusableComponents/Thumbnails/ThumbnailContainer";
import { PanelBase } from "../PanelBase/PanelBase";
import { RootState } from "@/app/store/store";
import { selectPanelPositionAndSize } from "@/app/store/features/panels/selectors";
import { NewProjectThumbnail } from "../../reusableComponents/Thumbnails/NewProjectThumbnail";
import { selectAllAbsProjects } from "@/app/store/features/workspace/selectors/project";






export function MyGraphSpace() {

    const { size } = useSelector((state: RootState) => selectPanelPositionAndSize(state, "My Graph Space"))
    const graphProjects = useSelector((state: RootState) => state.workspace.graphProjects, (prev, curr) => prev.length === curr.length)
    const absProjects = useSelector((state: RootState) => state.workspace.absProjects, (prev, curr) => prev.length === curr.length)

    return (
        <PanelBase panelName="My Graph Space">
            <ThumbnailContainer size={size} >
                {[...graphProjects, ...absProjects].map((proj) => <Thumbnail key={proj.id} projectId={proj.id} />)}
                <NewProjectThumbnail type={"graph"} />
                <NewProjectThumbnail type={"abs"} />
            </ThumbnailContainer>
        </PanelBase>
    )
}