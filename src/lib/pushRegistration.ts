/**
 * Expo push registration for the native POS app. On web this is a no-op:
 * the bell + polling cover it. Needs an EAS projectId (native builds only).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { registerDevice, removeDevice } from "@/api/notifications";

const TOKEN_KEY = "aimenu_pos_push_token";

export async function registerPush(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    const Constants = (await import("expo-constants")).default;
    if (!Device.isDevice) return null;
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Orders",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } })?.eas
        ?.projectId;
    if (!projectId) {
      console.warn("[push] no EAS projectId; skipping registration");
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;
    await registerDevice({
      token,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? "",
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (err) {
    console.warn("[push] registration failed", err);
    return null;
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      await removeDevice(token).catch(() => {});
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // best effort
  }
}

/** Route for a tapped notification's payload. */
export function routeForNotification(data: {
  kind?: string;
  id?: string;
}): string | null {
  if (data.kind === "order" && data.id) return `/orders/${data.id}`;
  if (data.kind === "reservation" && data.id) return `/reservations/${data.id}`;
  if (data.kind === "shift" && data.id) return `/cash/shift/${data.id}`;
  return "/notifications";
}

/** Native only: open the right screen when the user taps a push. */
export async function listenForPushTaps(
  navigate: (path: string) => void,
): Promise<() => void> {
  if (Platform.OS === "web") return () => {};
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          kind?: string;
          id?: string;
        };
        const path = routeForNotification(data ?? {});
        if (path) navigate(path);
      },
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
