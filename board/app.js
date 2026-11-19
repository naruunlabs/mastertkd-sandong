import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {getAuth,setPersistence,browserLocalPersistence,onAuthStateChanged,signInWithEmailAndPassword,GoogleAuthProvider,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {BoardStore,seoulDate,addDays,dueInfo,recordsFor,friendlyError} from './board-core.js?v=20261119.1';

const config={apiKey:'AIzaSyBU2sUZxyZBUYkwiqKdP7CnYkwZIsAFqUo',authDomain:'taekwondo-fb6cb.firebaseapp.com',projectId:'taekwondo-fb6cb',storageBucket:'taekwondo-fb6cb.firebasestorage.app',messagingSenderId:'341364806097',appId:'1:341364806097:web:1ffc8cab03e427ce6d10f0'};
const auth=getAuth(initializeApp(config)),endpoint='https://ebgoolsymyzkftvavpyj.supabase.co/functions/v1/personal-board';
const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
let area='all',editArea='naruun',store=null,documents=[],filter='tasks',activeUser=null,today=seoulDate(),lastSync=null,connectionError=false,editor=null,selectedKind='task',activeDraftKey=null,installPrompt=null,toastTimer=null,authGeneration=0;
const pending=new Set();
// One page, four tabs (2026-11-19): 전체 / 나른랩스 / 도장 / 개인. The hash picks the tab.
const TABS={all:{hash:'#all',theme:'naruun',brand:'나른 상황판',title:'오늘 한눈에.',text:'방문자와 오늘 집중할 일, 영역별 남은 일을 모아 봐요.'},
  naruun:{hash:'#naruun',theme:'naruun',brand:'나른랩스',title:'좋은 생각도, 할 일도.',text:'제품과 고객을 위한 다음 한 걸음을 적어요.'},
  dojang:{hash:'#dojang',theme:'dojang',brand:'도장',title:'오늘 도장에서 챙길 일.',text:'수업 사이에 떠오른 일도, 잊기 전에 적어요.'},
  etc:{hash:'#personal',theme:'personal',brand:'개인',title:'나를 위한 작은 기록.',text:'일상의 할 일과 떠오른 생각을 편하게 남겨요.'}};
const AREA_NAME={naruun:'나른랩스',dojang:'도장',etc:'개인'};
const VISIT_TILES=[['site','index','홈'],['site','kickmaster','킥'],['site','jumpmaster','점프'],['site','poomsaemaster','품새'],['site','academyweb','아카데미웹'],['dojang','mastertkd-home','도장 홈페이지'],['dojang','mastertkd-sandong','3D 도장']];
function tabFromHash(){const h=location.hash;return h==='#naruun'?'naruun':h==='#dojang'?'dojang':h==='#personal'||h==='#etc'?'etc':'all';}
function applyTab(){
  area=tabFromHash();const t=TABS[area];document.body.dataset.area=area;document.body.dataset.theme=t.theme;
  $('brandName').textContent=t.brand;$('introTitle').textContent=t.title;$('introText').textContent=t.text;document.title=area==='all'?'나른 상황판':t.brand+' · 나른 상황판';
  for(const a of document.querySelectorAll('[data-nav]')){if(a.dataset.nav===area)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  $('overview').hidden=area!=='all';$('areaView').hidden=area==='all';if(area!=='all')editArea=area;
}
function goTab(next){const h=TABS[next].hash;if(location.hash!==h)history.replaceState(null,'',h);applyTab();filter='tasks';paintFilter();render();window.scrollTo(0,0);}
for(const a of document.querySelectorAll('[data-nav]'))a.addEventListener('click',e=>{e.preventDefault();goTab(a.dataset.nav);});
window.addEventListener('hashchange',()=>{applyTab();render();});
applyTab();
function setViews(view){for(const id of ['loginView','boardView','loadingView'])$(id).hidden=id!==view;}
function updateDate(){today=seoulDate();$('dateLine').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date());}
updateDate();
function toast(text,undo){clearTimeout(toastTimer);const box=$('toast');box.replaceChildren(document.createTextNode(text));box.hidden=false;if(undo){const b=node('button',null,'되돌리기');b.type='button';b.onclick=async()=>{b.disabled=true;try{await undo();box.hidden=true;}catch(e){b.disabled=false;$('boardNotice').textContent=friendlyError(e);}};box.append(b);}toastTimer=setTimeout(()=>box.hidden=true,15000);}
function stateChanged(state,error){
  const status=$('syncStatus');status.classList.toggle('error',state==='error');connectionError=state==='error';
  if(state==='synced'||state==='saved'){lastSync=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());status.textContent=(state==='saved'?'저장됨':'동기화됨')+' · '+lastSync;$('boardNotice').textContent='';}
  else if(state==='saving')status.textContent='저장 중…';
  else {status.textContent=lastSync?'연결 확인 필요 · 마지막 '+lastSync:'연결 확인 필요';$('boardNotice').textContent=friendlyError(error||{});if(error?.status===401){$('loginNotice').textContent='다시 로그인해 주세요.';setViews('loginView');}}
  render();
}
async function refresh(){if(!store||pending.size)return;const b=$('refresh');if(b.disabled)return;b.disabled=true;try{await store.load();}catch{}finally{b.disabled=false;}}
function mark(text,cls=''){return node('span','tag '+cls,text);}
function makeEntry(record){
  const t=record.data,row=node('article','entry'+(t.done?' done':''));row.dataset.id=record.id;
  const isNote=['note','idea'].includes(t.entryKind);
  if(isNote&&!t.done)row.append(node('span','record-mark',t.entryKind==='idea'?'✦':'≡'));
  else{const hit=node('label','entry-check'),cb=document.createElement('input');cb.type='checkbox';cb.checked=!!t.done;cb.disabled=pending.has(record.id);cb.setAttribute('aria-label',t.text+(t.done?' 완료 취소':' 완료'));cb.onchange=()=>toggleDone(record,cb);hit.append(cb);row.append(hit);}
  const body=node('button','entry-body');body.type='button';body.setAttribute('aria-label',t.text+' 수정');body.append(node('span','entry-title',t.text));const meta=node('span','entry-meta');
  if(area==='all')meta.append(mark(AREA_NAME[t.area]||'개인','area-'+(t.area||'etc')));
  if(t.entryKind==='idea')meta.append(mark('아이디어'));else if(t.entryKind==='note')meta.append(mark('메모'));
  if(t.status==='waiting'&&!t.done)meta.append(mark('답변 대기','waiting'));
  const due=dueInfo(t.due,today);if(due&&!t.done)meta.append(mark((t.status==='waiting'?'확인 ':'')+due.label,due.className));
  if(t.auto)meta.append(mark('자동 점검'));
  if(t.doneAt)meta.append(mark(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(t.doneAt))+' 완료'));
  if(meta.children.length)body.append(meta);const description=t.note||t.reasons?.join(' · ');if(description)body.append(node('span','entry-note',description));body.onclick=()=>openEditor(record);
  row.append(body);const edit=node('button','entry-arrow','›');edit.type='button';edit.setAttribute('aria-label',t.text+' 수정');edit.onclick=()=>openEditor(record);row.append(edit);return row;
}
function isTask(d){return d.collection==='todos'&&!d.data.done&&!['note','idea'].includes(d.data.entryKind);}
function focusScore(t){return(t.due&&t.due<today?1000:t.due===today?700:0)+(String(t.source||'').startsWith('err')?150:0)+(t.status==='waiting'?-100:0);}
function focusTop(){
  // Same order as the PC board: pinned first, then late/today, one card per customer.
  const groups=new Map();for(const d of documents.filter(isTask)){const key=d.data.customer?'c:'+(d.data.area||'etc')+':'+d.data.customer:d.id;const g=groups.get(key);if(!g||(d.data.focusRank??9999)<(g.data.focusRank??9999)||((d.data.focusRank??9999)===(g.data.focusRank??9999)&&focusScore(d.data)>focusScore(g.data)))groups.set(key,d);}
  return[...groups.values()].sort((a,b)=>(a.data.focusRank??9999)-(b.data.focusRank??9999)||focusScore(b.data)-focusScore(a.data)||(a.data.due||'9999').localeCompare(b.data.due||'9999')||(a.data.createdAt||0)-(b.data.createdAt||0)).filter(d=>(d.data.focusRank??9999)<9999||!d.data.due||d.data.due<=today).slice(0,3);
}
function renderVisits(){
  const box=$('visits');box.replaceChildren();const v=store?.visits;
  if(!v){box.append(node('p','ov-empty',store?.loaded?'방문자 숫자를 불러오지 못했어요.':'불러오는 중…'));return;}
  const from7=addDays(today,-6),from14=addDays(today,-13);
  for(const [kind,key,label] of VISIT_TILES){
    const rows=(kind==='site'?v.site:v.dojang)||[],val=r=>Number(kind==='site'?r.visitors:r.visits)||0,mine=rows.filter(r=>(kind==='site'?r.page:r.site)===key);
    const sum=(a,b)=>mine.filter(r=>r.day>=a&&r.day<=b).reduce((n,r)=>n+val(r),0),now=sum(today,today),last=sum(from7,today),prev=sum(from14,addDays(today,-7));
    const tile=node('div','vt'+(kind==='dojang'?' dj':''));tile.title=kind==='site'?'방문자: 기기마다 하루 한 번':'방문 횟수: 열 때마다';
    tile.append(node('span','l',label),node('b','v',now.toLocaleString('ko-KR')));const s=node('span','s','7일 '+last.toLocaleString('ko-KR'));
    if(prev>0){const pct=Math.round((last-prev)/prev*100);s.append(node('i',pct>0?'up':pct<0?'down':'',' '+(pct>0?'▲':pct<0?'▼':'·')+Math.abs(pct)+'%'));}
    tile.append(s);box.append(tile);
  }
}
function renderOverview(){
  renderVisits();const tasks=documents.filter(isTask);$('taskCount').textContent='오늘까지 '+tasks.filter(d=>d.data.due&&d.data.due<=today).length+'개';
  const focus=$('focusList');focus.replaceChildren();
  if(!store?.loaded){focus.append(node('p','ov-empty',connectionError?'기록을 불러오지 못했어요.':'불러오는 중…'));}
  else{const top=focusTop();if(!top.length)focus.append(node('p','ov-empty','오늘 급한 일은 없어요.'));top.forEach(r=>focus.append(makeEntry(r)));}
  const sum=$('areaSummary');sum.replaceChildren();
  for(const key of ['naruun','dojang','etc']){
    const mine=tasks.filter(d=>(d.data.area||'etc')===key),late=mine.filter(d=>d.data.due&&d.data.due<today&&d.data.status!=='waiting').length,now=mine.filter(d=>d.data.due===today&&d.data.status!=='waiting').length,wait=mine.filter(d=>d.data.status==='waiting').length;
    const b=node('button','area-card'+(key==='dojang'?' dj':key==='etc'?' me':''));b.type='button';b.onclick=()=>goTab(key);
    const info=node('span','ac-info');info.append(node('b',null,AREA_NAME[key]));const tags=node('span','ac-tags');
    if(late)tags.append(mark(late+'개 지남','late'));if(now)tags.append(mark('오늘 '+now,'today'));if(wait)tags.append(mark('답변 대기 '+wait,'waiting'));if(!late&&!now&&!wait)tags.append(mark('급한 일 없음'));
    info.append(tags);b.append(info,node('span','ac-num',String(mine.length)),node('span','ac-arrow','›'));sum.append(b);
  }
}
function render(){
  if(area==='all'){renderOverview();return;}
  const box=$('entries');box.replaceChildren();const all=documents.filter(d=>d.collection==='todos'&&d.data.area===area&&!d.data.done);
  const tasks=all.filter(d=>!['note','idea'].includes(d.data.entryKind)),notes=all.filter(d=>['note','idea'].includes(d.data.entryKind));$('countTasks').textContent=String(tasks.length);$('countNotes').textContent=String(notes.length);$('taskCount').textContent='오늘까지 '+tasks.filter(d=>d.data.due&&d.data.due<=today).length+'개';
  if(!store?.loaded){const empty=node('div','empty-state');empty.append(node('b',null,connectionError?'기록을 불러오지 못했어요':'기록을 불러오는 중이에요'),node('span',null,'새로고침으로 다시 확인할 수 있어요.'));box.append(empty);return;}
  const rows=recordsFor(documents,area,filter);
  if(!rows.length){const empty=node('div','empty-state');empty.append(node('span','empty-icon',filter==='done'?'✓':'✦'),node('b',null,filter==='done'?'완료한 일이 여기에 모여요':filter==='notes'?'떠오른 생각을 남겨보세요':'가볍게, 하나씩 시작해요'),node('span',null,filter==='done'?'완료한 기록은 다시 되돌릴 수 있어요.':'위의 ‘잊기 전에 적어두기’를 눌러보세요.'));box.append(empty);return;}
  if(filter!=='tasks'){rows.forEach(r=>box.append(makeEntry(r)));return;}
  const groups=[['기한 지남',r=>r.data.due&&r.data.due<today&&r.data.status!=='waiting',false],['오늘',r=>r.data.due===today&&r.data.status!=='waiting',false],['답변 대기',r=>r.data.status==='waiting',false],['예정',r=>r.data.due>today&&r.data.status!=='waiting',true],['기한 없음',r=>!r.data.due&&r.data.status!=='waiting',true]];
  for(const [label,predicate,folded] of groups){const group=rows.filter(predicate);if(!group.length)continue;if(folded){const d=node('details');d.append(node('summary',null,label+' '+group.length+'개'));group.forEach(r=>d.append(makeEntry(r)));box.append(d);}else{box.append(node('h2','section-label',label+' '+group.length));group.forEach(r=>box.append(makeEntry(r)));}}
}
async function toggleDone(record,checkbox){
  if(!store||pending.has(record.id))return;pending.add(record.id);checkbox.disabled=true;
  try{const updated=await store.write({id:record.id,revision:record.revision,data:{done:checkbox.checked,doneAt:checkbox.checked?Date.now():null}});toast(checkbox.checked?'완료했어요. PC 상황판에도 반영돼요.':'완료를 취소했어요.',()=>store.write({id:record.id,revision:updated.revision,data:{done:!!record.data.done,doneAt:record.data.doneAt||null}}));}
  catch(e){checkbox.checked=!!record.data.done;$('boardNotice').textContent=friendlyError(e);if(e.code==='conflict')await refresh();}
  finally{pending.delete(record.id);render();}
}
function draftKey(id){return'personal-board:draft:'+activeUser.uid+':'+(id||'new');}
function readDraft(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function persistDraft(){if(!activeDraftKey||!editor)return;try{localStorage.setItem(activeDraftKey,JSON.stringify({id:editor.id,revision:editor.revision,createdAt:editor.createdAt,area:editArea,text:$('entryText').value,note:$('entryNote').value,due:$('entryDue').value,status:$('entryStatus').value,kind:selectedKind}));}catch{}}
function clearDraft(){try{localStorage.removeItem(activeDraftKey);}catch{}}
function chooseArea(a){editArea=a;for(const b of document.querySelectorAll('[data-pick-area]'))b.setAttribute('aria-pressed',String(b.dataset.pickArea===a));}
function chooseKind(kind){selectedKind=kind;for(const b of document.querySelectorAll('[data-kind]'))b.setAttribute('aria-pressed',String(b.dataset.kind===kind));}
function paintDate(){const due=$('entryDue').value;for(const b of document.querySelectorAll('[data-due]')){const val=b.dataset.due==='none'?'':b.dataset.due==='today'?today:addDays(today,1);b.setAttribute('aria-pressed',String(due===val));}const custom=due&&due!==today&&due!==addDays(today,1);$('customDateLabel').hidden=!custom;}
function openEditor(record){
  if(!activeUser)return;const key=draftKey(record?.id),draft=readDraft(key),t=record?.data||{};
  activeDraftKey=key;editor={record,id:record?.id||draft?.id||'mobile-'+crypto.randomUUID(),revision:record?.revision??0,createdAt:t.createdAt||draft?.createdAt||Date.now()};
  const canRestore=draft&&(!record||draft.revision===record.revision);const values=canRestore?draft:t;
  $('entryText').value=values.text||'';$('entryNote').value=values.note||'';$('entryDue').value=values.due||'';$('entryStatus').value=values.status||'open';chooseKind(values.kind||values.entryKind||'task');chooseArea(values.area||(area!=='all'?area:editArea)||'naruun');paintDate();$('editorHeading').textContent=record?'기록 수정':'새 기록';$('saveEntry').textContent='저장하기';$('saveEntry').disabled=false;
  $('editorNotice').textContent=draft&&!canRestore?'다른 기기에서 바뀐 최신 내용을 표시했어요.':canRestore?'작성 중이던 내용을 이어서 보여드려요.':'';
  const remove=$('removeEntry');remove.hidden=!record;remove.disabled=false;
  const complete=$('completeEntry');complete.hidden=!record;complete.textContent=record?.data.done?'완료 취소':selectedKind==='task'?'완료하기':'보관하기';complete.disabled=false;
  $('entryEditor').showModal();$('entryText').focus();
}
async function saveEntry(e){
  e.preventDefault();if(!editor||!store||$('saveEntry').disabled)return;const text=$('entryText').value.trim();if(!text)return;
  const status=$('entryStatus').value,due=$('entryDue').value||null;if(status==='waiting'&&!due){$('editorNotice').textContent='답변을 다시 확인할 날짜를 정해 주세요.';$('customDateLabel').hidden=false;$('entryDue').focus();return;}
  persistDraft();const savedEditor=editor;$('saveEntry').disabled=true;$('saveEntry').textContent='저장 중…';$('editorNotice').textContent='';
  const data={text,note:$('entryNote').value.trim(),due,status,entryKind:selectedKind,area:editArea};
  if(!savedEditor.record)Object.assign(data,{done:false,createdAt:savedEditor.createdAt,source:null});
  try{await store.write({id:savedEditor.id,mode:savedEditor.record?'patch':'put',data,revision:savedEditor.revision});clearDraft();$('entryEditor').close();toast('저장했어요. PC 상황판에도 함께 표시돼요.');filter=selectedKind==='task'?'tasks':'notes';paintFilter();render();}
  catch(error){$('editorNotice').textContent=friendlyError(error);if(error.code==='conflict'){await refresh();const current=documents.find(d=>d.id===savedEditor.id&&d.collection==='todos');const expected={...data,done:false,createdAt:savedEditor.createdAt,source:null};if(current&&!savedEditor.record&&Object.entries(expected).every(([k,v])=>current.data[k]===v)){clearDraft();$('entryEditor').close();toast('이미 저장된 기록을 확인했어요.');}}}
  finally{$('saveEntry').disabled=false;$('saveEntry').textContent='저장하기';}
}
function paintFilter(){for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));}
$('quickAdd').onclick=()=>openEditor(null);$('entryForm').onsubmit=saveEntry;$('closeEditor').onclick=()=>{persistDraft();$('entryEditor').close();};$('entryEditor').addEventListener('cancel',persistDraft);
$('completeEntry').onclick=async()=>{if(!editor?.record||!store)return;const r=editor.record,b=$('completeEntry');b.disabled=true;try{const updated=await store.write({id:r.id,revision:r.revision,data:{done:!r.data.done,doneAt:r.data.done?null:Date.now()}});clearDraft();$('entryEditor').close();toast(r.data.done?'완료를 취소했어요.':'완료했어요.',()=>store.write({id:r.id,revision:updated.revision,data:{done:!!r.data.done,doneAt:r.data.doneAt||null}}));}catch(e){$('editorNotice').textContent=friendlyError(e);}finally{b.disabled=false;}};
$('removeEntry').onclick=async()=>{if(!editor?.record||!store)return;const r=editor.record,b=$('removeEntry');b.disabled=true;try{const removed=await store.write({id:r.id,mode:'delete',revision:r.revision});clearDraft();$('entryEditor').close();toast(r.data.auto?'삭제했어요. PC 점검 조건이 남으면 다시 나타날 수 있어요.':'기록을 삭제했어요.',()=>store.write({id:r.id,mode:'put',data:r.data,revision:removed.revision}));}catch(e){$('editorNotice').textContent=friendlyError(e);}finally{b.disabled=false;}};
for(const id of ['entryText','entryNote','entryDue','entryStatus'])$(id).addEventListener('input',persistDraft);
for(const b of document.querySelectorAll('[data-pick-area]'))b.onclick=()=>{chooseArea(b.dataset.pickArea);persistDraft();};
for(const b of document.querySelectorAll('[data-kind]'))b.onclick=()=>{chooseKind(b.dataset.kind);persistDraft();};
for(const b of document.querySelectorAll('[data-due]'))b.onclick=()=>{$('entryDue').value=b.dataset.due==='none'?'':b.dataset.due==='today'?today:addDays(today,1);paintDate();persistDraft();};
$('chooseDate').onclick=()=>{$('customDateLabel').hidden=false;$('entryDue').focus();};$('entryDue').addEventListener('change',()=>{paintDate();persistDraft();});
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;paintFilter();render();};
$('refresh').onclick=refresh;$('account').onclick=()=>{$('accountEmail').textContent=activeUser?.email||'로그인 전';$('logout').hidden=!activeUser;$('accountDialog').showModal();};$('closeAccount').onclick=()=>$('accountDialog').close();$('logout').onclick=async()=>{$('accountDialog').close();await signOut(auth);};
$('loginForm').onsubmit=async e=>{e.preventDefault();const b=$('loginButton');b.disabled=true;$('loginNotice').textContent='';try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);$('password').value='';}catch{$('loginNotice').textContent='이메일과 비밀번호를 확인해 주세요.';}finally{b.disabled=false;}};
$('googleLogin').onclick=async()=>{const b=$('googleLogin');b.disabled=true;try{await signInWithPopup(auth,new GoogleAuthProvider());}catch{$('loginNotice').textContent='로그인 창을 열지 못했어요. 이메일과 비밀번호로 로그인해 주세요.';}finally{b.disabled=false;}};
await setPersistence(auth,browserLocalPersistence).catch(()=>{$('loginNotice').textContent='이 브라우저에서는 로그인 상태가 유지되지 않을 수 있어요.';});
onAuthStateChanged(auth,user=>{
  const generation=++authGeneration;store?.dispose();store=null;documents=[];activeUser=user;lastSync=null;connectionError=false;$('toast').hidden=true;for(const d of document.querySelectorAll('dialog[open]'))d.close();
  if(!user){setViews('loginView');return;}setViews('boardView');$('accountEmail').textContent=user.email||'';
  store=new BoardStore({endpoint,getToken:force=>user.getIdToken(force),onData:docs=>{if(generation!==authGeneration)return;documents=docs;render();},onState:(s,e)=>{if(generation!==authGeneration)return;if(e?.status===403){$('loginNotice').textContent='본인의 도장 관리자 계정으로 로그인해 주세요.';signOut(auth);return;}stateChanged(s,e);}});render();setTimeout(()=>{if(generation===authGeneration)refresh();},0);
});
window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateDate();refresh();}});setInterval(()=>{if(!document.hidden){updateDate();refresh();}},12000);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('installApp').hidden=false;});$('installApp').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('installApp').hidden=true;};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
