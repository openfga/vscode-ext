# Release Process

## Prerequisites

- [Node.js](https://nodejs.org/) v20.x installed
- Commit access to the [openfga/vscode-ext](https://github.com/openfga/vscode-ext) repository
- GPG key configured for signing tags (see [GitHub docs](https://docs.github.com/en/authentication/managing-commit-signature-verification))

## Steps

### 1. Bump the version number

Update the `version` field in **all three** `package.json` files so they stay in sync:

- [`package.json`](/package.json) (root)
- [`client/package.json`](/client/package.json)
- [`server/package.json`](/server/package.json)

> [!NOTE]
> VS Code Marketplace does not yet support pre-release versions, so the version must be in the format `MAJOR.MINOR.PATCH` (e.g., `0.2.0`) without any suffixes like `-beta.1`.
> See [documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions)

Then regenerate the lock files:

```sh
npm install
```

### 2. Update the CHANGELOG

Add a new section to [`CHANGELOG.md`](/CHANGELOG.md) following the existing format:

```markdown
## v<NEW_VERSION>

### [<NEW_VERSION>](https://github.com/openfga/vscode-ext/compare/v<PREV_VERSION>...v<NEW_VERSION>) (<YYYY-MM-DD>)

### Added
- ...

### Fixed
- ...
```

Also update the `[Unreleased]` link at the top to compare against the new version tag.

### 3. Open a release PR

Create a branch named `release/v<NEW_VERSION>`, commit the changes, and open a pull request:

```sh
git checkout -b release/v<NEW_VERSION>
git add -A
git commit -m "chore: release v<NEW_VERSION>"
git push origin release/v<NEW_VERSION>
```

Open a PR from `release/v<NEW_VERSION>` → `main` and get it reviewed and merged.

### 4. Create and push a signed tag

After the release PR is merged, switch to `main` and pull the latest changes before tagging:

```sh
git checkout main
git pull origin main
git tag -a -s v<NEW_VERSION> -m "v<NEW_VERSION>"
git push origin v<NEW_VERSION>
```

### 5. Verify the release

Pushing the tag triggers the [Publish workflow](/.github/workflows/publish.yaml), which will:

1. Run lint and tests across macOS, Ubuntu, and Windows.
2. Publish the extension to the **Open VSX Registry**.
3. Publish the extension to the **VS Code Marketplace**.
4. Create a GitHub Release and upload the `.vsix` artifact.

Monitor the workflow run at <https://github.com/openfga/vscode-ext/actions/workflows/publish.yaml> and confirm all jobs succeed.

### 6. Validate the published extension

- **VS Code Marketplace**: <https://marketplace.visualstudio.com/items?itemName=openfga.openfga-vscode>
- **Open VSX Registry**: <https://open-vsx.org/extension/openfga/openfga-vscode>

## Dry-run publish

You can verify the packaging and publish steps without actually releasing by manually triggering the [Dryrun Publish workflow](/.github/workflows/dryrun-publish.yaml) from the **Actions** tab on GitHub.

## Building a VSIX locally

To build the `.vsix` package locally for testing:

```sh
npm ci
npm run build:vsix
```

This produces `openfga-latest.vsix` in the repository root, which can be installed manually via **Extensions → ⋯ → Install from VSIX…** in VS Code.

## Rotating publishing tokens

### VS Code Marketplace

**Requirements:**

- Membership in the **OpenFGA** organization on [Azure DevOps](https://dev.azure.com/openfga/)
- Admin permission on the [openfga/vscode-ext](https://github.com/openfga/vscode-ext) repository (to update secrets)

**Steps:**

1. Sign in to [Azure DevOps](https://dev.azure.com/openfga/).
2. Open **User Settings** (icon in the top-right) → **Personal Access Tokens**.
3. Click **New Token** and configure:
   - **Name**: a descriptive name (e.g., `vscode-ext marketplace publish`)
   - **Organization**: select **openfga**
   - **Expiration**: choose an appropriate expiry (max 1 year)
   - **Scopes**: select **Custom defined**, then check **Marketplace → Manage**
4. Click **Create** and copy the generated token immediately (it will not be shown again).
5. Go to the [GitHub repository secrets](https://github.com/openfga/vscode-ext/settings/secrets/actions).
6. Update the **`VS_MARKETPLACE_TOKEN`** secret with the new token value.

> **Tip:** Set a calendar reminder before the token expires so it can be rotated proactively.

### Open VSX Registry

**Requirements:**

- An account on the [Open VSX Registry](https://open-vsx.org/) with publishing rights for the `openfga` namespace
- Admin permission on the [openfga/vscode-ext](https://github.com/openfga/vscode-ext) repository (to update secrets)

**Steps:**

1. Sign in to [open-vsx.org](https://open-vsx.org/).
2. Go to **Settings → Access Tokens**.
3. Generate a new token with publish permissions.
4. Go to the [GitHub repository secrets](https://github.com/openfga/vscode-ext/settings/secrets/actions).
5. Update the **`OPEN_VSX_TOKEN`** secret with the new token value.
