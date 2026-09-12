import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({records:[] as any[],fail:false}));
vi.mock('../lib/firebase',()=>({auth:{currentUser:{uid:'test'}},db:{}}));
vi.mock('firebase/firestore',()=>({collection:vi.fn(),where:vi.fn(),orderBy:vi.fn(),query:vi.fn(),onSnapshot:(_:any,ok:any,error:any)=>{if(state.fail)error(Error('offline'));else ok({docs:state.records.map(r=>({id:r.id,data:()=>r}))});return vi.fn()}}));
vi.mock('./AiQuotaMeter',()=>({default:()=>null}));
vi.mock('./BadgeSystem',()=>({computeTier:()=>({name:'Bronze'})}));
vi.mock('recharts',async()=>{const React=await import('react');return Object.fromEntries(['ResponsiveContainer','AreaChart','Area','XAxis','YAxis','Tooltip','PieChart','Pie','Cell','RadarChart','Radar','PolarGrid','PolarAngleAxis'].map(n=>[n,({children}:any)=>React.createElement('div',null,children)]))});
import Dashboard from './Dashboard';
beforeEach(()=>{state.records=[];state.fail=false});
describe('Focus dashboard',()=>{
 it('does not imply a perfect score for an empty account',()=>{render(<Dashboard onNavigate={vi.fn()}/>);expect(screen.queryByText('100')).toBeNull();expect(screen.getByText('Your next step starts here.')).toBeTruthy()});
 it('shows a load failure instead of treating it as no reports',()=>{state.fail=true;render(<Dashboard onNavigate={vi.fn()}/>);expect(screen.getByText('Your reports are unavailable')).toBeTruthy()});
 it('passes a password only through the start callback and clears the input',()=>{const start=vi.fn();render(<Dashboard onNavigate={vi.fn()} onStart={start}/>);fireEvent.click(screen.getByRole('button',{name:'Password'}));const input=screen.getByLabelText('password to check');fireEvent.change(input,{target:{value:'test-password-only'}});fireEvent.submit(input.closest('form')!);expect(start).toHaveBeenCalledWith('password','test-password-only');expect((input as HTMLInputElement).value).toBe('')});
 it('redacts password targets even for old saved records',()=>{state.records=[{id:'old',type:'password',target:'legacy-secret',securityScore:70,riskLevel:'LOW'}];render(<Dashboard onNavigate={vi.fn()}/>);expect(screen.queryByText('legacy-secret')).toBeNull();expect(screen.getByText('70')).toBeTruthy()});
});

