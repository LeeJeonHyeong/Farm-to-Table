import { useState, useEffect, useRef, Fragment } from "react";
import { storage, db, auth } from "./firebase";
import { doc, onSnapshot, collection, getDocs, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
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

function ImageUpload({ value, onChange, label = "사진 추가", shape = "square", size = 96 }) {
  const [compressing, setCompressing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCompressing(true);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      onChange(canvas.toDataURL("image/jpeg", 0.82));
      setCompressing(false);
    };
    img.onerror = () => setCompressing(false);
    img.src = url;
  };

  const bRadius = shape === "circle" ? "50%" : 12;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
      <div
        onClick={() => !compressing && fileRef.current.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: size, height: size, borderRadius: bRadius, overflow: "hidden",
          cursor: compressing ? "wait" : "pointer",
          border: `2px ${value ? "solid" : "dashed"} ${TOKENS.line}`,
          background: value ? "transparent" : TOKENS.card,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          boxShadow: value ? "0 2px 10px rgba(32,40,31,0.12)" : "none",
          transition: "border-color 0.15s ease",
        }}
      >
        {value
          ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (
            <div style={{ textAlign: "center", padding: 8, color: TOKENS.inkSoft, pointerEvents: "none" }}>
              <div style={{ fontSize: 20, marginBottom: 2 }}>📷</div>
              <div style={{ fontSize: 10, lineHeight: 1.3, fontFamily: "'IBM Plex Mono', monospace" }}>{label}</div>
            </div>
          )
        }
        {compressing && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(243,241,231,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, color: TOKENS.ink, fontFamily: "'IBM Plex Mono', monospace" }}>처리 중…</span>
          </div>
        )}
        {value && !compressing && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(32,40,31,0.45)", opacity: hovered ? 1 : 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s ease" }}>
            <span style={{ color: "#fff", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>변경 ✎</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
const farmProfileKey = (uid) => `farm-profile-${uid}`;
const chefProfileKey = (uid) => `chef-profile-${uid}`;
const USER_KEY = "current-user";
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
    padding: "3px 9px",
    borderRadius: 999,
    background: bg,
    color,
    fontFamily: "'IBM Plex Mono', monospace",
    border: `1px solid ${color}30`,
    letterSpacing: "0.02em",
  };
}

const inputStyle = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 9,
  border: `1.5px solid ${TOKENS.line}`,
  fontSize: 14,
  fontFamily: "'IBM Plex Sans', sans-serif",
  background: "#FFFFFF",
  color: TOKENS.ink,
  boxSizing: "border-box",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
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
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, margin: "0 0 13px", color: TOKENS.ink, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-block", width: 3, height: 14, background: TOKENS.rust, borderRadius: 2, flexShrink: 0 }} />
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
  const color = DEAL_STATUS_COLOR[status];
  return (
    <span style={{ ...chipBadge(`${color}18`, color), display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: color, flexShrink: 0 }} />
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

/* ---------- 푸시 알림 ---------- */

let _recordNotif = null;

function showPushNotification(title, body) {
  _recordNotif?.({ id: Date.now(), title, body, ts: Date.now(), read: false });
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options = { body, icon: "/vite.svg", badge: "/vite.svg" };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => new Notification(title, options));
  } else {
    new Notification(title, options);
  }
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

/* ---------- AI 매칭 점수 ---------- */

function calcMatchScore(deal, proposal) {
  const breakdown = {};

  const pricePct = deal.targetPrice > 0 ? proposal.price / deal.targetPrice : 1;
  if (pricePct <= 1.0) breakdown.price = 35;
  else if (pricePct <= 1.05) breakdown.price = 28;
  else if (pricePct <= 1.10) breakdown.price = 20;
  else if (pricePct <= 1.20) breakdown.price = 12;
  else if (pricePct <= 1.30) breakdown.price = 6;
  else breakdown.price = 0;

  breakdown.date = 0;
  if (proposal.availableDate && deal.deliveryDate) {
    const diffDays = Math.ceil(
      (new Date(proposal.availableDate) - new Date(deal.deliveryDate)) / 86400000
    );
    if (diffDays <= 0) breakdown.date = 25;
    else if (diffDays <= 1) breakdown.date = 20;
    else if (diffDays <= 3) breakdown.date = 13;
    else if (diffDays <= 7) breakdown.date = 6;
  }

  const qtyRatio = deal.quantity > 0 ? proposal.availableQty / deal.quantity : 0;
  if (qtyRatio >= 1.0) breakdown.qty = 20;
  else if (qtyRatio >= 0.8) breakdown.qty = 15;
  else if (qtyRatio >= 0.6) breakdown.qty = 10;
  else if (qtyRatio >= 0.4) breakdown.qty = 5;
  else breakdown.qty = 0;

  const cert = (proposal.cert || "").trim();
  if (cert === "유기농" || cert === "무농약") breakdown.cert = 10;
  else if (cert === "친환경") breakdown.cert = 8;
  else if (cert === "GAP") breakdown.cert = 7;
  else if (cert === "일반") breakdown.cert = 5;
  else breakdown.cert = 3;

  const r = proposal.rating || 0;
  if (r >= 4.5) breakdown.rating = 10;
  else if (r >= 4.0) breakdown.rating = 8;
  else if (r >= 3.5) breakdown.rating = 6;
  else if (r >= 3.0) breakdown.rating = 4;
  else breakdown.rating = 2;

  const total = breakdown.price + breakdown.date + breakdown.qty + breakdown.cert + breakdown.rating;
  const color = total >= 70 ? TOKENS.moss : total >= 50 ? "#7A5C20" : TOKENS.rust;
  const bg = total >= 70 ? TOKENS.mossSoft : total >= 50 ? TOKENS.goldSoft : TOKENS.rustSoft;
  const label = total >= 85 ? "최상" : total >= 70 ? "우수" : total >= 50 ? "보통" : "낮음";
  return { total, breakdown, label, color, bg };
}

function fallbackMatchComment(deal, proposal, score) {
  const { breakdown, total } = score;
  const strong = [];
  const weak = [];
  if (breakdown.price >= 28) strong.push("가격 적합");
  else if (breakdown.price <= 6) weak.push("가격 초과");
  if (breakdown.date === 25) strong.push("납품일 정시 가능");
  else if (breakdown.date === 0) weak.push("납품일 불일치");
  if (breakdown.qty === 20) strong.push("수량 충족");
  else if (breakdown.qty <= 5) weak.push("수량 부족");
  if (breakdown.cert >= 10) strong.push("고급 인증 보유");
  if (total >= 85) return `전 항목 우수 — ${strong.slice(0, 2).join("·")}이 강점입니다.`;
  if (weak.length > 0) return `${weak[0]}이 아쉽지만${strong.length > 0 ? ", " + strong[0] + "은 강점입니다" : " 검토가 필요합니다"}.`;
  return `매칭 점수 ${total}점 — ${strong.length > 0 ? strong[0] + "이 강점입니다" : "세부 조건을 확인하세요"}.`;
}

async function getAIMatchComment(deal, proposal, score) {
  const system = "당신은 농산물 직거래 플랫폼의 매칭 분석 AI입니다. 셰프의 구매 요청과 농가 제안을 비교해 한 문장으로 핵심 매칭 이유를 한국어로 설명하세요. JSON 형식으로 응답: {\"comment\": \"...\"}";
  const user = `딜: ${deal.crop} ${deal.quantity}kg, 희망단가 ${deal.targetPrice}원/kg, 납품일 ${deal.deliveryDate}\n제안: ${proposal.farmName}(${proposal.region}), ${proposal.price}원/kg, 납품가능일 ${proposal.availableDate}, ${proposal.availableQty}kg, ${proposal.cert}, 평점 ${proposal.rating}\n점수: ${score.total}/100 (가격 ${score.breakdown.price}/35, 날짜 ${score.breakdown.date}/25, 수량 ${score.breakdown.qty}/20, 인증 ${score.breakdown.cert}/10, 평점 ${score.breakdown.rating}/10)`;
  try {
    const res = await fetch("/api/groq/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.3, max_tokens: 120,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallbackMatchComment(deal, proposal, score);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return parsed.comment || fallbackMatchComment(deal, proposal, score);
  } catch {
    return fallbackMatchComment(deal, proposal, score);
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
    <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${TOKENS.line}` }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {DEAL_STEPS.map((s, i) => {
          const done = s.key < step;
          const current = s.key === step;
          const dotBg = done ? TOKENS.moss : current ? TOKENS.rust : TOKENS.line;
          const dotColor = done || current ? "#FFF" : TOKENS.inkSoft;
          return (
            <Fragment key={s.key}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, minWidth: isMobile ? 38 : 58 }}>
                <div style={{
                  width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, borderRadius: "50%",
                  background: dotBg, color: dotColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: isMobile ? 11 : 12, fontWeight: 700,
                  boxShadow: current ? `0 0 0 4px ${TOKENS.rust}22` : done ? `0 0 0 3px ${TOKENS.moss}18` : "none",
                  transition: "all 0.25s ease",
                }}>
                  {done ? "✓" : s.key}
                </div>
                {!isMobile && (
                  <span style={{
                    fontSize: 9, textAlign: "center", whiteSpace: "nowrap",
                    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.03em",
                    color: current ? TOKENS.ink : done ? TOKENS.moss : TOKENS.inkSoft,
                    fontWeight: current ? 600 : 400,
                  }}>
                    {s.label}
                  </span>
                )}
                {isMobile && current && (
                  <span style={{ fontSize: 9, color: TOKENS.rust, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{s.label}</span>
                )}
              </div>
              {i < DEAL_STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, borderRadius: 1,
                  background: done ? TOKENS.moss : TOKENS.line,
                  marginTop: isMobile ? 12 : 14,
                  transition: "background 0.35s ease",
                }} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function DealCreateScreen({ onCreate, defaultChefName = "", defaultChefRegion = "", editingDeal = null, onUpdate = null, onCancelEdit = null, cloningFrom = null, userId = "" }) {
  const isEditing = !!editingDeal;
  const isCloning = !!cloningFrom;
  const blank = {
    chefName: defaultChefName, chefRegion: defaultChefRegion, crop: "토마토", sizeCondition: "", ripeness: RIPENESS_STAGES["토마토"][2],
    grade: "상", quantity: "", deliveryDate: "", cycle: "주 1회", targetPrice: "", note: "", photoURL: "",
  };
  const [dealId] = useState(() => isEditing ? editingDeal.id : `d${Date.now()}`);
  const [step, setStep] = useState(1);
  const [data, setData] = useState(
    isEditing
      ? { ...editingDeal, quantity: String(editingDeal.quantity), targetPrice: String(editingDeal.targetPrice) }
      : isCloning
      ? { ...cloningFrom, quantity: String(cloningFrom.quantity), targetPrice: String(cloningFrom.targetPrice), photoURL: "" }
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
  const goBack = () => { setStep((s) => Math.max(1, s - 1)); setErrors({}); };

  const handleSubmit = () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;
    if (isEditing) {
      onUpdate({ ...editingDeal, ...data, quantity: Number(data.quantity), targetPrice: Number(data.targetPrice) });
    } else {
      onCreate({
        ...data,
        id: dealId,
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
              <input type="date" min={new Date().toISOString().split("T")[0]} value={data.deliveryDate} onChange={(e) => update("deliveryDate", e.target.value)} style={inputStyle} />
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

          <div style={{ marginTop: 16 }}>
            <FieldLabel>딜 사진 (선택)</FieldLabel>
            <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 8 }}>식자재 샘플·규격 사진을 첨부하면 농가에게 더 명확하게 전달됩니다.</div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <ImageUpload
                value={data.photoURL || ""}
                onChange={(url) => update("photoURL", url)}
                label="딜 사진"
                shape="square"
                size={100}
              />
              {data.photoURL && (
                <button
                  onClick={() => update("photoURL", "")}
                  style={{ fontSize: 11, color: TOKENS.rust, background: "none", border: "none", cursor: "pointer", padding: "4px 0", marginTop: 4 }}
                >
                  ✕ 삭제
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {step === 5 && (
        <Section title={isEditing ? "5. 수정 내용 확인" : "5. 등록 전 확인"}>
          <div style={{ background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16 }}>
            {data.photoURL && (
              <img src={data.photoURL} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 12, display: "block" }} />
            )}
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

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {step > 1 && (
          <button onClick={goBack} className="ftt-btn-secondary" style={{ padding: "12px 20px" }}>
            ← 이전
          </button>
        )}
        {isEditing && step === 1 && (
          <button onClick={onCancelEdit} className="ftt-btn-secondary" style={{ padding: "12px 16px", color: TOKENS.inkSoft }}>
            취소
          </button>
        )}
        {step < 5 ? (
          <button onClick={goNext} className="ftt-btn-primary" style={{ flex: 1, padding: "12px 0" }}>
            다음 단계 →
          </button>
        ) : (
          <button onClick={handleSubmit} className="ftt-btn-primary" style={{ flex: 1, padding: "12px 0" }}>
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

function FarmProfileMiniCard({ farmProfile }) {
  if (!farmProfile?.farmName) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: TOKENS.mossSoft, borderRadius: 10, marginBottom: 14, border: `1px solid ${TOKENS.moss}33` }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: farmProfile.photoURL ? "transparent" : `linear-gradient(145deg, ${TOKENS.moss}, #3D5437)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {farmProfile.photoURL
          ? <img src={farmProfile.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 20 }}>🌱</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, color: TOKENS.ink, fontWeight: 600 }}>{farmProfile.farmName}</span>
          {farmProfile.region && <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>{farmProfile.region}</span>}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
          {farmProfile.cert && farmProfile.cert !== "인증 없음" && (
            <span style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{farmProfile.cert}</span>
          )}
          {(farmProfile.specialty || []).slice(0, 3).map((c) => (
            <span key={c} style={chipBadge("#E8F0E4", TOKENS.moss)}>{c}</span>
          ))}
        </div>
      </div>
      <span style={{ fontSize: 11, color: TOKENS.moss, fontWeight: 600, flexShrink: 0 }}>✓ 내 농가</span>
    </div>
  );
}

