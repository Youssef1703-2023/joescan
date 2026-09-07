import {it,expect,vi,afterEach} from 'vitest';import {secureIndex,generateSecurePassword} from './securePassword';
afterEach(()=>vi.restoreAllMocks());
it('uses rejection sampling for an out-of-range random word',()=>{let n=0;vi.spyOn(crypto,'getRandomValues').mockImplementation((a:any)=>{a[0]=n++===0?0xffffffff:9;return a;});expect(secureIndex(10)).toBe(9);expect(n).toBe(2);});
it('includes every requested character class at the selected length',()=>{for(let i=0;i<30;i++){const p=generateSecurePassword({length:24,upper:true,lower:true,numbers:true,symbols:true});expect(p).toHaveLength(24);expect(p).toMatch(/[A-Z]/);expect(p).toMatch(/[a-z]/);expect(p).toMatch(/[0-9]/);expect(p).toMatch(/[^A-Za-z0-9]/);}});
it('respects disabled classes',()=>{expect(generateSecurePassword({length:16,upper:false,lower:false,numbers:true,symbols:false})).toMatch(/^[0-9]{16}$/);});
it('uses a lowercase fallback when all classes are disabled',()=>{expect(generateSecurePassword({length:16,upper:false,lower:false,numbers:false,symbols:false})).toMatch(/^[a-z]{16}$/);});
it('fails closed if cryptographic randomness is unavailable',()=>{vi.spyOn(crypto,'getRandomValues').mockImplementation(()=>{throw Error('unavailable')});const fallback=vi.spyOn(Math,'random');expect(()=>generateSecurePassword({length:16,upper:true,lower:true,numbers:true,symbols:true})).toThrow();expect(fallback).not.toHaveBeenCalled();});
it('rejects invalid lengths',()=>{expect(()=>generateSecurePassword({length:2,upper:true,lower:true,numbers:true,symbols:true})).toThrow();});
