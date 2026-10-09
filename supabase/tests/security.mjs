// Isolated PostgreSQL (WASM), never connects to a remote database.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pg_trgm } });
const baseline = process.argv.includes('--baseline');
console.log((await db.query('SELECT version() AS version')).rows[0].version);
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA extensions;
 CREATE TABLE auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`);
const dir = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
  // External HTTP/cron integrations are unavailable in PGlite. No RLS is skipped.
  if (file.startsWith('0006_') || file.startsWith('0010_')) continue;
  if (baseline && file.startsWith('0025_')) continue;
  try { await db.exec(await readFile(new URL(file, dir), 'utf8')); }
  catch(e) { throw new Error(`migration ${file}: ${e.message}`); }
}
const host='10000000-0000-0000-0000-000000000001';
const member='10000000-0000-0000-0000-000000000002';
const outsider='10000000-0000-0000-0000-000000000003';
const group='20000000-0000-0000-0000-000000000001';
const other='20000000-0000-0000-0000-000000000002';
const victim='30000000-0000-0000-0000-000000000001';
const slots=[{day:'2026-10-10',start_minute:540,end_minute:555}];
await db.exec(`
 INSERT INTO auth.users VALUES
 ('${host}','host@example.test','{"sub":"host","nickname":"방장"}'),
 ('${member}','member@example.test','{"sub":"member","nickname":"멤버"}'),
 ('${outsider}','outsider@example.test','{"sub":"outsider","nickname":"외부"}');
 INSERT INTO public.groups(id,host_id,name,dates) VALUES
 ('${group}','${host}','테스트 모임',ARRAY['2026-10-10'::date]),
 ('${other}','${outsider}','다른 모임',ARRAY['2026-10-10'::date]);
 INSERT INTO public.group_members(group_id,user_id) VALUES ('${group}','${member}');
 INSERT INTO public.group_guests(guest_token,group_id,nickname) VALUES ('${victim}','${group}','기존 게스트');
 INSERT INTO public.votes(group_id,guest_token,day,start_minute,end_minute)
 VALUES ('${group}','${victim}','2026-10-10',540,555);
