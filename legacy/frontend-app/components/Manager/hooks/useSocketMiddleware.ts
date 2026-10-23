import { useState, useEffect, useCallback, useRef } from 'react';
import * as auth0 from '@auth0/auth0-spa-js';
import { setIsSocketConnected } from '@/app/store/features/server/serverSlice';
import { AppDispatch, RootState } from '@/app/store/store';
import { useDispatch, useSelector } from 'react-redux';
import socket from '@/app/server/Socket'


export const useSocketMiddleware = (auth0Client: auth0.Auth0Client | null, callBack: () => void ) => {

  const dispatch: AppDispatch = useDispatch()

  const isAuthenticated = useSelector((state: RootState) => state.server.isAuthenticated)


  useEffect(() => {

    if (!auth0Client || !isAuthenticated) return

    const fetchTokenAndCreateSocket = async () => {
      try {
        const token = await auth0Client.getTokenSilently();
        socket.createSocket(token)
        dispatch(setIsSocketConnected(true))
      } catch (error) {
        console.error("Error fetching token or creating socket:", error);
      }
    };
  
    fetchTokenAndCreateSocket();
  }, [auth0Client, isAuthenticated]);
}

