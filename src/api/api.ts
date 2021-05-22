import express from 'express';
import { TokenDatabase } from '../types/TokenDatabase';
import { IContractService } from '../types/IContractService';
import { HttpError } from '../errors';
import { ApiConfig } from '../types/ApiConfig';
import defaultApiConfig from './defaultApiConfig';
import ContractService from '../ContractService';

export const api = async (
  database: TokenDatabase,
  userConfig: Partial<ApiConfig> = {}
): Promise<(req: express.Request, res: express.Response) => Promise<void>> => {
  const config = { ...defaultApiConfig, ...userConfig };

  if (config.web3) {
    const contractService = new ContractService(database, config.web3);
    await contractService.waitForWeb3Connection();
    return createWithWeb3(database, contractService);
  }

  return createWithoutWeb3(database);
};

export const defaultRoute = '/token/:collectionName/:tokenId';

export const createWithoutWeb3 =
  (database: TokenDatabase) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    const { collectionName, tokenId } = extractParams(req);

    ensureCollectionExists(database, collectionName);

    if (
      isCollectionRevealed(database, collectionName) &&
      !isTokenReserved(database, collectionName, tokenId)
    ) {
      ensureTokenExists(database, collectionName, tokenId);
      res.json(database[collectionName].tokens[tokenId]);
    } else {
      ensureTokenExists(database, collectionName, 'placeholder');
      res.json(database[collectionName].tokens.placeholder);
    }
  };

export const createWithWeb3 =
  (database: TokenDatabase, contractService: IContractService) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    const { collectionName, tokenId } = extractParams(req);
    let totalSupply;
    try {
      totalSupply = await contractService.getTotalSupply(collectionName);
    } catch (e) {
      console.error(e);
      totalSupply = contractService.totalSupplyMap[collectionName];
    }

    ensureCollectionExists(database, collectionName);

    if (
      isCollectionRevealed(database, collectionName) &&
      !isTokenReserved(database, collectionName, tokenId) &&
      totalSupply > tokenId
    ) {
      ensureTokenExists(database, collectionName, tokenId);
      res.json(database[collectionName].tokens[tokenId]);
    } else {
      ensureTokenExists(database, collectionName, 'placeholder');
      res.json(database[collectionName].tokens.placeholder);
    }
  };

export const isCollectionRevealed = (
  database: TokenDatabase,
  collectionName: string
): boolean => {
  return Boolean(
    typeof database[collectionName].revealTime ||
      (database[collectionName].revealTime as number) <= Date.now()
  );
};

export const isTokenReserved = (
  database: TokenDatabase,
  collectionName: string,
  tokenId: number
): boolean => {
  return Boolean(
    database[collectionName].reservedTokens &&
      database[collectionName].reservedTokens?.includes(tokenId)
  );
};

export const ensureCollectionExists = (
  database: TokenDatabase,
  collectionName: string
): void => {
  if (!database[collectionName]) {
    throw new HttpError(404, `No such collection: ${collectionName}`);
  }
};

export const ensureTokenExists = (
  database: TokenDatabase,
  collectionName: string,
  tokenId: string | number
): void => {
  if (!database[collectionName].tokens[tokenId]) {
    throw new HttpError(
      404,
      `No token by tokenId ${tokenId} in collection ${collectionName}`
    );
  }
};

export const extractParams = (
  req: express.Request
): { collectionName: string; tokenId: number } => ({
  collectionName: req.params.collection,
  tokenId: parseInt(req.params.tokenId),
});
