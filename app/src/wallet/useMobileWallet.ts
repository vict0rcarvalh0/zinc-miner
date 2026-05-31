import { useCallback } from 'react';
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
} from '@solana/web3.js';
import { useAuthorization } from './AuthorizationProvider';
import { getConnection } from '../solana/connection';

/**
 * Thin wrapper that assembles a legacy transaction from raw instructions, then
 * signs + submits it through the Seeker wallet over Mobile Wallet Adapter.
 * Returns the confirmed signature.
 */
export function useMobileWallet() {
  const { withAuthorizedWallet } = useAuthorization();

  const sendInstructions = useCallback(
    async (
      buildInstructions: (
        payer: PublicKey,
      ) => Promise<TransactionInstruction[]> | TransactionInstruction[],
    ): Promise<string> => {
      const connection = getConnection();
      return withAuthorizedWallet(async (wallet, account) => {
        const payer = account.publicKey;
        const instructions = await buildInstructions(payer);

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');

        const tx = new Transaction({
          feePayer: payer,
          blockhash,
          lastValidBlockHeight,
        });
        tx.add(...instructions);

        const [signature] = await wallet.signAndSendTransactions({
          transactions: [tx],
        });

        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        return signature;
      });
    },
    [withAuthorizedWallet],
  );

  return { sendInstructions };
}
