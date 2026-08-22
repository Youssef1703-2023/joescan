/**
 * Set the `admin` custom claim for a Firebase user.
 *
 * Why: firestore.rules now grant admin via `request.auth.token.admin == true`
 * (with a verified-owner-email fallback). A custom claim cannot be spoofed by
 * signing up with the admin email from another provider.
 *
 * Usage (from the repo root):
 *   1) Generate a service-account key:
 *        Firebase Console → Project settings → Service accounts →
 *        "Generate new private key" → save as scripts/service-account.json
 *   2) Run:
 *        node scripts/set-admin-claim.js <email> [true|false]
 *
 * Example:
 *   node scripts/set-admin-claim.js joetech.dev.systems@gmail.com true
 */
const path = require('path');
const fs = require('fs');

let admin;
try {
  admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
} catch {
  admin = require('firebase-admin');
}

const keyPath = path.join(__dirname, 'service-account.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(keyPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

async function main() {
  const [email, value = 'true'] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node scripts/set-admin-claim.js <email> [true|false]');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.applicationDefault() });

  const user = await admin.auth().getUserByEmail(email);
  const currentClaims = user.customClaims || {};
  const makeAdmin = value === 'true';

  const merged = { ...currentClaims, admin: makeAdmin };
  if (!makeAdmin) delete merged.admin;

  await admin.auth().setCustomUserClaims(user.uid, merged);
  console.log(`OK — admin claim for ${email} (${user.uid}) set to ${makeAdmin}`);
  console.log('Note: the user must sign out/in (or refresh their token) to pick it up.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
