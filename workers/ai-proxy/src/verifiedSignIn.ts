// Trust the current provider in a verified Firebase token, never client profile data.
export function hasVerifiedSignIn(claims: Record<string, unknown>): boolean {
  const firebase = claims.firebase;
  return claims.email_verified === true || (typeof firebase === 'object' && firebase !== null &&
    (firebase as Record<string, unknown>).sign_in_provider === 'google.com');
}
