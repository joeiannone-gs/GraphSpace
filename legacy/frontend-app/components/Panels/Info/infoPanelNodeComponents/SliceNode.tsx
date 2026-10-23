import {  useEffect, useMemo, useState } from "react";
import { Id } from "@/app/types/common";
import { produce } from "immer";
import { convertMatrixValue, metadataToPb } from "@/app/proto/helpers";
import { getNode } from "@/app/components/Workspace/graphGetters";
import { graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "@/app/components/Workspace/commands";



export const SliceNode = ({id}: {id: Id}) => {

  

    const [metadataAsArray, setMetadataAsArray] = useState(convertMatrixValue(getNode(id)?.metadata?.values?.["slice"]?.matrixValue))
   

    useEffect(() => {
        setMetadataAsArray(convertMatrixValue(getNode(id)?.metadata?.values?.["slice"]?.matrixValue))
    }, [id])

    return (
        <div style={{ width: '90%',  height: 150, overflowY: 'auto', overflowX: 'hidden' }} className="modern-scroll">
            <div className="modern-scroll" style={{ overflowY: 'scroll' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr>
                            <th></th>
                            {['Start', 'Stop', 'Stride'].map((header, index) => (
                                <th key={index} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {metadataAsArray?.map((_, rowIndex) => (
                            <tr key={rowIndex}>
                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                                    {`Axis ${rowIndex}`}
                                </td>
                                {metadataAsArray[rowIndex]?.map((_, colIndex) => (
                                    <td key={colIndex} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                        <input
                                            value={metadataAsArray[rowIndex][colIndex]}
                                            type="number"
                                            style={{ width: '100%', boxSizing: 'border-box' }}
                                            onChange={(e) => {
                                                const newValue = e.currentTarget.value
                                                const newTable = produce(metadataAsArray, draft => {
                                                    draft[rowIndex][colIndex] = parseInt(newValue) || 0
                                                })
                                                setMetadataAsArray(newTable)
                                                // store.dispatch(changeIndividualNodeProperty({id, property: 'metadata', newValue: metadataToPb([newTable], ["slice"])}))
                                                graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'metadata', metadataToPb([newTable], ["slice"])))
                                            }}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    )
}



