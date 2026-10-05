/* Shared rendering keeps the HTML snapshot, live data and structured data aligned. */
(function(global){
  'use strict';
  const NAME='국가대표마스터태권도장';
  const BASE='https://mastertkd-sandong.kr/';
  const BLOG='https://blog.naver.com/master2546';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL=value=>{try{const u=new URL(String(value));return u.protocol==='https:'||u.protocol==='http:'?u.href:'';}catch{return '';}};
  const tel=value=>'tel:'+String(value||'').replace(/[^0-9+]/g,'');
  const cleanArray=value=>Array.isArray(value)?value.filter(v=>v&&typeof v==='object'):[];
  const image=(url,alt,priority=false)=>safeURL(url)?`<img src="${esc(safeURL(url))}" alt="${esc(alt)}" loading="${priority?'eager':'lazy'}" ${priority?'fetchpriority="high"':''} decoding="async" width="1200" height="900">`:'';
  const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
  const DEFAULT_SCHEDULE=[{name:'1부',start:'14:00',end:'14:50',target:''},{name:'2부',start:'15:00',end:'15:50',target:''},{name:'3부',start:'16:30',end:'17:20',target:''},{name:'4부',start:'17:30',end:'18:20',target:''},{name:'5부',start:'18:30',end:'19:25',target:''}];
  const DEFAULT_SCHEDULE_NOTE='아이의 나이와 하교 시간에 맞는 부를 상담으로 안내해 드립니다.';
  const TIME_QUESTION=/(수련|수업)\s*시간/;
  const hm=value=>{const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);return m?[Number(m[1]),Number(m[2])]:null;};
  const clock=value=>{const t=hm(value);return t?(t[0]%12||12)+':'+String(t[1]).padStart(2,'0'):String(value||'');};
  const period=value=>{const t=hm(value);return t?(t[0]<12?'오전':'오후'):'';};
  function timeRange(start,end){
    const ps=period(start),pe=period(end);
    return `${ps?ps+' ':''}${clock(start)}${end?` ~ ${pe&&pe!==ps?pe+' ':''}${clock(end)}`:''}`;
  }
  function normalize(raw){
    const d=raw||{};
    return {...d,basic:{phone:'054-471-6080',phone2:'010-2042-2546',address:'경북 구미시 산동읍 신당2로 29 대호프라자 8층',weekday_start:'11:30',weekday_end:'20:00',sat_start:'10:00',sat_end:'15:00',closed:'일요일 휴무',...d.basic},hero:d.hero||{},master:d.master||{},sections:d.sections||{},programs:cleanArray(d.programs),strengths:cleanArray(d.strengths),facility:cleanArray(d.facility),van:cleanArray(d.van).filter(v=>!/^OO/.test(String(v.name||''))),faq:cleanArray(d.faq),blog:cleanArray(d.blog),schedule:Array.isArray(d.schedule)?cleanArray(d.schedule).filter(x=>x.name||x.start):DEFAULT_SCHEDULE.map(x=>({...x})),schedule_note:typeof d.schedule_note==='string'?d.schedule_note:DEFAULT_SCHEDULE_NOTE};
  }
  function hasSchedule(d){return d.sections.schedule!==false&&d.schedule.length>0;}
  function scheduleText(d){
    const lines=d.schedule.map(x=>`${x.name||''} : ${timeRange(x.start,x.end)}${x.target?` (${x.target})`:''}`);
    return lines.join('\n')+(d.schedule_note?'\n'+d.schedule_note:'');
  }
  function faqs(d){
    // Keep answers managed by the owner; only supply missing service questions.
    const list=d.faq.map(f=>({...f}));
    // The class-time answer follows the timetable so the two never disagree.
    if(hasSchedule(d)){
      const i=list.findIndex(f=>TIME_QUESTION.test(String(f.q)));
      if(i>=0)list[i].a=scheduleText(d);else list.push({q:'수련 시간은 어떻게 되나요?',a:scheduleText(d)});
    }
    const additions=[
      {q:'방과 후 돌봄도 가능한가요?',a:'수련 전후 아이들이 안전하게 머물 수 있도록 도장 내 대기와 생활지도를 함께 운영합니다. 이용 가능 시간과 차량 노선은 아이의 학교와 하교 시간에 맞춰 상담해 주세요.'},
      {q:'태권도를 처음 배우는 아이도 참여할 수 있나요?',a:'처음 시작하는 아이도 연령과 수준에 맞춰 기본 동작부터 배웁니다. 유아체육, 태권도, 스포츠 활동을 통해 움직임과 수업 규칙을 단계적으로 익힙니다. 체험수업에서 적응 과정을 함께 살펴보세요.'},
      {q:'교육비와 차량 이용은 어떻게 상담하나요?',a:'아이의 나이, 학교 또는 유치원, 거주 지역, 희망 수업 시간을 알려주세요. 교육비와 차량 이용 가능 여부는 상담전화로 개별 안내해 드립니다.'}
    ];
    additions.forEach(f=>{const key=f.q.includes('돌봄')?'돌봄':f.q.includes('처음')?'처음':'교육비';if(!list.some(x=>String(x.q).includes(key)))list.push(f);});
    return list;
  }
  function nav(d){
    return [['about','도장 소개','strengths'],['programs','교육과정','programs'],['schedule','수업 시간표','schedule'],['care','돌봄 안내','care'],['van','차량운행','van'],['faq','자주 묻는 질문','faq']].filter(x=>x[2]==='schedule'?hasSchedule(d):d.sections[x[2]]!==false).map(x=>`<a href="#${x[0]}">${x[1]}</a>`).join('');
  }
  function renderSite(raw,images={}){
    const d=normalize(raw),b=d.basic,s=d.sections;
    const visible=key=>s[key]!==false;
    const call=tel(b.phone2||b.phone);
    const kakao=safeURL(b.kakao);
    const title=d.hero.line1||'다양한 경험,\n경험에서 오는 자신감';
    const titleLines=title.includes('\n')?title.split('\n'):title.includes(',')?title.split(/,\s*/).map((v,i)=>i===0?v+',':v):[title];
    const desc=d.hero.desc||'태권도를 기본으로, 유아체육부터 스포츠까지.\n아이의 하루에 즐거운 배움과 자신감을 더합니다.';
    const heroImg=images.hero_bg||images.gallery_0;
    const strengths=d.strengths.slice(0,3);
    const facility=d.facility.map((f,i)=>({label:f.label||'도장 시설',url:images['facility_'+i]})).filter(f=>safeURL(f.url));
    const gallery=Array.from({length:12},(_,i)=>({url:images['gallery_'+i],i})).filter(v=>safeURL(v.url));
    const faq=faqs(d);
    const schoolAge=faq.find(f=>String(f.q).includes('몇 세'));
    const ageLabel=schoolAge&&/5세/.test(schoolAge.a)?'5세부터 · 유치부 / 초등부':'유치부 / 초등부';
    const map=safeURL(b.mapurl)||'https://map.naver.com/v5/search/'+encodeURIComponent(b.address);
    const brand=`<img class="header-logo" src="dojo-logo.png" alt="" width="509" height="633"><span class="brand-text">국가대표마스터태권도장<small>MASTER TAEKWONDO · SANDONG</small></span>`;
    const footerBrand=`<span class="brand-text">국가대표마스터태권도장<small>MASTER TAEKWONDO · SANDONG</small></span>`;
    const standardCards=strengths.map((item,i)=>`<article class="standard-card"><div class="standard-photo">${image(images['strength_img_'+i]||images['prog_img_'+i]||heroImg,item.title+' · '+NAME)}</div><div class="standard-body"><span class="card-number">0${i+1} / OUR STANDARD</span><h3>${esc(item.title)}</h3><p>${esc(item.desc)}</p></div></article>`).join('');
    const programCards=d.programs.map((p,i)=>`<article class="program-card"><div class="program-photo">${image(images['prog_img_'+i],NAME+' '+p.title+' 수업')}</div><div class="program-body"><span class="program-tag">${esc(p.tag)}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p></div></article>`).join('');
    const showSchedule=hasSchedule(d);
    const showTarget=d.schedule.some(x=>x.target);
    const scheduleRows=d.schedule.map(x=>`<tr><th scope="row">${esc(x.name)}</th><td>${esc(timeRange(x.start,x.end))}</td>${showTarget?`<td class="schedule-target">${esc(x.target)}</td>`:''}</tr>`).join('');
    const phoneIcon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
    const chatIcon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.66 6.74L5.6 21.5l4.24-2.8c.7.1 1.42.15 2.16.15 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>';
    const blogCards=d.blog.filter(p=>safeURL(p.url)&&p.title).map(p=>`<article class="blog-card"><small>${esc(p.cat||'도장 소식')}</small><h3><a href="${esc(safeURL(p.url))}" target="_blank" rel="noopener">${esc(p.title)} ↗</a></h3><p>${esc(p.summary)}</p></article>`).join('');
    return `<a class="skip-link" href="#main-content">본문 바로가기</a>
<header class="site-header"><div class="wrap header-inner"><a class="brand" href="#home" aria-label="${NAME} 처음으로">${brand}</a><nav class="desktop-nav" aria-label="주 메뉴">${nav(d)}</nav><a class="header-call" href="${call}">상담 문의 ↗</a><details class="mobile-nav"><summary aria-label="전체 메뉴">메뉴 ☰</summary><nav class="mobile-menu" aria-label="모바일 메뉴">${nav(d)}<a href="#contact">체험수업 상담</a><a href="${BLOG}" target="_blank" rel="noopener">네이버 블로그 ↗</a></nav></details></div></header>
<main id="main-content">
<section class="hero" id="home" aria-label="구미 산동 태권도장 소개"><div class="wrap"><div class="hero-layout"><div class="hero-copy"><p class="location-pill">${esc(d.hero.badge||'구미 산동')} · 유치부 & 초등부</p><p class="eyebrow">Every experience builds confidence</p><h1>${titleLines.map(t=>`<span>${esc(t.trim())}</span>`).join('')}</h1>${d.hero.sub?`<p class="hero-small">${esc(d.hero.sub)}</p>`:''}<p class="hero-desc">${esc(desc)}</p><div class="hero-actions"><a class="button primary" href="#contact">무료 체험수업 상담 <span aria-hidden="true">↗</span></a>${visible('programs')?'<a class="button secondary" href="#programs">교육과정 살펴보기 <span aria-hidden="true">↓</span></a>':''}</div><p class="hero-small">구미 산동 · 대호프라자 8층${visible('care')?' &nbsp; | &nbsp; 수련 전후 돌봄':''}${visible('van')?' · 차량운행':''}</p></div><div class="hero-visual"><div class="hero-photo">${image(heroImg,NAME+' 아이들의 실제 수련 모습',true)}</div><span class="hero-index">MASTER TAEKWONDO / SANDONG</span><div class="photo-caption"><span class="caption-symbol" aria-hidden="true">↗</span><div><strong>작은 도전이, 큰 자신감으로.</strong><small>함께 움직이고 배우는 우리 아이의 시간</small></div></div></div></div><div class="quick-facts"><div><small>수련 대상</small><strong>${ageLabel}</strong></div><div><small>교육과정</small><strong>태권도 · 유아체육 · 스포츠</strong></div><div><small>위치</small><strong>구미 산동 대호프라자 8층</strong></div><div><small>상담전화</small><strong><a href="${call}">${esc(b.phone2||b.phone)}</a></strong></div></div></div></section>
${visible('strengths')?`<section class="section" id="about"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Our standard</p><h2 class="section-title">잘 배우는 시간,<br>안심하고 맡기는 하루.</h2></div><p class="section-desc">국가대표마스터태권도장은 구미시 산동읍의 유치부·초등부 중심 태권도장입니다. 아이의 성장과 도장에 머무는 하루를 함께 생각합니다.</p></div><div class="standards-grid">${standardCards}</div></div></section>`:''}
${visible('programs')?`<section class="section program-section" id="programs"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Our programs</p><h2 class="section-title">태권도를 기본으로,<br>경험의 폭은 더 넓게.</h2></div><p class="section-desc">유치부부터 초등학생까지, 연령과 수준을 고려해 움직임을 배웁니다. 다양한 활동 속에서 예절, 체력과 자신감을 함께 키웁니다.</p></div><div class="programs-grid">${programCards}</div><div class="section-tail"><span>${showSchedule?'부별 수업 시간은 아래 수업 시간표에서 확인하세요.':'아이에게 맞는 수업 시간은 상담 시 안내해 드립니다.'}</span><a href="${showSchedule?'#schedule':'#contact'}">${showSchedule?'수업 시간표 보기 ↓':'우리 아이 수업 상담하기 ↗'}</a></div></div></section>`:''}
${showSchedule?`<section class="section schedule-section" id="schedule"><div class="wrap schedule-layout"><div><p class="eyebrow">Class schedule</p><h2 class="section-title">부별 수업 시간,<br>한눈에 확인하세요.</h2>${d.schedule_note?`<p class="care-desc">${esc(d.schedule_note)}</p>`:''}<a class="text-link" href="#contact">우리 아이 수업 상담하기 <span aria-hidden="true">↗</span></a></div><div class="schedule-table-wrap"><table class="schedule-table"><caption>국가대표마스터태권도장 부별 수업 시간표</caption><thead><tr><th scope="col">구분</th><th scope="col">수업 시간</th>${showTarget?'<th scope="col" class="schedule-target">대상</th>':''}</tr></thead><tbody>${scheduleRows}</tbody></table></div></div></section>`:''}
${visible('master')?`<section class="section" id="master"><div class="wrap master-layout">${images.master_photo?`<div class="master-photo">${image(images.master_photo,(d.master.name||'')+' 관장')}</div>`:`<div class="master-note"><p class="eyebrow">Our philosophy</p><p class="quote">다양한 경험.<br>그 경험에서 오는 자신감.</p><small>국가대표마스터태권도장의 교육 철학</small></div>`}<div class="master-copy"><p class="eyebrow">Meet the master</p><h2 class="section-title">${d.master.name?esc(d.master.name)+' 관장과 함께,':'아이를 이해하는 지도,'}<br>한 걸음씩 성장합니다.</h2><p class="master-desc">${esc(d.master.desc)}</p><div class="master-badges">${(Array.isArray(d.master.badges)?d.master.badges:[]).map(x=>`<span class="master-badge">${esc(x)}</span>`).join('')}</div></div></div></section>`:''}
${visible('care')?`<section class="section care-section" id="care"><div class="wrap care-layout"><div><p class="eyebrow">Before & after class</p><h2 class="section-title">수련 앞뒤의 시간도,<br>아이의 하루니까.</h2><p class="care-desc">방과 후 수련 전후에는 도장 안에서 안전하게 머물 수 있도록 대기와 생활지도를 함께 운영합니다. 학교 하교 시간, 이용 가능 시간과 차량 노선은 상담을 통해 확인해 주세요.</p></div><div class="care-list">${[['등원','학교·주요 아파트 차량운행'],['수련 전','도장 내 대기와 생활지도'],['수련','연령과 수준에 맞춘 교육'],['하원','노선·시간에 따른 차량운행']].map((x,i)=>`<div class="care-row"><span class="step">0${i+1}</span><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('')}</div></div></section>`:''}
${visible('van')?`<section class="section" id="van"><div class="wrap route-layout"><div><p class="eyebrow">Shuttle service</p><h2 class="section-title">우리 아이 등하원,<br>먼저 확인해 보세요.</h2><p class="care-desc">거주하시는 아파트와 학교·유치원을 알려주시면 차량 이용 가능 여부와 시간을 안내해 드립니다. 정확한 승하차 지점과 노선은 상담 시 확인해 주세요.</p></div><div><div class="route-cards">${d.van.map(v=>`<div class="route-card"><strong>${esc(v.name)}</strong><small>${esc(v.type==='기타'?'운행 지역':v.type)}</small></div>`).join('')||'<p class="empty-state">상담 시 차량 노선을 안내해 드립니다.</p>'}</div><p class="route-note">${esc(d.van_note||'운행 지역과 시간은 상담 시 확인해 주세요.')}</p></div></div></section>`:''}
${visible('facility')&&facility.length?`<section class="section" id="facility"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Training space</p><h2 class="section-title">배움이 자라는 공간.</h2></div><p class="section-desc">실제 도장 시설을 사진으로 확인하세요.</p></div><div class="facility-grid">${facility.map(f=>`<article class="facility-card"><figure>${image(f.url,f.label+' · '+NAME)}</figure><p>${esc(f.label)}</p></article>`).join('')}</div></div></section>`:''}
${visible('gallery')?`<section class="section gallery-section" id="gallery"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Moments at master</p><h2 class="section-title">함께여서 더 즐거운,<br>우리의 수련 일상.</h2></div><a class="text-link" href="${BLOG}" target="_blank" rel="noopener">네이버 블로그에서 더 보기 <span aria-hidden="true">↗</span></a></div><div class="gallery-grid">${gallery.map(v=>`<div class="gallery-item">${image(v.url,NAME+' 수련 및 활동 사진 '+(v.i+1))}</div>`).join('')||'<p class="empty-state">새로운 수련 사진을 준비하고 있습니다.</p>'}</div></div></section>`:''}
${visible('faq')?`<section class="section" id="faq"><div class="wrap faq-layout"><div class="faq-intro"><p class="eyebrow">For parents</p><h2 class="section-title">처음 보내는 마음,<br>궁금한 것부터.</h2><p class="section-desc">태권도 시작 나이부터 수업 시간, 차량운행까지. 학부모님이 자주 물어보시는 내용을 모았습니다.</p></div><div class="faq-list">${faq.map(f=>`<details class="faq-item"><summary>${esc(f.q)}</summary><div class="faq-a">${esc(f.a)}</div></details>`).join('')}</div></div></section>`:''}
${visible('blog')?`<section class="section blog-section" id="blog"><div class="wrap"><div class="blog-callout"><div><h2>도장의 수업과 소식, 더 가까이.</h2><p>수업 기록과 행사, 아이들의 일상은 네이버 블로그에서 확인하세요.</p></div><a class="text-link" href="${BLOG}" target="_blank" rel="noopener">네이버 블로그 보기 ↗</a></div>${blogCards?`<div class="blog-grid">${blogCards}</div>`:''}</div></section>`:''}
<section class="section" id="first-visit"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Your first visit</p><h2 class="section-title">첫 수업, 이렇게 시작해요.</h2></div><p class="section-desc">우리 아이에게 맞는 수업인지, 직접 경험하고 결정하세요.</p></div><div class="consultation-steps">${[['상담으로 알아보기','아이의 나이, 학교·유치원, 거주 지역과 희망 시간을 알려주세요.'],['체험수업 일정 잡기','참여 가능한 수업 시간과 준비사항을 상담으로 안내받으세요.'],['아이와 함께 경험하기','수업 분위기와 아이의 적응 모습을 살펴보고 입관을 상담하세요.']].map((x,i)=>`<article class="consultation-step"><span class="card-number">0${i+1}</span><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join('')}</div></div></section>
<section class="contact-section" id="contact"><div class="wrap"><div class="contact-top"><div class="contact-copy"><p class="eyebrow">Let's start together</p><h2 class="section-title">우리 아이의 첫 도전,<br>함께 이야기해 볼까요?</h2><p>무료 체험수업과 입관 상담을 전화로 안내해 드립니다.</p></div><div class="contact-actions"><a class="button light" href="${call}">전화로 상담하기 ↗</a>${kakao?`<a class="button outline-light" href="${esc(kakao)}" target="_blank" rel="noopener">카카오톡 문의 ↗</a>`:''}</div></div><div class="contact-info"><div><small>도장 위치</small><strong>${esc(b.address)}</strong></div><div><small>운영시간${showSchedule?' · 부별 수업 시간은 위 시간표 참고':''}</small><strong>평일 ${esc(b.weekday_start)}–${esc(b.weekday_end)}<br>토요일 ${esc(b.sat_start)}–${esc(b.sat_end)} · ${esc(b.closed)}</strong></div><div><small>대표전화 / 상담전화</small><strong><a href="${tel(b.phone)}">${esc(b.phone)}</a><br><a href="${call}">${esc(b.phone2||b.phone)}</a></strong></div></div></div></section>
${visible('location')?`<section class="section" id="location"><div class="wrap location-layout"><div><p class="eyebrow">Find us</p><h2 class="section-title">구미 산동에서<br>만나요.</h2><p class="care-desc">${NAME}<br>방문 전 전화로 체험수업 일정을 확인해 주세요.</p></div><div class="address-card"><address>${esc(b.address)}</address><div class="map-links"><a href="${esc(map)}" target="_blank" rel="noopener">네이버 지도 ↗</a><a href="https://map.kakao.com/link/search/${esc(encodeURIComponent(b.address))}" target="_blank" rel="noopener">카카오맵 ↗</a><a href="https://www.google.com/maps/search/?api=1&query=${esc(encodeURIComponent(b.address))}" target="_blank" rel="noopener">구글 지도 ↗</a></div></div></div></section>`:''}
</main><footer class="site-footer"><div class="wrap"><div class="footer-top"><a class="brand" href="#home">${footerBrand}</a><a class="text-link" href="${BLOG}" target="_blank" rel="noopener">네이버 블로그 ↗</a></div><p class="footer-info">${esc(b.address)}<br>대표전화 ${esc(b.phone)} · 상담전화 ${esc(b.phone2||b.phone)}${b.ceo?` · 대표 ${esc(b.ceo)}`:''}${b.brn?` · 사업자등록번호 ${esc(b.brn)}`:''}</p><p class="footer-copy">© 2026 ${NAME}. All rights reserved.</p></div></footer><div class="float-cta${kakao?' has-kakao':''}" role="group" aria-label="빠른 상담"><a class="float-btn call" href="${call}">${phoneIcon}<span>전화 상담</span><small>${esc(b.phone2||b.phone)}</small></a>${kakao?`<a class="float-btn kakao" href="${esc(kakao)}" target="_blank" rel="noopener">${chatIcon}<span>카카오톡 상담</span></a>`:''}</div>`;
  }
  function structuredData(raw,images){
    const d=normalize(raw),b=d.basic;
    const business={'@type':'SportsActivityLocation','@id':BASE+'#school',name:NAME,url:BASE,description:'구미 산동 유치부·초등부 태권도장. 태권도, 유아체육과 스포츠 활동을 지도하며 수련 전후 돌봄, 차량운행과 무료 체험수업 상담을 운영합니다.',telephone:b.phone,address:{'@type':'PostalAddress',streetAddress:b.address,addressLocality:'구미시',addressRegion:'경상북도',addressCountry:'KR'},sameAs:[BLOG],contactPoint:{'@type':'ContactPoint',telephone:b.phone2||b.phone,contactType:'입관 및 체험수업 상담',availableLanguage:'ko'},openingHoursSpecification:[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:b.weekday_start,closes:b.weekday_end},{'@type':'OpeningHoursSpecification',dayOfWeek:'Saturday',opens:b.sat_start,closes:b.sat_end}]};
    if(safeURL(images.hero_bg))business.image=safeURL(images.hero_bg);
    if(d.sections.van!==false)business.areaServed=d.van.map(v=>({'@type':'Place',name:v.name}));
    const graph=[business,{'@type':'WebSite','@id':BASE+'#website',url:BASE,name:NAME,inLanguage:'ko-KR',publisher:{'@id':BASE+'#school'}},{'@type':'WebPage','@id':BASE+'#webpage',url:BASE,name:'구미 산동 태권도 · 유치부·초등부 | '+NAME,inLanguage:'ko-KR',isPartOf:{'@id':BASE+'#website'},about:{'@id':BASE+'#school'}}];
    if(d.sections.faq!==false)graph.push({'@type':'FAQPage','@id':BASE+'#faq',mainEntity:faqs(d).map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))});
    return {'@context':'https://schema.org','@graph':graph};
  }
  function createSnapshot(source,data,images){
    const doc=new DOMParser().parseFromString(source,'text/html');
    doc.getElementById('site-root').innerHTML=renderSite(data,images);
    doc.getElementById('site-data').textContent=json({data,images});
    doc.getElementById('structured-data').textContent=json(structuredData(data,images));
    const b=normalize(data).basic;
    const description='구미 산동 '+NAME+'. 유치부·초등부 태권도, 유아체육·스포츠, 수련 전후 돌봄과 차량운행. '+b.address+', 무료 체험수업 상담 '+(b.phone2||b.phone)+'.';
    ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]'].forEach(selector=>doc.querySelector(selector)?.setAttribute('content',description));
    return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML;
  }
  global.MasterSite={renderSite,structuredData,createSnapshot,normalize,faqs,json,scheduleText,timeRange,DEFAULT_SCHEDULE,DEFAULT_SCHEDULE_NOTE,TIME_QUESTION};
  if(typeof document==='undefined'||!document.getElementById('site-root'))return;
  document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(a)document.querySelector('.mobile-nav')?.removeAttribute('open');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('.mobile-nav')?.removeAttribute('open');});
  const seed=JSON.parse(document.getElementById('site-data').textContent);
  const startScrollY=global.scrollY;
  const timeout=promise=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Data request timed out')),7000))]);
  // Static HTML stays usable if the network or Firebase SDK is unavailable.
  (async()=>{
    try{
      const [appAPI,dbAPI]=await timeout(Promise.all([import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')]));
      const app=appAPI.initializeApp({apiKey:'AIzaSyBU2sUZxyZBUYkwiqKdP7CnYkwZIsAFqUo',authDomain:'taekwondo-fb6cb.firebaseapp.com',projectId:'taekwondo-fb6cb',storageBucket:'taekwondo-fb6cb.firebasestorage.app',messagingSenderId:'341364806097',appId:'1:341364806097:web:1ffc8cab03e427ce6d10f0'});
      const db=dbAPI.getFirestore(app);
      const results=await timeout(Promise.allSettled([dbAPI.getDoc(dbAPI.doc(db,'site','data')),dbAPI.getDoc(dbAPI.doc(db,'site','imageUrls'))]));
      const current=results.map((r,i)=>r.status==='fulfilled'&&r.value.exists()?r.value.data():[seed.data,seed.images][i]);
      const data={...seed.data,...current[0],basic:{...seed.data.basic,...current[0].basic}};
      const images=current[1];
      const next=renderSite(data,images);
      const root=document.getElementById('site-root');
      const previous=renderSite(seed.data,seed.images);
      if(next!==previous){
        const openQuestions=[...document.querySelectorAll('.faq-item[open] summary')].map(e=>e.textContent);
        const focused=document.activeElement;
        const focusedHref=focused?.getAttribute('href');
        const focusedSummary=focused?.tagName==='SUMMARY'?focused.textContent:null;
        const menuOpen=!!document.querySelector('.mobile-nav[open]');
        const y=global.scrollY;
        root.innerHTML=next;
        document.querySelectorAll('.faq-item').forEach(el=>{if(openQuestions.includes(el.querySelector('summary').textContent))el.open=true;});
        if(menuOpen)document.querySelector('.mobile-nav').open=true;
        if(focusedHref)[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===focusedHref)?.focus({preventScroll:true});
        if(focusedSummary)[...document.querySelectorAll('summary')].find(a=>a.textContent===focusedSummary)?.focus({preventScroll:true});
        if(y!==startScrollY)global.scrollTo({top:y,behavior:'instant'});
        document.getElementById('structured-data').textContent=json(structuredData(data,images));
      }
    }catch(error){console.warn('공개 홈페이지 데이터 동기화 실패: 저장된 HTML을 표시합니다.',error.message);}
  })();
})(typeof window!=='undefined'?window:globalThis);

