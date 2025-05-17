import { Pos } from '@/app/types/common';
import React from 'react';

interface MenuComponentProps {
    options: string[];
    optionHandler: (option: string) => void;
    pos: Pos
    onClose: () => void;
}
const optionStyle = {
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 10,
    cursor: 'pointer'
};

export const Menu: React.FC<MenuComponentProps> = ({ options, optionHandler, pos, onClose }) => {
    const width = 200;
    const offset = -10;


    return (
        <div style={{
                position: 'fixed',
                left: pos[0] + offset,
                top: pos[1] + offset,
                width,
                backgroundColor: 'white',
                borderRadius: 2,
            }} 
            onPointerLeave={onClose} >
            {options.map((option, index) => (
                <div
                    key={option}
                    style={optionStyle}
                    onClick={() => optionHandler(option)}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.3'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                >
                    {option}
                </div>
            ))}
        </div>
    );
};
