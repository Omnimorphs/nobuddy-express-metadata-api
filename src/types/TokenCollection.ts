export type TokenCollection = {
  contractAddress: string;
  revealTime?: number;
  reservedTokens?: number[];
  tokens: Record<string, Record<string, unknown>>;
};
