"use client"

export const auth0ClientObj = {
    domain: "dev-cd5dimp5piqn3uk6.us.auth0.com",
    clientId: "ZDFeobJjLMuzVnXSmbVCGqiVzZgg7Toc",
    cacheLocation: 'localstorage',
    authorizationParams: {
        redirect_uri: window.location.origin,
        audience: 'https://dev-cd5dimp5piqn3uk6.us.auth0.com/api/v2/'
    }
}