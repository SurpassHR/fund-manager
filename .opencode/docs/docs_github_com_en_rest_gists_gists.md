# REST API endpoints for gists - GitHub Docs

> Source: https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#update-a-gist
> Cached: 2026-03-19T09:29:30.590Z

---

The REST API is now versioned. For more information, see "[About API versioning](/rest/overview/api-versions)."
- [REST API](/en/rest)/
- [Gists](/en/rest/gists)/
- [Gists](/en/rest/gists/gists)

# REST API endpoints for gists

Use the REST API to list, create, update and delete the public gists on GitHub.

## [About gists](#about-gists)

You can use the REST API to view and modify gists. For more information about gists, see [Editing and sharing content with gists](/en/get-started/writing-on-github/editing-and-sharing-content-with-gists).

### [Authentication](#authentication)

You can read public gists  anonymously, but you must be signed into GitHub to create gists. To read or write gists on a user's behalf, you need the gist OAuth scope and a token. For more information, see [Scopes for OAuth apps](/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

### [Truncation](#truncation)

The API provides up to one megabyte of content for each file in the gist. Each file returned for a gist through the API has a key called `truncated`. If `truncated` is `true`, the file is too large and only a portion of the contents were returned in `content`.

If you need the full contents of the file, you can make a `GET` request to the URL specified by `raw_url`. Be aware that for files larger than ten megabytes, you'll need to clone the gist via the URL provided by `git_pull_url`.

In addition to a specific file's contents being truncated, the entire files list may be truncated if the total number exceeds 300 files. If the top level `truncated` key is `true`, only the first 300 files have been returned in the files list. If you need to fetch all of the gist's files, you'll need to clone the gist via the URL provided by `git_pull_url`.

## [List gists for the authenticated user](#list-gists-for-the-authenticated-user)

Lists the authenticated user's gists or if called anonymously, this endpoint returns all public gists:

### [Fine-grained access tokens for "List gists for the authenticated user"](#list-gists-for-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token does not require any permissions.

### [Parameters for "List gists for the authenticated user"](#list-gists-for-the-authenticated-user--parameters)

HeadersName, Type, Description`accept` string Setting to `application/vnd.github+json` is recommended.

Query parametersName, Type, Description`since` string Only show results that were last updated after the given time. This is a timestamp in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format: `YYYY-MM-DDTHH:MM:SSZ`.

`per_page` integer The number of results per page (max 100). For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `30`

`page` integer The page number of the results to fetch. For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `1`

### [HTTP response status codes for "List gists for the authenticated user"](#list-gists-for-the-authenticated-user--status-codes)

Status codeDescription`200`OK

`304`Not modified

`403`Forbidden

### [Code samples for "List gists for the authenticated user"](#list-gists-for-the-authenticated-user--code-samples)

#### Request example

get/gists
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/gists#### Response

- Example response
- Response schema

`Status: 200`[
  {
    "url": "https://api.github.com/gists/aa5a315d61ae9438b18d",
    "forks_url": "https://api.github.com/gists/aa5a315d61ae9438b18d/forks",
    "commits_url": "https://api.github.com/gists/aa5a315d61ae9438b18d/commits",
    "id": "aa5a315d61ae9438b18d",
    "node_id": "MDQ6R2lzdGFhNWEzMTVkNjFhZTk0MzhiMThk",
    "git_pull_url": "https://gist.github.com/aa5a315d61ae9438b18d.git",
    "git_push_url": "https://gist.github.com/aa5a315d61ae9438b18d.git",
    "html_url": "https://gist.github.com/aa5a315d61ae9438b18d",
    "files": {
      "hello_world.rb": {
        "filename": "hello_world.rb",
        "type": "application/x-ruby",
        "language": "Ruby",
        "raw_url": "https://gist.githubusercontent.com/octocat/6cad326836d38bd3a7ae/raw/db9c55113504e46fa076e7df3a04ce592e2e86d8/hello_world.rb",
        "size": 167
      }
    },
    "public": true,
    "created_at": "2010-04-14T02:15:15Z",
    "updated_at": "2011-06-20T11:34:15Z",
    "description": "Hello World Examples",
    "comments": 0,
    "user": null,
    "comments_url": "https://api.github.com/gists/aa5a315d61ae9438b18d/comments/",
    "owner": {
      "login": "octocat",
      "id": 1,
      "node_id": "MDQ6VXNlcjE=",
      "avatar_url": "https://github.com/images/error/octocat_happy.gif",
      "gravatar_id": "",
      "url": "https://api.github.com/users/octocat",
      "html_url": "https://github.com/octocat",
      "followers_url": "https://api.github.com/users/octocat/followers",
      "following_url": "https://api.github.com/users/octocat/following{/other_user}",
      "gists_url": "https://api.github.com/users/octocat/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/octocat/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/octocat/subscriptions",
      "organizations_url": "https://api.github.com/users/octocat/orgs",
      "repos_url": "https://api.github.com/users/octocat/repos",
      "events_url": "https://api.github.com/users/octocat/events{/privacy}",
      "received_events_url": "https://api.github.com/users/octocat/received_events",
      "type": "User",
      "site_admin": false
    },
    "truncated": false
  }
]## [Create a gist](#create-a-gist)

