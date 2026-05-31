import React, { useState } from 'react';
import {
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
import { colors, spacing, radius } from './src/theme';
import {
  AuthorizationProvider,
  useAuthorization,
} from './src/wallet/AuthorizationProvider';
import { useZincState } from './src/hooks/useZincState';
import { Header } from './src/components/Header';
import { HomeScreen } from './src/screens/HomeScreen';
import { AutoMineScreen } from './src/screens/AutoMineScreen';
import { SessionScreen } from './src/screens/SessionScreen';

type Tab = 'mine' | 'auto' | 'session';

const TABS: { key: Tab; label: string }[] = [
  { key: 'mine', label: 'Mine' },
  { key: 'auto', label: 'Auto-Miner' },
  { key: 'session', label: 'Session' },
];

function Shell() {
  const { account, connecting, connect, disconnect } = useAuthorization();
  const state = useZincState(account?.publicKey ?? null);
  const [tab, setTab] = useState<Tab>('mine');

  const onConnect = async () => {
    try {
      await connect();
    } catch {
      // User dismissed the wallet sheet or no wallet installed.
    }
  };

  return (
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
          refreshControl={
            <RefreshControl
              refreshing={state.loading}
              onRefresh={state.refresh}
              tintColor={colors.accent}
            />
          }
        >
          {tab === 'mine' && <HomeScreen state={state} />}
          {tab === 'auto' && (
            <AutoMineScreen state={state} connected={account != null} />
          )}
          {tab === 'session' && <SessionScreen state={state} />}

          {state.error ? (
            <Text style={styles.error}>RPC: {state.error}</Text>
          ) : null}
        </ScrollView>

        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
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
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthorizationProvider>
        <Shell />
      </AuthorizationProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  error: { color: colors.loss, fontSize: 12, marginTop: spacing.md },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#04110f' },
});
