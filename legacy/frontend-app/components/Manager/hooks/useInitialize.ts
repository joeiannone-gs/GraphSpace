import { emitConnect } from '@/app/server/routes/connect';
import { setIsUserDataFetched } from '@/app/store/features/server/serverSlice';
import store from '@/app/store/store';
import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';


export const useInitialize = () => {

  const hasConnectedRef = useRef(false);

  
  useEffect(() => {    

    const initializeApp = async () => {
      if (!hasConnectedRef.current) {
        await emitConnect();
        store.dispatch(setIsUserDataFetched(true));
        
        hasConnectedRef.current = true;
      }
    };
    
    initializeApp();

    // Cleanup function
    return () => {
      console.log('Component cleanup');
    };
  }, []);
};
