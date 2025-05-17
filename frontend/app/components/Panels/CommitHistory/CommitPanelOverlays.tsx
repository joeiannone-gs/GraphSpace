import store, {  AppDispatch, RootState } from "@/app/store/store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { applyPadding, calculateCommitHistoryPanel, calculateInfoPanel } from "@/app/services/positioningAndSizing";
import { useUpdateOnChange } from "../../overlays/useUpdateOnChange";
import { Editable, ReactEditor, Slate, withReact } from "slate-react";
import { createEditor, Editor } from "slate";
import { textBoxStyle } from "../../overlays/styles";
import { generateId } from "@/app/services/math";
import { useTimeStamp } from "../../Manager/hooks/useTimeStamp";
import { selectBranches, selectCurrentBranch } from "@/app/store/features/workspace/selectors/commitHistory";
import { Id } from "@/app/types/common";
import { createCommit, createTempBranch } from "@/app/store/features/workspace/thunks/create/project";
import workspaceSlice, { addIdToCommitNext, resetDeltasForBranch, updateBranchName, updateCurrentBranchName } from "@/app/store/features/workspace/workspaceSlice";
import _ from "lodash";
import { clearEditor } from "../../overlays/helpers";
import { PixiCanvas } from "../../reusableComponents/PixiCanvas";
import { Application, Container, Graphics, Renderer, Ticker } from "pixi.js";
import { CommitGraph } from "./CommitGraph/CommitGraph";
import { setupViewport } from "../../reusableComponents/viewport";
import { selectCurrentProject } from "@/app/store/features/workspace/selectors/project";
import { emitDeleteBranch, emitUpdateBranchName } from "@/app/server/routes/projects";
import { graphs, ViewportValues } from "@/app/globalObjs";



const initialValue =  [
    {
      type: 'paragraph',
      children: [{ text: 'Loading...' }],
    },
]


export const CommitPanelOverlays = () => {

    const dispatch: AppDispatch = useDispatch()

    //* Selectors
    const windowSize = useSelector((state: RootState) => state.workspace.windowSize);
    const isHorizontalCollapse = useSelector((state: RootState) => state.panels.horizontalCollapse['commitHistory'])
    const isCollapsed = useSelector((state: RootState) => state.panels.expanded['info'])
    const currentBranchName = useSelector((state: RootState) => selectCurrentBranch(state.workspace)?.name)
    const currentProjectId = useSelector((state:RootState) => state.workspace.currentProjectId)

    //* State
    const [newCommitId, setNewCommitId] = useState(generateId(8))
    const timestamp = useTimeStamp()
    const [branchNameEditor] = useState<Editor>(withReact(createEditor()))
    const [commitMessageEditor] = useState<Editor>(withReact(createEditor()))

    //* Other
    const { size, pos } = useMemo(() => calculateCommitHistoryPanel(windowSize, isCollapsed, isHorizontalCollapse), [isHorizontalCollapse, isCollapsed] )
    const { xAbs, widthAbs, heightAbs, yAbs } = useMemo(() => {
        const [widthAbs, heightAbs, xAbs, yAbs] = applyPadding(size, pos)
        return { xAbs, widthAbs, heightAbs, yAbs };
    }, [size, pos]);
    const timeStampText = useMemo(() => `${newCommitId}   ${timestamp}`, [newCommitId, timestamp])

    const onCommitButtonPress = useCallback(() => {

        const branches = selectBranches(store.getState().workspace)
        const currentBranch = selectCurrentBranch(store.getState().workspace)
        const projectId = selectCurrentProject(store.getState().workspace)?.id

        if (!currentBranch || !branches) {
            return
        }

        let branchName = currentBranch.name
        if (branchName == 'temp') {
            branchName = Editor.string(branchNameEditor, [])
            //Check if name already exists or if nothing was put in the text box, if so, return
            const branchIdFromName = (name: string) => {
                const b = selectBranches(store.getState().workspace)
                if (!b) return undefined;
                const branchId = Object.keys(b).find(id => b[id].name === name);
                return branchId
            }
            const newNameBranchId = branchIdFromName(branchName)
            const tempBranchId = branchIdFromName('temp')
            if (!tempBranchId || newNameBranchId || !branchName) return
            //Rename 'temp' branch to branchName
            dispatch(updateBranchName({ currentName: 'temp', newName: branchName }))
            //Set current branch to be this new branch
            dispatch(updateCurrentBranchName({ name: branchName }))
            //Update in server
            emitUpdateBranchName(projectId, tempBranchId, branchName)
        }

        const previousId = currentBranch.latestCommitId
        const deltas = currentBranch.backwardDeltas

        //Set 'next' of previous commit to include this commit (only if previous exists)
        if (previousId) {
            dispatch(addIdToCommitNext({ commitId: previousId, nextCommitId: newCommitId }))
        }

        //Create new commit in state
        const commitMessage = Editor.string(commitMessageEditor, [])
        dispatch(createCommit(commitMessage, branchName, previousId, deltas, newCommitId))

        //Reset deltas, newCommitId, and editors
        dispatch(resetDeltasForBranch({ name: branchName, deltaType: 'backwardDeltas' }))
        setNewCommitId(generateId(8))
        clearEditor(branchNameEditor)
        clearEditor(commitMessageEditor)

    }, [newCommitId, branchNameEditor, commitMessageEditor])


    const commitGraphCallback = useCallback((stage: Container, renderer: Renderer, ticker: Ticker) => {
   
        const onNewBranch = (latestCommitId: Id) => {

            const branches = selectBranches(store.getState().workspace)
    
            if (!branches) return
            //check if there's already a temp branch, if so, dont do anything
            const tempBranch = Object.keys(branches).findIndex(id => branches[id].name == 'temp')
            if (tempBranch == -1) {
                //Create a branch in state with name 'temp'
                dispatch(createTempBranch(latestCommitId))
                //Set the currentBranch to 'temp'
                dispatch(updateCurrentBranchName({ name: 'temp' }))
            } 
            
        }


        const updateValues = (newValues: ViewportValues) => {  };
        const viewport = setupViewport( renderer, updateValues)
        stage.addChild(viewport)

        


        ticker.add(() => {
            const project = selectCurrentProject(store.getState().workspace)
            if (!viewport.children[0] && project?.branches && Object.keys(graphs).length > 0 ) {
                const commitGraph = new CommitGraph(renderer, ticker, onNewBranch)

                commitGraph.pixiContainer.x = widthAbs/2
                commitGraph.pixiContainer.y = - 30
                viewport.addChild(commitGraph.pixiContainer)
            }
            renderer.render(stage)
        })

        ticker.start()

    }, [])


    return (
        <div style={{ padding: '10px' }}>
            <CommitForm 
                timeStampText={timeStampText}
                currentBranchName={currentBranchName}
                widthAbs={widthAbs}
                branchNameEditor={branchNameEditor}
                commitMessageEditor={commitMessageEditor}
            />
            <div>
                <button onClick={onCommitButtonPress}>
                    Commit
                </button>
            </div>
            <br/>
            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <div style={{ 
                    width: widthAbs, 
                    height: heightAbs/2 - 30, 
                    borderRadius: '10px', 
                    overflow: 'hidden', 
                    border: '3px solid #999',
                    visibility: isCollapsed ? 'hidden' : 'visible' 
                }}>
                    <PixiCanvas width={widthAbs} height={heightAbs/2 -30} callback={commitGraphCallback} />
                </div>
                <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1 }}>, 
                    <BranchButtons />
                </div>
            </div>
        </div>
    )
}

