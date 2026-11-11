# 쓸모잇다

공공기관의 남은 물품을 필요한 기관으로 연결하는 물품 관리전환 시연용 웹 애플리케이션입니다. 엑셀·OZD 자료를 읽어 비공개 초안을 만들고, 담당자 확인과 독립 게시 검토를 거친 뒤 검색·신청·인계·인수·최종 증빙 확인까지 한 흐름으로 보여줍니다.

- GitLab: <https://gitlab.aigov.go.kr/h19h19/mulppum-ieum>
- 로컬 기본 주소: <http://localhost:4310>
- 화면: 데스크톱·모바일 반응형

## 주요 기능

- 엑셀·OZD 파일의 로컬 분석과 비공개 초안 생성
- 분석 결과 확인 후 등록, 담당자 수정, 원본 수량·번호·취득정보 보존
- 기관별 담당자·검토자 권한 분리와 작성자 자기 승인 방지
- 기관 간 AI 물품검색과 조건·장단점 비교
- 주소 기반 예상 운송비·차량 배치 비교(예시 단가, 실제 배차 아님)
- 신청·예비 배정·자산 연결·인계·인수·대장 반영·증빙 확인
- AI 업무도우미와 접힌 참고자료
- 테스트·삭제 보관함·복원 등 시연용 관리 기능

> 공식 기관 승인, 실제 행정처리, 공식 자산대장 반영을 대신하지 않습니다. 화면의 `증빙 확인 완료`는 담당자가 입력한 확인 근거의 완료 상태입니다.

## 요구 사항

- Node.js 24.x
- npm
- Chromium 또는 Google Chrome(E2E 테스트용)

## 빠른 실행

```sh
git clone https://gitlab.aigov.go.kr/h19h19/mulppum-ieum.git
cd mulppum-ieum
npm ci
npm run build
npm run demo:single
```

브라우저에서 <http://localhost:4310>을 엽니다. 기본 데이터 경로는 `data/single-demo/`이며 반복 실행해도 기존 시연 DB를 초기화하지 않습니다.

## 시연 계정 설정

`npm run demo:single`은 저장소 루트의 `.env.single-demo`를 읽습니다. 이 파일은 `.gitignore`에 포함되어 있으므로 Git에 올라가지 않습니다.

```dotenv
ADMIN_ID=
ADMIN_PASSWORD=
```

두 값을 채운 뒤 파일 권한을 제한합니다.

```sh
chmod 600 .env.single-demo
```

- 두 항목은 함께 설정해야 합니다.
- 아이디는 3~80자의 영문·숫자·점·밑줄·하이픈을 사용할 수 있습니다.
- 비밀번호는 4~200자입니다.
- 값은 최초 단일 시연 DB 생성 시 적용됩니다. 로그인 후 설정에서 변경한 계정은 재시작해도 유지됩니다.
- `.env.single-demo`의 실제 값은 README·Git·로그·스크린샷에 남기지 않습니다.
- 단일 시연 계정은 로컬 개발 환경 전용입니다. 외부에 공개하기 전에 별도 승인과 보안 설정이 필요합니다.

환경 파일 경로를 바꾸려면 `DEMO_SINGLE_ENV_FILE`을 지정할 수 있습니다.

```sh
DEMO_SINGLE_ENV_FILE=/secure/path/demo.env npm run demo:single
```

## 개발 실행

```sh
npm run dev
```

프런트엔드 개발 서버는 <http://localhost:5173>에서 실행됩니다. 기본 합성 데이터는 `data/demo/`에 보존됩니다.

## 검증

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E 테스트는 기존 시연 데이터와 분리된 실행별 임시 `DATA_DIR`을 사용합니다.

## 데이터와 복구

- 실행 데이터: `DATA_DIR/trade.sqlite`
- 첨부파일: `DATA_DIR/uploads/`
- 백업: `npm run backup`
- 새 경로 복원: `npm run restore -- <백업경로> <새_DATA_DIR>`
- 기존 `DATA_DIR`을 덮어쓰는 복원은 지원하지 않습니다.

백업·복원 전에는 서버를 중지하고 DB 무결성과 첨부 해시를 함께 확인하세요.

## 프로젝트 구조

```text
server/      Node.js 업무 로직·인증·DB·파일 처리
src/         React 화면과 상태 관리
shared/      프런트·서버 공통 규칙
tests/       서버·E2E 테스트
scripts/     실행·시드·백업·복원 도구
public/      정적 자산
```

## 보안 원칙

- 실제 기관 문서, 개인정보, 비밀키, 인증값을 저장소에 커밋하지 않습니다.
- `.env`, `.env.*`, DB, uploads, 백업, 테스트 산출물은 Git에서 제외합니다.
- 시연 계정과 합성 물품만 기본 화면에 표시합니다.
- 기관 권한, 작성자와 검토자 분리, 수량·증빙 검증은 서버에서도 확인합니다.

## 제한 사항

- 공식 기관 인증·SSO와 공식 행정시스템 연동은 포함하지 않습니다.
- 운송 금액은 시연용 예시 단가이며 실제 업체 견적·배차가 아닙니다.
- OZD 지원 범위는 비밀번호 없는 OZP3.0.0.1/SDM2040 소요조회 표입니다.
- 실제 기관자료를 입력하거나 외부로 전송하기 전에는 해당 기관의 승인과 보안 검토가 필요합니다.
