import { Size } from "@/app/types/common";
import React from "react";






export function ThumbnailContainer({size, children}: {size: Size, children: React.ReactNode}) {
    return (
        <div className="modern-scroll" style={{
            width: size[0],
            height: size[1] - 30, //header height (need to make a constant)
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '10px',
            boxSizing: 'border-box',
            alignContent: 'flex-start',
            justifyContent: 'space-evenly' // Added this to space items evenly horizontally
        }}>
            {children}
        </div>
    )
}