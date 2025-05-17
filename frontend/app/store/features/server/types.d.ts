import { User } from "@auth0/auth0-spa-js";





export interface ServerState {
    isAuthenticated: boolean;
    isUserDataFetched: boolean;
    userInfo: User | null ;
    isSocketConnected: boolean;
}

