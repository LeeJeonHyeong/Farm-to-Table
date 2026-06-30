import { useState, useEffect } from "react";

const DEALS_KEY = "deals-list";

// Claude.ai Artifacts 환경에서는 window.storage가 자동으로 주입되지만,
// 일반 브라우저(이 VS Code/Vite 프로젝트)에서는 없으므로 localStorage로 대체합니다.
// 실제 서비스로 전환할 때는 이 부분을 백엔드 API 호출로 교체하세요.
const storage =
  typeof window !== "undefined" && window.storage
    ? window.storage
    : {
        async get(key) {
          const value = localStorage.getItem(key);
          return value !== null ? { key, value, shared: false } : null;
        },
        async set(key, value) {
          localStorage.setItem(key, value);
          return { key, value, shared: false };
        },
      };

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
  바질: { unit: "kg" },
  블루베리: { unit: "kg" },
  딸기: { unit: "kg" },
  로메인: { unit: "kg" },
  로즈마리: { unit: "kg" },
  애호박: { unit: "kg" },
  고수: { unit: "kg" },
};
const CROP_OPTIONS = Object.keys(CROPS);

const RIPENESS_STAGES = {
  토마토: ["그린(미숙)", "브레이커", "터닝", "핑크", "라이트레드", "레드(완숙)"],
  바질: ["마이크로그린", "어린잎", "성숙잎"],
  블루베리: ["그린", "레드(미숙)", "블루(수확기)", "완숙 블루"],
  딸기: ["화이트(미숙)", "핑크", "레드 70%", "완숙(레드 100%)"],
  로메인: ["베이비잎", "중간생장", "완전결구"],
  로즈마리: ["어린순", "성숙순"],
  애호박: ["미니(꽃달림)", "중간", "성숙"],
  고수: ["마이크로그린", "어린잎", "성숙잎"],
};

const GRADE_LEVELS = ["보통", "상", "특"];
const CYCLE_OPTIONS = ["단발성(1회)", "주 1회", "주 2회", "격주"];
const DEAL_STATUS_LABEL = { open: "모집중", matched: "진행중", done: "완료" };
const DEAL_STATUS_COLOR = { open: TOKENS.gold, matched: TOKENS.moss, done: TOKENS.inkSoft };
const DEPOSIT_RATE = 0.3;
const FEE_RATE = 0.1;

const SAMPLE_DEALS = [
  {
    id: "d1",
    chefName: "테이블나인",
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
    crop: "바질",
    sizeCondition: "잎 길이 4cm 이상",
    ripeness: "어린잎",
    grade: "상",
    quantity: 20,
    deliveryDate: "2026-07-15",
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
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {DEAL_STEPS.map((s) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
              background: s.key <= step ? TOKENS.ink : TOKENS.line,
              color: s.key <= step ? TOKENS.bg : TOKENS.inkSoft,
            }}
          >
            {s.key}
          </div>
          <span style={{ fontSize: 12, color: s.key === step ? TOKENS.ink : TOKENS.inkSoft }}>{s.label}</span>
          {s.key !== DEAL_STEPS.length && <div style={{ width: 16, height: 1, background: TOKENS.line }} />}
        </div>
      ))}
    </div>
  );
}

