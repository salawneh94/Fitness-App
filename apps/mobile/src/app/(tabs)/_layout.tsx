import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { LayoutDashboard, Apple, Dumbbell, ListChecks, TrendingUp, UserRound } from 'lucide-react-native';
import { colors } from '@fittrack/shared';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        // Six tabs is a tight row on a 390pt phone — the stock 12pt label left "Plan Ideas"
        // almost touching its neighbours. Smaller, tighter labels and a hairline rule instead
        // of a full border give the bar room to breathe.
        tabBarStyle: {
          backgroundColor: colors.chartSurface,
          borderTopColor: colors.gridline,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.1,
          marginTop: 2,
        },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{ title: 'Nutrition', tabBarIcon: ({ color, size }) => <Apple color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: 'Workouts', tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: 'Plans', tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }}
      />
    </Tabs>
  );
}
