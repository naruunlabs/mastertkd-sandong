export const AREA_LABELS={naruun:'나른랩스',dojang:'도장',etc:'개인'};
export function seoulDate(date=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function addDays(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function dueInfo(due,today=seoulDate()){
  if(!due)return null;const diff=Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
  if(diff<0)return{label:`${-diff}일 지남`,className:'late'};
  if(diff===0)return{label:'오늘',className:'today'};
  if(diff===1)return{label:'내일',className:''};
  return{label:new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(due+'T00:00:00Z')),className:''};
}
export function taskSort(a,b){return(a.data.due||'9999').localeCompare(b.data.due||'9999')||(a.data.createdAt||0)-(b.data.createdAt||0)||a.id.localeCompare(b.id);}
export function recordsFor(documents,area,filter){
  return documents.filter(d=>d.collection==='todos'&&!d.deleted&&(d.data.area||'etc')===area).filter(d=>filter==='done'?d.data.done:!d.data.done&&(filter==='notes'?['note','idea'].includes(d.data.entryKind):!['note','idea'].includes(d.data.entryKind))).sort(filter==='done'?(a,b)=>(b.data.doneAt||0)-(a.data.doneAt||0):taskSort);
}
export function friendlyError(error){
  if(error.code==='conflict')return'다른 기기에서 이 기록이 바뀌었어요. 목록을 새로고침한 뒤 다시 열어 주세요. 작성 내용은 보관했어요.';
  if(error.status===401)return'로그인 연결이 만료됐어요. 다시 로그인해 주세요.';
  if(error.status===403)return'본인의 도장 관리자 계정만 사용할 수 있어요.';
  return'연결하지 못했어요. 작성 내용은 이 기기에 보관했으니 연결 후 다시 저장해 주세요.';
}
export class BoardStore {
  constructor({endpoint,getToken,onData=()=>{},onState=()=>{},fetcher=(...args)=>fetch(...args)}){Object.assign(this,{endpoint,getToken,onData,onState,fetcher});this.documents=new Map();this.generation=0;this.loaded=false;this.disposed=false;this.saving=0;}
  async request(method,body,retry=true){
    const token=await this.getToken(false);const response=await this.fetcher(this.endpoint,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(response.status===401&&retry){await this.getToken(true);return this.request(method,body,false);}
    let result;try{result=await response.json();}catch{result={error:'invalid_response'};}
    if(!response.ok){const error=new Error(result.error||'request_failed');error.code=result.error;error.status=response.status;throw error;}
    return result;
  }
  emit(){if(!this.disposed)this.onData([...this.documents.values()].filter(d=>!d.deleted));}
  async load(){
    if(this.disposed||this.saving)return;const generation=++this.generation;
    try{const result=await this.request('GET');if(generation!==this.generation||this.disposed)return;
      if(!Array.isArray(result.documents)||result.documents.some(d=>!d||!d.id||!d.data||typeof d.data!=='object'))throw Error('invalid_documents');
      this.documents=new Map(result.documents.map(d=>[d.collection+'/'+d.id,d]));this.visits=result.visits||null;this.loaded=true;this.emit();this.onState('synced');
    }catch(error){if(generation===this.generation&&!this.disposed)this.onState('error',error);throw error;}
  }
  async write({id,collection='todos',mode='patch',data={},revision}){
    if(this.disposed)throw Error('signed_out');++this.generation;++this.saving;this.onState('saving');
    try{const result=await this.request('POST',{id,collection,mode,data,...(revision!==undefined?{revision}:{})});
      if(this.disposed)throw Error('signed_out');++this.generation;
      if(result.document){const d=result.document;this.documents.set(d.collection+'/'+d.id,d);this.emit();}
      this.onState('saved');return result.document;
    }catch(error){if(!this.disposed)this.onState('error',error);throw error;}finally{--this.saving;}
  }
  dispose(){this.disposed=true;++this.generation;this.documents.clear();}
}