function DealCreateScreen({ onCreate }) {
  const blank = {
    chefName: "", crop: "토마토", sizeCondition: "", ripeness: RIPENESS_STAGES["토마토"][2],
    grade: "상", quantity: "", deliveryDate: "", cycle: "주 1회", targetPrice: "", note: "",
  };
  const [step, setStep] = useState(1);
  const [data, setData] = useState(blank);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const handleCropChange = (crop) => {
    const stages = RIPENESS_STAGES[crop] || [];
    setData((d) => ({ ...d, crop, ripeness: stages[Math.floor(stages.length / 2)] || "" }));
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

  const stages = RIPENESS_STAGES[data.crop] || [];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 14, padding: 24 }}>
      <StepIndicator step={step} />

      {step === 1 && (
        <Section title="1. 레스토랑 · 품목">
          <FieldLabel required>레스토랑명</FieldLabel>
          <input type="text" placeholder="예: 테이블나인" value={data.chefName} onChange={(e) => update("chefName", e.target.value)} style={inputStyle} />
          {errors.chefName && <ErrorText text={errors.chefName} />}

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
        <Section title="5. 등록 전 확인">
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
        {step < 5 ? (
          <button onClick={goNext} style={{ flex: 1, padding: "12px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            다음
          </button>
        ) : (
          <button onClick={handleSubmit} style={{ flex: 1, padding: "12px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            딜 등록하고 농가 제안 받기
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
  leadTimeDays: "납품 가능 일수",
};

function ProposalForm({ deal, onSubmit, onCancel }) {
  const blank = { farmName: "", region: "", price: "", availableQty: "", leadTimeDays: "", cert: "", message: "" };
  const [data, setData] = useState(blank);
  const [errors, setErrors] = useState({});
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
        farmName: data.farmName,
        region: data.region,
        price: Number(data.price),
        availableQty: Number(data.availableQty),
        leadTimeDays: Number(data.leadTimeDays),
        cert: data.cert || "인증 없음",
        rating: 4.0,
        message: data.message,
        createdAt: Date.now(),
      });
    }
  };

  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 16, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          <FieldLabel required>납품 가능 일수 (일)</FieldLabel>
          <input type="number" min={0} value={data.leadTimeDays} onChange={(e) => update("leadTimeDays", e.target.value)} style={inputStyle} />
          {errors.leadTimeDays && <ErrorText text={errors.leadTimeDays} />}
        </div>
        <div>
          <FieldLabel>보유 인증</FieldLabel>
          <input type="text" placeholder="예: GAP" value={data.cert} onChange={(e) => update("cert", e.target.value)} style={inputStyle} />
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

function DealBrowseScreen({ deals, onSubmitProposal }) {
  const [openFormId, setOpenFormId] = useState(null);
  const openDeals = deals.filter((d) => d.status === "open");

  if (openDeals.length === 0) {
    return (
      <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 32, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
        현재 모집 중인 딜이 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, margin: "0 auto" }}>
      {openDeals.map((deal) => (
        <div key={deal.id} style={{ background: TOKENS.card, border: `1px solid ${TOKENS.line}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, color: TOKENS.ink }}>{deal.crop}</span>
            <StatusBadge status={deal.status} />
          </div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 2 }}>
            {deal.chefName} · 희망단가 {deal.targetPrice.toLocaleString()}원/kg · {deal.quantity}kg
          </div>
          <DealSummaryRow deal={deal} />
          {deal.note && <p style={{ fontSize: 12, color: TOKENS.inkSoft, marginBottom: 10 }}>"{deal.note}"</p>}
          <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginBottom: 10 }}>
            희망 납품일 {deal.deliveryDate} · 들어온 제안 {deal.proposals.length}건
          </div>

          {openFormId === deal.id ? (
            <ProposalForm
              deal={deal}
              onSubmit={(id, proposal) => { onSubmitProposal(id, proposal); setOpenFormId(null); }}
              onCancel={() => setOpenFormId(null)}
            />
          ) : (
            <button
              onClick={() => setOpenFormId(deal.id)}
              style={{ padding: "8px 16px", background: TOKENS.moss, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              이 딜에 제안 보내기
            </button>
          )}
        </div>
      ))}
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
        <span style={chipBadge(TOKENS.rustSoft, TOKENS.rust)}>리드타임 {proposal.leadTimeDays}일</span>
        <span style={chipBadge(TOKENS.line, TOKENS.inkSoft)}>가능수량 {proposal.availableQty}kg</span>
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
  const steps = [
    { label: "딜 등록", done: true, at: deal.createdAt },
    { label: "농가 제안 도착", done: !!firstProposalAt, at: firstProposalAt },
    { label: "농가 선택 완료", done: deal.status !== "open", at: deal.selectedAt },
    { label: "납품 · 정산 완료", done: deal.status === "done", at: deal.completedAt },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: s.done ? TOKENS.moss : TOKENS.line,
                marginTop: 4,
              }}
            />
            {i < steps.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 22, background: TOKENS.line }} />}
          </div>
          <div style={{ paddingBottom: 14 }}>
            <div style={{ fontSize: 13, color: s.done ? TOKENS.ink : TOKENS.inkSoft }}>{s.label}</div>
            {s.at && <div style={{ fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(s.at)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MyDealsScreen({ deals, onSelectProposal, onCompleteDeal }) {
  const [expandedId, setExpandedId] = useState(deals[0]?.id ?? null);

  if (deals.length === 0) {
    return (
      <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.line}`, borderRadius: 12, padding: 32, textAlign: "center", color: TOKENS.inkSoft, fontSize: 13 }}>
        아직 등록한 딜이 없습니다. "딜 만들기" 탭에서 첫 요청서를 작성해보세요.
      </div>
    );
  }

  const sorted = [...deals].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720, margin: "0 auto" }}>
      {sorted.map((deal) => {
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
              <StatusBadge status={deal.status} />
            </div>
            <DealSummaryRow deal={deal} />
            <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginBottom: expanded ? 12 : 0 }}>
              희망단가 {deal.targetPrice.toLocaleString()}원/kg · {deal.quantity}kg · 납품일 {deal.deliveryDate} · 받은 제안 {deal.proposals.length}건
            </div>

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
                    {deal.status === "matched" && (
                      <button
                        onClick={() => onCompleteDeal(deal.id)}
                        style={{ padding: "10px 0", background: TOKENS.ink, color: TOKENS.bg, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                      >
                        납품 확인 후 정산 완료 처리
                      </button>
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

/* ---------- App shell ---------- */

export default function FarmToTableApp() {
  const [tab, setTab] = useState("create");
  const [deals, setDeals] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
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
        setLoadState("ready");
      } catch (err) {
        if (cancelled) return;
        try {
          setDeals(SAMPLE_DEALS);
          await storage.set(DEALS_KEY, JSON.stringify(SAMPLE_DEALS), true);
          setLoadState("ready");
        } catch (err2) {
          setLoadState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const handleCreateDeal = (deal) => {
    persist([deal, ...deals]);
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

  if (loadState === "loading") {
    return (
      <div style={{ background: TOKENS.bg, minHeight: "100%", padding: "60px 24px", textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.inkSoft, fontSize: 14 }}>
        딜 데이터를 불러오는 중입니다…
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

  const openCount = deals.filter((d) => d.status === "open").length;

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100%", padding: "32px 24px", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.ink }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
      />
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, letterSpacing: "0.08em", color: TOKENS.rust, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>
            역경매 방식 선주문 플랫폼
          </span>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 28, margin: "6px 0 4px" }}>
            셰프가 딜을 만들면, 농가가 제안합니다
          </h1>
          <p style={{ fontSize: 14, color: TOKENS.inkSoft, margin: 0 }}>
            셰프가 원하는 조건의 식자재 요청서(딜)를 올리면 농가들이 가격과 조건을 제안하고, 셰프가 그중 하나를 선택합니다.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, borderBottom: `1px solid ${TOKENS.line}` }}>
          {[
            { key: "create", label: "딜 만들기" },
            { key: "browse", label: "딜 찾기 (농가)" },
            { key: "mydeals", label: "내 거래" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 18px", background: "transparent", border: "none",
                borderBottom: `2px solid ${tab === t.key ? TOKENS.rust : "transparent"}`,
                color: tab === t.key ? TOKENS.ink : TOKENS.inkSoft,
                fontSize: 14, fontWeight: tab === t.key ? 500 : 400, cursor: "pointer", marginBottom: -1,
              }}
            >
              {t.label}
              {t.key === "browse" && (
                <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {openCount}
                </span>
              )}
              {t.key === "mydeals" && (
                <span style={{ marginLeft: 6, fontSize: 11, color: TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {deals.length}
                </span>
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: saveState === "error" ? TOKENS.rust : TOKENS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", paddingBottom: 10 }}>
            {saveState === "saving" && "저장 중…"}
            {saveState === "saved" && "저장됨"}
            {saveState === "error" && "저장 실패"}
          </span>
        </div>

        {tab === "create" && <DealCreateScreen onCreate={handleCreateDeal} />}
        {tab === "browse" && <DealBrowseScreen deals={deals} onSubmitProposal={handleSubmitProposal} />}
        {tab === "mydeals" && <MyDealsScreen deals={deals} onSelectProposal={handleSelectProposal} onCompleteDeal={handleCompleteDeal} />}
      </div>
    </div>
  );
}
