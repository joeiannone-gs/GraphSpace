import {  AppDispatch, RootState } from "@/app/store/store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSelector } from "@reduxjs/toolkit/react";
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'
import { createEditor, Node, Text, Editor } from 'slate'
import { useUpdateOnChange } from "../../overlays/useUpdateOnChange";
import { textBoxStyle } from "../../overlays/styles";
import { getNameAndExplanation } from "@/app/nodes/helpers";
import { getCurrentGraph } from "../../Workspace/graphGetters";
import { graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "../../Workspace/commands";



const initialValue =  [
    {
      type: 'paragraph',
      children: [{ text: 'Loading...' }],
    },
]


export const MainInfoOverlay = ({ height}: { height: number}) => {
    const dispatch: AppDispatch = useDispatch()

    //* Selectors
    const currentSelectedItem = useSelector((state: RootState) => state.workspace.currentSelectedItem);
    const { id, type: selectedItemType } = currentSelectedItem;

    //* Memoized values
    const isEditable = useMemo(() => (currentSelectedItem.type == 'abs' || currentSelectedItem.type == 'project'), [currentSelectedItem.type])

    //* State
    const [headingEditor] = useState<Editor>(withReact(createEditor()))
    const [bodyEditor] = useState<Editor>(withReact(createEditor()))

    const onSave = useCallback(() => {
        const headingTextInputValue = Editor.string(headingEditor, [])
        const explanationTextAreaValue = Editor.string(bodyEditor, [])
       
        if (headingTextInputValue) {
            if (selectedItemType === 'project') {
                dispatch(changeGraphName({ name: headingTextInputValue }))
                //emit changed name
            } else if (id && selectedItemType === 'abs') {
                graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'name', headingTextInputValue ))
            }
        }

        if (selectedItemType === 'project') {
            dispatch(changeGraphDescription({ text: explanationTextAreaValue }))
        } else if (id && selectedItemType === 'abs') {               
            graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'explanation', explanationTextAreaValue ))
        }
        
    }, [id, currentSelectedItem, bodyEditor, headingEditor, dispatch])

    return (
        <div style={{ padding: 10 }}>
            <Heading editor={headingEditor} />
            <Body height={height - 20} editor={bodyEditor} />
            <button style={{ float: 'right' }} onClick={onSave} disabled={!isEditable}>Save</button>
        </div>
    )
}

const Heading = ({editor}: { editor: ReactEditor}) => {


    //* Selectors
    const heading = useSelector((state: RootState) => selectHeading(state.workspace))
   

    //* Hooks
    useUpdateOnChange(editor, heading)

    return (
        <div  >       
            <Slate initialValue={initialValue}  editor={editor}>
                <Editable style={{ ...textBoxStyle }} renderElement={renderElement} />
            </Slate>
        </div>
    )
}


const Body = ({height, editor}: {height: number, editor: ReactEditor}) => {

    //* Selectors
    const explanation = useSelector((state: RootState) => selectExplanation(state.workspace))


    //* Hooks
    useUpdateOnChange(editor, explanation) 

    return (
        <div >       
            <Slate initialValue={initialValue}  editor={editor}>
                <Editable style={{ ...textBoxStyle, height: height }} renderElement={renderElement} />
            </Slate>
        </div>
    )
}




//* Helpers

export const selectHeading = createSelector(
    [
        (state) => state.explanation, 
        (state) => state.currentSelectedItem, 
    ],
    (explanation, currentSelectedItem) => {
        const graph = getCurrentGraph()
        //Priority is a set explanation, then the current selected item, then the current graph
        if (explanation.heading) { 
            return explanation.heading
        } else if (currentSelectedItem?.type == 'node') { //If base node, look up heading based on type
            const nodeType = graph?.nodeIdMap[currentSelectedItem.id ?? ""]?.type
            if (nodeType) {
                return getNameAndExplanation(nodeType).name
            }
        } else if (currentSelectedItem?.type == 'abs') {
            const name =  graph?.nodeIdMap[currentSelectedItem.id ?? ""]?.name ?? "---"
            return name
        } else if (currentSelectedItem?.type === 'project') {
            return graph?.name ?? "No name"
        } else {
            return "Nothing Selected"
        }
    }
  );


export const selectExplanation = createSelector(
    [
        (state) => state.explanation, 
        (state) => state.currentSelectedItem, 
    ],
    (explanation, currentSelectedItem,) => {
        const graph = getCurrentGraph()

        //Priority is a set explanation, then the current selected item, then the current graph
        if (explanation.text) { 
            return explanation.text
        } else if (currentSelectedItem?.type == 'node') {
            const nodeType = graph?.nodeIdMap[currentSelectedItem.id ?? ""]?.type
            if (nodeType) {
                return  getNameAndExplanation(nodeType).explanation
            }
        } else if (currentSelectedItem?.type == 'abs') {
            const explanation = graph?.nodeIdMap[currentSelectedItem.id ?? ""]?.explanation ?? "--"
            return explanation
        } else if (currentSelectedItem?.type === 'project') {
            return graph?.description ?? "No description"
        } else {
            return "Nothing Selected"
        }
    }
  );


export const renderElement = (props: { element: { type: string }; children: React.ReactNode }) => {
    return props.children
}
