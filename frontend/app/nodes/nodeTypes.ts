
import { NodeTypeEnum } from "../proto/compiled";


export const categories = {
    "Arithmetic": {
        "questionText": "These are basic mathematical operations."
    },
    "Basic Math": {
        "questionText": "These nodes perform fundamental mathematical operations."
    },
    "Other": {
        "questionText": "These nodes offer various functionalities for data manipulation and display."
    }
}

export const nodeTypes = {
    [NodeTypeEnum.ADD]: {
        "name": "Add",
        "explanation": "Add all inputs together.",
        "category": "Arithmetic"
    },
    [NodeTypeEnum.SUBTRACT]: {
        "name": "Subtract",
        "explanation": "Subtract the first input from the second.",
        "category": "Arithmetic"
    },
    [NodeTypeEnum.MULTIPLY]: {
        "name": "Multiply",
        "explanation": "Multiply all inputs together.",
        "category": "Arithmetic"
    },
    [NodeTypeEnum.DIVIDE]: {
        "name": "Divide",
        "explanation": "Divide the first input by the second.",
        "category": "Arithmetic"
    },
    [NodeTypeEnum.VALUE]: {
        "name": "Value",
        "explanation": "This node holds an integer or tensor.",
        "category": "Basic Math"
    },
    [NodeTypeEnum.SQUARE]: {
        "name": "Square",
        "explanation": "Multiply an input with itself.",
        "category": "Basic Math"
    },
    [NodeTypeEnum.AVERAGE]: {
        "name": "Average",
        "explanation": "Take the average of values in a tensor.",
        "category": "Basic Math"
    },
    [NodeTypeEnum.PARAMETER]: {
        "name": "Parameter",
        "explanation": "This node updates its value to minimize the output of a loss function.",
        "metadata": { "values": { "shape": { "arrayValue": { "elems": [] }}}},
        "category": "Basic Math"
    },
    [NodeTypeEnum.RELU]: {
        "name": "ReLU",
        "explanation": "The Rectified Linear Unit (ReLU) is a popular activation function commonly used in neural networks and deep learning models. The function returns 0 if it receives any negative input, but for any positive value x it returns that value back.",
        "category": "Basic Math"
    },
    [NodeTypeEnum.SIGMOID]: {
        "name": "Sigmoid",
        "explanation": "Transforms a continuous real number into a range of (0, 1).",
        "category": "Basic Math"
    },
    [NodeTypeEnum.DOT]: {
        "name": "Dot Product",
        "explanation": "Take the dot product",
        "category": "Other"
    },
    [NodeTypeEnum.SLICE]: {
        "name": "Slice",
        "explanation": "Slice a tensor.",
        "metadata": { "values": { "slice": { "matrixValue": { "rows": [{ "elems": [0, -1, 1] }] }}}} ,
        "category": "Other"
    },
    [NodeTypeEnum.IMPORT]: {
        "name": "Import",
        "explanation": "Upload data, or select a public dataset.",
        "category": "Other"
    },
    [NodeTypeEnum.CHART]: {
        "name": "Chart",
        "explanation": "This node charts data from the previous node as a 2D graph.",
        "category": "Other"
    },
    [NodeTypeEnum.FLATTEN]: {
        "name": "Flatten Array",
        "explanation": "Take an array of any dimension and flatten it into a single dimensional array.",
        "category": "Other"
    },
    [NodeTypeEnum.ARRAY]: {
        "name": "Create Array",
        "explanation": "Create an array out of the values of inputting nodes",
        "category": "Other"
    },
    [NodeTypeEnum.IMAGE]: {
        "name": "Image",
        "explanation": "Display an image from a 2d array",
        "category": "Other"
    },
    [NodeTypeEnum.STACK]: {
        "name": "Create Stack",
        "explanation": "Create a stack datastructure from a list",
        "category": "Other"
    },
    [NodeTypeEnum.POP]: {
        "name": "Pop",
        "explanation": "Pops an item off of a stack",
        "category": "Other"
    }
}

