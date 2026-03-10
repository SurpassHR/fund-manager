/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LATEST_COMMIT_HASH: string
    readonly VITE_COMMITS_JSON: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
