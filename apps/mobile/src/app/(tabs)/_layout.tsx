import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
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
        tabBarIconStyle: { marginBottom: 0 },
        // Six labels already fill the row at 10pt, so unbounded Dynamic Type overlaps them into
        // mush. Rendering the label ourselves lets it still grow for people who need it, just
        // not past what the row can hold — the alternative option, tabBarAllowFontScaling:
        // false, would freeze it entirely. (iOS already pins tab labels and offers the
        // large-content viewer on long-press; this is what covers Android, where the stock
        // label scales without limit.)
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={{ color, fontSize: 10, fontWeight: '600', letterSpacing: 0.1, marginTop: 2, textAlign: 'center' }}
          >
            {children}
          </Text>
        ),
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
