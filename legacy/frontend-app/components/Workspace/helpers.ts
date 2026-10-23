import { Id } from '@/app/types/common';

function readFile(file: File | null) {
    const reader = new FileReader();

    // This will start reading the file
    if (file && (file.type === 'text/plain' || file.type === 'text/csv')) {
        reader.readAsText(file);
    } else {
        console.log('Unsupported file type');
    }
    return reader;
}

const uploadFiles = (dataTransfer: DataTransfer | null) => {
    if (dataTransfer) {

        if (dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            const item = dataTransfer.items[0];
            // If dropped items aren't files, reject them
            if (item.kind === "file") {
                const file = item.getAsFile();
                console.log(`file name: ${file?.name}`);
                return { reader: readFile(file), name: file?.name ?? "NO_NAME" };
            }
        } else {
            // Use DataTransfer interface to access the file(s)
            const file = dataTransfer.files[0];
            console.log(`file name:  ${file.name}`);
            return { reader: readFile(file), name: file.name };
        }
    }
}

export function dropHandler(ev: DragEvent, nodeId: Id,  fileUploadHandler: (nodeId: Id, fileName: string, fileValue: string) => void) {
    ev.preventDefault();

    console.log('drop')

    try {
        const fileData = uploadFiles(ev.dataTransfer);
        if (fileData) {
            const { reader, name } = fileData;
            if (reader) {
                reader.onloadstart = (ev) => console.log('uploading...');
                reader.onprogress = (ev) => {
                    if (ev.lengthComputable) {
                        console.log(`Progress: ${ev.loaded / ev.total}`);
                    }
                }
                reader.onloadend = (ev) => console.log('uploaded!');
                reader.onload = (ev) => {
                    if (typeof reader.result == 'string') {
                        fileUploadHandler(nodeId, name, reader.result);
                    }
                }
            }
        }
        
    } catch (e) {
        return;
    }
}

