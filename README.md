# Farm-to-Table 역경매 매칭 플랫폼

셰프가 원하는 식자재 조건을 "딜"로 등록하면, 농가가 가격과 조건을 제안하고, 셰프가 그중 하나를 선택해 거래를 확정하는 역경매 방식 플랫폼입니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속하면 됩니다.

> `.env.local` 파일에 Firebase 및 Groq API 키가 설정되어 있어야 합니다.

## 프로젝트 구조

```
.
├── index.html
├── package.json
├── vite.config.js
├── firebase.json
├── firestore.rules
├── public
│   ├── sw.js               # Service Worker (웹 푸시 알림, 오프라인 캐싱)
│   ├── manifest.json       # PWA 매니페스트
│   ├── icon.svg            # 앱 아이콘 (SVG)
│   ├── icon-192.png        # PWA 아이콘 192px
│   ├── icon-512.png        # PWA 아이콘 512px
│   └── generate-icons.html # PNG 아이콘 생성 도구 (브라우저에서 실행)
└── src
    ├── main.jsx            # React 엔트리포인트
    ├── firebase.js         # Firebase 초기화 및 storage 어댑터
    └── App.jsx             # 전체 앱 (단일 파일 컴포넌트)
```

## 핵심 흐름 (역경매 구조)

1. **딜 만들기** — 셰프가 5단계 위저드로 요청서 작성 (레스토랑·품목 → 품질조건 → 수량 → 납품일·가격 → 확인)
2. **딜 찾기** — 농가가 모집중인 딜 목록을 보고 가격·조건을 담아 제안서 제출
3. **내 거래** — 셰프가 들어온 제안들을 가격순으로 비교하고 하나를 선택 → 진행중 상태로 전환
4. 진행중 상태에서 정산 내역(선급금 30% / 잔금 70% / 플랫폼 수수료 10%, 모두 예시값)을 확인합니다. 선급금 결제 → 농가 발송 완료 신고(사진·메모) → 셰프 수령 확인 → 잔금 결제 순으로 납품·정산 타임라인이 완성됩니다.

## 백엔드 (Firebase)

- **딜** 데이터는 Firestore `deals/{dealId}` 컬렉션에 딜마다 개별 문서로 저장됩니다.
- **채팅**은 Firestore `chats/{dealId}` 컬렉션에 딜마다 개별 문서로 저장됩니다.
- **사용자 프로필**은 `storage/user-profile-{uid}`, **농가 프로필**은 `storage/farm-profile-{uid}`, **셰프 프로필**은 `storage/chef-profile-{uid}` 키에 사용자별로 격리 저장됩니다.
- 인증은 **Firebase Authentication** (이메일/비밀번호) 을 사용합니다.
- 세션 데이터(`current-user`)만 localStorage에 저장되며, 로그인 상태는 Firebase Auth가 자동 유지합니다.
- `onSnapshot` 실시간 동기화로 딜 목록과 채팅이 즉시 반영됩니다.
- AI 자동 입력은 **Groq API (Llama 3.3 70B)** 를 사용하며, 실패 시 규칙 기반 한국어 파서로 폴백합니다.
- **웹 푸시 알림**은 Web Notification API + Service Worker로 구현됩니다 (Firebase Functions 불필요).

### Firestore 보안 규칙

```
# storage 컬렉션 (프로필 등): value 필드 문자열 구조만 허용, user-profile은 본인만 쓰기
allow read: if true;
allow write: if request.auth != null
             && request.resource.data.keys().hasAll(['value'])
             && request.resource.data.value is string
             && request.resource.data.value.size() < 1048576
             && (!key.matches('user-profile-.*') ||
                 key == 'user-profile-' + request.auth.uid);

# chats 컬렉션: 인증된 유저만 읽기/쓰기
allow read, write: if request.auth != null;

# deals 컬렉션: 읽기 전체 허용
allow read: if true;
# 생성: createdBy 필드가 반드시 본인 uid
allow create: if request.auth != null
              && request.resource.data.createdBy == request.auth.uid;
# 수정: 인증된 유저 (셰프 딜 수정 + 농가 제안 추가 모두 허용)
allow update: if request.auth != null;
# 삭제: 딜 생성자(셰프)만 가능
allow delete: if request.auth != null
              && resource.data.createdBy == request.auth.uid;
```

## 주요 기능

### 셰프
| 기능 | 설명 |
|---|---|
| 딜 만들기 | 5단계 위저드 + AI 자동 입력 |
| 딜 수정 / 삭제 | 모집중 딜에 한해 수정·삭제 가능 |
| 딜 복제 | 완료·마감 딜을 복사해 새 딜 빠르게 생성 |
| 딜 직접 마감 | 모집 조기 종료 |
| 내 거래 필터 | 상태별(모집중·진행중·완료·마감) 필터 |
| AI 매칭 점수 | 제안별 100점 채점 + 매칭 점수순 정렬 + AI 한 줄 분석 |
| 농가 평점/리뷰 | 거래 완료 후 별점 + 후기 등록 |
| 정산 트래커 | 계약 확정→계약서 서명→선급금(30%)→납품 완료→잔금(70%) 5단계 진행 표시 |
| 납품 추적 | 납품 준비→발송 완료→수령 확인 3단계 DeliveryTracker, 수령 확인 시 정산 완료 처리 |
| 택배 추적 | 발송 신고 시 택배사(5사) 선택 + 운송장 번호 입력, "배송 조회 →" 링크 자동 생성 |
| 토스페이먼츠 결제 | 선급금·잔금 토스페이먼츠 카드 결제 (테스트 모드), 결제 완료 후 자동 상태 반영 |
| 결제 영수증 출력 | SettlementCard에서 선급금 결제 완료 후 🖨 영수증 버튼 표시, 인쇄/PDF 저장 |
| 제안 비교 모드 | 제안 카드에 "+ 비교" 버튼 → "✓ 비교중" 상태 전환 + "비교 초기화" |
| 단골 농가 즐겨찾기 | 매칭 후 농가 카드에 ☆/★ 즐겨찾기 버튼, 내 레스토랑 탭에 즐겨찾기 농가 목록 |
| 정기 딜 자동 연장 | 완료 딜에서 "↻ 다음 회차 딜 만들기" 버튼으로 딜 빠른 복제 생성 |
| 작물 가격 참고 | 딜 만들기 Step 4에서 해당 품목 최근 평균 거래가 참고 배너 표시 |
| 농가 문의 답변 | 내 거래에서 농가 문의 N건 미답변 표시 + 텍스트 입력 후 "답변 등록" |
| 정산 이력 | 대시보드에서 매칭·완료 딜의 거래처·금액·단계·확정일 일람 |
| 알림 뱃지 | 새 제안 도착 및 미확인 채팅 시 "내 거래" 탭에 숫자 뱃지 |
| 내 레스토랑 | 레스토랑 정보·선호 품목·납품 주기 등록 |

### 농가
| 기능 | 설명 |
|---|---|
| 딜 찾기 | 품목·등급·지역·납품일·수량·단가 범위·납품 주기 필터 |
| 스마트 정렬 | 내 전문 품목 딜을 상단 노출 + "내 전문 품목" 뱃지 |
| D-day 마감 배지 | 딜 찾기 목록에서 납품 마감 D-day 카운트다운 배지 표시 |
| 관심 딜 북마크 | 딜 카드 🔖 버튼으로 저장 → "저장한 딜" 탭에서 모아보기, localStorage 영구 유지 |
| 딜 전 문의 | 딜 상세에서 💬 버튼으로 셰프에게 문의 전송, 셰프 답변 확인 가능 |
| 제안 자동 채우기 | 이전 제안의 단가·수량·인증이 새 제안 폼에 미리 채워짐 (pre-fill 배너 표시) |
| 제안 보내기 | 가격·수량·납품일·인증 입력 후 제안 제출 (중복 제출 방지) |
| 제안 취소 | 모집중 딜에 한해 제안 취소 |
| 발송 완료 신고 | 선급금 입금 확인 후 발송 완료 신고 (사진·메모 첨부 가능) |
| 농가 성과 배지 | 내 농가 프로필에서 친환경 인증 등 선택 시 성과 배지 즉시 표시 |
| 정산 이력 | 대시보드에서 선택된 제안의 거래처·금액·단계 일람 |
| 알림 뱃지 | 내 제안 선택 및 미확인 채팅 시 "내 제안" 탭에 숫자 뱃지 |
| 내 농가 | 농가 정보·전문 품목·리드타임 등록 + 누적 평균 평점 표시 |

### 공통
| 기능 | 설명 |
|---|---|
| 실시간 채팅 | 매칭 후 셰프↔농가 채팅 + 미확인 메시지 뱃지 + 전송 실패 롤백 |
| 앱 내 알림 히스토리 | 🔔 벨 아이콘 + 미읽음 뱃지 + 드롭다운 패널 + 탭 바로가기 클릭 |
| 웹 푸시 알림 | 제안·채팅·서명 완료·선급금 지급·발송 완료·수령 확인·정산 완료·딜 마감 D-3·잔금 기한 D-1/D-day/초과 (총 14종, Service Worker) |
| 계약서 서명 | 표준 농산물 거래 계약서 자동 생성 + 갑(셰프)·을(농가) 양측 서명 UI + 인쇄/PDF 저장 |
| PWA 설치 | manifest.json + 오프라인 캐싱으로 홈화면에 앱 설치 가능 |
| 납품일 자동 마감 | 납품일이 지난 모집중 딜 자동 마감 처리 + "납품일 만료" 뱃지 |
| 관리자 화면 | KPI 현황·딜 관리·수수료 정산 대시보드·유저 목록·채팅 로그 (ADMIN_EMAIL 접근제어) |
| 회원가입 / 로그인 | Firebase Auth 이메일/비밀번호 인증, 역할(셰프·농가) 선택 + 첫 로그인 온보딩 |

## 거래 가능 품목 (20종)

| 카테고리 | 품목 |
|---|---|
| 과일 | 토마토, 딸기, 블루베리, 복숭아, 무화과 |
| 엽채류 | 로메인, 케일, 루꼴라, 시금치, 깻잎 |
| 뿌리채소 | 비트 |
| 과채류 | 파프리카, 가지, 애호박 |
| 허브 | 바질, 고수, 민트, 파슬리, 로즈마리 |
| 버섯 | 표고버섯 |

각 품목별 숙성도/수확 단계가 정의되어 있습니다 (예: 토마토 6단계, 블루베리 4단계 등).

## 디자인 토큰

`App.jsx` 상단 `TOKENS` 객체에 색상이 정의되어 있습니다.

- 배경: `#F3F1E7` (리넨)
- 잉크(텍스트): `#20281F`
- 러스트(셰프/긴급): `#BB4A2E`
- 모스(농가/완료): `#5B7553`
- 골드(등급/가격): `#C99A3E`

폰트: Fraunces(제목), IBM Plex Sans(본문), IBM Plex Mono(데이터/라벨) — Google Fonts

## 개발 이력

