"use client"
import { Id } from "@/app/types/common";
import {  Node, Text, Editor, BaseEditor } from 'slate'
import {  ReactEditor } from 'slate-react'
import { WorkspaceState } from "@/app/store/features/workspace/workspaceTypes";

export type CustomElement = { type: 'nodeRef'; nodeId: Id, children: CustomText[] }
export type CustomTextElement = { type: 'text'; children: CustomText[] }
export type CustomText = { text: string }


declare module 'slate' {
    interface CustomTypes {
      Editor: BaseEditor & ReactEditor
      Element: CustomElement | CustomTextElement
      Text: CustomText
    }
  }

const replacer = (key: string, value: any) => {
    // If the value is an array, stringify it
    if (!Array.isArray(value?.[0])) {
        return JSON.stringify(value)
    } else {
        return value
    }
   
};

export const prettyPrintArray = (value: any) => {

    if (typeof value == 'number') {
        return JSON.stringify(value)
    } else if (Array.isArray(value)) {
        return JSON.stringify(value, replacer, "\t")
        .replace(/\\/g, '')
        .replace(/\"\[/g, '[')
        .replace(/\]\"/g,']')
        .replace(/\"\{/g, '{')
        .replace(/\}\"/g,'}');
    }
}
 

export const textToSlateNodes = (text: string) => {

    if (!text) {
        return [
        {
            type: 'text',
            children: [{text: ""}]
        }]
    }
    const regex = /(@\{[^}]+\})/g;
    const parts = text ?  text.split(regex) : [] // Split the content into parts
    const slateNodes: Node[] = []
    parts.forEach((part) => {
        // const match = regex.exec(part)
        // if ( match !== null) {
        //     const nodeId = match[1].replace(/[@{}]/g, '');
        //     const displayName = nodeIdMap?.[nodeId].type
        //     const node: CustomElement = {
        //         type: 'nodeRef',
        //         nodeId: nodeId,
        //         children: [{ text: displayName ?? "" }]
        //       }
        //     slateNodes.push(node);
        // } else {
        //     slateNodes.push({
        //         type: 'text',
        //         children: [{text: part}]
        //     })
        // }

        slateNodes.push({
            type: 'text',
            children: [{text: part}]
        })
    })
    return slateNodes;
  }


export function clearEditor(editor: ReactEditor) {
    try {
        editor.delete({
            at: {
                anchor: Editor.start(editor, []),
                focus: Editor.end(editor, [])
            }
        });
    } catch (error) {
        console.error('Error deleting editor content:', error);
    }
}

