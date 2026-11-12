# trade.h19h19.com NAS 배포

사용자가 2026-10-31에 지정한 대상은 **NAS 볼륨2 + Cloudflare + trade.h19h19.com**이다. 기관 운영 승인은 없으므로 합성 자료 시연으로 구성한다. 외부 API·AI의 실제 연결 상태는 아래 최신 배포 기록을 따른다.

## 최신 v0.13 — 쓸모잇다 브랜드·가져올 물품·AI 운송비 (2026-11-11)

[https://trade.h19h19.com](https://trade.h19h19.com)에 v0.13.0을 배포했다. PR #13(기능·브랜드)을 병합한 뒤, 모바일 로그인 히어로의 `필요한 곳으로잇—다.`가 붙던 문제를 고친 PR #14를 추가 병합했다. 최종 main `1372822bd346754a8fca9757073e4034797e219e`의 트리로 이미지를 빌드해 앱만 교체했다.

| 항목 | 실제 확인값 |
|---|---|
| 배포 소스 / main | `1372822bd346754a8fca9757073e4034797e219e` |
| 현재 링크 / 이미지 | `/volume2/docker/trade/current` → `releases/1372822` / `mulppum-ieum:1372822` |
| 이미지 ID | `sha256:c61a765c7f957f72ad72301a165c39a478e179c835d1b3bde01b4c770ebb4645` |
| 앱 / 상태 | `mulppum-ieum-app-1`, v0.13.0, Docker healthy, HTTPS 200 |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/` (기존 경로 유지) |
| DB 스키마 | `user_version=8`, `integrity_check=ok`, FK 오류 0 |
| 보존 건수 | lots 2,207 · assets 1,661 · imported_rows 2,200 · users 7 · files 18 |
| v0.13 신규 테이블 | `lot_archives` 0 · `demo_sample_lots` 0 · `test_accounts` 0 |
| AI / RAG | Hive `deepseek-ai/deepseek-v4.1-flash-1017`, RAG 앱 14문서 · 지침 121문서/8,164구간 |
| 포트 / 네트워크 | `127.0.0.1:14310` → 4310, `mulppum-ieum_default`, `10.253.43.0/28` 유지 |
| 환경 백업 | `deployments/env.nas.before-a7367a0`, `deployments/env.nas.before-1372822` |

### 백업·복원과 실제 2,194행 자료

| 대상 | 백업 | 별도 경로 복원 |
|---|---|---|
| 배포 직전 schema8 | `backups/2026-11-11T07-19-40.062Z` | `restore-checks/2026-11-11T07-19-40.062Z-v013-pre` |
| 호출량·지침 corpus | 기존 `rag-usage.sqlite`·`knowledge/` 경로 유지 | 초기화·덮어쓰기 없음 |

앱만 중지한 상태에서 SQLite backup API로 DB와 첨부 18개를 백업했고, 별도 경로 복원본도 schema8·무결성·FK 0건·lots 2,207/assets 1,661/imported_rows 2,200/users 7/files 18로 원본과 일치했다. v0.13은 신규 DB 마이그레이션이 없다.

운영에는 실제 `(전체기관대상) 관리전환 소요조회 목록 (2194개).xlsx` 등록 영수증이 `COMPLETE`로 보존되어 있다. 원본 BLOB을 외부 전송 없이 비공개 로컬 경로에서 확인한 결과, Sheet1 `A1:P2197`, 데이터 **2,194행**, 합계행 1개, 수량 합계 **2,194개**, 물품고유번호 고유값 **1,902개**, 중복번호 **249그룹(541행)** 이었다. 운영 `imported_rows`도 **2,194행**, `lots`도 2,194개가 해당 원본과 연결되어 있어 기존 등록 결과를 삭제·재생성하지 않고 보존했다.

### 실제 운송·주소 검수

- 공개 시연 물품 3종(모니터·서류 이동서랍·교무실 책상)으로 계산: 같은 출발지(늘봄중학교/양천구) 2종은 **1개 차량·1회**, 다른 출발지(한결도서관/마포구)는 **별도 1회**로 총 **2출발지·2회·132,000원**(106,000~172,000원)이었다. 같은 출발지만 계산하면 **66,000원·1회**였다.
- UI에서 모니터 2개·책상 1개·화이트보드 1개를 담고 받을 주소를 `서울 마포구`로 선택: **2출발지·2회**, 차량 선택 전 **187,000원**, 중형 선택 후 **242,000원**으로 전체 합계가 갱신됐다. 390px에서 가로 넘침은 없었다.
- 출발지·도착지 모두 `DISTRICT_APPROX` 대표점이고 거리는 `지역 대표점 간 거리 ×1.3 (최소 8km 가정)`으로 표시됐다. 실제 도로거리·확정 위치로 표시하지 않았다.
- 운영에는 `KAKAO_REST_API_KEY`/`KAKAO_MOBILITY_REST_API_KEY`가 설정되어 있지 않아 `location=false`, `route=false`다. Codex 로컬에 있던 기존 키는 실제 카카오 호출에서 **401**이었으므로 운영에 복사하거나 유효 키로 가장하지 않았다. 공식 우편번호 SDK는 **키 없이** 운영 HTTPS에서 `https://postcode.map.kakao.com/search?...` 프레임이 로드되고 주소검색 UI가 표시되는 것을 확인했다. CSP가 막은 것은 Cloudflare insights beacon뿐이며 카카오 주소 프레임은 정상이다.
- AI 크기 보완은 실제 Hive 1017 호출로 `AI_ESTIMATE`가 반환됐다. 운영 공개 물품은 등록 치수가 비어 있어 AI 추정으로 표시됐고, 격리 복사본에서 등록·실측값을 주입하면 `담당자 확인 규격`으로 유지되고 `aiMode=NOT_NEEDED`였다. 직접 입력은 `이번 계산에 직접 입력`으로 구분됐다.
- 수량 초과는 `INSUFFICIENT_QUANTITY`, 버전 변경은 `STALE_LOT`, 자기기관·비공개 물품은 `LOT_UNAVAILABLE`로 거부됐다. 여러 계산 전후 `lots`의 `state/version/available`은 변하지 않았다. 운송 테스트 13개에는 비동기 모델 계산 중 예약 변동 시 이전 견적을 반환하지 않는 검사도 포함된다.
- 운임은 `sample=true`, `sample-2026-11-v1`, `binding=false`인 **시연용 가정 단가**다. 차량 규격·회차·범위는 예시이며 실제 업체 견적·배차·안전 적재가 아니다.

### 배포 검증

- `npm ci` 알려진 취약점 0건, `npm test` **199개 통과**, `npm run build` 성공, UTF-8 Chromium E2E **39개 통과**. 별도 운송 서버 테스트 13개도 통과했다.
- 1440px/390px에서 로그인·`/transport`·`/market`·`/ai-register`·`/manage`를 확인했고 가로 넘침·페이지 오류는 0건이었다. 모바일 로그인 히어로 줄바꿈은 PR #14로 수정했다.
- 다른 70개 컨테이너 ID는 그대로이고 `mulppum-ieum-app-1`만 교체됐다. Docker 네트워크·Cloudflare·기존 DB·uploads·RAG·키·환경파일은 보존했다. `.env.nas`에서 바뀐 항목은 `TRADE_RELEASE` 하나뿐이다.

### 남은 제약

- 카카오 좌표·도로 API는 유효 키가 없어 실호출하지 못했다. 운영 주소·거리는 대표점 가정이며 실제 도로거리·차량 통행 제한과 다를 수 있다.
- AI 치수는 추정값이며 실측·제조사 사양이 아니다. 실제 물품의 포장 외곽 치수와 무게는 담당자가 확인해야 한다.
- 운송 단가표는 예시이고 실제 운송업체 견적·배차 계약이 아니다. 다른 출발지 사이 합배송·다중경유 최적화도 하지 않는다.
- 실제 기관 운영 승인, 사진 AI·K-에듀파인·온비드 공식 연계는 기존 미확보 상태다. Cloudflare insights beacon은 현재 CSP에서 차단된다(카카오 주소검색과 무관).

## 이전 v0.12 — 3,000행 등록·단일 테스트 계정·샘플 300·보관함 (2026-11-11)

[https://trade.h19h19.com](https://trade.h19h19.com)에 v0.12.0을 배포했다. PR #10(`3eb6076`, 기능)을 병합한 뒤 PR #11(`8eb72af`, 운영 이미지의 `shared/` 누락 수정)을 추가로 병합했고, 최종 main 병합 커밋 **`815f6d0`**의 트리로 이미지를 다시 빌드해 앱만 교체했다.

| 항목 | 실제 확인값 |
|---|---|
| 배포 소스 / main | `815f6d0` (PR #11 병합 커밋, `8eb72af`와 트리 동일) |
| 현재 링크 / 이미지 | `/volume2/docker/trade/current` → `releases/815f6d0` / `mulppum-ieum:815f6d0` |
| 이미지 ID | `sha256:3eebc7ed4ded1ede7d537f3078bbd18bb8c9da64cc9b7b89353a3016b3e68778` |
| 앱 / 상태 | `mulppum-ieum-app-1`, v0.12.0, Docker healthy, HTTPS 200 |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/` (기존 경로 유지) |
| DB 스키마 | `user_version=8`, `integrity_check=ok`, FK 오류 0 |
| 보존 건수 | lots 13 · assets 8 · imported_rows 6 · users 7 · files 18 |
| AI / RAG | Hive `deepseek-ai/deepseek-v4.1-flash-1017`, RAG 121문서/8,164구간 |
| 포트 / 네트워크 | `127.0.0.1:14310` → 4310, `mulppum-ieum_default`, `10.253.43.0/28` 유지 |
| 환경 백업 | `deployments/env.nas.before-815f6d0`, `deployments/env.nas.before-v012` |

### schema7→8 백업·별도 복원

| 대상 | 백업 | 별도 경로 복원 |
|---|---|---|
| 교체 전 schema7 | `backups/2026-11-11T03-43-12Z-v012-pre` | `backups/restore-checks/2026-11-11T03-43-12Z-v012-schema8` (schema8) |
| 배포 직전 schema8 | `backups/2026-11-11T03-58-17.954Z` | `restore-checks/2026-11-11T03-58-17.954Z-v012-post` |
| 호출량·자료 | 기존 `rag-usage.sqlite`·`knowledge/` 읽기 전용 경로 유지 | 초기화·덮어쓰기 없음 |

배포 직전 앱만 중지한 상태에서 SQLite backup API로 DB와 첨부 18개를 백업했다. 새 경로 복원본도 schema8·무결성·FK 0건·lots 13/assets 8/imported_rows 6/users 7/files 18로 원본과 일치했다. 새 이미지 `815f6d0`은 동일 복원본에 loopback 시험 컨테이너로 기동해 health 0.12.0을 확인한 뒤 교체했다.

### 배포 중 발견·복구한 회귀

- v0.12 Dockerfile이 새 `shared/import-limits.mjs`를 런타임 이미지에 복사하지 않아 첫 배포가 `ERR_MODULE_NOT_FOUND`로 502가 됐다. DB는 이미 schema8로 전환된 상태였고 v0.11 롤백은 `Database version is newer than this application`으로 거부됐다. Dockerfile에 `COPY --chown=node:node shared ./shared`를 추가한 `8eb72af`를 PR #11로 병합한 뒤 재빌드해 healthy를 회복했다. 기존 DB·백업·복원본은 삭제하지 않았다.
- 최종 교체 시 `nas.rag.compose.yml`을 함께 적용하지 않아 AI/RAG 환경과 `/app/rag-private` 마운트가 일시적으로 빠졌다. 키는 변경하지 않고 기존 `nas.compose.yml`+`nas.network.compose.yml`+`nas.rag.compose.yml` 3개 구성으로 앱만 다시 생성해 Hive 1017·RAG 121문서/8,164구간을 복구했다. 이후 `.env.nas`에서 바뀐 항목은 `TRADE_RELEASE` 하나뿐이다.

### 실제 검수

- `npm ci` 알려진 취약점 0건, `npm test` **186개 통과**, `npm run build` 성공, UTF-8 Chromium E2E **36개 통과**.
- 운영 `/api/ai-core/status`: `provider=hive`, `model=deepseek-ai/deepseek-v4.1-flash-1017`, 조달 configured, 사진 참고자료 사용 가능. 위치·경로는 미설정으로 유지.
- 운영 AI 검색 `책상` 1개: 점수 89, 신청 가능 18개, 장단점·근거·배송 미확인 표시, AI 설명의 모든 `sourceIds`가 계산 근거와 일치. 같은 검색 `1000개`는 **982개 부족**을 명시하고 부분 충족으로 표시했다.
- 조달 식별번호 `20269246` 1건 조회(캐시), RAG 질문은 `GENERATED` 4개 섹션·출처 4개, 모델 `deepseek-ai/deepseek-v4.1-flash-1017`.
- 적재: 60×60×60cm·10kg 20개·25km → 3개 차량 옵션, 중형 1회 146,000원(117,000~190,000원). `sample=true`, `binding=false`, `sample-2026-11-v1`이며 실제 견적이 아니다.
- 1440px/390px에서 `/manage`, `/packing`, `/ai-register`, `/market` 가로 넘침 없음·페이지 오류 0건. 운영 `/manage`는 등록 9건과 합성 샘플 관리 안내를 표시한다.

### 남은 제약

- 실제 `(전체기관대상) 관리전환 소요조회 목록 (2194개).xlsx`는 이번 마무리 환경의 로컬·외장·NAS 검색 범위에 없었다. 원본의 2,194행·1,902개 고유번호·249개 중복번호그룹(541행) 통계는 구현 단계의 비공개 검수 기록에 있으나, **v0.12 비공개 테스트 환경에 실제 파일을 다시 업로드해 최종등록하는 검수는 미완료**다. 같은 16열·2,194행 구조의 합성 재현 파일로는 확인 전 0건 → 확인 후 lots 2,494(기존 샘플 300 + 2,194), assets 1,653, imported_rows 2,194를 확인했다. 실제 파일·원문 행은 Git·외부 AI·공개 CI에 넣지 않았다.
- `admin / 1234` 단일 테스트 계정, 샘플 300건, 개별 삭제·보관함 복원, `testingadmin` 변경·재시작 지속성은 **별도 로컬 DATA_DIR**(`data/v012-single`)에서 검수했다. 운영 계정·비밀번호는 변경하지 않았고 `1234` 상태로 공개하지 않았다.
- 실제 기관 DB·업무자료를 시연 DB와 섞지 않았고, 사진 AI·카카오 주소/경로·K-에듀파인·온비드 공식 연계는 기존 미연결 상태다.

## 이전 v0.7.1 — 파일 등록·대화창·기존 NAS 보존 통합 (2026-11-04)

[https://trade.h19h19.com](https://trade.h19h19.com)의 실제 앱 소스는 **`522526d92e8b47b71c976413397af69d128c3223`**이다. 최신 main `c9fdbe11421828759f780870bd36b010d91bdc35`에 기존 NAS의 개선사항·Hive1017 RAG·조달 실접속/참고사진 보안 수정을 보존해 통합했다. 기능 코드 배포 뒤 운영 기록만 수정한 문서 커밋은 이미지에 재배포하지 않는다. 자세한 검수는 [V071_COMPLETION.md](V071_COMPLETION.md), 선행 복구 계획은 [V071_MIGRATION.md](V071_MIGRATION.md)를 따른다.

| 항목 | 실제 확인값 |
|---|---|
| 현재 링크 / 이미지 | `/volume2/docker/trade/current` → `releases/522526d` / `mulppum-ieum:522526d` |
| 이미지 ID | `sha256:68009aba7b08e54b8d2a7fac7160ffcb919d219a14e75ae31a179cd20aadf858` |
| 앱 / 상태 | `mulppum-ieum-app-1`, v0.7.1, Docker healthy, HTTPS200/HTTP→HTTPS308 |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/`, 동일 저장 경로 유지 |
| AI 호출량 | 같은 DATA_DIR의 `rag-usage.sqlite`, 초기화하지 않음 |
| 자료팩 | `/volume2/docker/trade/knowledge/v0.5-20261101-9d7f2b4ffcd7/trade-rag-private-v05`, `/app/rag-private` 읽기 전용 |
| 실제 RAG 모델 | Hive `deepseek-ai/deepseek-v4.1-flash-1017`, 실응답 반환ID 일치 |
| 포트 / 네트워크 | `127.0.0.1:14310` → 4310, `mulppum-ieum_default`, `10.253.43.0/28`, 기존 ID 유지 |
| 비공개 배포 기록 | `/volume2/docker/trade/deployments/v071-2026-11-04T01-56-39Z` |

변경 전 작업 사본은 깨끗했고 NAS의 기존9d89cce 소스141개 파일을 해시로 대조해 현장 변경이 없음을 확인했다. Documents/iCloud 원본 작업 사본·기존 로컬4310/4312 서비스·모든 DB를 보존했다. 기존 서버 비밀환경과 로컬 보호 키의 설정 여부/사용 경로만 확인하고 재사용했다. `.env.nas`는 보호 백업 후 **TRADE_RELEASE 한 항목만** 편집했다. 기존 RAG·사진AI·카카오 등24개 설정은 값이 동일하며 키·키 포함 URL을 출력/커밋/브라우저 전달하지 않았다. OZD 브릿지는 계속 비활성이다.

### schema4 충돌과 백업·새 경로 복원

NAS v0.6과 main v0.7이 서로 다른 schema4이므로 통합 schema5를 사용한다. NAS25개 테이블과 모든 기존 행을 유지하고 import_documents를 추가해26개 테이블이 된다. main v0.7 schema4도 원본BLOB을 보존하며 진입할 수 있다. 롤백은 schema5 원본에 구버전을 실행하지 않고, 먼저 현재 자료를 백업한 뒤 교체 전 schema4 백업을 존재하지 않는 새 DATA_DIR로 복원해9d89cce 이미지와 연결한다. 기존 DB·백업·복원 사본은 삭제/덮어쓰지 않는다.

아래 경로는 모두 `/volume2/docker/trade/` 아래다. 앱만 중지해 일관된 백업을 생성했다.

| 대상 | 백업 | 새 경로 복원 |
|---|---|---|
| 교체 전 업무 DB·uploads | `backups/2026-11-04T02-11-08Z-v071-pre` | `restore-checks/2026-11-04T02-11-08Z-v071-migrated` (schema5) |
| 구버전 롤백 사본 | 위 schema4 백업 | `restore-checks/2026-11-04T02-11-08Z-v071-rollback` (schema4) |
| 호출량·자료 ZIP | `rag-backups/2026-11-04T02-11-08Z-v071-pre` | 사용량은 위 새 DATA_DIR, 자료는 `restore-checks/2026-11-04T02-11-08Z-v071-corpus/trade-rag-private-v05` |
| 실제 검수 후 DB·uploads | `backups/2026-11-04T02-15-25Z-v071-post` | `restore-checks/2026-11-04T02-15-25Z-v071-post` |
| 검수 후 호출량 | `rag-backups/2026-11-04T02-15-25Z-v071-post` | 위 검수 후 DATA_DIR의 `rag-usage.sqlite` |

교체 전 첨부18개·계정7개·업무25개 테이블 전체 행 해시와 호출량3행/20회를 보존했다. 복원 사본의 schema5 전환·26개 테이블·기존 모든 행 동일·원본 불변 트리거·로그인/파일 ACL·개선사항/상태/배송·RAG를 검수한 뒤 실제 DB를 전환했다. 실제 DB 전환 직후에도 기존25개 테이블이 동일했다. 자료 ZIP의 SHA-256/CRC와 별도 복원129개 파일 해시도 일치했다. 이전 앱이 schema5를 거부하는 것을 확인해 별도 schema4 롤백 사본을 준비했다.

실제 도메인 검수 후26개 테이블 모든 행·첨부18개·계정7개·새 원본BLOB1개·기존 참고사진BLOB1개·호출량26회를 다시 백업/복원했다. 모든 행과 원본/첨부/사진/사용량 해시·무결성이 일치했다. 새 합성 검수 초안의 현물 PHOTO는0개다. 복원 사본의 네트워크 없는 시험 서버에서 로그인·기존 물품/사진/타기관 차단·50/20/10 수량·저장 배송 예상·개선사항 답변/첨부·지침121문서를 HTTP로 확인했다. 실제 앱도 다시 시작해 HTTPS·Docker healthy와 보존 상태를 확인했다.

다른 실행 서비스65개 컨테이너ID, Cloudflare 라우팅 해시·커넥터, Docker 네트워크ID/서브넷, 기존 포트·데이터 마운트를 유지했다. 다른 서비스를 재시작하지 않았다. 같은 NAS 안에서 복원을 검증한 것이며 별도 저장소 재해복구는 남아 있다.

### 실접속과 검증 범위

- Node24/macOS `npm ci`(알려진 취약점0건), 서버131개·TypeScript/Vite·Chrome E2E22개 통과. NAS Linux 이미지 빌드와 서버131개도 통과했다. 전체 Playwright는 한 번에 하나만 실행했다.
- 실제 첨부 XLSX는 비공개 로컬 DB에서 DataTransfer 드래그→원본 미리보기→20개 비공개 초안/134개→실제 조달청 조회/20건 빈칸 입력→상세페이지까지 검사했다. 원본 번호/수량/전체품명/취득일/단가/폐품20행과 서로 다른 취득정보4그룹·원본 셀/BLOB/다운로드/파일 해시가 보존됐다. 실제 파일·원문·검수DB는 NAS 시연·Git·이미지에 옮기지 않았다.
- 공개 NAS에는 합성 XLSX1행만 등록했다. 실제 식별번호23062106의 제조사 ‘주식회사 이투지’로 정확번호 빈칸을 보완하고, 원본 폐품/수량·UNKNOWN/DRAFT/UNVERIFIED·원본 다운로드 해시를 확인했다. 원본과 현물 추정정보를 분리한다. 실제0건·잘못된 입력과5종 오류/한도 주입 후 초안·원본 보존을 구분해 검사했다. 제공기관 제한을 실제 유발하지 않았다.
- 실제 Hive1017 모델로 공개 프로그램 안내부터 답변·후속질문을 확인하고, 전송 승인된 설치 지침/서식도 확인했다. 각 section의 실제 근거ID 연결을 검사했다.1440px/390px에서 본문 출처표식/주소 잔여 없음·참고자료 기본접힘·원문/서식 다운로드·한글파일명·복사·Enter/Shift+Enter/IME·새대화를 확인했다. 오류재시도·대기중단·중단후 재전송방지와51개 초안의 다음묶음은 별도 합성 E2E다.
- `npm run rag:check -- --live`는121문서/8,164구간·인덱스 체크섬·실제1017 모델 응답을 통과했다. 원본은 실제 설치된3개만 제공하며 나머지 자료는 변환 텍스트 제공이다. 현행 규정 검증·공식 승인으로 표시하지 않는다. 개선사항/첨부 권한과 기존 RAG의 서버 검증을 유지한다.

**OZD 실제 변환은 미완료다.** 현재 장치의 검색 범위에서 사용자 OZD와 허가된 OZ/FORCS 엔진·라이선스·지원되는 자동 내보내기 어댑터를 확인하지 못했다. 브릿지 자체를 엔진으로 가장하거나 CLI옵션/ProgID를 발명하지 않았다. 자동변환은 비활성이고 원본보관·변환대기·같은OZD 수동XLSX 연결은 유지한다. 합성 테스트 더블의 변환을 실제 연결로 세지 않는다. 실제 파일·허가 엔진/내보내기 호스트와 품명/번호/수량 대조가 확보된 뒤 별도 토큰으로 연결해야 한다.

사진AI·주소/경로·K-에듀파인·온비드 공식 연계, 확인된 운송업체 단가·기관 정식 운영 승인·별도 저장소 백업은 기존 미확보 상태다. 배송 `sample-2026-11-v1`은 시연 가정이며 확정 견적이 아니다. 사이트는 계속 합성 시연 환경이다.

## 이전 v0.6 — 조달 실접속·엑셀 등록·기존 NAS 기능 통합 (2026-11-03)

[https://trade.h19h19.com](https://trade.h19h19.com)에 앱 소스 **`9d89ccec33bbf08cbb456a70edb0c074c16a19d5`**를 배포했다. 기준 main `8e249ed6b50285f733fe19c195358992e7ef76b6`에 기존 NAS의 개선사항·Hive1017 RAG·검색 개선을 통합했다. main을 그대로 배포하면 기존 기능과 서로 다른 schema3가 충돌하므로, 기존 행을 보존하는 **통합 schema4**를 사용한다. 이후 운영 기록만 수정한 문서 커밋은 앱 이미지에 재배포하지 않는다.

| 항목 | 실제 확인값 |
|---|---|
| 현재 링크 / 이미지 | `/volume2/docker/trade/current` → `releases/9d89cce` / `mulppum-ieum:9d89cce` |
| 이미지 ID | `sha256:9e111501253936bce6332d59be3705d27e189cbb708538a9e561009d8e5ca737` |
| 앱 / 상태 | `mulppum-ieum-app-1`, `/api/health` v0.6.0, HTTPS200, HTTP→HTTPS308 |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/`, 경로 유지 |
| AI 호출량 DB | 같은 경로 `rag-usage.sqlite`, 초기화하지 않음 |
| 자료팩 | `/volume2/docker/trade/knowledge/v0.5-20261101-9d7f2b4ffcd7/trade-rag-private-v05`, `/app/rag-private` 읽기 전용 |
| 실제 RAG 모델 | Hive `deepseek-ai/deepseek-v4.1-flash-1017`, 실응답 ID 일치 |
| 포트 / 네트워크 | `127.0.0.1:14310` → 4310, `mulppum-ieum_default`, `10.253.43.0/28`, 기존 ID 유지 |
| 비공개 배포 기록 | `/volume2/docker/trade/deployments/v06-2026-11-03T03-33-34Z` |

작업 전 로컬 미커밋 변경과 실제 데이터 경로를 확인했다. 사용자 원본 Documents/iCloud 작업 사본을 보존하고 `~/Developer/trade`에서 작업했다. NAS 기존 릴리스의 추적 파일 해시를 대조했다. `.env.nas`는 원본을 보호 보관하고 `TRADE_RELEASE`, `PROCUREMENT_ENABLED`, `DATA_GO_KR_SERVICE_KEY`, `PROCUREMENT_IMAGE_RIGHTS_CONFIRMED` 네 항목만 편집했다. 키를 출력하거나 브라우저·Git·이미지에 넣지 않았다. RAG·사진 AI 등 기존24개 설정은 값이 동일하다. Cloudflare 라우팅·커넥터, 다른 실행 서비스65개 ID와 Docker 네트워크·HTTPS·계정은 유지했다.

### 일관된 백업·마이그레이션·새 경로 복원

아래 경로는 모두 `/volume2/docker/trade/` 아래다. 앱만 중지하고 백업한 후 재가동했다.

| 대상 | 백업 | 별도 복원 |
|---|---|---|
| 교체 전 업무 DB·첨부 | `backups/2026-11-03T03-57-30Z-v06-pre` | `restore-checks/2026-11-03T03-57-30Z-v06-migrated` (schema4) |
| 이전 버전 롤백용 | 같은 schema3 백업 | `restore-checks/2026-11-03T03-57-30Z-v06-rollback` (schema3) |
| 호출량·자료 ZIP | `rag-backups/2026-11-03T03-57-30Z-v06-pre` | 호출량은 위 새 DATA_DIR, 자료는 `restore-checks/2026-11-03T03-57-30Z-v06-corpus/trade-rag-private-v05` |
| 실제 검수 후 업무 DB·첨부 | `backups/2026-11-03T04-08-42Z-v06-post` | `restore-checks/2026-11-03T04-08-42Z-v06-post` |
| 검수 후 호출량 | `rag-backups/2026-11-03T04-08-42Z-v06-post` | 위 검수 후 DATA_DIR의 `rag-usage.sqlite` |

교체 전 계정7개·첨부18개와 기존21개 테이블의 모든 행을 해시로 대조하고, 복원 사본과 실제 DB 양쪽에서 schema4 전환 후 기존 행이 동일함을 확인했다.25개 테이블로 늘었으며 원본 불변 트리거를 유지한다. 호출량17회와 자료 ZIP의 CRC/SHA-256, 새 경로로 복원한 자료129개 파일의 해시도 일치했다. 원본 DB를 복원 사본으로 바꾸지 않았다.

실제 검수 후 백업에서는25개 테이블 모든 행·첨부18개·계정7개·참고사진 BLOB1개·호출량18회를 별도 복원해 대조했다. 무결성·참조·첨부/사진 해시가 일치하고, 새 검수 초안의 현물 PHOTO는0개다. 복원 사본의 네트워크 없는 시험 서버에서 기존 로그인·사진·타기관 차단·50/20/10 상태배분·배송 예상321,000원·개선사항 답변/첨부·지침121문서를 HTTP로 확인했다. 검수 후 실제 앱도 재시작해 HTTPS와 보존 상태를 다시 확인했다.

첫 시도는 복원 사본의 WAL 디렉터리를 읽기 전용으로 연결해 검사가 중단됐고 자동으로 이전 앱을 재가동했다. 당시 원본 DB는 전환 전이었다. 검사 사본의 마운트를 바로잡아 위 교체 전 백업부터 재검사 후 배포했다. 기록의 `rollback-executed.txt`는 첫 시도 이력이며 현재 배포는9d89cce다. 모든 시도의 백업·복원본을 보존한다.

**롤백:** 먼저 현행 schema4 DB·uploads·호출량을 새 백업에 보존한다. 검증된 교체 전 schema3 백업을 다시 **존재하지 않는 새 경로**에 복원해 이전 `ded598a` 이미지 및 그 경로의 `TRADE_DATA_DIR`과 연결한다. 이전 앱이 schema4를 거부하는 것도 확인했다. 현재 DB를 삭제하거나 덮어쓰지 않으며, 업데이트 후 신규 자료는 별도 보존·대조해야 한다. 상세 절차는 [V06_MIGRATION.md](V06_MIGRATION.md)를 따른다. 동일 NAS 안의 복원 검증이며 별도 저장소 재해복구는 남아 있다.

### 실접속·브라우저 검수와 남은 설정

- Node24/macOS `npm ci`(알려진 취약점0건), 서버110개·TypeScript/Vite 빌드·Chrome E2E17개 통과. NAS Linux 이미지 빌드·서버110개 통과.
- 공식 명세와 제공 키로 식별번호23062106을 조회했다. 태양광발전장치/이투지/DE-BIPV-5 표기와 제조사 제안 ‘주식회사 이투지’를 확인했다. 별도 모델 필드는 없어 빈 값으로 유지한다. 실제 HTTPS 등록 화면에서 조회→선택 정보 입력→비공개 초안 저장을 확인했다.
- 실제0건·잘못된 키403·정상 이미지200을 확인했다. 지연·통신실패·429/사용량 오류는 분리한 주입 검사이며 실제 제공기관 제한을 유발하지 않았다. 같은 번호의 캐시 재사용, 일괄 조회 중단·재개·빈칸 반영을 조작했다.
- 공식 데이터셋의 ‘이용허락범위 제한 없음’을 확인하고 참고사진만 별도 저장했다. 현물/게시 증빙으로 계산하지 않는다. 키·키 포함 URL과 외부 오류 원문을 출력하지 않는다.
- 실제 첨부 엑셀20행·총134개의 원본 번호·전체 품명·수량·원본 셀·파일 해시를 별도 로컬 DB에서 대조했다.20초안 및13종 번호의 조회·20건 빈칸 반영·업로드 이력을 확인했다. 파일에 없는 부서·기관 자산번호·삽입사진은 추정하지 않았다. 사진 행 선택과 앞자리0 번호·부서는 별도 합성 XLSX로 검사했다. 실제 파일·원본 행·검수 DB는 NAS 시연·Git·이미지에 넣지 않았다.
- 1440px/390px 등록·재고·이력과 실제 도메인의 모바일 RAG 답변·출처를 조작했다. 배포 후 `rag:check -- --live`는121문서/8,164구간·체크섬과 실제1017 응답을 통과했다. 기존 개선사항과 첨부의 본인/운영관리자 권한·CSRF·미인증 차단도 유지한다.

연결 완료는 조달청 제품정보·참고사진, 승인된 기존 RAG다. 사진 AI·주소/경로, K-에듀파인·온비드 공식 API는 미연결이다. 배송 `sample-2026-11-v1`은 시연 가정이고 확정 견적이 아니다. 기관 정식 운영 승인·데모/실자료 분리와 별도 저장소 백업은 후속 운영 설정이다. 상세 검사 범위는 [V06_COMPLETION.md](V06_COMPLETION.md)를 따른다.

## 이전 v0.5.3 — 지침 공개 승인 및 RAG 품질 개선 (2026-11-02)

[AI 업무도우미](https://trade.h19h19.com/#/assistant)의 실제 배포 소스는 **`ded598a002b8f61da55a4f2abafbc4b3eeff022c`**이다. 지침121문서/8,164구간과 공개 프로그램 안내10개를 제공한다. 사용자가 모든 인증 업무기관 및 현재 공개 시연 계정의 지침 검색·원문 열람을 명시적으로 허용했고, 외부 AI 전송도 별도 승인했다. 이전의 지침 비공개 보관 지시는 이 범위에서 갱신되었다. 다른 설치의 기본 지침 설정은 계속 false다.

기존 시연 DB와 공개 시연 계정을 유지하며 실제 기관자료 운영 승인을 주장하지 않는다. 지침 전체는 여전히 현행성 미검증 제공판이고, 원본 파일은 실제 보유한3개만 제공한다. DESIGN6개는 설계·개발을 명시한 질문에서만 검색한다. 구조·품질 검수·한계는 [RAG_QUALITY.md](RAG_QUALITY.md)를 따른다.

| 항목 | 실제 확인값 |
|---|---|
| 소스 / 현재 링크 | 위 전체 SHA / `/volume2/docker/trade/current` → `releases/ded598a` |
| 앱 이미지 | `mulppum-ieum:ded598a` |
| 이미지 ID | `sha256:ec9e3064fa63b88412cfca5d80f3baa623dbbf854b19caacda28764ee8e61e46` |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/` |
| AI 호출량 DB | 같은 경로 `rag-usage.sqlite`, 초기화하지 않음 |
| 자료팩 | `/volume2/docker/trade/knowledge/v0.5-20261101-9d7f2b4ffcd7/trade-rag-private-v05`, `/app/rag-private` 읽기 전용 |
| 실제 모델 | Hive `deepseek-ai/deepseek-v4.1-flash-1017`, 실제 반환ID 일치 |
| 배포 기록 | `/volume2/docker/trade/deployments/rag-quality-2026-11-02T06-00-54Z/` |
| 상태 | `/api/health` v0.5.3, Docker healthy, HTTPS 정상 |

변경 전 로컬 미커밋 변경은 없었고 기존 NAS 릴리스의 추적 파일121개를 `97c41e95...` 소스와 SHA-256으로 대조해 현장 수정이 없음을 확인했다. 비공개 자료는 Git archive·Docker 빌드 문맥 밖에 보존했다. NAS `.env.nas`에서 바꾼 항목은 **`TRADE_RELEASE=ded598a`, `RAG_LIBRARY_ENABLED=true` 두 개뿐**이다. 서버 키·실제 모델ID·외부 전송 승인·호출한도·사진 AI·Codex/OpenCode 설정은 유지했다.

### 일관된 백업·별도 복원

부모 경로는 모두 `/volume2/docker/trade/`다.

| 보존 대상 | 백업 / 별도 복원 |
|---|---|
| 업무 DB·uploads | `backups/2026-11-02T06-06-05Z-rag-quality` / `restore-checks/2026-11-02T06-06-05Z-rag-quality` |
| AI 호출량 DB·자료 ZIP | `rag-backups/2026-11-02T06-06-05Z-rag-quality` / 호출량은 위 복원 DATA_DIR의 같은 파일명 |
| 자료 ZIP 별도 복원 | 위 백업 ZIP / `restore-checks/2026-11-02T06-06-05Z-rag-quality-corpus/trade-rag-private-v05` |

앱만 중지한 상태에서 업무DB·첨부17개·계정7개와 별도 호출량DB를 SQLite backup API로 백업했다. 새 DATA_DIR 복원 후 **업무DB21개 테이블의 모든 행 해시가 동일, 스키마3 유지**, 첨부 SHA-256·참조 무결성 검사를 통과했다. AI 호출량DB의 무결성·백업/복원 SHA-256 및 기존10회 사용량 보존을 확인했다. 자료 ZIP SHA-256·CRC와 별도 복원129개 파일 해시도 모두 일치했다. 실제 서비스 교체 직후 업무DB21개 테이블이 교체 전과 동일함을 다시 확인했다. 이후 검수 로그인은 정상 세션·감사기록을 추가한다.

새 이미지의 네트워크 없는 시험 컨테이너에서 복원 DB의 기존 로그인·비공개 초안·사진·50/20/10 상태배분·저장 배송 예상·개선사항 상태/답변/첨부·타기관 접근 차단을 HTTP로 검사한 뒤 본 앱을 교체했다. 기존 DB를 복원 사본으로 바꾸거나 초기화하지 않았다. 백업·복원본·구버전 이미지와 릴리스를 보존했다.

### 실제 검수 및 서비스 보존

- Node24/macOS `npm ci`(알려진 취약점0건), 서버89개·빌드·Chrome E2E15개 통과. NAS Linux에서도 빌드·서버89개 통과.
- 현재 NAS 앱의 `npm run rag:check -- --live`:121문서/8,164구간·manifest 인덱스 SHA-256 일치, 공개 프로그램 안내 실제1017 모델 응답 확인. Hive 계정 모델 목록 API를 발명하지 않고 completion 반환ID로 검증했다.
- 승인된 지침/서식/후속 질문12개와 프로그램 질문8개를 실제 같은 모델로 생성해 핵심 주장·조건·예외·출처를 대조했다. 표지 오선택과 원본 연결정보 누락을 수정 후 재검사했다. 실제 질의·답변·원문은 공개 Git에 넣지 않았다.
- 실제 HTTPS의1440px/390px 화면에서 지침 질문→출처 펼침→후속 질문, 서식 원본 받기, 새 프로그램 질문→기능 이동을 조작했다. 원본 다운로드의 한글 파일명과 바이트 SHA-256이 설치본과 같았고 가로 넘침이 없었다.
- 비로그인401, 관리자 업무RAG403, CSRF403을 유지했다. 의견·첨부는 여전히 본인/운영관리자만 열람하며 RAG에 수집하지 않는다. 업무 수량·원본 대장·승인 상태를 생성 모델이 변경하지 않는다.
- 다른 실행 서비스65개의 컨테이너ID, Cloudflare 라우팅 해시·기존 커넥터, Docker 네트워크ID/서브넷, `127.0.0.1:14310`, 데이터 마운트·HTTPS 쿠키를 보존했다. 다른 서비스를 재시작하지 않았다.

현재 백업은 동일 NAS 볼륨의 복원 검증이다. 별도 저장소 재해복구, 현행 규정 전문 대조, 미보유 원본 추가와 자료 갱신 절차는 후속 운영 설정이다. K-에듀파인·온비드 공식 API, 조달청·사진 AI·주소/경로의 미확보 키/권한과 배송 시연 단가 표시는 그대로다.

문제 발생 시 먼저 현행 데이터와 호출량을 백업하고, 보존된 `97c41e9` 릴리스/이미지와 위 배포기록의 보호된 `env-before.nas`로 앱만 복귀한다. 현재 변경은 스키마3를 유지하므로 DB 초기화가 필요 없다. 지침을 차단해야 하면 서버의 `RAG_LIBRARY_ENABLED=false`로 재생성한다. 데이터 복원은 검증된 백업을 새로운 DATA_DIR에 복원·검수한 다음 경로를 전환한다. 기존 DB·업로드·지침·백업을 삭제하지 않는다.

## 데이터와 기존 서비스 보존

NAS 접속 후 먼저 `/volume2`의 실제 마운트, 여유 공간, Docker/Compose 버전, 실행 중 컨테이너·포트, 기존 앱·터널·저장경로를 읽기 전용으로 확인한다. 기존 컨테이너·DNS·터널 설정·DB를 대체하지 않는다. 새 이름의 Compose 프로젝트 `mulppum-ieum`과 확인된 빈 저장경로를 사용한다.

기본 제안 경로는 `/volume2/docker/trade/` 아래 `releases/<commit>/`, `demo-data/`, `backups/`, `secrets/`다. 실제로 사용하기 전 기존 파일 유무와 소유권을 확인한다. 기관용 운영 데이터는 별도 `production-data/`에 두고 시연 DB를 운영 DB로 전환하지 않는다. UID 1000 컨테이너의 쓰기 권한은 새 앱 디렉터리에만 부여한다. 시스템 전체나 다른 앱의 파일 소유권을 재귀 변경하지 않는다.

## 실행 구성

`deploy/nas.compose.yml`은 Node 24 서버, 명시적인 호스트 데이터·백업 영속 경로, HTTPS 출처와 Secure 쿠키, loopback 전용 포트 14310, 헬스체크, 로그 용량 제한을 설정한다. 데이터·백업 폴더가 없으면 자동으로 빈 폴더를 만드는 대신 실패한다.

`deploy/nas.env.example`을 Git 밖의 NAS 전용 `.env.nas`로 복사한다. 시연은 `TRADE_NODE_ENV=development`, `TRADE_DEMO_MODE=true`, 별도 `demo-data`를 사용한다. 이는 합성 시연을 표시하기 위한 명시적 설정이며 production의 데모 차단을 해제하지 않는다. 실제 운영은 `production`/`false`, 별도 운영 DB·계정·기관 승인이 필요하다.

```sh
docker compose --env-file /volume2/docker/trade/.env.nas -f deploy/nas.compose.yml config --quiet
docker compose --env-file /volume2/docker/trade/.env.nas -f deploy/nas.compose.yml up -d --build app
docker compose --env-file /volume2/docker/trade/.env.nas -f deploy/nas.compose.yml ps
curl --fail http://127.0.0.1:14310/api/health
```

NAS 버전에 따라 `docker compose` 또는 검증된 `docker-compose` 명령을 사용한다. 기존 Docker 설치나 다른 스택을 바꾸지 않는다.

이번 NAS는 Docker 기본 주소 풀이 소진되어 있었다. 기존 네트워크·라우팅과 겹치지 않는 `10.253.43.0/28`을 검사한 뒤 `deploy/nas.network.compose.yml`을 추가하여 이 앱 전용 네트워크만 만들었다. 현재 NAS에서 사용하는 명령은 다음과 같다. 상위 폴더 권한을 바꾸지 않고 기존에 허용된 sudo를 사용한다.

```sh
sudo -n /usr/local/bin/docker-compose --env-file /volume2/docker/trade/.env.nas \
  -f /volume2/docker/trade/current/deploy/nas.compose.yml \
  -f /volume2/docker/trade/current/deploy/nas.network.compose.yml ps
```

## Cloudflare 연결

기존 NAS Tunnel이 있다면 설정 사본을 보존한 뒤 **새 hostname 경로 하나만 추가**한다. cloudflared가 NAS 호스트 네트워크에서 실행되면 원본은 `http://127.0.0.1:14310`이다. Docker bridge에서 실행되는 터널은 별도 네트워크 접근을 확인해야 하므로 loopback 주소를 그대로 넣지 않는다.

별도 커넥터가 필요한 경우에만 `deploy/nas.tunnel.compose.yml`을 추가한다. 이 커넥터는 앱과 같은 Compose 네트워크를 사용하므로 원본은 `http://app:4310`이다. 터널 토큰은 NAS의 `secrets/` 파일에만 보관하고 읽기 전용 파일로 마운트한다. 토큰을 Compose 명령 인자·로그·Git에 넣지 않는다. 기존 터널 토큰을 교체하지 않는다.

Cloudflare에서 새 `trade.h19h19.com`이 다른 레코드·Worker·앱과 충돌하지 않는지 다시 확인한 뒤 새 경로만 등록한다. TLS 검증을 끄지 않는다. [Cloudflare 공식 Tunnel 구성](https://developers.cloudflare.com/tunnel/get-started/)을 따른다.

## 배포 후 검증과 복구

HTTPS 인증서·HTTP→HTTPS 전환, 로그인·로그아웃, Secure/HttpOnly/SameSite 쿠키, Origin/CSRF, 저장 실패 안내, 한글 사진·증빙, CSV 다운로드, 기관별 파일 접근을 실제 도메인에서 검사한다. API 응답이 캐시되지 않는지 확인하고 데스크톱/390px 화면을 연다.

앱의 합성 데이터 한 건을 저장한 뒤 앱 컨테이너만 재시작하여 DB·첨부가 남는지 확인한다. 앱을 중지한 상태에서 같은 이미지의 일회성 컨테이너로 `npm run backup`을 실행한다. `/app/backups`는 `TRADE_BACKUP_DIR`에 바인드되어 백업이 컨테이너 삭제 후에도 볼륨2에 남는다. 복원 시험은 새 `restore-checks/` 부모 경로를 별도로 마운트하여 아직 없는 하위 경로로 복원한다. 기존 데이터 마운트 자체를 복원 대상 삼아 덮어쓰지 않는다. 복원 사본의 실제 로그인·파일 접근을 확인한다. 같은 NAS 볼륨의 백업만으로 NAS 장애 복구까지 검증했다고 주장하지 않는다.

문제가 있으면 새 `trade` 경로와 이 Compose 프로젝트만 중지하고 소스 릴리스·환경 경로를 이전 값으로 되돌린다. `down -v`, DB 삭제, `docker system prune`, 기존 서비스 전체 재시작은 사용하지 않는다.

## 챗봇 무반응 동작·상태 문구 수정 — 2026-11-02

현재 배포 소스는 `97c41e95bc85633e530df5c90c62f6238c1c982b`, 릴리스는 `/volume2/docker/trade/releases/97c41e9`, 이미지는 `mulppum-ieum:97c41e9`이다(이미지ID `sha256:d1cff51c326c550a202508cd247e33b3c16b4a8d5e5da31ff652dda84ade00d3`). 연결 설정·공급자·응답 모델 표시를 사용자 화면에서 제거했다. 추천 질문이 입력칸만 채우던 동작을 즉시 답변 요청으로 바꾸고, Enter·답변 받기를 기본 전송으로 통일했다. 요청 즉시 질문과 대기 표시가 보이며 답변이 도착하면 해당 위치로 이동한다. 한글 조합 중 Enter와 Shift+Enter는 전송하지 않으며 오류 시 입력을 보존하고 같은 문맥으로 재시도한다. 자료만 찾기는 생성하지 않는다.

공개 서비스에 나타나던 소요조회/합의서 추천은 비공개 지침 범위로 요청되어 `NO_EVIDENCE`를 반환했다. 지침이 제공될 때만 해당 추천·범위를 표시하도록 수정하고 서버에서도 제공 범위를 설명한다. 지침 공유 승인 미확인 상태를 변경하거나 가짜 규정 답변을 만들지 않았다. 실제 외부 모델 연결은 정상임을 일반 프로그램 질문의 반환 모델로 확인했다.

최종 교체 전 `/volume2/docker/trade/backups/2026-11-02T05-17-28Z-chat-prompt-pre-v3`에 앱 중지 상태로 DB·첨부17개·계정7개와 호출한도DB를 백업했고 `/volume2/docker/trade/restore-checks/2026-11-02T05-17-28Z-chat-prompt-pre-v3`로 별도 복원했다. 한도 기록1행·7회·SHA-256/무결성을 대조하고 격리 시험 서버에서 기존 물품·사진·상태배분·배송·개선사항/첨부/답변 ACL을 확인했다. 앞선 `chat-answer-pre-v3` 백업·복원도 보존한다. DB버전3·저장 경로·키·모델·읽기 전용 corpus·HTTPS·포트·Cloudflare·Docker 네트워크·다른 컨테이너ID를 유지했고 환경은 `TRADE_RELEASE`만 변경했다.

Node24 서버84개·빌드·Chrome 전체15개가 통과했다. 실제 도메인에서 데스크톱 Enter와 모바일 전송 버튼의1017 응답을 확인했고, 최종 수정 후 추천 질문 한 번 클릭만으로 대기 표시→실제1017 답변을 확인했다. 캡처를 직접 열어 확인하며 원시 질문/응답·키는 Git에 넣지 않는다. 검수 기록은 `/volume2/docker/trade/deployments/chat-prompt-fix-2026-11-02T05-17-28Z`와 이전 `chat-answer-fix-2026-11-02T03-54-17Z`에 비공개로 보존한다. 실제 법령 지침의 공개·원문 접근은 기존 승인 대기 상태다.

## 이전 AI 답변 요청 동의 문구 제거 — 2026-11-02

현재 배포 소스는 `a6de093827130bfb8a5d12f188629c40719f03e5`, 릴리스는 `/volume2/docker/trade/releases/a6de093`, 이미지는 `mulppum-ieum:a6de093`이다(이미지ID `sha256:3dcea824561566d46d806b1aa1ba7d8eb7a7cd99d106fc823bc9dca134862eca`). 사용자 요청으로 챗봇의 전송 동의 문구·체크박스를 제거했다. AI 답변 받기 버튼을 누를 때만 요청별 확인 플래그를 보내고, 근거 검색은 외부 AI를 호출하지 않는다. 서버의 인증·업무역할·CSRF·외부전송 승인·지침 공유·한도 검사는 유지한다.

변경 전 기존 릴리스121개 파일이 배포 원본과 동일함을 확인했다. `/volume2/docker/trade/backups/2026-11-02T03-19-53Z-rag-direct-request-pre-v3`에 앱 중지 상태의 DB·첨부17개·계정7개와 호출한도DB를 백업하고 `/volume2/docker/trade/restore-checks/2026-11-02T03-19-53Z-rag-direct-request-pre-v3`에 별도 복원했다. 호출한도1행·3회와 해시/무결성을 대조하고 비공개 시험 서버에서 기존 물품·사진·상태배분·배송·개선사항/답변·파일 ACL을 확인했다. DB버전3·데이터 경로·키·모델·Cloudflare·HTTPS·포트·Docker 네트워크와 다른 컨테이너ID를 보존했으며 환경파일은 `TRADE_RELEASE`만 변경했다.

서버83개·빌드·Chrome E2E14개를 통과했다. 추가 UI 검사는 공급자 테스트 더블로 검색과 명시적 AI 요청을 구분하고 오류에도 근거가 유지되는지 확인한다. 실제 공개 도메인의1440px/390px에서 문구·체크박스 부재와 질문 입력만으로 버튼 활성화를 확인하고, 체크박스 없이 요청한 결과 실제 `deepseek-ai/deepseek-v4.1-flash-1017` 답변을 받았다. 캡처도 직접 열어 확인했다. 검증 기록은 `/volume2/docker/trade/deployments/rag-direct-request-2026-11-02T03-19-53Z`에 비공개로 보존했다.

## 이전 v0.5.2 Hive DeepSeek 1017 연결 결과 — 2026-11-02

현재 [AI 업무도우미](https://trade.h19h19.com/#/assistant)는 사용자가 지정한 기존 OpenCode의 Hive 키로 실제 DeepSeek4.1 1017 답변을 제공한다. 키는 값 출력 없이 SSH stdin으로 서버에 전달하여 root 전용 환경파일에 저장했다. 원래 OpenCode/Codex의 모델·인증과 사진 AI 설정은 변경하지 않았다.

| 항목 | 실제 구성 |
|---|---|
| 배포 소스 / 릴리스 | `919a706e14869c0ecfce9eee9dc45f160a0b52d7` / `/volume2/docker/trade/releases/919a706` (`current`) |
| 앱 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:919a706` |
| 이미지 ID | `sha256:933743db764b43c440ae5a65ee78481210dd71aadef7aaedba44547dcdfbaebc` |
| 실제 공급자 / 반환 모델 | Hive / `deepseek-ai/deepseek-v4.1-flash-1017` |
| 서버 비밀환경 | `/volume2/docker/trade/.env.nas` (root/0600), `RAG_PROVIDER=hive`, `HIVE_API_KEY` 사용 |
| DB / 첨부 / 호출 한도 | 기존 `/volume2/docker/trade/demo-data/trade.sqlite`, `uploads/`, 별도 `rag-usage.sqlite` |
| 공개 검색 / 비공개 자료 | 프로그램 안내9개·지침0개 / 121문서·8,164구간과129개 파일은 이전 버전 경로/읽기 전용 유지 |
| 검증 기록 | `/volume2/docker/trade/deployments/hive-2026-11-02T02-51-56Z` (root 전용) |

이전과 같은 세 Compose 파일을 사용하며 `nas.rag.compose.yml`에 공급자·Hive 키 환경변수만 추가했다. 호스트 loopback14310, HTTPS/Secure 쿠키, Cloudflare 설정/커넥터·Docker 네트워크ID와 다른 기존 컨테이너ID를 유지했다. 환경파일 변경 항목은 `TRADE_RELEASE`, `RAG_PROVIDER`, `RAG_MODEL`, `RAG_AI_ENABLED`, `HIVE_API_KEY` 다섯 가지다. 비공개 지침 공유는 계속 false다.

### 백업·복원·검수

| 단계 | 백업 / 새 복원 경로 |
|---|---|
| 교체 전 검수 | `/volume2/docker/trade/backups/2026-11-02T02-55-34Z-hive-pre-v3` / `/volume2/docker/trade/restore-checks/2026-11-02T02-55-34Z-hive-pre-v3` |
| 최종 교체 직전 | `/volume2/docker/trade/backups/2026-11-02T03-05-21Z-hive-final-cutover-v3` / `/volume2/docker/trade/restore-checks/2026-11-02T03-05-21Z-hive-final-cutover-v3` |
| 실제 답변 후 | `/volume2/docker/trade/backups/2026-11-02T03-11-34Z-hive-post-v3` / `/volume2/docker/trade/restore-checks/2026-11-02T03-11-34Z-hive-post-v3` |

앱만 중지한 일관된 DB·uploads 백업과 SHA-256·SQLite 무결성 검사를 수행했다. DB버전3을 유지하며 최종 교체 전후 기존21개 테이블 전체 행 해시가 같았다. 교체 후 첨부17개·계정7개와 기존 물품·사진·상태배분·배송 예상·개선사항/답변/파일 ACL을 별도 `--network none` 시험 서버에서 복원 검수했다. 시험 컨테이너만 제거하고 사본은 보존했다.

실제 UI 생성으로 만든 `rag-usage.sqlite`는 기본 backup/restore 스크립트 대상이 아니므로 앱 중지 중 SQLite backup으로 별도 저장했다. 위 post 백업의 `rag-usage.sqlite`와 `rag-usage-manifest.json`을 새 복원 경로에도 연결해 무결성·파일 해시·행을 대조했다(기관/일자1행, 호출3회). **복구할 때 기본 restore만 실행한 뒤 끝내지 말고, 같은 시점의 사용량DB도 별도로 무결성·해시 검증 후 새 경로에 복사한다.** 대화본문은 이 DB에 저장하지 않는다.

macOS/NAS 서버83개·빌드, Chrome13개, `rag:check -- --live`, 공개 안내20개 실제 답변/출처 대조와1440px/390px 직접 조작을 확인했다. 초기 답변의 예약 설명을 보완하고 재검수했으며, 공급자 형식 오류1건은 성공 처리하지 않고 거부한 후 수동 재요청했다. 상세 결과와 한계는 [RAG_TEST_REPORT.md](RAG_TEST_REPORT.md)를 따른다.

초기 교체 확인의 고정 health 버전 문제로 이전 소스/환경에 자동 복귀한 기록과 백업도 보존했다. 최종 health는0.5.2다. 이 변경에는 DB 마이그레이션이 없으므로 같은 v3 DB를 유지한 채 보호된 이전 환경파일과 `8c71c76` 소스로 복귀할 수 있다. 복귀 전에는 신규 DB·첨부·호출한도를 별도로 백업한다. corpus와 기존 데이터를 덮어쓰지 않는다. 기관 정식 운영·지침 공유·별도 저장소 재해복구 승인은 포함하지 않는다.

## 이전 v0.5.1 개선사항 보존 업데이트 결과 — 2026-11-02

당시 [https://trade.h19h19.com](https://trade.h19h19.com)에 v0.5.1을 반영했다. [개선사항](https://trade.h19h19.com/#/feedback) 메뉴에서 의견과 사진·파일을 접수하며 모바일은 `더보기 → 개선사항`으로 접근한다. 작성자와 운영관리자만 조회하고 관리자가 처리 상태·답변을 기록한다. 첨부는 최대5개·각8MB이며 기존 업무 파일 권한은 확대하지 않았다.

| 항목 | 실제 구성 |
|---|---|
| 배포 소스 | `8c71c76dcb5c0585b3ee42e0209c6c254fe23dad` (`codex/feedback-tab`) |
| 현재 릴리스 | `/volume2/docker/trade/releases/8c71c76dcb5c0585b3ee42e0209c6c254fe23dad` (`current` 링크) |
| 앱 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:8c71c76` |
| 이미지 ID | `sha256:a09672e80d8bfe36b838fa4ee2f7941845242bb86fd7a86b1dcedeb7e7744cde` |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/` (기존 경로 유지) |
| DB 버전 | `user_version=3` (v2에 개선사항 테이블2개만 추가) |
| 포트 / 네트워크 | `127.0.0.1:14310 → 4310`, 기존 `mulppum-ieum_default`·`10.253.43.0/28` 유지 |
| 지침 연결 | 이전 v0.5 버전 경로와 `/app/rag-private` 읽기 전용 연결 유지, 129개 파일 동일 |
| 서비스 검색 / AI | 프로그램 안내9개·지침0개 / DeepSeek·사진 AI 기존 설정 유지 |
| 검증 기록 | `/volume2/docker/trade/deployments/feedback-2026-11-02T01-17-44Z/` |

기존 DB·계정·미커밋 변경·포트·서비스를 먼저 확인한 뒤 Git archive 소스만 빌드했다. 자료팩·검색DB·개선사항·첨부·키는 이미지나 공개 저장소에 포함하지 않았다. 다른 컨테이너65개의 ID, 기존 Docker network ID, Cloudflare 라우팅 SHA-256과 터널 커넥터를 유지했고 `.env.nas`는 `TRADE_RELEASE`만 변경했다. HTTPS·Secure 쿠키와 loopback 포트·데이터 경로도 유지한다.

### 일관된 백업·마이그레이션·복원

각 백업은 앱만 중지한 상태에서 DB+uploads를 함께 저장하고 무결성·파일 해시를 검사했다. 아래 경로와 원본을 모두 보존했다.

| 단계 | 백업 / 별도 복원 경로 |
|---|---|
| 교체 전 v2 | `/volume2/docker/trade/backups/2026-11-02T01-17-44Z-feedback-v2` / `/volume2/docker/trade/restore-checks/2026-11-02T01-17-44Z-feedback-v2` |
| 별도 v3 마이그레이션 | 위 백업 → `/volume2/docker/trade/restore-checks/2026-11-02T01-17-44Z-feedback-v2-migrated-v3` |
| 실제 교체 직전 v2 | `/volume2/docker/trade/backups/2026-11-02T01-30-59Z-feedback-cutover-v2` / `/volume2/docker/trade/restore-checks/2026-11-02T01-30-59Z-feedback-cutover-v2` |
| 교체 후 v3 | `/volume2/docker/trade/backups/2026-11-02T01-37-58Z-feedback-post-v3` / `/volume2/docker/trade/restore-checks/2026-11-02T01-37-58Z-feedback-post-v3` |

구버전 복원 사본에서 로그인·기존 자료·사진·80개 상태배분·배송 예상 기록을 검사했다. 별도 사본 및 실제 DB의 v2→v3 전후 **기존19개 테이블 전체 행 해시가 일치**했고 재오픈은 멱등이었다. 계정7개·기존 첨부15개를 보존했다. 교체 후 **첨부17개**를 포함한 v3 백업을 새 경로에 복원하여 기존 자료와 신규 의견의 처리완료 상태·관리자 답변·첨부2개·작성자 접근·타기관 차단을 확인했다. 실제 앱 재시작 후 같은 신규 의견과 원본 자료를 확인했다. 시험 컨테이너만 제거하고 모든 백업·복원 사본은 유지했다.

**v3 원본에 v0.5 구버전을 직접 실행하지 않는다.** 먼저 앱만 중지하고 v3 DB·uploads·새 의견을 별도 보존한다. 위 검증된 v2 백업을 **새 DATA_DIR**로 복원한 뒤 이전 `d6bd5c9` 릴리스/이미지와 환경을 사용한다. 신규 v3 의견은 v2 백업에 없으므로 별도 대조·보존이 필요하다. 기존 원본을 덮어쓰거나 DB 버전 숫자만 내리는 복구는 사용하지 않는다.

### 실제 화면·권한 검사

Node24/macOS·NAS Linux Docker에서 서버80개·빌드, 최종 Chrome E2E13개를 통과했고 알려진 npm 취약점은0건이었다. 실제 도메인의 1440px/390px 화면에서 의견·사진·TXT 접수와 다운로드, 관리자 상태·답변, 작성자의 결과 조회를 직접 확인했다. 동일기관 다른 사용자와 타기관은 의견·첨부를 읽을 수 없고 기존 업무 파일 ACL도 유지했다. 한글 파일명·이미지 EXIF 제거·미인증401·CSRF403·no-store를 확인했다. 상세 결과는 [FEEDBACK.md](FEEDBACK.md)에 기록했다.

기관 운영 승인 전 **합성 시연** 상태다. 지침 공유 미확인·DeepSeek 키 미제공에 따른 비활성 설정을 유지했으며 기존 사진 AI·Codex 모델/인증은 변경하지 않았다. 같은 NAS 안의 백업·복원을 검증했으며 NAS 전체 장애용 별도 저장소 백업은 여전히 후속 설정이다.

## 이전 v0.5 RAG 보존 업데이트 결과 — 2026-11-01

당시 [https://trade.h19h19.com](https://trade.h19h19.com)에 반영한 v0.5.0의 실제 배포 소스는 `d6bd5c9faef0d19bdee8db582da87df1750400a8`입니다. 앱 코드를 수정하지 않고 지정된 main 커밋 그대로 NAS에서 빌드·반영했습니다. 이전 v0.4 검수 문서가 main에 합쳐지지 않았으므로 이 문서에 해당 이력도 보존했습니다.

| 항목 | 실제 구성 |
|---|---|
| 현재 릴리스 | `/volume2/docker/trade/releases/d6bd5c9faef0d19bdee8db582da87df1750400a8` (`current` 링크) |
| 앱 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:d6bd5c9` |
| 이미지 ID | `sha256:8f01948e814183810324dec01dc833ab9f9c9bf2d08d9ddefaa82637f4af624f` |
| DB / 첨부 | `/volume2/docker/trade/demo-data/trade.sqlite` / 같은 경로 `uploads/`, 기존 경로·계정 유지 |
| 지침 버전 경로 | `/volume2/docker/trade/knowledge/v0.5-20261101-9d7f2b4ffcd7/trade-rag-private-v05` |
| 컨테이너 지침 | `/app/rag-private`, **읽기 전용**, UID1000 읽기 확인 |
| 자료팩 보존본 | `/volume2/docker/trade/knowledge-packages/trade-rag-private-v05-9d7f2b4ffcd7.zip` (비공개) |
| 인덱스 SHA-256 | `bd1a85c1f3ddfd398387b537291a8497e2ef05a2345483c28337504a7dbd4a11` |
| 자료팩 ZIP SHA-256 | `9d7f2b4ffcd7289ca32260e3e5427585aed324d6db310533f6ff8e3cbcf3116a` |
| 설치 / 서비스 공개 수 | 비공개121문서·8,164구간 / 서비스는 **프로그램8개·지침0개** |
| RAG 모델 | 설정 별칭 `deepseek-flash`, 실제 계정 모델/반환ID는 **키 미제공으로 미확인** |
| 검증 기록 | `/volume2/docker/trade/deployments/v05-2026-11-01T07-33-37Z/` |

로컬은 미커밋 변경이 없는 `~/Developer/trade`에서 새 `codex/v05-nas-rag` 브랜치를 사용했습니다. 이전 문서 브랜치와 실제 v0.4 릴리스는 보존했고 NAS 이전 릴리스의 추적 파일 해시가 기준 커밋과 같은지 먼저 확인했습니다. 사용자가 명시한 영문 다운로드 파일 두 개가 전달한 자료팩·인계서임을 확인해 사용했습니다. 첨부의 실행 지시는 점검 참고이며 기관 공유/반출 승인 자체로 해석하지 않았습니다.

자료팩은 ZIP 경로/심볼릭 링크·CRC를 검사하고 저장소 및 Docker 빌드 문맥 밖에 새 버전으로 해제했습니다. NAS 상위 공유 경로 권한은 변경하지 않았고 새 자료 하위 경로만 UID1000·디렉터리0500/파일0400으로 설정했습니다. 기존 Compose 두 파일에 `deploy/nas.rag.compose.yml`만 추가해 read-only bind를 연결했습니다. 이미지 빌드는 Git archive만 사용했으며 런타임 이미지에 자료팩·index·MD·원본 경로가 없는 것을 확인했습니다.

### 승인·키 상태

사용자는 공개 프로그램 안내/질문 및 지침의 DeepSeek 전송을 허용했고 키는 나중에 제공하기로 했습니다. 기관 간 지침 공유는 아직 미확인입니다. 따라서 실제 `.env.nas`의 RAG 설정은 다음과 같습니다. 키 원문은 Git·클라이언트·이 문서에 없습니다.

```dotenv
RAG_MODEL=deepseek-flash
RAG_AI_ENABLED=false
RAG_EXTERNAL_APPROVED=true
RAG_LIBRARY_ENABLED=false
RAG_LIBRARY_EXTERNAL_APPROVED=true
RAG_DAILY_LIMIT=50
```

`TRADE_RAG_CORPUS_DIR`에는 위 NAS 버전 경로를 지정했습니다. `DEEPSEEK_API_KEY`는 현재 없으며 기본 빈 값으로 컨테이너에 전달됩니다. Codex 자체 모델·인증 및 기존 사진 AI 설정은 바꾸지 않았습니다. 공식 [모델 목록 문서](https://api-docs.deepseek.com/api/list-models/)에서 `deepseek-flash`/DeepSeek-V4.1-Flash 별칭을 확인했으나 계정 접근과 실제 응답 모델을 검증한 것은 아닙니다. `--live` 및 실제 DeepSeek20개 답변 검수는 키 제공 후 수행해야 합니다. 다른 모델로 자동 대체하지 않았습니다.

서비스에서는 지침 검색 결과·직접 구절·원본 다운로드를 차단합니다. 검사 프로세스에서만 지침 활성화를 켜고 외부 포트 없는 `--network none` 컨테이너에서 원문 검색·후속 질문·원본 바이트 해시를 검수했습니다. 실제 앱 안에서 실행한 `rag:check`도 별도 검사 프로세스의 환경만 바꾸었으며 실행 중인 HTTP 서비스의 공유 설정을 바꾸지 않았습니다.

### 백업·복원과 기존 서비스 보존

| 단계 | 백업 / 별도 복원 경로 |
|---|---|
| 사전 업무DB | `backups/2026-11-01T07-34-44Z-v05-pre` / `restore-checks/2026-11-01T07-34-44Z-v05-pre` |
| 별도 RAG 백업 | `rag-backups/2026-11-01T07-34-44Z-v05-pre` (자료 ZIP·호출한도 DB 유무 기록) |
| 자료팩 복원 | `restore-checks/2026-11-01T07-34-44Z-v05-pre-corpus/trade-rag-private-v05` |
| 교체 직전 업무DB | `backups/2026-11-01T07-39-40Z-v05-cutover` / 같은 이름의 `restore-checks/` 새 경로 |
| 업데이트 후 업무DB | `backups/2026-11-01T07-43-25Z-v05-post` / 같은 이름의 `restore-checks/` 새 경로 |

위 상대 경로의 부모는 모두 `/volume2/docker/trade/`입니다. 각 업무DB 백업은 앱만 중지한 상태에서 SQLite 무결성·참조·첨부15개 SHA-256을 확인하고 새 경로로 복원했습니다. 구버전 복원 서버에서 기존 로그인·초안·사진·상태배분·배송 기록을 확인한 뒤 새 이미지를 빌드했습니다. 새 버전의 복원 사본과 실제 DB 재오픈 모두 **기존19개 테이블 전체 행 해시 동일, user_version=2 유지**를 확인했습니다. RAG는 업무DB 마이그레이션을 추가하지 않습니다.

자료팩은 별도로 ZIP을 보존·해시 검증하고 독립 복원 폴더의129개 파일을 전부 원본 해시와 대조했습니다. 실제 이미지와 실제 마운트에서 `rag:check`의121문서/8,164구간·manifest 일치를 확인했습니다. 모든 구간의 MD 출처 위치도 변환 규칙으로 재현해 검증했습니다. `rag-usage.sqlite`는 키·호출이 없어 사전/사후 모두 **존재하지 않음**을 별도 기록했습니다. 대화나 가짜 호출한도 DB를 만들지 않았습니다.

향후 AI를 활성화하면 기본 업무DB 백업만으로 호출한도 DB까지 보존했다고 판단하지 마세요. 앱을 중지하고 `DATA_DIR/rag-usage.sqlite`를 SQLite backup API로 별도 백업해 무결성·SHA-256을 기록하고, 새 복원 DATA_DIR의 같은 파일에 복원·검증해야 합니다. 지침은 같은 버전의 ZIP/manifest/전체 파일을 별도 보존하세요. 현재 백업은 같은 NAS 볼륨의 검증이며 별도 저장소 장애복구는 남아 있습니다.

업데이트 후 복원 서버에서 기존 계정·물품·첨부·배송 기록과 지침 미공유 상태를 확인했습니다. 시험 컨테이너만 제거하고 모든 백업·복원 사본·구버전 릴리스를 보존했습니다. 다른 앱 컨테이너ID, Docker network ID/subnet, Cloudflare 라우팅 해시, HTTPS 출처·Secure 쿠키·`127.0.0.1:14310`을 유지했고 터널도 재시작하지 않았습니다.

문제가 생기면 앱만 중지하고 현행 데이터·RAG 사용량을 먼저 보존하세요. v0.4 복귀는 보존된 `9712affa...` 릴리스/이미지와 환경 설정을 사용하며 지침·RAG 백업은 삭제하지 않습니다. v0.5는 스키마2를 유지하므로 원본 DB를 초기화할 이유가 없습니다. 데이터 복원이 필요하면 검증한 백업을 **새 DATA_DIR**에 복원해 로그인·파일을 확인한 후 경로를 전환하세요.

### 검사 결과와 남은 검수

Node24/macOS 및 NAS Docker에서 서버73개·빌드, Chrome E2E11개, 알려진 npm 취약점0건을 확인했습니다. 실제 HTTPS에서 질문→프로그램 근거→출처 펼침→후속 질문→기능 이동을 1440px/390px로 조작하고 캡처를 열어 확인했습니다. 비로그인401·관리자403·CSRF403, 공유 미승인 원본/구절404, 키 없는 생성 요청의 검색 전용 상태를 확인했습니다. 오프라인20개 질의 검색은 수행했지만 실제 모델 생성은0회입니다. 상세는 [RAG_TEST_REPORT.md](RAG_TEST_REPORT.md)를 따릅니다.

## 이전 v0.4 보존 업데이트 결과 — 2026-11-01

**현재 서비스는 [https://trade.h19h19.com](https://trade.h19h19.com)의 v0.4.0 합성 시연**입니다. 최신 main 기준 `9712affa22991a4b021fccdb8e913b66d145a4f3`을 Git archive로 전달해 NAS에서 빌드했습니다. 앱 코드 변경 없이 해당 커밋 그대로 배포했으며 아래 v0.3 기록은 이전 이력입니다.

| 항목 | 실제 확인값 |
|---|---|
| 소스 / 현재 릴리스 | `9712affa22991a4b021fccdb8e913b66d145a4f3` / `/volume2/docker/trade/releases/9712affa22991a4b021fccdb8e913b66d145a4f3` |
| 현재 링크 | `/volume2/docker/trade/current` → 위 릴리스 |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:9712aff` |
| 이미지 ID | `sha256:eb2e7d0b6237b70ea5db78889b8b90aa3edbdb274e3f22be016a47cc5f2f9094` |
| DB / 업로드 | `/volume2/docker/trade/demo-data/trade.sqlite` / `/volume2/docker/trade/demo-data/uploads/` (동일 경로 유지) |
| 런타임 | Node 24.22.2, `DEMO_MODE=true`, `NODE_ENV=development`, DB `user_version=2` |
| 기존 연결 | `127.0.0.1:14310`, `10.253.43.0/28`, 기존 Docker network ID, HTTPS 출처·Secure 쿠키·Tunnel/DNS 유지 |
| 최초 검증 백업 | `/volume2/docker/trade/backups/2026-11-01T06-38-04Z-v04-v1` |
| 교체 직전 v1 백업 | `/volume2/docker/trade/backups/2026-11-01T06-41-33Z-cutover-v1` |
| 업데이트·검수 후 v2 백업 | `/volume2/docker/trade/backups/2026-11-01T06-49-41Z-v04-post` |
| 배포 검증 기록 | `/volume2/docker/trade/deployments/v04-2026-11-01T06-38-04Z/` (비공개 NAS 경로) |

로컬 작업 사본 `~/Developer/trade`에는 미커밋 변경이 없었습니다. 기존 NAS 릴리스의 모든 추적 파일 SHA-256을 이전 커밋과 비교해 현장 수정이 없음을 확인했습니다. 데이터 경로·마운트와 DB 버전을 먼저 확인했고 기존 DB를 새로 만들거나 계정·첨부를 초기화하지 않았습니다. `.env.nas`는 NAS 내부에 원본을 보존한 뒤 `TRADE_RELEASE`만 변경했습니다. 다른 앱 컨테이너 ID, 기존 Docker network ID 및 Cloudflare 라우팅 설정의 SHA-256은 유지됐고 Tunnel 커넥터도 재시작하지 않았습니다.

### 백업·마이그레이션·복원

앱만 중지하고 v1 DB+uploads를 백업했습니다. SQLite 무결성/참조, 첨부 14개 SHA-256을 검사하고 `/volume2/docker/trade/restore-checks/2026-11-01T06-38-04Z-v04-v1`에 복원했습니다. 구버전의 별도 비공개 시험 컨테이너에서 기존 로그인·초안·사진·타기관 접근 차단을 확인한 뒤 기존 앱을 재가동했습니다.

같은 백업을 새 `2026-11-01T06-38-04Z-v04-v1-migrated-v2` 경로에 다시 복원하여 v2로 마이그레이션했습니다. 기존 **13개 테이블 전체 행의 정렬된 JSON 해시**가 전후 동일했고 재오픈도 멱등이었습니다. 기관 3개·계정 7개·물품 7개·자산 6개·첨부 14개를 포함한 기존 자료와 로그인·파일 ACL을 확인했습니다. NAS 이미지 빌드·59개 서버 테스트 후 교체 직전 v1 백업과 별도 `2026-11-01T06-41-33Z-cutover-v1` 복원 사본을 추가했습니다. 실제 DB 마이그레이션에서도 같은 전체 행 보존 검사를 통과한 후 앱 컨테이너만 교체했습니다.

공개 사이트 검수 후 앱을 다시 중지해 v2 백업을 만들고 `/volume2/docker/trade/restore-checks/2026-11-01T06-49-41Z-v04-post`에 복원했습니다. 별도 비공개 v0.4 서버에서 기존·신규 초안과 첨부 **15개**, 한글 사진 품명·명판 용도, 50/20/10 상태 배분, 저장한 배송 예상 기록을 확인했습니다. 실제 앱도 재기동 후 같은 검사를 통과했습니다. 시험 컨테이너만 제거하고 모든 백업·복원 디렉터리는 보존했습니다.

**롤백 시 v2 원본에 v0.3을 바로 실행하지 마세요.** 먼저 앱만 중지하고 v2 DB·uploads를 별도로 백업합니다. 새 경로에 검증한 v1 백업을 복원한 뒤 `TRADE_DATA_DIR`을 그 사본으로, `TRADE_RELEASE`와 `current`를 보존된 `174431a` 릴리스로 바꾸고 동일 Compose 프로젝트의 앱만 실행하세요. 교체 후 신규 v2 자료는 v1 백업에 없으므로 별도로 보존·대조해야 합니다. 기존 원본을 덮어쓰거나 볼륨을 지우는 복구는 사용하지 않습니다.

### 실제 도메인 검수와 남은 설정

macOS/Node 24와 NAS Linux Docker에서 서버 **59개**, TypeScript/Vite 빌드, Chrome E2E **9개**를 통과했습니다(E2E는 로컬 4311의 별도 DB). 알려진 npm 취약점은 0건입니다. 실제 HTTPS 로그인·쿠키·HTTP→HTTPS 308·CSRF 거부·파일 ACL·한글 첨부·UTF-8 BOM CSV와 기존 자료의 영속성을 확인했습니다. 1440px/390px 화면을 직접 조작하고 생성 캡처를 이미지 뷰어로 열어 확인했습니다. 상세 검수는 [V04_TEST_REPORT.md](V04_TEST_REPORT.md)를 따릅니다.

**비식별 실제 에듀파인 파일과 공급자 승인 자료는 제공되지 않았습니다.** 다단 머리글·수동 매핑·합계·80개 등록·재등록·충돌 롤백은 합성 XLSX/XLS로 검수했으며 실제 학교 양식 검수 완료로 표시하지 않습니다. 조달청/참고사진·AI 모델/키·주소/경로는 모두 false/빈 값이고 실제 외부 호출 성공은 없습니다. K-에듀파인·온비드 공식 연결도 미연결입니다. 기본 운송 단가는 `sample-2026-11-v1`의 시연용 가정이며 업체 확정 견적·예약·배차·결제가 아닙니다.

`npm run preflight`는 HTTPS·Secure 쿠키·저장소 무결성은 통과하고, 현재 합성 시연 설정의 `NODE_ENV`, 데모 모드, 시연 계정 분리 조건은 **미충족(종료 1)** 으로 보고했습니다. 이를 우회하지 않았으며 기관 정식 운영 준비 완료를 주장하지 않습니다. 백업은 동일 NAS 볼륨 내부에서 검증했으며 별도 저장소 재해복구는 남아 있습니다.

## 이전 v0.3 실제 배포 결과 — 2026-10-31

**[https://trade.h19h19.com](https://trade.h19h19.com)** 에 NAS 합성 시연 배포를 완료했다. 로컬 Mac에서 서버를 실행하지 않아도 NAS의 Docker 앱과 기존 NAS Cloudflare Tunnel로 응답한다. 사용자가 알려준 「포켓몬」 채팅의 기존 NAS 접속 설정을 찾아 사용했으며 인증 키·터널 비밀 자료는 복사하거나 Git에 넣지 않았다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `174431a7fedc0efb53c5d3d9e0e108e27eeb5099` |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:174431a` |
| 이미지 ID | `sha256:8c6b595bd5ba3e5aa001a6520954f8d7ff6597a5873f0e717ce93a21f1ef04e3` |
| 실행 환경 | NAS Linux amd64, Docker 24.0.2, Compose 2.20.1, Node 24.22.2 |
| 소스 / 현재 릴리스 | `/volume2/docker/trade/releases/174431a` / `/volume2/docker/trade/current` |
| DB·업로드 | `/volume2/docker/trade/demo-data/trade.sqlite`, 같은 경로의 `uploads/` |
| 백업 | `/volume2/docker/trade/backups/2026-10-31T06-05-17.229Z` |
| 검증한 복원 사본 | `/volume2/docker/trade/restore-checks/2026-10-31T06-05-17.229Z` |
| 접근 / 재시작 | 호스트 `127.0.0.1:14310`만 공개, restart=`unless-stopped`, health=`healthy` |
| 외부 접근 | Cloudflare 프록시 DNS → 기존 NAS Tunnel → `http://127.0.0.1:14310` |

NAS 컨테이너에서 `npm ci`·빌드·서버 **40개 테스트**를 통과했다. 실제 도메인의 HTTPS 인증서, HTTP→HTTPS **308** 전환, Secure/HttpOnly/SameSite 쿠키, 로그인, CSRF 거부, 비공개 초안·파일의 기관 격리, 한글 사진·증빙 업로드/다운로드, UTF-8 BOM CSV를 확인했다. API는 `no-store`를 유지한다. 데스크톱 1440×1000과 모바일 390×844 화면을 실제로 열어 확인했으며 모바일 페이지 가로 넘침이 없다.

공개 도메인에서 만든 합성 초안과 첨부가 이미지 교체·컨테이너 재시작 뒤에도 남는 것을 확인했다. 앱만 중지한 상태에서 **첨부 14개**를 포함한 일관된 백업을 생성하고 즉시 앱을 재기동했다. 백업을 새 경로에 복원해 별도 비공개 시험 컨테이너에서 로그인·원본 초안·사진·타 기관 파일 차단을 검증했다. 시험 컨테이너만 제거했으며 DB·첨부·백업·복원 사본은 모두 보존했다.

기존 터널 설정은 `/volume2/docker/trade/deployments/cloudflared-routing-before.yml`에 보존한 뒤 새 hostname 규칙 한 개만 추가했다. 기존 세 규칙은 바이트 단위로 유지했다. 터널 커넥터만 재시작해 적용했고 기존 세 도메인의 응답은 이전과 동일했다. 다른 앱 컨테이너의 ID는 모두 유지됐다. 기존 터널 토큰이나 자격증명은 변경하지 않았다.

이 배포는 **합성 시연용**이다. 기관 운영 승인·외부 API/AI·실제 기관 자료 반입은 포함하지 않는다. 백업복원은 같은 NAS 볼륨 안에서 확인했으며 NAS 전체 장애를 대비한 별도 저장소 백업은 후속 운영 설정이다. Cloudflare가 삽입하려는 통계 스크립트는 기존 CSP가 차단하며, 이를 허용하려고 보안 정책을 완화하지 않았다.

## 실제 배포 결과 — 2026-11-10 v0.10 AI 핵심 기능

**[https://trade.h19h19.com](https://trade.h19h19.com)** 에 v0.10을 배포했다. PR #2를 main에 먼저 병합한 뒤 PR #3의 base를 main으로 바꾸어 CI를 다시 통과시켰고, PR #3 병합 커밋을 그대로 배포했다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `cc2b8828f6c03700bc1a268e0f12754ae3ab55b9` |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:cc2b882` |
| 이미지 ID | `sha256:d76abc07c06591ad6cd74f158f0448760b083bc181a4372237be9fbef2f91c9c` |
| 실행 환경 | NAS Linux amd64, Docker 24.0.2, Compose 2.20.1, Node 24 |
| 소스 / 현재 릴리스 | `/volume2/docker/trade/releases/cc2b882` / `/volume2/docker/trade/current` |
| DB·업로드 | `/volume2/docker/trade/demo-data/trade.sqlite`, 같은 경로의 `uploads/` |
| 백업 | `/volume2/docker/trade/backups/2026-11-09T16-55-08.788Z` (첨부 18개) |
| 검증한 복원 사본 | `/volume2/docker/trade/backups/restore-checks/2026-11-09T16-55-08.788Z` |
| 접근 / 상태 | 호스트 `127.0.0.1:14310`, `restart=unless-stopped`, `healthy` |

배포 전 백업은 SQLite backup API와 첨부 SHA-256 검증으로 생성했고, 새 경로에 복원해 `integrity_check=ok`, 로그인, 공개 물품 6개, 첨부 18개, 사진 200 응답을 확인했다. 운영 DB·계정·첨부는 배포 전후 모두 12묶음·7계정·18첨부로 동일했다.

새 릴리스는 먼저 NAS Linux 런타임에서 별도 포트로 기동해 `0.10.0`, Hive 실제 검색, AI 비교 설명을 확인한 뒤 컨테이너를 교체했다. 공개 도메인에서도 `0.10.0`, AI core `provider=hive`, `model=deepseek-ai/deepseek-v4.1-flash-1017`, 실제 의자 검색·비교 설명, 조달 식별번호 `20269246` 정확조회를 확인했다. 데스크톱 1440×1000과 모바일 390×844에서 가로 넘침과 페이지 오류가 없었다.

`.env.nas` 원본은 `/volume2/docker/trade/deployments/env.nas.before-cc2b882`에 보존했다. `TRADE_RELEASE=cc2b882`, `AI_CORE_ENABLED=true`, `AI_CORE_DATA_APPROVED=true`, `AI_CORE_DAILY_LIMIT=100`을 반영했으며, 이 승인은 합성 시연·공개 물품 범위에만 해당한다. 실제 기관자료의 외부 전송은 별도 승인이 필요하다. 유효한 카카오 키가 없어 `LOCATION_ENABLED=false`, `ROUTE_ENABLED=false`이며 주소·도로경로는 미연결이다. 기본 배송 단가는 시연용 가정이다.

Docker 엔진 저장소는 `/volume1/@docker`이고 새 이미지 크기는 524MB다. 기존 `mulppum-ieum:92ad038` 이미지와 롤백용 `.env.nas`를 보존했으며 `prune`, `down -v`, DB 삭제·초기화는 수행하지 않았다. 롤백은 `current`를 `releases/92ad038`로 되돌리고 `TRADE_RELEASE=92ad038`로 `up -d --no-build app`을 실행한다.

## 자동등록 복합 상태 라벨 배포 — 2026-11-10

자동등록 결과에서 조달번호 일치와 AI 원문 보완이 모두 적용된 물품을 한눈에 구분하도록 `조달번호 일치 · AI 원문 보완` 복합 라벨을 추가했다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `5bb6c3254f517c54e1f40bc609033c38fff363ff` |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:5bb6c32` |
| 이미지 ID | `sha256:bcbab01498b176a7b401b3f23e3d0c2cc0325bf59b8087c629af737279c06722` |
| 릴리스 | `/volume2/docker/trade/releases/5bb6c32` |
| 환경 백업 | `/volume2/docker/trade/deployments/env.nas.before-5bb6c32` |
| 롤백 기준 | `current-before-5bb6c32.txt`, 이전 이미지 `mulppum-ieum:cc2b882` 보존 |

서버 단위 테스트 167개·빌드·Chrome E2E 32개가 통과했고, 실제 공개 OZD 15행에서 복합 라벨 5건·조달번호만 일치 10건을 확인했다. 운영 DB·계정·첨부는 12묶음·7계정·18첨부로 배포 전과 동일하고, 컨테이너는 healthy다.

## 실제 배포 결과 — 2026-11-10 v0.11 트럭 적재·확인 후 등록

**[https://trade.h19h19.com](https://trade.h19h19.com)** 에 v0.11을 배포했다. schema6→7 마이그레이션 전에 운영 앱만 잠시 중지해 DB·uploads·rag-usage·RAG corpus를 일관되게 백업했고, 별도 복원 사본에서 새 코드로 schema7을 먼저 기동해 검증했다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `9c7bb139101bc672b083ac721b73a4a8672d9169` |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:9c7bb13` |
| 이미지 ID | `sha256:63fa52c1565e7a3183fa704c53286a5123554b60dee94f674776efc002d5e759` |
| 릴리스 | `/volume2/docker/trade/releases/9c7bb13` |
| 백업 | `/volume2/docker/trade/backups/2026-11-10T07-49-03Z-v011-pre` (schema6, 13묶음·8자산·6등록행·7계정·18첨부, RAG 129파일) |
| 검증한 복원 사본 | `/volume2/docker/trade/backups/restore-checks/2026-11-10T07-49-03Z-v011-schema7` |
| 환경 백업 | `/volume2/docker/trade/deployments/env.nas.before-v011` |
| 상태 | running·healthy, schema7, `integrity_check=ok`, 참조 오류 0 |

복원 사본을 새 v0.11 코드로 기동해 기존 27개 테이블의 행 수·해시가 동일하고 `registration_previews`/`registration_preview_images`만 추가됐음을 확인했다. 실제 운영 DB도 schema7로 전환된 뒤 13묶음·8자산·6등록행·7계정·18첨부가 그대로였고, 새 preview 테이블은 0건이었다. RAG는 121문서/8,164구간을 유지했다.

실제 공개 OZD 15행/165개와 실제 비식별 엑셀 20행/134개를 별도 복제본에서 검수했다. 분석·조달/AI 보완·부분 수정 단계의 lots/assets/imported_rows는 0건 증가했고, 확인하고 등록 후 각각 15묶음·20묶음이 비공개 초안으로 생성됐다. 원본 행 대조는 15/15·20/20 통과했고, 낡은 버전 409·동일 원본 재업로드 409·완료 후 재확인 reused를 확인했다.

조달 참고사진은 정확번호 후보 10건을 임시 저장하고 담당자가 1건을 선택 취소해 9건만 연결했다. `files`/PHOTO 증빙은 증가하지 않았다. 트럭 UI는 기본 20개/1회/111,000~180,000원, 200개/10회, 혼합 205개/11회, 쌓기 105개/3회, 100km/3회로 자동 갱신했고, 높이·중량 초과는 예시 차량 없음, 2,001개·13종은 400으로 거부했다. 모든 금액은 예시 운임이며 `binding=false`다.

공개 도메인에서 `0.11.0`, Hive `deepseek-ai/deepseek-v4.1-flash-1017`, 조달 식별번호 `20269246`, RAG 121/8,164, packing API와 데스크톱 1440px·모바일 390px 화면을 확인했다. 모바일 결과 카드의 텍스트 열 깨짐도 수정해 가로 넘침 없이 표시된다. 기존 이미지 `mulppum-ieum:5bb6c32`와 환경파일 백업은 롤백용으로 보존했으며 `prune`, `down -v`, DB 삭제·초기화는 수행하지 않았다.

## 시연 로그인 환경설정·데모 이미지 배포 — 2026-11-12

단일 시연 계정을 `.env.single-demo`(저장소 밖, 권한 600)로 초기화하도록 바꾸고, 화면에 남아 있던 기본 계정 안내를 제거했다. 시연 물품 사진은 기존 인라인 SVG 일러스트 대신 생성 WebP 20종으로 교체했으며, 공개 6건의 사진은 기존 첨부를 지우지 않고 새 파일을 만들어 DB 참조만 바꾸는 방식으로 갱신했다. 생성 이미지는 실제 현물·공식 조달 사진이 아니며 README와 화면에서 시연용으로 표시한다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `3e0ab445e0aaa98dbd7349a4c8223e83b61d4662` (PR #16) |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:3e0ab44` |
| 이미지 ID | `sha256:1c024ee2016c1e385562066c9b21c2d9dd591e02ec7a360fdfc947d2af437ca1` |
| 릴리스 | `/volume2/docker/trade/releases/3e0ab44` |
| 백업 (교체 전) | `backups/2026-11-12T01-20-17Z-showcase` (schema8, 2,207묶음·18첨부·7계정·보관 2,194) |
| 별도 복원 검증 | `backups/restore-checks/2026-11-12T01-20-17Z-showcase` (`integrity_check=ok`, FK 오류 0) |
| 환경 백업 | `deployments/env.nas.before-3e0ab44` |
| 롤백 기준 | `current-before-3e0ab44.txt` = `releases/1372822`, 이미지 `mulppum-ieum:1372822` 보존 |

`npm ci`(취약점 0) · `npm test` 205개 · `npm run build` · `LANG=C.UTF-8 LC_ALL=C.UTF-8 npm run test:e2e` 39개가 통과했다. 배포 후 `/api/health` 200, 컨테이너 healthy, 기동 로그에 오류가 없다.

데모 화면에는 샘플 300건을 추가해 공개 물품이 306건이 됐고, 공개 6건과 샘플 30건의 사진을 생성 이미지로 교체했다. `/api/files/:id`는 `image/webp` 12,226바이트로 응답하며 해시가 `server/demo-assets/whiteboard.webp`와 일치한다.

| 확인 | 결과 |
|---|---|
| 공개 물품 | 306건(기존 6 + 샘플 300) |
| 등록 물품(내 기관) | 9건 = 초안 7 + 공개 2 |
| 삭제 보관함 | 2,194건, 복구 가능, 원본·대장·감사 이력 보존 |
| 업로드 파일 | 74개(기존 18 + 샘플 20 + 교체 36), 기존 파일 삭제 없음 |
| DB | `user_version=8`, `integrity_check=ok` |
| PC 1440px·모바일 390px | `/market`·`/manage`·`/packing` 가로 넘침 0, 페이지 오류 0 |

운영 DB·uploads·RAG·API 키·모델 설정은 변경하지 않았고, 세 Compose 파일(`nas.compose.yml`·`nas.network.compose.yml`·`nas.rag.compose.yml`)을 함께 적용했다. `prune`, `down -v`, DB 삭제·초기화, `reset --hard`는 사용하지 않았다.

GitLab(`gitlab.aigov.go.kr`)은 2026-11-12 00:00부터 운영체계 점검으로 접속이 404로 막혀 있어 이번 변경을 미러링하지 못했다. 서비스 재개 후 `gitlab/main`을 부모로 하는 콘텐츠 스냅샷 커밋을 만들어 fast-forward로 반영한다(force-push 금지).

### 로그인 화면 시연 계정 안내 제거 — 2026-11-12

로그인 화면에 공개되던 시연 계정 7개 목록과 공통 비밀번호를 제거했다. 시연 모드에서는 "계정은 운영자가 별도로 발급한다"는 문구만 표시한다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `1f17f4227c48d93e6dbaa3b33dc17e64278634e1` (PR #18) |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:1f17f42` |
| 백업 (교체 전) | `backups/2026-11-12T02-15-40Z-login-cleanup` (2,507묶음·318첨부, 무결성 ok) |
| 환경 백업 | `deployments/env.nas.before-1f17f42` |
| 롤백 기준 | `releases/3e0ab44`, 이미지 `mulppum-ieum:3e0ab44` 보존 |

DB·uploads·계정·RAG·키·모델 설정은 변경하지 않았다. 배포 후 로그인 화면에서 목록·공통 비밀번호가 사라졌고(빌드 산출물 검색 0건), 기존 계정 로그인은 200으로 유지된다. PC·모바일 가로 넘침 0, `npm test` 205개·`npm run build`·UTF-8 E2E 39개 통과.

### 시연 로그인 운영자 계정 전환 — 2026-11-12

시연 배포에서 환경에 설정한 운영자 계정만 로그인되도록 바꿨다. 기동 시 `ADMIN_ID`·`ADMIN_PASSWORD`로 운영자 계정(`시연 운영기관`, EDITOR)을 만들고, 함께 시드된 시연 기관 계정 7개는 `active=0`으로 로그인만 차단했다. 물품·첨부·감사 이력의 소유자 행은 그대로 두어 공개 카탈로그 306건이 유지된다.

| 항목 | 실제 구성 |
|---|---|
| 앱 소스 | `688fe1aff0942549d534f8abbdff58ab6e1d6991` (PR #19) |
| 컨테이너 / 이미지 | `mulppum-ieum-app-1` / `mulppum-ieum:688fe1a` |
| 백업 (교체 전) | `backups/2026-11-12T04-28-19Z-operator-login` (무결성 ok) |
| 환경 백업 | `deployments/env.nas.before-688fe1a`, `deployments/env.nas.before-operator` |
| 롤백 기준 | `releases/1f17f42`, 이미지 `mulppum-ieum:1f17f42` 보존 |

기동 로그에 운영자 계정 최초 생성과 시연 계정 7건 차단이 기록됐다. 운영자 계정 로그인은 200(EDITOR, `시연 운영기관`), `staff1@demo.local`은 401이며, 공개 물품 306건(샘플 300 포함)은 그대로 조회된다. PC 1440px·모바일 390px에서 로그인→AI 물품검색 진입과 가로 넘침 0을 확인했다. `npm test` 209개·`npm run build`·UTF-8 E2E 39개 통과.

시연 계정을 다시 로그인시켜야 하면 `.env.nas`의 `ADMIN_ID`·`ADMIN_PASSWORD`를 비우고 `UPDATE users SET active=1 WHERE email LIKE '%@demo.local'`를 실행한 뒤 재기동한다(운영 데이터 삭제 없음).

### 시연 단일계정 흐름·AI 공급자 전환 — 2026-11-12

시연 영상의 등록→검토→게시→신청→인계·인수→대장·완료를 **한 로그인**으로 진행할 수 있게 했다. 운영자 계정에만 적용되는 시연 단일계정 모드로, 일반 계정과 비시연 배포의 권한 규칙은 그대로다.

| 구분 | 동작 |
|---|---|
| 검토·게시 | 운영자가 자기 초안을 승인. 게시 게이트(작성자≠검토자)는 유지되어 검토는 같은 기관의 비로그인 "시연 검토자" 신원으로 기록 |
| 같은 기관 신청 | 시연 모드에서만 허용(일반 계정은 계속 차단) |
| 인계·인수·대장·완료 | 양측 단계 모두 운영자 계정으로 기록 |

RAG 공급자로 `openai`를 추가했다. `RAG_PROVIDER=openai`, `RAG_MODEL=gpt-6.1-sol`을 서버 비밀환경에만 두고 고정 엔드포인트·모델 응답 검증·JSON 스키마·출처 검증은 기존과 동일하게 유지한다. 기존 Hive 설정값은 지우지 않았다.

| 항목 | 실제 값 |
|---|---|
| 앱 소스 | `a4033c68dedfc7399497143fd8ce0f20491339ea` (PR #20) |
| 이미지 / current | `mulppum-ieum:a4033c6` / `releases/a4033c6` |
| 백업 | `backups/<ts>-openai` (교체 전, 무결성 ok) |
| 환경 백업 | `deployments/env.nas.before-openai`, `env.nas.before-a4033c6` |
| 롤백 | `releases/688fe1a`, 이미지 `mulppum-ieum:688fe1a` |

배포 컨테이너 안에서 `rag-check --live`를 실행해 실제 모델 응답 `gpt-6.1-sol`과 출처 검증된 섹션 생성을 확인했다. `npm test` 210개·`npm run build`·UTF-8 E2E 39개 통과.




