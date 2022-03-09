import { CollectionContract } from './CollectionContract';

export type TokenDatabase = {
  contract: CollectionContract;
  tokens: Record<string, { collectionIndex: number; metadata: unknown[] }>;
};
