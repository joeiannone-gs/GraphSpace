import { getTimeStampString } from "../../Panels/CommitHistory/helpers"
import { useEffect, useState } from "react"



export const useTimeStamp = () => {
    const [timestamp, setTimestamp] = useState(getTimeStampString(Math.floor(Date.now() / 1000).toString()))

    //Set timestamp every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setTimestamp(getTimeStampString(Math.floor(Date.now() / 1000).toString()));
        }, 60000); // 60000 milliseconds = 1 minute

        // Clear interval on component unmount
        return () => clearInterval(interval);
    }, []);

    return timestamp
}