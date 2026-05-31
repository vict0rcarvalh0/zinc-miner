import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  transact,
  type Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import type {
  AuthorizationResult,
  AuthToken,
} from '@solana-mobile/mobile-wallet-adapter-protocol';
import { APP_IDENTITY, MWA_CHAIN } from '../config/zinc';

const STORAGE_KEY = 'zinc.auth.v1';

export type Account = {
  publicKey: PublicKey;
  label?: string;
};

type StoredAuth = {
  authToken: AuthToken;
  address: string; // base64, as returned by MWA
  label?: string;
};

type AuthorizationContextType = {
  account: Account | null;
  authToken: AuthToken | null;
  connecting: boolean;
  connect: () => Promise<Account>;
  disconnect: () => Promise<void>;
  /** Runs work inside an authorized MWA session, reauthorizing if needed. */
  withAuthorizedWallet: <T>(
    body: (wallet: Web3MobileWallet, account: Account) => Promise<T>,
  ) => Promise<T>;
};

const AuthorizationContext = createContext<AuthorizationContextType | null>(
  null,
);

function accountFromAddress(address: string, label?: string): Account {
  // MWA returns account addresses as base64-encoded raw bytes.
  return { publicKey: new PublicKey(Uint8Array.from(Buffer.from(address, 'base64'))), label };
}

export function AuthorizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stored, setStored] = useState<StoredAuth | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Rehydrate a cached authorization so repeat launches skip the approval sheet.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setStored(JSON.parse(raw) as StoredAuth);
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback(async (next: StoredAuth | null) => {
    setStored(next);
    if (next) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleAuthResult = useCallback(
    async (result: AuthorizationResult): Promise<Account> => {
      const first = result.accounts[0];
      const next: StoredAuth = {
        authToken: result.auth_token,
        address: first.address,
        label: first.label,
      };
      await persist(next);
      return accountFromAddress(next.address, next.label);
    },
    [persist],
  );

  const connect = useCallback(async (): Promise<Account> => {
    setConnecting(true);
    try {
      return await transact(async (wallet) => {
        const result = await wallet.authorize({
          chain: MWA_CHAIN,
          identity: APP_IDENTITY,
          auth_token: stored?.authToken,
        });
        return handleAuthResult(result);
      });
    } finally {
      setConnecting(false);
    }
  }, [handleAuthResult, stored?.authToken]);

  const disconnect = useCallback(async () => {
    const token = stored?.authToken;
    await persist(null);
    if (token) {
      try {
        await transact(async (wallet) => {
          await wallet.deauthorize({ auth_token: token });
        });
      } catch {
        // Best-effort; local state is already cleared.
      }
    }
  }, [persist, stored?.authToken]);

  const withAuthorizedWallet = useCallback(
    async <T,>(
      body: (wallet: Web3MobileWallet, account: Account) => Promise<T>,
    ): Promise<T> => {
      return transact(async (wallet) => {
        const result = await wallet.authorize({
          chain: MWA_CHAIN,
          identity: APP_IDENTITY,
          auth_token: stored?.authToken,
        });
        const account = await handleAuthResult(result);
        return body(wallet, account);
      });
    },
    [handleAuthResult, stored?.authToken],
  );

  const account = useMemo(
    () => (stored ? accountFromAddress(stored.address, stored.label) : null),
    [stored],
  );

  const value = useMemo<AuthorizationContextType>(
    () => ({
      account,
      authToken: stored?.authToken ?? null,
      connecting,
      connect,
      disconnect,
      withAuthorizedWallet,
    }),
    [account, stored?.authToken, connecting, connect, disconnect, withAuthorizedWallet],
  );

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  );
}

export function useAuthorization(): AuthorizationContextType {
  const ctx = useContext(AuthorizationContext);
  if (!ctx) {
    throw new Error('useAuthorization must be used within AuthorizationProvider');
  }
  return ctx;
}
