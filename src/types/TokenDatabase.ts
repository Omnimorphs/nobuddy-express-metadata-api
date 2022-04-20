import { CollectionContract } from './CollectionContract';

export type TokenDatabase = {
  contract: CollectionContract;
  tokens: Record<string, { collectionId: number; metadata: unknown[] }>;
};
