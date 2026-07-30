import { useState, useEffect, useRef } from "react";
import { storage, db, auth } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

const DEALS_KEY = "deals-list";

const TOKENS = {
  bg: "#F3F1E7",
  ink: "#20281F",
  inkSoft: "#5B6358",
  rust: "#BB4A2E",
  rustSoft: "#E8C9BD",
  moss: "#5B7553",
  mossSoft: "#D9E2D2",
  gold: "#C99A3E",
  goldSoft: "#F0E2C2",
  line: "#D8D2C0",
  card: "#FBFAF5",
};

const CROPS = {
  토마토: { unit: "kg" },
  딸기: { unit: "kg" },
  블루베리: { unit: "kg" },
  복숭아: { unit: "kg" },
  무화과: { unit: "kg" },
  로메인: { unit: "kg" },
  케일: { unit: "kg" },
  루꼴라: { unit: "kg" },
  시금치: { unit: "kg" },
  깻잎: { unit: "kg" },
  비트: { unit: "kg" },
  파프리카: { unit: "kg" },
  가지: { unit: "kg" },
  애호박: { unit: "kg" },
  바질: { unit: "kg" },
  고수: { unit: "kg" },
  민트: { unit: "kg" },
  파슬리: { unit: "kg" },
  로즈마리: { unit: "kg" },
  표고버섯: { unit: "kg" },
};
const CROP_OPTIONS = Object.keys(CROPS);

const RIPENESS_STAGES = {
  토마토: ["그린(미숙)", "브레이커", "터닝", "핑크", "라이트레드", "레드(완숙)"],
  딸기: ["화이트(미숙)", "핑크", "레드 70%", "완숙(레드 100%)"],
  블루베리: ["그린", "레드(미숙)", "블루(수확기)", "완숙 블루"],
  복숭아: ["그린(미숙)", "브레이커", "완숙"],
  무화과: ["브레이커", "핑크", "완숙"],
  로메인: ["베이비잎", "중간생장", "완전결구"],
  케일: ["베이비잎", "어린잎", "성숙잎"],
  루꼴라: ["마이크로그린", "베이비잎", "성숙잎"],
  시금치: ["베이비잎", "어린잎", "성숙잎"],
  깻잎: ["소엽(연잎)", "중엽", "대엽"],
  비트: ["베이비(잎+뿌리)", "중간", "완숙"],
  파프리카: ["그린(미숙)", "옐로우/오렌지", "레드(완숙)"],
  가지: ["미니", "중간", "성숙"],
  애호박: ["미니(꽃달림)", "중간", "성숙"],
  바질: ["마이크로그린", "어린잎", "성숙잎"],
  고수: ["마이크로그린", "어린잎", "성숙잎"],
  민트: ["어린순", "성숙잎"],
  파슬리: ["마이크로그린", "어린잎", "성숙잎"],
  로즈마리: ["어린순", "성숙순"],
  표고버섯: ["복돈(갓 미개)", "반개", "완전개산"],
};

const GRADE_LEVELS = ["보통", "상", "특"];
const CYCLE_OPTIONS = ["단발성(1회)", "주 1회", "주 2회", "격주"];
const DEAL_STATUS_LABEL = { open: "모집중", matched: "진행중", done: "완료", closed: "마감" };
const DEAL_STATUS_COLOR = { open: TOKENS.gold, matched: TOKENS.moss, done: TOKENS.inkSoft, closed: TOKENS.rust };
const DEPOSIT_RATE = 0.3;
const FEE_RATE = 0.1;
const FARM_KEY = "farm-profile";
const CHEF_PROFILE_KEY = "chef-profile";
const USER_KEY = "current-user";
const CHATS_KEY = "chats-data";
const CERT_OPTIONS = ["인증 없음", "무농약", "유기농", "GAP", "친환경"];

const SAMPLE_DEALS = [
  {
    id: "d1",
    chefName: "테이블나인",
    chefRegion: "서울 용산",
    crop: "토마토",
    sizeCondition: "지름 5cm 이상",
    ripeness: "라이트레드",
    grade: "특",
    quantity: 100,
    deliveryDate: "2026-08-10",
    cycle: "주 1회",
    targetPrice: 23000,
    note: "콩피용으로 사용해 균일한 크기가 중요합니다.",
    status: "open",
    createdAt: Date.now() - 86400000 * 2,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d2",
    chefName: "그린테이블",
    chefRegion: "서울 마포",
    crop: "바질",
    sizeCondition: "잎 길이 4cm 이상",
    ripeness: "어린잎",
    grade: "상",
    quantity: 20,
    deliveryDate: "2026-08-12",
    cycle: "주 2회",
    targetPrice: 18000,
    note: "가니쉬용, 향이 진한 품종 선호",
    status: "open",
    createdAt: Date.now() - 86400000,
    proposals: [
      {
        id: "p1",
        farmName: "그린허브팜",
        region: "충북 음성",
        price: 18000,
        availableQty: 30,
        leadTimeDays: 1,
        cert: "무농약",
        rating: 4.9,
        message: "당일 수확 후 익일 새벽 배송 가능합니다.",
        createdAt: Date.now() - 3600000,
      },
    ],
    selectedProposalId: null,
  },
  {
    id: "d3",
    chefName: "오마카세 료",
    chefRegion: "서울 강남",
    crop: "딸기",
    sizeCondition: "25g 이상 균일",
    ripeness: "완숙(레드 100%)",
    grade: "특",
    quantity: 30,
    deliveryDate: "2026-08-20",
    cycle: "주 1회",
    targetPrice: 42000,
    note: "디저트 플레이팅용, 당도 12brix 이상 선호합니다.",
    status: "open",
    createdAt: Date.now() - 86400000 * 5,
    proposals: [
      {
        id: "p2",
        farmName: "햇살딸기농원",
        region: "경남 진주",
        price: 41000,
        availableQty: 50,
        leadTimeDays: 2,
        cert: "GAP",
        rating: 4.7,
        message: "설향 품종으로 당도 13brix 이상 보장합니다.",
        createdAt: Date.now() - 86400000 * 2,
      },
      {
        id: "p3",
        farmName: "베리굿팜",
        region: "전북 남원",
        price: 40000,
        availableQty: 40,
        leadTimeDays: 1,
        cert: "유기농",
        rating: 4.8,
        message: "유기농 인증 매향 딸기입니다. 냉장 당일 배송 가능합니다.",
        createdAt: Date.now() - 86400000,
      },
    ],
    selectedProposalId: null,
  },
  {
    id: "d4",
    chefName: "비스트로 봄",
    chefRegion: "경기 성남",
    crop: "로메인",
    sizeCondition: "결구 길이 25cm 이상",
    ripeness: "완전결구",
    grade: "상",
    quantity: 50,
    deliveryDate: "2026-08-18",
    cycle: "주 2회",
    targetPrice: 8000,
    note: "시저 샐러드 전용, 속잎이 단단한 것으로 부탁드립니다.",
    status: "open",
    createdAt: Date.now() - 86400000 * 3,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d5",
    chefName: "파인다이닝 숲",
    chefRegion: "서울 서초",
    crop: "블루베리",
    sizeCondition: "지름 14mm 이상",
    ripeness: "완숙 블루",
    grade: "특",
    quantity: 15,
    deliveryDate: "2026-08-25",
    cycle: "단발성(1회)",
    targetPrice: 35000,
    note: "여름 디저트 메뉴 한정 사용, 냉장 포장 필수.",
    status: "open",
    createdAt: Date.now() - 86400000 * 1,
    proposals: [
      {
        id: "p4",
        farmName: "산들블루팜",
        region: "강원 춘천",
        price: 34000,
        availableQty: 20,
        leadTimeDays: 2,
        cert: "무농약",
        rating: 4.6,
        message: "고랭지 블루베리라 당도와 크기 모두 우수합니다.",
        createdAt: Date.now() - 43200000,
      },
    ],
    selectedProposalId: null,
  },
  {
    id: "d6",
    chefName: "라틴키친",
    chefRegion: "서울 이태원",
    crop: "고수",
    sizeCondition: "줄기 포함 15cm 이상",
    ripeness: "어린잎",
    grade: "보통",
    quantity: 10,
    deliveryDate: "2026-08-07",
    cycle: "주 2회",
    targetPrice: 12000,
    note: "타코·세비체용, 향이 강한 것 선호합니다.",
    status: "open",
    createdAt: Date.now() - 86400000 * 4,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d7",
    chefName: "이탈리안노트",
    chefRegion: "서울 종로",
    crop: "애호박",
    sizeCondition: "꽃 달린 미니 애호박, 길이 12cm 이하",
    ripeness: "미니(꽃달림)",
    grade: "특",
    quantity: 40,
    deliveryDate: "2026-08-15",
    cycle: "주 1회",
    targetPrice: 15000,
    note: "꽃이 신선하게 달려 있어야 합니다. 당일 수확 후 즉시 배송 요청.",
    status: "open",
    createdAt: Date.now() - 3600000 * 6,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d8",
    chefName: "테이블나인",
    chefRegion: "서울 용산",
    crop: "로즈마리",
    sizeCondition: "가지 길이 20cm 이상",
    ripeness: "성숙순",
    grade: "상",
    quantity: 5,
    deliveryDate: "2026-08-22",
    cycle: "격주",
    targetPrice: 28000,
    note: "스테이크 가니쉬 및 인퓨징용, 목질화되지 않은 신선한 순으로.",
    status: "open",
    createdAt: Date.now() - 86400000 * 6,
    proposals: [
      {
        id: "p5",
        farmName: "허브가든",
        region: "제주 서귀포",
        price: 27000,
        availableQty: 10,
        leadTimeDays: 3,
        cert: "유기농",
        rating: 4.9,
        message: "제주 청정 환경에서 자란 유기농 로즈마리입니다.",
        createdAt: Date.now() - 86400000 * 2,
      },
    ],
    selectedProposalId: null,
  },
  {
    id: "d9",
    chefName: "모던한식 연",
    chefRegion: "서울 강북",
    crop: "토마토",
    sizeCondition: "지름 3cm 이하 방울토마토",
    ripeness: "레드(완숙)",
    grade: "상",
    quantity: 25,
    deliveryDate: "2026-08-11",
    cycle: "주 1회",
    targetPrice: 19000,
    note: "코스 요리 고명용, 색상이 균일하고 껍질이 얇은 것 선호.",
    status: "open",
    createdAt: Date.now() - 3600000 * 10,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d10",
    chefName: "카페 아르떼",
    chefRegion: "경기 수원",
    crop: "민트",
    sizeCondition: "줄기 포함 10cm 이상",
    ripeness: "어린순",
    grade: "보통",
    quantity: 8,
    deliveryDate: "2026-08-09",
    cycle: "주 1회",
    targetPrice: 14000,
    note: "음료·디저트 가니쉬용, 향이 선명하고 잎이 싱싱한 것으로.",
    status: "open",
    createdAt: Date.now() - 3600000 * 2,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d11",
    chefName: "파인다이닝 숲",
    chefRegion: "서울 서초",
    crop: "케일",
    sizeCondition: "잎 길이 8cm 이하 베이비잎",
    ripeness: "베이비잎",
    grade: "특",
    quantity: 12,
    deliveryDate: "2026-08-08",
    cycle: "주 2회",
    targetPrice: 22000,
    note: "샐러드 베이스용, 부드럽고 쓴맛이 적은 베이비 케일 선호.",
    status: "open",
    createdAt: Date.now() - 86400000 * 1,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d12",
    chefName: "비스트로 봄",
    chefRegion: "경기 성남",
    crop: "루꼴라",
    sizeCondition: "잎 길이 6cm 이하",
    ripeness: "베이비잎",
    grade: "상",
    quantity: 10,
    deliveryDate: "2026-08-13",
    cycle: "주 2회",
    targetPrice: 20000,
    note: "피자·파스타 마무리 가니쉬용, 향이 강한 것 선호합니다.",
    status: "open",
    createdAt: Date.now() - 3600000 * 8,
    proposals: [
      {
        id: "p6",
        farmName: "초록들팜",
        region: "경기 양평",
        price: 19500,
        availableQty: 15,
        leadTimeDays: 1,
        cert: "무농약",
        rating: 4.7,
        message: "수경재배로 균일한 품질을 유지합니다. 당일 수확 배송 가능.",
        createdAt: Date.now() - 3600000 * 3,
      },
    ],
    selectedProposalId: null,
  },
  {
    id: "d13",
    chefName: "모던한식 연",
    chefRegion: "서울 강북",
    crop: "표고버섯",
    sizeCondition: "갓 지름 6cm 이상",
    ripeness: "반개",
    grade: "특",
    quantity: 20,
    deliveryDate: "2026-08-16",
    cycle: "주 1회",
    targetPrice: 32000,
    note: "코스 요리 메인 식재료, 향이 진하고 육질이 두꺼운 것 선호.",
    status: "open",
    createdAt: Date.now() - 86400000 * 2,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d14",
    chefName: "이탈리안노트",
    chefRegion: "서울 종로",
    crop: "파프리카",
    sizeCondition: "개당 200g 이상",
    ripeness: "레드(완숙)",
    grade: "상",
    quantity: 30,
    deliveryDate: "2026-08-19",
    cycle: "주 1회",
    targetPrice: 9000,
    note: "파스타 소스 및 구이용, 과육이 두껍고 씨가 적은 것 선호.",
    status: "open",
    createdAt: Date.now() - 86400000 * 3,
    proposals: [],
    selectedProposalId: null,
  },
  {
    id: "d15",
    chefName: "오마카세 료",
    chefRegion: "서울 강남",
    crop: "무화과",
    sizeCondition: "개당 60g 이상",
    ripeness: "완숙",
    grade: "특",
    quantity: 8,
    deliveryDate: "2026-08-23",
    cycle: "단발성(1회)",
    targetPrice: 55000,
    note: "여름 디저트 코스용, 껍질이 얇고 당도 높은 것 선호.",
    status: "open",
    createdAt: Date.now() - 3600000 * 5,
    proposals: [
      {
        id: "p7",
        farmName: "남도무화과농원",
        region: "전남 영암",
        price: 53000,
        availableQty: 12,
        leadTimeDays: 2,
        cert: "GAP",
        rating: 4.8,
        message: "봉황 품종으로 당도와 향이 뛰어납니다. 수확 당일 발송 가능.",
        createdAt: Date.now() - 3600000 * 2,
      },
    ],
    selectedProposalId: null,
  },
  {
    id: "d16",
    chefName: "그린테이블",
    chefRegion: "서울 마포",
    crop: "비트",
    sizeCondition: "지름 6~8cm 균일",
    ripeness: "완숙",
    grade: "상",
    quantity: 25,
    deliveryDate: "2026-08-17",
    cycle: "격주",
    targetPrice: 7000,
    note: "수프·샐러드용, 색이 선명하고 흙 없이 세척된 것으로.",
    status: "open",
    createdAt: Date.now() - 86400000 * 4,
    proposals: [],
    selectedProposalId: null,
  },
];

