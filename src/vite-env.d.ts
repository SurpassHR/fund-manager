/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LATEST_COMMIT_HASH: string
    readonly VITE_LATEST_COMMIT_SUBJECT: string
    readonly VITE_LATEST_COMMIT_BODY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
