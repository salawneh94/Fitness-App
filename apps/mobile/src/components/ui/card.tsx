import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { colors } from '@fittrack/shared';

export default function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-3xl p-5 border ${className}`}
      style={{ backgroundColor: colors.chartSurface, borderColor: colors.gridline }}
    >
      {(title || action) && (
        <View className="flex-row items-center justify-between mb-4">
          {title && (
            <Text className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              {title}
            </Text>
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}
