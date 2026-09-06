import {describe,it,expect} from 'vitest';import {boundedJson,publicLeakCheckResult} from './leakcheck';
describe('public provider normalization',()=>{
 it('recognizes the observed public no-match envelope without swallowing other errors',()=>{expect(publicLeakCheckResult({success:false,error:'Not found'}).sources).toEqual([]);expect(()=>publicLeakCheckResult({success:false,error:'Rate limit'})).toThrow();});
 it('deduplicates exact source entries without converting record count into breach count',()=>{const r=publicLeakCheckResult({success:true,found:99,fields:['email'],sources:[{name:'Example',date:'2025'},{name:'Example',date:'2025'}]});expect(r.matchedRecords).toBe(99);expect(r.sources).toHaveLength(1);});
 it('rejects a failure or missing source details',()=>{expect(()=>publicLeakCheckResult({success:false})).toThrow();expect(()=>publicLeakCheckResult({success:true,found:1,fields:[],sources:[]})).toThrow();});
 it('bounds streamed response bytes',async()=>{await expect(boundedJson(new Response('x'.repeat(100)).body,10)).rejects.toThrow('BODY_TOO_LARGE');});
});