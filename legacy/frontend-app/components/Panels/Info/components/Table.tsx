import { useDispatch } from "react-redux";

import { updateSafeToDelete } from "@/app/store/features/panels/panelsSlice";







interface TableProps {
    colHeaders: string[];
    rowHeaders: string[];
    tableValues: number[][];
    onValueChange: (row: number, col: number, newValue: number) => void;
}

export const Table = ({colHeaders, rowHeaders, tableValues, onValueChange}: TableProps) => {

    const dispatch = useDispatch()


    return (
        <table style={{ 
            position: 'absolute', 
            fontFamily: 'CenturyGothic, Arial, sans-serif',
            fontWeight: 'bold',
            backgroundColor:  '#fff', 
            color:  '#000',
        }}
        onFocus={() => dispatch(updateSafeToDelete(false))}
        onBlur={() => dispatch(updateSafeToDelete(true))}   >
        <thead>
            <tr>
                <th></th> {/* Empty top-left cell */}
                {colHeaders.map((header, index) => (
                    <th key={index} style={{ fontFamily: 'CenturyGothicBold' }}>
                        {header}
                    </th>
                ))}
            </tr>
        </thead>
        <tbody>
            {tableValues.map((row, rowIndex) => (
                <tr key={rowIndex}>
                    <td style={{ fontFamily: 'CenturyGothic' }}>
                        {rowHeaders[rowIndex]}
                    </td>
                    {row.map((cellValue, colIndex) => (
                        <td 
                            contentEditable={true} 
                            suppressContentEditableWarning={true}
                            key={colIndex}
                            onBlur={(e) => onValueChange(rowIndex, colIndex, Number(e.target.innerText ?? 0))}
                            style={{ fontFamily: 'CenturyGothic' }}
                        >
                            {cellValue}
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
    )
}