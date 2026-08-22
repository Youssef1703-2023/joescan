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

  await userRef.set({
    tier: newTier,
    subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiresAt),
  }, { merge: true });

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

// Rate limit helper for AI callables
async function checkRateLimit(uid: string, limitPerMinute: number = 30): Promise<void> {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const rateLimitRef = admin.firestore().collection('rateLimits').doc(uid);

  await admin.firestore().runTransaction(async (t) => {
    const doc = await t.get(rateLimitRef);
    const data = doc.data() || { timestamps: [] };
    const validTimestamps = (data.timestamps || []).filter((ts: number) => ts > oneMinuteAgo);

    if (validTimestamps.length >= limitPerMinute) {
      throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please wait a minute before trying again.');
    }

    validTimestamps.push(now);
    t.set(rateLimitRef, { timestamps: validTimestamps, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

// ─── 1. SOC Trial Activation ───
export const startSocTrial = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (_data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = context.auth.uid;
    const userRef = admin.firestore().collection('users').doc(uid);

    await admin.firestore().runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }
      const data = userDoc.data() || {};
      if (data.socTrialUsed === true) {
        throw new functions.https.HttpsError('failed-precondition', 'SOC trial has already been used.');
      }

      // Check if current tier is paid and not expired
      const tier = data.tier || 'free';
      const expiry = data.subscriptionExpiry?.toDate?.() || (data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null);
      if ((tier === 'pro' || tier === 'enterprise') && expiry && expiry.getTime() > Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'User already has an active paid subscription.');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      t.set(userRef, {
        tier: 'enterprise',
        subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiresAt),
        socTrialUsed: true,
        socTrialActivatedAt: now.toISOString(),
        upgradedVia: 'soc_trial',
      }, { merge: true });

      const activityRef = admin.firestore().collection('activityLog').doc();
      t.set(activityRef, {
        userId: uid,
        email: context.auth?.token.email || null,
        action: 'upgrade',
        details: 'Activated 3-day SOC Enterprise trial',
        targetUser: uid,
        timestamp: now.toISOString(),
      });
    });

    return { success: true };
  });

// ─── 2. Claim Referral Reward ───
export const claimReferralReward = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = context.auth.uid;
    const tier = Number(data?.tier);
    if (![1, 3, 5, 10].includes(tier)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid reward tier. Must be 1, 3, 5, or 10.');
    }

    const refDocRef = admin.firestore().collection('referrals').doc(uid);
    const userRef = admin.firestore().collection('users').doc(uid);

    let daysToAdd = 0;
    let tierName: 'pro' | 'enterprise' = 'pro';
    if (tier === 1) {
      daysToAdd = 3; // Tier 1 (1 referral) grants 3 days of Pro
      tierName = 'pro';
    } else if (tier === 3) {
      daysToAdd = 7;
      tierName = 'pro';
    } else if (tier === 5) {
      daysToAdd = 30;
      tierName = 'pro';
    } else if (tier === 10) {
      daysToAdd = 3650; // 10 years
      tierName = 'enterprise'; // NEVER 'vip'
    }

    await admin.firestore().runTransaction(async (t) => {
      const refSnap = await t.get(refDocRef);
      if (!refSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Referral document not found.');
      }
      const refData = refSnap.data() || {};
      const count = refData.referralCount || 0;
      const claimedTiers: number[] = refData.claimedTiers || [];

      if (count < tier) {
        throw new functions.https.HttpsError('failed-precondition', `Insufficient referrals (${count}/${tier}).`);
      }
      if (claimedTiers.includes(tier)) {
        throw new functions.https.HttpsError('already-exists', 'Reward tier already claimed.');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      t.update(refDocRef, {
        claimedTiers: admin.firestore.FieldValue.arrayUnion(tier),
      });

      t.set(userRef, {
        tier: tierName,
        subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiresAt),
        upgradedVia: `referral_reward_tier_${tier}`,
      }, { merge: true });

      const actRef = admin.firestore().collection('activityLog').doc();
      t.set(actRef, {
        userId: uid,
        email: context.auth?.token.email || null,
        action: 'upgrade',
        details: `Claimed referral reward tier ${tier} (${tierName} for ${daysToAdd} days)`,
        targetUser: uid,
        timestamp: now.toISOString(),
      });
    });

    return { success: true };
  });

// ─── 3. Redeem Referral Code ───
export const redeemReferralCode = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const callerUid = context.auth.uid;
    const callerEmail = context.auth.token.email || '';
    const code = (data?.code || '').trim().toUpperCase();

    if (!code) {
      throw new functions.https.HttpsError('invalid-argument', 'Referral code is required.');
    }

    const referralsQuery = await admin.firestore().collection('referrals').where('code', '==', code).limit(1).get();
    if (referralsQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid referral code.');
    }

    const referrerDoc = referralsQuery.docs[0];
    const referrerUid = referrerDoc.id;

    if (referrerUid === callerUid) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot redeem your own referral code.');
    }

    const signupMarkerRef = admin.firestore().collection('referralSignups').doc(callerUid);
    const referrerRef = admin.firestore().collection('referrals').doc(referrerUid);

    await admin.firestore().runTransaction(async (t) => {
      const signupDoc = await t.get(signupMarkerRef);
      if (signupDoc.exists) {
        throw new functions.https.HttpsError('already-exists', 'User has already redeemed a referral.');
      }

      const refSnap = await t.get(referrerRef);
      if (!refSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Referrer not found.');
      }
      const refData = refSnap.data() || {};
      const newCount = (refData.referralCount || 0) + 1;

      t.set(signupMarkerRef, {
        newUid: callerUid,
        referrerUid: referrerUid,
        email: callerEmail.toLowerCase(),
        createdAt: new Date().toISOString(),
      });

      t.update(referrerRef, {
        referralCount: newCount,
      });
    });

    return { success: true, referrerUid };
  });

