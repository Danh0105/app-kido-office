import { Capacitor } from "@capacitor/core";

export const getDeviceType = () => {
  if (Capacitor.isNativePlatform()) {
    return "mobile_app";
  }

  const isMobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobileBrowser) {
    return "mobile_web";
  }

  return "desktop_web";
};
