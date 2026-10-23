import { SERVER_ADDRESS } from "../constants";
import { selectCurrentGraphId } from "@/app/store/features/workspace/selectors/project";
import store from "@/app/store/store";
import { USER_ID } from '../constants';


const PATH = SERVER_ADDRESS + 'data'


export async function fileUploadRequest(file: File) {


    const formData = new FormData();
    formData.append('file', file);
    
    const url = new URL(`${PATH}/upload-file`)

    const [userId, graphId] = getStandardParams(null)
    url.searchParams.append("user_id", userId)
    url.searchParams.append("graph_id", graphId)

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const parsed = await response.json();
            alert('File uploaded successfully');
            return parsed
        } else {
            alert('File upload failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during upload');
    }
}



export async function jsonUploadRequest(value:string) {


    const url = new URL(`${PATH}/text-upload`)

    const [userId, graphId] = getStandardParams(null)
    url.searchParams.append("user_id", userId)
    url.searchParams.append("graph_id", graphId)

    try {

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({"value": value}),
            headers: {
                "Content-Type": 'application/json'
            }
        });
        
        if (response.ok) {
            const parsed = await response.json();
            alert('Content saved successfully');
            return parsed

        } else {
            alert('Failed to save content');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`An error occurred while saving: ${error}`);
    }
}



export async function publicDataRequest(key: string) {

    const url = new URL(`${PATH}/public/${key}`)

    try {

        const response = await fetch(url, {
            method: 'GET',
        });
        
        if (response.ok) {
            const parsed = await response.json();
            return parsed
        }
    } catch (error) {
        console.error('Error:', error);
    }
}





const getStandardParams = (contentType: string | null) => {
    // const userId = store.getState().server?.userInfo?.sub!
    const userId = USER_ID
    const graphId = selectCurrentGraphId(store.getState().workspace)
    return [userId, graphId]
}