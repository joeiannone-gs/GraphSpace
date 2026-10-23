import * as PIXI from 'pixi.js';

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

function dropHandler(ev: DragEvent, container: PIXI.Container, fileUploadHandler: (name: string, value: string) => void) {
    ev.preventDefault();

    console.log('drop')

    try {
        // Check if the event location falls within the container
        if (container.getBounds().containsPoint(ev.x, ev.y)) {
            // Prevent default behavior (Prevent file from being opened)
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
                            fileUploadHandler(name, reader.result);
                        }
                    }
                }
            }
        }
    } catch (e) {
        return;
    }
}

// export function getDropZoneGraphic(dropIconSprite: PIXI.Sprite) {
//     const container = new PIXI.Container();

//     dropIconSprite.anchor.set(0.5);
//     dropIconSprite.scale.set(0.07);

//     container.addChild(dropIconSprite);
//     container.scale.set(0.5);

//     return container;
// }
