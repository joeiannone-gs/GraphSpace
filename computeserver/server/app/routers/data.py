import os
import ast
import csv
import json
import tempfile
from safetensors import safe_open
from safetensors.tensorflow import load_file

from typing import Annotated

from fastapi import APIRouter, Body, UploadFile, HTTPException
from werkzeug.utils import secure_filename

from computeserver.server.nodes.data_flow import OMIT_THRESHOLD
from computeserver.server.services.basic import convert_to_list, is_rectangular, truncate_array
from computeserver.server.services.compute import generate_id
from computeserver.server.services.file_utils.nested_array import convert_from_nested_array, convert_to_nested_array, get_nested_array_entry, update_nested_array_entry
from computeserver.server.services.file_utils.safe_tensors import update_safe_tensor_value
from computeserver.server.types.value import TensorType





ALLOWED_EXTENSIONS = {'txt', 'csv', 'json', 'safetensors'}
PUBLIC_DATA = { 
    'MNIST': ['list', 'public-mnist-01', 'MNIST'],
    '2D-Points': ['tensor', 'public-2d-01', '2D Points']
}

def allowed_file(filename: str):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS



router = APIRouter()


router = APIRouter(
    prefix="/data",
    tags=["data"],
)


@router.post("/upload-file")
async def upload_file(user_id: str, graph_id: str, file: UploadFile):

    if file.filename is None:
        raise HTTPException(status_code=400, detail="No selected file")
        
    if not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    filename = secure_filename(file.filename)
    extension = filename.rsplit('.', 1)[1].lower()
    # Get the file size
    file.file.seek(0, os.SEEK_END)
    filesize = file.file.tell()
    file.file.seek(0)  # Reset file position to beginning
    
    array: TensorType = []

    try:
        
        if extension == 'txt':
            file_content = file.file.read().decode('utf-8')

            try:
                array = ast.literal_eval(file_content)
            except (ValueError, SyntaxError):
                raise HTTPException(status_code=400, detail="Invalid txt content")
                
        elif extension == 'csv':
            file_content = file.file.read().decode('utf-8')

            try:
                csv_reader = csv.reader(file_content.splitlines())
                for row in csv_reader:
                    array.append([float(value) for value in row])
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid CSV content - all values must be numeric")
                
        elif extension == 'json':
            file_content = file.file.read().decode('utf-8')

            try:
                json_data = json.loads(file_content)
                array = list(json_data.values()) if isinstance(json_data, dict) else json_data
            except json.JSONDecodeError as e:
                raise HTTPException(status_code=400, detail=f"Invalid JSON content: {str(e)}")
                
        elif extension == 'safetensors':
            try:
                
                temp_dir = tempfile.mkdtemp()
                temp_path = os.path.join(temp_dir, filename)
                
                with open(temp_path, 'wb') as f:
                    f.write(file.file.read())
                
                with safe_open(temp_path, framework="tf") as f:
                    # Get the first tensor and convert to array
                    tensor_names = f.keys()
                    if not tensor_names:
                        raise HTTPException(status_code=400, detail="No tensors found in safetensor file")
                    
                    first_tensor_name = list(tensor_names)[0]
                    tensor_data = f.get_tensor(first_tensor_name)
                    
                    array = tensor_data.tolist()
                
                os.remove(temp_path)
                os.rmdir(temp_dir)
                
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error processing safetensor file: {str(e)}")
            
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding - must be UTF-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

    response = save_data_and_respond(array, filesize, filename, user_id, graph_id, 'import')
    return response




@router.post("/text-upload")
async def text_upload(user_id: str, graph_id: str, value: Annotated[str, Body(embed=True)]):
    try:
        size = len(value)

        # Access the text directly from request body
        if not value:
            raise HTTPException(status_code=400, detail="No text in the request body")
        
        if size > OMIT_THRESHOLD:
            raise HTTPException(status_code=413, detail="Text size exceeds 10MB limit")
        
        try:
            result: TensorType = ast.literal_eval(value)
            response = save_data_and_respond(result, size, "", user_id, graph_id, 'text')
            return response

        except (SyntaxError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"Error evaluating text: {str(e)}")
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid text encoding - must be UTF-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")


@router.get("/public/{key}")
async def public(key: str):

    file_info = PUBLIC_DATA.get(key)

    if file_info == None:
        raise HTTPException(status_code=404, detail=f"Dataset with key '{key}' not found")

    array: TensorType = []
    if file_info[0] == 'list':
        nested_array_entry = get_nested_array_entry(file_info[1], True, None, None) 
        if nested_array_entry:
            if (nested_array_entry.trunctated_value):
                array = convert_from_nested_array(nested_array_entry.trunctated_value)
            else:
                array = convert_from_nested_array(nested_array_entry.value)

    else: 
        tensor = load_file(f"server/EBS/public/tensors/{file_info[1]}.safetensors").get(file_info[1])
        if tensor is not None:
            array = convert_to_list(tensor)
            
    return { 'fileInfo': file_info, 'truncated': array}
   



## Helpers
def save_data_and_respond(array: TensorType, filesize: int, filename: str, user_id: str, graph_id: str, pointer_pre: str | None = None):
    is_rect = is_rectangular(array)
    pointer = pointer_pre + generate_id(16) if pointer_pre else generate_id(16)
    save_type = 'list'

    if (filesize > OMIT_THRESHOLD):
        truncated = truncate_array(array, 100)
    else: 
        truncated = array

    if (is_rect):
        save_type = 'tensor'
        update_safe_tensor_value(user_id, graph_id, array, pointer, { 'truncated': json.dumps(truncated)})
    else: 
        value = convert_to_nested_array(array)
        truncated_nested_array = convert_to_nested_array(truncated)
        update_nested_array_entry(user_id, graph_id, pointer, value, truncated_nested_array)
        

    response = { 
        'fileInfo': [save_type, pointer, filename, filesize],  
        'truncated': truncated
    }

    return response