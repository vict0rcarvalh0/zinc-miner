import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, font } from '../theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  busy,
  tone = 'accent',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'accent' | 'danger' | 'neutral';
}) {
  const bg =
    tone === 'danger'
      ? colors.loss
      : tone === 'neutral'
        ? colors.surfaceAlt
        : colors.accent;
  const fg = tone === 'neutral' ? colors.text : '#04110f';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function NumberStepper({
  value,
  onChange,
  step,
  min = 0,
  suffix,
  precision = 3,
}: {
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  suffix?: string;
  precision?: number;
}) {
  const clamp = (n: number) => Math.max(min, n);
  const display = `${Number(value.toFixed(precision))}${suffix ? ` ${suffix}` : ''}`;
  return (
    <View style={styles.stepperRow}>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(clamp(value - step))}
      >
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{display}</Text>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(clamp(value + step))}
      >
        <Text style={styles.stepperSign}>+</Text>
      </Pressable>
    </View>
  );
}

export function Toggle({
  value,
  onChange,
  label,
  hint,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  );
}

export function FieldInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'numeric',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'numeric' | 'default';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      keyboardType={keyboardType}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  pill: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexGrow: 1,
    flexBasis: '46%',
  },
  pillLabel: {
    color: colors.textFaint,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pillValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: font.mono,
  },
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  stepperSign: { color: colors.accent, fontSize: 26, fontWeight: '700' },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: font.mono,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  toggleHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  track: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.accentDim },
  trackOff: { backgroundColor: colors.surfaceAlt },
  knob: { width: 24, height: 24, borderRadius: 12 },
  knobOn: { backgroundColor: colors.accent, alignSelf: 'flex-end' },
  knobOff: { backgroundColor: colors.textFaint, alignSelf: 'flex-start' },
  input: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 18,
    fontFamily: font.mono,
    paddingHorizontal: spacing.md,
    height: 52,
  },
});
