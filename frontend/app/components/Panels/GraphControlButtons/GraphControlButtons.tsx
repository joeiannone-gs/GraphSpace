

import playIcon from '@/public/runButtons/PNGs/play.png';
import pauseIcon from '@/public/runButtons/PNGs/pause.png';
import reloadIcon from '@/public/runButtons/PNGs/reload.png';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store/store';
import { useMemo, useState } from 'react';
import { calculateTabsPanel } from '@/app/services/positioningAndSizing';
import { emitPauseGraph, emitResetGraph, emitRunGraph } from '@/app/server/routes/run';

export function GraphControlButtons() {
    const windowSize = useSelector((state: RootState) => state.workspace.windowSize);
    const { pos } = useMemo(() => calculateTabsPanel(windowSize), [windowSize]);

    const buttonStyle = {
        background: 'transparent',
        border: '1px solid #4CAF50',
        borderRadius: '2px',
        padding: '4px',
        margin: '0 2px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        transition: 'all 0.2s'
    };

    const activeButtonStyle = {
        ...buttonStyle,
        background: '#4CAF5033',
        transform: 'scale(0.95)'
    };

    const [activeButton, setActiveButton] = useState<number | null>(null);

    const buttons = [
        { icon: playIcon, alt: 'Play', onClick: emitRunGraph },
        { icon: pauseIcon, alt: 'Pause', onClick: emitPauseGraph },
        { icon: reloadIcon, alt: 'Reload', onClick: emitResetGraph }
    ];

    const handleClick = (index: number, onClick: () => void) => {
        setActiveButton(index);
        onClick();
        setTimeout(() => setActiveButton(null), 200);
    };

    return (
        <div style={{
            position: 'absolute',
            left: pos[0],
            top: pos[1] - 40,
            padding: '4px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center'
        }}>
            {buttons.map((button, index) => (
                <button 
                    key={index}
                    style={activeButton === index ? activeButtonStyle : buttonStyle}
                    onClick={() => handleClick(index, button.onClick)}
                >
                    <img src={button.icon.src} alt={button.alt} style={{maxHeight: '15px'}} />
                </button>
            ))}
        </div>
    );
}