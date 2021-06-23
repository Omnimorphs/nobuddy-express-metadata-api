import { CollectionContract } from './CollectionContract';

export type TokenCollection = {
  contract: CollectionContract;
  revealTime?: number;
  reservedTokens?: number[];
  tokens: Record<string, Record<string, unknown>>;
};
