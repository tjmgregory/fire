# CI Setup for Google Apps Script Deployment

## GitHub Secrets Required

Add this secret in your GitHub repository (Settings → Secrets and variables → Actions):

### CLASP_CREDENTIALS (Required)
Your complete `.clasprc.json` file contents, which includes the refresh token that doesn't expire.

To get this:
```bash
npm run clasp:login --no-localhost
cat ~/.clasprc.json
```

Copy the entire JSON content and add it as a secret.

## Environment Variables

The following are configured as environment variables in the workflow file since they are not sensitive:

- **SCRIPT_ID**: `1ih6hahfWWHXXaRdZ7gq3VTYSFS8-88mqKJTRJoBm1l363TosDH_y2tWj`
- **DEPLOYMENT_ID**: `AKfycbyWuGn7rigFDy1CQOVuepcSkaouCbUhNw7aeq07clE`

These IDs are public identifiers that appear in Apps Script URLs and are safe to commit to the repository.

## How It Works

1. The GitHub Action uses the refresh token from `CLASP_CREDENTIALS` to authenticate
2. The refresh token doesn't expire, so CI will continue to work indefinitely
3. On push to main (when `src/apps-script/`, `rollup.config.js`, `tsconfig.json`, or `package.json` change), the workflow:
   - Installs dependencies and runs `npm run build` (rollup bundle)
   - Verifies `dist/Code.js` exists and exposes global functions
   - Pushes `dist/` to the Apps Script project via `clasp push`
   - Deploys with the deployment ID
4. Can also be triggered manually via `workflow_dispatch`

## Important: Build Before Push

The deployment pushes the **rollup bundle** (`dist/Code.js`), not the raw TypeScript files. Google Apps Script doesn't support `require()`/`module.exports`, so the code must be bundled into a single IIFE with global `function` declarations. The workflow handles this automatically.

## Important Notes

- The refresh token approach is simpler than service accounts and works well for personal projects
- For team projects, consider using a dedicated Google account for CI
- Keep your `.clasprc.json` secure - it provides full access to your Google Apps Script projects