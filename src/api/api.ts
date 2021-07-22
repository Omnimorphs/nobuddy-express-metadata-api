import express from 'express';
import merge from 'lodash/merge';
import { TokenDatabase } from '../types/TokenDatabase';
import { IContractService } from '../types/IContractService';
import { HttpError } from '../errors';
import { ApiConfig } from '../types/ApiConfig';
import defaultApiConfig from './defaultApiConfig';
import ContractService from '../ContractService';
import { Network, Slug } from '../types/_';

export type ApiObject = {
  handler: (req: express.Request, res: express.Response) => Promise<void>;
  contractService?: ContractService;
};

export const api = (
  database: TokenDatabase,
  userConfig: Partial<ApiConfig> = {}
): ApiObject => {
  const config = merge(defaultApiConfig, userConfig);

  if (config.ethers) {
    const contractService = new ContractService(database, config);
    return {
      handler: createWithEthers(database, contractService),
      contractService,
    };
  }

  return {
    handler: createWithoutEthers(database),
  };
};

export const defaultRoute = '/nft/:networkName/:collectionName/:tokenId';

export const createWithoutEthers =
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

export const createWithEthers =
  (database: TokenDatabase, contractService: IContractService) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    const { collectionName, tokenId, networkName } = extractParams(req);

    ensureCollectionExists(database, collectionName);
    ensureDeploymentNetwork(database, collectionName, networkName);

    let totalSupply: number;
    try {
      totalSupply = await contractService.getTotalSupply(
        collectionName,
        networkName
      );
    } catch (e) {
      console.error(e);
      totalSupply =
        contractService.totalSupplyMap[collectionName][networkName] || 0;
    }

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
  collectionName: Slug
): boolean => {
  return Boolean(
    !database[collectionName].revealTime ||
      (database[collectionName].revealTime as number) <= Date.now()
  );
};

export const isTokenReserved = (
  database: TokenDatabase,
  collectionName: Slug,
  tokenId: number
): boolean => {
  return Boolean(database[collectionName]?.reservedTokens?.includes(tokenId));
};

export const ensureCollectionExists = (
  database: TokenDatabase,
  collectionName: Slug
): void => {
  if (!database[collectionName]) {
    throw new HttpError(404, `No such collection: ${collectionName}`);
  }
};

export const ensureTokenExists = (
  database: TokenDatabase,
  collectionName: Slug,
  tokenId: string | number
): void => {
  if (!database[collectionName]?.tokens?.[tokenId]) {
    throw new HttpError(
      404,
      `No token by tokenId ${tokenId} in collection ${collectionName}`
    );
  }
};

export const ensureDeploymentNetwork = (
  database: TokenDatabase,
  collectionName: Slug,
  networkName: Network
): void => {
  if (!database[collectionName]?.contract?.deployments?.[networkName]) {
    throw new HttpError(
      404,
      `Collection ${collectionName} is not deployed to network ${networkName}`
    );
  }
};

export const extractParams = (
  req: express.Request
): { collectionName: string; tokenId: number; networkName: string } => ({
  networkName: req.params.networkName,
  collectionName: req.params.collectionName,
  tokenId: parseInt(req.params.tokenId),
});
