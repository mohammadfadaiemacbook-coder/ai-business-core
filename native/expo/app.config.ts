import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    updates: projectId
      ? { url: "https://u.expo.dev/" + projectId, enabled: true, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 }
      : { enabled: false },
    extra: { ...config.extra, eas: projectId ? { projectId } : undefined }
  };
};
