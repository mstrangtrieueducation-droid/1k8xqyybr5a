(function (root) {
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9\s'-]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const getGaps = lesson => lesson.chunks.flatMap(c => c.parts.filter(p => typeof p === 'object'));
  const filled = (lesson, state) => getGaps(lesson).filter(g => normalize(state.answers[g.id])).length;
  const isCorrect = (gap, value) => [gap.answer, ...(gap.accept || [])].some(a => normalize(a) === normalize(value));
  const score = (lesson, state) => getGaps(lesson).filter(g => isCorrect(g, state.answers[g.id])).length;
  const allowed = (lesson, state, stage) => {
    const scriptDone = !!state.scriptSubmitted && !!state.scoreReceipt && state.scoreReceipt.id === state.firstAttempt?.id;
    return stage === 'listen' || (stage === 'map' && scriptDone) || (stage === 'talk' && scriptDone && state.mapDone) || (stage === 'questions' && scriptDone && state.mapDone && state.talkDone);
  };
  const firstAttempt = (lesson, state, id, completedAt) => {
    if (state.firstAttempt) return state.firstAttempt;
    const total = getGaps(lesson).length;
    if (!total || filled(lesson,state) !== total) return null;
    const earned = score(lesson,state);
    return {id,completedAt,answers:{...state.answers},score:earned,total,score10:Math.round(earned/total*1000)/100,percent:Math.round(earned/total*100)};
  };
  const api = { normalize, getGaps, filled, isCorrect, score, allowed, firstAttempt };
  root.LessonLogic = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
