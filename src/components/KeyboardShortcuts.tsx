import {useEffect} from 'react';
import type {TabId} from '../lib/workspaceRoutes';

const SHORTCUTS:Partial<Record<string,TabId>>={e:'email',p:'password',l:'url',m:'message',d:'domain',h:'history',w:'watchlist',b:'blog'};
interface Props {onNavigate:(tab:TabId)=>void;allowedTabs:readonly TabId[];enabled:boolean}
/** Ctrl+Shift+key opens an available tool. Ctrl/Cmd+K belongs to Signal Navigation. */
export default function KeyboardShortcuts({onNavigate,allowedTabs,enabled}:Props){
 useEffect(()=>{
  if(!enabled)return;
  const handle=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||!event.ctrlKey||!event.shiftKey||event.altKey||event.metaKey)return;
   const target=event.target as HTMLElement|null;
   if(target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))return;
   if(document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))return;
   const tab=SHORTCUTS[event.key.toLowerCase()];
   if(tab&&allowedTabs.includes(tab)){event.preventDefault();onNavigate(tab)}
  };
  window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
 },[enabled,allowedTabs,onNavigate]);
 return null;
}
