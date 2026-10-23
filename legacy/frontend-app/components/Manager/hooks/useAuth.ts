import { useState, useEffect } from 'react';
import {User, Auth0Client, createAuth0Client} from '@auth0/auth0-spa-js';
import { auth0ClientObj } from '../../../constants';
import { AppDispatch } from '@/app/store/store';
import { useDispatch } from 'react-redux';
import { setIsUserDataFetched, setUserInfo } from '@/app/store/features/server/serverSlice';


const userInfo = {
  nickname: 'swervyroad', 
  name: 'swervyroad@gmail.com',
  picture: 'https://s.gravatar.com/avatar/11583835bcb176…tps%3A%2F%2Fcdn.auth0.com%2Favatars%2Fsw.png', 
  updated_at: '2024-09-06T20:47:28.245Z', 
  email: 'swervyroad@gmail.com'
}


export const useAuth = () => {

  const dispatch: AppDispatch = useDispatch()


  const [auth0Client, setAuth0Client] = useState<Auth0Client | null>(null);

  useEffect(() => {
    const initAuth0 = async () => {
      createAuth0Client(auth0ClientObj).then(async (client) => {
        setAuth0Client(client)
        const userProfile = await client.getUser();
        if (userProfile) {
          dispatch(setUserInfo(userProfile))
          console.log(userProfile)
        }
      })

    };
    initAuth0();
  }, []);

  return auth0Client
}