function ChefProfileMiniCard({ chefData, deal }) {
  const name = deal.chefName;
  const region = deal.chefRegion;
  const photo = chefData?.photoURL;
  const description = chefData?.description;
  const preferCrops = chefData?.preferCrops || [];

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", background: TOKENS.rustSoft, borderRadius: 12, marginBottom: 16, border: `1px solid ${TOKENS.rust}22` }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: photo ? "transparent" : `linear-gradient(145deg, ${TOKENS.rust}, #8B3A2A)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {photo
          ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 22 }}>🍳</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: TOKENS.ink, fontWeight: 600 }}>{name}</span>
          {region && <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>{region}</span>}
        </div>
        {description && (
          <p style={{ fontSize: 12, color: TOKENS.inkSoft, margin: "0 0 6px", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {description}
          </p>
        )}
        {preferCrops.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>선호품목</span>
            {preferCrops.slice(0, 5).map((c) => (
              <span key={c} style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>{c}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
        photoURL: farmProfile?.photoURL || null,
        specialty: farmProfile?.specialty || [],
      });
    }
  };

  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
      <FarmProfileMiniCard farmProfile={farmProfile} />
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

function MyProposalsScreen({ deals, userName, onOpenChat, onCancelProposal, onViewContract, chatUnreads = {} }) {
  const isMobile = useIsMobile();
  const [cancellingId, setCancellingId] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const myItems = [];
  for (const deal of deals) {
    const proposal = deal.proposals.find((p) => p.farmerName === userName);
    if (proposal) myItems.push({ deal, proposal });
  }
  myItems.sort((a, b) => b.proposal.createdAt - a.proposal.createdAt);

  if (detailItem) {
    const live = deals.find((d) => d.id === detailItem.deal.id);
    const liveDeal = live || detailItem.deal;
    const liveProposal = liveDeal.proposals.find((p) => p.id === detailItem.proposal.id) || detailItem.proposal;
    return (
      <MyProposalDetailView
        deal={liveDeal}
        proposal={liveProposal}
        onBack={() => setDetailItem(null)}
        onCancel={onCancelProposal}
        onOpenChat={onOpenChat}
        onViewContract={onViewContract}
        chatUnreads={chatUnreads}
      />
    );
  }

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
          <div key={proposal.id} onClick={() => setDetailItem({ deal, proposal })} style={{ background: TOKENS.card, border: `1px solid ${isSelected ? TOKENS.moss : TOKENS.line}`, borderRadius: 12, padding: 18, cursor: "pointer" }}>
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
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => onOpenChat({ dealId: deal.id, crop: deal.crop, chefName: deal.chefName, farmName: proposal.farmName })}
                  style={{ flex: 1, padding: "9px 0", background: TOKENS.mossSoft, color: TOKENS.moss, border: `1px solid ${TOKENS.moss}44`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  💬 {deal.chefName}과 채팅
                  {(chatUnreads[deal.id] || 0) > 0 && (
                    <span style={{ marginLeft: 8, background: TOKENS.rust, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                      {chatUnreads[deal.id]}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => onViewContract(deal, proposal)}
                  style={{ padding: "9px 16px", background: TOKENS.goldSoft, color: "#7A5C20", border: `1px solid ${TOKENS.gold}44`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  계약서
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MyProposalDetailView({ deal, proposal, onBack, onCancel, onOpenChat, onViewContract, chatUnreads = {} }) {
  const isMobile = useIsMobile();
  const [cancellingId, setCancellingId] = useState(null);
  const score = calcMatchScore(deal, proposal);
  const priceDiff = proposal.price - deal.targetPrice;
  const isSelected = deal.selectedProposalId === proposal.id;
  const isRejected = deal.selectedProposalId && !isSelected;
  const isClosed = deal.status === "closed";
  const isPending = !deal.selectedProposalId && deal.status === "open";
  const statusLabel = isSelected ? "🎉 선택됨" : isRejected ? "미선택" : isClosed ? "마감됨" : "검토 중";
  const statusColor = isSelected ? TOKENS.moss : isRejected ? TOKENS.inkSoft : isClosed ? TOKENS.rust : "#B45309";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <button onClick={onBack} className="ftt-btn-secondary" style={{ marginBottom: 18, padding: "7px 16px", fontSize: 13 }}>
        ← 내 제안 목록으로
      </button>

      {deal.photoURL && (
        <div style={{ width: "100%", height: isMobile ? 160 : 220, borderRadius: 14, overflow: "hidden", marginBottom: 18, boxShadow: "0 4px 20px rgba(32,40,31,0.12)" }}>
          <img src={deal.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* 딜 정보 */}
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? 16 : 22, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: TOKENS.ink }}>{deal.crop}</div>
            <div style={{ fontSize: 13, color: TOKENS.inkSoft, marginTop: 3 }}>{deal.chefName}{deal.chefRegion ? ` · ${deal.chefRegion}` : ""}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 999, background: isSelected ? TOKENS.mossSoft : isRejected ? TOKENS.line : isClosed ? TOKENS.rustSoft : "#FEF3C7", color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "셰프 희망 단가", value: `${deal.targetPrice.toLocaleString()}원/kg`, color: "#7A5C20" },
            { label: "수량", value: `${deal.quantity}kg` },
            { label: "납품 희망일", value: deal.deliveryDate },
            { label: "등급", value: `${deal.grade}등급` },
            { label: "숙성도", value: deal.ripeness || "-" },
            { label: "납품 주기", value: deal.cycle || "-" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#FFFFFF", borderRadius: 8, padding: "8px 12px", border: `1px solid ${TOKENS.line}` }}>
              <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: color || TOKENS.ink }}>{value}</div>
            </div>
          ))}
        </div>
        {deal.sizeCondition && <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 10 }}><span style={{ fontWeight: 500, color: TOKENS.ink }}>규격 조건</span> · {deal.sizeCondition}</div>}
        {deal.note && <div style={{ background: TOKENS.bg, borderRadius: 8, padding: "10px 12px", border: `1px solid ${TOKENS.line}`, fontSize: 12, color: TOKENS.inkSoft, lineHeight: 1.6, marginTop: 10 }}>"{deal.note}"</div>}
      </div>

      {/* 내 제안 내용 */}
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.moss}44`, borderLeft: `4px solid ${TOKENS.moss}`, borderRadius: 14, padding: isMobile ? 16 : 22, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>내 제안 내용</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[
            { label: "제안 단가", value: `${proposal.price.toLocaleString()}원/kg`, sub: priceDiff !== 0 ? `희망가 대비 ${priceDiff > 0 ? "+" : ""}${priceDiff.toLocaleString()}` : "희망가와 동일", subColor: priceDiff > 0 ? TOKENS.rust : priceDiff < 0 ? TOKENS.moss : TOKENS.inkSoft },
            { label: "납품 가능 수량", value: `${proposal.availableQty}kg` },
            { label: "납품 가능일", value: proposal.availableDate || "-" },
            { label: "인증", value: proposal.cert },
          ].map(({ label, value, sub, subColor }) => (
            <div key={label} style={{ background: TOKENS.bg, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>{value}</div>
              {sub && <div style={{ fontSize: 10, color: subColor || TOKENS.inkSoft, marginTop: 2 }}>{sub}</div>}
            </div>
          ))}
        </div>
        {proposal.message && (
          <div style={{ background: TOKENS.bg, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: TOKENS.inkSoft, lineHeight: 1.6, fontStyle: "italic" }}>"{proposal.message}"</div>
        )}
        <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
          제안일 {new Date(proposal.createdAt).toLocaleDateString("ko-KR")}
        </div>
        {proposal.ratedAt && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: TOKENS.goldSoft, borderRadius: 8, padding: "8px 12px" }}>
            <span style={{ fontSize: 11, color: "#7A5C20" }}>받은 평점</span>
            <StarRating value={proposal.rating} size={14} />
            <span style={{ fontSize: 12, color: "#7A5C20", fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.rating.toFixed(1)}</span>
            {proposal.review && <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>· "{proposal.review}"</span>}
          </div>
        )}
      </div>

      {/* AI 매칭 점수 */}
      {score && (
        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? 16 : 22, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>AI 매칭 점수</div>
            <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, background: score.bg, color: score.color, border: `1px solid ${score.color}44` }}>
              {score.total}점
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {SCORE_BREAKDOWN_LABELS.map(({ key, label, max }) => {
              const val = score.breakdown[key];
              const pct = val / max;
              const barColor = pct >= 0.8 ? TOKENS.moss : pct >= 0.5 ? TOKENS.gold : TOKENS.rust;
              return (
                <div key={key} style={{ flex: "1 1 80px", minWidth: 70 }}>
                  <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 4 }}>{label}</div>
                  <div style={{ height: 6, background: TOKENS.line, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: barColor, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{val}/{max}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isPending && (
          cancellingId ? (
            <>
              <span style={{ fontSize: 13, color: TOKENS.rust, alignSelf: "center" }}>제안을 취소하시겠어요?</span>
              <button onClick={() => { onCancel(deal.id, proposal.id); setCancellingId(null); onBack(); }} style={{ padding: "10px 18px", background: TOKENS.rust, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>취소 확인</button>
              <button onClick={() => setCancellingId(null)} style={{ padding: "10px 14px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 13, color: TOKENS.inkSoft, cursor: "pointer" }}>돌아가기</button>
            </>
          ) : (
            <button onClick={() => setCancellingId(proposal.id)} style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${TOKENS.rustSoft}`, borderRadius: 8, fontSize: 13, color: TOKENS.rust, cursor: "pointer" }}>제안 취소</button>
          )
        )}
        {isSelected && (
          <>
            <button
              onClick={() => onOpenChat({ dealId: deal.id, crop: deal.crop, chefName: deal.chefName, farmName: proposal.farmName })}
              style={{ flex: 1, minWidth: 120, padding: "12px 0", background: TOKENS.mossSoft, color: TOKENS.moss, border: `1px solid ${TOKENS.moss}44`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              💬 {deal.chefName}과 채팅
              {(chatUnreads[deal.id] || 0) > 0 && (
                <span style={{ marginLeft: 8, background: TOKENS.rust, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{chatUnreads[deal.id]}</span>
              )}
            </button>
            <button onClick={() => onViewContract(deal, proposal)} style={{ padding: "12px 18px", background: TOKENS.goldSoft, color: "#7A5C20", border: `1px solid ${TOKENS.gold}44`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>계약서</button>
          </>
        )}
      </div>
    </div>
  );
}

function DealDetailView({ deal, farmProfile, userName, onSubmitProposal, onBack }) {
  const [openForm, setOpenForm] = useState(false);
  const [chefData, setChefData] = useState(null);
  const isMobile = useIsMobile();
  const myProposal = deal.proposals.find((p) => p.farmerName === userName);
  const isMySpecialty = (farmProfile?.specialty ?? []).includes(deal.crop);

  useEffect(() => {
    if (deal.createdBy) {
      storage.get(chefProfileKey(deal.createdBy)).then((result) => {
        if (result?.value) setChefData(JSON.parse(result.value));
      }).catch(() => {});
    }
  }, [deal.id]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="ftt-screen-enter">
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: TOKENS.inkSoft, fontSize: 13, padding: "0 0 16px", marginBottom: 4 }}
      >
        ← 딜 목록으로
      </button>

      {deal.photoURL && (
        <div style={{ width: "100%", height: isMobile ? 180 : 240, borderRadius: 16, overflow: "hidden", marginBottom: 20, boxShadow: "0 4px 20px rgba(32,40,31,0.12)" }}>
          <img src={deal.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 16, padding: isMobile ? 18 : 24, marginBottom: 16, boxShadow: "0 2px 12px rgba(32,40,31,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: TOKENS.ink }}>{deal.crop}</span>
              {isMySpecialty && (
                <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: TOKENS.moss, background: TOKENS.mossSoft, border: `1px solid ${TOKENS.moss}44`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>내 전문 품목</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: TOKENS.inkSoft, marginTop: 4 }}>
              {deal.chefName}{deal.chefRegion ? ` · ${deal.chefRegion}` : ""}
            </div>
          </div>
          <StatusBadge status={deal.status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10, margin: "16px 0" }}>
          {[
            { label: "희망 단가", value: `${deal.targetPrice.toLocaleString()}원/kg`, color: "#7A5C20" },
            { label: "수량", value: `${deal.quantity}kg` },
            { label: "납품 희망일", value: deal.deliveryDate },
            { label: "등급", value: `${deal.grade}등급` },
            { label: "숙성도", value: deal.ripeness || "-" },
            { label: "납품 주기", value: deal.cycle || "-" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#FFFFFF", borderRadius: 10, padding: "10px 14px", border: `1px solid ${TOKENS.line}` }}>
              <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: color || TOKENS.ink }}>{value}</div>
            </div>
          ))}
        </div>

        {deal.sizeCondition && (
          <div style={{ fontSize: 13, color: TOKENS.inkSoft, marginBottom: 10 }}>
            <span style={{ fontWeight: 500, color: TOKENS.ink }}>규격 조건</span> · {deal.sizeCondition}
          </div>
        )}
        {deal.note && (
          <div style={{ background: TOKENS.bg, borderRadius: 10, padding: "12px 16px", border: `1px solid ${TOKENS.line}`, fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6 }}>
            "{deal.note}"
          </div>
        )}

        <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", marginTop: 14 }}>
          들어온 제안 {deal.proposals.length}건 · 등록일 {fmtDate(deal.createdAt)}
        </div>
      </div>

      {/* 셰프 프로필 카드 */}
      {(chefData || deal.chefName) && (
        <ChefProfileMiniCard chefData={chefData} deal={deal} />
      )}

      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 16, padding: isMobile ? 18 : 24, boxShadow: "0 2px 12px rgba(32,40,31,0.05)" }}>
        <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 14 }}>제안하기</div>
        {myProposal ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: TOKENS.mossSoft, borderRadius: 10, fontSize: 13, border: `1px solid ${TOKENS.moss}33` }}>
            <span style={{ color: TOKENS.moss, fontWeight: 500 }}>✓ 제안 완료</span>
            <span style={{ color: TOKENS.inkSoft }}>제안가 {myProposal.price.toLocaleString()}원/kg · {myProposal.availableQty}kg</span>
            {deal.selectedProposalId === myProposal.id
              ? <span style={{ marginLeft: "auto", color: TOKENS.moss, fontWeight: 600 }}>🎉 선택됨</span>
              : deal.selectedProposalId
              ? <span style={{ marginLeft: "auto", color: TOKENS.inkSoft }}>미선택</span>
              : <span style={{ marginLeft: "auto", color: TOKENS.inkSoft }}>검토 중</span>}
          </div>
        ) : openForm ? (
          <ProposalForm
            deal={deal}
            onSubmit={(id, proposal) => { onSubmitProposal(id, proposal); setOpenForm(false); }}
            onCancel={() => setOpenForm(false)}
            farmProfile={farmProfile}
            farmerName={userName}
          />
        ) : (
          <button
            onClick={() => setOpenForm(true)}
            style={{ width: "100%", padding: "12px 0", background: TOKENS.moss, color: TOKENS.bg, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            이 딜에 제안 보내기
          </button>
        )}
      </div>
    </div>
  );
}

