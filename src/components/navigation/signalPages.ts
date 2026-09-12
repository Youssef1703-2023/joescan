import {LayoutDashboard, History, Radar, Mail, KeyRound, Link, MessageSquareWarning, Globe, BookOpen, Gift, CreditCard, Users, Orbit, ShieldCheck} from 'lucide-react';
import type {TabId} from '../../lib/workspaceRoutes';

export const SIGNAL_GROUPS = [
 {id:'workspace',label:'Your workspace',ar:'مساحتك',caption:'Pick up where you left off.',captionAr:'كمّل من المكان اللي وقفت عنده.',verb:'Keep a clear view.',verbAr:'شوف الصورة كاملة.'},
 {id:'investigate',label:'Run a check',ar:'ابدأ فحص',caption:'Follow a question. Find your tool.',captionAr:'ابدأ بسؤال، ووصل للأداة المناسبة.',verb:'Look a little closer.',verbAr:'بُص على التفاصيل.'},
 {id:'discover',label:'Discover & connect',ar:'اكتشف وشارك',caption:'Build knowledge. Share your experience.',captionAr:'زوّد معرفتك وشارك تجربتك.',verb:'Go beyond the check.',verbAr:'خطوتك اللي بعد الفحص.'},
 {id:'account',label:'Your setup',ar:'إعداد مساحتك',caption:'The right space for the way you work.',captionAr:'مساحة مناسبة لطريقة شغلك.',verb:'Make room for more.',verbAr:'وسّع إمكانياتك.'},
 {id:'control',label:'System control',ar:'إدارة النظام',caption:'Manage your platform in one place.',captionAr:'إدارة المنصة من مكان واحد.',verb:'Stay in control.',verbAr:'خليك متحكّم.'},
] as const;
export type SignalGroup = typeof SIGNAL_GROUPS[number]['id'];
export const SIGNAL_PAGES = [
 {id:'dashboard',group:'workspace',label:'Focus dashboard',ar:'لوحة التحكم',description:'Your overview and next step.',descriptionAr:'نظرة على نشاطك وخطوتك الجاية.',icon:LayoutDashboard,keywords:'home overview الرئيسية'},
 {id:'history',group:'workspace',label:'Scan history',ar:'سجل الفحوصات',description:'Revisit your saved reports.',descriptionAr:'ارجع للتقارير المحفوظة.',icon:History,keywords:'reports recent previous last تقارير'},
 {id:'watchlist',group:'workspace',label:'Live watchlist',ar:'قائمة المراقبة',description:'Follow the signals that matter.',descriptionAr:'تابع الإشارات اللي تهمك.',icon:Radar,keywords:'monitor alerts متابعة'},
 {id:'email',group:'investigate',label:'Email check',ar:'فحص البريد',description:'See where your email has appeared.',descriptionAr:'اعرف فين ظهر بريدك في المصادر المتاحة.',icon:Mail,keywords:'audit breach exposure leak ايميل البريد تسريب'},
 {id:'password',group:'investigate',label:'Password check',ar:'فحص كلمة المرور',description:'Understand strength and exposure.',descriptionAr:'افهم قوة كلمة المرور واحتمال تسريبها.',icon:KeyRound,keywords:'vault strength password باسورد'},
 {id:'url',group:'investigate',label:'Suspicious link',ar:'فحص رابط',description:'Take a closer look before you click.',descriptionAr:'افحص الرابط قبل ما تضغط عليه.',icon:Link,keywords:'url phishing رابط'},
 {id:'message',group:'investigate',label:'Message phishing',ar:'فحص الرسائل',description:'Spot the warning signs in a message.',descriptionAr:'اكتشف علامات الخطر في الرسالة.',icon:MessageSquareWarning,keywords:'sms text scam تصيد'},
 {id:'domain',group:'investigate',label:'Domain lookup',ar:'فحص النطاق',description:'Explore registration and DNS records.',descriptionAr:'راجع بيانات التسجيل وسجلات DNS.',icon:Globe,keywords:'whois dns website نطاق موقع'},
 {id:'blog',group:'discover',label:'The journal',ar:'المدوّنة',description:'Fresh perspectives on digital security.',descriptionAr:'معرفة عملية عن الأمان الرقمي.',icon:BookOpen,keywords:'blog articles news learn مدونة'},
 {id:'referral',group:'discover',label:'Refer friends',ar:'ادعِ أصحابك',description:'Invite your circle to look closer.',descriptionAr:'شارك JoeScan مع أصحابك.',icon:Gift,keywords:'invite rewards referral دعوة'},
 {id:'pricing',group:'account',label:'Membership',ar:'الاشتراكات',description:'Find the plan that fits your needs.',descriptionAr:'اختار الخطة اللي تناسب احتياجك.',icon:CreditCard,keywords:'pricing subscription billing payment plan اشتراك دفع'},
 {id:'team',group:'account',label:'Team workspace',ar:'إدارة الفريق',description:'Bring your team into the picture.',descriptionAr:'اجمع فريقك في مساحة واحدة.',icon:Users,keywords:'management members فريق'},
 {id:'threat_3d',group:'workspace',label:'3D threat visualizer',ar:'عرض التهديدات ثلاثي الأبعاد',description:'Explore the wider threat landscape.',descriptionAr:'استكشف مشهد التهديدات.',icon:Orbit,keywords:'3d globe threat visualizer تهديدات'},
 {id:'admin',group:'control',label:'System command center',ar:'مركز إدارة النظام',description:'People, requests and platform controls.',descriptionAr:'الحسابات والطلبات وإعدادات المنصة.',icon:ShieldCheck,keywords:'admin system control إدارة'},
] satisfies {id:TabId;group:SignalGroup;label:string;ar:string;description:string;descriptionAr:string;icon:typeof Mail;keywords:string}[];

// Visibility is supplied by the authenticated host. This is not an authorization layer.
export const STANDARD_SIGNAL_TABS: TabId[] = ['dashboard','history','watchlist','email','password','url','message','domain','blog','referral','pricing'];

export function getSignalTabs(tier:string,isAdmin:boolean):TabId[]{
 return [...STANDARD_SIGNAL_TABS,...(tier==='enterprise'||isAdmin?['team','threat_3d'] as TabId[]:[]),...(isAdmin?['admin'] as TabId[]:[])];
}
