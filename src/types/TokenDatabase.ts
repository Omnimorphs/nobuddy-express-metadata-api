import { CollectionContract } from './CollectionContract';

export type TokenDatabase = {
  contract: CollectionContract;
  tokens: Record<string, { metadata: unknown[] }>;
};
