# REST API endpoints for users - GitHub Docs

> Source: https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
> Cached: 2026-03-19T09:29:31.424Z

---

The REST API is now versioned. For more information, see "[About API versioning](/rest/overview/api-versions)."
- [REST API](/en/rest)/
- [Users](/en/rest/users)/
- [Users](/en/rest/users/users)

# REST API endpoints for users

Use the REST API to get public and private information about authenticated users.

## [Get the authenticated user](#get-the-authenticated-user)

OAuth app tokens and personal access tokens (classic) need the `user` scope in order for the response to include private profile information.

### [Fine-grained access tokens for "Get the authenticated user"](#get-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token does not require any permissions.

### [HTTP response status codes for "Get the authenticated user"](#get-the-authenticated-user--status-codes)

Status codeDescription`200`OK

`304`Not modified

`401`Requires authentication

`403`Forbidden

### [Code samples for "Get the authenticated user"](#get-the-authenticated-user--code-samples)

#### Request examples

Select the example typeExample 1: Status Code 200Example 2: Status Code 200get/user
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/user#### Response with public and private profile information

- Example response
- Response schema

`Status: 200`{
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
  "site_admin": false,
  "name": "monalisa octocat",
  "company": "GitHub",
  "blog": "https://github.com/blog",
  "location": "San Francisco",
  "email": "octocat@github.com",
  "hireable": false,
  "bio": "There once was...",
  "twitter_username": "monatheoctocat",
  "public_repos": 2,
  "public_gists": 1,
  "followers": 20,
  "following": 0,
  "created_at": "2008-01-14T04:33:35Z",
  "updated_at": "2008-01-14T04:33:35Z",
  "private_gists": 81,
  "total_private_repos": 100,
  "owned_private_repos": 100,
  "disk_usage": 10000,
  "collaborators": 8,
  "two_factor_authentication": true,
  "plan": {
    "name": "Medium",
    "space": 400,
    "private_repos": 20,
    "collaborators": 0
  }
}## [Update the authenticated user](#update-the-authenticated-user)

**Note:** If your email is set to private and you send an `email` parameter as part of this request to update your profile, your privacy settings are still enforced: the email address will not be displayed on your public profile or via the API.

### [Fine-grained access tokens for "Update the authenticated user"](#update-the-authenticated-user--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token must have the following permission set:

- "Profile" user permissions (write)

### [Parameters for "Update the authenticated user"](#update-the-authenticated-user--parameters)

HeadersName, Type, Description`accept` string Setting to `application/vnd.github+json` is recommended.

Body parametersName, Type, Description`name` string The new name of the user.

`email` string The publicly visible email address of the user.

`blog` string The new blog URL of the user.

`twitter_username` string or null The new Twitter username of the user.

`company` string The new company of the user.

`location` string The new location of the user.

`hireable` boolean The new hiring availability of the user.

`bio` string The new short biography of the user.

### [HTTP response status codes for "Update the authenticated user"](#update-the-authenticated-user--status-codes)

Status codeDescription`200`OK

`304`Not modified

`401`Requires authentication

`403`Forbidden

`404`Resource not found

`422`Validation failed, or the endpoint has been spammed.

### [Code samples for "Update the authenticated user"](#update-the-authenticated-user--code-samples)

#### Request example

patch/user
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <YOUR-TOKEN>" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/user \
  -d &#x27;{"blog":"https://github.com/blog","name":"monalisa octocat"}&#x27;#### Response

- Example response
- Response schema

`Status: 200`{
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
  "site_admin": false,
  "name": "monalisa octocat",
  "company": "GitHub",
  "blog": "https://github.com/blog",
  "location": "San Francisco",
  "email": "octocat@github.com",
  "hireable": false,
  "bio": "There once was...",
  "twitter_username": "monatheoctocat",
  "public_repos": 2,
  "public_gists": 1,
  "followers": 20,
  "following": 0,
  "created_at": "2008-01-14T04:33:35Z",
  "updated_at": "2008-01-14T04:33:35Z",
  "private_gists": 81,
  "total_private_repos": 100,
  "owned_private_repos": 100,
  "disk_usage": 10000,
  "collaborators": 8,
  "two_factor_authentication": true,
  "plan": {
    "name": "Medium",
    "space": 400,
    "private_repos": 20,
    "collaborators": 0
  }
}## [Get a user using their ID](#get-a-user-using-their-id)

