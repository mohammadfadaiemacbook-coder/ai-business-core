import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    name: config.name || "AI Business Core",
    slug: config.slug || "ai-business-core",
    version: config.version || "2.0.0",
    updates: projectId
      ? { url: "https://u.expo.dev/" + projectId, enabled: true, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 }
      : { enabled: false },
    extra: { ...config.extra, eas: projectId ? { projectId } : undefined }
  };
};
