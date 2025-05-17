import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/app/store/store';
import { emitDeltas } from '@/app/server/routes/projects';






const INTERVAL = 5000


/**
 * This syncs up the server and client graphs (the current save)
 * once confirmed, 'saving...' -> 'saved'
 */
export const useSaveInterval = () => {
    const dispatch: AppDispatch = useDispatch();
    
    useEffect(() => {
        const interval = setInterval(() => {
            //Update graph with deltas
            emitDeltas()
            //Update project
            // emitSaveProject()
        }, INTERVAL);

        return () => clearInterval(interval);
    }, [dispatch]);

}