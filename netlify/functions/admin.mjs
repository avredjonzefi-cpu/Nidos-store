import {getStore} from '@netlify/blobs';
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import initialCatalog from '../../catalog.json' with {type:'json'};
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
const token=(secret,exp)=>`${exp}.${createHmac('sha256',secret).update(String(exp)).digest('hex')}`;
const authorized=(req,secret)=>{const v=(req.headers.get('cookie')||'').match(/(?:^|; )nidos_admin=([^;]+)/)?.[1];if(!v)return false;const [exp,sig]=decodeURIComponent(v).split('.');return /^\d+$/.test(exp)&&Number(exp)>Date.now()&&eq(token(secret,exp),`${exp}.${sig}`)};
export default async(req)=>{if(req.method!=='POST')return json({error:'Metodë e pavlefshme'},405);const secret=process.env.NIDOS_ADMIN_SECRET,password=process.env.NIDOS_ADMIN_PASSWORD;if(!secret||!password||secret.length<32)return json({error:'ADMIN nuk është konfiguruar ende në Netlify. Duhet të vendosen variablat sekrete.'},503);let data;try{data=await req.json()}catch{return json({error:'Kërkesë e pavlefshme'},400)}
if(data.action==='login'){if(!eq(data.password||'',password))return json({error:'Fjalëkalim i gabuar'},401);const exp=Date.now()+8*60*60*1000;return json({ok:true},200,{'Set-Cookie':`nidos_admin=${token(secret,exp)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`})}
if(data.action==='logout')return json({ok:true},200,{'Set-Cookie':'nidos_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
if(!authorized(req,secret))return json({error:'Hyrje e paautorizuar'},401);
if(data.action==='session')return json({ok:true});
if(!['add','update','delete'].includes(data.action))return json({error:'Veprim i pavlefshëm'},400);
try{const store=getStore('nidos-products');let products=await store.get('catalog',{type:'json'});if(!products)products=structuredClone(initialCatalog);
if(data.action==='add'||data.action==='update'){const p=data.product||{},existing=data.action==='update'?products.find(x=>x.id===data.id):null;if(data.action==='update'&&!existing)return json({error:'Produkti nuk u gjet'},404);const photos=p.photos===undefined?(existing?(existing.photos?.length?existing.photos:[existing.photo]):[]):p.photos;
if(typeof p.name!=='string'||!p.name.trim()||p.name.length>120||!['Femra','Meshkuj'].includes(p.category)||!Number.isFinite(Number(p.price))||Number(p.price)<=0||Number(p.price)>10000000||!Array.isArray(photos)||photos.length<1||photos.length>5||photos.some(photo=>typeof photo!=='string'||!(photo.startsWith('data:image/webp;base64,')?/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(photo)&&photo.length<=650000:photo.length<=500&&/^[a-zA-Z0-9_./-]+$/.test(photo)))||JSON.stringify(photos).length>2800000)return json({error:'Zgjidh 1–5 foto (maksimumi rreth 450 KB secila).'},400);
const next={id:existing?.id||randomUUID(),name:p.name.trim(),category:p.category,price:Number(p.price),sizes:String(p.sizes||'').slice(0,120),photo:photos[0],photos};if(existing)products=products.map(x=>x.id===existing.id?next:x);else products.push(next)}
else products=products.filter(p=>p.id!==data.id);
await store.setJSON('catalog',products);return json({products});}catch(e){return json({error:'Gabim gjatë ruajtjes. Kontrollo Netlify Blobs.'},500)}};
