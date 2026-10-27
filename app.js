'use strict';
const EA = window.ExamAnalysis;
const $ = id => document.getElementById(id);
const colors = ['#176b61', '#4c8e72', '#96b477', '#c5aa65', '#bf816a'];
const choiceColors = ['#4a7291', '#6f8d6a', '#9b78a5', '#bf8660', '#778792'];
let current = null, summary = null, page = 0, busy = false;
const perPage = 6;
const percent = n => n === null ? '—' : `${n.toFixed(1)}%`;
function text(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}
function svgElement(name, attrs = {}, content) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (content !== undefined) node.textContent = content;
  return node;
}
function svgCanvas(width, height, label) {
  const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': label});
  svg.append(svgElement('title', {}, label));
  return svg;
}
function histogram() {
  const w = 420, h = 227, left = 31, bottom = 193, chartH = 152;
  const max = Math.max(...summary.histogram, 1);
  const top = Math.max(1, Math.ceil(max / 4)) * 4;
  const svg = svgCanvas(w, h, '과목총점의 10점 구간별 학생 수. 각 막대에 인원을 표시합니다.');
  for (let i = 0; i <= 4; i++) {
    const value = top * i / 4, y = bottom - i / 4 * chartH;
    svg.append(svgElement('line', {x1: left, x2: 412, y1:y, y2:y, stroke:'#e8ede2'}));
    svg.append(svgElement('text', {x:23, y:y+3, fill:'#8a9587', 'font-size':9, 'text-anchor':'end'}, Number(value.toFixed(1))));
  }
  summary.histogram.forEach((n, i) => {
    const x = left + i * 38 + 5, barH = n / top * chartH;
    svg.append(svgElement('rect', {x, y:bottom-barH, width:26, height:barH, rx:3,
      fill:colors[i >= 9 ? 0 : i >= 8 ? 1 : i >= 7 ? 2 : i >= 6 ? 3 : 4]}));
    svg.append(svgElement('text', {x:x+13, y:bottom-barH-6, fill:'#53664e', 'font-size':9, 'text-anchor':'middle'}, n));
    svg.append(svgElement('text', {x:x+13, y:bottom+17, fill:'#7a8972', 'font-size':8, 'text-anchor':'middle'}, `${i*10}~${i===9 ? 100 : i*10+10}`));
  });
  svg.append(svgElement('text', {x:left, y:15, fill:'#8a9587', 'font-size':9}, '학생 수(명)'));
  return svg;
}
function lineChart(q) {
  const w = 420, h = 200, left = 35, right = 397, top = 16, bottom = 167;
  const label = `문항 ${q.id}의 성취수준별 보기 선택 비율. 상세 수치는 아래 표에서 확인할 수 있습니다.`;
  const svg = svgCanvas(w, h, label);
  const x = i => left + i * (right-left)/4;
  const y = rate => bottom - rate / 100 * (bottom-top);
  for (const rate of [0,25,50,75,100]) {
    svg.append(svgElement('line', {x1:left, x2:right, y1:y(rate), y2:y(rate), stroke:'#e8ede2', 'stroke-dasharray':rate ? '3 4' : ''}));
    svg.append(svgElement('text', {x:left-8, y:y(rate)+3, 'text-anchor':'end', fill:'#8a9587', 'font-size':9}, `${rate}%`));
  }
  EA.levels.forEach((level, i) => svg.append(svgElement('text', {x:x(i), y:bottom+20, 'text-anchor':'middle', fill:'#65785d', 'font-size':11}, level)));
  [1,2,3,4,5].filter(c => c !== q.answer).concat(q.answer).forEach(choice => {
    const correct = choice === q.answer, color = correct ? '#b79134' : choiceColors[choice-1];
    let path = '', lastPresent = false;
    EA.levels.forEach((level, i) => {
      const rate = q.groups[level].ratios[choice-1];
      if (rate === null) { lastPresent = false; return; }
      path += `${lastPresent ? 'L' : 'M'}${x(i)},${y(rate)} `;
      lastPresent = true;
    });
    svg.append(svgElement('path', {d:path, fill:'none', stroke:color, 'stroke-width':correct ? 3 : 1.4,
      'stroke-opacity':correct ? 1 : .6}));
    EA.levels.forEach((level, i) => {
      const rate = q.groups[level].ratios[choice-1];
      if (rate === null) return;
      const point = svgElement('circle', {cx:x(i),cy:y(rate),r:correct ? 3.8 : 2,fill:color});
      point.append(svgElement('title', {}, `${level} · ${choice}번 ${rate.toFixed(1)}%`));
      svg.append(point);
    });
  });
  return svg;
}
function questionCard(q) {
  const card = text('article', '', 'question-card');
  const header = text('div', '', 'question-header');
  const title = text('h3', `문항 ${String(q.id).padStart(2,'0')}`);
  title.append(text('span', 'ITEM'));
  header.append(title, text('span', `정답 ${q.answer}번`));
  const rate = text('div', '', 'correct-summary');
  const number = text('strong', q.total.correct.toFixed(1));
  number.append(text('small','%'));
  rate.append(text('span', '전체 정답률'), number);
  const lineLegend = text('div', '', 'line-legend');
  for (let choice = 1; choice <= 5; choice++) {
    const label = text('span', `${choice}번${choice === q.answer ? ' · 정답' : ''}`);
    const swatch = document.createElement('i');
    swatch.style.background = choice === q.answer ? '#b79134' : choiceColors[choice-1];
    label.prepend(swatch); lineLegend.append(label);
  }
  card.append(header, rate, lineLegend, lineChart(q));
  const table = text('table', '', 'correct-table');
  const caption = text('caption', '성취수준별 정답률');
  caption.className = 'sr-only';
  table.append(caption);
  const head = table.createTHead().insertRow(), row = table.createTBody().insertRow();
  EA.levels.forEach(level => {
    const th = text('th', `${level} (${q.groups[level].n}명)`); th.scope='col'; head.append(th);
    row.append(text('td', percent(q.groups[level].correct)));
  });
  card.append(table, text('div','전체 보기 선택 비율', 'choices-heading'));
  const choices = text('div', '', 'choices');
  q.total.ratios.slice(0,5).forEach((n,i) => {
    const el = text('div', '', `choice${i+1===q.answer ? ' correct' : ''}`);
    el.append(text('small', `${i+1}번${i+1===q.answer ? ' · 정답' : ''}`), document.createTextNode(percent(n)));
    choices.append(el);
  });
  card.append(choices);
  const details = document.createElement('details');
  details.append(text('summary', `성취수준별 보기 선택 비율 펼치기 · 무응답·기타 ${q.total.counts[5]}명`));
  const wrap = text('div', '', 'table-scroll');
  const dt = text('table', '', 'details-table');
  const dh = dt.createTHead().insertRow();
  ['수준','인원','1번','2번','3번','4번','5번','무응답·기타'].forEach(label => {
    const th = text('th', label); th.scope='col'; dh.append(th);
  });
  const db = dt.createTBody();
  [['전체',q.total],...EA.levels.map(level => [level,q.groups[level]])].forEach(([label, stats]) => {
    const row = db.insertRow(), th = text('th', label); th.scope='row'; row.append(th);
    [String(stats.n), ...stats.ratios.map(percent)].forEach(value => row.append(text('td', value)));
  });
  wrap.append(dt); details.append(wrap); card.append(details);
  return card;
}
function renderQuestions() {
  const sorted = [...summary.questions];
  const sort = $('sort-select').value;
  if (sort !== 'number') sorted.sort((a,b) => (sort === 'hard' ? 1 : -1) * (a.total.correct-b.total.correct) || a.id-b.id);
  const pages = Math.ceil(sorted.length/perPage);
  $('question-cards').replaceChildren(...sorted.slice(page*perPage,(page+1)*perPage).map(questionCard));
  $('page-label').textContent = `${page+1} / ${pages} · 총 ${sorted.length}문항`;
  $('prev-button').disabled = page===0;
  $('next-button').disabled = page===pages-1;
}
function showData(data) {
  current = data; summary = EA.summarize(data); page = 0;
  $('error').hidden = true;
  $('status').textContent = '';
  $('results').hidden = false;
  $('empty-state').hidden = true;
  $('demo-notice').hidden = !data.demo;
  $('file-meta').textContent = data.demo ? '가상 데이터 · 120명 · 12문항' :
    `엑셀 ${data.filenames.length}개 분석 완료${data.excluded ? ` · 총점이 없는 ${data.excluded}개 행 제외` : ''}`;
  const metric = (id,value,unit) => { $(id).replaceChildren(document.createTextNode(value), text('em',unit)); };
  metric('student-count',summary.n.toLocaleString(),'명');
  metric('score-mean',summary.mean.toFixed(1),'점');
  metric('question-count',summary.questions.length,'개');
  $('level-bars').replaceChildren(...summary.groups.map((group,i) => {
    const row = text('div','','level-row');
    row.title = `${group.level}: ${group.range}`;
    const track = text('div','','bar-track'), fill = text('div','','bar-fill');
    // Width/color are finite, internally computed values; no workbook text becomes markup.
    fill.style.width = `${group.n/summary.n*100}%`;
    fill.style.background = colors[i]; track.append(fill);
    const count = text('div','','level-value');
    count.append(text('b',`${group.n}명`), document.createTextNode(`${(group.n/summary.n*100).toFixed(1)}%`));
    row.append(text('span',group.level,`level-badge level-${group.level}`),track,count);
    return row;
  }));
  $('histogram').replaceChildren(histogram());
  renderQuestions();
}
async function importFiles(files) {
  if (busy || !files.length) return;
  busy = true; document.body.classList.add('busy');
  $('file-input').disabled = true; $('demo-button').disabled = true; $('reset-button').disabled = true;
  $('error').hidden = true; $('status').textContent = '엑셀을 읽고 있습니다. 파일은 브라우저 안에서만 처리합니다.';
  try {
    if (!window.XLSX) throw new Error('엑셀 읽기 도구를 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    const seen = new Set();
    const parsed = [];
    for (const file of files) {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('xlsx 또는 xls 파일만 선택해 주세요.');
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (seen.has(key)) throw new Error('같은 파일이 중복 선택되었습니다. 파일을 확인해 주세요.');
      seen.add(key);
      if (file.size > 30*1024*1024) throw new Error('파일당 30MB 이하의 엑셀 파일을 사용해 주세요.');
      let workbook;
      try { workbook = XLSX.read(await file.arrayBuffer(), {type:'array', cellFormula:false, cellHTML:false, bookVBA:false}); }
      catch (_) { throw new Error('엑셀 파일을 읽을 수 없습니다. 암호나 파일 형식을 확인해 주세요.'); }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('첫 번째 시트에 자료가 없습니다.');
      try {
        parsed.push(EA.parseRows(XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true}), file.name));
      } catch (error) { throw new Error(`${file.name}: ${error.message}`); }
    }
    showData(EA.mergeFiles(parsed));
    $('overview').scrollIntoView({behavior:'smooth', block:'start'});
  } catch (error) {
    $('status').textContent = current ? '새 파일 분석에 실패했습니다. 아래에는 이전 분석 결과가 남아 있습니다.' : '';
    $('error').textContent = error.message || '분석 중 오류가 발생했습니다.';
    $('error').hidden = false;
  } finally {
    busy = false; document.body.classList.remove('busy');
    $('file-input').disabled = false; $('demo-button').disabled = false; $('reset-button').disabled = false;
    $('file-input').value = '';
  }
}
$('file-input').addEventListener('change',event => importFiles(Array.from(event.target.files)));
$('demo-button').addEventListener('click',() => { showData(EA.demo()); $('overview').scrollIntoView({behavior:'smooth'}); });
$('reset-button').addEventListener('click',() => {
  current = null; summary = null; page = 0;
  $('results').hidden = true; $('empty-state').hidden = false; $('error').hidden = true;
  $('question-cards').replaceChildren(); $('level-bars').replaceChildren(); $('histogram').replaceChildren();
  $('file-input').value = ''; $('status').textContent = '분석 자료를 지웠습니다.';
  $('upload').scrollIntoView({behavior:'smooth'});
});
$('sort-select').addEventListener('change',() => { page=0; if(summary) renderQuestions(); });
for (const [id,step] of [['prev-button',-1],['next-button',1]]) {
  $(id).addEventListener('click',() => { page+=step; renderQuestions(); $('items').scrollIntoView({behavior:'smooth'}); });
}
$('download-button').addEventListener('click',() => {
  if(!summary) return;
  const url = URL.createObjectURL(new Blob([EA.csv(summary)],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a'); link.href=url; link.download='평가분석_문항별정답률.csv';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
const dropzone = $('dropzone');
for (const type of ['dragenter','dragover']) dropzone.addEventListener(type,event => {event.preventDefault();dropzone.classList.add('dragging');});
for (const type of ['dragleave','drop']) dropzone.addEventListener(type,event => {event.preventDefault();dropzone.classList.remove('dragging');});
dropzone.addEventListener('drop',event => importFiles(Array.from(event.dataTransfer.files)));
window.addEventListener('dragover',event => event.preventDefault());
window.addEventListener('drop',event => event.preventDefault());
