import { useCallback, useEffect, useMemo, useState } from "react";
import { Id, Slice } from "@/app/types/common";
import { metadataToPb } from "@/app/proto/helpers";
import { graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "@/app/components/Workspace/commands";
import { getNode } from "@/app/components/Workspace/graphGetters";

export const ParameterNode = ({id}: {id: Id}) => {
    
    const [metadata, setMetadata] = useState(() => {
        const node = getNode(id);
        return node?.metadata?.values?.["shape"]?.arrayValue?.elems || [];
    });

    useEffect(() => {
        const node = getNode(id);
        setMetadata(node?.metadata?.values?.["shape"]?.arrayValue?.elems || [])
    }, [id])

    
    const setValue = useCallback((newValue: number[]) => {
        setMetadata(newValue)
        graphController.addCommand(new ApplyAccumulatorCommand(id, 'node', 'metadata', metadataToPb([newValue], ["shape"])))
    }, [id]);

    const isConstant = !metadata?.[0];
    
    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label>
                    <input 
                        type="radio" 
                        name="parameterType" 
                        checked={isConstant} 
                        onChange={() => setValue([])} 
                    />
                    Number
                </label>
                <label>
                    <input 
                        type="radio" 
                        name="parameterType" 
                        checked={!isConstant} 
                        onChange={() => setValue([1])} 
                    />
                    Tensor
                </label>
                {!isConstant && (
                    <div style={{ height: 150, overflowY: 'auto', overflowX: 'hidden' }} className="modern-scroll">
                        <table style={{ borderCollapse: 'collapse', width: '90%', marginTop: '10px' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                        Axis
                                    </th>
                                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                        Size
                                        <button onClick={() => setValue([...metadata, 1])}>+</button>
                                        <button onClick={() => {
                                            if (metadata.length > 1) {
                                                setValue(metadata.slice(0, -1));
                                            }
                                        }}>-</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {metadata?.map((size, index) => (
                                    <tr key={index}>
                                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                            {index + 1}
                                        </td>
                                        <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={size}
                                                onChange={(e) => {
                                                    const parsedValue = parseInt(e.currentTarget.value) || 0;
                                                    if (parsedValue > 0) {
                                                        const newValue = [...metadata];
                                                        newValue[index] = parsedValue;
                                                        setValue(newValue);
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};