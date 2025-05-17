
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppDispatch, RootState } from "@/app/store/store";
import { useDispatch, useSelector } from "react-redux";
import { Id } from "@/app/types/common";
import { updateAbsNodeSubType } from "@/app/store/features/workspace/thunks/update/nodes";
import { Chart } from "@/app/components/reusableComponents/Chart";
import { getDescendants, topologicalSort } from "@/app/services/graphTheory";
import { selectPanelPositionAndSize } from "@/app/store/features/panels/selectors";
import { getCurrentGraph, getNode } from "@/app/components/Workspace/graphGetters";


export const AbstractionNode = ({id}: {id: Id}) => {
    const dispatch = useDispatch<AppDispatch>()


    const [purpose, setPurpose] = useState(getNode(id).metadata?.values?.['purpose'].stringValue)

    useEffect(() => {
        setPurpose(getNode(id).metadata?.values?.['purpose'].stringValue)
    }, [id])

    const onChange = useCallback((event: { target: { value: "normal" | "predictor" | "loss" } }) => {
        const value = event.target.value
        if (purpose !== value) {
            updateAbsNodeSubType(getCurrentGraph(), id, value)
            setPurpose(value)
        }
    }, [purpose, id, dispatch])


    return (
        <div className="radio-group">
            <input type="radio" value="normal" onChange={onChange} checked={purpose === 'normal'} />
            <label htmlFor="input">Normal</label>

            <input type="radio" value="predictor" onChange={onChange} checked={purpose === 'predictor'} />
            <label htmlFor="hidden">Predictor</label>

            <input type="radio" value="loss" onChange={onChange} checked={purpose === 'loss'} />
            <label htmlFor="output">Loss</label>
            { (purpose === 'loss') && <LossChart id={id} /> }
        </div>
    )

}


function LossChart( { id }: {id: Id}) {

    const { size } = useSelector((state: RootState) => selectPanelPositionAndSize(state, "Info"))


    const lastNodeInAbs = useMemo(() => {
        const graph = getCurrentGraph()

        const desc = getDescendants(id, graph.nodeIdMap )
        const sorted = topologicalSort(Array.from(desc), graph.nodeIdMap, graph.edgeIdMap)
        return sorted[sorted.length - 1]

    }, [id])

    return (
        <Chart id={lastNodeInAbs} width={size[0]*0.9} height ={150}  />
    )
}