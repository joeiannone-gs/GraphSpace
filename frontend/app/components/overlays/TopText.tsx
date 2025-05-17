import { useSelector } from "react-redux";
import { RootState } from "@/app/store/store";

export const TopText = () => {
    const text = useSelector((state: RootState) => state.panels.topWorkspaceText);

    if (!text) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: '#808080',
            color: 'white',
            borderRadius: '8px',
            fontSize: '16px'
        }}>
            {text}
        </div>
    );
};
