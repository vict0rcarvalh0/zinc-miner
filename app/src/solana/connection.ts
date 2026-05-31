import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINT } from '../config/zinc';

let connection: Connection | null = null;

/** Shared, lazily-created RPC connection used across the app. */
export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_ENDPOINT, 'confirmed');
  }
  return connection;
}
