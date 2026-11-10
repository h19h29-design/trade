export const REGISTRATION_LABELS=Object.freeze({
  CATALOG_MATCHED:'조달번호 일치',
  AI_EXTRACTED:'AI 원문 보완',
  REVIEW_CANDIDATES:'후보 선택 필요',
  SOURCE_ONLY:'원본으로 등록',
  SKIPPED:'변경된 초안 보존',
  RETRY:'다시 확인 필요'
});

/** Keep the primary source visible while surfacing AI fields that were actually applied. */
export function registrationLabel(item){
  const state=item?.state||'';
  if(state==='CATALOG_MATCHED'&&item?.aiApplied)return '조달번호 일치 · AI 원문 보완';
  return REGISTRATION_LABELS[state]||state;
}