Provides publicly available information about someone with a GitHub account. This method takes their durable user `ID` instead of their `login`, which can change over time.

If you are requesting information about an [Enterprise Managed User](https://docs.github.com/enterprise-cloud@latest/admin/managing-iam/understanding-iam-for-enterprises/about-enterprise-managed-users), or a GitHub App bot that is installed in an organization that uses Enterprise Managed Users, your requests must be authenticated as a user or GitHub App that has access to the organization to view that account's information. If you are not authorized, the request will return a `404 Not Found` status.

The `email` key in the following response is the publicly visible email address from your GitHub [profile page](https://github.com/settings/profile). When setting up your profile, you can select a primary email address to be public which provides an email entry for this endpoint. If you do not set a public email address for `email`, then it will have a value of `null`. You only see publicly visible email addresses when authenticated with GitHub. For more information, see [Authentication](https://docs.github.com/rest/guides/getting-started-with-the-rest-api#authentication).

The Emails API enables you to list all of your email addresses, and toggle a primary email to be visible publicly. For more information, see [Emails API](https://docs.github.com/rest/users/emails).

### [Fine-grained access tokens for "Get a user using their ID"](#get-a-user-using-their-id--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [GitHub App installation access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token does not require any permissions.

This endpoint can be used without authentication if only public resources are requested.

### [Parameters for "Get a user using their ID"](#get-a-user-using-their-id--parameters)

HeadersName, Type, Description`accept` string Setting to `application/vnd.github+json` is recommended.

Path parametersName, Type, Description`account_id` integer Requiredaccount_id parameter

### [HTTP response status codes for "Get a user using their ID"](#get-a-user-using-their-id--status-codes)

Status codeDescription`200`OK

`404`Resource not found

### [Code samples for "Get a user using their ID"](#get-a-user-using-their-id--code-samples)

#### Request examples

Select the example typeExample 1: Status Code 200Example 2: Status Code 200get/user/{account_id}
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/user/ACCOUNT_ID#### Default response

- Example response
- Response schema

`Status: 200`{
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
  "site_admin": false,
  "name": "monalisa octocat",
  "company": "GitHub",
  "blog": "https://github.com/blog",
  "location": "San Francisco",
  "email": "octocat@github.com",
  "hireable": false,
  "bio": "There once was...",
  "twitter_username": "monatheoctocat",
  "public_repos": 2,
  "public_gists": 1,
  "followers": 20,
  "following": 0,
  "created_at": "2008-01-14T04:33:35Z",
  "updated_at": "2008-01-14T04:33:35Z"
}## [List users](#list-users)

Lists all users, in the order that they signed up on GitHub. This list includes personal user accounts and organization accounts.

Note: Pagination is powered exclusively by the `since` parameter. Use the [Link header](https://docs.github.com/rest/guides/using-pagination-in-the-rest-api#using-link-headers) to get the URL for the next page of users.

### [Fine-grained access tokens for "List users"](#list-users--fine-grained-access-tokens)

This endpoint works with the following fine-grained token types:

- [GitHub App user access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [GitHub App installation access tokens](/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [Fine-grained personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

The fine-grained token does not require any permissions.

This endpoint can be used without authentication if only public resources are requested.

### [Parameters for "List users"](#list-users--parameters)

HeadersName, Type, Description`accept` string Setting to `application/vnd.github+json` is recommended.

Query parametersName, Type, Description`since` integer A user ID. Only return users with an ID greater than this ID.

`per_page` integer The number of results per page (max 100). For more information, see "[Using pagination in the REST API](https://docs.github.com/rest/using-the-rest-api/using-pagination-in-the-rest-api)."

Default: `30`

### [HTTP response status codes for "List users"](#list-users--status-codes)

Status codeDescription`200`OK

`304`Not modified

### [Code samples for "List users"](#list-users--code-samples)

#### Request example

get/users
- cURL
- JavaScript
- GitHub CLI

Copy to clipboard curl request examplecurl -L \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://api.github.com/users#### Response

- Example response
- Response schema

`Status: 200`[
  {
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
    "organizations_url": "https:

... [Content truncated]