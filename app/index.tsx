import { Redirect } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { firstTabFor } from "@/lib/roleTabs";

export default function Index() {
  const { isAuthenticated, currentRestaurant, restaurantsLoaded } = useAuth();
  // AuthGate handles the signed-out / no-restaurant cases and shows the splash.
  if (isAuthenticated && !restaurantsLoaded) return null;
  return <Redirect href={firstTabFor(currentRestaurant)} />;
}
