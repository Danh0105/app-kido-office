export const formatDate = (isoString: string) => {
    if (!isoString) return "";

    const date = new Date(isoString);

    const pad = (n: number) => n.toString().padStart(2, "0");

    return `${pad(date.getHours() + 7)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};