import {describe,it,expect} from 'vitest';
import {hasVerifiedSignIn} from './verifiedSignIn';
describe('verified sign-in',()=>{
 it('accepts Google sessions without a top-level verified email',()=>expect(hasVerifiedSignIn({email_verified:false,firebase:{sign_in_provider:'google.com'}})).toBe(true));
 it('accepts verified password sessions',()=>expect(hasVerifiedSignIn({email_verified:true,firebase:{sign_in_provider:'password'}})).toBe(true));
 it('rejects unverified password sessions even with a linked Google identity',()=>{
  const claims={email_verified:false,firebase:{sign_in_provider:'password',identities:{'google.com':['linked-id']}}};
  expect(hasVerifiedSignIn(claims)).toBe(false);
 });
 it('rejects missing, anonymous and custom providers',()=>{
  for(const provider of [undefined,'anonymous','custom']) expect(hasVerifiedSignIn({firebase:{sign_in_provider:provider}})).toBe(false);
 });
});
