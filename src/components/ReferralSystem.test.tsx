import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
const state=vi.hoisted(()=>({fail:false,pending:true}));
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({lang:'en',dir:'ltr',t:(key:string)=>({'referral_tier_1':'Exclusive PDF Security Guide','referral_tier_3':'1 Week JoeScan Pro Trial','referral_tier_5':'1 Month Free Pro','referral_tier_10':'VIP Supporter Badge','referred_friends':'Referred friends','referral_top_inviters':'Top inviters','claim_reward':'Claim reward'}[key]||key)})}));
vi.mock('../lib/firebase',()=>({auth:{currentUser:{uid:'test'}},db:{}}));
vi.mock('firebase/firestore',()=>({
 doc:(_db:any,col:string)=>col,
 getDoc:async(col:string)=>{if(state.fail)throw Error('offline');if(col==='tierRequests')throw Error('permission-denied: missing document');return {exists:()=>true,data:()=>({code:'JOE-TEST',referralCount:3,claimedTiers:[1]})}},
 collection:(_db:any,col:string)=>col,query:(col:string,...constraints:any[])=>({col,constraints}),where:(field:string,op:string,value:string)=>({field,op,value}),orderBy:vi.fn(),limit:vi.fn(),
 getDocs:async(q:any)=>{if(q.col==='tierRequests'){expect(q.constraints).toContainEqual({field:'userId',op:'==',value:'test'});return {docs:state.pending?[{data:()=>({kind:'referral_reward',status:'pending',rewardTier:3})}]:[]}}return {docs:[],empty:true}},setDoc:vi.fn(),updateDoc:vi.fn()
}));
import ReferralSystem from './ReferralSystem';
afterEach(()=>{cleanup();state.fail=false;state.pending=true});
it('shows pending rewards and reports a failed clipboard write',async()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(Error('denied'))}});render(<ReferralSystem/>);await screen.findByText('JOE-TEST');expect(screen.getByText('Under review')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Copy invite code'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('Copied')).toBeNull()});
it('shows a retry when referral data cannot load',async()=>{state.fail=true;render(<ReferralSystem/>);expect(await screen.findByRole('button',{name:'Try again'})).toBeTruthy();expect(screen.queryByText('Your circle starts here.')).toBeNull()});
it('loads the invitation when the user has never requested a reward',async()=>{state.pending=false;render(<ReferralSystem/>);expect(await screen.findByText('JOE-TEST')).toBeTruthy();expect(screen.queryByText('Your invitations are unavailable')).toBeNull();expect(screen.getByRole('button',{name:'Claim reward'})).toBeTruthy();expect(screen.queryByText('Under review')).toBeNull()});
