/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LATEST_COMMIT_HASH: string
    readonly VITE_LATEST_COMMIT_SUBJECT_ZH: string
    readonly VITE_LATEST_COMMIT_SUBJECT_EN: string
    readonly VITE_LATEST_COMMIT_BODY_ZH: string
    readonly VITE_LATEST_COMMIT_BODY_EN: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