// ─── 4. Submit Subscription Request ───
export const submitSubscriptionRequest = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = context.auth.uid;
    const email = context.auth.token.email || '';
    const tier = data?.tier;
    const promoCode = (data?.promoCode || '').trim().toUpperCase();

    if (tier !== 'pro' && tier !== 'enterprise') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid tier requested.');
    }

    let discount = 0;
    let validatedPromo: string | null = null;

    if (promoCode) {
      const promoDoc = await admin.firestore().collection('promoCodes').doc(promoCode).get();
      if (!promoDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Invalid promo code.');
      }
      const pData = promoDoc.data() || {};
      if (pData.active !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'Promo code is inactive or expired.');
      }
      if (pData.targetTier && pData.targetTier !== 'all' && pData.targetTier !== tier) {
        throw new functions.https.HttpsError('failed-precondition', `Promo code is only valid for ${pData.targetTier} plan.`);
      }
      discount = Number(pData.discount) || 0;
      validatedPromo = promoCode;
    }

    const reqRef = admin.firestore().collection('subscriptionRequests').doc();
    await reqRef.set({
      uid,
      email,
      tier,
      promoCode: validatedPromo,
      discount,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, status: 'pending', requestId: reqRef.id };
  });

// ─── 5. Admin Grant Tier ───
export const adminGrantTier = functions
  .runWith({ enforceAppCheck: true })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    if (context.auth.token.email !== 'joetech.dev.systems@gmail.com') {
      throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
    }

    const { uid, tier, daysValid = 30, requestId } = data;
    if (!uid || typeof uid !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Valid user UID is required.');
    }
    if (tier !== 'free' && tier !== 'pro' && tier !== 'enterprise') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid tier.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(daysValid));

    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.set({
      tier,
      subscriptionExpiry: tier === 'free' ? null : admin.firestore.Timestamp.fromDate(expiresAt),
      upgradedVia: 'admin_grant',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    if (requestId) {
      const reqRef = admin.firestore().collection('subscriptionRequests').doc(requestId);
      await reqRef.set({
        status: 'approved',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: context.auth.token.email,
      }, { merge: true });
    }

    await admin.firestore().collection('activityLog').add({
      userId: context.auth.uid,
      email: context.auth.token.email,
      action: 'upgrade',
      details: `Admin granted tier '${tier}' to user '${uid}' for ${daysValid} days`,
      targetUser: uid,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  });

// ─── 6. AI Proxy ───
export const aiProxy = functions
  .runWith({ enforceAppCheck: true, secrets: ['GROQ_API_KEY'] })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    await checkRateLimit(context.auth.uid, 30);

    const { prompt, systemPrompt, schemaKeys, schemaObj } = data;
    if (!prompt || typeof prompt !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Prompt is required.');
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new functions.https.HttpsError('failed-precondition', 'AI provider secret is not configured.');
    }

    let sysInstruction = systemPrompt || 'You are a friendly cybersecurity expert.';
    if (schemaKeys && Array.isArray(schemaKeys)) {
      const schemaDetails = schemaKeys.map((k: string) => ' - ' + k).join('\n');
      sysInstruction = `${sysInstruction}\n\nCRITICAL: You MUST output ONLY valid JSON. The JSON MUST contain exactly the following keys:\n${schemaDetails}`;
    } else if (schemaObj && schemaObj.properties) {
      const schemaDetails = Object.keys(schemaObj.properties).map((k: string) => ' - ' + k).join('\n');
      sysInstruction = `${sysInstruction}\n\nCRITICAL: You MUST output ONLY valid JSON. The JSON MUST contain exactly the following keys:\n${schemaDetails}`;
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: sysInstruction },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown Groq error');
        console.error('Groq API Error:', response.status, errText);
        throw new functions.https.HttpsError('internal', `AI API error: ${response.status}`);
      }

      const resData = (await response.json()) as any;
      const content = resData.choices?.[0]?.message?.content || '{}';
      try {
        return JSON.parse(content);
      } catch {
        return { raw: content };
      }
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('aiProxy error:', err);
      throw new functions.https.HttpsError('internal', 'AI processing failed.');
    }
  });

// ─── 7. Chat Proxy ───
export const chatProxy = functions
  .runWith({ enforceAppCheck: true, secrets: ['OPENROUTER_API_KEY'] })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    await checkRateLimit(context.auth.uid, 30);

    const { messages } = data;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Messages array is required.');
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Chat AI provider secret is not configured.');
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://joescan.me',
          'X-Title': 'JoeScan AI Cyber Assistant',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b:free',
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown OpenRouter error');
        console.error('OpenRouter API Error:', response.status, errText);
        throw new functions.https.HttpsError('internal', `OpenRouter error: ${response.status}`);
      }

      const resData = (await response.json()) as any;
      return resData.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('chatProxy error:', err);
      throw new functions.https.HttpsError('internal', 'Chat processing failed.');
    }
  });

// ─── Paymob Payment Functions ───
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
    const authData = (await authRes.json()) as { token: string };
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
    const orderData = (await orderRes.json()) as { id: string | number };
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
    const paymentKeyData = (await paymentKeyRes.json()) as { token: string };

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