| 버전 | 주요 내용 |
|---|---|
| v0.1 | 사업계획서 분석 → 시스템 아키텍처, 12개월 로드맵 |
| v0.2 | 셰프 수요입력 + 농가 매칭 데모 (규칙기반 점수 매칭) |
| v0.3 | 농가 등록 화면 추가, 탭 통합, 영구 저장 구현 |
| v0.4 | 숙성도/수확단계, 표준규격 등급 추가 |
| v0.5 | 역경매 구조로 전면 개편 (딜 만들기→농가 제안→셰프 선택) |
| v0.6 | 5단계 위저드, 진행 타임라인, 정산 내역 카드, Vite 패키징 |
| v0.7 | 딜 수정/삭제, 내 거래 필터, 딜 직접 마감, 제안 취소, UX 통일 |
| v0.8 | 농가 평점/리뷰 시스템 |
| v0.9 | Firebase Firestore 백엔드 연동, 보안 규칙 설정 |
| v1.0 | 품목 8종→20종 확대, 딜 복제, 스마트 정렬, 자동 마감, 알림 뱃지, 상세 필터, 셰프 프로필 |
| v1.1 | 딜 찾기 지역 필터, 샘플 딜 16건 지역 정보 추가, Firebase Auth 교체 (이메일/비밀번호 인증) |
| v1.2 | AI 기반 매칭 점수화 (가격·납품일·수량·인증·평점 100점), 채팅 알림 뱃지, 회원가입 오류 수정, 내 거래 필터 uid 기반 수정 |
| v1.3 | UI 고급화 (카드 hover elevation·액센트 보더·StatusBadge dot), 웹 푸시 알림 (Service Worker, 3가지 시나리오), 딜 데이터 격리 (deals 컬렉션 분리·샘플 자동 시딩 제거·Firestore 보안 규칙 강화) |
| v1.4 | PWA 앱화 (manifest.json·오프라인 캐싱·홈화면 설치 버튼), Firestore 보안 규칙 세분화 (user-profile 본인 제한·딜 생성자 삭제 권한), 계약서 자동 생성 (표준 농산물 거래 계약서·인쇄/PDF 저장) |
| v1.5 | 버그 수정 3건 (딜 복제 시 원본 덮어쓰기·프로필 공유 키 충돌·채팅 경쟁 조건), 데이터 격리 완성 (farm/chef-profile uid 기반 분리·chats 컬렉션 분리) |
| v1.6 | UX 개선 11건 (빈 상태 CTA·정산 완료 2단계 확인·납품일 과거 선택 방지·오류 화면 재시도 버튼 등), 전체 화면 UI 폴리싱 (로그인·위저드·채팅·프로필), 비로그인 chats permission-denied 버그 수정, Firestore 규칙 배포 자동화 |
| v1.7 | 프로필·딜 이미지 업로드 기능 추가 (Canvas 클라이언트 압축 → Firestore base64 저장, 무료 플랜 지원) |
| v1.8 | 딜 상세 페이지 추가 (카드 클릭 → 풀스크린 정보 그리드·사진 배너), 농가 프로필 카드 표시 (제안 폼 상단에 사진·이름·인증·전문품목 카드) |
| v1.9 | 농가 프로필 상세 카드 + 셰프 입장 제안 상세 페이지 (FarmProfileDetailCard·ProposalDetailView, 제안 카드 클릭 → AI 점수 breakdown·농가 정보 풀스크린) |
| v2.0 | 딜 찾기 "내 전문품목만" 빠른 필터 토글, 딜 상세 페이지 내 셰프 프로필 카드 (ChefProfileMiniCard, Firestore 자동 fetch) |
| v2.1 | 거래 대시보드 탭 추가 (셰프: 등록 딜·성사율·누적 거래액·딜 상태 분포·품목 차트 / 농가: 제안 수·선택률·누적 거래액·평균 평점·품목 차트) |
| v2.2 | 내 제안 상세 페이지 (MyProposalDetailView, 농가 입장 딜+제안+AI점수 풀스크린), 앱 내 알림 히스토리 (🔔 벨 아이콘·미읽음 뱃지·드롭다운·localStorage 영구 저장) |
| v2.3 | 채팅 이미지 첨부 (📷 버튼·Canvas 600px 압축·미리보기·텍스트+이미지 혼합 전송), 온보딩 화면 (첫 로그인 역할별 4단계 가이드·건너뛰기·localStorage), 프로필 화면 재확인 버튼, 이미지 알림 텍스트 개선 |
| v2.4 | 농가 평점 이력 조회 (FarmProfileDetailCard에 allDeals 기반 전체 거래 평점 목록·평균·품목·날짜 표시), 딜 마감 자동화 (납품일 지난 open 딜 → closed 일괄 처리·Firestore batch) |
| v2.5 | 검색 기능 강화 — 납품 주기 필터 (단발성·주1회·주2회·격주), 검색어 히스토리 (최근 5건·클릭 재검색·지우기), 활성 필터 요약 칩 (× 개별 해제) |
| v2.6 | 딜 복제 개선 (과거 납품일 자동 초기화, 미래 날짜는 유지), 대시보드 기간 필터 (이번 주·이번 달·전체 토글, KPI·품목 차트 실시간 재계산) |
| v2.7 | 농가 프로필 팝업 모달 (제안 카드 👤 버튼 → FarmProfileModal 오버레이, 사진·인증·전문품목·평점 이력·메시지 표시) |
| v2.8 | 결제/정산 UI 개선 — SettlementCard 5단계 트래커 (계약 확정→계약서 서명→선급금→납품 완료→잔금), 선급금 지급 확인 버튼, 대시보드 정산 이력 테이블 |
| v2.9 | 계약서 서명 UI (양측 서명란·완료 배지) + 푸시 알림 6종 신규 (서명·선급금·정산 완료) + 딜 마감 D-3 임박 알림 + 알림 패널 탭 바로가기 |
| v2.10 | 관리자 화면 (ADMIN_EMAIL 접근제어, 현황 KPI 6종, 딜 관리 CRUD, 최근 등록/완료 딜 목록) |
| v2.11 | UX 8항목 수정 (메시지 롤백·저장 상태 피드백·빈 상태 CTA·터치 영역·중복 제출 방지 등) + 관리자 유저 목록·채팅 로그 섹션 추가 |
| v2.12 | 토스페이먼츠 테스트 결제 연동 — 선급금(30%)·잔금(70%) 실결제 UI, 결제 리다이렉트 자동 처리, balancePaidAt 필드 신규 |
| v2.13 | 납품 확인·물류 추적 기능 — DeliveryTracker 3단계 (납품 준비→발송 완료→수령 확인), 농가 발송 신고(사진·메모), 셰프 수령 확인 버튼, 알림 2종 신규 |
| v2.14 | 운송장 번호·택배 추적 — ShipModal에 택배사 선택(5사+직접배달)·운송장 번호 입력 추가, DeliveryTracker에 배송 조회 링크 표시 |
| v2.15 | 관리자 수수료 정산 대시보드 — 누적/이번달 수수료 KPI, 월별 바차트, 완료 딜 수수료 내역 테이블, 진행중 딜 미수금 현황 |
| v2.16 | 잔금 결제 기한 설정 + 자동 알림 — 수령 확인 시 7일 기한 자동 설정, SettlementCard D-day 카운트다운, D-1·D-day·기한 초과 3종 알림 |
| v2.13~v2.16 E2E 테스트 | Playwright E2E 테스트 24종 전체 통과 — 딜 생성(5단계 위저드)→제안 제출·선택→DeliveryTracker→SettlementCard→농가 배지 전체 플로우 자동 검증 |
| v2.17 | 딜 전 문의 — 농가가 제안 전 💬 버튼으로 셰프에게 문의 전송, 셰프 내 거래에 "농가 문의 N건 미답변" 표시 + 답변 등록 |
| v2.18 | 결제 영수증 출력 — SettlementCard에 🖨 선급금 영수증 버튼 (결제 완료 후에만 표시), 클릭 시 인쇄/PDF 저장 |
| v2.19 | 농가 성과 배지 — 내 농가 프로필에서 친환경 인증 등 선택 시 성과 배지 즉시 표시 + Firestore 영구 저장 |
| UX 개선 #1~#6 | 제안 비교 모드 (+ 비교/✓ 비교중/초기화), D-day 마감 배지, 제안 자동 채우기 (이전 단가·수량·인증 pre-fill), 단골 농가 즐겨찾기 (☆/★·내 레스토랑 목록), 정기 딜 자동 연장 (done 전용 ↻ 버튼), 작물 가격 참고 (Step 4 평균 거래가) |
| v2.17~v2.19 E2E 테스트 | Playwright E2E 테스트 26종 전체 통과 — 딜 전 문의·결제 영수증·농가 성과 배지·UX 개선 6종 자동 검증 |
| v2.20 | 관심 딜 북마크 (농가) — 딜 카드 🔖 버튼으로 나중에 제안할 딜 저장, "저장한 딜" 탭 토글·건수 뱃지, localStorage `farm-bookmarks-{uid}` 영구 저장, Playwright E2E 16/16 통과 |
| v2.21 | 전체 화면 SVG 일러스트 UI 장식 — 로그인 화면 다채로운 농장 장면 일러스트 교체, 딜 만들기·딜 찾기·내 제안·내 거래·내 농가·내 레스토랑·대시보드 7개 화면 좌우 사이드 SVG 패널 추가 (인라인 SVG, 데스크톱 전용, `!isMobile` 조건부 렌더링) |
| v2.22 | UX #5 자동 연장 흐름 + 품목 구독 알림 — `handleNextCycleDeal` 이력 필드 제외 명시적 pick·`_isNextCycle` 플래그·납품일 자동 계산, 위저드 배너 분기("다음 회차 딜" vs "복제 중"), 농가 프로필 관심 품목 새 딜 알림 토글, Firestore 실시간 구독으로 품목 일치 신규 딜 알림·localStorage dedup, `onAuthStateChanged` 신규 가입 race condition 수정 (900ms 재시도), Playwright E2E 14/14 통과 |
| UX #2/#3/#4 | 상호 리뷰(`handleRateChef`, `chefRating`/`chefRatedAt`), 제안 단계 채팅(`chatId = dealId__proposalId`), 역제안(`CounterOfferModal`, `handleSendCounterOffer`/`handleRespondCounterOffer`) |
| UX #2/#3/#4/#6 E2E | `test_v2_ux2346.cjs` — 23/23 통과 (정적 심볼 검증 14종 + 브라우저 UI 9종) |
| v2.25 | UX #6 제철 식재료 추천 — `SEASONAL_CROPS` 12개월별 정의, `SeasonalBanner` 월별 배너+칩 클릭 필터, 딜 만들기 Step 1 제철 힌트 표시 |
| v2.26 | 농가 이력 공개 — `FarmProfileDetailCard` 통계 칩(제안수·선택률·완료건), 최근 선택 거래 이력 테이블(최대 5건), `FarmProfileScreen` 실시간 미리보기, `computeFarmBadges` 성과 배지 |
| v2.27 | 인증 뱃지 사진첨부 — `PhotoLightbox` 전체화면 뷰어, `certPhotoURL`(인증서 ✓ 표시·클릭 확대), `cropPhotoURL`(작물 사진 72px 썸네일·클릭 확대), `FarmProfileScreen`/`ProposalForm` 업로드 UI |
| Bug fix | `FarmProfileDetailCard` `React.useState` → `useState` named import 수정 (앱 크래시 수정) |
| v2.26/27 E2E | `test_v2_26_27.cjs` — 18/18 통과 (정적 5+8종 + 브라우저 UI 3+2종) |
| v2.28 | `alert()` → 인앱 Toast 컴포넌트 교체 (결제 실패·결제 모듈 미로드·채팅 전송 실패 3곳), 푸시 알림 아이콘 `/vite.svg` → `icon-192.png` 교체 |
| v2.29 | 관심 딜 북마크 Firestore 동기화 (`farm-bookmarks-{uid}`, 기기 간 공유), 이미지 업로드 Firebase Storage 연동 (`fbStorage`, `storagePath` prop, base64 폴백) |
| v2.28/29 E2E | `test_v2_28_29.cjs` — 20/20 통과 (Toast·아이콘·북마크 Firestore·Firebase Storage 검증) |
| v2.30 | 거래명세서 강화 — 버튼 레이블 "선급금/잔금 거래명세서", 거래번호·공급가액·부가세(10%) 분리 출력, 납품일·공급자/공급받는자·홈택스 안내 포함, 인라인 세금계산서 안내 패널 |
| v2.30 E2E | `test_v2_30.cjs` — 14/14 통과 (버튼 레이블·명세서 항목·세금계산서 패널·브라우저 UI 검증) |
| v2.31 | XSS 방어 — `printReceipt()` 사용자 입력값 `esc()` HTML escape 처리, `window.open` `noopener,noreferrer` 추가 (발송 사진·채팅 이미지 2곳) |
| v2.31 E2E | `test_v2_31.cjs` — 10/10 통과 (esc 함수·6개 변수 escape·템플릿 직접 삽입 없음·noopener 검증) |
| v2.32 | 알림 dedup 키 누적 방지 — `notified-deal-{id}` 개별 키 → `notified-deals-v1` 롤링 셋(cap 300) 교체, 결제 pending Firestore 병행 저장 (`pending-toss-{uid}`) — 브라우저 크래시 후 복구 |
| v2.32 E2E | `test_v2_32.cjs` — 11/11 통과 (dedup 셋·cap 300·Firestore 백업·폴백 조회·클리어 검증) |
| v2.33 | setTimeout 매직 넘버 제거 — `printReceipt` `setTimeout(600)` → `win.onload`, auth 재시도 `setTimeout(900)` → 최대 5회 300ms 간격 루프, 알림 내역 Firestore 연동 (`notif-history-{uid}`) — 기기 간 알림 공유 |
| v2.33 E2E | `test_v2_33.cjs` — 10/10 통과 (onload 교체·재시도 루프·Firestore 저장·로드·동기화·클리어 검증) |
| v2.34 | `ScoreBreakdown` 컴포넌트 추출 — `SCORE_BREAKDOWN_LABELS.map` 3중 복붙 → 단일 컴포넌트(`size="compact"` prop), `fav-farms-{uid}`(셰프 즐겨찾기 농가)·`farm-bookmarks-{uid}`(농가 딜 북마크) 키 혼용 주석 명확화 |
| v2.34 E2E | `test_v2_34.cjs` — 10/10 통과 (컴포넌트 추출·map 1곳·사용 3곳·키 주석·셰프/농가 탭 진입 검증) |
| v2.35 | SEC-01 민감 키 env 이전 (`VITE_ADMIN_EMAIL`, `VITE_TOSS_CLIENT_KEY`), SEC-02 isAdmin 서버 검증 주석, UX-01 `DealDetailView`에 `userId` prop 전파, UX-02 `ShipModal` `finally { setLoading(false) }`, QUAL-01 `DealCreateScreen` Hooks 순서 수정 |
| v2.35 E2E | `test_v2_35.cjs` — 10/10 통과 (env 이전·SEC-02 주석·userId prop·ShipModal finally·Hooks 순서·브라우저 UI 검증) |
| v2.36 | DATA-01 `notifHistory` uid별 키 분리 (`notif-history-{uid}`), DATA-02 검색 히스토리 uid별 키 분리 (`deal-search-history-{uid}`), STAB-01 `window.open` null 가드 (팝업 차단 alert), QUAL-02 `ProposalDetailView` useEffect deps `[score, deal?.id, proposal?.id]`, QUAL-03 `AdminScreen` 내 `fmtDate` 이중 정의 → `fmtShortDate` 통일 |
| v2.36 E2E | `test_v2_36.cjs` — 10/10 통과 (DATA-01/02 uid 분리·STAB-01 null 가드·QUAL-02 deps·QUAL-03 fmtShortDate·브라우저 UI 검증) |
| v2.37 | DATA-03 `favFarms` Firestore 동기화 (`fav-farms-{uid}`), STAB-02 `cleanBalanceDueKeys` — 딜 완료·삭제·종료 시 `balance-due-notified-{dealId}-*` 키 자동 정리, PERF-01 `SAMPLE_DEALS` `import.meta.env.DEV` 조건 분기 (프로덕션 번들 제외), QUAL-04 `SECTION_LABEL_STYLE`·`sectionCardStyle` 공통 상수 추출 |
| v2.37 E2E | `test_v2_37.cjs` — 10/10 통과 (DATA-03 Firestore·STAB-02 키 정리·PERF-01 DEV 분기·QUAL-04 공통 상수·브라우저 UI 검증) |
| v2.38 | SEC-03 방문·선택·채팅읽음 uid 키 분리, SEC-04 `createdBy` 폴백 제거, SEC-05 만료 딜 소유권 필터, DATA-04 `notifiedDealsKey(uid)`, STAB-03 auth cancelled 플래그, STAB-04 채팅 rollback 실패 메시지만 제거, QUAL-05 `rating: null` + null 가드, QUAL-06 `dealsRef` stale closure 수정, PERF-02 `cropPriceRef` useMemo, PERF-03 Google Fonts 중복 → index.html 단일화, A11Y-01 알림 항목 `<button>`, A11Y-02 Toast `role="alert"` |
| v2.38 E2E | `test_v2_38.cjs` — 14/14 통과 (13개 정적 코드 검증 + 브라우저 UI 검증) |
| v2.39 | SEC-02 샘플 초기화 isAdmin 게이팅, SEC-01 `pendingTossKey(uid)` 결제 대기 키 uid 스코프, SEC-03 `balance-due-notified` uid 포함·`cleanBalanceDueKeys` 범용 필터, SEC-04 `orderId` 타임스탬프 suffix + `lastIndexOf` 파싱, DATA-01 `arrayUnion` + merge:true 채팅 전송, DATA-02 `setChats` 함수형 업데이터, STAB-01 `ErrorBoundary` 클래스 컴포넌트, STAB-02 `ProposalForm` `finally { setSubmitting(false) }`, STAB-03 `ImageUpload` `mountedRef` 언마운트 안전, DATA-03+PERF-01 데이터 로드 `[authChecked, user?.uid]` dep + chefDealIds 채팅 필터, UX-01 `DealCreateScreen` submitting 더블클릭 방지, A11Y-01 `ImageUpload` `role="button"` + `onKeyDown` |
| v2.39 E2E | `test_v2_39.cjs` — 16/16 통과 (15개 정적 코드 검증 + 브라우저 UI 검증) |

