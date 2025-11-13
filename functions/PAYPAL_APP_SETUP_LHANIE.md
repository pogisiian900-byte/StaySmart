# PayPal App Setup for lhanie@business.example.com

## Platform Account Details
- **Email**: `lhanie@business.example.com`
- **Account ID**: `88UKGRJYCMYBN`
- **Account Type**: Business (Sandbox)

## Step-by-Step: Create PayPal App and Get Credentials

### Step 1: Access PayPal Developer Dashboard

1. Go to: https://developer.paypal.com/dashboard/
2. Log in with your PayPal account (the one that owns `lhanie@business.example.com`)

### Step 2: Switch to Sandbox Mode

1. Look for the toggle at the top of the page
2. Switch it to **"Sandbox"** (not "Live")
3. The page should show "Sandbox" mode

### Step 3: Navigate to Apps & Credentials

1. Click on **"My Apps & Credentials"** in the left sidebar
2. Or go directly to: https://developer.paypal.com/dashboard/applications/sandbox

### Step 4: Create New App

1. Click the **"Create App"** button
2. Fill in the app details:
   - **App Name**: `StaySmart Platform` (or any name you prefer)
   - **Merchant Account**: Select `lhanie@business.example.com` (or account ID `88UKGRJYCMYBN`)
   - **Features**: Make sure "Payouts" is enabled
3. Click **"Create App"**

### Step 5: Get Client ID and Secret

After creating the app, you'll see:

1. **Client ID**: 
   - Copy this value (it's visible immediately)
   - Format: Usually starts with letters/numbers (e.g., `AWzCyB0viVv8_sS4aT30...`)

2. **Secret**:
   - Click **"Show"** next to the Secret field
   - Copy the secret value
   - Format: Long string of letters/numbers

### Step 6: Verify App is Associated with Correct Account

1. Check the app details show:
   - **Merchant Account**: `lhanie@business.example.com` or account ID `88UKGRJYCMYBN`
   - **Environment**: Sandbox
   - **Features**: Payouts enabled

### Step 7: Update .env File

1. Open `functions/.env` file
2. Update with your credentials:
   ```env
   PAYPAL_CLIENT_ID=your_actual_client_id_from_step_5
   PAYPAL_CLIENT_SECRET=your_actual_secret_from_step_5
   PAYPAL_MODE=sandbox
   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
   ```
3. Save the file

## Important Notes

- ✅ The Client ID and Secret are specific to the app you create
- ✅ Make sure the app is associated with `lhanie@business.example.com` account
- ✅ Keep these credentials secure - don't commit them to version control
- ✅ The `.env` file is already in `.gitignore` so it won't be committed

## Troubleshooting

**Can't find the account in dropdown?**
- Make sure you're in Sandbox mode
- Verify the account `lhanie@business.example.com` exists in your sandbox accounts
- Try searching by account ID: `88UKGRJYCMYBN`

**App creation fails?**
- Make sure you're logged in with the correct PayPal account
- Verify you have permission to create apps
- Try refreshing the page and creating again

**Credentials not working?**
- Double-check you copied the entire Client ID and Secret
- Verify there are no extra spaces
- Make sure you're using Sandbox credentials (not Live)

