
export const BASE_ADDRESS = 'http://localhost'

export const PORT = "8080"

export const SERVER_ADDRESS = new URL(`${BASE_ADDRESS}:${PORT}`)


export const WEBSOCKET_ADDRESS = `ws://${SERVER_ADDRESS.hostname}:${PORT}`


export const USER_ID = "test_user"

