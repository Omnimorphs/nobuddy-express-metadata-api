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
    try {
      const { collectionName, tokenId } = extractParams(req);

      ensureCollectionExists(database, collectionName);

      ensureTokenExists(database, collectionName, tokenId);
      ensureTokenStateExists(database, collectionName, tokenId, 0);
      res.json(database[collectionName].tokens[tokenId][0]);
    } catch (error) {
      res.status(error.status || 500).send({
        error: {
          status: error.status || 500,
          message: error.message || 'Internal Server Error',
        },
      });
    }
  };

export const createWithEthers =
  (database: TokenDatabase, contractService: IContractService) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { collectionName, tokenId, networkName } = extractParams(req);

      ensureCollectionExists(database, collectionName);
      ensureDeploymentNetwork(database, collectionName, networkName);

      const state = await contractService.state(
        collectionName,
        networkName,
        tokenId
      );

      ensureTokenExists(database, collectionName, tokenId);
      ensureTokenStateExists(database, collectionName, tokenId, state);
      res.json(database[collectionName].tokens[tokenId][state]);
    } catch (error) {
      res.status(error.status || 500).send({
        error: {
          status: error.status || 500,
          message: error.message || 'Internal Server Error',
        },
      });
    }
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
  if (!Array.isArray(database[collectionName]?.tokens?.[tokenId])) {
    throw new HttpError(
      404,
      `No token by tokenId ${tokenId} in collection ${collectionName}`
    );
  }
};

export const ensureTokenStateExists = (
  database: TokenDatabase,
  collectionName: Slug,
  tokenId: string | number,
  state: number
): void => {
  if (!database[collectionName]?.tokens?.[tokenId]?.[state]) {
    throw new HttpError(
      404,
      `No state ${state} for tokenId ${tokenId} in collection ${collectionName}`
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
