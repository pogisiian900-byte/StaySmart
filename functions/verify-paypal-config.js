/**
 * PayPal Configuration Verification Script
 * Run this to verify your PayPal credentials are configured correctly
 * 
 * Usage: node verify-paypal-config.js
 */

require('dotenv').config();

console.log('=== PAYPAL CONFIGURATION VERIFICATION ===\n');

// Check if .env file is loaded
const hasClientId = !!process.env.PAYPAL_CLIENT_ID;
const hasSecret = !!process.env.PAYPAL_CLIENT_SECRET;

console.log('1. Environment Variables Check:');
console.log(`   PAYPAL_CLIENT_ID: ${hasClientId ? '✅ Set' : '❌ Missing'}`);
console.log(`   PAYPAL_CLIENT_SECRET: ${hasSecret ? '✅ Set' : '❌ Missing'}`);

if (!hasClientId || !hasSecret) {
  console.log('\n❌ ERROR: Missing PayPal credentials in .env file');
  console.log('   Please check functions/.env file and ensure both PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set');
  process.exit(1);
}

// Check if values are placeholders
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

console.log('\n2. Credential Validation:');
const isPlaceholderId = clientId.includes('your_paypal') || clientId.includes('placeholder');
const isPlaceholderSecret = clientSecret.includes('your_paypal') || clientSecret.includes('placeholder');

if (isPlaceholderId) {
  console.log('   ❌ PAYPAL_CLIENT_ID appears to be a placeholder');
} else {
  console.log(`   ✅ PAYPAL_CLIENT_ID looks valid (length: ${clientId.length})`);
}

if (isPlaceholderSecret) {
  console.log('   ❌ PAYPAL_CLIENT_SECRET appears to be a placeholder');
} else {
  console.log(`   ✅ PAYPAL_CLIENT_SECRET looks valid (length: ${clientSecret.length})`);
}

if (isPlaceholderId || isPlaceholderSecret) {
  console.log('\n❌ ERROR: Credentials appear to be placeholders');
  console.log('   Please update functions/.env with actual PayPal Client ID and Secret');
  console.log('   See PAYPAL_APP_SETUP_LHANIE.md for instructions');
  process.exit(1);
}

// Test PayPal API authentication
console.log('\n3. Testing PayPal API Authentication:');
const fetch = require('node-fetch');
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
})
  .then(async (response) => {
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ PayPal authentication successful!');
      console.log(`   ✅ Access token obtained (length: ${data.access_token?.length || 0})`);
      console.log(`   ✅ Token type: ${data.token_type || 'N/A'}`);
      console.log('\n✅ SUCCESS: PayPal configuration is working correctly!');
      console.log('\nNext steps:');
      console.log('1. Add test funds to lhanie@business.example.com account');
      console.log('2. Test a withdrawal in your app');
      console.log('3. Check Firebase Functions logs for detailed payout information');
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('   ❌ PayPal authentication failed');
      console.log(`   ❌ Status: ${response.status} ${response.statusText}`);
      console.log(`   ❌ Error: ${errorData.error_description || errorData.error || 'Unknown error'}`);
      console.log('\n❌ ERROR: Invalid PayPal credentials');
      console.log('   Please verify:');
      console.log('   - Client ID and Secret are correct');
      console.log('   - They are from a PayPal App associated with lhanie@business.example.com');
      console.log('   - The app has Payouts API permissions');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log('   ❌ Network error:', error.message);
    console.log('\n❌ ERROR: Could not connect to PayPal API');
    console.log('   Please check your internet connection');
    process.exit(1);
  });