function DealBrowseScreen({ deals, onSubmitProposal, farmProfile, userName }) {
  const [detailDeal, setDetailDeal] = useState(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (detailDeal) {
      const updated = deals.find((d) => d.id === detailDeal.id);
      if (updated) setDetailDeal(updated);
    }
  }, [deals]);
  const [cropFilter, setCropFilter] = useState("전체");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const hasSpecialty = (farmProfile?.specialty?.length ?? 0) > 0;
  const [specialtyOnly, setSpecialtyOnly] = useState(false);
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
      if (specialtyOnly && !specialty.has(d.crop)) return false;
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
  const hasFilters = search || specialtyOnly || cropFilter !== "전체" || gradeFilter !== "전체" || regionFilter !== "전체" || sortBy !== (hasSpecialty ? "smart" : "latest") || hasAdvanced;
  const resetFilters = () => {
    setSearch(""); setSpecialtyOnly(false); setCropFilter("전체"); setGradeFilter("전체"); setRegionFilter("전체"); setSortBy(hasSpecialty ? "smart" : "latest");
    setDateFrom(""); setDateTo(""); setQtyMin(""); setQtyMax(""); setPriceMin(""); setPriceMax("");
  };

  if (detailDeal) {
    return (
      <DealDetailView
        deal={detailDeal}
        farmProfile={farmProfile}
        userName={userName}
        onSubmitProposal={(id, proposal) => { onSubmitProposal(id, proposal); setDetailDeal(null); }}
        onBack={() => setDetailDeal(null)}
      />
    );
  }

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

      {/* 내 전문품목만 빠른 필터 */}
      {hasSpecialty && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => { setSpecialtyOnly((v) => !v); if (!specialtyOnly) setCropFilter("전체"); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${specialtyOnly ? TOKENS.moss : TOKENS.line}`,
              background: specialtyOnly ? TOKENS.moss : "#FFFFFF",
              color: specialtyOnly ? "#FFFFFF" : TOKENS.inkSoft,
              transition: "all 0.12s ease",
            }}
          >
            🌱 내 전문품목만
          </button>
          {specialtyOnly && (farmProfile.specialty || []).map((c) => (
            <span key={c} style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{c}</span>
          ))}
        </div>
      )}

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
          <div style={{ marginBottom: openDeals.length > 0 ? 10 : 0 }}>
            {openDeals.length === 0 ? "현재 모집 중인 딜이 없습니다." : "검색 조건에 맞는 딜이 없습니다."}
          </div>
          {openDeals.length > 0 && (
            <button onClick={() => { setCropFilter("전체"); setGradeFilter("전체"); setRegionFilter("전체"); setDateFrom(""); setDateTo(""); setQtyMin(""); setQtyMax(""); setPriceMin(""); setPriceMax(""); }} style={{ padding: "6px 16px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 12, color: TOKENS.inkSoft, cursor: "pointer" }}>
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((deal) => {
            const isMySpecialty = specialty.has(deal.crop);
            const myProposal = deal.proposals.find((p) => p.farmerName === userName);
            return (
            <div
              key={deal.id}
              className="ftt-card"
              onClick={() => setDetailDeal(deal)}
              style={{ background: TOKENS.card, border: `1px solid ${isMySpecialty ? TOKENS.moss + "66" : TOKENS.line}`, borderLeft: `4px solid ${isMySpecialty ? TOKENS.moss : TOKENS.line}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(32,40,31,0.05), 0 2px 12px rgba(32,40,31,0.03)", cursor: "pointer" }}
            >
              {deal.photoURL && (
                <div style={{ float: "right", marginLeft: 12, marginBottom: 4 }}>
                  <img src={deal.photoURL} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", display: "block" }} />
                </div>
              )}
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
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: myProposal ? 10 : 0 }}>
                희망 납품일 {deal.deliveryDate} · 들어온 제안 {deal.proposals.length}건
              </div>
              {myProposal && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: TOKENS.mossSoft, borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: TOKENS.moss, fontWeight: 500 }}>✓ 제안 완료</span>
                  <span style={{ color: TOKENS.inkSoft }}>제안가 {myProposal.price.toLocaleString()}원/kg · {myProposal.availableQty}kg</span>
                  {deal.selectedProposalId === myProposal.id
                    ? <span style={{ marginLeft: "auto", color: TOKENS.moss, fontWeight: 600 }}>🎉 선택됨</span>
                    : deal.selectedProposalId
                    ? <span style={{ marginLeft: "auto", color: TOKENS.inkSoft }}>미선택</span>
                    : <span style={{ marginLeft: "auto", color: TOKENS.inkSoft }}>검토 중</span>}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- 3. 내 거래 (셰프가 제안 비교 후 선택) ---------- */

const SCORE_BREAKDOWN_LABELS = [
  { key: "price", label: "가격", max: 35 },
  { key: "date", label: "납품일", max: 25 },
  { key: "qty", label: "수량", max: 20 },
  { key: "cert", label: "인증", max: 10 },
  { key: "rating", label: "평점", max: 10 },
];

