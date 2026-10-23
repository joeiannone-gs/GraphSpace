import { WEBSOCKET_ADDRESS, SERVER_ADDRESS } from "./constants";
import { processMessage } from "./response";

import Root from "@/app/proto/compiled"






export function emitWSAndHandle(path: string) {
    const url = `${WEBSOCKET_ADDRESS}/${path}`
    const socket = new WebSocket(url);

    const handleMessage = async (event: MessageEvent<any>) => {
        const buffer = await event.data.arrayBuffer()
        const rawBytes = new Uint8Array(buffer)
        const messageList = Root.MessageList.decode(rawBytes)

        for (let message of messageList.list) {
            processMessage(message)
        }
    }  

    socket.onmessage = (event) => {
        handleMessage(event)
    }

}






export function sendAndHandle( path: string, operation: string = "GET", queryParams?: [string, string][], bodyMessages?: Root.MessageList ) {


    const url = new URL(SERVER_ADDRESS + path);
    queryParams?.forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    let options = {}

    if (bodyMessages && operation === 'POST')  {
        const bytes = Root.MessageList.encode(bodyMessages).finish()

        // Create a Blob from the Uint8Array
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
            
        // Create FormData and append the Blob
        const formData = new FormData();
        formData.append('file', blob);
        options =  {
            body: formData
        }
    }
    
    async function fetchAndProcess() {
        const otherParams = { 
            method: operation,
            ...options
        }
        const response = await fetch(url, otherParams );
        if (!response.ok) {    
            console.error(await response.json())
            throw new Error(`HTTP error! status: ${response.status}`);
            
        }
        
        // Check if response is a byte stream or regular response
        const contentType = response.headers.get("Content-Type");
        const eventType = response.headers.get("X-Event-Type")
        if (response.body && contentType && contentType === "application/octet-stream"  ) {
            if (eventType === "connect") {
                const rawBytes = await response.arrayBuffer()
                const byteArray = new Uint8Array(rawBytes);
                
                const messageList = Root.MessageList.decode(byteArray)
                
                for (let message of messageList.list) {
                    processMessage(message)
                }
                
                return "finished processing messages"
            } else if (eventType == "start") {
                const reader = response.body.getReader();
            
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const message = Root.Wrapper.decode(value)
                    processMessage(message)
                    
                }
                return "event stream ended"
            }

        } else {
            const data = await response.json();
            console.log('Received response:', data);
            return data;
        }
    }
    
    return fetchAndProcess();
}
