/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEISHU_APP_ID?: string
  readonly VITE_FEISHU_APP_SECRET?: string
  readonly VITE_ZHIPU_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
