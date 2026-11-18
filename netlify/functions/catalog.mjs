import {getStore} from '@netlify/blobs';
import initialCatalog from '../../catalog.json' with {type:'json'};
export default async () => {try{const store=getStore('nidos-products');const saved=await store.get('catalog',{type:'json'});const products=saved||structuredClone(initialCatalog);return Response.json({products},{headers:{'Cache-Control':'no-store'}})}catch(e){return Response.json({error:'Katalogu nuk u ngarkua'},{status:500})}};