`);
async function as(role, uid, fn) {
 await db.exec(`SET ROLE ${role}`);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [uid ?? '']);
 try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}
const query=async (sql, params=[]) => (await db.query(sql, params)).rows;
const rpc=async (name,args) => (await query(`SELECT public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) AS value`,args))[0].value;
let passed=0;
async function test(name, fn) { await fn(); console.log(`PASS ${++passed}: ${name}`); }
try {
 if (baseline) {
  await as('anon',null,async()=>{
   await test('SEC-1: anon dumps three users including email/kakao_id',async()=>assert.equal((await query('SELECT email,kakao_id FROM public.users')).length,3));
   await test('SEC-2: anon harvests victim token then deletes victim votes',async()=>{
    const rows=await query('SELECT guest_token,group_id FROM public.group_guests');
    assert.equal(rows[0].guest_token,victim);
    assert.equal((await query('SELECT guest_token FROM public.votes'))[0].guest_token,victim);
    await rpc('save_guest_votes',[rows[0].group_id,rows[0].guest_token,'[]']);
    assert.equal((await query('SELECT * FROM public.votes')).length,0);
   });
  });
 } else {
  await as('anon',null,async()=>{
   await test('SEC-1: anon cannot read users',async()=>assert.equal((await query('SELECT * FROM public.users')).length,0));
   await test('SEC-3: anon cannot enumerate groups',async()=>assert.equal((await query('SELECT * FROM public.groups')).length,0));
   await test('SEC-2: anonymous table token harvesting denied',async()=>{
    for(const table of ['group_guests','votes'])
     await assert.rejects(query(`SELECT guest_token FROM public.${table}`), {code:'42501'});
   });
   await test('direct guest registration/forged credentials denied',async()=>{
    await assert.rejects(query(`INSERT INTO public.group_guests(group_id,nickname,guest_token) VALUES ($1,'공격',$2)`,[group,victim]),{code:'42501'});
    await assert.rejects(query(`INSERT INTO public.votes(group_id,guest_token,day,start_minute,end_minute) VALUES ($1,$2,'2026-10-10',555,570)`,[group,victim]),{code:'42501'});
   });
   let guest;
   await test('guest registration returns only own generated credential',async()=>{
    guest=await rpc('register_guest',[group,'새 게스트']);
    assert.ok(guest.guest_token && guest.guest_id);
    assert.notEqual(guest.guest_token,guest.guest_id);
    assert.notEqual(guest.guest_token,victim);
   });
   await test('returning guest lookup is scoped to both group and secret',async()=>{
    assert.equal((await rpc('get_guest_session',[group,guest.guest_token])).nickname,'새 게스트');
    assert.equal(await rpc('get_guest_session',[other,guest.guest_token]),null);
    assert.equal(await rpc('get_guest_session',[group,guest.guest_id]),null);
   });
   await test('unknown group/invalid nickname rejected',async()=>{
    for(const nickname of ['',null,'x'.repeat(21)])
     await assert.rejects(rpc('register_guest',[group,nickname]),{code:'22023'});
    await assert.rejects(rpc('register_guest',['20000000-0000-0000-0000-000000000099','손님']),{code:'42501'});
    assert.equal(await rpc('get_guest_group_view',['20000000-0000-0000-0000-000000000099',null]),null);
   });
   await test('own save and re-entry selection + server heatmap preserved',async()=>{
    await rpc('save_guest_votes',[group,guest.guest_token,JSON.stringify(slots)]);
    const view=await rpc('get_guest_group_view',[group,guest.guest_token]);
    assert.equal(view.users.nickname,'방장');
    assert.equal(view.votes.length,1);
    assert.equal(view.votes[0].is_own,true);
    assert.equal(view.heatmap[0].count,2);
    assert.equal(view.participants.length,3);
    assert.equal(view.participants.find(p=>p.name==='새 게스트').hasVoted,true);
    assert.equal(JSON.stringify(view).includes('guest_token'),false);
    assert.equal(JSON.stringify(view).includes('kakao_id'),false);
    assert.equal(JSON.stringify(view).includes('@example.test'),false);
    assert.equal((await rpc('get_guest_group_view',[group,null])).votes.length,0);
   });
   await test('public guest_id / random / cross-group credentials cannot write',async()=>{
    const view=await rpc('get_guest_group_view',[group,null]);
    const victimId=view.participants.find(p=>p.name==='기존 게스트').guest_id;
    for(const secret of [victimId,guest.guest_id,null,'30000000-0000-0000-0000-000000000099'])
     await assert.rejects(rpc('save_guest_votes',[group,secret,'[]']),{code:'42501'});
    await assert.rejects(rpc('save_guest_votes',[other,guest.guest_token,'[]']),{code:'42501'});
   });
   await test('invalid payload does not erase previous votes',async()=>{
    for(const payload of [null,'{}','null',JSON.stringify([{...slots[0],day:'2026-10-11'}]),
      JSON.stringify([{...slots[0],start_minute:541}]),JSON.stringify([{...slots[0],end_minute:570}]),
      JSON.stringify([{day:'2026-10-10'}]),JSON.stringify(Array(61).fill(slots[0]))]) {
     await assert.rejects(rpc('save_guest_votes',[group,guest.guest_token,payload]));
     assert.equal((await rpc('get_guest_group_view',[group,guest.guest_token])).votes.length,1);
    }
   });
   await test('own replace/clear leaves victim votes intact',async()=>{
    await rpc('save_guest_votes',[group,guest.guest_token,JSON.stringify([{...slots[0],start_minute:555,end_minute:570}])]);
    assert.equal((await rpc('get_guest_group_view',[group,guest.guest_token])).votes[0].start_minute,555);
    await rpc('save_guest_votes',[group,guest.guest_token,'[]']);
    assert.equal((await rpc('get_guest_group_view',[group,guest.guest_token])).votes.length,0);
   });

  });
  await test('victim data survives every denied/mutating attack',async()=>{
   assert.equal((await query('SELECT * FROM public.votes WHERE guest_token=$1',[victim])).length,1);
  });
  for(const uid of [host,member,outsider]) await as('authenticated',uid,async()=>{
   await test(`authenticated ${uid.slice(-1)} cannot select credentials`,async()=>{
    for(const table of ['group_guests','votes']) {
     await assert.rejects(query(`SELECT guest_token FROM public.${table}`),{code:'42501'});
     await assert.rejects(query(`SELECT * FROM public.${table}`),{code:'42501'});
     await assert.rejects(query(`SELECT 1 FROM public.${table} WHERE guest_token=$1`,[victim]),{code:'42501'});
    }
   });
   await test(`authenticated ${uid.slice(-1)} safe read retains membership RLS`,async()=>{
    const rows=await query('SELECT day,start_minute FROM public.votes');
    assert.equal(rows.length,uid===outsider?0:1);
    assert.equal((await query('SELECT guest_id,nickname FROM public.group_guests')).length,uid===outsider?0:2);
   });
  });
  await as('authenticated',member,async()=>{
   await test('native member vote insert/select/delete still works',async()=>{
    await query(`INSERT INTO public.votes(group_id,user_id,day,start_minute,end_minute) VALUES ($1,$2,'2026-10-10',555,570)`,[group,member]);
    assert.equal((await query('SELECT day,start_minute FROM public.votes WHERE user_id=$1',[member])).length,1);
    await query('DELETE FROM public.votes WHERE user_id=$1',[member]);
   });
  });
  await db.query('INSERT INTO public.blocks(blocker_id,blocked_id) VALUES ($1,$2)',[member,host]);
  await as('authenticated',member,async()=>{
   await test('authenticated block rules also apply to definer guest RPCs',async()=>{
    assert.equal(await rpc('get_guest_group_view',[group,null]),null);
    assert.equal(await rpc('get_guest_session',[group,victim]),null);
    await assert.rejects(rpc('register_guest',[group,'차단']),{code:'42501'});
    await assert.rejects(rpc('save_guest_votes',[group,victim,'[]']),{code:'42501'});
    assert.equal((await query('SELECT id FROM public.users WHERE id=$1',[host])).length,0);
   });
  });
  await test('RPC search_path pinned and PUBLIC execute revoked',async()=>{
   const rows=await query(`SELECT proname,proconfig,has_function_privilege('anon',oid,'EXECUTE') allowed
     FROM pg_proc WHERE proname IN ('register_guest','get_guest_session','get_guest_group_view','save_guest_votes')`);
   assert.equal(rows.length,4);
   for(const row of rows) { assert.ok(row.proconfig.some(c=>c.startsWith('search_path='))); assert.equal(row.allowed,true); }
   assert.equal((await query(`SELECT count(*)::int AS n FROM pg_proc p,
     LATERAL aclexplode(p.proacl) a WHERE p.proname IN
     ('register_guest','get_guest_session','get_guest_group_view','save_guest_votes')
     AND a.grantee=0 AND a.privilege_type='EXECUTE'`))[0].n,0);
  });
 }
} finally { await db.close(); }
