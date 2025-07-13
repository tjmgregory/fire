# CI Setup for Google Apps Script Deployment

## GitHub Secrets Required

Add these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

### 1. CLASP_CREDENTIALS (Required)
Your complete `.clasprc.json` file contents, which includes the refresh token that doesn't expire.

To get this:
```bash
npm run clasp:login --no-localhost
cat ~/.clasprc.json
```

Copy the entire JSON content and add it as a secret.

### 2. SCRIPT_ID (Required)
Your Google Apps Script project ID: `1ih6hahfWWHXXaRdZ7gq3VTYSFS8-88mqKJTRJoBm1l363TosDH_y2tWj`

### 3. DEPLOYMENT_ID (Optional)
Your deployment ID: `AKfycbyWuGn7rigFDy1CQOVuepcSkaouCbUhNw7aeq07clE`

Only add this if you want automatic deployments on push to main.

## How It Works

1. The GitHub Action uses the refresh token from `CLASP_CREDENTIALS` to authenticate
2. The refresh token doesn't expire, so CI will continue to work indefinitely
3. On push to main, the workflow:
   - Pushes code to the Apps Script project
   - Optionally deploys if `DEPLOYMENT_ID` is set

## Important Notes

- The refresh token approach is simpler than service accounts and works well for personal projects
- For team projects, consider using a dedicated Google account for CI
- Keep your `.clasprc.json` secure - it provides full access to your Google Apps Script projects