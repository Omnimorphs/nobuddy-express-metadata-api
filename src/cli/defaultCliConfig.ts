import { CliConfig } from '../types/CliConfig';

const config: CliConfig = {
  upload: {
    filesToMetadataKeys: {
      image: /^\.(png|jpg|jpeg|svg)$/,
      animation_url: /^\.(gltf|glb|webm|mp4|m4v|ogv|ogg)$/,
    },
  },
};

export default config;
