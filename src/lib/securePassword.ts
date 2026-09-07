export interface PasswordOptions {length:number;upper:boolean;lower:boolean;numbers:boolean;symbols:boolean}
// Rejection sampling prevents modulo bias. Never fall back to Math.random.
export function secureIndex(size:number):number {
 if(!Number.isInteger(size)||size<1||size>0x100000000)throw new Error('Invalid random range');
 const cutoff=Math.floor(0x100000000/size)*size;const value=new Uint32Array(1);
 for(let attempt=0;attempt<128;attempt++) {globalThis.crypto.getRandomValues(value);if(value[0]<cutoff)return value[0]%size;}
 throw new Error('Secure random generation failed');
}
export function generateSecurePassword(options:PasswordOptions):string {
 if(!Number.isInteger(options.length)||options.length<8||options.length>128)throw new Error('Password length must be between 8 and 128');
 const pools=[options.upper?'ABCDEFGHIJKLMNOPQRSTUVWXYZ':'',options.lower?'abcdefghijklmnopqrstuvwxyz':'',options.numbers?'0123456789':'',options.symbols?'!@#$%^&*()_+-=[]{}:;?,./~':''].filter(Boolean);
 if(!pools.length)pools.push('abcdefghijklmnopqrstuvwxyz');
 const alphabet=pools.join('');const chars=pools.map(pool=>pool[secureIndex(pool.length)]);
 while(chars.length<options.length)chars.push(alphabet[secureIndex(alphabet.length)]);
 for(let i=chars.length-1;i>0;i--){const j=secureIndex(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
 return chars.join('');
}
