import {describe,it,expect} from 'vitest';
import {groupEmailEvidence,parseExtraExposure} from './emailEvidence';
const extra={source:'LeakCheck Public',matchedRecords:36,sources:[{name:'1Win',date:'2024-11'}],fields:['password'],checkedAt:'2026-09-06T12:00:00Z'};
describe('combined exposure evidence',()=>{
 it('groups exact names and dates while retaining each provider',()=>{const rows=groupEmailEvidence([{name:'1win',date:'2024-11',dataExposed:'Emails'}],extra);expect(rows).toHaveLength(1);expect(rows[0].evidence.map(e=>e.provider)).toEqual(['XposedOrNot','LeakCheck Public']);expect(rows[0].evidence[1].categories).toBeUndefined();});
 it('groups a compatible year-only date but does not infer aliases',()=>{expect(groupEmailEvidence([{name:'1Win',date:'2024',dataExposed:'Emails'},{name:'1 Win',date:'2024-11',dataExposed:'Emails'}],extra)).toHaveLength(2);});
 it('does not merge generic compilations with missing dates',()=>{expect(groupEmailEvidence([{name:'Stealer Logs',date:'',dataExposed:'Emails'}],{...extra,sources:[{name:'Stealer Logs',date:''}]})).toHaveLength(2);});
 it('keeps all entries and treats record totals separately',()=>{const rows=groupEmailEvidence([],extra);expect(rows).toHaveLength(1);expect(extra.matchedRecords).toBe(36);});
 it('keeps main evidence when the optional source is absent',()=>{expect(groupEmailEvidence([{name:'Example',date:'2025',dataExposed:'Passwords',description:'Evidence'}],null)[0].evidence[0].description).toBe('Evidence');});
 it.each([null,{}, {...extra,matchedRecords:0},{...extra,sources:[]},{...extra,fields:[42]},{...extra,checkedAt:'bad'}])('rejects incomplete provider responses %j',data=>{expect(()=>parseExtraExposure(data)).toThrow();});
 it('accepts explicit zero matches',()=>{expect(parseExtraExposure({...extra,matchedRecords:0,sources:[],fields:[]}).matchedRecords).toBe(0);});
 it('strips arbitrary top-level and source fields from exportable results',()=>{const result=parseExtraExposure({...extra,password:'secret',sources:[{name:'Example',date:'2025',password:'secret'}]});expect(JSON.stringify(result)).not.toContain('secret');});
});
