import { RootState } from "@/app/store/store"
import { useSelector } from "react-redux"



const WIDTH = 250

export const TooltipBox = () => {


    const {heading, body, position, side} = useSelector((state: RootState ) => state.panels.infoBox)

    if (!position) return
    return (
        <div style={{position: 'absolute', width: WIDTH, left: side == "right" ? position[0] : position[0] - WIDTH, top: position[1] + 5, backgroundColor: 'white'}}>
            <h1>{heading}</h1>
            <p>{body}</p>
        </div>
    )

}