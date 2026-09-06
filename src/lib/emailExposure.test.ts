import {describe,it,expect,vi,afterEach} from 'vitest';
import {fetchEmailExposure,parseEmailBreaches,assessEmailBreaches,EmailSourceError} from './emailExposure';
const breach={breach:'Example',xposed_data:'Email addresses;Passwords',xposed_date:'2025',details:'Provider description'};
afterEach(()=>vi.unstubAllGlobals());
describe('email exposure evidence',()=>{
 it('does not truncate large breach lists or lose descriptions',()=>{const rows=parseEmailBreaches({ExposedBreaches:{breaches_details:Array.from({length:31},(_,i)=>({...breach,breach:'Record '+i}))}});expect(rows).toHaveLength(31);expect(rows[0].description).toBe('Provider description');});
 it('never marks password or stealer exposure as low risk',()=>{expect(assessEmailBreaches([{name:'Example',date:'2025',dataExposed:'Passwords'}]).riskLevel).toBe('High');expect(assessEmailBreaches([{name:'Stealer logs',date:'2025',dataExposed:'Email addresses'}]).riskLevel).toBe('High');expect(assessEmailBreaches([{name:'Example',date:'2025',dataExposed:'Email addresses'}]).riskLevel).toBe('Medium');});
 it('accepts documented no-match analytics response',()=>{expect(parseEmailBreaches({ExposedBreaches:null,BreachMetrics:null,BreachesSummary:{site:''}})).toEqual([]);});
 it.each([{},null,{Error:'Internal error'},{ExposedBreaches:{breaches_details:[{}]}},{ExposedBreaches:{breaches_details:[]},BreachesSummary:{site:'Missing'}}])('rejects malformed or incomplete results %j',data=>{expect(()=>parseEmailBreaches(data)).toThrow(EmailSourceError);});
 it.each([429,500,403])('does not turn HTTP %i into a clean report',async status=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status,json:async()=>({Error:'Not found'})}));await expect(fetchEmailExposure('test@example.com','en')).rejects.toThrow(EmailSourceError);});
 it('does not turn network failure into a clean report',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));await expect(fetchEmailExposure('test@example.com','en')).rejects.toThrow(EmailSourceError);});
 it('returns sourced facts without an AI request',async()=>{const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ExposedBreaches:{breaches_details:[breach]}})});vi.stubGlobal('fetch',fetch);const report=await fetchEmailExposure('test@example.com','en');expect(report.source).toBe('XposedOrNot');expect(report.riskLevel).toBe('High');expect(report.reportText).toContain('1 breaches');expect(fetch).toHaveBeenCalledTimes(1);});
});
