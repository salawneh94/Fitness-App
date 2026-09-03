import { TextInput, type TextInputProps } from 'react-native';
import { colors } from '@fittrack/shared';

/** Base styled text input matching the web app's rounded dark input fields. */
export default function TextField({ className = '', style, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      className={`w-full rounded-xl px-4 py-3 text-sm border ${className}`}
      style={[{ backgroundColor: colors.chartSurface, borderColor: colors.gridline, color: colors.textPrimary }, style]}
      {...rest}
    />
  );
}