function chipBadge(bg, color) {
  return {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color,
    fontFamily: "'IBM Plex Mono', monospace",
  };
}

const inputStyle = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: `1px solid ${TOKENS.line}`,
  fontSize: 14,
  fontFamily: "'IBM Plex Sans', sans-serif",
  background: "#FFFFFF",
  color: TOKENS.ink,
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  color: TOKENS.inkSoft,
  marginBottom: 4,
  marginTop: 12,
  fontFamily: "'IBM Plex Mono', monospace",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: TOKENS.ink }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
        border: `1px solid ${active ? TOKENS.moss : TOKENS.line}`,
        background: active ? TOKENS.mossSoft : "#FFFFFF",
        color: active ? TOKENS.moss : TOKENS.inkSoft,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ display: "block", fontSize: 11, color: TOKENS.inkSoft, marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}{required && <span style={{ color: TOKENS.rust }}> *</span>}
    </label>
  );
}

function ErrorText({ text }) {
  return <div style={{ fontSize: 11, color: TOKENS.rust, marginTop: 4 }}>{text}</div>;
}

function StarRating({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{
            background: "none", border: "none",
            cursor: onChange ? "pointer" : "default",
            fontSize: size, padding: 0, lineHeight: 1,
            color: star <= (hover || Math.round(value || 0)) ? TOKENS.gold : TOKENS.line,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function RatingPanel({ farmName, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  return (
    <div style={{ background: TOKENS.goldSoft, border: `1px solid ${TOKENS.gold}44`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: "#7A5C20", fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
        {farmName} 평가하기
      </div>
      <StarRating value={rating} onChange={setRating} size={26} />
      {rating === 0 && (
        <p style={{ fontSize: 12, color: "#B45309", margin: "6px 0 0" }}>별점을 선택해주세요</p>
      )}
      {rating > 0 && (
        <>
          <textarea
            rows={2}
            placeholder="후기를 남겨주세요 (선택)"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            style={{ ...inputStyle, marginTop: 10, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif" }}
          />
          <button
            onClick={() => onSubmit(rating, review)}
            style={{ marginTop: 8, padding: "8px 18px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            평가 제출
          </button>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span style={chipBadge(`${DEAL_STATUS_COLOR[status]}22`, DEAL_STATUS_COLOR[status])}>
      {DEAL_STATUS_LABEL[status]}
    </span>
  );
}

function DealSummaryRow({ deal }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 10px" }}>
      <span style={chipBadge(TOKENS.goldSoft, "#7A5C20")}>{deal.grade}등급</span>
      <span style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{deal.ripeness}</span>
      <span style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>{deal.sizeCondition}</span>
      <span style={chipBadge(TOKENS.line, TOKENS.inkSoft)}>{deal.cycle}</span>
    </div>
  );
}

/* ---------- AI 자동 입력 ---------- */

function parseWithRules(text) {
  const CROP_MAP = {
    "토마토": ["토마토"],
    "딸기": ["딸기"],
    "블루베리": ["블루베리"],
    "복숭아": ["복숭아"],
    "무화과": ["무화과"],
    "로메인": ["로메인"],
    "케일": ["케일"],
    "루꼴라": ["루꼴라", "아루굴라", "루콜라"],
    "시금치": ["시금치"],
    "깻잎": ["깻잎"],
    "비트": ["비트"],
    "파프리카": ["파프리카"],
    "가지": ["가지"],
    "애호박": ["애호박", "호박"],
    "바질": ["바질"],
    "고수": ["고수"],
    "민트": ["민트"],
    "파슬리": ["파슬리"],
    "로즈마리": ["로즈마리"],
    "표고버섯": ["표고버섯", "표고", "버섯"],
  };
  let crop = null;
  for (const [name, kws] of Object.entries(CROP_MAP)) {
    if (kws.some((k) => text.includes(k))) { crop = name; break; }
  }

  let sizeCondition = null;
  if (/소형|작은|소\s*크기/.test(text)) sizeCondition = "소형";
  else if (/대형|큰|대\s*크기/.test(text)) sizeCondition = "대형";
  else if (/중간|중형|중\s*크기/.test(text)) sizeCondition = "중간";

  let grade = null;
  if (/특급|특품|특\s*등/.test(text)) grade = "특";
  else if (/상품|상\s*등/.test(text)) grade = "상";

  let ripeness = null;
  if (crop === "토마토") {
    if (/완숙|레드|빨강/.test(text)) ripeness = "레드(완숙)";
    else if (/핑크/.test(text)) ripeness = "핑크";
    else if (/미숙|그린|초록/.test(text)) ripeness = "그린(미숙)";
  } else if (crop === "딸기") {
    if (/완숙/.test(text)) ripeness = "완숙(레드 100%)";
    else if (/핑크/.test(text)) ripeness = "핑크";
  } else if (crop === "블루베리") {
    if (/완숙/.test(text)) ripeness = "완숙 블루";
    else if (/수확/.test(text)) ripeness = "블루(수확기)";
  } else if (crop === "복숭아") {
    if (/완숙/.test(text)) ripeness = "완숙";
    else if (/미숙|그린/.test(text)) ripeness = "그린(미숙)";
  } else if (crop === "무화과") {
    if (/완숙/.test(text)) ripeness = "완숙";
    else if (/핑크/.test(text)) ripeness = "핑크";
  } else if (crop === "로메인" || crop === "케일" || crop === "시금치") {
    if (/베이비|어린/.test(text)) ripeness = "베이비잎";
    else if (/성숙/.test(text)) ripeness = "성숙잎";
  } else if (crop === "루꼴라" || crop === "파슬리") {
    if (/마이크로/.test(text)) ripeness = "마이크로그린";
    else if (/베이비|어린/.test(text)) ripeness = "베이비잎";
    else if (/성숙/.test(text)) ripeness = "성숙잎";
  } else if (crop === "바질" || crop === "고수") {
    if (/마이크로/.test(text)) ripeness = "마이크로그린";
    else if (/어린/.test(text)) ripeness = "어린잎";
    else if (/성숙/.test(text)) ripeness = "성숙잎";
  } else if (crop === "깻잎") {
    if (/소엽|연잎|작/.test(text)) ripeness = "소엽(연잎)";
    else if (/대엽|큰/.test(text)) ripeness = "대엽";
  } else if (crop === "비트") {
    if (/베이비|어린/.test(text)) ripeness = "베이비(잎+뿌리)";
    else if (/완숙/.test(text)) ripeness = "완숙";
  } else if (crop === "파프리카") {
    if (/완숙|레드|빨강/.test(text)) ripeness = "레드(완숙)";
    else if (/미숙|그린/.test(text)) ripeness = "그린(미숙)";
    else if (/노랑|옐로|오렌지/.test(text)) ripeness = "옐로우/오렌지";
  } else if (crop === "가지" || crop === "애호박") {
    if (/꽃|미니/.test(text)) ripeness = crop === "애호박" ? "미니(꽃달림)" : "미니";
    else if (/성숙/.test(text)) ripeness = "성숙";
    else if (/중간/.test(text)) ripeness = "중간";
  } else if (crop === "민트") {
    if (/어린/.test(text)) ripeness = "어린순";
    else if (/성숙/.test(text)) ripeness = "성숙잎";
  } else if (crop === "로즈마리") {
    if (/어린/.test(text)) ripeness = "어린순";
    else if (/성숙/.test(text)) ripeness = "성숙순";
  } else if (crop === "표고버섯") {
    if (/완전|펼/.test(text)) ripeness = "완전개산";
    else if (/반/.test(text)) ripeness = "반개";
  }

  let quantity = null;
  const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|킬로|개|박스|상자|단|g|그램)/);
  if (qtyMatch) quantity = parseFloat(qtyMatch[1]);

  const DAY_INDEX = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6, 일: 0 };
  function calcDate(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
  }
  function nextWeekday(dayIdx, forceNextWeek = false) {
    const today = new Date().getDay();
    let diff = (dayIdx - today + 7) % 7;
    if (diff === 0) diff = 7;
    if (forceNextWeek && diff < 7) diff += 7;
    return calcDate(diff);
  }

  let deliveryDate = null;
  if (/내일/.test(text)) deliveryDate = calcDate(1);
  else if (/모레/.test(text)) deliveryDate = calcDate(2);
  else {
    const nDaysMatch = text.match(/(\d+)\s*일\s*후/);
    if (nDaysMatch) deliveryDate = calcDate(parseInt(nDaysMatch[1]));
  }
  if (!deliveryDate) {
    const isNextWeek = /다음\s*주/.test(text);
    for (const [dayChar, idx] of Object.entries(DAY_INDEX)) {
      if (new RegExp(dayChar + "요일").test(text)) {
        deliveryDate = nextWeekday(idx, isNextWeek);
        break;
      }
    }
  }

  const notes = [];
  if (/신선/.test(text)) notes.push("신선한 것");
  if (/유기농/.test(text)) notes.push("유기농");
  if (/당일/.test(text)) notes.push("당일 수확");
  if (/무농약/.test(text)) notes.push("무농약");

  return {
    _usedRules: true,
    chefName: null, crop, sizeCondition, ripeness, grade,
    quantity, deliveryDate, targetPrice: null, cycle: null,
    note: notes.length > 0 ? notes.join(", ") : null,
  };
}

async function parseWithAI(text) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const todayDay = dayNames[now.getDay()];

  const systemInstruction = `당신은 식자재 주문 요청에서 정보를 추출하는 어시스턴트입니다.
오늘 날짜: ${todayStr} (${todayDay}). 상대적 날짜 표현(내일, 다음주 수요일, 3일 후 등)은 오늘 기준으로 계산해 YYYY-MM-DD로 변환하세요.
가능한 품목: 토마토, 딸기, 블루베리, 복숭아, 무화과, 로메인, 케일, 루꼴라, 시금치, 깻잎, 비트, 파프리카, 가지, 애호박, 바질, 고수, 민트, 파슬리, 로즈마리, 표고버섯
숙성도 옵션(품목별로 정확히 일치해야 함):
- 토마토: 그린(미숙), 브레이커, 터닝, 핑크, 라이트레드, 레드(완숙)
- 딸기: 화이트(미숙), 핑크, 레드 70%, 완숙(레드 100%)
- 블루베리: 그린, 레드(미숙), 블루(수확기), 완숙 블루
- 복숭아: 그린(미숙), 브레이커, 완숙
- 무화과: 브레이커, 핑크, 완숙
- 로메인/케일/시금치: 베이비잎, 어린잎, 성숙잎
- 루꼴라/파슬리: 마이크로그린, 베이비잎, 성숙잎
- 바질/고수: 마이크로그린, 어린잎, 성숙잎
- 깻잎: 소엽(연잎), 중엽, 대엽
- 비트: 베이비(잎+뿌리), 중간, 완숙
- 파프리카: 그린(미숙), 옐로우/오렌지, 레드(완숙)
- 가지/애호박: 미니, 중간, 성숙 (애호박 미니는 미니(꽃달림))
- 민트: 어린순, 성숙잎
- 로즈마리: 어린순, 성숙순
- 표고버섯: 복돈(갓 미개), 반개, 완전개산
등급: 보통, 상, 특
주기: 단발성(1회), 주 1회, 주 2회, 격주`;

  const userPrompt = `다음 텍스트에서 식자재 주문 정보를 추출하세요. 없는 항목은 null로 채우세요.

텍스트: "${text}"

JSON 형식:
{
  "chefName": "레스토랑명 또는 null",
  "crop": "품목 또는 null",
  "sizeCondition": "크기 조건 또는 null",
  "ripeness": "숙성도 또는 null",
  "grade": "등급 또는 null",
  "quantity": 수량숫자 또는 null,
  "deliveryDate": "YYYY-MM-DD 또는 null",
  "targetPrice": 단가숫자 또는 null,
  "cycle": "주기 또는 null",
  "note": "추가사항 또는 null"
}`;

  const response = await fetch("/api/groq/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return parseWithRules(text);
  }

  const result = await response.json();
  const rawText = result.choices?.[0]?.message?.content?.trim() ?? "";
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return parseWithRules(text);
    return JSON.parse(match[0]);
  }
}

/* ---------- 1. 딜 만들기 (셰프) ---------- */

const DEAL_FIELD_REQUIRED = {
  chefName: "레스토랑명",
  crop: "품목",
  sizeCondition: "크기 조건",
  quantity: "필요 수량",
  deliveryDate: "희망 납품일",
  targetPrice: "희망 단가",
};

const DEAL_STEPS = [
  { key: 1, label: "품목" },
  { key: 2, label: "조건" },
  { key: 3, label: "수량" },
  { key: 4, label: "납품·가격" },
  { key: 5, label: "확인" },
];

function StepIndicator({ step }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", gap: isMobile ? 4 : 6, marginBottom: 20, overflowX: "auto" }}>
      {DEAL_STEPS.map((s) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: isMobile ? 3 : 6, flexShrink: 0 }}>
          <div
            style={{
              width: isMobile ? 22 : 26, height: isMobile ? 22 : 26, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              background: s.key <= step ? TOKENS.ink : TOKENS.line,
              color: s.key <= step ? TOKENS.bg : TOKENS.inkSoft,
            }}
          >
            {s.key}
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: s.key === step ? TOKENS.ink : TOKENS.inkSoft }}>{s.label}</span>}
          {isMobile && s.key === step && <span style={{ fontSize: 11, color: TOKENS.ink }}>{s.label}</span>}
          {s.key !== DEAL_STEPS.length && <div style={{ width: isMobile ? 10 : 16, height: 1, background: TOKENS.line }} />}
        </div>
      ))}
    </div>
  );
}

