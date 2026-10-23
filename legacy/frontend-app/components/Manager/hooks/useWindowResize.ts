// hooks/useAuth.ts
import workspaceSlice from '@/app/store/features/workspace/workspaceSlice';
import { AppDispatch } from '@/app/store/store';
import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';



export const useWindowResize = () => {

  const dispatch: AppDispatch = useDispatch()


  useEffect(() => {
    const handleResize = () => {
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        dispatch(workspaceSlice.actions.updateWindowSize({width: windowWidth, height: windowHeight}))
    };
  
    // Call the function initially to set the initial size
    handleResize();
  
    window.addEventListener('resize', handleResize);
  
    // Cleanup the event listener on component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []);
};
