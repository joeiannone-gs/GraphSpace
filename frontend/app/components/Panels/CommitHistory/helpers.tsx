
export const getTimeStampString = (unixTimeStamp: string) => {
    return new Date(parseInt(unixTimeStamp) * 1000).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    });
}
