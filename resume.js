/* Same-origin handoff of an already received listening result. No submissions. */
(function(root){
 'use strict';
 const normalized=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const key=(p,code)=>'science-g3-dashboard-receipt-v1:'+encodeURIComponent(p.className+'|'+normalized(p.name)+'|'+code);
 function valid(r,p,code){
  return !!(p&&r&&r.schema===1&&r.source==='parent-dashboard'&&r.code===code+'-LS'&&r.className===p.className&&normalized(r.name)===normalized(p.name)&&
   typeof r.score==='number'&&Number.isFinite(r.score)&&r.score>=0&&r.total===30&&r.score<=r.total&&typeof r.submittedAt==='string'&&r.submittedAt.trim());
 }
 function read(storage,p,code){try{const r=JSON.parse(storage.getItem(key(p,code)));return valid(r,p,code)?r:null;}catch{return null;}}
 function write(storage,p,code,feedback){
  if(!p||!feedback||feedback.contentMissing||!feedback.submittedAt||feedback.score===null||feedback.score===undefined||feedback.score==='')return false;
  const r={schema:1,source:'parent-dashboard',name:p.name,className:p.className,code:code+'-LS',score:Number(feedback.score),total:Number(feedback.maximum),submittedAt:String(feedback.submittedAt)};
  if(!valid(r,p,code))return false;
  try{storage.setItem(key(p,code),JSON.stringify(r));return true;}catch{return false;}
 }
 const api={key,valid,read,write};root.ScienceResume=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