interface CommitFormProps {
    timeStampText: string;
    currentBranchName: string | undefined;
    widthAbs: number;
    branchNameEditor: ReactEditor;
    commitMessageEditor: ReactEditor;
}

const branchNameHeight = 13
const CommitForm = ({ timeStampText, currentBranchName, widthAbs, branchNameEditor, commitMessageEditor }: CommitFormProps) => {
    return (
        <>
            <div style={{ height: branchNameHeight,  marginBottom: '10px' }}>
                <p style={{ margin: '5px 0' }}>{timeStampText}</p>
                {(currentBranchName != 'temp') && <p style={{ margin: '5px 0' }}>Branch: {currentBranchName ?? "None"}</p>}
            </div>
            <div style={{ height: branchNameHeight, marginBottom: '15px' }}>
                {(currentBranchName == 'temp') && <NewBranchName width={widthAbs * 0.8} height={30} editor={branchNameEditor} />}
            </div>
            <br/>
            <div style={{ marginBottom: '15px' }}>
                <NewCommitMessage width={widthAbs * 0.8} height={60}  editor={commitMessageEditor}/>
            </div>
        </>
    );
};

const BranchButtons = () => {
    const dispatch = useDispatch();
    const currentBranchName = useSelector((state: RootState) => state.workspace.currentBranchName);

    const handleBranchChange = (direction: 'prev' | 'next') => {
        const currProject = selectCurrentProject(store.getState().workspace)
        const projectId = currProject?.id
        const branchIds = currProject?.branchOrder

        const branches = selectBranches(store.getState().workspace)


        if (!branches || !currentBranchName || !branchIds) return;
        
        const branchNames = branchIds.map(id => branches[id].name);

        const currentIndex = branchNames.indexOf(currentBranchName);
        
        let newIndex;
        if (direction === 'next') {
            newIndex = currentIndex + 1 >= branchNames.length ? 0 : currentIndex + 1;
        } else {
            newIndex = currentIndex - 1 < 0 ? branchNames.length - 1 : currentIndex - 1;
            if (currentBranchName === 'temp') {
                dispatch(workspaceSlice.actions.deleteBranch({ name: 'temp'}))
                // delete graphs[branchId]
                emitDeleteBranch(projectId, branchIds[currentIndex])
            }
        }
        
        const name = branchNames[newIndex]
        dispatch(updateCurrentBranchName( {name }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <button onClick={() => handleBranchChange('prev')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Arrow rotation={-90} />
            </button>
            <span style={{ padding: '4px 0', color: "white" }}>{currentBranchName ?? "None"}</span>
            <button onClick={() => handleBranchChange('next')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Arrow rotation={90} />
            </button>
        </div>
    )
}

const Arrow = ({ rotation }: { rotation: number }) => {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24">
            <path 
                d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" 
                fill="white"
                transform={`rotate(${rotation} 12 12)`}
            />
        </svg>
    )
}



const NewBranchName = ({width, height, editor}: {width: number, height: number, editor: ReactEditor}) => {

    
    //* State
    const text = 'new branch name'

    //* Hooks
    useUpdateOnChange(editor, text) 

    return (
        <div >       
            <Slate initialValue={initialValue}  editor={editor}>
                <Editable style={{ ...textBoxStyle, width: width, height: height }} renderElement={renderElement} />
            </Slate>
        </div>
    )
}


const NewCommitMessage = ({width, height, editor}: {width: number, height: number, editor: ReactEditor}) => {

    
    //* State
    const text = 'New commit message'

    //* Hooks
    useUpdateOnChange(editor, text) 

    return (
        <div >       
            <Slate initialValue={initialValue}  editor={editor}>
                <Editable style={{ ...textBoxStyle, width: width, height: height }} renderElement={renderElement} />
            </Slate>
        </div>
    )
}



//* Helpers

export const renderElement = (props: { element: { type: string }; children: React.ReactNode }) => {
    return props.children
}
