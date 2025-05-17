import { Id } from "@/app/types/common";
import { useCallback, useState, useEffect } from "react";
import { prettyPrintArray } from "@/app/components/overlays/helpers";
import { updateNodeDisplayValue } from "@/app/store/features/workspace/thunks/update/nodes";
import { fileUploadRequest, jsonUploadRequest, publicDataRequest } from "@/app/server/routes/data";
import { Metadata } from "@/app/types/main";
import { metadataToPb } from "@/app/proto/helpers";
import { getCurrentGraph, getNode } from "@/app/components/Workspace/graphGetters";
import { graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "@/app/components/Workspace/commands";




// metadata : saveType, pointer, fileName, fileSize

const PUBLIC_DATA_KEYS = ['MNIST', '2D-Points'] //Corresponds to public data map on backend


const getInitialValue = (metadata: Metadata | undefined ) =>{
    if (metadata?.values?.["pointer"].stringValue?.includes("public")) return 'select-from-public' //If public
    if (metadata?.values?.["pointer"].stringValue?.includes("import")) return 'file-import' //If has file name
    return 'text'
}


export function GetData({id}: { id: Id}) {


  
    const node = getNode(id)
    const initial = getInitialValue(node.metadata as Metadata | undefined);
    const [selectedValue, setSelectedValue] = useState(initial);

    useEffect(() => {
        const node = getNode(id)
        setSelectedValue(getInitialValue(node.metadata as Metadata | undefined))
    }, [id])
        
    const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedValue(event.target.value);
    };

    
    return (
        <div className="radio-container">
            <div className="radio-option">
                <input
                    type="radio"
                    id="option1"
                    name="dataOption"
                    value="text"
                    checked={selectedValue === 'text'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="option1">JSON Editor</label>
            </div>
            
            <div className="radio-option">
                <input
                    type="radio"
                    id="option2"
                    name="dataOption"
                    value="file-import"
                    checked={selectedValue === 'file-import'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="option2">File Import</label>
            </div>
            
            <div className="radio-option">
                <input
                    type="radio"
                    id="option3"
                    name="dataOption"
                    value="select-from-public"
                    checked={selectedValue === 'select-from-public'}
                    onChange={handleRadioChange}
                />
                <label htmlFor="option3">Select From Public Data</label>
            </div>
            
            <div>
                {selectedValue === 'text' && <JsonEditorComponent initial={prettyPrintArray(node.displayValue) ?? ""} id={id} />}
                {selectedValue === 'file-import' && <FileImportComponent initial={String(node.metadata?.values?.["fileName"].stringValue ?? "")} id={id} />}
                {selectedValue === 'select-from-public' && <PublicDataComponent initial={String(node.metadata?.values?.["fileName"].stringValue ?? "")} id={id} />}
            </div>
        </div>
    )
}

const JsonEditorComponent = ({initial, id}: {initial: string, id: Id}) => {
    const [content, setContent] = useState(initial);
    
    const handleSave = useCallback(async () => {

        const response = await jsonUploadRequest(content)
        if (response) updateNode(id, response)

    }, [content]);
    
    return (
        <div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{
                    width: '90%',
                    height: '100px'
                }}
                placeholder="Enter JSON data here..."
            />
            <button onClick={handleSave}>
                Save
            </button>
        </div>
    );
};
const FileImportComponent = ({initial, id}: {initial: string, id: Id}) => {

    
    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fileInput = e.currentTarget.elements.namedItem('file-upload') as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) return;

        const response = await fileUploadRequest(file)
        if (response) updateNode(id, response)
        
    }, []);

    return (
        <div>
            <div className="file-import-container">
                <form encType="multipart/form-data" onSubmit={handleSubmit}>
                    <input type="file" name="file-upload" accept=".json,.csv,.txt,.safetensors" />
                    <button type="submit">Upload</button>
                </form>
                {initial &&
                <p className="file-info">
                    Current file: {initial}
                </p>
                }
                <p className="file-instructions">
                    Upload a JSON, CSV, TXT, or SAFETENSORS file.
                </p>
                
            </div>
        </div>
    );
};


const PublicDataComponent = ({initial, id}: {initial: string, id: Id}) => {
    const handleDatasetChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const key = event.target.value;
        
        if (!key) return;

        const response = await publicDataRequest(key)
        if (response) updateNode(id, response)
    };
    
    return (
        <div>
            <select defaultValue={initial} onChange={handleDatasetChange}>
                <option value={""}>Select a dataset</option>
                {PUBLIC_DATA_KEYS.map((key) => (
                    <option key={key} value={key}>{key}</option>
                ))}
            </select>
        </div>
    );
};



const updateNode = (id: Id, parsed: any) => {
    const fileInfo = parsed.fileInfo
    const [saveType, pointer, fileName, fileSize] = fileInfo
    const truncated = parsed.truncated

    // store.dispatch(changeIndividualNodeProperty({id, property: 'metadata', newValue: metadataToPb(fileInfo, ["saveType", "pointer", "fileName", "fileSize"])}))
    graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'metadata', metadataToPb(fileInfo, ["saveType", "pointer", "fileName", "fileSize"]) ) )
    updateNodeDisplayValue(getCurrentGraph(), id, truncated)
    

}