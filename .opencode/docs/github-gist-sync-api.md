# Research: GitHub Gist Sync APIs

Date: 2026-03-19
Confidence: HIGH
Version Context: GitHub REST API (versioned docs; endpoints fetched with `apiVersion=2022-11-28` docs pages)

## Why this is needed

Feature scope requires:

- token verification via GitHub API,
- listing authenticated user's gists,
- creating and updating gists,
- filtering by fixed filename (`fund-manager-sync.json`).

## Official Sources

1. Get authenticated user:
   - https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
2. Gists endpoints (list/create/update):
   - https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#list-gists-for-the-authenticated-user
   - https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#create-a-gist
   - https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#update-a-gist
3. Personal access token management overview:
   - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## Verified API Facts (from official docs)

- `GET /user` can be used to verify authenticated token validity (`200` success, `401` requires authentication).
- `GET /gists` lists authenticated user gists when authorized.
- Gist payload includes `files`, `updated_at`, `description`, `id`, `html_url` and file metadata.
- `POST /gists` creates new gist (`201` expected success).
- `PATCH /gists/{gist_id}` updates existing gist.
- `Accept: application/vnd.github+json` is recommended.
- `X-GitHub-Api-Version` header is documented in examples and should be included for deterministic behavior.

## Important planning constraints from docs

- To read/write gists on user behalf, token permissions/scopes for gist access are required (endpoint-specific requirements differ by token type).
- Gist file content may be truncated for large files; file metadata contains `truncated` and `raw_url` for full retrieval if needed.

## NOT FOUND in official docs

- No single official strict regex for all token string formats found in the fetched docs.
- Therefore, plan should treat local format check as heuristic UX validation and rely on `GET /user` as source-of-truth verification.
