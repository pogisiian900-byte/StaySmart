/**
 * PayPal API Helper Functions for Firebase Cloud Functions
 * These functions make direct PayPal API calls server-side
 */

const fetch = require('node-fetch');

/**
 * Get PayPal OAuth Access Token
 * @param {string} clientId - PayPal Client ID
 * @param {string} clientSecret - PayPal Client Secret
 * @param {string} apiBase - PayPal API base URL
 * @returns {Promise<string>} Access token
 */
async function getPayPalAccessToken(clientId, clientSecret, apiBase) {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get PayPal access token: ${errorData.error_description || response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
}

/**
 * Get PayPal Balance from API
 * @param {string} accessToken - PayPal access token
 * @param {string} apiBase - PayPal API base URL
 * @param {string} currency - Currency code
 * @returns {Promise<Object>} Balance information
 */
async function getPayPalBalanceFromAPI(accessToken, apiBase, currency = 'PHP') {
  try {
    const response = await fetch(`${apiBase}/v1/reporting/balances?currency_code=${currency}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get PayPal balance: ${errorData.message || response.statusText}`);
    }

    const balanceData = await response.json();
    return balanceData;
  } catch (error) {
    console.error('Error getting PayPal balance from API:', error);
    throw error;
  }
}

module.exports = {
  getPayPalAccessToken,
  getPayPalBalanceFromAPI
};

