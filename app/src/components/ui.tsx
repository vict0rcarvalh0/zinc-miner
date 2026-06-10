import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, radius, spacing, font, motion, glass, hairline } from '../theme';
import { HudPanel } from './fx/HudPanel';
import { Sheen } from './fx/Sheen';
import { SolanaIcon } from './icons/SolanaIcon';
import { ZincIcon } from './icons/ZincIcon';

export function Card({
  children,
  style,
  index = 0,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Position in a stack — drives the entrance stagger. */
  index?: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(50 + index * 80)
        .springify()
        .damping(18)
        .mass(0.9)}
      style={[styles.cardWrap, style]}
    >
      <HudPanel>{children}</HudPanel>
    </Animated.View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionPrefix}>//</Text>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function StatPill({
  label,
  value,
  accent,
  unit,
}: {
  label: string;
  value: string;
  accent?: string;
  /** Render a unit mark after the value: the real Solana or ZINC logo. */
  unit?: 'sol' | 'zinc';
}) {
  return (
    <Animated.View entering={FadeIn.duration(motion.med)} style={styles.pill}>
      <View style={[styles.pillBar, accent ? { backgroundColor: accent } : null]} />
      <View style={styles.pillBody}>
        <Text style={styles.pillLabel}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.pillValue, accent ? { color: accent } : null]}>
            {value}
          </Text>
          {unit === 'sol' ? <SolanaIcon size={13} /> : null}
          {unit === 'zinc' ? <ZincIcon size={14} /> : null}
        </View>
      </View>
    </Animated.View>
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
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fill =
    tone === 'danger'
      ? 'rgba(248,81,73,0.13)'
      : tone === 'neutral'
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(249,115,21,0.14)';
  const edge = tone === 'danger' ? colors.loss : tone === 'neutral' ? glass.borderDim : colors.accent;
  const fg = tone === 'danger' ? colors.loss : tone === 'neutral' ? colors.text : colors.accent;
  const isAccent = tone === 'accent';

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        onPressIn={() => {
          scale.value = withSpring(0.96, motion.springSnappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
        style={[
          styles.button,
          { backgroundColor: fill, borderColor: edge, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        {/* HUD corner ticks */}
        <View style={[styles.btnTick, styles.btnTL, { borderColor: fg }]} />
        <View style={[styles.btnTick, styles.btnBR, { borderColor: fg }]} />
        {busy ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        )}
        {isAccent && !disabled ? <Sheen period={2800} /> : null}
      </Pressable>
    </Animated.View>
  );
}

export function NumberStepper({
  value,
  onChange,
  step,
  min = 0,
  suffix,
  unit,
  precision = 3,
}: {
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  suffix?: string;
  /** Render a unit mark after the value: the real Solana or ZINC logo. */
  unit?: 'sol' | 'zinc';
  precision?: number;
}) {
  const clamp = (n: number) => Math.max(min, n);
  const num = `${Number(value.toFixed(precision))}`;
  const display = unit ? num : `${num}${suffix ? ` ${suffix}` : ''}`;
  return (
    <View style={styles.stepperRow}>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(clamp(value - step))}
      >
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <View style={styles.stepperValueWrap}>
        <Text style={styles.stepperValue}>{display}</Text>
        {unit === 'sol' ? <SolanaIcon size={15} /> : null}
        {unit === 'zinc' ? <ZincIcon size={16} color={colors.text} /> : null}
      </View>
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
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, motion.springSnappy);
  }, [value, p]);
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * 22 }],
    backgroundColor: interpolateColor(p.value, [0, 1], [colors.textFaint, colors.accent]),
  }));
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <Animated.View style={[styles.knob, knobStyle]} />
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
  cardWrap: { marginBottom: spacing.lg },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionPrefix: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: font.bold,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: hairline,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.semibold,
    marginBottom: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    flexGrow: 1,
    flexBasis: '46%',
    overflow: 'hidden',
  },
  pillBar: { width: 2, backgroundColor: glass.border },
  pillBody: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: font.medium,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  pillValue: {
    color: colors.text,
    fontSize: 18,
    fontFamily: font.bold,
  },
  button: {
    height: 52,
    borderRadius: radius.hud,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: font.black,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  btnTick: { position: 'absolute', width: 9, height: 9 },
  btnTL: { top: 4, left: 4, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  btnBR: { bottom: 4, right: 4, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepperSign: { color: colors.accent, fontSize: 26, fontFamily: font.bold },
  stepperValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stepperValue: {
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    fontFamily: font.bold,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  toggleHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  track: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.borderDim,
  },
  trackOn: { backgroundColor: 'rgba(249,115,21,0.25)' },
  trackOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.textFaint },
  input: {
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    color: colors.text,
    fontSize: 18,
    fontFamily: font.mono,
    paddingHorizontal: spacing.md,
    height: 52,
  },
});
