export type ApiKeys = {
  etherscan: string;
  infura: string | { projectId: string; projectSecret: string };
  alchemy: string;
  pocket: string | { applicationId: string; applicationSecretKey: string };
};