function FarmProfileDetailCard({ proposal }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ background: TOKENS.mossSoft, border: `1px solid ${TOKENS.moss}33`, borderRadius: 14, padding: isMobile ? "16px 14px" : "20px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: proposal.photoURL ? "transparent" : `linear-gradient(145deg, ${TOKENS.moss}, #3D5437)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {proposal.photoURL
            ? <img src={proposal.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 32 }}>🌱</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: TOKENS.ink, fontWeight: 600, marginBottom: 2 }}>{proposal.farmName}</div>
          {proposal.region && <div style={{ fontSize: 13, color: TOKENS.inkSoft, marginBottom: 6 }}>{proposal.region}</div>}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {proposal.cert && proposal.cert !== "인증 없음" && (
              <span style={chipBadge(TOKENS.mossSoft, TOKENS.moss)}>{proposal.cert}</span>
            )}
            {(proposal.specialty || []).map((c) => (
              <span key={c} style={chipBadge("#E8F0E4", TOKENS.moss)}>{c}</span>
            ))}
          </div>
        </div>
      </div>
      {proposal.ratedAt && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: `1px solid ${TOKENS.moss}22` }}>
          <StarRating value={proposal.rating} size={14} />
          <span style={{ fontSize: 12, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.rating.toFixed(1)}</span>
          {proposal.review && <span style={{ fontSize: 12, color: TOKENS.inkSoft, fontStyle: "italic" }}>"{proposal.review}"</span>}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ proposal, deal, onSelect, isSelected, selectable, score, onClick }) {
  const priceDiff = proposal.price - deal.targetPrice;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [aiComment, setAiComment] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);

  const handleToggleBreakdown = () => {
    const next = !showBreakdown;
    setShowBreakdown(next);
    if (next && aiComment === null && !commentLoading && score) {
      setCommentLoading(true);
      getAIMatchComment(deal, proposal, score).then((c) => {
        setAiComment(c);
        setCommentLoading(false);
      });
    }
  };

  return (
    <div
      className="ftt-card"
      onClick={onClick}
      style={{
        background: "#FFFFFF",
        border: `1px solid ${isSelected ? TOKENS.moss + "88" : TOKENS.line}`,
        borderLeft: `4px solid ${isSelected ? TOKENS.moss : TOKENS.line}`,
        borderRadius: 10,
        padding: 14,
        cursor: onClick ? "pointer" : "default",
        boxShadow: isSelected
          ? "0 2px 12px rgba(91,117,83,0.12), 0 1px 4px rgba(91,117,83,0.08)"
          : "0 1px 3px rgba(32,40,31,0.05), 0 2px 8px rgba(32,40,31,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: TOKENS.ink }}>{proposal.farmName}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>{proposal.region}</span>
          {score && (
            <button
              onClick={handleToggleBreakdown}
              style={{
                padding: "2px 8px", borderRadius: 999, fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                background: score.bg, color: score.color,
                border: `1px solid ${score.color}44`, cursor: "pointer",
              }}
            >
              {score.total}점 {showBreakdown ? "▾" : "▸"}
            </button>
          )}
        </div>
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
      {showBreakdown && score && (
        <div style={{ background: TOKENS.bg, border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {SCORE_BREAKDOWN_LABELS.map(({ key, label, max }) => {
              const val = score.breakdown[key];
              const pct = val / max;
              const barColor = pct >= 0.8 ? TOKENS.moss : pct >= 0.5 ? TOKENS.gold : TOKENS.rust;
              return (
                <div key={key} style={{ flex: "1 1 60px", minWidth: 55 }}>
                  <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginBottom: 3 }}>{label}</div>
                  <div style={{ height: 4, background: TOKENS.line, borderRadius: 2, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct * 100}%`, background: barColor, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>{val}/{max}</div>
                </div>
              );
            })}
          </div>
          {commentLoading ? (
            <p style={{ fontSize: 11, color: TOKENS.inkSoft, margin: 0, fontStyle: "italic" }}>AI 분석 중...</p>
          ) : aiComment ? (
            <p style={{ fontSize: 11, color: TOKENS.ink, margin: 0, lineHeight: 1.5 }}>✦ {aiComment}</p>
          ) : null}
        </div>
      )}
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

function ProposalDetailView({ proposal, deal, onSelect, selectable, score, onBack }) {
  const isMobile = useIsMobile();
  const [aiComment, setAiComment] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const priceDiff = proposal.price - deal.targetPrice;

  useEffect(() => {
    if (score && aiComment === null && !commentLoading) {
      setCommentLoading(true);
      getAIMatchComment(deal, proposal, score).then((c) => {
        setAiComment(c);
        setCommentLoading(false);
      });
    }
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <button
        onClick={onBack}
        className="ftt-btn-secondary"
        style={{ marginBottom: 18, padding: "7px 16px", fontSize: 13 }}
      >
        ← 제안 목록으로
      </button>

      {/* 농가 프로필 상세 카드 */}
      <FarmProfileDetailCard proposal={proposal} />

      {/* 제안 정보 그리드 */}
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: isMobile ? "16px 14px" : "20px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
          제안 내용
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { label: "제안 단가", value: `${proposal.price.toLocaleString()}원/kg`, sub: priceDiff !== 0 ? `희망가 대비 ${priceDiff > 0 ? "+" : ""}${priceDiff.toLocaleString()}` : "희망가와 동일", subColor: priceDiff > 0 ? TOKENS.rust : priceDiff < 0 ? TOKENS.moss : TOKENS.inkSoft },
            { label: "납품 가능 수량", value: `${proposal.availableQty}kg` },
            { label: "납품 가능일", value: proposal.availableDate || "-" },
            { label: "인증", value: proposal.cert },
          ].map(({ label, value, sub, subColor }) => (
            <div key={label} style={{ background: TOKENS.bg, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, color: TOKENS.ink, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
              {sub && <div style={{ fontSize: 10, color: subColor || TOKENS.inkSoft, marginTop: 3 }}>{sub}</div>}
            </div>
          ))}
        </div>
        {proposal.message && (
          <div style={{ background: TOKENS.bg, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>농가 메시지</div>
            <p style={{ fontSize: 13, color: TOKENS.ink, margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>"{proposal.message}"</p>
          </div>
        )}
      </div>

      {/* AI 매칭 점수 */}
      {score && (
        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: isMobile ? "16px 14px" : "20px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>AI 매칭 점수</div>
            <span style={{ padding: "3px 12px", borderRadius: 999, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, background: score.bg, color: score.color, border: `1px solid ${score.color}44` }}>
              {score.total}점
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {SCORE_BREAKDOWN_LABELS.map(({ key, label, max }) => {
              const val = score.breakdown[key];
              const pct = val / max;
              const barColor = pct >= 0.8 ? TOKENS.moss : pct >= 0.5 ? TOKENS.gold : TOKENS.rust;
              return (
                <div key={key} style={{ flex: "1 1 80px", minWidth: 70 }}>
                  <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 4 }}>{label}</div>
                  <div style={{ height: 6, background: TOKENS.line, borderRadius: 3, position: "relative", overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct * 100}%`, background: barColor, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{val}/{max}</div>
                </div>
              );
            })}
          </div>
          {commentLoading ? (
            <p style={{ fontSize: 12, color: TOKENS.inkSoft, margin: 0, fontStyle: "italic" }}>AI 분석 중...</p>
          ) : aiComment ? (
            <p style={{ fontSize: 12, color: TOKENS.ink, margin: 0, lineHeight: 1.6, background: TOKENS.bg, padding: "10px 12px", borderRadius: 8 }}>✦ {aiComment}</p>
          ) : null}
        </div>
      )}

      {/* 선택 버튼 */}
      {selectable && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(proposal.id); onBack(); }}
          style={{ width: "100%", padding: "14px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 12px rgba(32,40,31,0.18)", letterSpacing: "-0.01em" }}
        >
          이 농가 선택하기
        </button>
      )}
    </div>
  );
}

/* ---------- 대시보드 ---------- */

