import { CollectionContract } from './CollectionContract';

export type TokenCollection = {
  contract: CollectionContract;
  tokens: Record<string, Record<string, unknown>[]>;
};
