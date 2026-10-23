import { Pos } from "@/app/types/common"



export interface PanelBaseProps {
    heading: Heading
    tag: Tag
    headerHeight: number
    children: React.ReactNode
}

export type Heading = "HUB" | "My Graph Space" | "Info" | "Commit History"
export type Tag = "hub" | "myGraphSpace" | "info" | "commitHistory"