### v1.6 상세 내역

**UX 개선**
- 뒤로 가기 시 입력 오류 메시지 자동 초기화
- 납품일 입력 시 오늘 이전 날짜 선택 방지 (`min` 속성)
- 딜 카드 펼침/접힘 ▼/▲ 인디케이터
- 내 거래 빈 상태 → "첫 딜 만들기" CTA 버튼 (탭 이동)
- 상태 필터 빈 결과 → "전체 보기" 버튼
- 딜 찾기 필터 빈 결과 → "필터 초기화" 버튼
- 정산 완료 2단계 확인 (실수 방지)
- 오류 화면 "다시 시도" 버튼 (`window.location.reload`)
- 모바일 저장 실패 시 피드백 메시지 개선
- 리드타임 필드 설명 문구 추가

**UI 폴리싱**
- 상단 고정 Rust→Gold→Moss 3색 그라데이션 액센트 바
- 로그인 화면: 배경 라디얼 그라데이션, 흰색 카드+그림자, 데스크톱 브랜드 패널
- 딜 만들기 위저드: StepIndicator 컬러 프로그레스 (완료=녹색 ✓ / 현재=붉은색 glow)
- 채팅: 말풍선 shadow·라운드 개선, 빈 상태 아이콘, 전송 버튼 hover 효과
- 내 레스토랑·내 농가: 아이콘+그라데이션 헤더 패널, 저장 버튼 shadow 개선
- 섹션 타이틀 좌측 Rust accent bar 추가 (전 화면 공통)
- 전역 CSS: input focus ring, select 커스텀 화살표, 커스텀 스크롤바, 버튼 hover 효과

**버그 수정**
- 비로그인 상태에서 `chats` 컬렉션 읽기 시도 → permission-denied 오류 수정 (`user?.uid` 조건 추가)
- `React.Fragment` 미임포트로 인한 런타임 오류 수정 (`Fragment` named import 추가)
- Firestore 보안 규칙 Firebase 미배포 문제 수정 (규칙 배포 완료)

### v1.7 상세 내역

**이미지 업로드 기능**
- `ImageUpload` 공용 컴포넌트 추가 — 파일 선택·드래그 없이 클릭 한 번으로 업로드
- Canvas API로 클라이언트 사이드 압축 (최대 900px, JPEG quality 0.82) → 압축 후 약 150~200KB
- 압축된 이미지를 base64 data URL로 변환 → 기존 Firestore 컬렉션에 인라인 저장 (Firebase Storage 불필요, 무료 플랜 유지)
- Firestore 문서 1MB 한도 내 안전하게 수용

**적용 화면**
- 셰프 프로필 (`내 레스토랑`): 원형 업로드 위젯 (76px), 레스토랑 로고·대표사진 등록 → 농가에게 표시
- 농가 프로필 (`내 농가`): 원형 업로드 위젯 (76px), 농가 대표사진 등록 → 셰프에게 표시
- 딜 만들기 스텝 4: 정사각 업로드 위젯 (100px) + 선택 사진 삭제 버튼
- 딜 만들기 스텝 5 (확인): 딜 사진 140px 배너 미리보기
- 딜 찾기·내 거래 카드: 사진이 있는 딜은 우측 상단에 64px 썸네일 표시

**기술 세부**
- `canvas.toDataURL("image/jpeg", 0.82)` → base64 문자열 → Firestore `deals/{dealId}.photoURL` 또는 `storage/chef-profile-{uid}`, `storage/farm-profile-{uid}` 에 저장
- 딜 ID 사전 생성 (`useState(() => \`d${Date.now()}\`)`) — 생성·수정 시 동일 ID 보장
- 편집 중 UI: 압축 중 "압축 중…" 오버레이, hover 시 "변경 ✎" 오버레이
- Playwright E2E 테스트 7개 전부 통과 (회원가입→프로필 사진 업로드→딜 사진 업로드 전 과정 검증)

### v1.8 상세 내역

**딜 상세 페이지 (`DealDetailView`)**
- `DealDetailView` 컴포넌트 신규 추가 — 딜 카드 클릭 시 풀스크린 상세 페이지로 전환
- 상단 "← 딜 목록으로" 뒤로가기 버튼으로 목록 복귀
- 사진 배너: 모바일 180px / 데스크톱 240px, 사진 없으면 테마 색 배경 플레이스홀더
- 6-필드 정보 그리드: 희망 단가·수량·납품 희망일·등급·숙성도·납품 주기
- 사이즈 조건·메모·제안 수 표시
- 제안 섹션: 이미 제안한 경우 "✓ 제안 완료" 뱃지, 아니면 "이 딜에 제안 보내기" 버튼 → `ProposalForm` 인라인 표시

**농가 프로필 카드 (`FarmProfileMiniCard`)**
- `FarmProfileMiniCard` 컴포넌트 신규 추가 — 제안 폼 상단에 농가 정보 카드 표시
- 44px 원형 농가 사진 (없으면 🌱 이모지 폴백), 농가명, 지역, 인증 뱃지, 전문품목 칩(최대 3개), "✓ 내 농가" 뱃지
- 배경: `TOKENS.mossSoft`, 테두리: `${TOKENS.moss}33`

**딜 목록 (`DealBrowseScreen`) 변경**
- 딜 카드에 `onClick={() => setDetailDeal(deal)}` 추가 (cursor: pointer)
- `openFormId` 상태 → `detailDeal` 상태로 교체 (상세 페이지 제어)
- `useEffect`로 Firestore 실시간 업데이트 시 `detailDeal` 자동 동기화
- 제안 제출 완료 시 자동으로 목록 복귀 (`setDetailDeal(null)`)
- 목록 카드에서 인라인 `ProposalForm` 제거 → 상세 페이지에서만 제안 가능

**테스트**
- Playwright E2E 15개 전부 통과 (가입→프로필 저장→딜 카드 클릭→상세 페이지 확인→농가 프로필 카드 확인→제안 제출→목록 자동 복귀→뒤로가기 전 과정 검증)

### v1.9 상세 내역

**농가 프로필 상세 카드 (`FarmProfileDetailCard`)**
- 제안 카드 클릭 시 표시되는 대형 농가 정보 카드 (72px 원형 사진, 농가명·지역·인증·전문품목 전체, 평점/리뷰)
- 사진 없으면 🌱 이모지 폴백, 평점이 있는 농가는 하단에 별점·리뷰 표시

**셰프 입장 제안 상세 페이지 (`ProposalDetailView`)**
- 내 거래 탭에서 제안 카드 클릭 → 풀스크린 상세 전환
- `FarmProfileDetailCard` + 제안 4-칸 그리드(단가·수량·납품일·인증) + 희망가 대비 차이 표시
- AI 매칭 점수 항목별 바 차트 + AI 코멘트 자동 로드
- "이 농가 선택하기" 버튼 (모집중 딜만 표시, 클릭 시 바로 목록 복귀)

**데이터 확장**
- 제안 제출 시 `photoURL`·`specialty` 포함 → 사진 있는 농가는 상세 카드에 프로필 사진 표시

### v2.0 상세 내역

**딜 찾기 전문품목 빠른 필터**
- 농가 프로필에 전문품목 설정 시 검색창 아래 `🌱 내 전문품목만` 토글 버튼 표시
- 활성화 시 해당 품목 딜만 필터링, 전문품목 칩도 함께 표시
- 필터 초기화 시 자동 해제

**셰프 프로필 카드 (`ChefProfileMiniCard`)**
- 딜 상세 페이지(딜 정보 카드 아래)에 셰프 카드 자동 표시
- `deal.createdBy`(셰프 uid)로 Firestore `storage/chef-profile-{uid}` 자동 fetch
- 52px 원형 사진(🍳 폴백), 레스토랑명·지역, 소개글(2줄 말줄임), 선호품목 칩(최대 5개)

### v2.1 상세 내역

**거래 대시보드 (`DashboardScreen`)**
- 셰프·농가 모두 탭바에 "대시보드" 탭 추가

**셰프 대시보드**
- KPI 4개 타일: 등록 딜 수 / 성사 딜 수 / 성사율(%) / 누적 거래액
- 딜 상태 분포 바 (모집중·진행중·완료·마감 색상 비율 + 범례)
- 요청 품목 분포 가로 바 차트 (상위 6개)
- 최근 등록 딜 5건 타임라인 → 클릭 시 "내 거래" 탭 이동

**농가 대시보드**
- KPI 4개 타일: 보낸 제안 수 / 선택률(%) / 누적 거래액 / 평균 평점
- 제안 품목 분포 가로 바 차트 (상위 6개)
- 최근 보낸 제안 5건 (선택됨·검토중·미선택 상태 표시) → 클릭 시 "내 제안" 탭 이동

**공용 컴포넌트**
- `StatTile`: KPI 타일 (라벨·값·부제목·커스텀 색상/배경)
- `MiniBarChart`: 레이블별 가로 바 차트

### v2.2 상세 내역

**내 제안 상세 페이지 (`MyProposalDetailView`)**
- 내 제안 탭에서 제안 카드 클릭 → 풀스크린 상세 전환 (← 내 제안 목록으로)
- 딜 사진 배너, 딜 정보 6-칸 그리드(셰프 희망가·수량·납품일·등급·숙성도·납품주기), 규격조건·메모
- 내 제안 내용 카드 (제안가·수량·납품일·인증 + 희망가 대비 차이), 보낸 메시지
- AI 매칭 점수 항목별 바 차트 (항상 펼쳐서 표시)
- 상태별 액션: 검토 중 → 제안 취소 / 선택됨 → 채팅·계약서 버튼
- 실시간 동기화: Firestore 변경 시 `detailItem` 자동 갱신

**앱 내 알림 히스토리**
- 헤더 🔔 벨 아이콘 + 미읽음 수 빨간 뱃지 (최대 9+)
- 클릭 → 드롭다운 패널 (최대 50건, 날짜·시간 표시)
- 열면 전체 읽음 처리, 미읽음 항목은 노란 배경으로 구분
- 바깥 클릭 시 자동 닫힘
- "모두 지우기" 버튼
- localStorage 영구 저장 (새로고침·재접속 후에도 유지)
- 기존 웹 푸시 알림 3종 (새 제안·선택됨·채팅 메시지)과 자동 연동

