import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({records:[] as any[],fail:false,remove:vi.fn()}));
vi.mock('../lib/firebase',()=>({auth:{currentUser:{uid:'owner'}},db:{}}));
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({lang:'en',t:(key:string)=>key})}));
vi.mock('firebase/firestore',()=>({collection:vi.fn(),where:vi.fn(),orderBy:vi.fn(),query:vi.fn(),doc:vi.fn(),deleteDoc:state.remove,getDocs:async()=>{if(state.fail)throw Error('offline');return {docs:state.records.map(r=>({id:r.id,data:()=>r}))}}}));
vi.mock('./IntelligenceReport',()=>({default:({scan}:any)=><div role="dialog">{scan.target}</div>}));
import ScanHistory from './ScanHistory';
beforeEach(()=>{state.records=[];state.fail=false;state.remove.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true)});
const record=(id:string,extra:any={})=>({id,type:'email',target:id+'@example.com',riskLevel:'High',createdAt:{toDate:()=>new Date('2026-09-08T10:00:00Z')},...extra});
describe('Focus scan history',()=>{
 it('distinguishes load failure from an empty history',async()=>{state.fail=true;render(<ScanHistory/>);expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('Your story starts with a check.')).toBeNull()});
 it('combines search and risk filters without treating missing risk as low',async()=>{state.records=[record('alice'),record('bob',{riskLevel:undefined})];render(<ScanHistory/>);await screen.findByText('alice@example.com');fireEvent.change(screen.getByLabelText('Risk filter'),{target:{value:'unknown'}});expect(screen.queryByText('alice@example.com')).toBeNull();expect(screen.getByText('bob@example.com')).toBeTruthy();fireEvent.change(screen.getByLabelText('Search scans'),{target:{value:'alice'}});expect(screen.getByText('No matching checks')).toBeTruthy()});
 it('keeps password targets redacted when opening reports',async()=>{state.records=[record('pwd',{type:'password',target:'legacy-secret'})];render(<ScanHistory/>);await screen.findByRole('button',{name:'Report'});expect(screen.queryByText('legacy-secret')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Report'}));expect(screen.getByRole('dialog').textContent).not.toContain('legacy-secret')});
 it('returns to the previous page when its last record is deleted',async()=>{state.records=Array.from({length:9},(_,i)=>record(String(i)));render(<ScanHistory/>);await screen.findByText('0@example.com');fireEvent.click(screen.getByLabelText('Next page'));fireEvent.click(screen.getByLabelText('Delete check: 8@example.com'));await waitFor(()=>expect(screen.getByText('0@example.com')).toBeTruthy());expect(state.remove).toHaveBeenCalledTimes(1)});
});
