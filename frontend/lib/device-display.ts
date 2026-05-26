export interface DeviceLike {
  deviceName?: string;
  deviceType?: string;
  platform?: string;
}

const genericBrowserNames = new Set(["browser", "chrome", "edge", "firefox", "safari", "opera"]);

const normalizePlatform = (platform: string) => {
  const value = platform.trim();

  if (/^win/i.test(value) || value === "Win32") return "Windows";
  if (/^mac/i.test(value) || value === "MacIntel") return "Mac";
  if (/linux/i.test(value)) return "Linux";
  if (/android/i.test(value)) return "Android";
  if (/iphone/i.test(value)) return "iPhone";
  if (/ipad/i.test(value)) return "iPad";
  if (/ios/i.test(value)) return "iOS";
  if (/browser/i.test(value)) return "Browser";

  return value || "Browser";
};

const detectBrowserName = () => {
  if (typeof navigator === "undefined") return "Browser";

  const userAgent = navigator.userAgent;
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent) && !/OPR\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";

  return "Browser";
};

const detectModelName = () => {
  if (typeof navigator === "undefined") return "Browser";

  const userAgent = navigator.userAgent;
  const platform =
    normalizePlatform(
      ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform as string | undefined) ||
      navigator.platform ||
      "",
    );

  const androidMatch = userAgent.match(/Android[\s\d.]*;\s*([^)]+?)\s+Build\//i);
  if (androidMatch?.[1]) {
    return androidMatch[1].trim().replace(/_/g, " ");
  }

  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";

  return platform;
};

export const getBrowserDeviceName = () => {
  const browserName = detectBrowserName();
  const modelName = detectModelName();

  if (modelName === "Browser") {
    return browserName;
  }

  return `${browserName} on ${modelName}`;
};

export const isGenericDeviceName = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (genericBrowserNames.has(normalized)) return true;
  if (/^browser on [a-z0-9 _-]+$/i.test(value)) return true;
  if (/^(chrome|edge|firefox|safari|opera) on [a-z0-9 _-]+$/i.test(value)) return true;
  if (/^[a-z0-9 _-]+ browser$/i.test(value)) return true;
  return false;
};

export const getReadableDeviceName = (device: DeviceLike) => {
  const storedName = String(device.deviceName || "").trim();

  if (!storedName) {
    return normalizePlatform(device.platform || "");
  }

  const genericBrowserMatch = storedName.match(/^(.+)\s+Browser$/i);
  if (device.deviceType === "browser" && genericBrowserMatch) {
    const platform = normalizePlatform(genericBrowserMatch[1] || device.platform || "");
    return `Browser on ${platform}`;
  }

  return storedName;
};

export const getReadablePlatformName = (device: DeviceLike) => {
  const storedName = String(device.deviceName || "").trim();

  if (device.deviceType === "browser" && /^.+\s+Browser$/i.test(storedName)) {
    const platform = storedName.replace(/\s+Browser$/i, "");
    return normalizePlatform(platform);
  }

  return normalizePlatform(device.platform || "");
};
