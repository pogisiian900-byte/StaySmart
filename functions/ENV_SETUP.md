# Environment Variables Setup Guide

This project uses environment variables instead of the deprecated `functions.config()` API.

## Local Development Setup

1. Create a `.env` file in the `functions` directory:

```env
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_MODE=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

2. The `.env` file is already in `.gitignore`, so it won't be committed to version control.

3. For local testing with Firebase emulators:
```bash
cd functions
npm run serve
```

## Production Deployment

### Option 1: Using Firebase Environment Variables (Recommended)

Set environment variables when deploying:

```bash
# Set environment variables
firebase functions:config:set paypal.client_id="YOUR_CLIENT_ID" paypal.client_secret="YOUR_CLIENT_SECRET" paypal.mode="sandbox"

# Deploy functions
firebase deploy --only functions
```

### Option 2: Using Google Cloud Secret Manager (Most Secure)

```bash
# Set secrets
echo -n "YOUR_CLIENT_ID" | firebase functions:secrets:set PAYPAL_CLIENT_ID
echo -n "YOUR_CLIENT_SECRET" | firebase functions:secrets:set PAYPAL_CLIENT_SECRET
echo -n "sandbox" | firebase functions:secrets:set PAYPAL_MODE

# Update functions/index.js to use secrets (requires code changes)
```

### Option 3: Using .env file in production (Not Recommended)

You can also set environment variables in your deployment platform, but this is less secure than Secret Manager.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAYPAL_CLIENT_ID` | Yes | - | PayPal Client ID from Developer Dashboard |
| `PAYPAL_CLIENT_SECRET` | Yes | - | PayPal Client Secret from Developer Dashboard |
| `PAYPAL_MODE` | No | `sandbox` | Either `sandbox` or `live` |
| `PAYPAL_API_BASE` | No | Auto-detected | API base URL (auto-detected from PAYPAL_MODE) |

## Migration from functions.config()

If you were previously using `firebase functions:config:set`, you need to:

1. Export your current config:
```bash
firebase functions:config:get > config.json
```

2. Set environment variables based on the exported config
3. Update your code (already done in this project)
4. Deploy the updated functions

## PayPal Sandbox Account Funding (For Withdrawals)

**IMPORTANT**: The withdrawal feature uses PayPal Payout API, which requires the **platform PayPal account** (the account associated with your `PAYPAL_CLIENT_ID`) to have sufficient funds to send payouts to users.

### How It Works:
1. User's Firebase balance is deducted first
2. PayPal Payout API sends money FROM platform PayPal account TO user's PayPal account
3. If payout fails, user's Firebase balance is automatically refunded

### For Sandbox Testing:

You need to add test funds to your platform PayPal sandbox account. See detailed guide: `ADD_TEST_FUNDS_GUIDE.md`

**Quick Steps:**
1. Go to [PayPal Sandbox](https://developer.paypal.com/dashboard/)
2. Switch to Sandbox mode
3. Go to "Accounts"
4. Find your platform account (e.g., `lhanie@business.example.com`)
5. Add test funds (unlimited in sandbox)

**Note**: In sandbox mode, you can add unlimited test funds to test the withdrawal flow.

## Additional Guides

- **`PAYPAL_CONFIG_VERIFICATION.md`** - Complete guide to verify your PayPal configuration
- **`ADD_TEST_FUNDS_GUIDE.md`** - Step-by-step guide to add test funds to platform account
- **`TEST_PAYPAL_CONFIG.md`** - How to test and verify PayPal configuration is working

## Troubleshooting

If you get "PayPal credentials not configured" errors:

1. **Local development**: Check that `.env` file exists in `functions/` directory
2. **Production**: Verify environment variables are set in Firebase
3. **Check logs**: `firebase functions:log` to see detailed error messages

If you get "insufficient funds" errors during withdrawal:

1. **Sandbox**: Add test funds to your platform PayPal sandbox account (see above)
2. **Production**: Ensure your platform PayPal account has sufficient balance
3. **Check**: Verify the platform PayPal account associated with `PAYPAL_CLIENT_ID` has funds

