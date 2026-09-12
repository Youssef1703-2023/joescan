import React,{useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {X,ShieldCheck,Check,Loader2,MessageCircle,ArrowUpRight,Tag,LockKeyhole} from 'lucide-react';
import {useLanguage} from '../contexts/LanguageContext';
import {db,auth} from '../lib/firebase';
import {doc,getDoc,setDoc,collection,query,where,getDocs} from 'firebase/firestore';
import '../styles/focus-billing.css';
interface Props{isOpen:boolean;onClose:()=>void;planName:string;price:string;tier:'pro'|'enterprise';onRequestSubmitted?:()=>void}
export default function CheckoutModal({isOpen,onClose,planName,price,tier,onRequestSubmitted}:Props){
 const {dir,lang}=useLanguage(),copy=(en:string,ar:string)=>lang==='ar'?ar:en,reduced=useReducedMotion();
 const [busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState(''),[promoCode,setPromoCode]=useState(''),[promoBusy,setPromoBusy]=useState(false),[promo,setPromo]=useState<{code:string;discount:number}|null>(null),[promoError,setPromoError]=useState('');
 const dialog=useRef<HTMLDivElement>(null),lock=useRef(false),generation=useRef(0);
 useEffect(()=>{generation.current++;setBusy(false);setSubmitted(false);setError('');setPromoCode('');setPromo(null);setPromoError('');setPromoBusy(false);lock.current=false},[isOpen,tier,price]);
 useEffect(()=>{if(!isOpen)return;const previous=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.focus();return()=>{generation.current++;document.body.style.overflow=overflow;previous?.focus()}},[isOpen]);
 const value=Number(price.replace(/,/g,'').replace(/[^\d.]/g,''));
 const amount=Number.isFinite(value)?value*(1-(promo?.discount||0)/100):0;
 const finalPrice=!promo?price:(price.includes('EGP')||price.includes('ج.م'))?`${amount.toFixed(2).replace(/\.00$/,'')} ${price.includes('EGP')?'EGP':'ج.م'}`:`$${amount.toFixed(2).replace(/\.00$/,'')}`;
 const message=`Hello JoeScan Team, I would like to subscribe to ${planName} (${finalPrice}/month).${promo?' Promo code: '+promo.code+'.':''} My subscription request has been submitted. Please confirm payment instructions and activation.`;
 const whatsapp='https://wa.me/201123343296?text='+encodeURIComponent(message);
 const applyPromo=async(e:React.FormEvent)=>{
  e.preventDefault();if(lock.current||!promoCode.trim())return;const request=generation.current;setPromoError('');setError('');
  const code=promoCode.trim().toUpperCase();if(!/^[A-Z0-9_-]{1,32}$/.test(code)){setPromoError(copy('Enter a valid promo code.','أدخل كود خصم صحيح.'));return;}
  if(!auth.currentUser){setPromoError(copy('Sign in before applying a code.','سجّل الدخول قبل استخدام كود الخصم.'));return;}
  lock.current=true;setPromoBusy(true);
  try{const snapshot=await getDoc(doc(db,'promoCodes',code));if(request!==generation.current)return;const data=snapshot.exists()?snapshot.data():null;
   if(!data||!data.active)throw Error(copy('This code is invalid or inactive.','الكود غير صحيح أو غير فعال.'));
   if(data.targetTier&&data.targetTier!==tier&&data.targetTier!=='all')throw Error(copy('This code does not apply to this plan.','الكود غير متاح للباقة دي.'));
   if(typeof data.discount!=='number'||!Number.isFinite(data.discount)||data.discount<=0||data.discount>100)throw Error(copy('The discount could not be verified.','تعذر التحقق من قيمة الخصم.'));
   setPromo({code,discount:data.discount});
  }catch(err){if(request===generation.current)setPromoError(err instanceof Error&&!('code' in err)?err.message:copy('Could not verify the promo code. Try again.','تعذر التحقق من الكود. حاول مرة أخرى.'))}
  finally{if(request===generation.current){setPromoBusy(false);lock.current=false}}
 };
 const submit=async()=>{
  if(lock.current||submitted)return;const user=auth.currentUser;if(!user){setError(copy('Please sign in first.','سجّل الدخول أولاً.'));return;}
  const request=generation.current;lock.current=true;setBusy(true);setError('');
  try{
   const existing=await getDocs(query(collection(db,'tierRequests'),where('userId','==',user.uid)));
   const prior=existing.docs.find(d=>d.id===`${user.uid}_subscription`);
   if(prior){const data=prior.data();if(data.status!=='pending'||data.tier!==tier||(data.promoCode||'')!==(promo?.code||''))throw Error(copy('You already have a subscription request. Contact support to review or change it.','لديك طلب اشتراك مسجل بالفعل. تواصل مع الدعم لمراجعته أو تغييره.'));}
   else await setDoc(doc(db,'tierRequests',`${user.uid}_subscription`),{userId:user.uid,kind:'subscription',status:'pending',tier,...(promo?{promoCode:promo.code}:{}),createdAt:new Date().toISOString()});
   if(request!==generation.current)return;setSubmitted(true);onRequestSubmitted?.();
  }catch(err){if(request===generation.current)setError(err instanceof Error&&!('code' in err)?err.message:copy('Your request could not be saved. Please retry.','تعذر حفظ طلبك. حاول مرة أخرى.'))}
  finally{if(request===generation.current){setBusy(false);lock.current=false}}
 };
 if(!isOpen)return null;
 return <div className="billing-overlay" dir={dir} onClick={e=>{if(e.target===e.currentTarget&&!busy&&!promoBusy)onClose()}}><motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="checkout-title" tabIndex={-1} className="billing-dialog" initial={{opacity:0,y:reduced?0:20,scale:reduced?1:.98}} animate={{opacity:1,y:0,scale:1}} transition={{duration:reduced?0:.3}} onKeyDown={e=>{if(e.key==='Escape'&&!busy&&!promoBusy)onClose();if(e.key==='Tab'){const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]')||[]) as HTMLElement[];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}}>
 <button className="billing-close" aria-label={copy('Close checkout','إغلاق الدفع')} disabled={busy||promoBusy} onClick={onClose}><X size={20}/></button>
 <aside className="billing-summary"><span className="billing-eyebrow">JOESCAN / MEMBERSHIP</span><div className="billing-orbit" aria-hidden="true"><ShieldCheck size={47}/><i/><i/></div><span className="billing-plan-label">{copy('YOUR SELECTED PLAN','الباقة المختارة')}</span><h2>{planName}</h2><div className="billing-price">{finalPrice}<small>{copy('/ month','/ شهر')}</small></div>{promo&&<p className="billing-discount"><s>{price}</s><span>−{promo.discount}%</span></p>}<dl><div><dt>{copy('Billing period','فترة الاشتراك')}</dt><dd>{copy('Monthly','شهري')}</dd></div><div><dt>{copy('Activation','التفعيل')}</dt><dd>{copy('After verification','بعد التحقق')}</dd></div></dl><p className="billing-note"><LockKeyhole size={14}/>{copy('No card details are collected here.','لا يتم جمع بيانات بطاقات الدفع هنا.')}</p></aside>
 <section className="billing-content">{submitted?<div className="billing-success" role="status"><span><Check size={32}/></span><p className="billing-eyebrow">{copy('REQUEST SAVED','تم حفظ الطلب')}</p><h1 id="checkout-title">{copy('You’re one step closer.','باقي خطوة واحدة.')}</h1><p>{copy('Your subscription request is pending. Our team will verify payment or promo eligibility before activation.','طلب اشتراكك قيد المراجعة. سيتحقق الفريق من الدفع أو صلاحية العرض قبل التفعيل.')}</p>{promo?.discount===100?<button className="billing-primary" onClick={onClose}>{copy('Done','تم')}</button>:<a className="billing-primary" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>{copy('Continue on WhatsApp','تابع عبر WhatsApp')}<ArrowUpRight size={17}/></a>}<small>{copy('Your plan has not been activated yet.','لم يتم تفعيل الباقة بعد.')}</small></div>:<><p className="billing-eyebrow">{copy('REVIEW & CONTINUE','راجع وتابع')}</p><h1 id="checkout-title">{copy('Your next chapter.','خطوتك الجاية.')}</h1><p className="billing-intro">{copy('Review your plan, apply a code, and request your subscription.','راجع الباقة، وأضف كود خصم لو عندك، ثم قدم طلب الاشتراك.')}</p><div className="billing-method"><MessageCircle size={23}/><div><strong>{copy('Arrange payment via WhatsApp','تنسيق الدفع عبر WhatsApp')}</strong><p>{copy('Our team confirms the payment method and amount.','الفريق يؤكد وسيلة الدفع والمبلغ معك.')}</p></div><Check size={17}/></div>
 <div className="billing-promo"><label htmlFor="checkout-promo"><Tag size={15}/>{copy('Have a promo code?','عندك كود خصم؟')}</label>{promo?<div className="billing-applied"><span><Check size={15}/>{promo.code} · {promo.discount}%</span><button disabled={busy} onClick={()=>{setPromo(null);setPromoCode('')}}>{copy('Remove','إزالة')}</button></div>:<form onSubmit={applyPromo}><input id="checkout-promo" autoComplete="off" value={promoCode} maxLength={32} disabled={busy||promoBusy} onChange={e=>{setPromoCode(e.target.value.toUpperCase());setPromoError('')}} placeholder="ENTER CODE"/><button disabled={!promoCode.trim()||busy||promoBusy}>{promoBusy?<Loader2 size={15} className="animate-spin"/>:copy('Apply','تطبيق')}</button></form>}{promoError&&<p role="alert" className="billing-error">{promoError}</p>}</div>
 <div className="billing-total"><span>{copy('Plan amount','قيمة الباقة')}</span><strong>{finalPrice}<small> / {copy('month','شهر')}</small></strong></div>{error&&<p className="billing-error" role="alert">{error}</p>}<button className="billing-primary" disabled={busy||promoBusy} onClick={submit}>{busy?<Loader2 size={17} className="animate-spin"/>:null}{busy?copy('Saving request…','جاري حفظ الطلب…'):copy('Request subscription','طلب اشتراك')}<ArrowUpRight size={17}/></button><p className="billing-terms">{copy('No charge is made by this button. Activation follows review.','هذا الزر لا يخصم أي مبلغ. التفعيل يتم بعد المراجعة.')} <a href="/terms.en" target="_blank" rel="noopener noreferrer">{copy('Terms','الشروط')}</a> · <a href="/privacy" target="_blank" rel="noopener noreferrer">{copy('Privacy','الخصوصية')}</a></p></>}</section>
 </motion.div></div>;
}
