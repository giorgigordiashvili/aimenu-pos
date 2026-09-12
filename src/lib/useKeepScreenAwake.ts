import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Keep the display on while a screen is mounted.
 *
 * expo-keep-awake's own hook throws on web when the tab is not visible at
 * mount time (the Wake Lock API refuses hidden pages), so this wrapper
 * swallows failures and re-requests the lock whenever the tab becomes
 * visible again -- browsers release it automatically on hide.
 */
export function useKeepScreenAwake(tag: string): void {
  useEffect(() => {
    const request = () => {
      if (
        Platform.OS === "web" &&
        typeof document !== "undefined" &&
        document.hidden
      )
        return;
      activateKeepAwakeAsync(tag).catch(() => {});
    };
    request();
    const onVisibility = () => {
      if (!document.hidden) request();
    };
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [tag]);
}
