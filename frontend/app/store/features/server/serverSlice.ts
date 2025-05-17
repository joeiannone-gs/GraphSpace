import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ServerState } from './types';
import { User } from '@auth0/auth0-spa-js';



const initialState: ServerState = {
    isAuthenticated: false,
    isSocketConnected: false,
    isUserDataFetched: false,
    userInfo: null,
};

export const serverSlice = createSlice({
    name: "server",
    initialState,
    reducers: {
        setIsAuthenticated: (state, action: PayloadAction<boolean>) => {
            state.isAuthenticated = action.payload;
        },
        setUserInfo: (state, action: PayloadAction<User>) => { 
            state.userInfo = action.payload;
        },
        setIsUserDataFetched: (state, action: PayloadAction<boolean>) => {
            state.isUserDataFetched = action.payload;
        },
        setIsSocketConnected: (state, action: PayloadAction<boolean>) => {
            state.isSocketConnected = action.payload;
        }
    }
})

export const { setIsAuthenticated, setUserInfo, setIsUserDataFetched, setIsSocketConnected} =  serverSlice.actions
export default serverSlice

