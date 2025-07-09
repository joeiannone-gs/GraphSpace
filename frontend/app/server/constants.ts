
// export const BASE_ADDRESS = 'http://localhost'
export const BASE_ADDRESS = 'https://54.187.246.153/api/'

// export const PORT = "8080"

export const SERVER_ADDRESS = new URL(`${BASE_ADDRESS}`)


export const WEBSOCKET_ADDRESS = `wss://${SERVER_ADDRESS.hostname}`


export const USER_ID = "test_user"

