import { useEffect, useState } from "react";
import { getVersion } from "@/service/version.api";
import { isNewerVersion } from "./version";
import { App as CapApp } from "@capacitor/app";

export const useCheckUpdate = () => {
    const [updateData, setUpdateData] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;

        const check = async () => {
            try {
                const info = await CapApp.getInfo();
                const localVersion = normalizeVersion(info.version);

                const data = await getVersion();
                const serverVersion = normalizeVersion(data.version);

                if (isNewerVersion(serverVersion, localVersion)) {
                    if (isMounted) setUpdateData(data);
                }
            } catch (err) {
                console.log("Check update error", err);
            }
        };

        check();

        return () => {
            isMounted = false;
        };
    }, []);

    return updateData;
};

// 🔥 normalize version cực quan trọng
const normalizeVersion = (v: string) => {
    return v.split(" ")[0]; // remove "(100)"
};