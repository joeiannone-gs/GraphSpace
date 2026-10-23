import { Metadata } from '../types/main';
import _ from 'lodash'







//create to and from protobuf format


export function metadataToPb(values: (string | number | number[] | number[][])[], names: string[]): Metadata {

    const res: Metadata = {
        "values": {}
    };

    values.forEach((value, index) => {
        const name = names[index]
        if (typeof value === 'string') {
            res.values[name] = { "stringValue": value };
        } else if (typeof value === 'number') {
            res.values[name] = { "numberValue": value };
        } else if (Array.isArray(value) && typeof value[0] === 'number') {
            res.values[name] = { "arrayValue": { "elems": value as number[] } };
        } else if (Array.isArray(value) && Array.isArray(value[0])) {
            res.values[name] = { "matrixValue": { "rows": (value as number[][]).map(row => ({ "elems": row })) } };
        }
    });

    return res;
}

export function convertMatrixValue(matrixValue: { rows: { elems: number[] }[] } | undefined | null): number[][] {
    if (!matrixValue) return []
    return matrixValue.rows.map(row => row.elems);
}


// export function get_metadata() {

// }

// export function pbNestedArrayToTensor(val: INestedArray): Tensor {

// }

// export function get_value() {

// }