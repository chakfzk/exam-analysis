/* All workbook data stays in this browser. No network or persistent storage. */
(function (root) {
  'use strict';
  const levels = ['A', 'B', 'C', 'D', 'E'];
  const cuts = [90, 80, 70, 60];
  const ranges = ['90점 이상', '80점 이상 90점 미만', '70점 이상 80점 미만', '60점 이상 70점 미만', '60점 미만'];
  function numeric(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
  }
  function classify(score) {
    if (!Number.isFinite(score) || score < 0 || score > 100) return null;
    const i = cuts.findIndex(cut => score >= cut);
    return levels[i < 0 ? 4 : i];
  }
  function parseRows(rows, filename) {
    const normalize = x => String(x ?? '').replace(/\s/g, '');
    const headerIndex = rows.findIndex(row => row.some(x => normalize(x) === '과목총점'));
    if (headerIndex < 0) throw new Error('‘과목총점’ 열이 없습니다. 나이스 교과목별학생답정오표를 확인해 주세요.');
    if (headerIndex + 3 >= rows.length) throw new Error('학생 자료가 없거나 엑셀 행 구성이 다릅니다.');
    const header = rows[headerIndex];
    const scoreCol = header.findIndex(x => normalize(x) === '과목총점');
    const questions = [];
    header.forEach((value, col) => {
      if (col < 3 || col === scoreCol) return;
      const id = numeric(value), answer = numeric(rows[headerIndex + 1]?.[col]);
      if (Number.isInteger(id) && id > 0 && Number.isInteger(answer) && answer >= 1 && answer <= 5) {
        if (questions.some(q => q.id === id)) throw new Error(`문항번호 ${id}가 중복되었습니다.`);
        questions.push({id, answer, col});
      }
    });
    if (!questions.length) throw new Error('객관식 문항번호와 정답(1~5)을 찾을 수 없습니다.');
    questions.sort((a, b) => a.id - b.id);
    const students = [];
    let excluded = 0;
    for (const row of rows.slice(headerIndex + 3)) {
      // The original NAIS layout uses the second column for class/student ID.
      const id = String(row[1] ?? '').trim();
      if (!id) continue;
      const score = numeric(row[scoreCol]);
      if (score === null) { excluded++; continue; }
      if (score < 0 || score > 100) throw new Error('과목총점이 0~100점 범위를 벗어납니다. 100점 만점 자료를 사용해 주세요.');
      const answers = {};
      for (const q of questions) {
        answers[q.id] = String(row[q.col] ?? '').trim() === '.' ? q.answer : numeric(row[q.col]);
      }
      // Student IDs and names are deliberately not retained in analysis results.
      students.push({score, level: classify(score), answers});
    }
    if (!students.length) throw new Error('유효한 학생 자료가 없습니다. 반/번호와 과목총점을 확인해 주세요.');
    return {filename, questions: questions.map(({id, answer}) => ({id, answer})), students, excluded};
  }
  function mergeFiles(files) {
    if (!files.length) throw new Error('분석할 파일을 선택해 주세요.');
    const signature = file => JSON.stringify(file.questions);
    if (files.some(file => signature(file) !== signature(files[0]))) {
      throw new Error('파일마다 문항번호 또는 정답이 다릅니다. 같은 과목·같은 시험의 파일만 함께 선택해 주세요.');
    }
    return {questions: files[0].questions, students: files.flatMap(file => file.students),
      excluded: files.reduce((n, file) => n + file.excluded, 0), filenames: files.map(file => file.filename)};
  }
  function summarize(data) {
    const {students, questions} = data;
    const groups = Object.fromEntries(levels.map(level => [level, students.filter(s => s.level === level)]));
    const stats = (list, q) => {
      const counts = [0, 0, 0, 0, 0, 0];
      for (const student of list) {
        const answer = student.answers[q.id];
        counts[Number.isInteger(answer) && answer >= 1 && answer <= 5 ? answer - 1 : 5]++;
      }
      return {n: list.length, counts, ratios: counts.map(n => list.length ? n / list.length * 100 : null),
        correct: list.length ? counts[q.answer - 1] / list.length * 100 : null};
    };
    const histogram = Array(10).fill(0);
    students.forEach(s => histogram[Math.min(9, Math.floor(s.score / 10))]++);
    return {n: students.length, mean: students.reduce((sum, s) => sum + s.score, 0) / students.length,
      groups: levels.map((level, i) => ({level, range: ranges[i], n: groups[level].length})), histogram,
      questions: questions.map(q => ({...q, total: stats(students, q),
        groups: Object.fromEntries(levels.map(level => [level, stats(groups[level], q)]))}))};
  }
  function csv(summary) {
    const header = ['문항', '정답', '전체 인원', '전체 정답률(%)', '전체 무응답·기타 수',
      ...levels.flatMap(level => [`${level} 인원`, `${level} 정답률(%)`])];
    const rows = summary.questions.map(q => [q.id, q.answer, q.total.n, q.total.correct.toFixed(1), q.total.counts[5],
      ...levels.flatMap(level => [q.groups[level].n, q.groups[level].correct === null ? '' : q.groups[level].correct.toFixed(1)])]);
    return '\uFEFF' + [header, ...rows].map(row => row.join(',')).join('\r\n');
  }
  function demo() {
    const questions = Array.from({length: 12}, (_, i) => ({id: i + 1, answer: i % 5 + 1}));
    let seed = 71;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const students = Array.from({length: 120}, () => {
      const score = Math.round(25 + rand() * 75);
      const answers = Object.fromEntries(questions.map(q => {
        const probability = Math.max(.05, Math.min(.97, score / 100 - (q.id % 4) * .07));
        let choice = q.answer;
        if (rand() > probability) choice = (q.answer + Math.floor(rand() * 4)) % 5 + 1;
        if (rand() < .015) choice = null;
        return [q.id, choice];
      }));
      return {score, level: classify(score), answers};
    });
    return {questions, students, filenames: ['가상 예시 데이터'], excluded: 0, demo: true};
  }
  const api = {levels, cuts, ranges, numeric, classify, parseRows, mergeFiles, summarize, csv, demo};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ExamAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
