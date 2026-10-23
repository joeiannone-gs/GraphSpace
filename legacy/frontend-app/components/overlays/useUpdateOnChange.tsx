import {  useEffect } from "react";
import { Editor, Transforms } from 'slate'
import { clearEditor, textToSlateNodes } from "./helpers";
import { ReactEditor } from "slate-react";




export const useUpdateOnChange = (editor: ReactEditor, value: string) => {

    useEffect(() => {
        if (editor && value) {
            // Remove all existing nodes
            clearEditor(editor)
            const newNodes = textToSlateNodes(value)
            Transforms.insertNodes(editor, newNodes, { at: [0] })
        }
    }, [value])   
}