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
4. 진행중 상태에서 정산 내역(선급금 30% / 잔금 70% / 플랫폼 수수료 10%, 모두 예시값)을 확인하고, 납품 확인 후 완료 처리하면 거래 타임라인이 마무리됩니다.

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
| 알림 뱃지 | 새 제안 도착 및 미확인 채팅 시 "내 거래" 탭에 숫자 뱃지 |
| 내 레스토랑 | 레스토랑 정보·선호 품목·납품 주기 등록 |

### 농가
| 기능 | 설명 |
|---|---|
| 딜 찾기 | 품목·등급·지역·납품일·수량·단가 범위 필터 |
| 스마트 정렬 | 내 전문 품목 딜을 상단 노출 + "내 전문 품목" 뱃지 |
| 제안 보내기 | 가격·수량·납품일·인증 입력 후 제안 제출 |
| 제안 취소 | 모집중 딜에 한해 제안 취소 |
| 알림 뱃지 | 내 제안 선택 및 미확인 채팅 시 "내 제안" 탭에 숫자 뱃지 |
| 내 농가 | 농가 정보·전문 품목·리드타임 등록 + 누적 평균 평점 표시 |

### 공통
| 기능 | 설명 |
|---|---|
| 실시간 채팅 | 매칭 후 셰프↔농가 채팅 + 미확인 메시지 뱃지 |
| 웹 푸시 알림 | 새 제안 도착·제안 선택·새 채팅 메시지 시 브라우저 푸시 알림 (Service Worker) |
| 계약서 자동 생성 | 매칭된 딜에서 표준 농산물 거래 계약서 자동 생성 + 인쇄/PDF 저장 |
| PWA 설치 | manifest.json + 오프라인 캐싱으로 홈화면에 앱 설치 가능 |
| 납품일 자동 마감 | 납품일이 지난 모집중 딜 자동 마감 처리 + "납품일 만료" 뱃지 |
| 회원가입 / 로그인 | Firebase Auth 이메일/비밀번호 인증, 역할(셰프·농가) 선택 |

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

## 향후 과제

- 앱스토어 등록 (PWA → Capacitor/Cordova 래핑 또는 TWA)
- 최종 발표 준비 및 비즈니스 모델 고도화 (10월)
