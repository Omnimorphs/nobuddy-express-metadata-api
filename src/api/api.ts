import express from 'express';
import merge from 'lodash/merge';
import { TokenDatabase } from '../types/TokenDatabase';
import { IContractService } from '../types/IContractService';
import { HttpError } from '../errors';
import { ApiConfig } from '../types/ApiConfig';
import defaultApiConfig from './defaultApiConfig';
import ContractService from '../ContractService';
import { Network } from '../types/_';

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

export const defaultRoute = '/nft/:networkName/:tokenId';

export const createWithoutEthers =
  (database: TokenDatabase) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { tokenId } = extractParams(req);

      ensureTokenExists(database, tokenId);
      ensureTokenStateExists(database, tokenId, 0);

      res.json(database.tokens[tokenId].metadata[0]);
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
      const { tokenId, networkName } = extractParams(req);

      ensureDeploymentNetwork(database, networkName);

      ensureTokenExists(database, tokenId);

      const token = database.tokens[tokenId];

      let state;
      try {
        state = await contractService.state(networkName);
      } catch (e) {
        res.status(500).send({
          error: {
            status: 500,
            message: e.message,
          },
        });
        return;
      }

      ensureTokenStateExists(database, tokenId, state);

      res.json(token.metadata[state]);
    } catch (error) {
      res.status(error.status || 500).send({
        error: {
          status: error.status || 500,
          message: error.message || 'Internal Server Error',
        },
      });
    }
  };

export const ensureTokenExists = (
  database: TokenDatabase,
  tokenId: string | number
): void => {
  if (!Array.isArray(database?.tokens?.[tokenId]?.metadata)) {
    throw new HttpError(404, `No token by tokenId ${tokenId}`);
  }
};

export const ensureTokenStateExists = (
  database: TokenDatabase,
  tokenId: string | number,
  state: number
): void => {
  if (!database?.tokens?.[tokenId]?.metadata?.[state]) {
    throw new HttpError(404, `No state ${state} for tokenId ${tokenId}`);
  }
};

export const ensureDeploymentNetwork = (
  database: TokenDatabase,
  networkName: Network
): void => {
  if (!database?.contract?.deployments?.[networkName]) {
    throw new HttpError(
      404,
      `Collection is not deployed to network ${networkName}`
    );
  }
};

export const extractParams = (
  req: express.Request
): { tokenId: number; networkName: string } => ({
  networkName: req.params.networkName,
  tokenId: parseInt(req.params.tokenId),
});
