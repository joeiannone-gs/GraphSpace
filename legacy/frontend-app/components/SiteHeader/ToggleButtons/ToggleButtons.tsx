import { useDispatch, useSelector } from "react-redux"
import './ToggleButtons.css'
import { Button } from "./Button"
import { RootState } from "@/app/store/store"
import { useMemo } from "react"
import { getColoring } from "@/app/services/getColoring"
import { updateDarkMode } from "@/app/store/features/panels/panelsSlice"


export const ToggleButtons = () => {
    const dispatch = useDispatch()

    //* Selectors
    const darkMode = useSelector((state: RootState) => state.panels.darkMode)
    const { siteHeader } = useMemo(() => {
        const coloring = getColoring(darkMode).textColoring;
        const siteHeaderColor = coloring.siteHeader === 0x000000 ? '#000000' : `#${coloring.siteHeader.toString(16)}`;
        return { siteHeader: siteHeaderColor };
    }, [darkMode]);

    return (
            <div style={{ display: 'flex', alignItems: 'center' }}> {/* This div acts as a flex container */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Button onClick={() => dispatch(updateDarkMode(!darkMode))} initialVaue={darkMode} />
                    <span style={{ color: siteHeader, fontSize: '12px', marginLeft: '7px' }}>Dark Mode</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '20px' }}> {/* This div will now be inline with the previous div */}
                    <Button onClick={() => console.log('Console')} initialVaue={false} />
                    <span style={{ color: siteHeader, fontSize: '12px', marginLeft: '7px' }}>Console</span>
                </div>
            </div>
    )
}
