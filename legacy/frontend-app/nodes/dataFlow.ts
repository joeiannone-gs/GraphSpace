import { NodeTypeEnum } from "../proto/compiled"





export const CANT_TAKE_INPUT = [NodeTypeEnum.PARAMETER]


//Should exclude from deltas (and therefore exclude from updating on the server)
export const EXCLUDE_FROM_DELTAS = ['displayValue', 'value', 'backprop']