function StatTile({ label, value, sub, color, bg }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ background: bg || "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? "16px 16px" : "20px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: isMobile ? 26 : 30, fontWeight: 600, color: color || TOKENS.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: TOKENS.inkSoft, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function MiniBarChart({ items, max, colorFn }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(([label, count]) => {
        const pct = max > 0 ? (count / max) * 100 : 0;
        const color = colorFn ? colorFn(label) : TOKENS.moss;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 64, fontSize: 12, color: TOKENS.ink, textAlign: "right", flexShrink: 0 }}>{label}</div>
            <div style={{ flex: 1, height: 8, background: TOKENS.line, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ width: 28, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right", flexShrink: 0 }}>{count}</div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardScreen({ deals, user, onTabChange }) {
  const isMobile = useIsMobile();
  const isChef = user.role === "chef";

  /* ── 셰프 지표 ─────────────────────────────── */
  const myDeals = isChef ? deals.filter((d) => d.createdBy === user.uid) : [];
  const openDeals   = myDeals.filter((d) => d.status === "open");
  const matchedDeals = myDeals.filter((d) => d.status === "matched");
  const doneDeals   = myDeals.filter((d) => d.status === "done");
  const closedDeals = myDeals.filter((d) => d.status === "closed");
  const successCount = matchedDeals.length + doneDeals.length;
  const activeCount  = openDeals.length + matchedDeals.length + doneDeals.length;
  const successRate  = activeCount > 0 ? Math.round((successCount / activeCount) * 100) : 0;
  const chefRevenue  = doneDeals.reduce((sum, d) => {
    const p = d.proposals.find((p) => p.id === d.selectedProposalId);
    return sum + (p ? p.price * d.quantity : 0);
  }, 0);
  const totalReceivedProposals = myDeals.reduce((s, d) => s + d.proposals.length, 0);
  const avgProposals = myDeals.length > 0 ? (totalReceivedProposals / myDeals.length).toFixed(1) : "0";

  const chefCropCounts = myDeals.reduce((acc, d) => { acc[d.crop] = (acc[d.crop] || 0) + 1; return acc; }, {});
  const chefTopCrops = Object.entries(chefCropCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const recentChefDeals = [...myDeals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  /* ── 농가 지표 ─────────────────────────────── */
  const myProposals = !isChef
    ? deals.flatMap((d) =>
        d.proposals.filter((p) => p.farmerName === user.name).map((p) => ({ ...p, deal: d }))
      )
    : [];
  const selectedProps = myProposals.filter((p) => p.deal.selectedProposalId === p.id);
  const selectRate   = myProposals.length > 0 ? Math.round((selectedProps.length / myProposals.length) * 100) : 0;
  const farmRevenue  = selectedProps.reduce((sum, p) => sum + p.price * p.deal.quantity, 0);
  const ratedProps   = myProposals.filter((p) => p.ratedAt);
  const avgRating    = ratedProps.length > 0
    ? (ratedProps.reduce((s, p) => s + p.rating, 0) / ratedProps.length).toFixed(1)
    : null;

  const farmCropCounts = myProposals.reduce((acc, p) => { acc[p.deal.crop] = (acc[p.deal.crop] || 0) + 1; return acc; }, {});
  const farmTopCrops = Object.entries(farmCropCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const recentProposals = [...myProposals].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  /* ── 렌더 ──────────────────────────────────── */
  const sectionStyle = { background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: isMobile ? "16px 14px" : "20px 20px", marginBottom: 14 };
  const sectionLabel = { fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* 환영 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: TOKENS.ink, marginBottom: 2 }}>
          안녕하세요, {user.name} {isChef ? "셰프" : "농가"}님
        </div>
        <div style={{ fontSize: 13, color: TOKENS.inkSoft }}>
          {isChef ? `총 ${myDeals.length}건의 딜을 운영하고 있습니다.` : `총 ${myProposals.length}건의 제안을 보냈습니다.`}
        </div>
      </div>

      {/* KPI 타일 */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {isChef ? (
          <>
            <StatTile label="등록 딜" value={myDeals.length} sub={`모집중 ${openDeals.length} · 진행중 ${matchedDeals.length}`} />
            <StatTile label="성사 딜" value={successCount} sub={`완료 ${doneDeals.length} · 마감 ${closedDeals.length}`} color={TOKENS.moss} bg={TOKENS.mossSoft} />
            <StatTile label="성사율" value={`${successRate}%`} sub={`${activeCount}건 중 ${successCount}건`} color={TOKENS.gold} bg={TOKENS.goldSoft} />
            <StatTile label="누적 거래액" value={chefRevenue >= 10000 ? `${Math.floor(chefRevenue / 10000).toLocaleString()}만` : `${chefRevenue.toLocaleString()}`} sub={`${doneDeals.length}건 완료 기준`} color={TOKENS.rust} bg={TOKENS.rustSoft} />
          </>
        ) : (
          <>
            <StatTile label="보낸 제안" value={myProposals.length} sub={`선택됨 ${selectedProps.length}건`} />
            <StatTile label="선택률" value={`${selectRate}%`} sub={`${myProposals.length}건 중 ${selectedProps.length}건`} color={TOKENS.moss} bg={TOKENS.mossSoft} />
            <StatTile label="누적 거래액" value={farmRevenue >= 10000 ? `${Math.floor(farmRevenue / 10000).toLocaleString()}만` : `${farmRevenue.toLocaleString()}`} sub="선택된 제안 기준" color={TOKENS.rust} bg={TOKENS.rustSoft} />
            <StatTile label="평균 평점" value={avgRating ? `★ ${avgRating}` : "-"} sub={ratedProps.length > 0 ? `${ratedProps.length}건 평가됨` : "아직 평가 없음"} color={TOKENS.gold} bg={TOKENS.goldSoft} />
          </>
        )}
      </div>

      {/* 딜 상태 분포 (셰프) */}
      {isChef && myDeals.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionLabel}>딜 상태 분포</div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
            {[
              { count: openDeals.length, color: TOKENS.gold, label: "모집중" },
              { count: matchedDeals.length, color: TOKENS.moss, label: "진행중" },
              { count: doneDeals.length, color: TOKENS.inkSoft, label: "완료" },
              { count: closedDeals.length, color: TOKENS.rust, label: "마감" },
            ].filter((s) => s.count > 0).map((s) => (
              <div key={s.label} style={{ flex: s.count, background: s.color, minWidth: 4 }} title={`${s.label} ${s.count}건`} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { count: openDeals.length, color: TOKENS.gold, label: "모집중" },
              { count: matchedDeals.length, color: TOKENS.moss, label: "진행중" },
              { count: doneDeals.length, color: TOKENS.inkSoft, label: "완료" },
              { count: closedDeals.length, color: TOKENS.rust, label: "마감" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: TOKENS.inkSoft }}>{s.label}</span>
                <span style={{ fontSize: 12, color: TOKENS.ink, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 12, color: TOKENS.inkSoft }}>평균 {avgProposals}건/딜</div>
          </div>
        </div>
      )}

      {/* 품목 분포 */}
      {(isChef ? chefTopCrops : farmTopCrops).length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionLabel}>{isChef ? "요청 품목 분포" : "제안 품목 분포"}</div>
          <MiniBarChart
            items={isChef ? chefTopCrops : farmTopCrops}
            max={(isChef ? chefTopCrops : farmTopCrops)[0]?.[1] || 1}
            colorFn={() => isChef ? TOKENS.rust : TOKENS.moss}
          />
        </div>
      )}

      {/* 최근 활동 */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>{isChef ? "최근 등록 딜" : "최근 보낸 제안"}</div>
        {isChef ? (
          recentChefDeals.length === 0 ? (
            <div style={{ fontSize: 13, color: TOKENS.inkSoft, textAlign: "center", padding: "20px 0" }}>
              아직 등록한 딜이 없습니다.
              <button onClick={() => onTabChange?.("create")} style={{ display: "block", margin: "12px auto 0", padding: "8px 20px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                첫 딜 만들기
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentChefDeals.map((d) => {
                const statusColor = d.status === "open" ? TOKENS.gold : d.status === "matched" ? TOKENS.moss : d.status === "done" ? TOKENS.inkSoft : TOKENS.rust;
                return (
                  <div key={d.id} onClick={() => onTabChange?.("mydeals")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: TOKENS.bg, borderRadius: 10, cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, color: TOKENS.ink }}>{d.crop}</span>
                      <span style={{ fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{d.quantity}kg · {d.targetPrice.toLocaleString()}원/kg</span>
                    </div>
                    <span style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>제안 {d.proposals.length}건</span>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          recentProposals.length === 0 ? (
            <div style={{ fontSize: 13, color: TOKENS.inkSoft, textAlign: "center", padding: "20px 0" }}>
              아직 보낸 제안이 없습니다.
              <button onClick={() => onTabChange?.("browse")} style={{ display: "block", margin: "12px auto 0", padding: "8px 20px", background: TOKENS.moss, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                딜 찾아보기
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentProposals.map((p) => {
                const isSelected = p.deal.selectedProposalId === p.id;
                const isPending  = !p.deal.selectedProposalId;
                const dotColor   = isSelected ? TOKENS.moss : isPending ? TOKENS.gold : TOKENS.inkSoft;
                return (
                  <div key={p.id} onClick={() => onTabChange?.("myproposals")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: TOKENS.bg, borderRadius: 10, cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, color: TOKENS.ink }}>{p.deal.crop}</span>
                      <span style={{ fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{p.price.toLocaleString()}원/kg · {p.availableQty}kg</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: dotColor, flexShrink: 0 }}>
                      {isSelected ? "✓ 선택됨" : isPending ? "검토 중" : "미선택"}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
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

function MyDealsScreen({ deals, onSelectProposal, onCompleteDeal, onOpenChat, onEdit, onDelete, onClose, onRateProposal, onClone, onViewContract, onTabChange, chatUnreads = {} }) {
  const [expandedId, setExpandedId] = useState(deals[0]?.id ?? null);
  const [deletingId, setDeletingId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  const [statusFilter, setStatusFilter] = useState("전체");
  const [proposalSort, setProposalSort] = useState("score");
  const [detailProposal, setDetailProposal] = useState(null);

  if (detailProposal) {
    const { proposal, deal } = detailProposal;
    const score = calcMatchScore(deal, proposal);
    return (
      <ProposalDetailView
        proposal={proposal}
        deal={deal}
        score={score}
        selectable={deal.status === "open"}
        onSelect={(proposalId) => onSelectProposal(deal.id, proposalId)}
        onBack={() => setDetailProposal(null)}
      />
    );
  }

  if (deals.length === 0) {
    return (
      <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 32, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
        <div style={{ marginBottom: 12 }}>아직 등록한 딜이 없습니다.</div>
        <button onClick={() => onTabChange?.("create")} style={{ padding: "8px 20px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          첫 딜 만들기
        </button>
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
          <div style={{ marginBottom: 10 }}>{STATUS_FILTERS.find((f) => f.key === statusFilter)?.label} 딜이 없습니다.</div>
          <button onClick={() => setStatusFilter("전체")} style={{ padding: "6px 16px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 12, color: TOKENS.inkSoft, cursor: "pointer" }}>
            전체 보기
          </button>
        </div>
      )}
      {filtered.map((deal) => {
        const expanded = expandedId === deal.id;
        const scoredProposals = deal.proposals.map((p) => ({ ...p, _score: calcMatchScore(deal, p) }));
        const sortedProposals = [...scoredProposals].sort((a, b) =>
          proposalSort === "score" ? b._score.total - a._score.total : a.price - b.price
        );
        const selectedProposal = deal.proposals.find((p) => p.id === deal.selectedProposalId);
        const statusAccent = deal.status === "open" ? TOKENS.gold : deal.status === "matched" ? TOKENS.moss : deal.status === "done" ? TOKENS.inkSoft : TOKENS.rust;
        return (
          <div key={deal.id} className="ftt-card" style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderLeft: `4px solid ${statusAccent}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(32,40,31,0.05), 0 2px 12px rgba(32,40,31,0.03)" }}>
            {deal.photoURL && (
              <div style={{ float: "right", marginLeft: 12, marginBottom: 4 }}>
                <img src={deal.photoURL} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", display: "block" }} />
              </div>
            )}
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", cursor: "pointer" }}
              onClick={() => setExpandedId(expanded ? null : deal.id)}
            >
              <div>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: TOKENS.ink }}>{deal.crop}</span>
                <span style={{ fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{deal.chefName}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: TOKENS.inkSoft }}>{expanded ? "▲" : "▼"}</span>
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
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, color: TOKENS.inkSoft }}>정렬</span>
                          {["score", "price"].map((s) => (
                            <button
                              key={s}
                              onClick={() => setProposalSort(s)}
                              style={{
                                padding: "3px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                                border: `1px solid ${proposalSort === s ? TOKENS.moss : TOKENS.line}`,
                                background: proposalSort === s ? TOKENS.mossSoft : "#fff",
                                color: proposalSort === s ? TOKENS.moss : TOKENS.inkSoft,
                              }}
                            >
                              {s === "score" ? "매칭 점수순" : "가격순"}
                            </button>
                          ))}
                        </div>
                        {sortedProposals.map((p) => (
                          <ProposalCard
                            key={p.id}
                            proposal={p}
                            deal={deal}
                            isSelected={false}
                            selectable
                            score={p._score}
                            onSelect={(proposalId) => onSelectProposal(deal.id, proposalId)}
                            onClick={() => setDetailProposal({ proposal: p, deal })}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {(deal.status === "matched" || deal.status === "done") && selectedProposal && (
                  <>
                    <ProposalCard proposal={selectedProposal} deal={deal} isSelected selectable={false} onSelect={() => {}} score={calcMatchScore(deal, selectedProposal)} />
                    <SettlementCard deal={deal} proposal={selectedProposal} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => onOpenChat({ dealId: deal.id, crop: deal.crop, chefName: deal.chefName, farmName: selectedProposal.farmName })}
                        style={{ flex: 1, minWidth: 120, padding: "10px 0", background: TOKENS.mossSoft, color: TOKENS.moss, border: `1px solid ${TOKENS.moss}44`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", position: "relative" }}
                      >
                        💬 {selectedProposal.farmName}과 채팅
                        {(chatUnreads[deal.id] || 0) > 0 && (
                          <span style={{ marginLeft: 8, background: TOKENS.rust, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                            {chatUnreads[deal.id]}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => onViewContract(deal, selectedProposal)}
                        style={{ padding: "10px 16px", background: TOKENS.goldSoft, color: "#7A5C20", border: `1px solid ${TOKENS.gold}44`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                      >
                        계약서
                      </button>
                      {deal.status === "matched" && (
                        confirmComplete === deal.id ? (
                          <div style={{ display: "flex", gap: 8, flex: 1 }}>
                            <button onClick={() => { onCompleteDeal(deal.id); setConfirmComplete(null); }} style={{ flex: 1, padding: "10px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>확인 — 정산 완료</button>
                            <button onClick={() => setConfirmComplete(null)} style={{ padding: "10px 14px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 13, color: TOKENS.inkSoft, cursor: "pointer" }}>취소</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmComplete(deal.id)} style={{ flex: 1, minWidth: 120, padding: "10px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                            납품 확인 후 정산 완료 처리
                          </button>
                        )
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
        <button onClick={onBack} className="ftt-btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}>
          ← 뒤로
        </button>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink, fontWeight: 600 }}>{dealInfo.crop} 딜 채팅</div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft }}>{partnerName}와의 대화</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: isMobile ? "14px 12px" : "18px 20px", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 16, marginBottom: 12, boxShadow: "inset 0 1px 4px rgba(32,40,31,0.04)" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: TOKENS.inkSoft, fontSize: 13, padding: "48px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>💬</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink, marginBottom: 6 }}>매칭이 완료됐습니다!</div>
            <div style={{ fontSize: 12 }}>납품 세부사항을 조율해보세요.</div>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.senderName === userName;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {!isMe && <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 4, fontWeight: 500 }}>{m.senderName}</div>}
              <div className={isMe ? "ftt-bubble-mine" : "ftt-bubble-other"} style={{ maxWidth: isMobile ? "85%" : "65%" }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
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
          className={text.trim() ? "ftt-btn-primary" : ""}
          style={{ padding: "10px 20px", fontSize: 13, borderRadius: 10, whiteSpace: "nowrap", background: text.trim() ? undefined : TOKENS.line, color: text.trim() ? undefined : TOKENS.inkSoft, border: "none", cursor: text.trim() ? "pointer" : "default" }}
        >
          전송 ↑
        </button>
      </div>
    </div>
  );
}

/* ---------- 4-0. 내 레스토랑 (셰프) ---------- */

function ChefProfileScreen({ profile, onSave, defaultRestaurantName = "", userId = "" }) {
  const blank = { restaurantName: defaultRestaurantName, region: "", description: "", preferCrops: [], preferGrade: "전체", preferCycle: "전체", photoURL: "" };
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
    <div style={{ maxWidth: 640, margin: "0 auto", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(32,40,31,0.07)" }}>
      <div style={{ background: `linear-gradient(135deg, ${TOKENS.rustSoft}70, transparent)`, borderBottom: `1px solid ${TOKENS.line}`, padding: isMobile ? "16px 14px 14px" : "20px 24px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, ...(data.photoURL ? { boxShadow: "0 4px 12px rgba(32,40,31,0.18)" } : { background: `linear-gradient(145deg, ${TOKENS.rust}, #8B2E18)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${TOKENS.rust}35` }) }}>
          {data.photoURL
            ? <img src={data.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 22 }}>🍳</span>
          }
        </div>
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: TOKENS.ink, margin: "0 0 2px" }}>내 레스토랑 정보</h2>
          <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0, lineHeight: 1.5 }}>저장하면 농가에게 레스토랑 정보가 표시되고, 딜 작성 시 자동으로 불러옵니다.</p>
        </div>
      </div>
      <div style={{ padding: isMobile ? "14px 14px 20px" : "20px 24px 28px" }}>

      {/* 프로필 사진 업로드 */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <ImageUpload
          value={data.photoURL || ""}
          onChange={(url) => update("photoURL", url)}
          label="로고·사진"
          shape="circle"
          size={76}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TOKENS.ink }}>레스토랑 사진</div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 3, lineHeight: 1.5 }}>클릭하여 로고나 대표 사진을 업로드하세요.<br />농가에게 표시됩니다.</div>
        </div>
      </div>

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
        <button onClick={handleSave} style={{ padding: "12px 28px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px rgba(32,40,31,0.18)", letterSpacing: "-0.01em" }}>
          저장하기
        </button>
        {saved && <span style={{ fontSize: 13, color: TOKENS.moss, fontWeight: 500 }}>✓ 저장됐습니다</span>}
      </div>

      {(data.restaurantName || data.preferCrops.length > 0) && (
        <div style={{ marginTop: 24, background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16, boxShadow: "0 1px 6px rgba(32,40,31,0.05)" }}>
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            미리보기
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            {data.photoURL && <img src={data.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink }}>
              {data.restaurantName || "—"}
              {data.region && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: TOKENS.inkSoft, marginLeft: 8 }}>{data.region}</span>}
            </div>
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
    </div>
  );
}

/* ---------- 4. 내 농가 등록 ---------- */

function FarmProfileScreen({ profile, onSave, defaultFarmName = "", deals = [], userName = "", userId = "" }) {
  const blank = { farmName: defaultFarmName, region: "", cert: "인증 없음", specialty: [], description: "", leadTimeDays: "", photoURL: "" };
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
    <div style={{ maxWidth: 640, margin: "0 auto", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(32,40,31,0.07)" }}>
      <div style={{ background: `linear-gradient(135deg, ${TOKENS.mossSoft}80, transparent)`, borderBottom: `1px solid ${TOKENS.line}`, padding: isMobile ? "16px 14px 14px" : "20px 24px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, ...(data.photoURL ? { boxShadow: "0 4px 12px rgba(32,40,31,0.18)" } : { background: `linear-gradient(145deg, ${TOKENS.moss}, #3D5437)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${TOKENS.moss}35` }) }}>
          {data.photoURL
            ? <img src={data.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 22 }}>🌱</span>
          }
        </div>
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: TOKENS.ink, margin: "0 0 2px" }}>내 농가 정보</h2>
          <p style={{ fontSize: 13, color: TOKENS.inkSoft, margin: 0, lineHeight: 1.5 }}>저장해두면 제안서 작성 시 자동으로 불러올 수 있습니다.</p>
        </div>
      </div>
      <div style={{ padding: isMobile ? "14px 14px 20px" : "20px 24px 28px" }}>

      {/* 프로필 사진 업로드 */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <ImageUpload
          value={data.photoURL || ""}
          onChange={(url) => update("photoURL", url)}
          label="농가·사진"
          shape="circle"
          size={76}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: TOKENS.ink }}>농가 사진</div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 3, lineHeight: 1.5 }}>클릭하여 농가 대표 사진을 업로드하세요.<br />셰프에게 표시됩니다.</div>
        </div>
      </div>

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
      <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 6 }}>주문 후 납품까지 소요되는 일수 (예: 2일 후 납품 가능하면 2 입력)</div>
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
        <button onClick={handleSave} style={{ padding: "12px 28px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 10px rgba(32,40,31,0.18)", letterSpacing: "-0.01em" }}>
          저장하기
        </button>
        {saved && <span style={{ fontSize: 13, color: TOKENS.moss, fontWeight: 500 }}>✓ 저장됐습니다</span>}
      </div>

      {(data.farmName || data.specialty.length > 0) && (
        <div style={{ marginTop: 24, background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16, boxShadow: "0 1px 6px rgba(32,40,31,0.05)" }}>
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            미리보기
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            {data.photoURL && <img src={data.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flex: 1 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: TOKENS.ink }}>
                {data.farmName || "—"}
              </span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: TOKENS.inkSoft }}>{data.region}</span>
              {avgRating !== null && (
                <span style={{ fontSize: 12, color: "#7A5C20", marginLeft: "auto" }}>★ {avgRating.toFixed(1)} ({ratedProposals.length}건)</span>
              )}
            </div>
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
  "auth/password-does-not-meet-requirements": "비밀번호는 6자 이상이어야 합니다.",
  "auth/too-many-requests": "잠시 후 다시 시도해주세요.",
  "auth/network-request-failed": "네트워크 오류가 발생했습니다.",
  "auth/operation-not-allowed": "이메일/비밀번호 가입이 비활성화되어 있습니다.",
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
      if (password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
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
    <div style={{
      minHeight: "100vh",
      background: TOKENS.bg,
      backgroundImage: `radial-gradient(ellipse at 15% 60%, ${TOKENS.mossSoft} 0%, transparent 52%), radial-gradient(ellipse at 85% 10%, ${TOKENS.goldSoft} 0%, transparent 45%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? "24px 16px" : 48,
      fontFamily: "'IBM Plex Sans', sans-serif",
      gap: 52,
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" />
      <style>{`
        .ftt-login-card { animation: loginFadeIn 0.32s ease; }
        @keyframes loginFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .ftt-role-btn { transition: all 0.15s ease !important; }
        .ftt-role-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(32,40,31,0.10) !important; }
        .ftt-login-card input:not([type="checkbox"]):focus, .ftt-login-card select:focus, .ftt-login-card textarea:focus {
          outline: none !important; border-color: ${TOKENS.rust} !important; box-shadow: 0 0 0 3px rgba(187,74,46,0.12) !important;
        }
        .ftt-login-card input::placeholder, .ftt-login-card textarea::placeholder { color: rgba(91,99,88,0.50); }
        .ftt-mode-tab { transition: all 0.15s ease; }
      `}</style>

      {/* 왼쪽 브랜드 패널 (데스크톱) */}
      {!isMobile && (
        <div style={{ flex: "0 0 auto", maxWidth: 300, textAlign: "center" }}>
          <div style={{
            width: 76, height: 76, borderRadius: 22,
            background: `linear-gradient(145deg, ${TOKENS.moss}, #2E4A28)`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
            boxShadow: `0 8px 32px ${TOKENS.moss}50`,
          }}>
            <span style={{ fontSize: 38, lineHeight: 1 }}>🌿</span>
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 34, margin: "0 0 10px", color: TOKENS.ink, letterSpacing: "-0.02em" }}>
            Farm-to-Table
          </h1>
          <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: "0 0 28px", lineHeight: 1.7 }}>
            셰프가 원하는 식자재를 공고하면<br />농가가 가격과 조건을 제안하는<br />역경매 방식 선주문 플랫폼
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { icon: "🍳", label: "셰프", desc: "딜 등록·제안 선택" },
              { icon: "🌱", label: "농가", desc: "딜 찾기·제안 보내기" },
            ].map((r) => (
              <div key={r.label} style={{
                background: "rgba(255,255,255,0.65)", backdropFilter: "blur(8px)",
                border: `1px solid ${TOKENS.line}`, borderRadius: 12,
                padding: "14px 10px", textAlign: "center", flex: 1,
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.ink, marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 10, color: TOKENS.inkSoft }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 폼 카드 */}
      <div style={{ maxWidth: 400, width: "100%" }}>
        {isMobile && (
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `linear-gradient(145deg, ${TOKENS.moss}, #2E4A28)`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12, boxShadow: `0 6px 20px ${TOKENS.moss}40`,
            }}>
              <span style={{ fontSize: 28 }}>🌿</span>
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, margin: "0 0 4px", color: TOKENS.ink }}>Farm-to-Table</h1>
            <p style={{ fontSize: 12, color: TOKENS.inkSoft, margin: 0 }}>역경매 방식 선주문 플랫폼</p>
          </div>
        )}

        <div className="ftt-login-card" style={{
          background: "#FFFFFF",
          borderRadius: 20,
          padding: isMobile ? "28px 24px" : "40px",
          boxShadow: "0 2px 4px rgba(32,40,31,0.03), 0 24px 64px rgba(32,40,31,0.12)",
          border: `1px solid ${TOKENS.line}`,
        }}>
          {/* 탭 전환 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 24, background: `${TOKENS.line}60`, borderRadius: 10, padding: 4 }}>
            {[{ key: "login", label: "로그인" }, { key: "signup", label: "신규 가입" }].map((m) => (
              <button key={m.key} className="ftt-mode-tab" type="button" onClick={() => { setMode(m.key); setError(""); }}
                style={{
                  padding: "9px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                  borderRadius: 7,
                  background: mode === m.key ? "#FFFFFF" : "transparent",
                  color: mode === m.key ? TOKENS.ink : TOKENS.inkSoft,
                  boxShadow: mode === m.key ? "0 1px 4px rgba(32,40,31,0.10)" : "none",
                }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* 역할 선택 (가입 시만) */}
          {mode === "signup" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { key: "chef", label: "셰프", desc: "딜 등록·제안 선택", color: TOKENS.rust, soft: TOKENS.rustSoft, icon: "🍳" },
                { key: "farmer", label: "농가", desc: "딜 찾기·제안 보내기", color: TOKENS.moss, soft: TOKENS.mossSoft, icon: "🌱" },
              ].map((r) => (
                <button key={r.key} className="ftt-role-btn" type="button" onClick={() => { setRole(r.key); setError(""); }}
                  style={{
                    padding: "18px 12px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                    border: `2px solid ${role === r.key ? r.color : TOKENS.line}`,
                    background: role === r.key ? r.soft : `${TOKENS.bg}80`,
                  }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{r.icon}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: TOKENS.ink, marginBottom: 2 }}>{r.label}</div>
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
            style={{
              marginTop: 20, width: "100%", padding: "13px 0",
              background: loading ? TOKENS.line : TOKENS.ink,
              color: loading ? TOKENS.inkSoft : TOKENS.bg,
              border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              boxShadow: loading ? "none" : "0 2px 12px rgba(32,40,31,0.18)",
              transition: "all 0.15s ease",
              letterSpacing: "-0.01em",
            }}>
            {loading ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
          </button>

          <p style={{ fontSize: 12, color: TOKENS.inkSoft, textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            로그인 상태는 자동으로 유지됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- 계약서 ---------- */

function ContractModal({ deal, proposal, onClose }) {
  const contractNo = `FTT-${deal.id.slice(-6).toUpperCase()}-${new Date(deal.selectedAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, "")}`;
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const totalAmt = proposal.price * deal.quantity;
  const deposit = Math.round(totalAmt * DEPOSIT_RATE);
  const balance = Math.round(totalAmt * (1 - DEPOSIT_RATE));
  const fee = Math.round(totalAmt * FEE_RATE);

  const handlePrint = () => {
    const content = document.getElementById("ftt-contract-body").innerHTML;
    const win = window.open("", "_blank", "width=820,height=1000");
    win.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
      <title>계약서 ${contractNo}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Fraunces:wght@700&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'IBM Plex Sans KR',sans-serif;color:#1A1A1A;padding:40px 48px;max-width:720px;margin:0 auto}
        table{width:100%;border-collapse:collapse;font-size:13px}
        td{padding:8px 12px;border-bottom:1px solid #F0F0F0}
        td:first-child{background:#FAFAFA;width:36%;color:#555;font-weight:500}
        @media print{@page{margin:15mm}body{padding:0}}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const row = (k, v, bold) => (
    <tr key={k}>
      <td style={{ padding: "8px 12px", background: "#FAFAFA", width: "36%", color: "#555", fontWeight: 500, borderBottom: "1px solid #F0F0F0" }}>{k}</td>
      <td style={{ padding: "8px 12px", borderBottom: "1px solid #F0F0F0", fontWeight: bold ? 700 : 400 }}>{v}</td>
    </tr>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(32,40,31,0.75)", zIndex: 1000, overflowY: "auto", padding: "32px 16px" }}>
      <div style={{ background: "#fff", maxWidth: 720, margin: "0 auto", borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>

        {/* 상단 액션바 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", background: TOKENS.card, borderBottom: `1px solid ${TOKENS.line}` }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TOKENS.inkSoft }}>{contractNo}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{ padding: "7px 18px", background: TOKENS.moss, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              인쇄 / PDF 저장
            </button>
            <button onClick={onClose} style={{ padding: "7px 14px", background: "transparent", border: `1px solid ${TOKENS.line}`, borderRadius: 8, fontSize: 13, cursor: "pointer", color: TOKENS.inkSoft }}>
              닫기
            </button>
          </div>
        </div>

        {/* 계약서 본문 */}
        <div id="ftt-contract-body" style={{ padding: "40px 48px", fontFamily: "'IBM Plex Sans', sans-serif", color: "#1A1A1A" }}>

          {/* 헤더 */}
          <div style={{ textAlign: "center", marginBottom: 32, paddingBottom: 24, borderBottom: "2px solid #1A1A1A" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#888", marginBottom: 8 }}>FARM-TO-TABLE PLATFORM</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>식자재 공급 계약서</div>
            <div style={{ fontSize: 11, color: "#888" }}>Agricultural Supply Contract</div>
          </div>

          {/* 계약 정보 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, fontSize: 12, color: "#666" }}>
            <span><b style={{ color: "#1A1A1A" }}>계약번호</b>&nbsp; {contractNo}</span>
            <span><b style={{ color: "#1A1A1A" }}>작성일</b>&nbsp; {today}</span>
          </div>

          {/* 계약 당사자 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
            {[
              { role: "갑 (매수인 / BUYER)", name: deal.chefName, sub1: `지역: ${deal.chefRegion || "미입력"}`, sub2: "역할: 레스토랑" },
              { role: "을 (매도인 / SELLER)", name: proposal.farmName, sub1: `담당: ${proposal.farmerName || proposal.farmName}`, sub2: `인증: ${proposal.cert || "인증 없음"}` },
            ].map(({ role, name, sub1, sub2 }) => (
              <div key={role} style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#888", marginBottom: 8 }}>{role}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 12, color: "#555" }}>{sub1}</div>
                <div style={{ fontSize: 12, color: "#555" }}>{sub2}</div>
              </div>
            ))}
          </div>

          {/* 제1조 품목 */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, borderLeft: `3px solid ${TOKENS.moss}`, paddingLeft: 10, marginBottom: 10 }}>제1조 공급 품목 및 규격</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {row("품목", deal.crop)}
                {row("등급", deal.grade)}
                {row("규격 조건", deal.sizeCondition)}
                {row("수확 단계", deal.ripeness || "협의")}
                {row("인증", proposal.cert || "인증 없음")}
              </tbody>
            </table>
          </div>

          {/* 제2조 수량·단가 */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, borderLeft: `3px solid ${TOKENS.moss}`, paddingLeft: 10, marginBottom: 10 }}>제2조 수량 및 대금</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {row("공급 수량", `${deal.quantity.toLocaleString()} kg`)}
                {row("계약 단가", `${proposal.price.toLocaleString()} 원/kg`)}
                {row("총 계약금액", `${totalAmt.toLocaleString()} 원`, true)}
              </tbody>
            </table>
          </div>

          {/* 제3조 납품 */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, borderLeft: `3px solid ${TOKENS.moss}`, paddingLeft: 10, marginBottom: 10 }}>제3조 납품 조건</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {row("납품 예정일", proposal.availableDate || deal.deliveryDate)}
                {row("납품 주기", deal.cycle || "단발성(1회)")}
                {row("납품 장소", deal.chefRegion || "별도 협의")}
              </tbody>
            </table>
          </div>

          {/* 제4조 결제 */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, borderLeft: `3px solid ${TOKENS.moss}`, paddingLeft: 10, marginBottom: 10 }}>제4조 결제 조건</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {row("선급금 (계약금 30%)", `${deposit.toLocaleString()} 원`)}
                {row("잔금 (납품 완료 후 70%)", `${balance.toLocaleString()} 원`)}
                {row("플랫폼 수수료 10% (을 부담)", `${fee.toLocaleString()} 원`)}
                {row("실수령액 (을)", `${(totalAmt - fee).toLocaleString()} 원`, true)}
              </tbody>
            </table>
          </div>

          {/* 특이사항 */}
          {deal.note && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, borderLeft: `3px solid ${TOKENS.moss}`, paddingLeft: 10, marginBottom: 8 }}>특이사항</div>
              <div style={{ background: "#FAFAFA", border: "1px solid #E8E8E8", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#555", lineHeight: 1.6 }}>{deal.note}</div>
            </div>
          )}

          {/* 서명란 */}
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E0E0E0" }}>
            <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 28 }}>위 내용에 합의하며 본 계약서를 작성합니다.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
              {[{ label: "갑 (매수인)", name: deal.chefName }, { label: "을 (매도인)", name: proposal.farmName }].map(({ label, name }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 28 }}>{name}</div>
                  <div style={{ borderTop: "1px solid #1A1A1A", paddingTop: 6, fontSize: 10, color: "#aaa" }}>서명 / Signature</div>
                </div>
              ))}
            </div>
          </div>

          {/* 푸터 */}
          <div style={{ marginTop: 28, textAlign: "center", fontSize: 10, color: "#bbb", borderTop: "1px solid #F0F0F0", paddingTop: 14 }}>
            본 계약서는 Farm-to-Table 역경매 플랫폼에서 자동 생성되었습니다. · {contractNo}
          </div>
        </div>
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
  const [notifHistory, setNotifHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("notif-history") || "[]"); } catch { return []; }
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadNotifCount = notifHistory.filter((n) => !n.read).length;

  useEffect(() => {
    _recordNotif = (notif) => {
      setNotifHistory((prev) => {
        const next = [notif, ...prev].slice(0, 50);
        localStorage.setItem("notif-history", JSON.stringify(next));
        return next;
      });
    };
    return () => { _recordNotif = null; };
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const close = (e) => { if (!e.target.closest("[data-notif-panel]")) setNotifOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [notifOpen]);
  const [loadState, setLoadState] = useState("loading");
  const [saveState, setSaveState] = useState("idle");
  const [chats, setChats] = useState({});
  const [chatTarget, setChatTarget] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [cloningDeal, setCloningDeal] = useState(null);
  const [lastMyDealsVisit, setLastMyDealsVisit] = useState(() => Number(localStorage.getItem("last-mydeals-visit") || 0));
  const [seenSelections, setSeenSelections] = useState(() => { try { return JSON.parse(localStorage.getItem("seen-selections") || "[]"); } catch { return []; } });
  const [lastChatRead, setLastChatRead] = useState(() => { try { return JSON.parse(localStorage.getItem("last-chat-read") || "{}"); } catch { return {}; } });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [contractTarget, setContractTarget] = useState(null);
  const userRef = useRef(null);
  const prevDealsRef = useRef(null);
  const prevChatsRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

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
        const snapshot = await getDocs(collection(db, "deals"));
        if (cancelled) return;
        setDeals(snapshot.docs.map((d) => d.data()));
        const farmResult = user?.uid ? await storage.get(farmProfileKey(user.uid)) : null;
        if (!cancelled && farmResult?.value) setFarm(JSON.parse(farmResult.value));
        const chefResult = user?.uid ? await storage.get(chefProfileKey(user.uid)) : null;
        if (!cancelled && chefResult?.value) setChefProfile(JSON.parse(chefResult.value));
        if (user?.uid) {
          const chatsSnap = await getDocs(collection(db, "chats"));
          if (!cancelled) {
            const loaded = {};
            chatsSnap.forEach((d) => { loaded[d.id] = d.data().messages || []; });
            setChats(loaded);
          }
        }
        if (!cancelled) setLoadState("ready");
      } catch (err) {
        console.error("[로드 오류]", err?.code, err?.message, err);
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [authChecked]);

  // 납품일 지난 모집중 딜 자동 마감
  useEffect(() => {
    if (loadState !== "ready" || deals.length === 0) return;
    const today = new Date().toISOString().split("T")[0];
    const expired = deals.filter((d) => d.status === "open" && d.deliveryDate && d.deliveryDate < today);
    if (expired.length === 0) return;
    const closedDeals = expired.map((d) => ({ ...d, status: "closed", closedAt: Date.now(), closeReason: "expired" }));
    setDeals((prev) => prev.map((d) => { const c = closedDeals.find((x) => x.id === d.id); return c || d; }));
    const batch = writeBatch(db);
    closedDeals.forEach((d) => batch.set(doc(db, "deals", d.id), d));
    batch.commit().catch(() => {});
  }, [loadState]); // eslint-disable-line react-hooks/exhaustive-deps

  // 딜·채팅 실시간 동기화
  useEffect(() => {
    if (loadState !== "ready") return;
    const unsubDeals = onSnapshot(collection(db, "deals"), (snapshot) => {
      const newDeals = snapshot.docs.map((d) => d.data());
      const prev = prevDealsRef.current;
      const cu = userRef.current;
      if (prev && cu) {
        if (cu.role === "chef") {
          newDeals.forEach((deal) => {
            if (deal.createdBy !== cu.uid) return;
            const old = prev.find((d) => d.id === deal.id);
            if (old && deal.proposals.length > old.proposals.length) {
              const p = deal.proposals[deal.proposals.length - 1];
              showPushNotification(
                `새 제안 도착 — ${deal.crop}`,
                `${p.farmName}에서 ${p.price.toLocaleString()}원/kg으로 제안했습니다.`
              );
            }
          });
        } else {
          newDeals.forEach((deal) => {
            const old = prev.find((d) => d.id === deal.id);
            if (!old || !deal.selectedProposalId || deal.selectedProposalId === old.selectedProposalId) return;
            const mine = deal.proposals.find((p) => p.farmerName === cu.name && p.id === deal.selectedProposalId);
            if (mine) {
              showPushNotification(
                "🎉 제안이 선택됐습니다!",
                `${deal.chefName}의 ${deal.crop} 딜에서 내 제안이 선택됐습니다.`
              );
            }
          });
        }
      }
      prevDealsRef.current = newDeals;
      setDeals(newDeals);
    });
    const unsubChats = onSnapshot(collection(db, "chats"), (snapshot) => {
      const newChats = {};
      snapshot.forEach((d) => { newChats[d.id] = d.data().messages || []; });
      const prev = prevChatsRef.current;
      const cu = userRef.current;
      if (prev && cu) {
        Object.entries(newChats).forEach(([dealId, msgs]) => {
          const prevMsgs = prev[dealId] || [];
          msgs.slice(prevMsgs.length).forEach((msg) => {
            if (msg.senderName !== cu.name) {
              showPushNotification(
                `새 메시지 — ${msg.senderName}`,
                msg.text.length > 60 ? msg.text.slice(0, 60) + "…" : msg.text
              );
            }
          });
        });
      }
      prevChatsRef.current = newChats;
      setChats(newChats);
    });
    return () => { unsubDeals(); unsubChats(); };
  }, [loadState]);

  const persistDeal = async (deal) => {
    setSaveState("saving");
    try {
      await setDoc(doc(db, "deals", deal.id), deal);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const deleteDealDoc = async (dealId) => {
    setSaveState("saving");
    try {
      await deleteDoc(doc(db, "deals", dealId));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setTab(userData.role === "farmer" ? "browse" : "create");
    registerSW();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
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
    await storage.set(farmProfileKey(user.uid), JSON.stringify(farmData));
  };

  const handleSaveChefProfile = async (profileData) => {
    setChefProfile(profileData);
    await storage.set(chefProfileKey(user.uid), JSON.stringify(profileData));
  };

  const handleResetData = async () => {
    const batch = writeBatch(db);
    deals.forEach((d) => batch.delete(doc(db, "deals", d.id)));
    SAMPLE_DEALS.forEach((d) => batch.set(doc(db, "deals", d.id), d));
    await batch.commit();
    setDeals(SAMPLE_DEALS);
  };

  const handleCreateDeal = (deal) => {
    const newDeal = { ...deal, createdBy: user.uid || user.name };
    setDeals((prev) => [newDeal, ...prev]);
    persistDeal(newDeal);
    setTab("mydeals");
  };

  const handleSubmitProposal = (dealId, proposal) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const updated = { ...deal, proposals: [...deal.proposals, proposal] };
    setDeals((prev) => prev.map((d) => d.id === dealId ? updated : d));
    persistDeal(updated);
  };

  const handleSelectProposal = (dealId, proposalId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const updated = { ...deal, selectedProposalId: proposalId, status: "matched", selectedAt: Date.now() };
    setDeals((prev) => prev.map((d) => d.id === dealId ? updated : d));
    persistDeal(updated);
  };

  const handleCompleteDeal = (dealId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const updated = { ...deal, status: "done", completedAt: Date.now() };
    setDeals((prev) => prev.map((d) => d.id === dealId ? updated : d));
    persistDeal(updated);
  };

  const handleSendMessage = async (dealId, text) => {
    const newMsg = { id: `m${Date.now()}`, senderName: user.name, senderRole: user.role, text, ts: Date.now() };
    const updatedMsgs = [...(chats[dealId] || []), newMsg];
    setChats((prev) => ({ ...prev, [dealId]: updatedMsgs }));
    await setDoc(doc(db, "chats", dealId), { messages: updatedMsgs });
  };

  const handleOpenChat = (target) => {
    setChatTarget(target);
    const updated = { ...lastChatRead, [target.dealId]: Date.now() };
    setLastChatRead(updated);
    localStorage.setItem("last-chat-read", JSON.stringify(updated));
  };

  const handleEditDeal = (deal) => { setEditingDeal(deal); setCloningDeal(null); setTab("create"); };
  const handleCancelEdit = () => { setEditingDeal(null); setTab("mydeals"); };
  const handleCloneDeal = (deal) => { setCloningDeal(deal); setEditingDeal(null); setTab("create"); };
  const handleCancelClone = () => { setCloningDeal(null); setTab("mydeals"); };
  const handleUpdateDeal = (updated) => {
    setDeals((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    persistDeal(updated);
    setEditingDeal(null);
    setTab("mydeals");
  };
  const handleDeleteDeal = (dealId) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    deleteDealDoc(dealId);
  };

  const handleCloseDeal = (dealId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const updated = { ...deal, status: "closed", closedAt: Date.now() };
    setDeals((prev) => prev.map((d) => d.id === dealId ? updated : d));
    persistDeal(updated);
  };

  const handleCancelProposal = (dealId, proposalId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const updated = { ...deal, proposals: deal.proposals.filter((p) => p.id !== proposalId) };
    setDeals((prev) => prev.map((d) => d.id === dealId ? updated : d));
    persistDeal(updated);
  };

  const handleRateProposal = (dealId, proposalId, rating, review) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const updated = { ...deal, proposals: deal.proposals.map((p) => p.id === proposalId ? { ...p, rating, review, ratedAt: Date.now() } : p) };
    setDeals((prev) => prev.map((d) => d.id === dealId ? updated : d));
    persistDeal(updated);
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
        <div style={{ marginBottom: 16 }}>데이터를 불러오지 못했습니다.</div>
        <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const isChef = user.role === "chef";
  const openCount = deals.filter((d) => d.status === "open").length;
  const myDeals = isChef
    ? deals.filter((d) => d.createdBy === user.uid)
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

  const chatUnreads = Object.fromEntries(
    Object.entries(chats).map(([dealId, msgs]) => {
      const lastRead = lastChatRead[dealId] || 0;
      const count = msgs.filter((m) => m.ts > lastRead && m.senderName !== user.name).length;
      return [dealId, count];
    })
  );
  const totalUnreadChats = Object.values(chatUnreads).reduce((s, n) => s + n, 0);

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
    ? [{ key: "create", label: editingDeal ? "딜 수정" : cloningDeal ? "딜 복제" : "딜 만들기" }, { key: "mydeals", label: "내 거래", badge: newProposalCount + totalUnreadChats }, { key: "dashboard", label: "대시보드" }, { key: "chefprofile", label: "내 레스토랑" }]
    : [{ key: "browse", label: "딜 찾기" }, { key: "myproposals", label: "내 제안", badge: newSelectionCount + totalUnreadChats }, { key: "dashboard", label: "대시보드" }, { key: "farm", label: "내 농가" }];

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100%", padding: isMobile ? "16px 12px" : "32px 24px", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.ink }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" />
      <style>{`
        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${TOKENS.line}; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #b0aa98; }

        /* ===== FOCUS ===== */
        button:focus-visible, a:focus-visible { outline: 2px solid ${TOKENS.rust}; outline-offset: 2px; border-radius: 4px; }
        input:not([type="checkbox"]):not([type="radio"]):focus,
        select:focus, textarea:focus {
          outline: none !important;
          border-color: ${TOKENS.rust} !important;
          box-shadow: 0 0 0 3px rgba(187,74,46,0.12) !important;
        }
        input::placeholder, textarea::placeholder { color: rgba(91,99,88,0.50); }

        /* ===== CARDS ===== */
        .ftt-card { transition: box-shadow 0.2s ease, transform 0.2s ease; will-change: transform; }
        .ftt-card:hover {
          box-shadow: 0 8px 32px rgba(32,40,31,0.11), 0 2px 8px rgba(32,40,31,0.04) !important;
          transform: translateY(-2px);
        }

        /* ===== TABS ===== */
        .ftt-tab { transition: color 0.15s ease, border-bottom-color 0.15s ease; }
        .ftt-tab:hover { color: ${TOKENS.ink} !important; background: rgba(32,40,31,0.03) !important; border-radius: 6px 6px 0 0; }

        /* ===== SELECT 커스텀 화살표 ===== */
        select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235B6358' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          cursor: pointer;
        }

        /* ===== 화면 전환 애니메이션 ===== */
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ftt-screen-enter { animation: fadeSlideIn 0.25s ease; }

        /* ===== 선택된 제안 하이라이트 ===== */
        .ftt-proposal-selected {
          background: linear-gradient(135deg, rgba(91,117,83,0.08), rgba(201,154,62,0.06)) !important;
          border-color: ${TOKENS.moss} !important;
        }

        /* ===== 로그인 카드 ===== */
        .ftt-login-card { animation: fadeSlideIn 0.3s ease; }
        .ftt-role-btn { transition: all 0.15s ease !important; }
        .ftt-role-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(32,40,31,0.10) !important; }
        .ftt-login-card input:focus, .ftt-login-card select:focus, .ftt-login-card textarea:focus {
          outline: none !important;
          border-color: ${TOKENS.rust} !important;
          box-shadow: 0 0 0 3px rgba(187,74,46,0.12) !important;
        }

        /* ===== PRIMARY BUTTON ===== */
        .ftt-btn-primary {
          background: ${TOKENS.ink}; color: ${TOKENS.bg}; border: none;
          border-radius: 10px; font-size: 14px; font-weight: 600;
          font-family: 'IBM Plex Sans', sans-serif; cursor: pointer; letter-spacing: -0.01em;
          transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
          box-shadow: 0 2px 8px rgba(32,40,31,0.18), 0 1px 2px rgba(32,40,31,0.10);
        }
        .ftt-btn-primary:hover:not(:disabled) {
          background: #2C3829;
          box-shadow: 0 4px 16px rgba(32,40,31,0.22), 0 2px 4px rgba(32,40,31,0.10);
          transform: translateY(-1px);
        }
        .ftt-btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: 0 1px 4px rgba(32,40,31,0.15); }
        .ftt-btn-primary:disabled { background: ${TOKENS.line} !important; color: ${TOKENS.inkSoft} !important; box-shadow: none !important; transform: none !important; cursor: not-allowed; }

        /* ===== SECONDARY BUTTON ===== */
        .ftt-btn-secondary {
          background: transparent; border: 1.5px solid ${TOKENS.line};
          border-radius: 10px; color: ${TOKENS.ink}; font-size: 14px; font-weight: 500;
          font-family: 'IBM Plex Sans', sans-serif; cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .ftt-btn-secondary:hover { border-color: ${TOKENS.inkSoft}; background: rgba(32,40,31,0.04); }

        /* ===== SECTION TITLE ===== */
        .ftt-section-title {
          font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600;
          color: ${TOKENS.ink}; margin: 0 0 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .ftt-section-title::before {
          content: ''; display: inline-block; width: 3px; height: 14px;
          background: ${TOKENS.rust}; border-radius: 2px; flex-shrink: 0;
        }

        /* ===== CHAT BUBBLES ===== */
        .ftt-bubble-mine {
          padding: 10px 15px; border-radius: 18px 18px 4px 18px;
          background: ${TOKENS.ink}; color: ${TOKENS.bg};
          font-size: 14px; line-height: 1.55;
          box-shadow: 0 1px 4px rgba(32,40,31,0.18);
        }
        .ftt-bubble-other {
          padding: 10px 15px; border-radius: 18px 18px 18px 4px;
          background: #FFFFFF; color: ${TOKENS.ink};
          border: 1px solid ${TOKENS.line}; font-size: 14px; line-height: 1.55;
          box-shadow: 0 1px 3px rgba(32,40,31,0.06);
        }

        /* ===== NOTICE BOXES ===== */
        .ftt-notice-gold { background: linear-gradient(135deg, ${TOKENS.goldSoft}, #FFFBF0); border: 1px solid ${TOKENS.gold}55; border-radius: 12px; padding: 14px 18px; box-shadow: 0 1px 6px rgba(201,154,62,0.10); }
        .ftt-notice-moss { background: ${TOKENS.mossSoft}; border: 1px solid ${TOKENS.moss}44; border-radius: 12px; padding: 12px 16px; }

        /* ===== EMPTY STATE ===== */
        .ftt-empty { background: ${TOKENS.card}; border: 1.5px dashed ${TOKENS.line}; border-radius: 14px; padding: 48px 24px; text-align: center; color: ${TOKENS.inkSoft}; }
        .ftt-empty-icon { font-size: 40px; margin-bottom: 12px; display: block; opacity: 0.55; }
        .ftt-empty-title { font-family: 'Fraunces', serif; font-size: 18px; color: ${TOKENS.ink}; margin: 0 0 6px; font-weight: 600; }
        .ftt-empty-desc { font-size: 13px; color: ${TOKENS.inkSoft}; margin: 0 0 20px; line-height: 1.6; }
      `}</style>
      {/* 상단 액센트 바 */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${TOKENS.rust} 0%, ${TOKENS.gold} 50%, ${TOKENS.moss} 100%)`, zIndex: 9999 }} />
      <div style={{ maxWidth: 980, margin: "0 auto", paddingTop: 3 }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${TOKENS.line}`, gap: 12 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", color: TOKENS.rust, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>
              역경매 방식 선주문 플랫폼
            </span>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: isMobile ? 22 : 30, margin: "4px 0 0", letterSpacing: "-0.01em" }}>
              Farm-to-Table
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexShrink: 0 }}>
            <span style={chipBadge(isChef ? TOKENS.rustSoft : TOKENS.mossSoft, isChef ? TOKENS.rust : TOKENS.moss)}>
              {isChef ? "셰프" : "농가"}
            </span>
            <span style={{ fontSize: 13, color: TOKENS.ink, fontWeight: 500 }}>{user.name}</span>
            {/* 벨 아이콘 */}
            <div data-notif-panel style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) {
                    setNotifHistory((prev) => {
                      const next = prev.map((n) => ({ ...n, read: true }));
                      localStorage.setItem("notif-history", JSON.stringify(next));
                      return next;
                    });
                  }
                }}
                style={{ fontSize: 16, background: "none", border: `1px solid ${TOKENS.line}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", position: "relative", lineHeight: 1 }}
              >
                🔔
                {unreadNotifCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: TOKENS.rust, color: "#fff", borderRadius: 999, fontSize: 9, fontWeight: 700, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, maxHeight: 380, overflowY: "auto", background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(32,40,31,0.16)", zIndex: 9998 }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${TOKENS.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>알림</span>
                    {notifHistory.length > 0 && (
                      <button onClick={() => { setNotifHistory([]); localStorage.removeItem("notif-history"); }} style={{ fontSize: 11, color: TOKENS.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0 }}>모두 지우기</button>
                    )}
                  </div>
                  {notifHistory.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: TOKENS.inkSoft }}>알림이 없습니다</div>
                  ) : (
                    notifHistory.map((n) => (
                      <div key={n.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${TOKENS.line}`, background: n.read ? "#FFFFFF" : `${TOKENS.gold}10` }}>
                        <div style={{ fontSize: 13, color: TOKENS.ink, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: TOKENS.inkSoft, lineHeight: 1.5 }}>{n.body}</div>
                        <div style={{ fontSize: 10, color: TOKENS.inkSoft, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {new Date(n.ts).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
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
              className="ftt-tab"
              onClick={() => handleTabClick(t.key)}
              style={{
                padding: isMobile ? "10px 12px" : "10px 20px", background: "transparent", border: "none",
                borderBottom: `2px solid ${tab === t.key ? TOKENS.rust : "transparent"}`,
                color: tab === t.key ? TOKENS.ink : TOKENS.inkSoft,
                fontSize: isMobile ? 13 : 14, fontWeight: tab === t.key ? 600 : 400,
                cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap", flexShrink: 0,
                position: "relative", letterSpacing: tab === t.key ? "-0.01em" : "normal",
              }}
            >
              {t.label}
              {t.key === "browse" && <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{openCount}</span>}
              {t.key === "mydeals" && <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{myDeals.length}</span>}
              {t.badge > 0 && (
                <span style={{
                  marginLeft: 6,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 16, height: 16, borderRadius: 999,
                  background: TOKENS.rust, color: "#fff",
                  fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
                  padding: "0 5px", lineHeight: 1, verticalAlign: "middle",
                }}>
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {installPrompt && (
            <button onClick={handleInstall} style={{ fontSize: 11, color: TOKENS.moss, background: `${TOKENS.moss}12`, border: `1px solid ${TOKENS.moss}40`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", marginBottom: 10, flexShrink: 0, fontWeight: 600 }}>
              앱 설치
            </button>
          )}
          {!isMobile && (
            <button onClick={handleResetData} style={{ fontSize: 11, color: TOKENS.inkSoft, background: "none", border: `1px solid ${TOKENS.line}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", marginBottom: 10, flexShrink: 0 }}>
              샘플 초기화
            </button>
          )}
          <span style={{ fontSize: 11, color: saveState === "error" ? TOKENS.rust : TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", paddingBottom: 10, flexShrink: 0, display: (!isMobile || saveState === "error") ? "inline" : "none" }}>
            {saveState === "saving" && "저장 중…"}
            {saveState === "saved" && (!isMobile ? "저장됨" : "")}
            {saveState === "error" && "⚠ 저장 실패 — 네트워크를 확인해주세요"}
          </span>
        </div>

        {contractTarget && (
          <ContractModal
            deal={contractTarget.deal}
            proposal={contractTarget.proposal}
            onClose={() => setContractTarget(null)}
          />
        )}

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
            {tab === "create" && <DealCreateScreen key={editingDeal?.id ?? (cloningDeal ? `clone-${cloningDeal.id}` : "new")} onCreate={(deal) => { handleCreateDeal(deal); setCloningDeal(null); }} defaultChefName={user.name} editingDeal={editingDeal} onUpdate={handleUpdateDeal} onCancelEdit={editingDeal ? handleCancelEdit : cloningDeal ? handleCancelClone : null} cloningFrom={cloningDeal} userId={user.uid} />}
            {tab === "browse" && <DealBrowseScreen deals={deals} onSubmitProposal={handleSubmitProposal} farmProfile={farm} userName={user.name} />}
            {tab === "myproposals" && <MyProposalsScreen deals={deals} userName={user.name} onOpenChat={handleOpenChat} onCancelProposal={handleCancelProposal} onViewContract={(deal, proposal) => setContractTarget({ deal, proposal })} chatUnreads={chatUnreads} />}
            {tab === "mydeals" && <MyDealsScreen deals={myDeals} onSelectProposal={handleSelectProposal} onCompleteDeal={handleCompleteDeal} onOpenChat={handleOpenChat} onEdit={handleEditDeal} onDelete={handleDeleteDeal} onClose={handleCloseDeal} onRateProposal={handleRateProposal} onClone={handleCloneDeal} onViewContract={(deal, proposal) => setContractTarget({ deal, proposal })} onTabChange={(key) => setTab(key)} chatUnreads={chatUnreads} />}
            {tab === "farm" && <FarmProfileScreen profile={farm} onSave={handleSaveFarm} defaultFarmName={user.name} deals={deals} userName={user.name} userId={user.uid} />}
            {tab === "chefprofile" && <ChefProfileScreen profile={chefProfile} onSave={handleSaveChefProfile} defaultRestaurantName={user.name} userId={user.uid} />}
            {tab === "dashboard" && <DashboardScreen deals={deals} user={user} onTabChange={handleTabClick} />}
          </>
        )}
      </div>
    </div>
  );
}
