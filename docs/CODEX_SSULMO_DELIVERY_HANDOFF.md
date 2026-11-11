# Codex 마무리 — 쓸모잇다 v0.13

```text
저장소 https://github.com/h19h29-design/trade
브랜치 codex/ssulmo-delivery-20261111에서 최신 커밋을 확인하고 이어서 검수·배포해줘.
기준 main은 c1a23b251ddc918638474faf9daea86f5796da24였어.
운영 이미지는 사용자 보고 기준 mulppum-ieum:815f6d0, v0.12.0, schema8이니 실제값부터 다시 확인해.

AGENTS.md, docs/SSULMO_DELIVERY_V013.md, docs/SSULMO_DELIVERY_TEST_REPORT.md,
docs/NAS_DEPLOYMENT.md와 Dockerfile을 읽어. 코드는 이미 작성됐으니 처음부터 재구현하지 마.

1. 미커밋 변경·실제 DATA_DIR·uploads·RAG·키·모델·환경·compose 파일 경로를 확인하고 보존해.
   기존 Hive 1017 모델과 RAG 121문서/8,164구간을 지워서 새로 만들지 마.
   실제 운영의 3개 Compose 구성, 특히 nas.rag.compose.yml을 함께 유지해.
   Dockerfile의 COPY shared ./shared가 유지되는지 이미지 안에서 확인해.
   서비스/이미지 내부명 mulppum-ieum, trade 도메인, 볼륨 경로는 브랜드 변경만으로 바꾸지 마.
2. 사용자 화면의 공식명은 쓸모잇다. 잇—다 연결선 모티프가
   로그인·사이드바·모바일헤더·푸터·브라우저제목에 잘 보이는지 직접 확인해.
   이전 배포 문서의 과거 이름은 기록이므로 일괄치환하지 마.
3. 물품찾기·AI검색에서 타기관 물품 담기 → 수량 → 받을 주소 → 운송비를 실제 조작해.
   상세의 필요수량이 그대로 전달되고, 차량 비교시 전체 합계도 변경돼야 해.
   다른 출발지는 별도 견적을 합산하며 합배송 최적화라고 표시하면 안 돼.
4. 기존 KAKAO_REST_API_KEY와 KAKAO_MOBILITY_REST_API_KEY의 존재/권한만 확인해 재사용해.
   키 값을 요청·출력·로그·Git에 넣지 마. 주소선택 자체는 우편번호 SDK라 키 없이도 가능해.
   유효 키가 있다면 LOCATION_ENABLED/ROUTE_ENABLED와 해당 서비스 승인부터 확인 후
   좌표·도로 API 실호출을 테스트해. 없으면 대표점 거리 모드가 정상 동작해야 해.
   키가 없는데 정확한 도로거리·실측위치로 표시하지 마.
   CSP에서 카카오 공식 SDK와 embed iframe이 운영 HTTPS에서 막히지 않는지 확인해.
5. 기존 Hive/DeepSeek 설정과 기관 자료전송 승인 범위를 지켜 크기 추정을 시험해.
   알려진 규격은 그대로 보존하고, 없는 크기·무게만 AI 추정/유형 가정으로 표시해.
   주소·기관명 필드는 치수 모델 요청에 넣지 마. 실제 기관 자료 외부전송 승인범위를 넘지 마.
   치수가 틀리면 이번 계산용 수정만 하며 원본 대장·물품·게시상태는 변경하지 않아야 해.
6. 실제 공개 시연물품 2~3종, 같은/다른 출발지, 가용량 초과, 계산중 예약변경,
   주소만료·취소·잘못된 API키·모델JSON실패를 검수해.
   배송비는 기존 예시 단가로 유지하며 확정운임·안전적재·실제 배차로 오인시키지 마.
7. npm ci, npm test, npm run build, LANG=C.UTF-8 LC_ALL=C.UTF-8 npm run test:e2e 실행.
   PC1440px·모바일390px UI와 기존 3000행등록/확인후등록/삭제복원/300샘플/RAG/인계를 회귀검수해.
   새 DB 마이그레이션은 없지만 기존 DB·uploads·RAG를 일관되게 백업하고 새 경로 복원·무결성 확인 후에만 배포해.
   down -v, prune, reset --hard, DB삭제·초기화·키교체 금지. 다른 70개 컨테이너·네트워크·Cloudflare 변경 금지.
8. 승인된 범위에서 PR 병합 후 앱 이미지만 교체해. RAG overlay 누락 없이 재시작 후
   health/version·AI모델·corpus수·기존DB건수·API실호출·운송견적을 재검증해.
최종 보고는 배포SHA·URL, 실제 카카오/AI 호출 결과, 추정/실측 구분, 예시운임과 남은 제한을 나누어 적어.
```
