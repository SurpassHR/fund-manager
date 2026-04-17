/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LATEST_COMMIT_HASH: string
    readonly VITE_COMMITS_JSON: string
    readonly VITE_PRESENCE_WORKER_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
