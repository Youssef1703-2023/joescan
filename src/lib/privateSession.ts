export interface ApiSettings {provider:'gemini'|'groq'|'grok';geminiKey:string;groqKey:string;grokKey:string;openrouterKey?:string}
let owner:string|null=null;let settings:ApiSettings|null=null;
const empty=():ApiSettings=>({provider:'gemini',geminiKey:'',groqKey:'',grokKey:''});
export function clearPrivateSession(){owner=null;settings=null;try{localStorage.removeItem('joe_api_settings');localStorage.removeItem('joescan_cyber_assistant_history');}catch{}}
export function readPrivateSettings(uid:string|null):ApiSettings{if(owner!==uid){settings=null;owner=uid;}return uid&&settings?{...settings}:empty();}
export function writePrivateSettings(uid:string|null,value:ApiSettings){if(!uid)throw Error('Sign in to use custom keys');owner=uid;settings={...value};}
clearPrivateSession();
