import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  useFonts,
  Oxanium_400Regular,
  Oxanium_500Medium,
  Oxanium_600SemiBold,
  Oxanium_700Bold,
  Oxanium_800ExtraBold,
} from '@expo-google-fonts/oxanium';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, font, gradients, motion, glass } from './src/theme';
import {
  AuthorizationProvider,
  useAuthorization,
} from './src/wallet/AuthorizationProvider';
import { useZincState } from './src/hooks/useZincState';
import { ScreenBackground } from './src/components/fx/ScreenBackground';
import { Sheen } from './src/components/fx/Sheen';
import { Header } from './src/components/Header';
import { HomeScreen } from './src/screens/HomeScreen';
import { AutoMineScreen } from './src/screens/AutoMineScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import { StatsScreen } from './src/screens/StatsScreen';

type Tab = 'mine' | 'stats' | 'auto' | 'session';

const TABS: { key: Tab; label: string }[] = [
  { key: 'mine', label: 'Mine' },
  { key: 'stats', label: 'Trends' },
  { key: 'auto', label: 'Auto' },
  { key: 'session', label: 'Session' },
];

function Shell() {
  const { account, connecting, connect, disconnect } = useAuthorization();
  const state = useZincState(account?.publicKey ?? null);
  const [tab, setTab] = useState<Tab>('mine');
  const [tabBarW, setTabBarW] = useState(0);
  const activeIndex = TABS.findIndex((t) => t.key === tab);
  const segW = tabBarW > 0 ? (tabBarW - 8) / TABS.length : 0;

  const indX = useSharedValue(0);
  useEffect(() => {
    if (segW > 0) indX.value = withSpring(activeIndex * segW, motion.spring);
  }, [activeIndex, segW, indX]);
  const indStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indX.value }] }));

  const onConnect = async () => {
    try {
      await connect();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Surface the real failure instead of looking like a dead button.
      // Common causes: no MWA-compatible wallet installed, or the user
      // dismissed the authorization sheet.
      Alert.alert(
        'Could not connect wallet',
        /found no installed wallet|no wallet|association/i.test(message)
          ? 'No Mobile Wallet Adapter wallet was found. On Seeker use the Seed Vault wallet; on other devices install Phantom or Solflare.'
          : message,
      );
    }
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <Header
            address={account?.publicKey.toBase58() ?? null}
            connecting={connecting}
            onConnect={onConnect}
            onDisconnect={disconnect}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={state.loading}
                onRefresh={state.refresh}
                tintColor={colors.accent}
              />
            }
          >
            {/* Re-keyed per tab so each switch plays a quick slide-in. */}
            <Animated.View key={tab} entering={FadeInRight.duration(motion.med)}>
              {tab === 'mine' && <HomeScreen state={state} />}
              {tab === 'stats' && <StatsScreen state={state} />}
              {tab === 'auto' && (
                <AutoMineScreen state={state} connected={account != null} />
              )}
              {tab === 'session' && <SessionScreen state={state} />}
            </Animated.View>

            {state.error ? (
              <Text style={styles.error}>RPC: {state.error}</Text>
            ) : null}
          </ScrollView>

          <View
            style={styles.tabBar}
            onLayout={(e) => setTabBarW(e.nativeEvent.layout.width)}
          >
            {/* Sliding machined-orange indicator behind the active tab. */}
            {segW > 0 ? (
              <Animated.View style={[styles.tabIndicator, { width: segW }, indStyle]}>
                <LinearGradient
                  colors={gradients.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Sheen period={3200} />
              </Animated.View>
            ) : null}
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  style={styles.tab}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    </ScreenBackground>
  );
}

// Make Oxanium the app-wide default so every screen adopts the ZINC typeface.
// RN doesn't synthesize weights for custom fonts, so styles that need a heavier
// cut reference font.bold / font.black explicitly; everything else inherits
// Oxanium Regular from here.
const TextAny = Text as unknown as {
  defaultProps?: { style?: unknown };
};
TextAny.defaultProps = TextAny.defaultProps ?? {};
TextAny.defaultProps.style = [
  { fontFamily: font.regular },
  TextAny.defaultProps.style,
];

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Oxanium_400Regular,
    Oxanium_500Medium,
    Oxanium_600SemiBold,
    Oxanium_700Bold,
    Oxanium_800ExtraBold,
  });

  // Hold on the black canvas only while fonts are actively loading. If loading
  // FAILS (fontError), render anyway — Oxanium falls back to the system font
  // rather than leaving the user stuck on a permanent black screen.
  if (!fontsLoaded && !fontError) {
    return <View style={styles.boot} />;
  }

  return (
    <SafeAreaProvider>
      <AuthorizationProvider>
        <Shell />
      </AuthorizationProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  error: { color: colors.loss, fontSize: 12, marginTop: spacing.md, fontFamily: font.mono },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: glass.fillStrong,
    borderColor: glass.border,
    borderWidth: 1,
    borderRadius: radius.hud,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radius.hud - 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.hud,
    alignItems: 'center',
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: font.bold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  tabTextActive: { color: colors.onAccent, fontFamily: font.black },
});