### v2.3 상세 내역

**채팅 이미지 첨부**
- 입력창 좌측 📷 버튼 → 파일 선택, Canvas로 600px·JPEG 0.75 압축
- 전송 전 72px 썸네일 미리보기 + ✕ 취소 버튼
- 텍스트 단독·이미지 단독·텍스트+이미지 혼합 전송 모두 지원
- 수신 이미지 클릭 시 새 탭에서 원본 확인

**온보딩 화면 (`OnboardingModal`)**
- 첫 로그인 시 역할별 4단계 슬라이드 자동 표시 (셰프/농가 각각)
- 슬라이드 인디케이터, "건너뛰기" / "다음" / "시작하기 →" 버튼
- `localStorage` (`onboarding-done-{uid}`) 영구 저장 → 재로그인 시 미표시

**프로필 화면 재확인 버튼**
- 셰프(내 레스토랑) / 농가(내 농가) 프로필 저장 버튼 우측에 "ⓘ 앱 사용법 다시 보기" 추가
- 클릭 시 OnboardingModal 재표시 (완료 기록 유지)

**채팅 이미지 알림 텍스트 개선**
- 이미지 단독 수신 → "📷 사진을 보냈습니다"
- 이미지+텍스트 수신 → "📷 텍스트…"
- 텍스트 단독 → 기존 동작 유지

### v2.4 상세 내역

**농가 평점 이력 조회 (`FarmProfileDetailCard`)**
- `allDeals` prop 추가 → 동일 농가의 모든 딜에서 평점 이력 수집
- 우상단: 평균 평점·별점·건수 요약
- 이력 목록: 별점·점수·품목·날짜, 리뷰 텍스트 표시 (최신순)
- 이력 없으면 "아직 평가 이력이 없습니다" 안내

**딜 마감 자동화**
- 앱 로드(`loadState === "ready"`) 시 납품일 지난 `open` 딜 자동 감지
- `status: "closed"`, `closedAt`, `closeReason: "expired"` 설정 후 Firestore batch 저장

### v2.5 상세 내역

**납품 주기 필터**
- 딜 찾기 필터 패널에 주기 행 추가 (단발성 · 주 1회 · 주 2회 · 격주)
- 기존 품목·지역·등급·상세 필터와 복합 적용 가능

**검색어 히스토리**
- 검색 후 blur/Enter 시 `localStorage("deal-search-history")` 최근 5건 자동 저장
- 검색창 포커스 + 빈 상태일 때 히스토리 칩 표시, 클릭 시 재검색, "지우기" 버튼

**활성 필터 요약 칩**
- 켜진 모든 필터(검색어·전문품목·품목·지역·등급·주기·날짜·수량·단가)를 골드 칩으로 나열
- 각 칩의 × 클릭으로 해당 필터만 개별 해제

### v2.6 상세 내역

**딜 복제 개선**
- 복제 시 원본 납품일이 오늘 이전이면 자동으로 빈 값으로 초기화
- 미래 날짜는 그대로 유지 (변경 없음)

**대시보드 기간 필터**
- 헤더 아래 "이번 주 / 이번 달 / 전체" 토글 버튼
- 선택 기간에 따라 KPI 타일 (딜 수·성사율·거래액 / 제안 수·선택률·평점) 실시간 재계산
- 품목 분포 차트도 기간 연동
- 최근 딜·제안 5건은 항상 전체 기준 표시

### v2.7 상세 내역

**농가 프로필 팝업 모달 (`FarmProfileModal`)**
- 제안 카드 농가명 옆 👤 버튼 클릭 → 오버레이 팝업 표시
- `e.stopPropagation()` 적용 — 카드 클릭(상세 이동)과 독립 동작
- 팝업 내용: `FarmProfileDetailCard` 재사용 (사진·인증·전문품목·평점 이력) + 농가 메시지 섹션
- 배경 클릭 또는 × 버튼으로 닫기
- 적용 위치: 모집중 제안 목록 + 매칭/완료 선택 제안 카드

### v2.8 상세 내역

**SettlementCard 5단계 트래커**
- 계약 확정 → 계약서 서명 → 선급금(30%) → 납품 완료 → 잔금(70%) 순서의 진행 트래커
- 각 단계 완료 시 녹색 ✓ 표시 + 타임스탬프, 미완료 단계는 회색 점
- 선급금 단계: 셰프에게 "선급금 지급 확인" 버튼 / 농가에게 "지급 대기 중" 텍스트
- `handleDepositPaid`: depositPaidAt 타임스탬프 기록 + Firestore 저장

**대시보드 정산 이력 테이블**
- 셰프: 매칭/완료 딜을 품목·거래처·금액·단계·확정일 컬럼으로 표시
- 농가: 선택된 제안(matched/done)을 동일 컬럼으로 표시
- 클릭 시 내 거래/내 제안 탭 이동

### v2.9 상세 내역

**계약서 서명 UI (`ContractModal`)**
- 갑(매수인·셰프)·을(매도인·농가) 서명란 각 1개
- 서명 완료 → "서명 완료" 배지 + 서명 일시 표시
- 상대방 미서명 → "서명 대기" 텍스트
- 본인 서명 차례 → "서명하기" 버튼 → `handleSignContract` 호출
- 양측 서명 완료 시 "양측 서명 완료" 배너 표시
- ContractModal 항상 live deal 데이터 참조 (`deals.find` 우선 + 폴백)

**푸시 알림 6종 신규**
- 셰프: 농가 서명 완료 ("✍️ 농가 서명 완료"), 선급금 지급 ("💰 선급금 지급 완료"), 정산 완료 ("✅ 정산 완료")
- 농가: 셰프 서명 완료 ("✍️ 셰프 서명 완료"), 선급금 지급 ("💰 선급금이 지급됐습니다"), 정산 완료 ("✅ 정산 완료")
- `showPushNotification`에 `tab` 파라미터 추가 → 알림 패널에서 탭 이동 연동

**딜 마감 임박 D-3 알림**
- 앱 로드 시 납품일 3일 이내 진행중 딜 감지 → 알림 발송
- `localStorage` 키 `deadline-notif-{uid}-{date}`로 하루 1회 중복 방지

**알림 패널 탭 바로가기**
- 알림 항목에 `tab` 필드 있으면 클릭 시 해당 탭 이동 + 패널 닫힘
- "→ 바로 가기" 링크 표시
- 날짜 포맷: 오늘/어제/N일 전 HH:MM

### v2.10 상세 내역

**관리자 화면 (`AdminScreen`)**
- `ADMIN_EMAIL = "jhlove0490@nonghyup.com"` 기반 접근제어 → 탭바에 "⚙ 관리자" 탭 노출
- 3섹션 탭 구조: 현황 / 딜 관리 / 최근 활동

**현황 섹션**
- KPI 6종: 전체 딜 수, 완료 딜 수, 성사율, 총 제안 수, 누적 거래액, 플랫폼 수수료

**딜 관리 섹션**
- 딜 검색 (품목·셰프명) + 상태 필터 (전체·모집중·진행중·완료·마감)
- 딜별 마감·완료·삭제 버튼 + confirm 다이얼로그

**최근 활동 섹션**
- 최근 등록 딜 8건 타임라인
- 최근 완료 거래 8건 타임라인

### v2.11 상세 내역

**UX 개선 8항목**
- 채팅 메시지 전송 실패 → 낙관적 롤백 + "네트워크를 확인해 주세요" 알림 (try/catch + rollback)
- 프로필 저장 → saving/saved/error 상태 피드백 (`setSaveState`)
- MyProposalsScreen 빈 상태 → "딜 찾아보기" CTA 버튼 (클릭 시 browse 탭 이동)
- 딜 찾기 필터 버튼 padding 증가 (모바일 터치 영역 확보, ≥ 30px)
- ContractModal stale data 수정 (live deal 우선 참조)
- ProposalForm 중복 제출 방지 (`submitting` state + `disabled` 속성 + guard)

**관리자 화면 확장**
- 유저 목록 섹션: Firestore `storage` 컬렉션에서 `user-profile-*` 문서 읽어 이름·역할·UID(앞 16자) 테이블 표시, 셰프는 딜 수·농가는 제안 수 표시
- 채팅 로그 섹션: 딜별 채팅 목록 (마지막 메시지 미리보기·건수) + 딜 클릭 시 전체 메시지 스레드 표시 (이미지 미리보기 포함), "← 목록" 버튼으로 복귀

### v2.12 상세 내역

**토스페이먼츠 테스트 결제 연동**
- `index.html`에 토스페이먼츠 v1 SDK 스크립트 추가 (`https://js.tosspayments.com/v1/payment`)
- `TOSS_CLIENT_KEY` 상수 추가 (테스트 클라이언트 키 — 사업자 등록 없이 사용 가능)

**결제 UI**
- SettlementCard 선급금(step 3): 기존 "선급금 지급 확인" 2단계 버튼 → **"💳 토스페이먼츠로 결제"** 단일 버튼으로 교체
- SettlementCard 잔금(step 5): 납품 완료 후 **"💳 잔금 결제하기"** 버튼 신규 추가
- 농가 측에는 "결제 대기 중 / 잔금 결제 대기 중" 텍스트 표시

**결제 플로우**
- `handleTossPayment(deal, proposal, type)`: 선급금·잔금 금액 계산 후 `tossPayments.requestPayment('카드', ...)` 호출
- 결제 완료 → 토스가 `?paymentKey=...&orderId=...&amount=...` 파라미터와 함께 앱으로 리다이렉트
- 앱 마운트 시 URL 파라미터 감지 → `localStorage('pending-toss-payment')` 임시 저장 → URL 정리
- deals 로드 완료(`loadState === "ready"`) 후 자동으로 `depositPaidAt` 또는 `balancePaidAt` 반영 + 알림 발송 + mydeals 탭 이동
- 결제 실패 시 에러 메시지 표시

**데이터 확장**
- `depositPaymentKey`: 선급금 토스 결제 키 저장
- `balancePaidAt`: 잔금 결제 완료 타임스탬프 (신규)
- `balancePaymentKey`: 잔금 토스 결제 키 저장

**테스트 카드**: `4242 4242 4242 4242`, 유효기간 미래 아무 날짜, CVC 3자리 아무 숫자

### v2.13 상세 내역

**납품 추적 신규 기능**

**DeliveryTracker 컴포넌트**
- 3단계 수평 트래커: 📦 납품 준비 → 🚛 발송 완료 → ✅ 수령 확인
- 각 단계 완료 시 타임스탬프(월/일) 표시
- 발송 완료 시 농가가 입력한 사진·메모 표시

**ShipModal 컴포넌트 (농가 전용)**
- 농가가 발송 완료 신고 시 호출되는 모달
- 발송 사진 업로드 (선택), 발송 메모 입력 (선택) 후 확인
- 카드 리스트 뷰·상세 뷰 양쪽에서 접근 가능

**핸들러 추가**
- `handleShipDeal(dealId, { photoURL, memo })`: 농가 발송 완료 처리 — `deliveryStatus: "shipped"`, `shippedAt`, `shippedPhotoURL`, `shippedMemo` 필드 저장
- `handleConfirmDelivery(dealId)`: 셰프 수령 확인 처리 — `deliveryStatus: "delivered"`, `deliveredAt`, `status: "done"`, `completedAt` 동시 처리

**화면 업데이트**
- MyDealsScreen: 진행중 딜 카드에 DeliveryTracker 삽입 (ProposalCard와 SettlementCard 사이), 기존 2단계 "납품 확인 후 정산 완료" 버튼 제거
- MyProposalsScreen: 선택된 제안 카드에 DeliveryTracker 삽입 (채팅·계약서 버튼 하단)
- SettlementCard "납품 완료" 단계: `completedAt` → `deliveredAt` 연동

**알림 2종 신규**
- 농가 발송 완료(`shippedAt`) → 셰프에게 "🚛 농가 발송 완료" 알림 + mydeals 탭 이동
- 셰프 수령 확인(`deliveredAt`) → 농가에게 "✅ 수령 확인 완료" 알림 + myproposals 탭 이동

**데이터 확장**
- `deliveryStatus`: `null` → `"shipped"` → `"delivered"`
- `shippedAt`: 발송 완료 타임스탬프
- `shippedPhotoURL`: 발송 사진 URL (선택)
- `shippedMemo`: 발송 메모 (선택)
- `deliveredAt`: 수령 확인 타임스탬프

### v2.14 상세 내역

**운송장 번호 입력 + 택배 추적 링크**

**ShipModal 확장**
- 택배사 선택 드롭다운: CJ대한통운·한진택배·롯데택배·우체국택배·로젠택배·직접 배달 (6종)
- 운송장 번호 입력 필드 (택배사 선택 시 표시, 직접 배달 선택 시 숨김)
- 공백 자동 제거 처리

**DeliveryTracker 확장**
- 발송 완료 단계에 택배사명 + 운송장 번호 표시
- 운송장 번호 있을 경우 "배송 조회 →" 링크 버튼 자동 생성 (택배사별 공식 조회 페이지로 이동)
- 직접 배달의 경우 조회 링크 미표시

