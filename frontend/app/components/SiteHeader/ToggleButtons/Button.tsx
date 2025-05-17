import './ToggleButtons.css'


export const Button = ({onClick, initialVaue}: {onClick: () => void, initialVaue: boolean}) => {


    return (
        <label className="switch">
            <input type="checkbox" onChange={onClick} checked={initialVaue}/>
            <span className="slider round"></span>
        </label>
    )
}


