import { setIsAuthenticated, setUserInfo } from '@/app/store/features/server/serverSlice'
import { RootState } from '@/app/store/store'
import logoPNG from '@/public/LogoAndName.png'
import { useCallback, useContext, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ToggleButtons } from './ToggleButtons/ToggleButtons'
import { ServerContext } from '../Manager/Manager'
import { User } from '@auth0/auth0-spa-js'
import { getColoring } from '@/app/services/getColoring'



export const SiteHeader = ({}) => {

    const dispatch = useDispatch()

    //* Selectors
    const darkMode = useSelector((state: RootState) => state.panels.darkMode)
    const userInfo = useSelector((state: RootState) => state.server.userInfo)

    //* React Context
    const auth0Client = useContext(ServerContext).auth0Client

    //* Other
    const darkModeColor = darkMode ? 'black': 'white'
    
    const { siteHeader } = useMemo(() => {
        const coloring = getColoring(darkMode).textColoring;
        const siteHeaderColor = coloring.siteHeader === 0x000000 ? '#000000' : `#${coloring.siteHeader.toString(16)}`;
        return { siteHeader: siteHeaderColor };
    }, [darkMode]);


    // const name = useMemo(() => userInfo.name, [userInfo])
    const name = "TEST"
    // const profileImageLink = userInfo.picture as string

    const logoutClick = useCallback(async (e) => {
        if (!auth0Client) return

        e.preventDefault()
        await auth0Client.logout()
        dispatch(setIsAuthenticated(false))
        dispatch(setUserInfo(null))
    }, [auth0Client, dispatch])



    return (
        <div style={{ width: '100%', height: '7%', backgroundColor: darkModeColor, position: 'absolute', top: 0, left: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <img src={logoPNG.src} alt="Logo" style={{ maxHeight: '70%', marginLeft: '10px' }} />
                <div style={{ marginLeft: '5%' }}> {/* Added div with marginLeft for spacing */}
                    <ToggleButtons />
                </div>

                <div style={{ marginLeft: 'auto', marginRight: '10px', display: 'flex', alignItems: 'center', height: '100%' }}>
                    {/* <img src={profileImageLink} alt="Profile" style={{ maxHeight: '70%', marginRight: '10px', borderRadius: '50%' }} /> */}
                    <span style={{ color: siteHeader, marginRight: '10px' }}>{name}</span>
                    <div style={{ backgroundColor: darkMode ? 'white' : 'black', width: '1px', height: '50%', marginRight: '10px' }}></div>
                    <span style={{ color: siteHeader, cursor: 'pointer' }} onClick={logoutClick}>Logout</span>
                </div>
            </div>
        </div>
    )
}