import { useSelector } from "react-redux";
import { PanelBase } from "../PanelBase/PanelBase";
import { RootState } from "@/app/store/store";
import { selectPanelPositionAndSize } from "@/app/store/features/panels/selectors";
import { ThumbnailContainer } from "../../reusableComponents/Thumbnails/ThumbnailContainer";
import { categories } from '@/app/nodes/nodeTypes'
import { BaseNodeRow } from "./BaseNodes/BaseNodeRow";
import { NodeCategory } from "@/app/types/main";






export function HUB() {


    const { size } = useSelector((state: RootState) => selectPanelPositionAndSize(state, "HUB"))

    return (
        <PanelBase panelName="HUB">
            <ThumbnailContainer size={size}>
                {Object.keys(categories).map((cat) => (
                    <div key={cat} style={{width: size[0] - 30}}>
                        <BaseNodeRow cat={cat as NodeCategory} />
                    </div>
                ))}
            </ThumbnailContainer>
        </PanelBase>
    )
}