**데이터 확장**
- `courierName`: 택배사명
- `trackingNumber`: 운송장 번호

### v2.15 상세 내역

**관리자 수수료 정산 대시보드**

**"정산" 탭 신규 추가** (관리자 화면 탭 바)

**KPI 4종**
- 누적 수수료 수입 (완료 딜 합산)
- 예상 미수금 (진행중 딜의 미수납 수수료)
- 총 중개 거래액
- 이번 달 수수료

**월별 수수료 바차트**
- 최근 6개월 월별 수수료 수입 수평 바차트 (최댓값 기준 비율 시각화)

**완료 딜 수수료 내역 테이블**
- 품목·셰프·농가·거래액·수수료(10%)·완료일 표시
- 최신순 정렬

**진행중 딜 미수금 현황 테이블**
- 총 수수료·수납액·미수금·단계(결제 대기/선급금 완료/잔금 완료) 표시

### v2.16 상세 내역

**잔금 결제 기한 설정 + 자동 알림**

**기한 자동 설정**
- `handleConfirmDelivery`: 수령 확인 시 `balanceDueAt = 수령일 + 7일` 자동 저장 (`BALANCE_DUE_DAYS = 7` 상수)

**SettlementCard D-day 카운트다운**
- 잔금 미납 상태에서 결제 기한 표시 (X월 X일 / D-N)
- D-3 이상: 회색(inkSoft)
- D-2~D-1: 노란색(gold, 주의)
- D-day: 빨간색(rust, 위급)
- 기한 초과: 빨간색 "기한 초과 +N일"

**알림 3종 신규 (앱 로드 시 1회 체크, 하루 1회 중복 방지)**
- D-1: "📅 잔금 결제 내일까지" → mydeals 탭 이동
- D-day: "⚠️ 잔금 결제 오늘까지" → mydeals 탭 이동
- 기한 초과: "🚨 잔금 결제 기한 초과" → mydeals 탭 이동
- 중복 방지: `localStorage('balance-due-notified-{dealId}-{날짜}')` 키로 일별 1회 제한

**데이터 확장**
- `balanceDueAt`: 잔금 결제 기한 타임스탬프 (수령 확인 시 자동 저장)

### v2.13~v2.16 E2E 테스트 상세 내역

**Playwright E2E 자동화 테스트 — 24/24 전부 통과**

`test_v2_features.cjs` (400줄, CommonJS, Chromium 헤드리스 390×844 모바일 뷰포트)

**커버리지: 24개 테스트**
| # | 테스트 항목 |
|---|---|
| 1 | 앱 로드 및 Firebase 연결 |
| 2~3 | 셰프·농가 계정 신규 가입 |
| 4 | 딜 생성 5단계 위저드 (품목 select 기본값 토마토, sizeCondition 필수 입력, 버튼 "다음 단계 →") |
| 5 | 농가 제안 제출 (region 필수 입력, 버튼 "제안 보내기") |
| 6 | 셰프 제안 선택 ("이 농가 선택하기", 이벤트 버블링 후 "← 제안 목록으로" 닫기) |
| 7~9 | DeliveryTracker 3단계 진행 상태 (출하 준비 → 배송중 → 수령 확인) |
| 10 | SettlementCard 결제·정산 UI 표시 |
| 11 | 농가 내 제안 목록 "선택됨" 배지 |
| 12~24 | 탭 터치 영역·알림 뱃지·관리자 화면 등 추가 검증 |

**주요 버그 발견 및 수정 (테스트 작성 중)**
- 딜 생성: 품목이 `<select>` (버튼 아님), Step 2 `sizeCondition` 미입력 시 유효성 실패
- 제안 제출: 신규 계정 `farmProfile.region` 빈값으로 제출 무효화
- 제안 선택: 딜 카드 클릭 시 toggle 접힘 방지, ProposalCard 클릭 이벤트 버블링으로 ProposalDetailView 열림 → 뒤로가기 처리
- 농가 배지: MyProposalsScreen 목록 텍스트 "선택됨" (이모지 없음)

### v2.17 상세 내역

**딜 전 문의 (`DealDetailView` + `MyDealsScreen`)**

- **농가 입장**: 딜 상세(`DealDetailView`) 하단에 `💬 제안 전 셰프에게 문의하기` 버튼 추가
- 버튼 클릭 → textarea 펼침 → 문의 내용 입력 후 "문의 보내기" 버튼으로 Firestore 저장
- 전송 후 "셰프가 답변 중입니다" 상태 표시, 셰프 답변 등록 시 답변 텍스트 표시
- **셰프 입장**: 내 거래(`MyDealsScreen`) 딜 카드에 "농가 문의 N건 미답변" 알림 뱃지 표시
- 답변 textarea(`placeholder="답변을 입력하세요"`) + "답변 등록" 버튼으로 답변 저장
- 답변 등록 후 답변 텍스트 표시 + "수정" 버튼으로 재편집 가능
- 문의 데이터는 `deals/{dealId}.inquiries[]` 배열에 저장 (문의자 uid·내용·타임스탬프·답변)

### v2.18 상세 내역

**결제 영수증 출력 (`SettlementCard`)**

- SettlementCard 선급금 단계에 🖨 선급금 영수증 버튼 추가 — 선급금 결제(`depositPaidAt`) 완료 후에만 표시
- 클릭 시 브라우저 인쇄 다이얼로그 호출 (인쇄 / PDF 저장)
- 영수증에 거래명·결제일·금액(선급금 30%)·주문번호(`depositPaymentKey`) 표시
- 결제 전에는 버튼 미표시 (결제 후 자동 노출)

### v2.19 상세 내역

**농가 성과 배지 (`FarmProfileScreen`)**

- 내 농가 탭에 성과 배지 섹션 추가 — 인증 칩 선택 시 해당 배지 즉시 렌더링
- "친환경 인증" 칩 선택 → `🌿 친환경 인증` 배지 표시 (배경: mossSoft, 테두리: moss)
- 배지는 인증 chip 클릭과 동시에 즉시 반영 (저장 전에도 미리보기)
- 저장 후 Firestore 재로드 시에도 배지 유지 (cert 데이터 기반 계산)
- 향후 확장 가능: 유기농·GAP·GI 인증 등 추가 배지 지원 구조

### UX 개선 #1~#6 상세 내역

**UX #1: 제안 비교 모드**
- 내 거래 제안 카드에 "+ 비교" 버튼 추가 (모집중 딜 전용)
- 클릭 시 "✓ 비교중" 상태로 전환, 헤더에 "비교 초기화" 버튼 표시
- 비교 선택된 제안들을 나란히 하이라이트해 단가·수량·납품일 비교 용이

**UX #2: D-day 마감 배지**
- 딜 찾기 목록의 딜 카드에 납품 마감 D-day 카운트다운 배지 표시
- D-7 이하 딜에 강조 표시 (예: `D-3`, `D-day`)
- 마감 임박 딜을 농가가 빠르게 인식 가능

**UX #3: 제안 자동 채우기 (pre-fill)**
- 동일 농가가 다른 딜에 제안 시 이전 제안의 단가·수량·인증을 자동으로 채움
- 제안 폼 상단에 "이전 제안의 단가·수량·인증이 미리 채워졌습니다" 배너 표시 (골드 배경)
- 미리 채워진 값은 수정 가능, 처음 제안이면 배너 미표시

**UX #4: 단골 농가 즐겨찾기**
- 매칭 후 내 거래 농가 카드에 "☆ 즐겨찾기" 버튼 추가
- 클릭 시 "★ 즐겨찾기" 상태로 전환 (localStorage 저장)
- 내 레스토랑 탭에 "★ 즐겨찾기 농가" 섹션 추가 — 즐겨찾기한 농가 목록 표시

**UX #5: 정기 딜 자동 연장**
- 완료(`done`) 상태 딜에 "↻ 다음 회차 딜 만들기" 버튼 표시 (모집중·진행중 딜은 미표시)
- 클릭 시 완료 딜 데이터를 기반으로 딜 만들기 위저드 사전 채움 (기존 딜 복제 개선)
- 정기 납품 계약 갱신 시 빠른 딜 재등록 가능

**UX #6: 작물 가격 참고**
- 딜 만들기 Step 4 (납품일·가격 입력) 화면에 "참고 · 최근 평균 거래가" 배너 표시
- 해당 품목의 최근 거래 평균 단가 정보를 참고해 현실적인 가격 제시 유도
- 배너 클릭 시 평균가 상세 정보 확인 가능

**E2E 테스트 (`test_v2_ux_features.cjs`) — 26/26 통과**

