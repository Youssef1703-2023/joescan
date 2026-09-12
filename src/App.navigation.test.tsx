import React from 'react';
import {render,screen,fireEvent,within,waitFor,cleanup,act} from '@testing-library/react';
import {it,expect,vi,beforeAll,beforeEach,afterEach} from 'vitest';
const fixture=vi.hoisted(()=>({tier:'free',verified:true,user:{uid:'navigation-user',email:'member@example.com',displayName:'Member',photoURL:null,getIdTokenResult:async()=>({claims:{email_verified:true,firebase:{sign_in_provider:'google.com'}}})}}));
vi.mock('./lib/firebase',()=>({auth:{get currentUser(){return fixture.user},signOut:vi.fn()},db:{},ADMIN_EMAIL:'admin@example.com',isUserBanned:async()=>({banned:false}),logActivity:vi.fn(),getUserTier:async()=>fixture.tier,getUserProfile:async()=>({}),ensureUserProfile:async()=>({})}));
vi.mock('firebase/auth',()=>({onAuthStateChanged:(_auth:any,cb:any)=>{queueMicrotask(()=>cb(fixture.user));return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:vi.fn()}));
vi.mock('firebase/firestore',()=>({doc:vi.fn(),getDoc:async()=>({exists:()=>false})}));
vi.mock('./lib/verifiedSignIn',()=>({hasVerifiedSignIn:()=>fixture.verified}));
vi.mock('./lib/privateSession',()=>({clearPrivateSession:vi.fn()}));
vi.mock('./contexts/LanguageContext',()=>({LanguageProvider:({children}:any)=>children,useLanguage:()=>({lang:'en',theme:'dark',setLang:vi.fn(),setTheme:vi.fn(),t:(s:string)=>s}),LANGUAGE_OPTIONS:[]}));
vi.mock('./contexts/NotificationContext',()=>({NotificationProvider:({children}:any)=>children,useNotifications:()=>({unreadCount:3})}));
vi.mock('motion/react',()=>({AnimatePresence:({children}:any)=>children,motion:{div:({children,initial,animate,exit,...props}:any)=><div {...props}>{children}</div>}}));
vi.mock('./components/Dashboard',()=>({default:({onNavigate}:any)=><section><h1>Dashboard content</h1><button onClick={()=>onNavigate('email')}>Start email</button></section>}));
vi.mock('./components/EmailAnalyzer',()=>({default:()=><h1>Email check content</h1>}));
vi.mock('./components/ScanHistory',()=>({default:()=><h1>History content</h1>}));
vi.mock('./components/AdminDashboard',()=>({default:()=><h1>Admin content</h1>}));
vi.mock('./components/MfaGate',()=>({default:({onVerified}:any)=><button onClick={onVerified}>Complete MFA</button>}));
vi.mock('./components/EmailVerificationGate',()=>({default:()=><h1>Verify your email</h1>}));
vi.mock('./components/NotificationCenter',()=>({default:()=>null}));
vi.mock('./components/Toast',()=>({default:()=>null}));
vi.mock('./components/LoadingSkeleton',()=>({default:()=>null}));
vi.mock('./components/SEOHead',()=>({default:()=>null}));
vi.mock('./components/CyberAssistant',()=>({default:()=>null}));
vi.mock('./components/ApiSettingsModal',()=>({default:()=>null}));
vi.mock('./components/ProfileSettings',()=>({default:({onClose}:any)=><section role="dialog" aria-label="Account settings"><button onClick={onClose}>Close profile</button></section>}));
import App from './App';
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};HTMLElement.prototype.scrollTo=vi.fn()});
beforeEach(()=>{fixture.tier='free';fixture.verified=true;fixture.user.email='member@example.com';localStorage.setItem('onboarding_navigation-user','done');window.history.replaceState({},'','/?start=1')});
afterEach(()=>{cleanup();vi.clearAllMocks()});
async function enter(){render(<App/>);await screen.findByRole('button',{name:'Complete MFA'});expect(screen.queryByRole('navigation')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Complete MFA'}));await screen.findByRole('button',{name:/^Navigate/})}
it('mounts navigation only after verification and MFA, then routes to the real page slot',async()=>{
 await enter();expect(document.querySelector('aside')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/^Navigate/}));const search=screen.getByRole('searchbox');fireEvent.change(search,{target:{value:'email'}});fireEvent.keyDown(search,{key:'Enter'});
 await screen.findByRole('heading',{name:'Email check content'});expect(location.pathname).toBe('/email-audit');expect(document.querySelector('.workspace-page')?.getAttribute('data-page')).toBe('email');expect(screen.queryByRole('dialog')).toBeNull();
 act(()=>{window.history.pushState({tab:'retired-tool'},'','/history');window.dispatchEvent(new PopStateEvent('popstate',{state:{tab:'retired-tool'}}))});await screen.findByRole('heading',{name:'History content'});fireEvent.click(screen.getByRole('button',{name:/^Navigate/}));expect(document.querySelector('.sn-origin strong')?.textContent).toBe('Scan history');
});
it('retains the email verification gate',async()=>{fixture.verified=false;render(<App/>);await screen.findByRole('heading',{name:'Verify your email'});expect(screen.queryByRole('navigation')).toBeNull();fireEvent.keyDown(window,{ctrlKey:true,key:'k'});expect(screen.queryByRole('dialog')).toBeNull()});
it('uses the authenticated host permissions for administrator destinations',async()=>{
 fixture.user.email='admin@example.com';await enter();fireEvent.click(screen.getByRole('button',{name:/^Navigate/}));fireEvent.change(screen.getByRole('searchbox'),{target:{value:'admin'}});fireEvent.keyDown(screen.getByRole('searchbox'),{key:'Enter'});await screen.findByRole('heading',{name:'Admin content'});expect(location.pathname).toBe('/admin');
});
it('keeps account settings usable without the floating navigation covering the dialog',async()=>{
 await enter();expect(screen.getByRole('button',{name:/^Open profile for Member/}).textContent).toContain('3 new');expect(document.querySelector('header')?.querySelectorAll('button')).toHaveLength(2);fireEvent.click(screen.getByRole('button',{name:/^Open profile for Member/}));await screen.findByRole('dialog',{name:'Account settings'});expect(screen.queryByRole('navigation')).toBeNull();fireEvent.keyDown(window,{ctrlKey:true,key:'k'});expect(screen.getAllByRole('dialog')).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Close profile'}));await waitFor(()=>expect(screen.getByRole('navigation')).toBeTruthy());
});
