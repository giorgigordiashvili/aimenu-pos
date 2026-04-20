import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useT } from '@/i18n';
import { colors, typography } from '@/theme/tokens';

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate500,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        },
      }}
    >
      <Tabs.Screen
        name='reservations'
        options={{
          title: t.nav.reservations,
          tabBarIcon: ({ color, size }) => <Ionicons name='calendar' color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name='orders'
        options={{
          title: t.nav.orders,
          tabBarIcon: ({ color, size }) => <Ionicons name='receipt' color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name='tables'
        options={{
          title: t.nav.tables,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='grid-outline' color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name='settings'
        options={{
          title: t.nav.settings,
          tabBarIcon: ({ color, size }) => <Ionicons name='settings' color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
