/// <reference types="vite/client" />

declare module "*.glsl?raw" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_NASA_API_KEY?: string;
  readonly VITE_JPL_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