Allows you to add a new gist with one or more files.

Note

Don't name your files "gistfile" with a numerical suffix. This is the format of the automatic naming scheme that Gist uses internally.
### [Fine-grained access tokens for "Create a gist"](#create-a-gist--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

- "Gists" user permissions (write)

### [Parameters for "Create a gist"](#create-a-gist--parameters)

HeadersName, Type, Description`accept` string Setting to `application/vnd.github+json` is recommended.

Body parametersName, Type, Description`description` string Description of the gist

`files` object RequiredNames and content for the files that make up the gist

Properties of `files`Name, Type, Description`key` object A user-defined key to represent an item in `files`.

Properties of `key`Name, Type, Description`content` string RequiredContent of the file

`public` boolean or string Flag indicating whether the gist is public

### [HTTP response status codes for "Create a gist"](#create-a-gist--status-codes)

Status codeDescription`201`Created

`304`Not modified

`403`Forbidden

`404`Resource not found

`422`Validation failed, or the endpoint has been spammed.

### [Code samples for "Create a gist"](#create-a-gist--code-samples)

#### Request example

post/gists
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR-TOKEN>" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/gists \
  -d &#x27;{"description":"Example of a gist","public":false,"files":{"README.md":{"content":"Hello World"}}}&#x27;#### Response

- Example response
- Response schema

