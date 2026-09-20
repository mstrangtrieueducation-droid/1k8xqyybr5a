'use strict';
const lesson = window.SCIENCE_LESSON;
const logic = window.LessonLogic;
const stages = ['listen', 'map', 'talk', 'questions'];
const labels = ['Nghe & điền script', 'Mindmap', 'Thuyết trình', 'Câu hỏi'];
const student = window.ScienceSystem.getProfile();
const storageKey = window.ScienceSystem.key(student);
const empty = () => ({ answers: {}, responses: {}, firstAttempt: null, scriptSubmitted: false, mapDone: false, talkDone: false, questionsDone: false, lastStage: 'listen', speed: '1' });
let state = empty();
let storageOK = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && typeof saved === 'object') state = { ...state, ...saved, answers: saved.answers && typeof saved.answers === 'object' ? saved.answers : {}, responses: saved.responses && typeof saved.responses === 'object' ? saved.responses : {} };
} catch { storageOK = false; }
const main = document.getElementById('main');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const gaps = logic.getGaps(lesson);
let current = 'listen';
let segmentEnd = null;
let audio = null;
let noticeTimer;

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); storageOK = true; }
  catch { storageOK = false; }
  document.getElementById('save-note').innerHTML = storageOK
    ? 'Đã lưu trên trình duyệt này.<br>Em có thể nghỉ rồi mở lại.<br><small>Dùng cùng thiết bị và trình duyệt để tiếp tục.</small>'
    : 'Trình duyệt chưa lưu được tiến độ. Em hãy bật lưu trữ để tiếp tục ở lần học sau.';
  const status = document.getElementById('save-status');
  if (status) status.textContent = storageOK ? 'Đã lưu trên thiết bị này' : 'Chưa lưu được trên thiết bị';
}
function notify(text) {
  let node = document.getElementById('notice');
  if (!node) { node = document.createElement('div'); node.id = 'notice'; node.className = 'notice'; node.setAttribute('role', 'status'); document.body.append(node); }
  node.textContent = text; node.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => node.hidden = true, 6500);
}
function nav() {
  document.getElementById('steps').innerHTML = stages.map((s, i) => {
    const permitted = logic.allowed(lesson, state, s);
    const done = [state.scriptSubmitted, state.mapDone, state.talkDone, state.questionsDone][i];
    const status = done ? 'Đã hoàn thành' : s === current ? 'Đang làm' : permitted ? 'Có thể bắt đầu' : `Hoàn thành chặng ${i} để mở`;
    return `<button class="step ${s === current ? 'active' : ''}" data-stage="${s}" ${!permitted ? 'disabled' : ''} ${s === current ? 'aria-current="step"' : ''}><span>${done ? '✓' : '0' + (i + 1)}</span><div>${labels[i]}<small>${status}</small></div></button>`;
  }).join('');
}
function title(index, heading, intro) {
  return `<div class="title-row"><div><p class="eyebrow">BÀI 01 · A CLOSER LOOK AT GERMS / CHẶNG ${index}</p><h1>${heading}</h1></div><span class="lesson-tag">NGHE → HIỂU → NÓI</span></div><p class="intro">${intro}</p><div class="route-tools"><button class="text-button" id="copy-stage">Sao chép link chặng này</button><span id="save-status">Đã lưu trên thiết bị này</span></div>`;
}
function pauseFooter(next, caption) {
  return `<div class="stage-footer"><button class="secondary" data-pause>Để lần sau làm tiếp</button>${next ? `<button class="primary" data-stage="${next}">${caption}</button>` : ''}</div>`;
}
function gapHTML(g) {
  const checked = state.scriptSubmitted;
  const correct = logic.isCorrect(g, state.answers[g.id]);
  const n = g.answer.split(/\s+/).length;
  return `<label class="gap ${checked ? correct ? 'correct' : 'incorrect' : ''}"><sup>${g.id}</sup><span class="gap-stack"><input id="gap-${g.id}" data-gap="${g.id}" value="${esc(state.answers[g.id])}" aria-label="Ô trống ${g.id}, ${n} từ" placeholder="${n} từ" autocomplete="off" spellcheck="false" autocapitalize="off" style="--gap-width:${Math.max(110, Math.min(450, g.answer.length * 9 + 26))}px" ${checked ? `aria-describedby="feedback-${g.id}"` : ''}>${checked ? `<span class="gap-feedback" id="feedback-${g.id}">${correct ? '✓ Đúng' : 'Đáp án: ' + esc(g.answer)}</span>` : ''}</span></label>`;
}
function listenView() {
  const count = logic.filled(lesson, state);
  const score = logic.score(lesson, state);
  const total = gaps.length;
  main.innerHTML = title(1, 'Nghe & điền script', `Điền <strong>${total} chỗ trống</strong> gồm từ khóa và những cụm diễn đạt hữu ích. Mỗi ô ghi số từ cần điền. Nghe từng đoạn; có thể dừng và làm tiếp vào lần khác.`) +
    `<section class="player"><div><strong>Audio bài học · ${lesson.durationLabel}</strong><span>Chỉ nghe âm thanh từ video bài 01</span><div class="audio-actions"><button id="play-all">Nghe toàn bài</button><label>Tốc độ <select id="speed" aria-label="Tốc độ audio"><option value="0.75">0,75×</option><option value="0.9">0,9×</option><option value="1">1×</option></select></label></div></div><audio id="audio" controls controlslist="nodownload" preload="metadata" src="assets/germs.mp3"></audio><p id="audio-error" role="status" hidden></p></section>` +
    `<div class="progress-panel"><div><strong id="filled-count">${count}/${total} ô đã điền</strong><span>Điền đủ rồi kiểm tra để mở mindmap</span></div><progress id="script-progress" value="${count}" max="${total}" aria-label="Tiến độ điền script"></progress></div>` +
    `<form id="script-form">${lesson.chunks.map((c, i) => `<article class="script-card"><div class="chunk-head"><div><p class="eyebrow">ĐOẠN ${i + 1} · ${c.timeLabel}</p><h2>${esc(c.title)}</h2></div><button type="button" class="listen-button" data-play="${i}" aria-label="Nghe đoạn ${i + 1}: ${esc(c.title)}">▶ Nghe đoạn ${i + 1}</button></div><p class="script-text" lang="en">${c.parts.map(p => typeof p === 'string' ? esc(p) : gapHTML(p)).join('')}</p><div class="chunk-bottom"><button type="button" class="text-button" data-hint="${i}">Gợi ý chữ đầu</button><span class="hint" id="hint-${i}" hidden>${c.parts.filter(p => typeof p === 'object').map(p => p.id + ': ' + esc(p.answer.split(' ').map(w => w[0]+'…').join(' '))).join(' · ')}</span></div></article>`).join('')}
    <div class="check-box" id="check-result" role="status">${state.scriptSubmitted ? `<strong>Đã kiểm tra: ${score}/${total} ô đúng.</strong><p>${score === total ? 'Em đã điền đúng toàn bộ script.' : 'Đọc lại đáp án dưới các ô chưa đúng và nghe lại đoạn đó.'} Mindmap đã mở để em học ở chặng tiếp theo.</p>` : '<strong>Hoàn thành script trước khi xem mindmap.</strong><p>Viết hoa, khoảng trắng thừa và dấu câu không làm em mất điểm.</p>'}</div><div class="stage-footer"><button type="button" class="secondary" data-pause>Lưu lại, làm tiếp lần sau</button><button type="submit" class="primary">${state.scriptSubmitted ? 'Kiểm tra lại script' : 'Kiểm tra script'}</button></div></form>` +
    (state.scriptSubmitted ? `<div class="next-chapter"><span>Chặng 02 đã sẵn sàng. Em không cần làm ngay hôm nay.</span><button class="primary" data-stage="map">Mở mindmap →</button></div>` : '');
  audio = document.getElementById('audio');
  const speed = document.getElementById('speed'); speed.value = state.speed;
  audio.playbackRate = Number(state.speed) || 1;
  audio.addEventListener('timeupdate', () => {
    if (segmentEnd !== null && audio.currentTime >= segmentEnd) { audio.pause(); segmentEnd = null; document.querySelectorAll('[data-play]').forEach(b => b.classList.remove('playing')); }
  });
  audio.addEventListener('error', () => { const e = document.getElementById('audio-error'); e.hidden = false; e.textContent = 'Không tải được audio. Em kiểm tra kết nối rồi mở lại bài.'; });
  speed.addEventListener('change', () => { state.speed = speed.value; audio.playbackRate = Number(speed.value); save(); });
  document.getElementById('play-all').onclick = () => playAudio(0, null);
  document.getElementById('script-form').addEventListener('submit', event => { event.preventDefault(); checkScript(); });
}
async function playAudio(start, end) {
  segmentEnd = end;
  try { audio.currentTime = start; await audio.play(); }
  catch { notify('Em bấm nút phát trên thanh audio để cho phép nghe.'); }
}
function checkScript() {
  const missing = gaps.filter(g => !logic.normalize(state.answers[g.id]));
  if (missing.length) {
    notify(`Còn ${missing.length} ô chưa điền. Hoàn thành đủ ${gaps.length} ô để mở mindmap.`);
    document.getElementById('gap-' + missing[0].id)?.focus(); return { complete:false, missing:missing.length };
  }
  state.firstAttempt = logic.firstAttempt(lesson,state,crypto.randomUUID(),new Date().toISOString());
  state.scriptSubmitted = true; save(); render();
  document.getElementById('check-result').scrollIntoView({ behavior:'smooth', block:'center' });
  return { complete:true, score:logic.score(lesson, state), total:gaps.length };
}
function mapView() {
  main.innerHTML = title(2, 'Nhìn mindmap. Kể lại.', 'Bắt đầu từ ý chính ở giữa, rồi đi theo từng nhánh. Dùng từ khóa để nói bằng lời của em; không cần học thuộc cả script.') +
    `<div class="unlocked"><span>✓</span><div><strong>Em đã hoàn thành phần điền script.</strong><small>Có thể học mindmap hôm nay và quay bài nói vào một ngày khác.</small></div></div><figure class="mindmap"><button id="zoom-map" aria-label="Phóng to mindmap"><img src="assets/mindmap.png" alt="Mindmap A Closer Look at Germs: germs, microscope, diseases, immunizations and ways to stop germs spreading."></button><figcaption>Mindmap gốc của bài 01 · Bấm ảnh để phóng to</figcaption></figure>
    <section class="practice"><h2>Tập nói theo 5 ý</h2><ol><li><strong>Germs:</strong> What are germs? How can we see them?</li><li><strong>Illnesses:</strong> What illnesses can different germs cause?</li><li><strong>Disease:</strong> What does the word “disease” mean?</li><li><strong>Protection:</strong> How do immunizations help?</li><li><strong>Daily habits:</strong> What can we do to stop germs spreading?</li></ol><label class="tick"><input type="checkbox" id="map-check" ${state.mapDone ? 'checked' : ''}> Em đã tập giải thích cả 5 ý bằng lời của mình.</label><button class="primary" id="finish-map">Hoàn thành chặng mindmap</button></section>${pauseFooter(state.mapDone ? 'talk' : null, 'Sang thuyết trình →')}
    <dialog id="map-dialog"><button id="close-map" class="secondary">Đóng ảnh</button><img src="assets/mindmap.png" alt="Mindmap bài A Closer Look at Germs, bản phóng to"></dialog>`;
  document.getElementById('zoom-map').onclick = () => document.getElementById('map-dialog').showModal();
  document.getElementById('close-map').onclick = () => document.getElementById('map-dialog').close();
  document.getElementById('finish-map').onclick = () => {
    if (!document.getElementById('map-check').checked) { notify('Em tập nói theo 5 ý rồi đánh dấu hoàn thành nhé.'); return; }
    state.mapDone = true; save(); render(); notify('Đã lưu chặng mindmap. Em có thể nghỉ hoặc sang thuyết trình.');
  };
}
function talkView() {
  main.innerHTML = title(3, 'Your turn to teach!', 'Quay một video thuyết trình bằng tiếng Anh về germs. Thời lượng gợi ý: 1–2 phút. Em được nhìn mindmap để nhớ ý.') +
    `<section class="speaking-card"><p class="eyebrow">BÀI NÓI CỦA EM</p><h2>A Closer Look at Germs</h2><div class="speaking-plan"><div><span>01</span><h3>Introduce</h3><p>“Today, I’m going to talk about germs.”</p></div><div><span>02</span><h3>Explain</h3><p>Giải thích germs, diseases và cách bảo vệ bản thân theo mindmap.</p></div><div><span>03</span><h3>Connect</h3><p>Nêu 2 việc em làm hằng ngày để giúp ngăn germs lây lan.</p></div><div><span>04</span><h3>Close</h3><p>“These habits can help us stay healthy. Thank you for listening.”</p></div></div><button class="secondary" data-stage="map">Xem lại mindmap</button></section>
    <section class="practice"><h2>Trước khi quay</h2><ul class="plain-list"><li>Nói thành câu đầy đủ, theo thứ tự rõ ràng.</li><li>Nhìn vào camera, nói đủ to và không đọc nguyên script.</li><li>Quay bằng điện thoại hoặc ứng dụng camera; xem lại để kiểm tra tiếng và hình.</li></ul><div class="info-note">Bản thử chưa có nơi nhận video. Em giữ lại file đã quay; nút dưới đây chỉ lưu tiến độ trên thiết bị này.</div><label class="tick"><input type="checkbox" id="talk-check" ${state.talkDone ? 'checked' : ''}> Em đã quay xong và xem lại video thuyết trình.</label><button class="primary" id="finish-talk">Lưu: đã quay thuyết trình</button></section>${pauseFooter(state.talkDone ? 'questions' : null, 'Sang phần câu hỏi →')}`;
  document.getElementById('finish-talk').onclick = () => {
    if (!document.getElementById('talk-check').checked) { notify('Quay và xem lại video trước khi đánh dấu hoàn thành nhé.'); return; }
    state.talkDone = true; save(); render(); notify('Đã lưu tiến độ thuyết trình. Việc nộp video được xác nhận riêng trong Google Form.');
  };
}
function questionsView() {
  main.innerHTML = title(4, 'Think & answer', 'Trả lời 5 câu hỏi bằng câu tiếng Anh đầy đủ. Em có thể gõ câu trả lời dở, nghỉ và tiếp tục vào lần sau.') +
    `<form id="questions-form">${lesson.questions.map((q,i) => `<article class="question-card"><label for="question-${i}"><span class="q-number">${i+1}</span><strong lang="en">${esc(q.text)}</strong></label><textarea id="question-${i}" data-question="${i}" rows="3" placeholder="Write your answer here…" lang="en">${esc(state.responses[i])}</textarea><details><summary>Gợi ý cách suy nghĩ</summary><p>${esc(q.hint)}</p></details></article>`).join('')}<div class="info-note">Câu hỏi mở được lưu để em luyện và cô xem nội dung. Bản thử không tự chấm đúng/sai và chưa gửi câu trả lời ra ngoài.</div><div class="stage-footer"><button type="button" class="secondary" data-pause>Lưu lại, làm tiếp lần sau</button><button type="submit" class="primary">Hoàn thành phần trả lời</button></div></form>${state.questionsDone ? `<div class="unlocked"><span>✓</span><div><strong>Em đã hoàn thành phần luyện tập của 4 chặng!</strong><small>Tiến độ đã lưu trên trình duyệt này. Kiểm tra trang xác nhận của Form để chắc chắn điểm nghe và hai video đã được gửi.</small></div></div>` : ''}`;
  document.getElementById('questions-form').onsubmit = event => {
    event.preventDefault();
    const missing = lesson.questions.findIndex((q,i) => !String(state.responses[i] || '').trim());
    if (missing !== -1) { notify('Em hoàn thành đủ 5 câu trả lời nhé.'); document.getElementById('question-' + missing).focus(); return; }
    state.questionsDone = true; save(); render(); notify('Đã lưu đủ 5 câu trả lời trên thiết bị này.');
  };
}
function render() {
  if (audio) audio.pause(); audio = null; segmentEnd = null;
  if (!student) { window.ScienceSystem.gate(main); return; }
  window.ScienceSystem.badge(student);
  if (!logic.allowed(lesson, state, current)) current = 'listen';
  nav();
  ({ listen:listenView, map:mapView, talk:talkView, questions:questionsView })[current]();
  if (current === 'talk') {
    main.querySelector('.info-note').replaceWith(window.ScienceSystem.videoPanel(student,'talk'));
  }
  if (current === 'questions') {
    main.querySelector('.info-note').after(window.ScienceSystem.videoPanel(student,'questions'));
    main.querySelector('.info-note').textContent='Phần gõ dưới mỗi câu là bản nháp luyện nói và được lưu trên thiết bị. Khi sẵn sàng, quay video trả lời đủ 5 câu rồi nộp qua Form riêng của chặng này.';
  }
  if (current === 'listen' && state.firstAttempt) {
    const scoreBox = document.createElement('section'); scoreBox.className = 'first-score';
    scoreBox.innerHTML = `<div><p class="eyebrow">KẾT QUẢ TRƯỚC KHI XEM ĐÁP ÁN</p><strong>${state.firstAttempt.score}/${state.firstAttempt.total}</strong><span>${state.firstAttempt.score10.toLocaleString('vi-VN')} / 10 điểm</span></div><p>Mỗi ô đúng trọn từ hoặc cụm được 1 điểm. Điểm /10 = số ô đúng ÷ 30 × 10. Chữa lại bên dưới không thay đổi điểm lần đầu.</p>`;
    document.getElementById('check-result').before(scoreBox);
    scoreBox.after(window.ScienceSystem.scorePanel(student,state.firstAttempt));
  }
  save();
  document.getElementById('copy-stage').onclick = async () => {
    const url = new URL(location.href); url.searchParams.set('stage',current); url.hash = '';
    try { await navigator.clipboard.writeText(url.href); notify('Đã sao chép link chặng này. Chặng sau chỉ mở khi hoàn thành chặng trước.'); }
    catch { notify('Em có thể sao chép đường dẫn trên thanh địa chỉ.'); }
  };
}
function navigate(stage, push = true) {
  if (!stages.includes(stage)) stage = 'listen';
  if (!logic.allowed(lesson, state, stage)) {
    notify('Chặng này chưa mở. Em hoàn thành các chặng trước nhé.');
    stage = [...stages].reverse().find(s => logic.allowed(lesson, state, s)) || 'listen';
  }
  current = stage; state.lastStage = stage; save();
  const url = new URL(location.href); url.searchParams.set('stage',stage);
  if (push) history.pushState({},'',url); else history.replaceState({},'',url);
  render(); window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('input', event => {
  if (event.target.matches('[data-gap]')) {
    state.answers[event.target.dataset.gap] = event.target.value;
    if (state.scriptSubmitted) {
      const gap = gaps.find(g => String(g.id) === event.target.dataset.gap);
      const correct = logic.isCorrect(gap,event.target.value);
      event.target.closest('.gap').classList.toggle('correct',correct);
      event.target.closest('.gap').classList.toggle('incorrect',!correct);
      document.getElementById('feedback-' + gap.id).textContent = correct ? '✓ Đúng' : 'Đáp án: ' + gap.answer;
      const result = document.getElementById('check-result');
      if (result) result.innerHTML = `<strong>Đã điền ${logic.filled(lesson,state)}/${gaps.length} ô · ${logic.score(lesson,state)} ô đúng.</strong><p>Điền đủ các ô để tiếp tục sang mindmap.</p>`;
    }
    const count = logic.filled(lesson,state);
    document.getElementById('filled-count').textContent = `${count}/${gaps.length} ô đã điền`;
    document.getElementById('script-progress').value = count; nav(); save();
  }
  if (event.target.matches('[data-question]')) { state.responses[event.target.dataset.question] = event.target.value; state.questionsDone = false; nav(); save(); }
});
document.addEventListener('click', event => {
  const target = event.target.closest('button'); if (!target) return;
  if (target.dataset.stage) navigate(target.dataset.stage);
  if (target.hasAttribute('data-pause')) { audio?.pause(); save(); notify(storageOK ? 'Đã lưu. Em có thể đóng trang và mở lại bằng cùng trình duyệt để tiếp tục.' : 'Chưa lưu được. Em đừng đóng trang trước khi bật lưu trữ.'); }
  if (target.dataset.hint !== undefined) { const hint = document.getElementById('hint-' + target.dataset.hint); hint.hidden = !hint.hidden; target.textContent = hint.hidden ? 'Gợi ý chữ đầu' : 'Ẩn gợi ý'; }
  if (target.dataset.play !== undefined) {
    const c = lesson.chunks[Number(target.dataset.play)];
    document.querySelectorAll('[data-play]').forEach(b => b.classList.remove('playing')); target.classList.add('playing');
    playAudio(c.start,c.end);
  }
});
window.addEventListener('popstate',() => navigate(new URL(location.href).searchParams.get('stage') || 'listen',false));
navigate(new URL(location.href).searchParams.get('stage') || state.lastStage,false);
if (document.modelContext?.registerTool) {
  const controller = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({name:'get_science_lesson_progress',title:'Read Science G3 progress',description:'Read local progress and accessible stages for the current Science G3 lesson.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({stage:current,filled:logic.filled(lesson,state),total:gaps.length,scriptSubmitted:state.scriptSubmitted,availableStages:stages.filter(s=>logic.allowed(lesson,state,s)),mapDone:state.mapDone,talkDone:state.talkDone,questionsDone:state.questionsDone})},{signal:controller.signal})).catch(()=>{});
    window.addEventListener('pagehide',()=>controller.abort(),{once:true});
  } catch {}
}