| # | 테스트 항목 |
|---|---|
| 1 | 앱 로드 스모크 |
| 2 | 셰프 가입 + 딜 A (토마토) 생성 |
| 3 | 딜 B (딸기) 생성 |
| 4 | 농가 가입 |
| 5 | UX #2: D-day 배지 (농가 딜 찾기 목록) |
| 6 | v2.17: 문의 버튼 표시 (딜 상세) |
| 7 | v2.17: 문의 전송 후 UI 반영 |
| 8 | 농가 딜 A 제안 제출 |
| 9 | UX #3: 제안 자동 채우기 배너 표시 |
| 10 | 셰프 로그인 + 딜 A 확장 |
| 11 | v2.17: 셰프 내 거래에 농가 문의 표시 |
| 12 | v2.17: 셰프 문의 답변 등록 완료 |
| 13 | UX #1: "+ 비교" 버튼 표시 |
| 14 | UX #1: "✓ 비교중" 상태 전환 |
| 15 | UX #1: "비교 초기화" 버튼 표시 |
| 16 | 제안 선택 (딜 A 매칭) |
| 17 | UX #4: "☆ 즐겨찾기" 버튼 표시 (매칭 후) |
| 18 | UX #4: 즐겨찾기 추가 후 "★ 즐겨찾기" 전환 |
| 19 | UX #4: 내 레스토랑 — 즐겨찾기 농가 목록 표시 |
| 20 | UX #6: 딜 생성 Step 4 — 작물 가격 참고 배너 |
| 21 | v2.18: SettlementCard — 토스 결제 버튼 표시 |
| 22 | v2.18: 영수증 버튼 결제 전 비표시 확인 |
| 23 | v2.19: 친환경 인증 배지 표시 (cert 변경 즉시) |
| 24 | v2.19: 저장 후 친환경 인증 배지 유지 |
| 25 | UX #5: matched 상태 → 자동 연장 버튼 미표시 (done 전용) |
| 26 | (UX #2 포함 총 26개 check() 통과) |

### v2.20 상세 내역

**관심 딜 북마크 (`DealBrowseScreen`)**

- 딜 카드 우측 상단에 🔖 북마크 버튼 추가 — `e.stopPropagation()` 처리로 카드 클릭(상세 이동)과 독립 동작
- 북마크 활성 시 버튼 배경 골드(goldSoft) + 테두리 강조, 비활성 시 투명 배경으로 시각 구분
- **"저장한 딜" 탭 토글 버튼** — "🌱 내 전문품목만" 옆에 나란히 배치, 저장 건수 뱃지 숫자 표시
- 저장한 딜 탭 활성 시: 필터 무관하게 북마크된 딜만 표시, "저장한 딜 N건" 헤더
- 모든 북마크 해제 시 전용 빈 상태 안내 + "전체 딜 보기" 버튼
- "내 전문품목만" ↔ "저장한 딜" 두 토글은 동시 활성 불가 (상호 해제)
- **영구 저장**: `localStorage("farm-bookmarks-{uid}")` — 새로고침·재로그인 후에도 유지, 사용자별 격리

**E2E 테스트 (`test_v2_bookmark.cjs`) — 16/16 통과**

| # | 테스트 항목 |
|---|---|
| 1 | 앱 로드 스모크 |
| 2 | 셰프 가입 + 딜 2건 생성 (토마토·케일) |
| 3 | 농가 가입 후 딜 찾기 진입 |
| 4 | 북마크 버튼 및 "저장한 딜" 탭 버튼 렌더링 확인 |
| 5 | 첫 번째 딜 북마크 추가 → 버튼 활성 상태 변화 |
| 6 | "저장한 딜" 버튼 뱃지 1 표시 |
| 7 | 저장한 딜 탭 클릭 → 북마크된 딜 1건만 표시 |
| 8 | "저장한 딜 1건" 헤더 텍스트 확인 |
| 9 | 비북마크 딜은 저장 탭에서 제외 |
| 10 | 두 번째 딜 북마크 → 뱃지 2로 증가 |
| 11 | 북마크 해제 → 뱃지 1로 감소 |
| 12 | 저장 탭에서 마지막 북마크 해제 → 빈 상태 화면 |
| 13~16 | localStorage 영구 유지 (새로고침 후 북마크 유지) |

### v2.21 상세 내역

**전체 화면 SVG 일러스트 UI 장식**

모든 일러스트는 인라인 SVG (외부 이미지 파일 없음), 데스크톱 전용 (`!isMobile` 조건부 렌더링), `pointerEvents: "none"` 으로 인터랙션 차단.

**로그인 화면 (`LoginScreen`)**
- 기존 단순 농장 SVG → 풍경화 수준의 다채로운 일러스트로 전면 교체
- 황혼 하늘 그라데이션(핑크→황금→크림), 방사형 태양·광선 7개, 구름 3겹
- 4겹 언덕(모스·에메랄드), 나무 울타리 기둥 12개, 농가(호박색 창문·굴뚝 연기)
- 사과나무(홍옥 5개), 해바라기 2송이(8장 꽃잎·씨앗 점), 라벤더·가지·당근, 핑크 나비

**딜 만들기 (`DealCreateScreen`) 좌우 사이드 패널**
- 좌측 (left: -118px): 덩굴 줄기 + 해바라기(8장 꽃잎) + 빨간 토마토(큰·중·작 3단계) + 무당벌레 + 주황 호박(갈비·덩굴)
- 우측 (right: -118px): 마늘 브레이드(3구·빨간 리본) + 보라 가지 + 라벤더 4가지 + 바질(테라코타 화분) + 로즈마리(테라코타 화분) + 당근 2개(초록 잎 3장씩)

**6개 탭 좌우 사이드 패널** (각 viewBox 0 0 110 320, width 100, height 290)

| 탭 | 좌측 패널 | 우측 패널 |
|---|---|---|
| 딜 찾기 | 덩굴·큰 토마토·빨간 피망·가지·나무 바구니 | 허브 걸이 바·라벤더·로즈마리·건고추·마늘·당근 화분 |
| 내 제안 | 수확 바구니(넘치는 토마토·가지·당근)·밀이삭 | 새싹 성장 3단계 화분·해바라기 꽃 |
| 내 거래 | 미즈앙플라스(대파·마늘묶음·허브부케·버섯 2종) | 와인병·촛대+촛불·테이블·다육식물·메뉴판·라벤더 화분 |
| 내 농가 | 사과나무 전체 구도 (가지·캐노피·홍옥 9개·낙과) | 물뿌리개·씨앗봉투 2개·모종삽·데이지·해바라기 |
| 내 레스토랑 | 와인병+라벨·촛불+촛대·메뉴판·다육식물·핑크 꽃 | 바질·로즈마리·라벤더 화분 3종 |
| 대시보드 | 식물 막대그래프 (밀이삭·해바라기·토마토 줄기 3개) | 계절 수레바퀴 (봄 꽃봉오리·여름 태양·가을 호박·겨울 눈결정) + 미니 실적 바차트 |

**각 탭 헤더 배너** (데스크톱에서 상단 그라데이션 카드 내 우측 SVG)
- 내 거래 · 대시보드(셰프): 테이블+접시·토마토·당근·나이프+포크·와인잔·미슐랭 별
- 내 제안 · 대시보드(농가): 언덕+이랑+해바라기·토마토·가지·태양·구름
- 내 레스토랑: 포크(3갈래)+나이프+허브·미슐랭 별·접시 타원
- 내 농가: 3겹 언덕+새싹+더 작은 새싹 2개·황금 태양+후광+광선·핑크 나비

### v2.22 상세 내역

**UX #5: 자동 연장 흐름 + 품목 구독 알림**

**자동 연장 흐름 (`handleNextCycleDeal`)**
- `handleNextCycleDeal`: 트랜잭션 이력 필드(`contractSignedChefAt`, `depositPaidAt`, `shippedAt` 등) 제외 — `...deal` 스프레드 대신 `crop, grade, ripeness, sizeCondition, quantity, targetPrice, cycle, note, chefName, chefRegion` 명시적 pick
- `_isNextCycle: true` + `_prevDealId: deal.id` 플래그 부착
- 납품일 자동 계산: `cycle`에서 주기(일) 추출 → 이전 납품일 또는 오늘 기준 자동 계산
- 위저드 배너 분기: `cloningFrom._isNextCycle ? "↻ 다음 회차 딜 — 납품일이 자동 계산됐습니다" : "⎘ 복제 중 — 내용을 확인 후 제출하세요"`

**품목 구독 알림 (농가)**
- `farmRef = useRef(null)` + `useEffect(() => { farmRef.current = farm; }, [farm])` — 클로저 stale 방지
- Firestore `onSnapshot` farmer 브랜치: `!old && deal.status === "open"` 조건으로 신규 딜 감지
- `farmRef.current.notifyNewDeals && farmRef.current.specialty.includes(deal.crop)` 매칭 시 `showPushNotification`
- `localStorage["notified-deal-{id}"]` dedup — 동일 딜 중복 알림 방지
- 농가 프로필(`FarmProfileScreen`)에 토글 UI 추가: 토글 ON/OFF → `notifyNewDeals` 저장

**버그 수정**
- `onAuthStateChanged` 신규 가입 race condition: `createUserWithEmailAndPassword` 직후 auth 이벤트가 Firestore 프로필 쓰기보다 먼저 도착해 `signOut` 호출 → 900ms 대기 후 재시도로 수정

**E2E 테스트 (`test_v2_ux5_nextcycle_subscribe.cjs`) — 14/14 통과**

| # | 테스트 항목 |
|---|---|
| 1 | `handleNextCycleDeal` — `_isNextCycle:true` + `_prevDealId` 플래그 설정 (코드 검증) |
| 2 | `handleNextCycleDeal` — 이력 필드 제외 (spread 없이 명시적 pick) (코드 검증) |
| 3 | 위저드 배너 분기 — `_isNextCycle` 조건 + '다음 회차 딜' 메시지 (코드 검증) |
| 4 | 복제 딜 배너 — '⎘ ... 복제 중' 표시 |
| 5 | 복제 딜 배너 — '다음 회차' 문구 없음 |
| 6 | 복제 딜 제출 후 새 카드 추가됨 |
| 7 | 타 탭 이동 후 create 재진입 시 배너 없음 (cloningDeal 없을 때) |
| 8 | 농가 프로필 — '관심 품목 새 딜 알림' 토글 존재 |
| 9 | 토글 ON 후 저장 — '저장됐습니다' 표시 |
| 10 | 알림 ON + 품목 일치(토마토) → '새 딜 등록' 알림 수신 |
| 11 | 알림 OFF (기본값) → 새 딜 알림 미수신 |
| 12 | 알림 패널에 항목 표시 |
| 13 | 알림 클릭 후 browse 탭 이동 |
| 14 | localStorage dedup 코드 확인 (코드 검증) |

### UX #2/#3/#4/#6 상세 내역

**UX #2: 상호 리뷰 — 농가→셰프 평가**
- 거래 완료 후 농가가 셰프에게 별점 + 후기를 남길 수 있는 `handleRateChef` 핸들러 추가
- `chefRating`, `chefRatedAt` 필드를 deal에 저장, 셰프 프로필에 "농가가 남긴 평가" 섹션 표시

**UX #3: 제안 단계 채팅**
- 채팅 ID 구조를 `dealId__proposalId` 형식으로 변경 → 동일 딜 내 제안별 독립 채팅 스레드 지원
- `handleOpenChat` 에 `proposalId` 필드 포함 → 제안 선택 전 단계에서도 채팅 가능

**UX #4: 역제안 (CounterOffer)**
- 셰프가 내 거래에서 마음에 드는 농가에게 역제안 단가를 제시할 수 있는 `CounterOfferModal` 컴포넌트 추가
- `handleSendCounterOffer` (셰프), `handleRespondCounterOffer` (농가) 핸들러 구현
- 역제안 도착 · 수락됨 · 거절됨 3종 앱 내 알림 연동

**E2E 테스트 (`test_v2_ux2346.cjs`) — 23/23 통과**

| # | 테스트 항목 |
|---|---|
| 1~14 | 정적 코드 검증 (handleRateChef, CounterOfferModal, SEASONAL_CROPS 등 14개 핵심 심볼) |
| 15 | UX #6 — 농가 딜 찾기 "8월 제철 식재료" 배너 표시 |
| 16 | UX #6 — 제철 칩 클릭 후 활성 스타일 적용 |
| 17 | UX #6 — 셰프 딜 만들기 1단계 제철 힌트 표시 |
| 18 | UX #3 — 셰프 내 거래 오픈 딜 제안 카드에 채팅 버튼 존재 |
| 19 | UX #4 — 역제안 버튼 존재 |
| 20 | UX #4 — 역제안 버튼 클릭 시 CounterOfferModal 표시 |
| 21 | UX #4 — 농가 역제안 수신 배너 문자열 |
| +2b | 보조 검증 (제철 칩 활성, 역제안 모달 입력 필드) |

---

### v2.25 상세 내역

**UX #6: 제철 식재료 배너 (`SeasonalBanner`) + 딜 만들기 힌트**

- `SEASONAL_CROPS` 객체 — 12개월별 제철 식재료 목록 정의
- `SeasonalBanner` 컴포넌트 — 딜 찾기 화면 상단에 "N월 제철 식재료" 배너 자동 표시
  - 월별 제철 품목을 칩 버튼으로 나열, 클릭 시 해당 품목으로 딜 필터 자동 적용
  - 배경: goldSoft, 아이콘 🌼
- 딜 만들기 Step 1 품목 선택 시 "N월 제철 — 클릭하면 바로 선택돼요" 힌트 텍스트 표시
  - 현재 제철 품목에만 힌트 표시, 비제철 품목은 힌트 없음

---

### v2.26 상세 내역

**농가 이력 공개 (`FarmProfileDetailCard` 고도화 + `FarmProfileScreen` 미리보기)**

**FarmProfileDetailCard 통계 칩**
- 셰프가 농가 프로필을 열면 총 제안 수·선택률(%)·완료 거래 수를 3개 칩으로 요약 표시
- `allDeals` 기반 실시간 계산: `farmProps`, `selectedProps`, `doneCount`, `selRate`

**최근 선택 거래 이력 테이블**
- 선택된 제안 최대 5건을 품목·셰프명·상태(완료/진행 중)·날짜로 테이블 표시 (`selectedAt` 기준 내림차순)
- 데이터 없으면 자동 숨김

**FarmProfileScreen "셰프에게 이렇게 보여요" 미리보기**
- 내 농가 탭에서 농가명 또는 전문품목 입력 시 하단에 실시간 `FarmProfileDetailCard` 미리보기 자동 표시
- 셰프 시점 공개 프로필을 저장 전에 바로 확인 가능

**농가 성과 배지 (`computeFarmBadges`)**
- 딜 데이터 + 인증 정보를 분석해 동적으로 배지를 계산하는 `computeFarmBadges(allDeals, farmerName, cert)` 함수 추가
- 내 농가 탭 + FarmProfileDetailCard 양쪽에서 동일 로직으로 배지 렌더링

---

### v2.27 상세 내역

**인증 뱃지 및 사진첨부**

**PhotoLightbox 공용 컴포넌트 (신규)**
- 이미지 클릭 시 전체화면 오버레이로 확대 표시 (position: fixed, zIndex: 2000)
- 배경 클릭 또는 ✕ 버튼으로 닫기, 이미지 자체 클릭은 닫힘 방지

**인증서 사진 (`certPhotoURL`)**
- `FarmProfileScreen` 인증 칩 선택 시 "인증서 사진 첨부 (선택)" `ImageUpload` 위젯 동적 표시
- 업로드 후 `certPhotoURL`을 farm 프로필에 저장
- `FarmProfileDetailCard` / `ProposalCard` 인증 칩에 ✓ 마크 추가 — 클릭 시 PhotoLightbox로 원본 확인

**작물 사진 (`cropPhotoURL`)**
- `ProposalForm`에 "작물 사진 첨부 (선택)" `ImageUpload` 추가 — 제안 제출 시 `cropPhotoURL` 포함
- `ProposalCard`에 72px 썸네일 표시 — 클릭 시 PhotoLightbox로 확대

**데이터 확장**
- `certPhotoURL`: 인증서 사진 base64 URL (farm profile + 제안서)
- `cropPhotoURL`: 작물 사진 base64 URL (제안서)

**E2E 테스트 (`test_v2_26_27.cjs`) — 18/18 통과**

| # | 테스트 항목 |
|---|---|
| 1~5 | v2.26 정적 코드 검증 (computeFarmBadges, 통계 칩, 이력 테이블, 미리보기, 계산 로직) |
| 6~8 | v2.26 브라우저 UI (내 농가 탭 진입, 미리보기 렌더링, 농가명 표시) |
| 9~16 | v2.27 정적 코드 검증 (PhotoLightbox, certPhotoURL, cropPhotoURL, ✓ 표시, blank state 등) |
| 17 | v2.27 인증 선택 후 인증서 사진 업로드 UI 표시 |
| 18 | v2.27 제안 폼 내 작물 사진 첨부 UI 표시 |

**버그 수정**
- `FarmProfileDetailCard`에서 `React.useState` 사용으로 인한 런타임 크래시 수정 (`useState` named import 방식으로 교체) — 파일 상단이 named import 전용이라 `React` 객체 미노출

---

### v2.28 상세 내역

**`alert()` → 인앱 Toast 컴포넌트 교체**

- `Toast` 함수형 컴포넌트 신규 추가 — `position: fixed` 하단 중앙, 4.5초 자동 소멸, ✕ 수동 닫기
- `toastMsg` / `setToastMsg` state → 앱 JSX 하단에 `<Toast message={toastMsg} onClose=...>` 렌더
- 교체 대상 3곳: 결제 실패 안내, 결제 모듈 미로드 안내, 채팅 메시지 전송 실패 안내
- `alert()`을 완전 제거해 브라우저 기본 모달 차단 현상 해소

**푸시 알림 아이콘 수정**

- `showPushNotification` 내 `icon: "/vite.svg"` → `icon: "/icon-192.png"` 교체 (PWA 앱 아이콘과 통일)

---

### v2.29 상세 내역

**관심 딜 북마크 Firestore 동기화**

- `bookmarkKey(uid)` → `farm-bookmarks-{uid}` Firestore 키 정의
- `DealBrowseScreen` 마운트 시 Firestore에서 북마크 목록 로드 → localStorage와 병합
- `toggleBookmark`: localStorage + `storage.set(bookmarkKey)` 동시 저장 → 기기 변경·재설치 후에도 북마크 유지

**이미지 업로드 Firebase Storage 연동 (`ImageUpload`)**

- `firebase.js`에 `fbStorage = getStorage(app)` export 추가
- `ImageUpload` 컴포넌트에 `storagePath` prop 추가 — 값이 있으면 Firebase Storage 업로드, 없으면 기존 base64 Firestore 저장
- `uploadString(ref(fbStorage, path), dataUrl, "data_url")` → `getDownloadURL`로 공개 URL 획득
- 적용: 농가 프로필 사진(`images/{uid}/farm_profile`), 인증서 사진(`images/{uid}/cert`)

---

### v2.30 상세 내역

**거래명세서 강화**

- 버튼 레이블: "선급금 영수증" → **"선급금 거래명세서"**, "잔금 영수증" → **"잔금 거래명세서"**
- 명세서 항목 추가:
  - `dealNo`: 주문번호 앞 10자 대문자 (거래 식별용)
  - `supplyAmt` / `vatAmt`: 공급가액 / 부가세(10%) 분리 출력
  - `deliveredStr`: 납품일 표기 (deliveredAt 또는 deliveryDate 기준)
  - 공급자 / 공급받는 자 레이블 구분
  - 홈택스 전자세금계산서 안내 문구 및 링크 (`hometax.go.kr`)
  - 잔금 명세서에 농가 실수령액 (total - fee) 추가

**인라인 세금계산서 안내 패널**

- SettlementCard 내 선급금 또는 잔금 결제 완료 후 "세금계산서 안내" 패널 자동 표시
- B2B 거래 시 홈택스 전자세금계산서 발행 방법 안내
- `depositPaid || balancePaid` 조건부 렌더링

---

### v2.31 상세 내역

**XSS 방어 (`printReceipt`)**

- `esc(s)` HTML escape 함수 추가 — `&`, `<`, `>`, `"` 4종 치환
- 사용자 입력 6개 값 모두 escape 처리: `proposal.farmName`, `deal.chefName`, `deal.chefRegion`, `deal.crop`, `deal.grade`, `deal.id`
- HTML 템플릿 리터럴에 원본 변수 직접 삽입 제거 → escape된 변수만 사용

**`window.open` 탭내핑 방지**

- 발송 사진 열기: `window.open(deal.shippedPhotoURL, "_blank", "noopener,noreferrer")`
- 채팅 이미지 열기: `window.open(m.imageURL, "_blank", "noopener,noreferrer")`
- 앱 전체에서 외부 URL을 여는 `"_blank"` 단독 패턴 0건 확인

---

### v2.32 상세 내역

**알림 dedup 키 누적 방지**

- 기존: `notified-deal-{id}` 개별 localStorage 키를 딜마다 생성 → localStorage 무한 축적
- 변경: `NOTIFIED_DEALS_KEY = "notified-deals-v1"` 단일 키에 JSON 배열로 관리
- `getNotifiedDeals()` / `addNotifiedDeal(id)` 헬퍼 함수 추가 — 300개 초과 시 오래된 항목 자동 제거

**결제 pending Firestore 병행 저장**

- user 로그인 직후: localStorage의 `pending-toss-payment` 값을 `pending-toss-{uid}` 키로 Firestore 백업
- `loadState === "ready"` 처리 시: localStorage 우선 확인 → 없으면 Firestore 폴백 조회
- 처리 완료 후 localStorage + Firestore 동시 클리어
- 효과: 토스 리다이렉트 직후 브라우저 강제 종료 시에도 결제 정보 유실 방지

---

### v2.33 상세 내역

**setTimeout 매직 넘버 제거**

- `printReceipt`: `setTimeout(() => win.print(), 600)` → `win.onload = () => win.print()` — 실제 DOM 로드 완료 후 인쇄 (네트워크 속도 무관)
- auth 재시도: `await new Promise(r => setTimeout(r, 900))` 단순 대기 1회 → `for (attempt < 5)` + `setTimeout(r, 300)` 재시도 루프 — 최대 1.5초, 성공 즉시 진행

**알림 내역 Firestore 연동**

- `notifHistoryKey(uid)` → `notif-history-{uid}` Firestore 키 정의
- `_recordNotif`: 새 알림 발생 시 localStorage + `storage.set(notifHistoryKey(uid))` 동시 저장
- user 로그인 시: Firestore 알림 내역 로드 → localStorage + state 동기화
- 모두 읽음 처리: localStorage + Firestore 동기화
- 모두 지우기: localStorage 삭제 + Firestore `"[]"` 저장
- 효과: 모바일↔데스크탑 간 알림 내역 공유, localStorage 초기화 시에도 복구 가능

---

### v2.34 상세 내역

**`ScoreBreakdown` 컴포넌트 추출**

- `SCORE_BREAKDOWN_LABELS.map(...)` 바 차트 블록이 3개 컴포넌트에 복붙 → `ScoreBreakdown` 단일 컴포넌트로 추출
- `size="compact"` prop: 딜 카드용 소형(10px 폰트, 4px 바, 60px 너비) / 상세 패널용 일반(11px 폰트, 6px 바, 80px 너비)
- `style` prop으로 각 사용처의 외부 여백 유연하게 전달
- `SCORE_BREAKDOWN_LABELS.map` 호출: 3개 → 1개 (항목 추가·변경 시 단일 지점 수정)

**북마크 키 혼용 명확화**

- `fav-farms-{uid}` (셰프가 즐겨찾기한 농가, chef 전용)과 `farm-bookmarks-{uid}` (농가가 저장한 딜 북마크, farmer 전용) 두 키에 역할 주석 추가
- 동일 개념의 중복이 아닌 별개 개념임을 코드에서 명시

---

### v2.35 상세 내역

**3차 감사 — 보안·UX·코드 품질 (SEC/UX/QUAL)**

**SEC-01: 민감 키 환경변수 이전**
- `ADMIN_EMAIL` 하드코딩 → `import.meta.env.VITE_ADMIN_EMAIL ?? ""` 참조
- `TOSS_CLIENT_KEY` 하드코딩 → `import.meta.env.VITE_TOSS_CLIENT_KEY ?? ""` 참조
- `.env.local`에 두 값 추가 (`.gitignore` 적용 — git 미업로드)

**SEC-02: isAdmin 서버 검증 안내 주석**
- 클라이언트 이메일 비교(`isAdmin`)는 UI 표시 전용임을 코드에 명시
- 실 운영 시 Firebase Custom Claims 또는 Firestore 보안 규칙 서버 측 검증 필요 안내

**UX-01: `DealDetailView` userId prop 전파**
- `DealDetailView` 함수 시그니처에 `userId` prop 추가
- `DealBrowseScreen`의 `DealDetailView` 렌더링 시 `userId={userId}` 전달 — 내부 사용자 식별 가능

**UX-02: `ShipModal` finally 블록 추가**
- 확인 버튼 `onClick` handler에 `try/catch/finally` 구조 적용
- `finally { setLoading(false) }` — API 성공·실패 양쪽에서 로딩 상태 반드시 해제

**QUAL-01: `DealCreateScreen` Hooks 순서 수정**
- `const isMobile = useIsMobile()` 호출 위치를 `if (done) return ...` early return 이전으로 이동
- React Rules of Hooks 준수 — 조건부 early return 이후 Hook 호출 금지

**E2E 테스트 (`test_v2_35.cjs`) — 10/10 통과**

| # | 테스트 항목 |
|---|---|
| 1 | VITE_ADMIN_EMAIL env 참조 + 하드코딩 제거 |
| 2 | VITE_TOSS_CLIENT_KEY env 참조 + 하드코딩 제거 |
| 3 | isAdmin 근처 SEC-02 주석 존재 |
| 4 | DealDetailView 시그니처에 userId prop 포함 |
| 5 | DealBrowseScreen 렌더에 userId={userId} 전달 |
| 6 | ShipModal finally { setLoading(false) } 코드 존재 |
| 7 | DealCreateScreen useIsMobile() 호출이 done return 이전에 존재 |
| 8 | done return 이후 중복 useIsMobile 없음 |
| 9 | 농가 로그인 → 딜 찾기 탭 정상 진입 |
| 10 | 셰프 로그인 → 딜 만들기 탭 정상 진입 (Hooks 오류 없음) |

---

### v2.36 상세 내역

**3차 감사 — 데이터 격리·안정성·코드 품질 (DATA/STAB/QUAL)**

**DATA-01: 알림 내역 uid별 키 분리**
- `notifHistory` 초기 state: 공용 키 `"notif-history"` 읽기 제거 → `useState([])`
- `_recordNotif`: `localStorage.setItem(notifHistoryKey(uid), ...)` — uid별 격리 저장
- 로그인 useEffect: uid별 localStorage 로드 → Firestore 폴백 → state 동기화
- 로그인 시 구버전 공용 키 `"notif-history"` 자동 정리 (`localStorage.removeItem`)
- 모두 지우기: `localStorage.removeItem(notifHistoryKey(user.uid))` uid별 삭제

**DATA-02: 검색 히스토리 uid별 키 분리**
- 고정 키 `"deal-search-history"` 제거
- `searchHistoryKey = userId ? \`deal-search-history-${userId}\` : null` — uid별 격리
- `searchHistory` 초기값: `userId` 없으면 빈 배열, 있으면 uid별 키로 localStorage 읽기
- 저장: `if (searchHistoryKey) localStorage.setItem(searchHistoryKey, ...)` — uid 없을 때 기록 방지

**STAB-01: `window.open` null 가드**
- `printReceipt`: `const w = window.open(...); if (!w) { alert("팝업이 차단됐습니다. ..."); return; }`
- `handlePrint`: `const win = window.open(...); if (!win) { alert("팝업이 차단됐습니다. ..."); return; }`
- 브라우저 팝업 차단 시 안내 메시지 표시 후 함수 조기 종료

**QUAL-02: `ProposalDetailView` useEffect deps 명시**
- AI 매칭 코멘트 useEffect deps: `[score, deal?.id, proposal?.id]`
- score 변경 시 `setAiComment(null)` + 재로드 — 이전 딜/제안 코멘트 잔존 방지

**QUAL-03: `AdminScreen` 내 `fmtDate` 이중 정의 제거**
- 전역 `fmtDate` 함수 외에 `AdminScreen` 내부에 동일 이름 재정의 존재 → 제거
- `fmtShortDate` 로 이름 변경하여 전역 `fmtDate`와 명확히 구분, 4개 호출부 일괄 수정

**E2E 테스트 (`test_v2_36.cjs`) — 10/10 통과**

| # | 테스트 항목 |
|---|---|
| 1 | notifHistory 초기값 공용 키 사용 제거 (빈 배열) |
| 2 | _recordNotif에서 uid별 notifHistoryKey로 localStorage 저장 |
| 3 | 모두 지우기 시 uid별 notifHistoryKey로 localStorage 삭제 |
| 4 | deal-search-history 고정 키 제거, uid별 searchHistoryKey 사용 |
| 5 | searchHistoryKey 기반 localStorage 저장 코드 존재 |
| 6 | printReceipt window.open null 가드 존재 |
| 7 | handlePrint window.open null 가드 존재 |
| 8 | ProposalDetailView useEffect deps [score, deal?.id, proposal?.id] |
| 9 | AdminScreen 내 fmtDate 재정의 제거, fmtShortDate로 통일 |
| 10 | 관리자 탭 진입 시 날짜 렌더 오류 없음 (fmtShortDate 정상 작동) |

---

### v2.37 상세 내역

**3차 감사 — 데이터 동기화·안정성·성능·코드 품질 (DATA/STAB/PERF/QUAL)**

**DATA-03: `favFarms` Firestore 동기화**
- `favFarmsKey(uid)` 함수 추가 → `fav-farms-{uid}` Firestore 키 정의
- `saveFavFarms`: localStorage 저장 + `storage.set(favFarmsKey(uid), ...)` Firestore 병행 저장
- `MyDealsScreen` / `ChefProfileScreen` 마운트 useEffect: Firestore 로드 → localStorage + state 동기화
- 효과: 기기 변경·localStorage 초기화 후에도 즐겨찾기 농가 목록 복구 가능

**STAB-02: `cleanBalanceDueKeys` — 잔금 알림 키 자동 정리**
- `cleanBalanceDueKeys(dealId)` 함수 추가 — `localStorage.keys()`에서 `balance-due-notified-{dealId}-*` 패턴 키를 모두 삭제
- `handleCompleteDeal`, `handleDeleteDeal`, `handleCloseDeal` 세 곳에서 호출
- 효과: 딜 종료 후 관련 알림 dedup 키가 localStorage에 무기한 축적되는 현상 방지

**PERF-01: `SAMPLE_DEALS` DEV 전용 분기**
- `const SAMPLE_DEALS = import.meta.env.DEV ? [...380줄 데모 데이터...] : []`
- Vite 정적 분석이 프로덕션 빌드에서 DEV 브랜치 코드를 완전히 제거 (tree-shaking)
- 효과: 프로덕션 번들에서 대용량 더미 데이터 배열 제외 → 번들 크기 감소

**QUAL-04: `sectionStyle` 공통 상수 추출**
- `SECTION_LABEL_STYLE` 모듈 레벨 상수 추출 — 섹션 레이블 공통 스타일 (IBM Plex Mono, uppercase, letterSpacing)
- `sectionCardStyle(isMobile)` 모듈 레벨 함수 추출 — `isMobile` 여부에 따른 카드 패딩 분기
- `AdminScreen` / `DashboardScreen` 양쪽에서 `const sectionStyle = sectionCardStyle(isMobile)` / `const sectionLabel = SECTION_LABEL_STYLE` 로 사용
- 효과: 인라인 스타일 객체 중복 제거, 단일 지점 수정으로 일괄 반영

**E2E 테스트 (`test_v2_37.cjs`) — 10/10 통과**

| # | 테스트 항목 |
|---|---|
| 1 | favFarmsKey 함수 코드 존재 (`fav-farms-` 키) |
| 2 | saveFavFarms에서 Firestore 동기화 코드 존재 |
| 3 | favFarms Firestore 로드 useEffect 코드 존재 |
| 4 | cleanBalanceDueKeys 함수 (startsWith 기반 키 정리) 존재 |
| 5 | handleCompleteDeal에서 cleanBalanceDueKeys 호출 |
| 6 | handleDeleteDeal, handleCloseDeal에서 cleanBalanceDueKeys 호출 |
| 7 | SAMPLE_DEALS가 import.meta.env.DEV 조건으로 분기됨 |
| 8 | SECTION_LABEL_STYLE 공통 상수 코드 존재 |
| 9 | sectionCardStyle 함수 코드 존재 |
| 10 | 셰프 내 거래 + 대시보드 탭 정상 진입 (리팩토링 후 앱 무결성) |

---

### v2.38 상세 내역

**4차 감사 — 보안·데이터·안정성·코드품질·성능·접근성**

**SEC-03: 방문기록·선택확인·채팅읽음 uid별 키 분리**
- `lastMyDealsVisitKey(uid)` / `seenSelectionsKey(uid)` / `lastChatReadKey(uid)` 함수 추가
- `useState` 초기값: 공용 localStorage 키 읽기 제거 → 빈 값으로 초기화
- 로그인 후 uid별 키에서 로드, 구버전 공용 키 3개 자동 정리
- 효과: 공유 기기에서 사용자 간 알림 뱃지·채팅 읽음 상태 혼용 방지

**SEC-04: `createdBy` 폴백 제거**
- `createdBy: user.uid || user.name` → `createdBy: user.uid` 단독 사용
- 효과: uid 없을 때 표시명으로 폴백해 소유권 비교 오류가 발생하는 경우 방지

**SEC-05: 만료 딜 자동 종료 소유권 필터**
- `expired` 필터에 `d.createdBy === userRef.current?.uid` 조건 추가
- `deals` 대신 `dealsRef.current` 사용
- 효과: 로그인한 사용자가 타인의 딜을 무단 종료하는 Firestore write 방지

**DATA-04: `notifiedDealsKey(uid)` uid 스코프 적용**
- `NOTIFIED_DEALS_KEY` 상수 → `notifiedDealsKey(uid)` 함수로 교체
- `getNotifiedDeals(uid)` / `addNotifiedDeal(uid, id)` — uid 파라미터 추가
- 효과: 공유 기기에서 사용자 간 알림 dedup 키 혼용으로 신규 딜 알림 누락 방지

**STAB-03: auth 재시도 루프 cancelled 플래그**
- `useEffect` 최상단에 `let cancelled = false` 선언
- 재시도 루프 내 `&& !cancelled` 조건 + `if (cancelled) return` 체크
- cleanup 함수: `() => { cancelled = true; unsub(); }`
- 효과: 언마운트 후 setState 호출로 인한 React 경고 및 상태 오염 방지

**STAB-04: 채팅 전송 실패 rollback 범위 축소**
- 기존: `setChats((c) => ({ ...c, [dealId]: prev }))` — 이전 스냅샷 전체 복원
- 변경: `.filter((m) => m.id !== newMsg.id)` — 실패한 메시지 1개만 제거
- 효과: 동시에 전송된 다른 메시지가 rollback으로 삭제되는 현상 방지

**QUAL-05: 신규 제안 `rating: null` 처리**
- `ProposalForm` 제출 시 `rating: 4.0` → `rating: null`
- 렌더 3곳: `proposal.rating != null` 가드 + null일 때 `"—"` 표시
- 효과: 리뷰 없는 신규 농가가 매칭 점수에서 부당하게 상위 랭크를 받는 현상 제거

**QUAL-06: `dealsRef` — stale closure 수정**
- `const dealsRef = useRef([])` + `useEffect(() => { dealsRef.current = deals; }, [deals])` 추가
- balance-due 알림·만료 딜 종료·딜 마감 알림 3개 effect에서 `deals` 대신 `dealsRef.current` 사용
- 효과: `loadState`가 `"ready"`로 유지되는 동안 deals가 변경돼도 최신값 참조 보장

**PERF-02: `cropPriceRef` useMemo 적용**
- IIFE `(() => { ... })()` → `useMemo(() => { ... }, [deals])`
- `useMemo` named import 추가
- 효과: 탭 전환·Toast·알림 패널 토글 등 무관한 렌더에서 deals 전체 순회 반복 제거

**PERF-03: Google Fonts 중복 로드 제거**
- JSX 2곳(`LoginScreen` 반환, `App` 반환)에서 `<link>` 태그 제거
- `index.html` `<head>`에 preconnect + stylesheet 한 번만 추가
- 효과: 중복 폰트 요청 제거, 번들 렌더 시 불필요한 DOM 조작 방지

**A11Y-01: 알림 패널 항목 `<button>` 교체**
- 알림 항목 `<div onClick>` → `<button type="button" aria-label>` 교체
- `width: 100%, text-align: left` 스타일로 시각적 차이 없음
- 알림 목록 컨테이너에 `aria-live="polite" aria-label="알림 목록"` 추가

**A11Y-02: Toast ARIA live region**
- Toast `<div>` → `role="alert" aria-live="assertive" aria-atomic="true"` 추가
- 닫기 버튼에 `aria-label="알림 닫기"` 추가
- 효과: 스크린리더가 새 Toast 메시지를 즉시 발화

**E2E 테스트 (`test_v2_38.cjs`) — 14/14 통과**

| # | 테스트 항목 |
|---|---|
| 1 | SEC-03: uid 스코프 키 함수 3개 존재 |
| 2 | SEC-03: useState 초기값 공용 키 읽기 제거 |
| 3 | SEC-03: uid 스코프 키로 localStorage 저장 |
| 4 | SEC-04: createdBy 폴백 제거 |
| 5 | SEC-05: 만료 딜 소유권 필터 코드 존재 |
| 6 | DATA-04: notifiedDealsKey uid 함수 + call site uid 전달 |
| 7 | STAB-03: cancelled 플래그 패턴 존재 |
| 8 | STAB-04: 채팅 rollback 실패 메시지만 filter 제거 |
| 9 | QUAL-05: rating null 초기화 + null 가드 존재 |
| 10 | QUAL-06: dealsRef + sync useEffect 패턴 존재 |
| 11 | PERF-02: cropPriceRef useMemo 존재 |
| 12 | PERF-03: JSX 중복 fonts link 제거 + index.html 단일 추가 |
| 13 | A11Y-02: Toast role=alert + aria-live=assertive 존재 |
| 14 | 농가 딜 찾기 + 내 제안 탭 정상 진입 (앱 무결성) |

---

### v2.39 상세 내역

**5차 감사 — 보안·데이터·안정성·성능·UX·접근성**

**SEC-02: 샘플 초기화 버튼 isAdmin 게이팅**
- `{!isMobile && isAdmin && (` 조건으로 관리자만 버튼 표시
- 효과: 비관리자 사용자가 전체 딜 데이터를 샘플로 초기화하는 것 방지

**SEC-01: `pending-toss-payment` uid 스코프**
- `pendingTossKey(uid)` 함수 추가, 임시 캡처 키 `pending-toss-capture` 도입
- user 로드 시 캡처 키 → `pendingTossKey(user.uid)` 이관 후 캡처 키 삭제
- 효과: 공유 기기에서 사용자 간 결제 대기 정보 혼용 방지

**SEC-03: `balance-due-notified` uid 스코프 + cleanBalanceDueKeys 범용 필터**
- `notifyKey` = `balance-due-notified-${cu.uid}-${deal.id}-${todayKey}`
- `cleanBalanceDueKeys`: `startsWith("balance-due-notified-") && includes(-${dealId}-)` 필터
- 효과: 공유 기기에서 잔금 알림 dedup 키 혼용 방지

**SEC-04: Toss `orderId` 타임스탬프 suffix**
- `orderId` = `` `${type}-${deal.id}-${Date.now()}` ``
- 파싱: `orderId.slice(4, orderId.lastIndexOf("-"))` 로 dealId 추출
- 효과: 동일 딜 재결제 시 orderId 중복으로 Toss 결제 거절 방지

**DATA-01: `handleSendMessage` `arrayUnion` 전환**
- `setDoc(... { messages: arrayUnion(newMsg) }, { merge: true })`
- 효과: 동시 메시지 전송 시 overwrite race로 인한 메시지 소실 방지

**DATA-02: 낙관적 업데이트 함수형 업데이터**
- `setChats((c) => ({ ...c, [dealId]: [...(c[dealId] || []), newMsg] }))`
- 효과: stale closure로 인한 메시지 누락 방지

**STAB-01: React `ErrorBoundary` 클래스 컴포넌트**
- `class ErrorBoundary extends Component` — `getDerivedStateFromError` + `componentDidCatch`
- 효과: 예기치 않은 렌더 오류 격리 — 앱 전체 크래시 방지

**STAB-02: `ProposalForm` `finally { setSubmitting(false) }`**
- `onSubmit()` 호출을 `try { ... } finally { setSubmitting(false) }` 로 감쌈
- 효과: 예외 발생 시에도 submitting 상태 항상 복원

**STAB-03: `ImageUpload` `mountedRef` 언마운트 안전**
- `mountedRef = useRef(true)` + cleanup `() => { mountedRef.current = false; }`
- `onChange`, `setCompressing` 호출 전 `mountedRef.current` 체크
- 효과: 이미지 업로드 중 컴포넌트 언마운트 시 setState 경고 방지

**DATA-03 + PERF-01: 데이터 로드 effect 개선**
- `[authChecked]` → `[authChecked, user?.uid]` — 재로그인 시 farm/chefProfile 재로드
- 셰프는 자신의 딜 ID 집합(`chefDealIds`)만 필터해 채팅 로드 (불필요한 chats 문서 제외)
- 효과: 다른 계정 재로그인 시 이전 사용자 프로필이 남는 버그 수정 + 채팅 로드 범위 축소

**UX-01: `DealCreateScreen` 더블클릭 방지**
- `const [submitting, setSubmitting] = useState(false)` + `if (submitting) return;`
- 효과: 딜 생성 버튼 더블클릭 시 중복 딜 등록 방지

**A11Y-01: `ImageUpload` 키보드 접근성**
- `role="button"` + `tabIndex={compressing ? -1 : 0}` + `aria-label` + `onKeyDown` (Enter/Space)
- 효과: 키보드만으로 이미지 업로드 버튼 포커스·클릭 가능

---

### v2.28~v2.39 E2E 테스트 요약

| 파일 | 항목 수 | 결과 |
|---|---|---|
| `test_v2_28_29.cjs` | 20 | 20/20 ✅ |
| `test_v2_30.cjs` | 14 | 14/14 ✅ |
| `test_v2_31.cjs` | 10 | 10/10 ✅ |
| `test_v2_32.cjs` | 11 | 11/11 ✅ |
| `test_v2_33.cjs` | 10 | 10/10 ✅ |
| `test_v2_34.cjs` | 10 | 10/10 ✅ |
| `test_v2_35.cjs` | 10 | 10/10 ✅ |
| `test_v2_36.cjs` | 10 | 10/10 ✅ |
| `test_v2_37.cjs` | 10 | 10/10 ✅ |
| `test_v2_38.cjs` | 14 | 14/14 ✅ |
| `test_v2_39.cjs` | 16 | 16/16 ✅ |
| **합계** | **135** | **135/135 ✅** |

---

## 향후 과제

- 앱스토어 등록 (PWA → Capacitor/Cordova 래핑 또는 TWA)
- 최종 발표 준비 및 비즈니스 모델 고도화 (10월)
