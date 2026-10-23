"use client"
import './style.css'
import { useState, useCallback, createContext } from 'react'
import * as auth0 from '@auth0/auth0-spa-js'
import { useSelector, useDispatch } from 'react-redux'
import { setIsAuthenticated } from '../../store/features/server/serverSlice'
import { AppDispatch, RootState } from '@/app/store/store'
import workspaceSlice from '@/app/store/features/workspace/workspaceSlice'

// Components
import { PreLogin } from './PreLogin'
import { SiteHeader } from '../SiteHeader/SiteHeader'
import { Workspace } from '../Workspace/Workspace'
import { SelectionMenu } from '../overlays/SelectionMenu'
import { RightClickMenu } from '../overlays/RightClickMenu'
import { MyGraphSpace } from '../Panels/MyGraphSpace/MyGraphSpace'
import { HUB } from '../Panels/HUB/HUB'
import { Info } from '../Panels/Info/Info'
import { CommitHistory } from '../Panels/CommitHistory/CommitHistory'
import { Tabs } from '../Panels/Tabs/Tabs'
import { TooltipBox } from '../overlays/InfoBox'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useSocketMiddleware } from './hooks/useSocketMiddleware'
import { useWindowResize } from './hooks/useWindowResize'
import { useSaveInterval } from './hooks/useSaveInterval'
import { TopText } from '../overlays/TopText'
import { GraphControlButtons } from '../Panels/GraphControlButtons/GraphControlButtons'
import { usePixiAssets } from './hooks/usePixiAssets'
import { useInitialize } from './hooks/useInitialize'

//React Context because redux does not allow non-serializable values
export const ServerContext = createContext({
  auth0Client: null as null | auth0.Auth0Client,
});





const Manager = () => {

  const dispatch: AppDispatch = useDispatch()

  useWindowResize();

  //* Selectors
  const isAuthenticated = useSelector((state: RootState) => state.server.isAuthenticated)
  const isUserDataFetched = useSelector((state: RootState) => state.server.isUserDataFetched)

  //* Component State
  const [message, setMessage] = useState('')

  //Hooks
  // const auth0Client = useAuth() 
  useSaveInterval()
  const { isLoading, error } = usePixiAssets()
  useInitialize()

  //Auth0 login pipeline
  const loginClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    // if (!auth0Client) return

    //TEMP MEASURE TO CUT OUT AUTH
    // dispatchSetIsAuthenticated(true)
    // await auth0Client.loginWithPopup()


    dispatch(setIsAuthenticated(true))


    // try {
    //   e.preventDefault()
    //   await auth0Client.loginWithPopup()
    //   const auth = await auth0Client.isAuthenticated()
    //   if (auth) {
    //       console.log('authenticated')
    //       dispatch(setIsAuthenticated(true))
    //   }
    // } catch (error) {
    //   const message = (error as Error).message;
    //   setMessage(`Error: ${message}`)
    //   setTimeout(() => {
    //     auth0Client.logout().catch(error => {
    //       console.error('Logout failed:', error);
    //     });
    //   }, 5000);
    // }
  }, [])



  // return (
  //   (isAuthenticated && isUserDataFetched && ( !isLoading && !error)) ? (
  //   <div id='manager' tabIndex={-1}>
  //     <ServerContext.Provider value={{auth0Client}}>


  //       <SiteHeader />
  //       <Workspace />
  //       <TopText />

  //       {/* Overlay Pop-ups */}
  //       <TooltipBox />
  //       <SelectionMenu />
  //       <RightClickMenu />

  //       {/* Panels */}
  //       <MyGraphSpace />
  //       <HUB />
  //       <Info />
  //       <CommitHistory />
  //       <Tabs />
  //       <GraphControlButtons />

  //     </ServerContext.Provider>
  //   </div>
  //   ) : (
  //     <PreLogin message={message} loginClick={loginClick} />
  //   )
  // )
  return (
    (!isLoading && !error) ? (

    <div id='manager' tabIndex={-1}>
    
    
    <SiteHeader />
    <Workspace />
           <TopText />
  
           {/* Overlay Pop-ups */}
           <TooltipBox />
           <SelectionMenu />
           <RightClickMenu />
  
           {/* Panels */}
           <MyGraphSpace />
           <HUB />
           <Info />
           <CommitHistory />
           <Tabs />
           <GraphControlButtons />
  
       </div>
  ) : <></>
)
}



export default Manager
