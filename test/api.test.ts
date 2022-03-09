import {
  createWithEthers,
  createWithoutEthers,
  ensureCollectionExists,
  ensureDeploymentNetwork,
  ensureTokenExists,
} from '../src/api/api';
import { TokenDatabase } from '../src/types/TokenDatabase';
import { HttpError } from '../src/errors';
import express from 'express';
import ContractService from '../src/ContractService';
import { mocked } from 'ts-jest';

afterEach(() => jest.clearAllMocks());

const database: TokenDatabase = {
  collection: {
    contract: {
      deployments: {
        lol: {
          address: 'dadsdas',
        },
        lel: {
          address: 'adasdjsadsajd',
        },
      },
    },
    tokens: {
      0: [
        {
          name: 'name0_0',
        },
        {
          name: 'name0_1',
        }
      ],
      2: [
        {
          name: 'name2_0',
        },
        {
          name: 'name2_1',
        },
        {
          name: 'name2_2',
        }
      ]
    },
  }
};

describe('ensureTokenExists', () => {
  it('should do nothing if token exists in the collection', () => {
    expect(() => ensureTokenExists(database, 'collection', 0)).not.toThrow();
  });
  it('should throw if no tokens property is found on collection', () => {
    expect(() =>
      ensureTokenExists(
        { collection: {} } as unknown as TokenDatabase,
        'collection',
        0
      )
    ).toThrow(HttpError);
  });
  it('should throw if token is not found', () => {
    expect(() => ensureTokenExists(database, 'collection', 1)).toThrow(
      HttpError
    );
  });
});

describe('ensureCollectionExists', () => {
  it('should not throw if collection exists', () => {
    expect(() => ensureCollectionExists(database, 'collection')).not.toThrow();
  });
  it('should throw is collection doesnt exist', () => {
    expect(() => ensureCollectionExists(database, 'collection0')).toThrow(
      HttpError
    );
  });
});

describe('ensureDeploymentNetwork', () => {
  it('should not throw if deployment network exists for the collection', () => {
    expect(() =>
      ensureDeploymentNetwork(database, 'collection', 'lol')
    ).not.toThrow();
  });
  it('should throw if deployment network does not exist', () => {
    expect(() =>
      ensureDeploymentNetwork(database, 'collection', 'lal')
    ).toThrow(HttpError);
  });
});

const send = jest.fn();

const res = {
  json: jest.fn(),
  status: jest.fn(() => ({send}))
} as unknown as express.Response;

describe('api handler without ethers', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return the token if it exists', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 0
      },
    } as unknown as express.Request;
    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(database.collection.tokens[0][0]);
  });


  it('it should throw is collection does not exist', async () => {
    const req = {
      params: {
        collectionName: 'collectionLol',
        tokenId: 0,
      },
    } as unknown as express.Request;

    const handler = createWithoutEthers(database);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({
      error: {
        status: 404,
        message: `No such collection: ${req.params.collectionName}`
      }
    });
  });

  it('it should throw if token does not exist', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 5,
      },
    } as unknown as express.Request;

    const handler = createWithoutEthers(database);

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({
      error: {
        status: 404,
        message: `No token by tokenId ${req.params.tokenId} in collection ${req.params.collectionName}`
      }
    });
  });
});

describe('api handler with ethers', () => {
  afterEach(() => jest.clearAllMocks());

  it('should throw if collection does not exist', async () => {
    const req = {
      params: {
        collectionName: 'kfddksdakds',
        tokenId: 2,
        networkName: 'lol',
      },
    } as unknown as express.Request;
    const contractService = {} as unknown as ContractService;

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({
      error: {
        status: 404,
        message: `No such collection: ${req.params.collectionName}`
      }
    });
  });

  it('should throw if contract is not deployed to the network', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 2,
        networkName: 'lal',
      },
    } as unknown as express.Request;
    const contractService = {} as unknown as ContractService;

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({
      error: {
        status: 404,
        message: `Collection ${req.params.collectionName} is not deployed to network ${req.params.networkName}`
      }
    });
  });


  const contractService = {
    state: jest.fn(),
    _stateMap: {
      collection: {
        lol: {
          0: {
            timestamp: 0,
            value: 1
          }
        },
      },
    },
  } as unknown as ContractService;


  it('should return the right metadata for the state', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 0,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.state).mockResolvedValueOnce(1);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(database.collection.tokens[0][1]);
  });


  it('should throw if tokenId is not found', async () => {
    const req = {
      params: {
        collectionName: 'collection',
        tokenId: 3,
        networkName: 'lol',
      },
    } as unknown as express.Request;

    mocked(contractService.state).mockResolvedValueOnce(1);

    const handler = createWithEthers(database, contractService);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({
      error: {
        status: 404,
        message: `No token by tokenId ${req.params.tokenId} in collection ${req.params.collectionName}`
      }
    });
  });
});
