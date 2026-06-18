import { Browser } from "@capacitor/browser";

export const downloadAndInstallApk = async (
    url: string,
    onProgress?: (percent: number) => void
) => {
    try {
        // fake progress cho UI
        let progress = 0;

        const interval = setInterval(() => {
            progress += 10;
            if (progress <= 90) {
                onProgress?.(progress);
            }
        }, 200);

        await Browser.open({ url });

        clearInterval(interval);
        onProgress?.(100);

        return true;
    } catch (err: any) {
        throw err;
    }
};