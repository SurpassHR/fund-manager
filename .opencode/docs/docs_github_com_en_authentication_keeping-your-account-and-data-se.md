# Managing your personal access tokens - GitHub Docs

> Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
> Cached: 2026-03-19T09:29:38.969Z

---

- [Authentication](/en/authentication)/
- [Account security](/en/authentication/keeping-your-account-and-data-secure)/
- [Manage personal access tokens](/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

# Managing your personal access tokens

You can use a personal access token in place of a password when authenticating to GitHub in the command line or with the API.

Copy as Markdown## In this article

- [About personal access tokens](#about-personal-access-tokens)
- [Creating a fine-grained personal access token](#creating-a-fine-grained-personal-access-token)
- [Creating a personal access token (classic)](#creating-a-personal-access-token-classic)
- [Deleting a personal access token](#deleting-a-personal-access-token)
- [Using a personal access token on the command line](#using-a-personal-access-token-on-the-command-line)
- [Further reading](#further-reading)

Warning

Treat your access tokens like passwords. For more information, see [Keeping your personal access tokens secure](#keeping-your-personal-access-tokens-secure).

## [About personal access tokens](#about-personal-access-tokens)

Personal access tokens are an alternative to using passwords for authentication to GitHub when using the [GitHub API](/en/rest/overview/authenticating-to-the-rest-api) or the [command line](#using-a-personal-access-token-on-the-command-line).

Personal access tokens are intended to access GitHub resources on behalf of yourself. To access resources on behalf of an organization, or for long-lived integrations, you should use a GitHub App. For more information, see [About creating GitHub Apps](/en/apps/creating-github-apps/setting-up-a-github-app/about-creating-github-apps).

A token has the same capabilities to access resources and perform actions on those resources that the owner of the token has, and is further limited by any scopes or permissions granted to the token. A token cannot grant additional access capabilities to a user. For example, a personal access token can be configured with an `admin:org` scope, but if the owner of the token is not an organization owner, the token will not give administrative access to the organization.

### [Types of personal access tokens](#types-of-personal-access-tokens)

GitHub currently supports two types of personal access tokens: fine-grained personal access tokens and personal access tokens (classic). GitHub recommends that you use fine-grained personal access tokens instead of personal access tokens (classic) whenever possible.

Note

Fine-grained personal access tokens, while more secure and controllable, cannot accomplish every task that a personal access token (classic) can. See the section on [Fine-grained personal access tokens limitations](#fine-grained-personal-access-tokens-limitations) below to learn more.

Both fine-grained personal access tokens and personal access tokens (classic) are tied to the user who generated them and will become inactive if the user loses access to the resource.

Organization owners can set a policy to restrict the access of personal access tokens (classic) to their organization. For more information, see [Setting a personal access token policy for your organization](/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization#restricting-access-by-personal-access-tokens).

#### [Fine-grained personal access tokens](#fine-grained-personal-access-tokens)

Fine-grained personal access tokens have several security advantages over personal access tokens (classic), but also have limitations that may prevent you from using them in every scenario. These limits, and our plans to fix them, can be found in the [section below](#fine-grained-personal-access-tokens-limitations).

If you can use a fine-grained personal access token for your scenario, you'll benefit from these improvements:

- Each token is limited to access resources owned by a single user or organization.

- Each token can be further limited to only access specific repositories for that user or organization.

- Each token is granted specific, fine-grained permissions, which offer more control than the scopes granted to personal access tokens (classic).

- Organization owners can require approval for any fine-grained personal access tokens that can access resources in the organization.

##### [Fine-grained personal access tokens limitations](#fine-grained-personal-access-tokens-limitations)

Fine-grained personal access tokens do not support every feature of personal access tokens (classic). These feature gaps are not permanent - GitHub is working to close them. You can review [our public roadmap](https://github.com/github/roadmap) for more details on when these scenarios will be supported.

The major gaps in fine-grained personal access tokens are:

- Using fine-grained personal access token to contribute to public repos where the user is not a member.

- Using fine-grained personal access token to contribute to repositories where the user is an outside or repository collaborator.

- Using fine-grained personal access token to access multiple organizations at once.

- Using fine-grained personal access token to access Packages.

- Using fine-grained personal access token to call the Checks API.

- Using fine-grained personal access token to access Projects owned by a user account.

All of these gaps will be solved over time, as GitHub continues to invest in more secure access patterns.

#### [Personal access tokens (classic)](#personal-access-tokens-classic)

Personal access tokens (classic) are less secure. However, some features currently will only work with personal access tokens (classic):

- Only personal access tokens (classic) have write access for public repositories that are not owned by you or an organization that you are not a member of.

- Outside collaborators can only use personal access tokens (classic) to access organization repositories that they are a collaborator on.

- A few REST API endpoints are only available with a personal access tokens (classic). To check whether an endpoint also supports fine-grained personal access tokens, see the documentation for that endpoint, or see [Endpoints available for fine-grained personal access tokens](/en/rest/overview/endpoints-available-for-fine-grained-personal-access-tokens).

If you choose to use a personal access token (classic), keep in mind that it will grant access to all repositories within the organizations that you have access to, as well as all personal repositories in your personal account.

As a security precaution, GitHub automatically removes personal access tokens that haven't been used in a year. To provide additional security, we highly recommend adding an expiration to your personal access tokens.

### [Keeping your personal access tokens secure](#keeping-your-personal-access-tokens-secure)

Personal access tokens are like passwords, and they share the same inherent security risks. Before creating a new personal access token, consider if there is a more secure method of authentication available to you:

- To access GitHub from the command line, you can use [GitHub CLI](/en/github-cli/github-cli/about-github-cli) or [Git Credential Manager](https://github.com/GitCredentialManager/git-credential-manager/blob/main/README.md) instead of creating a personal access token.

- When using a personal access token in a GitHub Actions workflow, consider whether you can use the built-in `GITHUB_TOKEN` instead. For more information, see [Use GITHUB_TOKEN for authentication in workflows](/en/actions/security-guides/automatic-token-authentication).

If these options are not possible, and you must create a personal access token, consider using another CLI service to store your token securely.

When using a personal access token in a script, you can store your token as a secret and run your script through GitHub Actions. For more information, see [Using secrets in GitHub Actions](/en/actions/security-guides/encrypted-secrets). You can also store your token as a Codespaces secret and run your script in Codespaces. For more information, see [Managing your account-specific secrets for GitHub Codespaces](/en/codespaces/managing-your-codespaces/managing-encrypted-secrets-for-your-codespaces).

For more information about best practices, see [Keeping your API credentials secure](/en/rest/overview/keeping-your-api-credentials-secure).

## [Creating a fine-grained personal access token](#creating-a-fine-grained-personal-access-token)

Note

There is a limit of 50 fine-grained personal access tokens you can create. If you require more tokens or are building automations, consider using a GitHub App for better scalability and management. For more information, see [Deciding when to build a GitHub App](/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app#choosing-between-a-github-app-or-a-personal-access-token).

[Verify your email address](/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/verifying-your-email-address), if it hasn't been verified yet.

In the upper-right corner of any page on GitHub, click your profile picture, then click ** Settings**.

In the left sidebar, click ** Developer settings**.

In the left sidebar, under ** Personal access tokens**, click **Fine-grained tokens**.

Click **Generate new token**.

Under **Token name**, enter a name for the token.

Under **Expiration**, select an expiration for the token. Infinite lifetimes are allowed but may be blocked by a maximum lifetime policy set by your organization or enterprise owner. For more information, See [Enforcing a maximum lifetime policy for personal access tokens](/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization#enforcing-a-maximum-lifetime-policy-for-personal-access-tokens).

Optionally, under **Description**, add a note to describe the purpose of the token.

Under **Resource owner**, select a resource owner. The token will only be able to access resources owned by the selected resource owner. Organizations that you are a member of will not appear if the organization has blocked the use of fine-grained personal access tokens. For more information, see [Setting a personal access token policy for your organization](/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization).

Optionally, if the resource owner is an organization that requires approval for fine-grained personal access tokens, below the resource owner, in the box, enter a justification for the request.

Under **Repository access**, select which repositories you want the token to access. You should choose the minimal repository access that meets your needs. Tokens always include read-only access to all public repositories on GitHub.

If you selected **Only select repositories** in the previous step, under the **Selected repositories** dropdown, select the repositories that you want the token to access.

Under **Permissions**, select which permissions to grant the token. Depending on which resource owner and which repository access you specified, there are repository, organization, and account permissions. You should choose the minimal permissions necessary for your needs.

The REST API reference document for each endpoint states whether the endpoint works with fine-grained personal access tokens and states what permissions are required in order for the token to use the endpoint. Some endpoints may require multiple permissions, and some endpoints may require one of multiple permissions. For an overview of which REST API endpoints a fine-grained personal access token can access with each permission, see [Permissions required for fine-grained personal access tokens](/en/rest/overview/permissions-required-for-fine-grained-personal-access-tokens).

Click **Generate token**.

If you selected an organization as the resource owner and the organization requires approval for fine-grained personal access tokens, then your token will be marked as `pending` until it is reviewed by an organization administrator. Your token will only be able to read public resources until it is approved. If you are an owner of the organization, your request is automatically approved. For more information, see [Reviewing and revoking personal access tokens in your organization](/en/organizations/managing-programmatic-access-to-your-organization/reviewing-and-revoking-personal-access-tokens-in-your-organization).

### [Pre-filling fine-grained personal access token details using URL parameters](#pre-filling-fine-grained-personal-access-token-details-using-url-parameters)

You can share templates for a fine-grained personal access token via links. Storing token details this way makes it easier to automate workflows and improve your developer experience by directing users to token creation with relevant fields already completed.

Each supported field can be set using a specific query parameter. All parameters are optional and validated by the token generation form to ensure that the combinations of permissions and resource owner makes sense.

An example URL template is shown here, with line breaks for legibility:

HTTPhttps://github.com/settings/personal-access-tokens/new
  ?name=Repo-reading+token
  &#x26;description=Just+contents:read
  &#x26;target_name=octodemo
  &#x26;expires_in=45
  &#x26;contents=read
```
https://github.com/settings/personal-access-tokens/new
  ?name=Repo-reading+token
  &#x26;description=Just+contents:read
  &#x26;target_name=octodemo
  &#x26;expires_in=45
  &#x26;contents=read

```

Try the URL to create a token with `contents:read` and `metadata:read`, with the given name and description and an expiration date 45 days in the future. You'll see an error message indicating `Cannot find the specified resource owner: octodemo` because you're not a member of the `octodemo` organization.

Below are some example URLs that generate the tokens we see most often:

- [Read repo contents](https://github.com/settings/personal-access-tokens/new?name=Repo-reading+token&#x26;description=Just+contents:read&#x26;contents=read)

- [Push access to repos](https://github.com/settings/personal-access-tokens/new?name=Repo-writing+token&#x26;description=Just+contents:write&#x26;contents=write)

- [GitHub Models access](https://github.com/settings/personal-access-tokens/new?name=GitHub+Models+token&#x26;description=Used%20to%20call%20GitHub%20Models%20APIs%20to%20easily%20run%20LLMs%3A%20https%3A%2F%2Fdocs.github.com%2Fgithub-models%2Fquickstart%23step-2-make-an-api-call&#x26;user_models=read)

- [Update code and open a PR](https://github.com/settings/personal-access-tokens/new?name=Core-loop+token&#x26;description=Write%20code%20and%20push%20it%20to%20main%21%20Includes%20permission%20to

... [Content truncated]