`Status: 201`{
  "url": "https://api.github.com/gists/2decf6c462d9b4418f2",
  "forks_url": "https://api.github.com/gists/2decf6c462d9b4418f2/forks",
  "commits_url": "https://api.github.com/gists/2decf6c462d9b4418f2/commits",
  "id": "2decf6c462d9b4418f2",
  "node_id": "G_kwDOBhHyLdZDliNDQxOGYy",
  "git_pull_url": "https://gist.github.com/2decf6c462d9b4418f2.git",
  "git_push_url": "https://gist.github.com/2decf6c462d9b4418f2.git",
  "html_url": "https://gist.github.com/2decf6c462d9b4418f2",
  "files": {
    "README.md": {
      "filename": "README.md",
      "type": "text/markdown",
      "language": "Markdown",
      "raw_url": "https://gist.githubusercontent.com/monalisa/2decf6c462d9b4418f2/raw/ac3e6daf176fafe73609fd000cd188e4472010fb/README.md",
      "size": 23,
      "truncated": false,
      "content": "Hello world from GitHub",
      "encoding": "utf-8"
    }
  },
  "public": true,
  "created_at": "2022-09-20T12:11:58Z",
  "updated_at": "2022-09-21T10:28:06Z",
  "description": "An updated gist description.",
  "comments": 0,
  "comments_enabled": true,
  "user": null,
  "comments_url": "https://api.github.com/gists/2decf6c462d9b4418f2/comments",
  "owner": {
    "login": "monalisa",
    "id": 104456405,
    "node_id": "U_kgDOBhHyLQ",
    "avatar_url": "https://avatars.githubusercontent.com/u/104456405?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/monalisa",
    "html_url": "https://github.com/monalisa",
    "followers_url": "https://api.github.com/users/monalisa/followers",
    "following_url": "https://api.github.com/users/monalisa/following{/other_user}",
    "gists_url": "https://api.github.com/users/monalisa/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/monalisa/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/monalisa/subscriptions",
    "organizations_url": "https://api.github.com/users/monalisa/orgs",
    "repos_url": "https://api.github.com/users/monalisa/repos",
    "events_url": "https://api.github.com/users/monalisa/events{/privacy}",
    "received_events_url": "https://api.github.com/users/monalisa/received_events",
    "type": "User",
    "site_admin": true
  },
  "forks": [],
  "history": [
    {
      "user": {
        "login": "monalisa",
        "id": 104456405,
        "node_id": "U_kgyLQ",
        "avatar_url": "https://avatars.githubusercontent.com/u/104456405?v=4",
        "gravatar_id": "",
        "url": "https://api.github.com/users/monalisa",
        "html_url": "https://github.com/monalisa",
        "followers_url": "https://api.github.com/users/monalisa/followers",
        "following_url": "https://api.github.com/users/monalisa/following{/other_user}",
        "gists_url": "https://api.github.com/users/monalisa/gists{/gist_id}",
        "starred_url": "https://api.github.com/users/monalisa/starred{/owner}{/repo}",
        "subscriptions_url": "https://api.github.com/users/monalisa/subscriptions",
        "organizations_url": "https://api.github.com/users/monalisa/orgs",
        "repos_url": "https://api.github.com/users/monalisa/repos",
        "events_url": "https://api.github.com/users/monalisa/events{/privacy}",
        "received_events_url": "https://api.github.com/users/monalisa/received_events",
        "type": "User",
        "site_admin": true
      },
      "version": "468aac8caed5f0c3b859b8286968",
      "committed_at": "2022-09-21T10:28:06Z",
      "change_status": {
        "total": 2,
        "additions": 1,
        "deletions": 1
      },
      "url": "https://api.github.com/gists/8481a81af6b7a2d418f2/468aac8caed5f0c3b859b8286968"
    }
  ],
  "truncated": false
}## [List public gists](#list-public-gists)

List public gists sorted by most recently updated to least recently updated.

Note: With [pagination](https://docs.github.com/rest/guides/using-pagination-in-the-rest-api), you can fetch up to 3000 gists. For example, you can fetch 100 pages with 30 gists per page or 30 pages with 100 gists per page.

### [Fine-grained access tokens for "List public gists"](#list-public-gists--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token does not require any permissions.

### [Parameters for "List public gists"](#list-public-gists--parameters)

HeadersName, Type, Description`accept` string Setting to `application/vnd.github+json` is recommended.

Query parametersName, Type, Description`since` string Only show results that were last updated after the given time. This is a timestamp in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format: `YYYY-MM-DDTHH:MM:SSZ`.

`per_page` integer The number of results per page (max 100). For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `30`

`page` integer The page number of the results to fetch. For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `1`

### [HTTP response status codes for "List public gists"](#list-public-gists--status-codes)

Status codeDescription`200`OK

`304`Not modified

`403`Forbidden

`422`Validation failed, or the endpoint has been spammed.

### [Code samples for "List public gists"](#list-public-gists--code-samples)

#### Request example

get/gists/public
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/gists/public#### Response

- Example response
- Response schema

`Status: 200`[
  {
    "url": "https://api.github.com/gists/aa5a315d61ae9438b18d",
    "forks_url": "https://api.github.com/gists/aa5a315d61ae9438b18d/forks",
    "commits_url": "https://api.github.com/gists/aa5a315d61ae9438b18d/commits",
    "id": "aa5a315d61ae9438b18d",
    "node_id": "MDQ6R2lzdGFhNWEzMTVkNjFhZTk0MzhiMThk",
    "git_pull_url": "https://gist.github.com/aa5a315d61ae9438b18d.git",
    "git_push_url": "https://gist.github.com/aa5a315d61ae9438b18d.git",
    "html_url": "https://gist.github.com/aa5a315d61ae9438b18d",
    "files": {
      "hello_world.rb": {
        "file

... [Content truncated]