function DealCreateScreen({ onCreate, defaultChefName = "", defaultChefRegion = "", editingDeal = null, onUpdate = null, onCancelEdit = null, cloningFrom = null }) {
  const isEditing = !!editingDeal;
  const isCloning = !!cloningFrom;
  const blank = {
    chefName: defaultChefName, chefRegion: defaultChefRegion, crop: "토마토", sizeCondition: "", ripeness: RIPENESS_STAGES["토마토"][2],
    grade: "상", quantity: "", deliveryDate: "", cycle: "주 1회", targetPrice: "", note: "",
  };
  const [step, setStep] = useState(1);
  const [data, setData] = useState(
    isEditing
      ? { ...editingDeal, quantity: String(editingDeal.quantity), targetPrice: String(editingDeal.targetPrice) }
      : isCloning
      ? { ...cloningFrom, quantity: String(cloningFrom.quantity), targetPrice: String(cloningFrom.targetPrice) }
      : blank
  );
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiParsed, setAiParsed] = useState(false);
  const [aiNote, setAiNote] = useState(null);

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const handleCropChange = (crop) => {
    const stages = RIPENESS_STAGES[crop] || [];
    setData((d) => ({ ...d, crop, ripeness: stages[Math.floor(stages.length / 2)] || "" }));
  };

  const handleAIParse = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiParsed(false);
    setAiNote(null);
    try {
      const parsed = await parseWithAI(aiText);
      setData((prev) => {
        const crop = CROP_OPTIONS.includes(parsed.crop) ? parsed.crop : prev.crop;
        const stages = RIPENESS_STAGES[crop] || [];
        const ripeness = stages.includes(parsed.ripeness)
          ? parsed.ripeness
          : stages[Math.floor(stages.length / 2)] || prev.ripeness;
        const grade = GRADE_LEVELS.includes(parsed.grade) ? parsed.grade : prev.grade;
        const cycle = CYCLE_OPTIONS.includes(parsed.cycle) ? parsed.cycle : prev.cycle;
        return {
          ...prev,
          chefName: prev.chefName, // 로그인 상호명 유지 (AI가 덮어쓰지 않음)
          crop,
          ripeness,
          grade,
          sizeCondition: parsed.sizeCondition || prev.sizeCondition,
          quantity: parsed.quantity != null ? String(parsed.quantity) : prev.quantity,
          deliveryDate: parsed.deliveryDate || prev.deliveryDate,
          targetPrice: parsed.targetPrice != null ? String(parsed.targetPrice) : prev.targetPrice,
          cycle,
          note: parsed.note || prev.note,
        };
      });
      if (parsed._usedRules) {
        setAiNote("AI 서버 연결 불가 — 키워드 분석으로 자동 입력했습니다.");
      } else {
        setAiParsed(true);
      }
    } catch (err) {
      setAiError(err.message || "AI 파싱 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const STEP_FIELDS = {
    1: ["chefName", "crop"],
    2: ["sizeCondition"],
    3: ["quantity"],
    4: ["deliveryDate", "targetPrice"],
  };

  const validateStep = (s) => {
    const fields = STEP_FIELDS[s] || [];
    const nextErrors = {};
    fields.forEach((key) => {
      if (!data[key]) nextErrors[key] = `${DEAL_FIELD_REQUIRED[key] || "값"}을(를) 입력해주세요`;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;
    if (isEditing) {
      onUpdate({ ...editingDeal, ...data, quantity: Number(data.quantity), targetPrice: Number(data.targetPrice) });
    } else {
      onCreate({
        id: `d${Date.now()}`,
        ...data,
        quantity: Number(data.quantity),
        targetPrice: Number(data.targetPrice),
        status: "open",
        createdAt: Date.now(),
        proposals: [],
        selectedProposalId: null,
      });
      setDone(true);
    }
  };

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: "40px auto 0", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: TOKENS.mossSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24, color: TOKENS.moss }}>
          ✓
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink, margin: "0 0 8px" }}>
          딜이 등록됐어요
        </h1>
        <p style={{ fontSize: 14, color: TOKENS.inkSoft, marginBottom: 24, lineHeight: 1.6 }}>
          농가들이 이 요청서를 보고 제안을 보내올 거예요. "내 거래" 탭에서 들어온 제안을 비교하고 선택할 수 있습니다.
        </p>
        <button
          onClick={() => { setData(blank); setErrors({}); setStep(1); setDone(false); }}
          style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, color: TOKENS.ink, fontSize: 14, cursor: "pointer" }}
        >
          새 딜 만들기
        </button>
      </div>
    );
  }

  const isMobile = useIsMobile();
  const stages = RIPENESS_STAGES[data.crop] || [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? 14 : 24 }}>

      {/* AI 자동 입력 패널 */}
      <div style={{ background: TOKENS.goldSoft, border: `1px solid ${TOKENS.gold}55`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#7A5C20" }}>✦</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#7A5C20", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            AI 자동 입력
          </span>
        </div>
        <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: "0 0 10px", lineHeight: 1.6 }}>
          원하는 조건을 자유롭게 문장으로 입력하면 AI가 아래 항목을 자동으로 채워드립니다.
        </p>
        <textarea
          rows={4}
          placeholder={"예: 테이블나인인데요, 콩피용 토마토 100kg 주 1회 납품받고 싶어요.\n라이트레드 단계에 특등급, 지름 5cm 이상으로 부탁드려요.\n납품일은 2026-08-10이고 단가는 23,000원/kg 희망합니다."}
          value={aiText}
          onChange={(e) => { setAiText(e.target.value); setAiParsed(false); setAiError(null); }}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, background: "#FFFDF5" }}
        />
        {aiError && <ErrorText text={aiError} />}
        {aiNote && (
          <div style={{ fontSize: 12, color: "#B45309", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚠</span><span>{aiNote}</span>
          </div>
        )}
        {aiParsed && (
          <div style={{ fontSize: 12, color: TOKENS.moss, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>✓</span>
            <span>항목이 자동으로 채워졌습니다. 아래 단계에서 확인하고 수정할 수 있습니다.</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleAIParse}
          disabled={aiLoading || !aiText.trim()}
          style={{
            marginTop: 10,
            padding: "9px 18px",
            background: aiLoading || !aiText.trim() ? TOKENS.line : TOKENS.ink,
            color: aiLoading || !aiText.trim() ? TOKENS.inkSoft : TOKENS.bg,
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: aiLoading || !aiText.trim() ? "default" : "pointer",
          }}
        >
          {aiLoading ? "AI 분석 중…" : "AI로 자동 입력"}
        </button>
      </div>

      {isEditing && (
        <div style={{ background: TOKENS.goldSoft, border: `1px solid ${TOKENS.gold}44`, borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: "#7A5C20" }}>
          ✎ <strong>{editingDeal.crop}</strong> 딜 수정 중
        </div>
      )}
      {isCloning && (
        <div style={{ background: TOKENS.mossSoft, border: `1px solid ${TOKENS.moss}44`, borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: TOKENS.moss }}>
          ⎘ <strong>{cloningFrom.crop}</strong> 딜 복제 중 — 내용을 확인 후 제출하세요
        </div>
      )}
      <StepIndicator step={step} />

      {step === 1 && (
        <Section title="1. 레스토랑 · 품목">
          <FieldLabel required>레스토랑명</FieldLabel>
          <input type="text" placeholder="예: 테이블나인" value={data.chefName} onChange={(e) => update("chefName", e.target.value)} style={inputStyle} />
          {errors.chefName && <ErrorText text={errors.chefName} />}

          <FieldLabel>납품 지역</FieldLabel>
          <input type="text" placeholder="예: 서울 강남" value={data.chefRegion || ""} onChange={(e) => update("chefRegion", e.target.value)} style={inputStyle} />

          <FieldLabel required>품목</FieldLabel>
          <select value={data.crop} onChange={(e) => handleCropChange(e.target.value)} style={inputStyle}>
            {CROP_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Section>
      )}

      {step === 2 && (
        <Section title="2. 품질 조건">
          <FieldLabel required>크기 조건</FieldLabel>
          <input type="text" placeholder="예: 지름 5cm 이상" value={data.sizeCondition} onChange={(e) => update("sizeCondition", e.target.value)} style={inputStyle} />
          {errors.sizeCondition && <ErrorText text={errors.sizeCondition} />}

          <FieldLabel>숙성도 / 수확 단계</FieldLabel>
          <select value={data.ripeness} onChange={(e) => update("ripeness", e.target.value)} style={inputStyle}>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <FieldLabel>표준규격 등급 (국립농산물품질관리원 기준)</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {GRADE_LEVELS.map((g) => (
              <Chip key={g} label={`${g}등급`} active={data.grade === g} onClick={() => update("grade", g)} />
            ))}
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title="3. 필요 수량">
          <FieldLabel required>필요 수량 (kg)</FieldLabel>
          <input type="number" min={1} placeholder="예: 100" value={data.quantity} onChange={(e) => update("quantity", e.target.value)} style={inputStyle} />
          {errors.quantity && <ErrorText text={errors.quantity} />}

          <FieldLabel>납품 주기</FieldLabel>
          <select value={data.cycle} onChange={(e) => update("cycle", e.target.value)} style={inputStyle}>
            {CYCLE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Section>
      )}

      {step === 4 && (
        <Section title="4. 납품일 · 희망 가격">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel required>희망 납품일</FieldLabel>
              <input type="date" value={data.deliveryDate} onChange={(e) => update("deliveryDate", e.target.value)} style={inputStyle} />
              {errors.deliveryDate && <ErrorText text={errors.deliveryDate} />}
            </div>
            <div>
              <FieldLabel required>희망 단가 (원/kg)</FieldLabel>
              <input type="number" min={0} placeholder="예: 23000" value={data.targetPrice} onChange={(e) => update("targetPrice", e.target.value)} style={inputStyle} />
              {errors.targetPrice && <ErrorText text={errors.targetPrice} />}
            </div>
          </div>
          <FieldLabel>추가 요청사항 (선택)</FieldLabel>
          <textarea
            rows={3} placeholder="예: 콩피용으로 사용해 균일한 크기가 중요합니다"
            value={data.note} onChange={(e) => update("note", e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif" }}
          />
        </Section>
      )}

      {step === 5 && (
        <Section title={isEditing ? "5. 수정 내용 확인" : "5. 등록 전 확인"}>
          <div style={{ background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: TOKENS.ink }}>{data.crop}</span>
              <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>{data.chefName}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
              <span style={chipBadge(TOKENS.goldSoft, "#7A5C20")}>{data.grade}등급</span>
              <span style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{data.ripeness}</span>
              <span style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>{data.sizeCondition}</span>
              <span style={chipBadge(TOKENS.line, TOKENS.inkSoft)}>{data.cycle}</span>
            </div>
            <div style={{ fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.8 }}>
              필요 수량 {data.quantity}kg · 희망단가 {Number(data.targetPrice || 0).toLocaleString()}원/kg<br />
              희망 납품일 {data.deliveryDate}
            </div>
            {data.note && <p style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 10 }}>"{data.note}"</p>}
          </div>
        </Section>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {step > 1 && (
          <button onClick={goBack} style={{ padding: "12px 20px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, color: TOKENS.ink, fontSize: 14, cursor: "pointer" }}>
            이전
          </button>
        )}
        {isEditing && step === 1 && (
          <button onClick={onCancelEdit} style={{ padding: "12px 16px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, color: TOKENS.inkSoft, fontSize: 14, cursor: "pointer" }}>
            취소
          </button>
        )}
        {step < 5 ? (
          <button onClick={goNext} style={{ flex: 1, padding: "12px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            다음
          </button>
        ) : (
          <button onClick={handleSubmit} style={{ flex: 1, padding: "12px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            {isEditing ? "딜 수정하기" : "딜 등록하고 농가 제안 받기"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 2. 딜 찾기 (농가가 제안서 제출) ---------- */

const PROPOSAL_FIELD_REQUIRED = {
  farmName: "농가명",
  region: "지역",
  price: "제안 단가",
  availableQty: "가능 수량",
  availableDate: "납품 가능일",
};

function ProposalForm({ deal, onSubmit, onCancel, farmProfile, farmerName }) {
  const [data, setData] = useState({
    farmName: farmProfile?.farmName || farmerName || "",
    region: farmProfile?.region || "",
    price: "",
    availableQty: "",
    availableDate: "",
    cert: farmProfile?.cert || "인증 없음",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const isMobile = useIsMobile();
  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const handleSubmit = () => {
    const nextErrors = {};
    Object.entries(PROPOSAL_FIELD_REQUIRED).forEach(([key, label]) => {
      if (!data[key]) nextErrors[key] = `${label}을(를) 입력해주세요`;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(deal.id, {
        id: `p${Date.now()}`,
        farmerName,
        farmName: data.farmName,
        region: data.region,
        price: Number(data.price),
        availableQty: Number(data.availableQty),
        availableDate: data.availableDate,
        cert: data.cert,
        rating: 4.0,
        message: data.message,
        createdAt: Date.now(),
      });
    }
  };

  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
      {farmProfile?.farmName && (
        <div style={{ fontSize: 12, color: TOKENS.moss, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span>✓</span><span>내 농가 정보({farmProfile.farmName})가 자동으로 입력되었습니다.</span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div>
          <FieldLabel required>농가명</FieldLabel>
          <input type="text" placeholder="예: 신선팜" value={data.farmName} onChange={(e) => update("farmName", e.target.value)} style={inputStyle} />
          {errors.farmName && <ErrorText text={errors.farmName} />}
        </div>
        <div>
          <FieldLabel required>지역</FieldLabel>
          <input type="text" placeholder="예: 경기 이천" value={data.region} onChange={(e) => update("region", e.target.value)} style={inputStyle} />
          {errors.region && <ErrorText text={errors.region} />}
        </div>
        <div>
          <FieldLabel required>제안 단가 (원/kg)</FieldLabel>
          <input type="number" min={0} value={data.price} onChange={(e) => update("price", e.target.value)} style={inputStyle} />
          {errors.price && <ErrorText text={errors.price} />}
        </div>
        <div>
          <FieldLabel required>가능 수량 (kg)</FieldLabel>
          <input type="number" min={0} value={data.availableQty} onChange={(e) => update("availableQty", e.target.value)} style={inputStyle} />
          {errors.availableQty && <ErrorText text={errors.availableQty} />}
        </div>
        <div>
          <FieldLabel required>납품 가능일</FieldLabel>
          <input type="date" min={new Date().toISOString().split("T")[0]} value={data.availableDate} onChange={(e) => update("availableDate", e.target.value)} style={inputStyle} />
          {errors.availableDate && <ErrorText text={errors.availableDate} />}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>보유 인증</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {CERT_OPTIONS.map((c) => (
              <Chip key={c} label={c} active={data.cert === c} onClick={() => update("cert", c)} />
            ))}
          </div>
        </div>
      </div>
      <FieldLabel>셰프에게 전할 메시지 (선택)</FieldLabel>
      <textarea
        rows={2} placeholder="예: 요청하신 라이트레드 단계로 수확 가능합니다"
        value={data.message} onChange={(e) => update("message", e.target.value)}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleSubmit} style={{ flex: 1, padding: "10px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          제안 보내기
        </button>
        <button onClick={onCancel} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, color: TOKENS.inkSoft, fontSize: 13, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "smart", label: "내 전문 품목 우선" },
  { value: "latest", label: "최신순" },
  { value: "priceAsc", label: "단가 낮은순" },
  { value: "priceDesc", label: "단가 높은순" },
  { value: "proposals", label: "제안 많은순" },
];

function MyProposalsScreen({ deals, userName, onOpenChat, onCancelProposal }) {
  const isMobile = useIsMobile();
  const [cancellingId, setCancellingId] = useState(null);
  const myItems = [];
  for (const deal of deals) {
    const proposal = deal.proposals.find((p) => p.farmerName === userName);
    if (proposal) myItems.push({ deal, proposal });
  }
  myItems.sort((a, b) => b.proposal.createdAt - a.proposal.createdAt);

  if (myItems.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 40, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
          아직 보낸 제안이 없습니다.<br />
          <span style={{ fontSize: 12, marginTop: 6, display: "block" }}>딜 찾기에서 마음에 드는 딜에 제안을 보내보세요.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>
        총 {myItems.length}건의 제안
      </div>
      {myItems.map(({ deal, proposal }) => {
        const isSelected = deal.selectedProposalId === proposal.id;
        const isRejected = deal.selectedProposalId && !isSelected;
        const isClosed = deal.status === "closed";
        const statusLabel = isSelected ? "선택됨" : isRejected ? "미선택" : isClosed ? "마감됨" : "검토 중";
        const statusColor = isSelected ? TOKENS.moss : isRejected ? TOKENS.inkSoft : isClosed ? TOKENS.rust : "#B45309";
        const statusBg = isSelected ? TOKENS.mossSoft : isRejected ? TOKENS.line : isClosed ? TOKENS.rustSoft : "#FEF3C7";

        return (
          <div key={proposal.id} style={{ background: TOKENS.card, border: `1px solid ${isSelected ? TOKENS.moss : TOKENS.line}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: TOKENS.ink }}>{deal.crop}</span>
                <span style={{ fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{deal.chefName}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: statusBg, color: statusColor }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ background: "#F8F8F6", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginBottom: 2 }}>내 제안가</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>{proposal.price.toLocaleString()}원/kg</div>
              </div>
              <div style={{ background: "#F8F8F6", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginBottom: 2 }}>제안 수량</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>{proposal.availableQty}kg</div>
              </div>
              <div style={{ background: "#F8F8F6", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginBottom: 2 }}>셰프 희망가</div>
                <div style={{ fontSize: 14, color: TOKENS.inkSoft }}>{deal.targetPrice.toLocaleString()}원/kg</div>
              </div>
              <div style={{ background: "#F8F8F6", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginBottom: 2 }}>납품 가능일</div>
                <div style={{ fontSize: 14, color: TOKENS.inkSoft }}>{proposal.availableDate || "-"}</div>
              </div>
            </div>
            {proposal.message && (
              <p style={{ fontSize: 12, color: TOKENS.inkSoft, margin: "0 0 8px", fontStyle: "italic" }}>"{proposal.message}"</p>
            )}
            <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: (isSelected || deal.status === "open" || proposal.ratedAt) ? 10 : 0 }}>
              제안일 {new Date(proposal.createdAt).toLocaleDateString("ko-KR")} · 셰프 희망 납품일 {deal.deliveryDate}
            </div>
            {proposal.ratedAt && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isSelected ? 10 : 0, background: TOKENS.goldSoft, borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ fontSize: 11, color: "#7A5C20" }}>받은 평점</span>
                <StarRating value={proposal.rating} size={14} />
                <span style={{ fontSize: 12, color: "#7A5C20", fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.rating.toFixed(1)}</span>
                {proposal.review && <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>· "{proposal.review}"</span>}
              </div>
            )}
            {deal.status === "open" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isSelected ? 10 : 0 }}>
                {cancellingId === proposal.id ? (
                  <>
                    <span style={{ fontSize: 12, color: TOKENS.rust }}>제안을 취소하시겠어요?</span>
                    <button
                      onClick={() => { onCancelProposal(deal.id, proposal.id); setCancellingId(null); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: TOKENS.rust, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                    >
                      취소 확인
                    </button>
                    <button
                      onClick={() => setCancellingId(null)}
                      style={{ fontSize: 12, padding: "4px 10px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 6, color: TOKENS.inkSoft, cursor: "pointer" }}
                    >
                      돌아가기
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setCancellingId(proposal.id)}
                    style={{ fontSize: 12, padding: "4px 12px", background: "transparent", border: `1px solid ${TOKENS.rustSoft}`, borderRadius: 6, color: TOKENS.rust, cursor: "pointer" }}
                  >
                    제안 취소
                  </button>
                )}
              </div>
            )}
            {isSelected && (
              <button
                onClick={() => onOpenChat({ dealId: deal.id, crop: deal.crop, chefName: deal.chefName, farmName: proposal.farmName })}
                style={{ width: "100%", padding: "9px 0", background: TOKENS.mossSoft, color: TOKENS.moss, border: `1px solid ${TOKENS.moss}44`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                💬 {deal.chefName}과 채팅
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DealBrowseScreen({ deals, onSubmitProposal, farmProfile, userName }) {
  const [openFormId, setOpenFormId] = useState(null);
  const [search, setSearch] = useState("");
  const [cropFilter, setCropFilter] = useState("전체");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const hasSpecialty = (farmProfile?.specialty?.length ?? 0) > 0;
  const [sortBy, setSortBy] = useState(hasSpecialty ? "smart" : "latest");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [regionFilter, setRegionFilter] = useState("전체");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [qtyMin, setQtyMin] = useState("");
  const [qtyMax, setQtyMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const isMobile = useIsMobile();

  const specialty = new Set(farmProfile?.specialty ?? []);
  const openDeals = deals.filter((d) => d.status === "open");
  const regionOptions = ["전체", ...Array.from(new Set(openDeals.map((d) => d.chefRegion).filter(Boolean))).sort()];

  const filtered = openDeals
    .filter((d) => {
      if (cropFilter !== "전체" && d.crop !== cropFilter) return false;
      if (gradeFilter !== "전체" && d.grade !== gradeFilter) return false;
      if (regionFilter !== "전체" && d.chefRegion !== regionFilter) return false;
      if (dateFrom && d.deliveryDate < dateFrom) return false;
      if (dateTo && d.deliveryDate > dateTo) return false;
      if (qtyMin && d.quantity < Number(qtyMin)) return false;
      if (qtyMax && d.quantity > Number(qtyMax)) return false;
      if (priceMin && d.targetPrice < Number(priceMin)) return false;
      if (priceMax && d.targetPrice > Number(priceMax)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          d.crop.toLowerCase().includes(q) ||
          d.chefName.toLowerCase().includes(q) ||
          (d.note || "").toLowerCase().includes(q) ||
          d.sizeCondition.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "smart") {
        const aMatch = specialty.has(a.crop) ? 0 : 1;
        const bMatch = specialty.has(b.crop) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return b.createdAt - a.createdAt;
      }
      if (sortBy === "priceAsc") return a.targetPrice - b.targetPrice;
      if (sortBy === "priceDesc") return b.targetPrice - a.targetPrice;
      if (sortBy === "proposals") return b.proposals.length - a.proposals.length;
      return b.createdAt - a.createdAt;
    });

  const hasAdvanced = dateFrom || dateTo || qtyMin || qtyMax || priceMin || priceMax;
  const hasFilters = search || cropFilter !== "전체" || gradeFilter !== "전체" || regionFilter !== "전체" || sortBy !== (hasSpecialty ? "smart" : "latest") || hasAdvanced;
  const resetFilters = () => {
    setSearch(""); setCropFilter("전체"); setGradeFilter("전체"); setRegionFilter("전체"); setSortBy(hasSpecialty ? "smart" : "latest");
    setDateFrom(""); setDateTo(""); setQtyMin(""); setQtyMax(""); setPriceMin(""); setPriceMax("");
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* 검색창 */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TOKENS.inkSoft, fontSize: 14, pointerEvents: "none" }}>
          ⌕
        </span>
        <input
          type="text"
          placeholder="품목, 레스토랑명, 요청사항으로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 34, fontSize: 13 }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft, fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      {/* 필터 행 */}
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 10, padding: isMobile ? "10px 10px" : "12px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 28 }}>품목</span>
          {["전체", ...CROP_OPTIONS].map((c) => (
            <button
              key={c}
              onClick={() => setCropFilter(c)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                border: `1px solid ${cropFilter === c ? TOKENS.moss : TOKENS.line}`,
                background: cropFilter === c ? TOKENS.mossSoft : "#FFFFFF",
                color: cropFilter === c ? TOKENS.moss : TOKENS.inkSoft,
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {regionOptions.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 28 }}>지역</span>
            {regionOptions.map((r) => (
              <button key={r} onClick={() => setRegionFilter(r)} style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                border: `1px solid ${regionFilter === r ? TOKENS.rust : TOKENS.line}`,
                background: regionFilter === r ? TOKENS.rustSoft : "#FFFFFF",
                color: regionFilter === r ? TOKENS.rust : TOKENS.inkSoft,
              }}>
                {r}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 6 }}>
          <span style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 28 }}>등급</span>
          {["전체", ...GRADE_LEVELS].map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                border: `1px solid ${gradeFilter === g ? TOKENS.gold : TOKENS.line}`,
                background: gradeFilter === g ? TOKENS.goldSoft : "#FFFFFF",
                color: gradeFilter === g ? "#7A5C20" : TOKENS.inkSoft,
              }}
            >
              {g === "전체" ? g : `${g}등급`}
            </button>
          ))}

          {!isMobile && <div style={{ flex: 1 }} />}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ ...inputStyle, width: "auto", fontSize: 12, padding: "4px 10px", color: TOKENS.inkSoft }}
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* 상세 필터 토글 */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          style={{ alignSelf: "flex-start", fontSize: 11, color: hasAdvanced ? TOKENS.moss : TOKENS.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
        >
          {showAdvanced ? "▲" : "▼"} 상세 필터{hasAdvanced ? " (적용 중)" : ""}
        </button>

        {showAdvanced && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, paddingTop: 4, borderTop: `1px solid ${TOKENS.line}` }}>
            <div>
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>납품일</div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "4px 6px", flex: 1 }} />
                <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>~</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "4px 6px", flex: 1 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>수량 (kg)</div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="number" min={0} placeholder="최소" value={qtyMin} onChange={(e) => setQtyMin(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "4px 8px", flex: 1 }} />
                <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>~</span>
                <input type="number" min={0} placeholder="최대" value={qtyMax} onChange={(e) => setQtyMax(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "4px 8px", flex: 1 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>단가 (원/kg)</div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="number" min={0} placeholder="최소" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "4px 8px", flex: 1 }} />
                <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>~</span>
                <input type="number" min={0} placeholder="최대" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "4px 8px", flex: 1 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 결과 수 + 초기화 */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <span style={{ fontSize: 12, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
          {filtered.length}건 / 전체 {openDeals.length}건
        </span>
        {hasFilters && (
          <button
            onClick={resetFilters}
            style={{ fontSize: 11, color: TOKENS.rust, background: "none", border: `1px solid ${TOKENS.rustSoft}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 딜 목록 */}
      {filtered.length === 0 ? (
        <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 32, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
          {openDeals.length === 0 ? "현재 모집 중인 딜이 없습니다." : "검색 조건에 맞는 딜이 없습니다."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((deal) => {
            const isMySpecialty = specialty.has(deal.crop);
            return (
            <div key={deal.id} style={{ background: TOKENS.card, border: `1px solid ${isMySpecialty ? TOKENS.moss : TOKENS.line}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: TOKENS.ink }}>{deal.crop}</span>
                  {isMySpecialty && (
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: TOKENS.moss, background: TOKENS.mossSoft, border: `1px solid ${TOKENS.moss}44`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>
                      내 전문 품목
                    </span>
                  )}
                </div>
                <StatusBadge status={deal.status} />
              </div>
              <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 2 }}>
                {deal.chefName}{deal.chefRegion ? ` · ${deal.chefRegion}` : ""} · 희망단가 {deal.targetPrice.toLocaleString()}원/kg · {deal.quantity}kg
              </div>
              <DealSummaryRow deal={deal} />
              {deal.note && <p style={{ fontSize: 12, color: TOKENS.inkSoft, marginBottom: 10 }}>"{deal.note}"</p>}
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 10 }}>
                희망 납품일 {deal.deliveryDate} · 들어온 제안 {deal.proposals.length}건
              </div>
              {(() => {
                const myProposal = deal.proposals.find(p => p.farmerName === userName);
                if (myProposal) {
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: TOKENS.mossSoft, borderRadius: 8, fontSize: 13 }}>
                      <span style={{ color: TOKENS.moss, fontWeight: 500 }}>✓ 제안 완료</span>
                      <span style={{ color: TOKENS.inkSoft }}>제안가 {myProposal.price.toLocaleString()}원/kg · {myProposal.availableQty}kg</span>
                      {deal.selectedProposalId === myProposal.id
                        ? <span style={{ marginLeft: "auto", color: TOKENS.moss, fontWeight: 600 }}>🎉 선택됨</span>
                        : deal.selectedProposalId
                        ? <span style={{ marginLeft: "auto", color: TOKENS.inkSoft }}>미선택</span>
                        : <span style={{ marginLeft: "auto", color: TOKENS.inkSoft }}>검토 중</span>}
                    </div>
                  );
                }
                if (openFormId === deal.id) {
                  return (
                    <ProposalForm
                      deal={deal}
                      onSubmit={(id, proposal) => { onSubmitProposal(id, proposal); setOpenFormId(null); }}
                      onCancel={() => setOpenFormId(null)}
                      farmProfile={farmProfile}
                      farmerName={userName}
                    />
                  );
                }
                return (
                  <button
                    onClick={() => setOpenFormId(deal.id)}
                    style={{ padding: "8px 16px", background: TOKENS.moss, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                  >
                    이 딜에 제안 보내기
                  </button>
                );
              })()}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- 3. 내 거래 (셰프가 제안 비교 후 선택) ---------- */

function ProposalCard({ proposal, deal, onSelect, isSelected, selectable }) {
  const priceDiff = proposal.price - deal.targetPrice;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${isSelected ? TOKENS.moss : TOKENS.line}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: TOKENS.ink }}>{proposal.farmName}</span>
        <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>{proposal.region}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 8px" }}>
        <span style={chipBadge(TOKENS.goldSoft, "#7A5C20")}>
          {proposal.price.toLocaleString()}원/kg
          {priceDiff !== 0 && (
            <span style={{ marginLeft: 4 }}>({priceDiff > 0 ? "+" : ""}{priceDiff.toLocaleString()})</span>
          )}
        </span>
        <span style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{proposal.cert}</span>
        <span style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>납품가능일 {proposal.availableDate || "-"}</span>
        <span style={chipBadge(TOKENS.line, TOKENS.inkSoft)}>가능수량 {proposal.availableQty}kg</span>
        {proposal.ratedAt && (
          <span style={chipBadge(TOKENS.goldSoft, "#7A5C20")}>★ {proposal.rating.toFixed(1)}</span>
        )}
      </div>
      {proposal.message && (
        <p style={{ fontSize: 12, color: TOKENS.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>"{proposal.message}"</p>
      )}
      {selectable && (
        <button
          onClick={() => onSelect(proposal.id)}
          style={{
            padding: "7px 14px", background: isSelected ? TOKENS.moss : TOKENS.ink, color: TOKENS.bg,
            border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}
        >
          {isSelected ? "선택됨" : "이 농가 선택하기"}
        </button>
      )}
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function SettlementCard({ deal, proposal }) {
  const total = proposal.price * deal.quantity;
  const fee = Math.round(total * FEE_RATE);
  const deposit = Math.round(total * DEPOSIT_RATE);
  const balance = total - deposit;
  const netToFarm = total - fee;
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
        정산 내역
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TOKENS.ink, marginBottom: 6 }}>
        <span>총 계약금액 ({proposal.farmName} · {deal.quantity}kg × {proposal.price.toLocaleString()}원)</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{total.toLocaleString()}원</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TOKENS.inkSoft, marginBottom: 6 }}>
        <span>선급금 ({Math.round(DEPOSIT_RATE * 100)}%, 딜 확정 시)</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{deposit.toLocaleString()}원</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TOKENS.inkSoft, marginBottom: 6 }}>
        <span>잔금 ({Math.round((1 - DEPOSIT_RATE) * 100)}%, 납품 검수 후)</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{balance.toLocaleString()}원</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TOKENS.rust, marginBottom: 6 }}>
        <span>플랫폼 수수료 ({Math.round(FEE_RATE * 100)}%)</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>-{fee.toLocaleString()}원</span>
      </div>
      <div style={{ height: 1, background: TOKENS.line, margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: TOKENS.ink, fontWeight: 500 }}>
        <span>농가 실수령액</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{netToFarm.toLocaleString()}원</span>
      </div>
    </div>
  );
}

function DealTimeline({ deal }) {
  const firstProposalAt = deal.proposals.length > 0
    ? Math.min(...deal.proposals.map((p) => p.createdAt))
    : null;
  const selectedProposal = deal.proposals.find((p) => p.id === deal.selectedProposalId);
  const isClosed = deal.status === "closed";
  const isDone = deal.status === "done";
  const isMatched = deal.status === "matched";
  const hasSelected = isDone || isMatched;

  const steps = [
    {
      label: "딜 등록",
      sub: `${deal.chefName} · ${deal.crop} ${deal.quantity}kg`,
      done: true,
      current: deal.status === "open" && deal.proposals.length === 0,
      at: deal.createdAt,
    },
    {
      label: isClosed && !firstProposalAt ? "제안 없이 마감" : "농가 제안 도착",
      sub: firstProposalAt
        ? `총 ${deal.proposals.length}건 접수`
        : isClosed ? "모집 기간 내 제안 없음" : "제안 대기 중",
      done: !!firstProposalAt || isClosed,
      current: deal.status === "open" && deal.proposals.length > 0,
      at: firstProposalAt,
    },
    {
      label: isClosed ? "딜 마감" : "농가 선택 완료",
      sub: isClosed
        ? (deal.closeReason === "expired" ? "납품일 만료로 자동 마감" : "셰프가 직접 마감")
        : selectedProposal
        ? `${selectedProposal.farmName} · ${selectedProposal.price.toLocaleString()}원/kg`
        : "제안 검토 중",
      done: hasSelected || isClosed,
      current: deal.status === "open" && deal.proposals.length > 0 && !hasSelected,
      at: isClosed ? deal.closedAt : deal.selectedAt,
    },
    ...(!isClosed ? [{
      label: "납품 희망일",
      sub: deal.deliveryDate,
      done: isDone,
      current: isMatched,
      at: isDone ? deal.completedAt : null,
      isDelivery: true,
    },
    {
      label: "납품 · 정산 완료",
      sub: isDone && selectedProposal
        ? `총 ${(selectedProposal.price * deal.quantity).toLocaleString()}원 정산`
        : "납품 확인 후 완료 처리",
      done: isDone,
      current: false,
      at: deal.completedAt,
    }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((s, i) => {
        const dotColor = s.done ? TOKENS.moss : s.current ? TOKENS.gold : TOKENS.line;
        const dotSize = s.current ? 12 : 10;
        return (
          <div key={s.label} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: dotSize, height: dotSize, borderRadius: "50%",
                background: dotColor,
                marginTop: 4,
                boxShadow: s.current ? `0 0 0 3px ${TOKENS.goldSoft}` : "none",
                flexShrink: 0,
              }} />
              {i < steps.length - 1 && (
                <div style={{ width: 1, flex: 1, minHeight: 24, background: s.done ? TOKENS.moss + "55" : TOKENS.line }} />
              )}
            </div>
            <div style={{ paddingBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: s.current ? 500 : 400, color: s.done || s.current ? TOKENS.ink : TOKENS.inkSoft }}>
                {s.label}
              </div>
              {s.sub && (
                <div style={{ fontSize: 11, color: s.done ? TOKENS.inkSoft : s.current ? "#7A5C20" : TOKENS.line, fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>
                  {s.sub}
                </div>
              )}
              {s.at && (
                <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                  {s.isDelivery ? s.sub : fmtDateTime(s.at)}
                </div>
              )}
              {!s.at && s.isDelivery && (
                <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                  {deal.deliveryDate}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_FILTERS = [
  { key: "전체", label: "전체" },
  { key: "open", label: "모집중" },
  { key: "matched", label: "진행중" },
  { key: "done", label: "완료" },
  { key: "closed", label: "마감" },
];

function MyDealsScreen({ deals, onSelectProposal, onCompleteDeal, onOpenChat, onEdit, onDelete, onClose, onRateProposal, onClone }) {
  const [expandedId, setExpandedId] = useState(deals[0]?.id ?? null);
  const [deletingId, setDeletingId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("전체");

  if (deals.length === 0) {
    return (
      <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 32, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
        아직 등록한 딜이 없습니다. "딜 만들기" 탭에서 첫 요청서를 작성해보세요.
      </div>
    );
  }

  const sorted = [...deals].sort((a, b) => b.createdAt - a.createdAt);
  const filtered = statusFilter === "전체" ? sorted : sorted.filter((d) => d.status === statusFilter);

  const countByStatus = { open: 0, matched: 0, done: 0, closed: 0 };
  deals.forEach((d) => { if (countByStatus[d.status] !== undefined) countByStatus[d.status]++; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720, margin: "0 auto" }}>
      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => {
          const count = f.key === "전체" ? deals.length : countByStatus[f.key];
          const isActive = statusFilter === f.key;
          const activeColor = f.key === "open" ? TOKENS.gold : f.key === "matched" ? TOKENS.moss : f.key === "done" ? TOKENS.inkSoft : f.key === "closed" ? TOKENS.rust : TOKENS.ink;
          const activeBg = f.key === "open" ? TOKENS.goldSoft : f.key === "matched" ? TOKENS.mossSoft : f.key === "done" ? TOKENS.line : f.key === "closed" ? TOKENS.rustSoft : `${TOKENS.ink}18`;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                border: `1px solid ${isActive ? activeColor : TOKENS.line}`,
                background: isActive ? activeBg : "#FFFFFF",
                color: isActive ? activeColor : TOKENS.inkSoft,
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {f.label}
              <span style={{ marginLeft: 6, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 24, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
          {STATUS_FILTERS.find((f) => f.key === statusFilter)?.label} 딜이 없습니다.
        </div>
      )}
      {filtered.map((deal) => {
        const expanded = expandedId === deal.id;
        const sortedProposals = [...deal.proposals].sort((a, b) => a.price - b.price);
        const selectedProposal = deal.proposals.find((p) => p.id === deal.selectedProposalId);
        return (
          <div key={deal.id} style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 18 }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", cursor: "pointer" }}
              onClick={() => setExpandedId(expanded ? null : deal.id)}
            >
              <div>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: TOKENS.ink }}>{deal.crop}</span>
                <span style={{ fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{deal.chefName}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {deal.closeReason === "expired" && (
                  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: TOKENS.rust, background: TOKENS.rustSoft, border: `1px solid ${TOKENS.rust}44`, borderRadius: 4, padding: "1px 6px" }}>
                    납품일 만료
                  </span>
                )}
                <StatusBadge status={deal.status} />
              </div>
            </div>
            <DealSummaryRow deal={deal} />
            <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginBottom: 6 }}>
              희망단가 {deal.targetPrice.toLocaleString()}원/kg · {deal.quantity}kg · 납품일 {deal.deliveryDate} · 받은 제안 {deal.proposals.length}건
            </div>
            {deal.status !== "open" && (
              <div style={{ marginBottom: expanded ? 12 : 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onClone(deal); }}
                  style={{ fontSize: 12, padding: "4px 12px", background: "transparent", border: `1px solid ${TOKENS.moss}`, borderRadius: 6, color: TOKENS.moss, cursor: "pointer" }}
                >
                  ⎘ 이 딜 복제하기
                </button>
              </div>
            )}
            {deal.status === "open" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: expanded ? 12 : 0, flexWrap: "wrap" }}>
                {closingId === deal.id ? (
                  <>
                    <span style={{ fontSize: 12, color: TOKENS.rust }}>모집을 마감하시겠어요?{deal.proposals.length > 0 ? ` (들어온 제안 ${deal.proposals.length}건은 미선택 처리됩니다)` : ""}</span>
                    <button
                      onClick={() => { onClose(deal.id); setClosingId(null); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: TOKENS.rust, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                    >
                      마감 확인
                    </button>
                    <button
                      onClick={() => setClosingId(null)}
                      style={{ fontSize: 12, padding: "4px 10px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 6, color: TOKENS.inkSoft, cursor: "pointer" }}
                    >
                      취소
                    </button>
                  </>
                ) : deletingId === deal.id ? (
                  <>
                    <span style={{ fontSize: 12, color: TOKENS.rust }}>정말 삭제하시겠어요?{deal.proposals.length > 0 ? ` (제안 ${deal.proposals.length}건도 함께 삭제됩니다)` : ""}</span>
                    <button
                      onClick={() => { onDelete(deal.id); setDeletingId(null); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: TOKENS.rust, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                    >
                      삭제 확인
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      style={{ fontSize: 12, padding: "4px 10px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 6, color: TOKENS.inkSoft, cursor: "pointer" }}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 6, color: TOKENS.ink, cursor: "pointer" }}
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClone(deal); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: "transparent", border: `1px solid ${TOKENS.moss}`, borderRadius: 6, color: TOKENS.moss, cursor: "pointer" }}
                    >
                      복제
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setClosingId(deal.id); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: "transparent", border: `1px solid ${TOKENS.gold}`, borderRadius: 6, color: "#7A5C20", cursor: "pointer" }}
                    >
                      마감
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(deal.id); }}
                      style={{ fontSize: 12, padding: "4px 12px", background: "transparent", border: `1px solid ${TOKENS.rustSoft}`, borderRadius: 6, color: TOKENS.rust, cursor: "pointer" }}
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}

            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                    진행 현황
                  </div>
                  <DealTimeline deal={deal} />
                </div>

                {deal.status === "open" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sortedProposals.length === 0 ? (
                      <div style={{ fontSize: 12, color: TOKENS.inkSoft, padding: "4px 0" }}>
                        아직 들어온 농가 제안이 없습니다. "딜 찾기" 화면에서 농가가 제안을 보내면 여기 표시됩니다.
                      </div>
                    ) : (
                      sortedProposals.map((p) => (
                        <ProposalCard
                          key={p.id}
                          proposal={p}
                          deal={deal}
                          isSelected={false}
                          selectable
                          onSelect={(proposalId) => onSelectProposal(deal.id, proposalId)}
                        />
                      ))
                    )}
                  </div>
                )}

                {(deal.status === "matched" || deal.status === "done") && selectedProposal && (
                  <>
                    <ProposalCard proposal={selectedProposal} deal={deal} isSelected selectable={false} onSelect={() => {}} />
                    <SettlementCard deal={deal} proposal={selectedProposal} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => onOpenChat({ dealId: deal.id, crop: deal.crop, chefName: deal.chefName, farmName: selectedProposal.farmName })}
                        style={{ flex: 1, padding: "10px 0", background: TOKENS.mossSoft, color: TOKENS.moss, border: `1px solid ${TOKENS.moss}44`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                      >
                        💬 {selectedProposal.farmName}과 채팅
                      </button>
                      {deal.status === "matched" && (
                        <button
                          onClick={() => onCompleteDeal(deal.id)}
                          style={{ flex: 1, padding: "10px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                        >
                          납품 확인 후 정산 완료 처리
                        </button>
                      )}
                    </div>
                    {deal.status === "done" && (
                      selectedProposal.ratedAt ? (
                        <div style={{ background: TOKENS.goldSoft, border: `1px solid ${TOKENS.gold}44`, borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11, color: "#7A5C20", fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                            내가 남긴 평가 · {selectedProposal.farmName}
                          </div>
                          <StarRating value={selectedProposal.rating} size={16} />
                          {selectedProposal.review && (
                            <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: "6px 0 0", fontStyle: "italic" }}>"{selectedProposal.review}"</p>
                          )}
                        </div>
                      ) : (
                        <RatingPanel
                          farmName={selectedProposal.farmName}
                          onSubmit={(rating, review) => onRateProposal(deal.id, selectedProposal.id, rating, review)}
                        />
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 채팅 ---------- */

function ChatScreen({ dealInfo, userName, userRole, messages, onSend, onBack }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  const partnerName = userRole === "chef" ? dealInfo.farmName : dealInfo.chefName;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack}
          style={{ background: "none", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: TOKENS.inkSoft }}>
          ← 뒤로
        </button>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink }}>{dealInfo.crop} 딜 채팅</div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft }}>{partnerName}와의 대화</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: isMobile ? "12px 10px" : "16px", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 12, marginBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: TOKENS.inkSoft, fontSize: 13, padding: "40px 0" }}>
            매칭이 완료되었습니다!<br />
            <span style={{ fontSize: 12, marginTop: 4, display: "block" }}>납품 세부사항을 조율해보세요.</span>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderName === userName;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {!isMe && <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 3 }}>{m.senderName}</div>}
              <div style={{
                maxWidth: isMobile ? "85%" : "65%",
                padding: "9px 14px",
                borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: isMe ? TOKENS.ink : "#FFFFFF",
                color: isMe ? TOKENS.bg : TOKENS.ink,
                fontSize: 14,
                lineHeight: 1.5,
                border: isMe ? "none" : `1px solid ${TOKENS.line}`,
              }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginTop: 3 }}>
                {new Date(m.ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="메시지를 입력하세요… (Enter로 전송)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          style={{ padding: "10px 18px", background: text.trim() ? TOKENS.ink : TOKENS.line, color: text.trim() ? TOKENS.bg : TOKENS.inkSoft, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: text.trim() ? "pointer" : "default", whiteSpace: "nowrap" }}
        >
          전송
        </button>
      </div>
    </div>
  );
}

/* ---------- 4-0. 내 레스토랑 (셰프) ---------- */

function ChefProfileScreen({ profile, onSave, defaultRestaurantName = "" }) {
  const blank = { restaurantName: defaultRestaurantName, region: "", description: "", preferCrops: [], preferGrade: "전체", preferCycle: "전체" };
  const [data, setData] = useState(profile || blank);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const isMobile = useIsMobile();

  const update = (key, value) => { setData((d) => ({ ...d, [key]: value })); setSaved(false); };
  const toggleCrop = (crop) => {
    setData((d) => ({
      ...d,
      preferCrops: d.preferCrops.includes(crop)
        ? d.preferCrops.filter((c) => c !== crop)
        : [...d.preferCrops, crop],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    const nextErrors = {};
    if (!data.restaurantName) nextErrors.restaurantName = "레스토랑명을 입력해주세요";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) { onSave(data); setSaved(true); }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? 14 : 24 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
        내 레스토랑 정보
      </h2>
      <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: "0 0 20px", lineHeight: 1.6 }}>
        저장하면 농가에게 레스토랑 정보가 표시되고, 딜 작성 시 자동으로 불러옵니다.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <FieldLabel required>레스토랑명</FieldLabel>
          <input type="text" placeholder="예: 테이블나인" value={data.restaurantName} onChange={(e) => update("restaurantName", e.target.value)} style={inputStyle} />
          {errors.restaurantName && <ErrorText text={errors.restaurantName} />}
        </div>
        <div>
          <FieldLabel>지역</FieldLabel>
          <input type="text" placeholder="예: 서울 강남" value={data.region} onChange={(e) => update("region", e.target.value)} style={inputStyle} />
        </div>
      </div>

      <FieldLabel>선호 품목 (복수 선택 가능)</FieldLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, marginBottom: 14 }}>
        {CROP_OPTIONS.map((c) => (
          <Chip key={c} label={c} active={data.preferCrops.includes(c)} onClick={() => toggleCrop(c)} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <FieldLabel>선호 등급</FieldLabel>
          <select value={data.preferGrade} onChange={(e) => update("preferGrade", e.target.value)} style={inputStyle}>
            {["전체", ...GRADE_LEVELS].map((g) => <option key={g} value={g}>{g === "전체" ? "무관" : `${g}등급`}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>주요 납품 주기</FieldLabel>
          <select value={data.preferCycle} onChange={(e) => update("preferCycle", e.target.value)} style={inputStyle}>
            {["전체", ...CYCLE_OPTIONS].map((c) => <option key={c} value={c}>{c === "전체" ? "무관" : c}</option>)}
          </select>
        </div>
      </div>

      <FieldLabel>레스토랑 소개 (선택)</FieldLabel>
      <textarea
        rows={3}
        placeholder="예: 제철 식재료를 활용한 파인다이닝 레스토랑입니다. 주 1회 정기 납품을 선호합니다."
        value={data.description}
        onChange={(e) => update("description", e.target.value)}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif" }}
      />

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={handleSave} style={{ padding: "11px 24px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          저장하기
        </button>
        {saved && <span style={{ fontSize: 13, color: TOKENS.moss }}>✓ 저장됐습니다</span>}
      </div>

      {(data.restaurantName || data.preferCrops.length > 0) && (
        <div style={{ marginTop: 20, background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            미리보기
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink, marginBottom: 6 }}>
            {data.restaurantName || "—"}
            {data.region && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{data.region}</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: data.description ? 8 : 0 }}>
            {data.preferGrade !== "전체" && <span style={chipBadge(TOKENS.goldSoft, "#7A5C20")}>{data.preferGrade}등급 선호</span>}
            {data.preferCycle !== "전체" && <span style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>{data.preferCycle}</span>}
            {data.preferCrops.map((c) => <span key={c} style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{c}</span>)}
          </div>
          {data.description && <p style={{ fontSize: 12, color: TOKENS.inkSoft, margin: 0, lineHeight: 1.6 }}>"{data.description}"</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- 4. 내 농가 등록 ---------- */

function FarmProfileScreen({ profile, onSave, defaultFarmName = "", deals = [], userName = "" }) {
  const blank = { farmName: defaultFarmName, region: "", cert: "인증 없음", specialty: [], description: "", leadTimeDays: "" };
  const [data, setData] = useState(profile || blank);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const isMobile = useIsMobile();

  const ratedProposals = deals.flatMap((d) =>
    d.proposals.filter((p) => p.farmerName === userName && p.ratedAt)
  );
  const avgRating = ratedProposals.length > 0
    ? ratedProposals.reduce((sum, p) => sum + p.rating, 0) / ratedProposals.length
    : null;

  const update = (key, value) => { setData((d) => ({ ...d, [key]: value })); setSaved(false); };
  const toggleSpecialty = (crop) => {
    setData((d) => ({
      ...d,
      specialty: d.specialty.includes(crop)
        ? d.specialty.filter((c) => c !== crop)
        : [...d.specialty, crop],
    }));
    setSaved(false);
  };

  const handleSave = () => {
    const nextErrors = {};
    if (!data.farmName) nextErrors.farmName = "농가명을 입력해주세요";
    if (!data.region) nextErrors.region = "지역을 입력해주세요";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      onSave(data);
      setSaved(true);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? 14 : 24 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: TOKENS.ink, margin: "0 0 4px" }}>
        내 농가 정보
      </h2>
      <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: "0 0 16px", lineHeight: 1.6 }}>
        저장해두면 제안서 작성 시 자동으로 불러올 수 있습니다.
      </p>

      {avgRating !== null ? (
        <div style={{ background: TOKENS.goldSoft, border: `1px solid ${TOKENS.gold}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: "#7A5C20", lineHeight: 1 }}>
              {avgRating.toFixed(1)}
            </div>
            <StarRating value={avgRating} size={14} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#7A5C20" }}>누적 평균 평점</div>
            <div style={{ fontSize: 11, color: "#7A5C20", opacity: 0.7, marginTop: 2 }}>
              총 {ratedProposals.length}건의 거래 후기
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: TOKENS.inkSoft }}>
          거래가 완료되고 셰프가 평가를 남기면 평점이 표시됩니다.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div>
          <FieldLabel required>농가명</FieldLabel>
          <input type="text" placeholder="예: 신선팜" value={data.farmName} onChange={(e) => update("farmName", e.target.value)} style={inputStyle} />
          {errors.farmName && <ErrorText text={errors.farmName} />}
        </div>
        <div>
          <FieldLabel required>지역</FieldLabel>
          <input type="text" placeholder="예: 경기 이천" value={data.region} onChange={(e) => update("region", e.target.value)} style={inputStyle} />
          {errors.region && <ErrorText text={errors.region} />}
        </div>
      </div>

      <FieldLabel>보유 인증</FieldLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {CERT_OPTIONS.map((c) => (
          <Chip key={c} label={c} active={data.cert === c} onClick={() => update("cert", c)} />
        ))}
      </div>

      <FieldLabel>주요 재배 품목 (복수 선택 가능)</FieldLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {CROP_OPTIONS.map((c) => (
          <Chip key={c} label={c} active={data.specialty.includes(c)} onClick={() => toggleSpecialty(c)} />
        ))}
      </div>

      <FieldLabel>기본 납품 리드타임 (일)</FieldLabel>
      <input
        type="number" min={0} placeholder="예: 2"
        value={data.leadTimeDays} onChange={(e) => update("leadTimeDays", e.target.value)}
        style={{ ...inputStyle, maxWidth: 160 }}
      />

      <FieldLabel>농가 소개 (선택)</FieldLabel>
      <textarea
        rows={3}
        placeholder="예: 충북 음성에서 20년간 토마토를 재배해온 농가입니다. 당일 수확 후 새벽 배송 가능합니다."
        value={data.description}
        onChange={(e) => update("description", e.target.value)}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "'IBM Plex Sans', sans-serif" }}
      />

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={handleSave}
          style={{ padding: "11px 24px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
        >
          저장하기
        </button>
        {saved && <span style={{ fontSize: 13, color: TOKENS.moss }}>✓ 저장됐습니다</span>}
      </div>

      {(data.farmName || data.specialty.length > 0) && (
        <div style={{ marginTop: 20, background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            미리보기
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink }}>
              {data.farmName || "—"}
            </span>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: TOKENS.inkSoft }}>{data.region}</span>
            {avgRating !== null && (
              <span style={{ fontSize: 12, color: "#7A5C20", marginLeft: "auto" }}>★ {avgRating.toFixed(1)} ({ratedProposals.length}건)</span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: data.description ? 8 : 0 }}>
            {data.cert && data.cert !== "인증 없음" && <span style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{data.cert}</span>}
            {data.specialty.map((c) => <span key={c} style={chipBadge(TOKENS.goldSoft, "#7A5C20")}>{c}</span>)}
            {data.leadTimeDays && <span style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>리드타임 {data.leadTimeDays}일</span>}
          </div>
          {data.description && <p style={{ fontSize: 12, color: TOKENS.inkSoft, margin: 0, lineHeight: 1.6 }}>"{data.description}"</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- 5. 로그인 ---------- */

const AUTH_ERRORS = {
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/user-not-found": "등록된 계정이 없습니다. 가입 후 시작하세요.",
  "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
  "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "auth/email-already-in-use": "이미 가입된 이메일입니다. 로그인 탭을 이용하세요.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth/too-many-requests": "잠시 후 다시 시도해주세요.",
  "auth/network-request-failed": "네트워크 오류가 발생했습니다.",
};

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const handleSubmit = async () => {
    setError("");
    if (mode === "signup") {
      if (!role) { setError("역할을 선택해주세요."); return; }
      if (!email.trim()) { setError("이메일을 입력해주세요."); return; }
      if (!password) { setError("비밀번호를 입력해주세요."); return; }
      if (!displayName.trim()) { setError(role === "chef" ? "레스토랑명을 입력해주세요." : "농가명을 입력해주세요."); return; }
    } else {
      if (!email.trim()) { setError("이메일을 입력해주세요."); return; }
      if (!password) { setError("비밀번호를 입력해주세요."); return; }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await storage.set(`user-profile-${cred.user.uid}`, JSON.stringify({ role, displayName: displayName.trim() }));
        onLogin({ uid: cred.user.uid, email: cred.user.email, role, name: displayName.trim() });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const profileResult = await storage.get(`user-profile-${cred.user.uid}`);
        if (profileResult?.value) {
          const { role: savedRole, displayName: savedName } = JSON.parse(profileResult.value);
          onLogin({ uid: cred.user.uid, email: cred.user.email, role: savedRole, name: savedName });
        } else {
          setError("계정 정보를 찾을 수 없습니다. 관리자에게 문의하세요.");
          await signOut(auth);
        }
      }
    } catch (err) {
      setError(AUTH_ERRORS[err.code] || "오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" />
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: TOKENS.rust, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>
            역경매 방식 선주문 플랫폼
          </span>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: isMobile ? 26 : 32, margin: "8px 0 6px", color: TOKENS.ink }}>
            Farm-to-Table
          </h1>
          <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0 }}>
            {mode === "login" ? "이메일로 로그인하세요" : "역할을 선택하고 가입하세요"}
          </p>
        </div>

        {/* 탭 전환 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 24, border: `1px solid ${TOKENS.line}`, borderRadius: 8, overflow: "hidden" }}>
          {[{ key: "login", label: "로그인" }, { key: "signup", label: "신규 가입" }].map((m) => (
            <button key={m.key} type="button" onClick={() => { setMode(m.key); setError(""); }}
              style={{ padding: "10px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                background: mode === m.key ? TOKENS.ink : "#FFFFFF",
                color: mode === m.key ? TOKENS.bg : TOKENS.inkSoft }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* 역할 선택 (가입 시만) */}
        {mode === "signup" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { key: "chef", label: "셰프", desc: "딜 등록·제안 선택", color: TOKENS.rust, soft: TOKENS.rustSoft },
              { key: "farmer", label: "농가", desc: "딜 찾기·제안 보내기", color: TOKENS.moss, soft: TOKENS.mossSoft },
            ].map((r) => (
              <button key={r.key} type="button" onClick={() => { setRole(r.key); setError(""); }}
                style={{ padding: "20px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                  border: `2px solid ${role === r.key ? r.color : TOKENS.line}`,
                  background: role === r.key ? r.soft : "#FFFFFF", transition: "all 0.15s" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>{r.key === "chef" ? "🍳" : "🌱"}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: TOKENS.ink, marginBottom: 3 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: TOKENS.inkSoft }}>{r.desc}</div>
              </button>
            ))}
          </div>
        )}

        <FieldLabel required>이메일</FieldLabel>
        <input type="email" placeholder="example@email.com" value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          style={inputStyle} />

        <FieldLabel required>비밀번호</FieldLabel>
        <div style={{ position: "relative" }}>
          <input type={showPw ? "text" : "password"} placeholder={mode === "signup" ? "6자 이상" : "비밀번호 입력"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{ ...inputStyle, paddingRight: 44 }} />
          <button type="button" onClick={() => setShowPw((v) => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft, fontSize: 15 }}>
            {showPw ? "🙈" : "👁"}
          </button>
        </div>

        {/* 상호명 (가입 시만) */}
        {mode === "signup" && (
          <>
            <FieldLabel required>{role === "chef" ? "레스토랑명" : "농가명"} <span style={{ fontSize: 11, color: TOKENS.inkSoft, fontWeight: 400 }}>(앱에 표시되는 상호명)</span></FieldLabel>
            <input type="text" placeholder={role === "chef" ? "예: 테이블나인" : "예: 신선팜"}
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={inputStyle} />
          </>
        )}

        {error && <ErrorText text={error} />}

        <button onClick={handleSubmit} disabled={loading}
          style={{ marginTop: 14, width: "100%", padding: "13px 0", background: loading ? TOKENS.line : TOKENS.ink, color: loading ? TOKENS.inkSoft : TOKENS.bg, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: loading ? "default" : "pointer" }}>
          {loading ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
        </button>

        <p style={{ fontSize: 12, color: TOKENS.inkSoft, textAlign: "center", marginTop: 12 }}>
          로그인 상태는 자동으로 유지됩니다.
        </p>
      </div>
    </div>
  );
}

/* ---------- App shell ---------- */

export default function FarmToTableApp() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("create");
  const [deals, setDeals] = useState([]);
  const [farm, setFarm] = useState(null);
  const [chefProfile, setChefProfile] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [saveState, setSaveState] = useState("idle");
  const [chats, setChats] = useState({});
  const [chatTarget, setChatTarget] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [cloningDeal, setCloningDeal] = useState(null);
  const [lastMyDealsVisit, setLastMyDealsVisit] = useState(() => Number(localStorage.getItem("last-mydeals-visit") || 0));
  const [seenSelections, setSeenSelections] = useState(() => { try { return JSON.parse(localStorage.getItem("seen-selections") || "[]"); } catch { return []; } });
  const isMobile = useIsMobile();

  // Firebase Auth 상태 감지
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profileResult = await storage.get(`user-profile-${firebaseUser.uid}`);
          if (profileResult?.value) {
            const { role, displayName } = JSON.parse(profileResult.value);
            const userData = { uid: firebaseUser.uid, email: firebaseUser.email, role, name: displayName };
            setUser(userData);
            setTab(role === "farmer" ? "browse" : "create");
          } else {
            await signOut(auth);
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 공유 데이터 로드 (auth 확인 후)
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await storage.get(DEALS_KEY, true);
        if (cancelled) return;
        if (result && result.value) {
          setDeals(JSON.parse(result.value));
        } else {
          setDeals(SAMPLE_DEALS);
          await storage.set(DEALS_KEY, JSON.stringify(SAMPLE_DEALS), true);
        }
        const farmResult = await storage.get(FARM_KEY);
        if (!cancelled && farmResult && farmResult.value) setFarm(JSON.parse(farmResult.value));
        const chefResult = await storage.get(CHEF_PROFILE_KEY);
        if (!cancelled && chefResult && chefResult.value) setChefProfile(JSON.parse(chefResult.value));
        const chatsResult = await storage.get(CHATS_KEY);
        if (!cancelled && chatsResult && chatsResult.value) setChats(JSON.parse(chatsResult.value));
        if (!cancelled) setLoadState("ready");
      } catch {
        if (cancelled) return;
        try {
          setDeals(SAMPLE_DEALS);
          await storage.set(DEALS_KEY, JSON.stringify(SAMPLE_DEALS), true);
          setLoadState("ready");
        } catch {
          setLoadState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [authChecked]);

  // 납품일 지난 모집중 딜 자동 마감
  useEffect(() => {
    if (loadState !== "ready" || deals.length === 0) return;
    const today = new Date().toISOString().split("T")[0];
    const expired = deals.filter((d) => d.status === "open" && d.deliveryDate && d.deliveryDate < today);
    if (expired.length > 0) {
      persist(deals.map((d) =>
        d.status === "open" && d.deliveryDate && d.deliveryDate < today
          ? { ...d, status: "closed", closedAt: Date.now(), closeReason: "expired" }
          : d
      ));
    }
  }, [loadState]); // eslint-disable-line react-hooks/exhaustive-deps

  // 딜·채팅 실시간 동기화
  useEffect(() => {
    if (loadState !== "ready") return;
    const unsubDeals = onSnapshot(doc(db, "storage", DEALS_KEY), (snap) => {
      if (snap.exists()) {
        try { setDeals(JSON.parse(snap.data().value)); } catch {}
      }
    });
    const unsubChats = onSnapshot(doc(db, "storage", CHATS_KEY), (snap) => {
      if (snap.exists()) {
        try { setChats(JSON.parse(snap.data().value)); } catch {}
      }
    });
    return () => { unsubDeals(); unsubChats(); };
  }, [loadState]);

  const persist = async (next) => {
    setDeals(next);
    setSaveState("saving");
    try {
      const result = await storage.set(DEALS_KEY, JSON.stringify(next), true);
      setSaveState(result ? "saved" : "error");
    } catch (err) {
      setSaveState("error");
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setTab(userData.role === "farmer" ? "browse" : "create");
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setTab("create");
    setFarm(null);
    setChefProfile(null);
  };

  const handleSaveFarm = async (farmData) => {
    setFarm(farmData);
    await storage.set(FARM_KEY, JSON.stringify(farmData));
  };

  const handleSaveChefProfile = async (profileData) => {
    setChefProfile(profileData);
    await storage.set(CHEF_PROFILE_KEY, JSON.stringify(profileData));
  };

  const handleResetData = async () => {
    await storage.set(DEALS_KEY, JSON.stringify(SAMPLE_DEALS));
    setDeals(SAMPLE_DEALS);
  };

  const handleCreateDeal = (deal) => {
    persist([{ ...deal, createdBy: user.uid || user.name }, ...deals]);
    setTab("mydeals");
  };

  const handleSubmitProposal = (dealId, proposal) => {
    const next = deals.map((d) =>
      d.id === dealId ? { ...d, proposals: [...d.proposals, proposal] } : d
    );
    persist(next);
  };

  const handleSelectProposal = (dealId, proposalId) => {
    const next = deals.map((d) =>
      d.id === dealId ? { ...d, selectedProposalId: proposalId, status: "matched", selectedAt: Date.now() } : d
    );
    persist(next);
  };

  const handleCompleteDeal = (dealId) => {
    const next = deals.map((d) =>
      d.id === dealId ? { ...d, status: "done", completedAt: Date.now() } : d
    );
    persist(next);
  };

  const handleSendMessage = async (dealId, text) => {
    const newMsg = { id: `m${Date.now()}`, senderName: user.name, senderRole: user.role, text, ts: Date.now() };
    const updated = { ...chats, [dealId]: [...(chats[dealId] || []), newMsg] };
    setChats(updated);
    await storage.set(CHATS_KEY, JSON.stringify(updated));
  };

  const handleOpenChat = (target) => { setChatTarget(target); };

  const handleEditDeal = (deal) => { setEditingDeal(deal); setCloningDeal(null); setTab("create"); };
  const handleCancelEdit = () => { setEditingDeal(null); setTab("mydeals"); };
  const handleCloneDeal = (deal) => { setCloningDeal(deal); setEditingDeal(null); setTab("create"); };
  const handleCancelClone = () => { setCloningDeal(null); setTab("mydeals"); };
  const handleUpdateDeal = (updated) => {
    persist(deals.map((d) => d.id === updated.id ? updated : d));
    setEditingDeal(null);
    setTab("mydeals");
  };
  const handleDeleteDeal = (dealId) => {
    persist(deals.filter((d) => d.id !== dealId));
  };

  const handleCloseDeal = (dealId) => {
    persist(deals.map((d) => d.id === dealId ? { ...d, status: "closed", closedAt: Date.now() } : d));
  };

  const handleCancelProposal = (dealId, proposalId) => {
    persist(deals.map((d) =>
      d.id === dealId ? { ...d, proposals: d.proposals.filter((p) => p.id !== proposalId) } : d
    ));
  };

  const handleRateProposal = (dealId, proposalId, rating, review) => {
    persist(deals.map((d) =>
      d.id === dealId
        ? { ...d, proposals: d.proposals.map((p) => p.id === proposalId ? { ...p, rating, review, ratedAt: Date.now() } : p) }
        : d
    ));
  };

  if (!authChecked || loadState === "loading") {
    return (
      <div style={{ background: TOKENS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.inkSoft, fontSize: 14 }}>
        불러오는 중…
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div style={{ background: TOKENS.bg, minHeight: "100%", padding: "60px 24px", textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.rust, fontSize: 14 }}>
        데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const isChef = user.role === "chef";
  const openCount = deals.filter((d) => d.status === "open").length;
  const myDeals = isChef
    ? deals.filter((d) =>
        d.createdBy === (user.uid || user.name) || d.chefName === user.name
      )
    : [];

  const newProposalCount = isChef
    ? myDeals.reduce((sum, d) => sum + d.proposals.filter((p) => p.createdAt > lastMyDealsVisit).length, 0)
    : 0;

  const newSelectionCount = !isChef
    ? deals.filter((d) => {
        if (!d.selectedProposalId) return false;
        const mine = d.proposals.find((p) => p.farmerName === user.name && p.id === d.selectedProposalId);
        return mine && !seenSelections.includes(d.id);
      }).length
    : 0;

  const handleTabClick = (key) => {
    if (key !== "create") setEditingDeal(null);
    if (key === "mydeals" && isChef) {
      const now = Date.now();
      setLastMyDealsVisit(now);
      localStorage.setItem("last-mydeals-visit", String(now));
    }
    if (key === "myproposals" && !isChef) {
      const selectedDealIds = deals
        .filter((d) => d.selectedProposalId && d.proposals.find((p) => p.farmerName === user.name && p.id === d.selectedProposalId))
        .map((d) => d.id);
      const next = [...new Set([...seenSelections, ...selectedDealIds])];
      setSeenSelections(next);
      localStorage.setItem("seen-selections", JSON.stringify(next));
    }
    setTab(key);
  };

  const TABS = isChef
    ? [{ key: "create", label: editingDeal ? "딜 수정" : cloningDeal ? "딜 복제" : "딜 만들기" }, { key: "mydeals", label: "내 거래", badge: newProposalCount }, { key: "chefprofile", label: "내 레스토랑" }]
    : [{ key: "browse", label: "딜 찾기" }, { key: "myproposals", label: "내 제안", badge: newSelectionCount }, { key: "farm", label: "내 농가" }];

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100%", padding: isMobile ? "16px 12px" : "32px 24px", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.ink }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
      />
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, letterSpacing: "0.08em", color: TOKENS.rust, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>
              역경매 방식 선주문 플랫폼
            </span>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: isMobile ? 20 : 28, margin: "6px 0 0" }}>
              Farm-to-Table
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexShrink: 0 }}>
            <span style={chipBadge(isChef ? TOKENS.rustSoft : TOKENS.mossSoft, isChef ? TOKENS.rust : TOKENS.moss)}>
              {isChef ? "셰프" : "농가"}
            </span>
            <span style={{ fontSize: 13, color: TOKENS.ink, fontWeight: 500 }}>{user.name}</span>
            <button
              onClick={handleLogout}
              style={{ fontSize: 11, color: TOKENS.inkSoft, background: "none", border: `1px solid ${TOKENS.line}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 탭바 */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 0 : 8, marginBottom: 24, borderBottom: `1px solid ${TOKENS.line}`, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              style={{
                padding: isMobile ? "10px 12px" : "10px 18px", background: "transparent", border: "none",
                borderBottom: `2px solid ${tab === t.key ? TOKENS.rust : "transparent"}`,
                color: tab === t.key ? TOKENS.ink : TOKENS.inkSoft,
                fontSize: isMobile ? 13 : 14, fontWeight: tab === t.key ? 500 : 400,
                cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0,
                position: "relative",
              }}
            >
              {t.label}
              {t.key === "browse" && <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{openCount}</span>}
              {t.key === "mydeals" && <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{myDeals.length}</span>}
              {t.badge > 0 && (
                <span style={{
                  position: "absolute", top: 6, right: isMobile ? 0 : 4,
                  minWidth: 16, height: 16, borderRadius: 999,
                  background: TOKENS.rust, color: "#fff",
                  fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px", lineHeight: 1,
                }}>
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {!isMobile && (
            <button onClick={handleResetData} style={{ fontSize: 11, color: TOKENS.inkSoft, background: "none", border: `1px solid ${TOKENS.line}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", marginBottom: 10, flexShrink: 0 }}>
              샘플 초기화
            </button>
          )}
          {!isMobile && (
            <span style={{ fontSize: 11, color: saveState === "error" ? TOKENS.rust : TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", paddingBottom: 10, flexShrink: 0 }}>
              {saveState === "saving" && "저장 중…"}
              {saveState === "saved" && "저장됨"}
              {saveState === "error" && "저장 실패"}
            </span>
          )}
        </div>

        {chatTarget ? (
          <ChatScreen
            dealInfo={chatTarget}
            userName={user.name}
            userRole={user.role}
            messages={chats[chatTarget.dealId] || []}
            onSend={(text) => handleSendMessage(chatTarget.dealId, text)}
            onBack={() => setChatTarget(null)}
          />
        ) : (
          <>
            {tab === "create" && <DealCreateScreen key={editingDeal?.id ?? (cloningDeal ? `clone-${cloningDeal.id}` : "new")} onCreate={(deal) => { handleCreateDeal(deal); setCloningDeal(null); }} defaultChefName={user.name} editingDeal={editingDeal} onUpdate={handleUpdateDeal} onCancelEdit={editingDeal ? handleCancelEdit : cloningDeal ? handleCancelClone : null} cloningFrom={cloningDeal} />}
            {tab === "browse" && <DealBrowseScreen deals={deals} onSubmitProposal={handleSubmitProposal} farmProfile={farm} userName={user.name} />}
            {tab === "myproposals" && <MyProposalsScreen deals={deals} userName={user.name} onOpenChat={handleOpenChat} onCancelProposal={handleCancelProposal} />}
            {tab === "mydeals" && <MyDealsScreen deals={myDeals} onSelectProposal={handleSelectProposal} onCompleteDeal={handleCompleteDeal} onOpenChat={handleOpenChat} onEdit={handleEditDeal} onDelete={handleDeleteDeal} onClose={handleCloseDeal} onRateProposal={handleRateProposal} onClone={handleCloneDeal} />}
            {tab === "farm" && <FarmProfileScreen profile={farm} onSave={handleSaveFarm} defaultFarmName={user.name} deals={deals} userName={user.name} />}
            {tab === "chefprofile" && <ChefProfileScreen profile={chefProfile} onSave={handleSaveChefProfile} defaultRestaurantName={user.name} />}
          </>
        )}
      </div>
    </div>
  );
}
