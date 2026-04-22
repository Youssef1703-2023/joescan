import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

admin.initializeApp();

// Paymob Configuration
// Setup via: firebase functions:config:set paymob.apikey="..." paymob.integration_id="..." paymob.hmac_secret="..."
const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY || "YOUR_PAYMOB_API_KEY";
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID || "YOUR_INTEGRATION_ID";
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || "YOUR_HMAC_SECRET";

// Function to upgrade user tier
const upgradeUserTier = async (uid: string, newTier: 'pro' | 'enterprise', daysValid: number) => {
  const userRef = admin.firestore().collection('users').doc(uid);
  
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  await userRef.update({
    tier: newTier,
    tierExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
  });

  // Log activity
  await admin.firestore().collection('activityLog').add({
    uid,
    action: 'tier_upgraded',
    details: `Upgraded to ${newTier} via Paymob`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ip: '127.0.0.1', // Webhook server IP
    userAgent: 'Paymob Webhook',
  });
};

export const createPaymentToken = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { tier } = data;
  if (tier !== 'pro' && tier !== 'enterprise') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid tier.');
  }

  const amountCents = tier === 'enterprise' ? 3000 : 600; // E.g., $30 or $6 represented in cents

  try {
    // 1. Authentication Request
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
    });
    const authData = await authRes.json();
    const token = authData.token;

    // 2. Order Registration API
    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: "false",
        amount_cents: amountCents.toString(),
        currency: "USD",
        items: [{
           name: `${tier.toUpperCase()} Subscription`, // Required by Paymob
           amount_cents: amountCents.toString(),
           description: `JoeScan ${tier} Plan`,
           quantity: "1"
        }],
      }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.id;

    // 3. Payment Key Request API
    const paymentKeyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: amountCents.toString(),
        expiration: 3600,
        order_id: orderId,
        billing_data: {
          apartment: "NA",
          email: context.auth.token.email || "client@joescan.cloud",
          floor: "NA",
          first_name: context.auth.token.name ? context.auth.token.name.split(' ')[0] : "Customer",
          street: "NA",
          building: "NA",
          phone_number: "NA",
          shipping_method: "NA",
          postal_code: "NA",
          city: "NA",
          country: "NA",
          last_name: context.auth.token.name ? context.auth.token.name.split(' ')[1] || "Name" : "Name",
          state: "NA"
        },
        currency: "USD",
        integration_id: PAYMOB_INTEGRATION_ID,
      }),
    });
    const paymentKeyData = await paymentKeyRes.json();

    // Securely save the pending order in Firestore mapping orderId -> uid & tier
    await admin.firestore().collection('pendingOrders').doc(orderId.toString()).set({
      uid: context.auth.uid,
      tier: tier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    return {
      paymentToken: paymentKeyData.token,
      orderId: orderId,
    };
  } catch (error) {
    console.error("Paymob API Error:", error);
    throw new functions.https.HttpsError('internal', 'Unable to initiate payment with Paymob.');
  }
});

export const paymobWebhook = functions.https.onRequest(async (req: any, res: any) => {
  // Paymob sends webhooks as POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  const obj = req.body.obj;
  if (!obj) {
    res.status(400).send('Invalid Paymob Paylaod');
    return;
  }

  const {
      amount_cents,
      created_at,
      currency,
      error_occured,
      has_parent_transaction,
      id,
      integration_id,
      is_3d_secure,
      is_auth,
      is_capture,
      is_refunded,
      is_standalone_payment,
      is_voided,
      order,
      owner,
      pending,
      source_data,
      success,
  } = obj;

  const hmacString = [
      amount_cents,
      created_at,
      currency,
      error_occured,
      has_parent_transaction,
      id,
      integration_id,
      is_3d_secure,
      is_auth,
      is_capture,
      is_refunded,
      is_standalone_payment,
      is_voided,
      order.id,
      owner,
      pending,
      source_data.pan,
      source_data.sub_type,
      source_data.type,
      success,
  ].join('');

  const hmac = crypto.createHmac('sha512', PAYMOB_HMAC_SECRET).update(hmacString).digest('hex');

  // Validate the signature from Paymob
  if (hmac !== req.query.hmac) {
    console.error("HMAC signature mismatch");
    res.status(401).send('Unauthorized');
    return;
  }

  // Signature valid! Check transaction status
  if (success === true) {
    // Fulfill the order
    const orderRef = admin.firestore().collection('pendingOrders').doc(order.id.toString());
    const orderDoc = await orderRef.get();
    
    if (orderDoc.exists) {
      const data = orderDoc.data()!;
      if (data.status === 'pending') {
        // Upgrade User
        await upgradeUserTier(data.uid, data.tier, 30);
        // Mark as paid
        await orderRef.update({ status: 'paid', transactionId: id });
        console.log(`Successfully upgraded user ${data.uid} to ${data.tier}`);
      }
    }
  }

  res.status(200).send('OK');
});
