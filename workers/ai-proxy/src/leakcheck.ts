export async function boundedJson(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<any> {
  if (!body) throw new Error('EMPTY_BODY');
  const reader = body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c,offset); offset += c.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function publicLeakCheckResult(data: any) {
  // The public service uses this exact envelope for a successful no-match lookup.
  if (data?.success === false && data?.error === 'Not found') data = {success:true,found:0,sources:[],fields:[]};
  if (data?.success !== true || !Number.isSafeInteger(data.found) || data.found < 0 || !Array.isArray(data.sources) || !Array.isArray(data.fields)) throw new Error('INVALID_PROVIDER_RESPONSE');
  if (data.sources.length > 2000 || data.fields.length > 100) throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
  const sources: {name:string;date:string}[] = []; const seen = new Set<string>();
  for (const source of data.sources) {
    if (typeof source?.name !== 'string' || !source.name.trim() || source.name.length > 256 || typeof source.date !== 'string' || source.date.length > 32) throw new Error('INVALID_PROVIDER_RESPONSE');
    const key = source.name.trim().toLowerCase() + '|' + source.date;
    if (!seen.has(key)) { sources.push({name:source.name.trim(),date:source.date}); seen.add(key); }
  }
  if (data.found > 0 && sources.length === 0) throw new Error('INCOMPLETE_PROVIDER_RESPONSE');
  // Whitelist output. Never forward arbitrary records, passwords, or identifiers.
  return { source:'LeakCheck Public', matchedRecords:data.found, sources,
    fields: data.fields.filter((f:unknown): f is string => typeof f === 'string' && f.length <= 80),
    checkedAt:new Date().toISOString() };
}
