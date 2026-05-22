import React, { useState, useRef, useCallback, useEffect } from "react";

// ─── PRIZETILE PREMIUM DEMO TOKENS ─────────────────────────────────────────
// Refined dark performance palette for a sleeker LMCT+ proposal demo
const BLUE       = "#0B63FF";          // premium electric blue
const BLUE_BRIGHT= "#49D9FF";          // refined cyan accent
const BLUE_DIM   = "rgba(11,99,255,0.13)";
const BLUE_BORDER= "rgba(73,217,255,0.28)";
const NAVY       = "#050912";          // near-black performance navy
const NAVY2      = "#070D19";
const NAVY3      = "#0B1324";          // premium card background
const NAVY4      = "#111A2C";
const BORDER     = "rgba(120,155,205,0.16)";
const BORDER2    = "rgba(73,217,255,0.22)";
const SILVER     = "#B9C7D8";
const TEXT       = "#F7FAFF";
const TEXT2      = "rgba(232,240,255,0.68)";
const TEXT3      = "rgba(232,240,255,0.38)";
const GOLD       = "#D8B45A";          // restrained champagne gold
const CHAMPAGNE  = "#E8C978";
const STEEL      = "#7F91AD";
const BRONZE     = "#9A6A43";

const TIERS = {
  entry:   { name: "Bronze", price: 29.99, weeklyTiles: 10,  monthlyTiles: 10,  bonusTiles: 0,  bonusAccess: false, poolPct: 20, color: BRONZE, accent: "#C79661", glow: "rgba(154,106,67,0.18)" },
  premium: { name: "Silver", price: 59.99, weeklyTiles: 40,  monthlyTiles: 40,  bonusTiles: 0,  bonusAccess: false, poolPct: 25, color: SILVER,    accent: "#FFFFFF", glow: "rgba(200,216,232,0.2)" },
  elite:   { name: "Gold",   price: 109.99,weeklyTiles: 100, monthlyTiles: 100, bonusTiles: 40, bonusAccess: true,  poolPct: 50, color: GOLD,      accent: CHAMPAGNE, glow: "rgba(216,180,90,0.20)" },
};

// Bonus board tile allocation by tier
// Gold premium over Bronze ($80/mo) funds the bonus board pool
// Silver premium over Bronze ($30/mo) gets partial access
const BONUS_POOL_SOURCES = {
  goldPremium:   { perMember: 80,  members: 10000 },  // Gold $109.99 vs Bronze $29.99
  silverPremium: { perMember: 30,  members: 30000 },  // Silver $59.99 vs Bronze $29.99
};

const MEMBER_POOL = { entry: 90000, premium: 50000, elite: 60000 }; // 90K Bronze · 50K Silver · 60K Gold
// DEMO: tiles capped at 500K for browser performance — real system uses full 8.9M
const ACTUAL_TILES = MEMBER_POOL.entry * 10 + MEMBER_POOL.premium * 40 + MEMBER_POOL.elite * 100; // 8.9M real
const TOTAL_TILES  = 10000;  // demo cap — smooth browser draw

// DEMO prizes — board runs ~3 min, dramatic pauses for big prizes, silent for vouchers
// Real monthly draw: $1M cash × 1, Cars × 50, Holidays × 100, Tech × 500, Vouchers × 10,000
const MONTHLY_PRIZES = [
  { name: "Millionaire Maker", value: 1000000, label: "$1,000,000 CASH",       qty: 1,  remaining: 1,  pause: 6000, color: GOLD,        emoji: "◆", isCash: true,    realQty: 1,     silent: false },
  { name: "Car Prize",         value: 0,       label: "Brand New Car",          qty: 3,  remaining: 3,  pause: 4000, color: BLUE,        emoji: "▰", isProduct: true, realQty: 50,    silent: false },
  { name: "Holiday Package",   value: 0,       label: "Holiday Package",        qty: 5,  remaining: 5,  pause: 3000, color: BLUE_BRIGHT, emoji: "✦", isProduct: true, realQty: 100,   silent: false },
  { name: "Tech Bundle",       value: 0,       label: "Tech Bundle",            qty: 8,  remaining: 8,  pause: 2000, color: STEEL,   emoji: "◇", isProduct: true, realQty: 500,   silent: false },
  { name: "Partner Voucher",   value: 0,       label: "LMCT+ Partner Voucher",  qty: 30, remaining: 30, pause: 0,    color: BLUE_BRIGHT,   emoji: "•", isProduct: true, realQty: 10000, silent: true  },
];
// No weekly draw — one monthly Saturday event only
// WEEKLY_PRIZES removed

// Dummy member data removed — Winners page uses static winner data

function genTiles(tier, boardType) {
  const count = TIERS[tier][boardType === "monthly" ? "monthlyTiles" : "weeklyTiles"];
  const max = TOTAL_TILES; // 3,800,000
  const tiles = new Set();
  while (tiles.size < count) tiles.add(Math.floor(Math.random() * max) + 1);
  return [...tiles].sort((a, b) => a - b);
}
function fmtMoney(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "M";
  if (n >= 1000)    return "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return "$" + n.toLocaleString();
}
function fmtNum(n) { return n.toLocaleString(); }

// ── DRAW SPEED: auto-calculated to complete in ~1 hour regardless of board size ──
function calcDrawSpeed(totalTiles) {
  // Demo: run board in ~15 seconds
  // 10,000 tiles / 15s = ~667 tiles/sec
  // BATCH=14, INTERVAL=20ms → 700 tiles/sec actual
  return Math.ceil(totalTiles / 15);
}

// ── PRIZE POSITIONS: randomly interleaved across the board ──
// All prizes mixed together — cars, holidays, tech, vouchers hit in random order
// $1M cash reserved for last 20% of board for drama
function buildSpreadPrizePositions(allPrizes, totalTiles) {
  const positions = new Map();
  const usedPos   = new Set();

  // Separate cash from physical prizes
  const cashPrizes     = allPrizes.filter(p => p.isCash);
  const physicalPrizes = allPrizes.filter(p => !p.isCash);

  // Shuffle physical prizes so types are interleaved randomly
  const shuffled = [...physicalPrizes].sort(() => Math.random() - 0.5);

  // Place physical prizes across first 80% of board — fully random positions
  const physicalZoneEnd = Math.floor(totalTiles * 0.80);
  for (const prize of shuffled) {
    let pos, attempts = 0;
    do {
      pos = 1 + Math.floor(Math.random() * physicalZoneEnd);
      attempts++;
    } while (usedPos.has(pos) && attempts < 500);
    usedPos.add(pos);
    positions.set(pos, prize);
  }

  // Place cash prizes in last 20% — always near the end for maximum drama
  const cashZoneStart = Math.floor(totalTiles * 0.80);
  for (const prize of cashPrizes) {
    let pos, attempts = 0;
    do {
      pos = cashZoneStart + Math.floor(Math.random() * (totalTiles - cashZoneStart));
      attempts++;
    } while (usedPos.has(pos) && attempts < 500);
    usedPos.add(pos);
    positions.set(pos, prize);
  }

  return positions;
}

// ─── LMCT+ LOGO ──────────────────────────────────────────────────────────────
function LmctLogo({ height = 38 }) {
  const aspectRatio = 1240 / 282; // original PNG dimensions
  const width = Math.round(height * aspectRatio);
  return (
    <img
      src="/lmct-logo.png"
      alt="LMCT+"
      width={width}
      height={height}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
function BlueBtn({ children, onClick, outline, small, full }) {
  return (
    <button onClick={onClick} style={{
      background: outline ? "transparent" : `linear-gradient(135deg, ${BLUE_BRIGHT}, ${BLUE})`,
      color: TEXT, border: outline ? `2px solid ${BLUE}` : "none",
      borderRadius: 8, padding: small ? "10px 22px" : "14px 36px",
      fontSize: small ? 14 : 16, fontWeight: 900, cursor: "pointer",
      width: full ? "100%" : undefined,
      fontFamily: "'Arial Black',Arial,sans-serif",
      fontStyle: "italic", letterSpacing: 0.5,
      boxShadow: outline ? "none" : `0 4px 20px rgba(43,159,232,0.4)`,
    }}
      onMouseOver={e => e.currentTarget.style.opacity = "0.88"}
      onMouseOut={e => e.currentTarget.style.opacity = "1"}
    >{children}</button>
  );
}

function GhostBtn({ children, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      background: active ? BLUE_DIM : "transparent",
      color: active ? BLUE_BRIGHT : TEXT2,
      border: `1px solid ${active ? BLUE_BORDER : "rgba(255,255,255,0.1)"}`,
      borderRadius: 8, padding: "8px 18px", fontSize: 14,
      fontWeight: active ? 700 : 400, cursor: "pointer",
    }}>{children}</button>
  );
}

function StatCard({ label, val, accent }) {
  return (
    <div style={{ background: NAVY3, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || TEXT, marginBottom: 6, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>{val}</div>
      <div style={{ fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
    </div>
  );
}

function SectionHead({ children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
      <div style={{ width: 4, height: 28, background: "linear-gradient(180deg,#00C3FF,#0066FF)", borderRadius: 2 }} />
      <h2 style={{ fontSize: 32, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", margin: 0, textTransform: "uppercase" }}>{children}</h2>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function NavBar({ page, onNav, drawActive }) {
  const links = [
    { id: "home",    label: "Home" },
    { id: "tiers",   label: "Tiers" },
    { id: "draw",    label: "Live Draw" },
    { id: "members", label: "Winners" },
  ];
  return (
    <div style={{ background: "rgba(10,15,30,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 28px", height: 64, position: "sticky", top: 0, zIndex: 200 }}>
      <button onClick={() => onNav("home")} style={{ background: "transparent", border: "none", cursor: "pointer", marginRight: 32, padding: 0, lineHeight: 0 }}>
        <LmctLogo height={38} />
      </button>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {links.map(l => (
          <button key={l.id} onClick={() => onNav(l.id)} style={{
            background: "transparent", border: "none", padding: "8px 16px",
            color: page.startsWith(l.id) ? BLUE_BRIGHT : TEXT2,
            fontSize: 14, fontWeight: page.startsWith(l.id) ? 700 : 400,
            cursor: "pointer", fontStyle: page.startsWith(l.id) ? "italic" : "normal",
            borderBottom: page.startsWith(l.id) ? `2px solid ${BLUE}` : "2px solid transparent",
          }}>{l.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, borderRadius: 20, padding: "6px 14px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: drawActive ? BLUE_BRIGHT : "#E31E24", display: "inline-block", animation: "blink 2s ease-in-out infinite" }} />
        <span style={{ fontSize: 12, color: BLUE_BRIGHT, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>PrizeTile Demo</span>
      </div>
    </div>
  );
}

// ─── DRAW CYCLE HELPERS ──────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({ d:0, h:0, m:0, s:0 });
  useEffect(() => {
    const calc = () => {
      const diff = targetDate - new Date();
      if (diff <= 0) return setTimeLeft({ d:0, h:0, m:0, s:0 });
      setTimeLeft({ d:Math.floor(diff/86400000), h:Math.floor((diff%86400000)/3600000), m:Math.floor((diff%3600000)/60000), s:Math.floor((diff%60000)/1000) });
    };
    calc(); const t = setInterval(calc, 1000); return () => clearInterval(t);
  }, [targetDate]);
  return timeLeft;
}

function getNextDrawInfo() {
  const now = new Date();

  // Find the last Saturday of a given month/year
  function lastSaturdayOf(year, month) {
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    // Go back to Saturday (6)
    const dayOfWeek = lastDay.getDay();
    const daysBack = (dayOfWeek >= 6) ? dayOfWeek - 6 : dayOfWeek + 1;
    const sat = new Date(lastDay);
    sat.setDate(lastDay.getDate() - daysBack);
    sat.setHours(20, 0, 0, 0); // 8PM AEST
    return sat;
  }

  // This month's last Saturday
  const thisMonthDraw = lastSaturdayOf(now.getFullYear(), now.getMonth());

  // If this month's draw has passed, use next month's
  const satMillionaire = now < thisMonthDraw
    ? thisMonthDraw
    : lastSaturdayOf(
        now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
        now.getMonth() === 11 ? 0 : now.getMonth() + 1
      );

  satMillionaire.setHours(20, 0, 0, 0);

  return {
    nextDraw: satMillionaire,
    satMillionaire,
    nextFriday: satMillionaire, // no weekly draw — same as monthly
    isMillion: true,            // always the millionaire draw
    currentWeek: 4,
    nextWeek: 4,
    completedWeeks: 3,
  };
}

// ─── COMPACT BAR (draw screen) ────────────────────────────────────────────────
function DrawCycleBar() {
  const { nextDraw, currentWeek, nextWeek, isMillion } = getNextDrawInfo();
  const cd = useCountdown(nextDraw);
  const p = n => String(n??0).padStart(2,"0");
  return (
    <div style={{ background: "rgba(0,102,255,0.06)", borderBottom:`1px solid ${BORDER}`, padding:"7px 24px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
      <div style={{ display:"flex", gap:5, alignItems:"center" }}>
        {[1,2,3,4].map(w=>(
          <div key={w} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:24, height:24, borderRadius:6, background:w===nextWeek?(w===4?GOLD:BLUE_BRIGHT):w<nextWeek?"rgba(255,255,255,0.08)":NAVY4, border:`1.5px solid ${w===nextWeek?(w===4?GOLD:BLUE_BRIGHT):"transparent"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
              {w===4?"◆":w<nextWeek?"✓":"•"}
            </div>
            {w<4 && <div style={{ width:14, height:1, background:"rgba(255,255,255,0.08)" }}/>}
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, color:isMillion?GOLD:BLUE_BRIGHT, fontWeight:700 }}>
        "◆ Next: Saturday Millionaire Draw"
      </div>
      <div style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:13, fontWeight:700, color:isMillion?GOLD:BLUE_BRIGHT }}>
        {p(cd.d)}d {p(cd.h)}h {p(cd.m)}m {p(cd.s)}s
      </div>
    </div>
  );
}

// ─── WOW COUNTDOWN WIDGET (home page) ─────────────────────────────────────────
function DrawCycleCountdown() {
  const { satMillionaire } = getNextDrawInfo();
  const cd = useCountdown(satMillionaire);
  const pad = n => String(n??0).padStart(2,"0");
  const drawDate = satMillionaire.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"});
  return (
    <div style={{ marginBottom:48, position:"relative" }}>
      <div style={{ background:`linear-gradient(135deg, rgba(216,180,90,0.08) 0%, rgba(255,140,0,0.05) 50%, transparent 100%)`, border:`2px solid ${GOLD}44`, borderRadius:24, padding:"48px 40px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        {/* Background glow */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:700, height:400, background:`radial-gradient(ellipse, ${GOLD}15 0%, transparent 70%)`, pointerEvents:"none" }} />
        {/* Next draw label */}
        <div style={{ fontSize:11, color:GOLD, textTransform:"uppercase", letterSpacing:5, fontWeight:700, marginBottom:20, opacity:0.9, position:"relative" }}>Next Draw</div>
        {/* Big prize total */}
        <div style={{ fontSize:"clamp(48px,7vw,88px)", fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase", color:TEXT, lineHeight:1, marginBottom:4, position:"relative", textShadow:`0 0 60px ${GOLD}44` }}>
          $6,000,000
        </div>
        <div style={{ fontSize:"clamp(14px,2vw,22px)", color:GOLD, fontWeight:700, marginBottom:40, letterSpacing:1, position:"relative" }}>
          in prizes — every month
        </div>
        {/* Countdown */}
        <div style={{ display:"flex", gap:8, justifyContent:"center", alignItems:"center", marginBottom:40, position:"relative" }}>
          {[{v:cd.d,l:"Days"},{v:cd.h,l:"Hours"},{v:cd.m,l:"Mins"},{v:cd.s,l:"Secs"}].map(({v,l},i)=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ background:"rgba(216,180,90,0.08)", border:`1px solid ${GOLD}44`, borderRadius:16, padding:"18px 24px", minWidth:90 }}>
                  <div style={{ fontSize:"clamp(40px,6vw,68px)", fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", color:GOLD, lineHeight:1 }}>{pad(v)}</div>
                </div>
                <div style={{ fontSize:11, color:TEXT3, marginTop:8, textTransform:"uppercase", letterSpacing:2 }}>{l}</div>
              </div>
              {i<3 && <div style={{ fontSize:40, color:`${GOLD}44`, fontWeight:900, marginBottom:28 }}>:</div>}
            </div>
          ))}
        </div>
        {/* Date */}
        <div style={{ fontSize:14, color:TEXT2, marginBottom:28, position:"relative" }}>
          {drawDate} · 8:00 PM AEST · Drawn Live by Independent Draw Manager
        </div>
        {/* Prize pills */}
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", position:"relative" }}>
          {[
            { emoji:"◆", label:"$1,000,000 Cash",   color:GOLD },
            { emoji:"▰", label:"50 Brand New Cars",  color:BLUE_BRIGHT },
            { emoji:"✦", label:"100 Holidays",        color:BLUE_BRIGHT },
            { emoji:"◇", label:"500 Tech Bundles",    color:STEEL },
            { emoji:"•", label:"10,000 Vouchers",     color:BLUE_BRIGHT },
          ].map(p=>(
            <div key={p.label} style={{ display:"flex", alignItems:"center", gap:6, background:`${p.color}14`, border:`1px solid ${p.color}33`, borderRadius:20, padding:"8px 16px" }}>
              <span style={{ fontSize:15 }}>{p.emoji}</span>
              <span style={{ fontSize:13, color:p.color, fontWeight:700 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
// ─── CRYPTO BADGE ────────────────────────────────────────────────────────────
function CryptoBadge({ small }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(127,145,173,0.09)", border:"1px solid rgba(127,145,173,0.30)", borderRadius:20, padding: small?"4px 12px":"6px 16px" }}>
      <span style={{ fontSize: small?11:14, color:STEEL }}>₿</span>
      <span style={{ fontSize: small?10:12, fontWeight:700, color:STEEL, letterSpacing:0.5 }}>PAYMENT OPTIONS</span>
    </div>
  );
}

function Landing({ onNav }) {
  return (
    <div style={{ background: `radial-gradient(ellipse at 60% 0%, #0D2040 0%, ${NAVY} 60%)`, minHeight: "100vh" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "80px 28px 64px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:28 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:40, padding:"8px 22px" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:BLUE_BRIGHT, display:"inline-block" }} />
              <span style={{ color:BLUE_BRIGHT, fontSize:12, fontWeight:700, letterSpacing:2.5, textTransform:"uppercase", fontFamily:"'Arial Black',Arial,sans-serif" }}>Member Reward Engine</span>
            </div>
            <CryptoBadge />
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(73,217,255,0.08)", border:"1px solid rgba(73,217,255,0.18)", borderRadius:40, padding:"8px 18px" }}>
              <span style={{ fontSize:12 }}>ID</span>
              <span style={{ color:BLUE_BRIGHT, fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>Verified Members</span>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: "clamp(30px, 5vw, 58px)", fontWeight: 900, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", textTransform: "uppercase", lineHeight: 1, color: TEXT, letterSpacing: -1, marginBottom: 4 }}>
              AUSTRALIA'S FIRST
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: BLUE_BRIGHT, borderRadius: 6, padding: "6px 24px", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: NAVY, fontWeight: 900, fontFamily: "'Arial Black',Arial,sans-serif" }}>✦</span>
              <span style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 900, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", textTransform: "uppercase", color: NAVY, letterSpacing: -1, lineHeight: 1.1 }}>LIVE PRIZE BOARD</span>
            </div>
            <div style={{ fontSize: "clamp(30px, 5vw, 56px)", fontWeight: 900, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", textTransform: "uppercase", lineHeight: 1, color: TEXT, letterSpacing: -1 }}>
              & MEMBER DRAW ENGINE
            </div>
          </div>
          <p style={{ fontSize: 18, color: TEXT2, maxWidth: 540, margin: "28px auto 48px", lineHeight: 1.6 }}>
            Before every draw, all member tiles are <strong style={{ color: TEXT }}>randomly placed on the board</strong>. The board reveals live. Every month on a Saturday we give away <strong style={{ color: GOLD }}>$5,000,000 in prizes</strong> — including <strong style={{ color: BLUE_BRIGHT }}>$1,000,000 cash</strong>, 50 brand new cars and 100 holidays. Gold members compete in an exclusive <strong style={{ color: GOLD }}>$1,000,000 bonus draw</strong> the same night. 
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <BlueBtn onClick={() => onNav("draw")}>▶ WATCH LIVE DRAW</BlueBtn>
            <BlueBtn onClick={() => onNav("tiers")} outline>VIEW TIERS</BlueBtn>
          </div>
        </div>

        {/* Draw cycle countdown */}
        <DrawCycleCountdown />

        {/* 3 headline numbers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 80 }}>
          {[
            { val: "$5,000,000",  label: "In prizes one Saturday night every month", sub: "Top prize: $1,000,000 cash",              accent: GOLD },
            { val: "50 Cars",     label: "Given away in a single night — every month", sub: "Plus 100 holidays · 10,000 vouchers",   accent: "#00C3FF" },
            { val: "$1,000,000",  label: "Gold exclusive bonus draw — same night",   sub: "Gold members only · 10,000 vouchers · More visible odds than a traditional prize draw", accent: GOLD },
          ].map(s => (
            <div key={s.label} style={{ background: NAVY3, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, color: s.accent, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", lineHeight: 1, marginBottom: 8 }}>{s.val}</div>
              <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.5, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: s.accent, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, opacity: 0.7 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tile allocation — the core mechanic */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64, marginBottom: 64 }}>
          <SectionHead>How Many Tiles Do You Get?</SectionHead>
          <p style={{ color: TEXT2, marginBottom: 40, marginLeft: 14, fontSize: 16, maxWidth: 600 }}>
            Your membership tier decides how many tiles you get each draw. Before every draw, all tiles from all members are <strong style={{ color: TEXT }}>randomly placed on the board</strong>. More tiles = more positions on the board = more chances to win.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
            {[
              { tier: "Bronze", price: "$29.99/mo", tiles: 10,  pct:30, color: BRONZE, glow: "rgba(205,127,50,0.2)",   tagline: "Get started", bonusAccess: false },
              { tier: "Silver", price: "$59.99/mo", tiles: 40,  pct:25, color: SILVER, glow: "rgba(200,216,232,0.12)", tagline: "4× more chances every draw", bonusAccess: false },
              { tier: "Gold",   price: "$109.99/mo",tiles: 100, pct:50, color: GOLD, glow: "rgba(216,180,90,0.16)",    tagline: "10× tiles + exclusive $1M Bonus Draw", bonusAccess: true },
            ].map(t => (
              <div key={t.tier} style={{ background: NAVY3, border: `2px solid ${t.color}44`, borderRadius: 18, padding: "32px 24px", textAlign: "center", boxShadow: `0 0 30px ${t.glow}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />
                  <span style={{ fontSize: 12, fontWeight: 900, color: t.color, textTransform: "uppercase", letterSpacing: 2.5, fontFamily: "'Arial Black',Arial,sans-serif" }}>{t.tier}</span>
                </div>
                <div style={{ fontSize: "clamp(56px,8vw,80px)", fontWeight: 900, color: t.color, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", lineHeight: 1, marginBottom: 4, textShadow: `0 0 30px ${t.glow}` }}>{t.tiles}</div>
                <div style={{ fontSize: 15, color: TEXT, fontWeight: 700, marginBottom: 16 }}>tiles per draw</div>
                <div style={{ height: 1, background: BORDER, marginBottom: 16 }} />
                <div style={{ fontSize: 22, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", marginBottom: 4 }}>{t.price}</div>
                <div style={{ fontSize: 12, color: TEXT3, marginBottom: 14 }}>per month</div>
                <div style={{ fontSize: 12, color: t.color, fontWeight: 600 }}>{t.tagline}</div>
              </div>
            ))}
          </div>

          <div style={{ background: NAVY3, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 28px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7, flex: 1 }}>
              Before every draw, all members' tiles — yours and everyone else's — are <strong style={{ color: TEXT }}>randomly placed across the board</strong>. Your position changes each draw. You can see your allocated tile numbers in your member profile once the board is locked.
            </div>
          </div>
        </div>

        {/* The two draws — clearly separated */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64, marginBottom: 64 }}>
          <SectionHead>One Night. One Million. Every Month.</SectionHead>
          <p style={{ color: TEXT2, marginBottom: 40, marginLeft: 14, fontSize: 16 }}>
            Every month on a Saturday night, LMCT+ gives away <strong style={{ color: GOLD }}>$5,000,000 in prizes</strong> — 50 brand new cars, 100 holidays, 500 tech bundles, 10,000 partner vouchers and <strong style={{ color: GOLD }}>$1,000,000 cash</strong>. Gold members compete in an exclusive <strong style={{ color: CHAMPAGNE }}>$1,000,000 bonus draw</strong> the same night.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Monthly */}
            <div style={{ background: NAVY3, border: `2px solid ${BLUE_BORDER}`, borderRadius: 18, overflow: "hidden", boxShadow: `0 0 40px rgba(0,102,255,0.1)` }}>
              <div style={{ background: BLUE_DIM, borderBottom: `1px solid ${BLUE_BORDER}`, padding: "18px 28px" }}>
                <div style={{ fontSize: 11, color: GOLD, textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700, marginBottom: 4 }}>Every Month — Saturday Night</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>Monthly Millionaire Draw</div>
                <div style={{ fontSize: 13, color: TEXT2, marginTop: 4 }}>$5,000,000 in prizes — $1,000,000 cash · 50 brand new cars · 100 holidays · 500 tech bundles · 10,000 partner vouchers</div>
              </div>
              <div style={{ padding: "20px 28px" }}>
                {[
                  { emoji: "◆", prize: "$1,000,000 Cash",         desc: "1 member becomes a millionaire — every month",   color: GOLD },
                  { emoji: "▰", prize: "Brand New Car",           desc: "50 winners — brand new car each",                color: BLUE },
                  { emoji: "✦", prize: "Holiday Package",          desc: "100 winners — flights, accommodation & more",    color: BLUE_BRIGHT },
                  { emoji: "◇", prize: "Tech Bundle",              desc: "500 winners — latest tech gear",                 color: STEEL },
                  { emoji: "•", prize: "LMCT+ Partner Voucher",    desc: "10,000 winners every month",                    color: BLUE_BRIGHT },
                ].map(r => (
                  <div key={r.prize} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 20, flexShrink: 0 }}>{r.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: r.color, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>{r.prize}</div>
                      <div style={{ fontSize: 12, color: TEXT3, marginTop: 2 }}>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gold Bonus Draw — clean, no funding details */}
            <div style={{ background: NAVY3, border: `2px solid rgba(216,180,90,0.28)`, borderRadius: 18, overflow: "hidden", boxShadow: "0 0 40px rgba(216,180,90,0.10)", gridColumn: "1 / -1" }}>
              <div style={{ background: "rgba(216,180,90,0.10)", borderBottom: "1px solid rgba(216,180,90,0.22)", padding: "18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize: 11, color: CHAMPAGNE, textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700, marginBottom: 4 }}>Every Month — Gold Members Only</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>$1,000,000 Gold Bonus Draw</div>
                  <div style={{ fontSize: 13, color: TEXT2, marginTop: 4 }}>10,000 LMCT+ Partner Vouchers — Gold members only. Included with your Gold subscription. No extra payment ever required.</div>
                </div>
                <div style={{ background:"rgba(216,180,90,0.12)", border:"1px solid rgba(216,180,90,0.25)", borderRadius:14, padding:"14px 28px", textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:10, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Prize Pool</div>
                  <div style={{ fontSize:32, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000</div>
                  <div style={{ fontSize:10, color:TEXT3, marginTop:2 }}>In prizes every month · Gold only</div>
                </div>
              </div>
              <div style={{ padding: "20px 28px" }}>
                {[
                  { emoji: "•", prize: "LMCT+ Partner Voucher", desc: "10,000 winners — $100 each · Gold members only", color: CHAMPAGNE },
                ].map(r => (
                  <div key={r.prize} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0" }}>
                    <div style={{ fontSize: 32, flexShrink: 0 }}>{r.emoji}</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: r.color, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>{r.prize}</div>
                      <div style={{ fontSize: 13, color: TEXT3, marginTop: 4 }}>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"12px 28px", borderTop:`1px solid ${BORDER}`, display:"flex", alignItems:"center", gap:10, background:"rgba(216,180,90,0.05)" }}>
                <span style={{ fontSize:14 }}>★</span>
                <span style={{ fontSize:12, color:CHAMPAGNE, fontWeight:700 }}>Gold members only · 40 bonus tiles · Every Gold member has a meaningful chance of winning their membership back every month</span>
              </div>
            </div>
          </div>
        </div>

        {/* How it works — super simple */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 64, marginBottom: 64 }}>
          <SectionHead>How It Works</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 36 }}>
            {[
              { n: "1", title: "Subscribe",    desc: "Pick Bronze, Silver, or Gold. Stay subscribed each month." },
              { n: "2", title: "Get Your Tiles", desc: "Before each draw your tiles are randomly placed on the board alongside every other member. More tiles = more positions = more chances." },
              { n: "3", title: "Watch Live",   desc: "The board reveals live — fast, dramatic and unstoppable. It pauses on every prize hit with a winner announcement." },
              { n: "4", title: "Win",          desc: "Prizes paid immediately to verified members. More tiles means more positions on the board and more chances in the draw." },
            ].map(s => (
              <div key={s.n} style={{ background: NAVY3, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "28px 22px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -8, right: 10, fontSize: 64, fontWeight: 900, color: BLUE_DIM, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", lineHeight: 1, pointerEvents: "none" }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: TEXT, marginBottom: 10, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", textTransform: "uppercase", position: "relative" }}>{s.title}</div>
                <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.65, position: "relative" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 64 }}>
          <button onClick={() => onNav("draw")} style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, borderRadius: 18, padding: "32px 28px", cursor: "pointer", textAlign: "left", transition: "border-color 0.2s" }}
            onMouseOver={e => e.currentTarget.style.borderColor = BLUE}
            onMouseOut={e => e.currentTarget.style.borderColor = BLUE_BORDER}>
            <div style={{ fontSize: 11, color: BLUE_BRIGHT, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>Live Draw Board</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", textTransform: "uppercase", marginBottom: 8 }}>Watch the Draw Board</div>
            <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>See the board reveal live — prize flashes, winner feed, and prize cabinet updating in real time.</div>
          </button>
          <button onClick={() => onNav("members")} style={{ background: NAVY3, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "32px 28px", cursor: "pointer", textAlign: "left", transition: "border-color 0.2s" }}
            onMouseOver={e => e.currentTarget.style.borderColor = BLUE_BORDER}
            onMouseOut={e => e.currentTarget.style.borderColor = BORDER}>
            <div style={{ fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>Hall of Fame</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", textTransform: "uppercase", marginBottom: 8 }}>See Our Winners</div>
            <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>Recent prize draw winners and our Millionaire Hall of Fame — real LMCT+ members, real prizes.</div>
          </button>
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 36, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: TEXT3, lineHeight: 1.9 }}>
            PrizeTile is a membership reward draw system concept, built for LMCT+. · Accepts PAYMENT OPTIONS<br />
            Tiles are randomly allocated and locked before each draw. Results are recorded and replayable. This system is a <strong style={{color:TEXT3}}>promotional member reward draw</strong> — not a gambling product. Subject to terms, conditions and legal review.<br />
            <span style={{color:TEXT3, opacity:0.6}}>Prototype for demonstration purposes only. © LMCT+ 2025.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── TIERS ────────────────────────────────────────────────────────────────────
function TierCards({ onNav }) {
  return (
    <div style={{ background: `radial-gradient(ellipse at 50% 0%, #0D2040 0%, ${NAVY} 70%)`, minHeight: "100vh", padding: "64px 28px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 56 }}>
          <SectionHead>Membership Tiers</SectionHead>
          <p style={{ color: TEXT2, fontSize: 17, marginLeft: 14 }}>More tiles. More chances. Every draw.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 60 }}>
          {Object.entries(TIERS).map(([key, tier]) => (
            <div key={key} style={{
              background: NAVY3,
              border: `${key === "elite" ? "2px" : "1px"} solid ${key === "elite" ? tier.color + "66" : BORDER}`,
              borderRadius: 20, padding: "36px 32px", position: "relative", overflow: "hidden",
              boxShadow: key === "elite" ? `0 0 40px ${tier.glow}` : "none",
            }}>
              {key === "elite" && (
                <div style={{ position: "absolute", top: 0, right: 0, background: `linear-gradient(135deg, ${GOLD}, #A9893F)`, color: "#000", fontSize: 11, fontWeight: 900, padding: "6px 20px 6px 30px", clipPath: "polygon(16px 0,100% 0,100% 100%,0 100%)", fontFamily: "'Arial Black',Arial,sans-serif", letterSpacing: 1 }}>TOP TIER</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: tier.color, boxShadow: `0 0 10px ${tier.glow}` }} />
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2.5, textTransform: "uppercase", color: tier.color, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>{tier.name}</span>
              </div>
              <div style={{ fontSize: 56, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic", lineHeight: 1, marginBottom: 4 }}>${tier.price}</div>
              <div style={{ fontSize: 14, color: TEXT3, marginBottom: 32 }}>per month</div>
              <div style={{ height: 1, background: BORDER, marginBottom: 28 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <TileRow tier={tier} label="Monthly Draw Tiles"      count={tier.monthlyTiles} />
                
                {tier.bonusAccess && (
                  <TileRow tier={tier} label="◇ Monthly Bonus Draw"    count={tier.bonusTiles} />
                )}

                {!tier.bonusAccess && key==="entry" && (
                  <div style={{ marginTop:8, background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ fontSize:11, color:GOLD, fontWeight:700 }}>◇ Upgrade to Gold for the exclusive $1,000,000 Gold Bonus Draw</div>
                  </div>
                )}
                {!tier.bonusAccess && key==="premium" && (
                  <div style={{ marginTop:8, background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:8, padding:"8px 12px" }}>
                    <div style={{ fontSize:11, color:GOLD, fontWeight:700 }}>◇ Upgrade to Gold for the exclusive $1,000,000 Gold Bonus Draw</div>
                  </div>
                )}
              </div>


            </div>
          ))}
        </div>



        {/* Gold Bonus Draw callout */}
        <div style={{ background:"rgba(216,180,90,0.06)", border:"2px solid rgba(216,180,90,0.28)", borderRadius:18, overflow:"hidden", marginBottom:24 }}>
          <div style={{ background:"rgba(216,180,90,0.10)", borderBottom:"1px solid rgba(216,180,90,0.22)", padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:2.5, fontWeight:700, marginBottom:4 }}>Every Month — Gold Members Only</div>
              <div style={{ fontSize:22, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000 Gold Bonus Draw</div>
              <div style={{ fontSize:13, color:TEXT2, marginTop:4 }}>10,000 LMCT+ Partner Vouchers — Gold members only. Included with your Gold subscription. No extra payment ever required.</div>
            </div>
            <div style={{ background:"rgba(216,180,90,0.12)", border:"1px solid rgba(216,180,90,0.25)", borderRadius:14, padding:"14px 28px", textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:10, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Prize Pool</div>
              <div style={{ fontSize:28, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000</div>
              <div style={{ fontSize:10, color:TEXT3, marginTop:2 }}>Gold members only · every month</div>
            </div>
          </div>
          <div style={{ padding:"18px 28px", display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:32 }}>•</span>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>LMCT+ Partner Voucher</div>
              <div style={{ fontSize:13, color:TEXT3, marginTop:4 }}>10,000 winners — $100 each · Every Gold member has a meaningful chance of winning their membership back every month</div>
            </div>
          </div>
          <div style={{ padding:"12px 28px", borderTop:`1px solid ${BORDER}`, background:"rgba(216,180,90,0.05)", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:13 }}>★</span>
            <span style={{ fontSize:12, color:CHAMPAGNE, fontWeight:700 }}>Gold members only · 40 bonus tiles · Upgrade to Gold to access this exclusive monthly draw</span>
          </div>
        </div>

        {/* Policy + crypto callout */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:32 }}>
          <div style={{ background:NAVY3, border:"1px solid rgba(73,217,255,0.18)", borderRadius:16, padding:"22px 24px", display:"flex", gap:14, alignItems:"flex-start" }}>
            <span style={{ fontSize:28, flexShrink:0 }}>ID</span>
            <div>
              <div style={{ fontSize:15, fontWeight:900, color:BLUE_BRIGHT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", marginBottom:8 }}>Verified Membership</div>
              <div style={{ fontSize:13, color:TEXT2, lineHeight:1.6 }}>
                Each LMCT+ membership is linked to a verified identity. One account per person — no exceptions. Identity required at sign-up — prizes paid immediately to verified members. Prizes paid immediately to verified members.
              </div>
            </div>
          </div>
          <div style={{ background:"rgba(127,145,173,0.08)", border:"1px solid rgba(127,145,173,0.24)", borderRadius:16, padding:"22px 24px", display:"flex", gap:14, alignItems:"flex-start" }}>
            <span style={{ fontSize:28, flexShrink:0 }}>₿</span>
            <div>
              <div style={{ fontSize:15, fontWeight:900, color:STEEL, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", marginBottom:8 }}>Crypto Payments Supported</div>
              <div style={{ fontSize:13, color:TEXT2, lineHeight:1.6 }}>
                Pay with Bitcoin, Ethereum or USDT — same rules apply as cash. One membership per verified ID. Crypto is a payment method only — it doesn't change your entitlements.
              </div>
              <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                {["₿ Bitcoin","Ξ Ethereum","₮ USDT"].map(c=>(
                  <div key={c} style={{ background:"rgba(127,145,173,0.10)", border:"1px solid rgba(127,145,173,0.30)", borderRadius:20, padding:"4px 14px", fontSize:12, fontWeight:700, color:STEEL }}>{c}</div>
                ))}
              </div>
              <div style={{ marginTop:12, fontSize:11, color:"rgba(185,199,216,0.60)", display:"flex", gap:6, alignItems:"center" }}>
                <span>ID</span> Identity required at sign-up · Draw conducted by independent licensed third party
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <BlueBtn onClick={() => onNav("draw")}>WATCH THE LIVE DRAW →</BlueBtn>
        </div>
      </div>
    </div>
  );
}

function TileRow({ tier, label, count }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: TEXT3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", flex: 1 }}>
          {Array.from({ length: Math.min(count, 20) }).map((_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: tier.color, opacity: 0.75 }} />
          ))}
          {count > 20 && <span style={{ fontSize: 10, color: TEXT3, alignSelf: "center" }}>+{count - 20}</span>}
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: tier.color, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>{count}</div>
      </div>
    </div>
  );
}

// ─── AVATAR OPTIONS ──────────────────────────────────────────────────────────
const AVATARS = ["▰","★","✦","◆","◆","◆","✦","✦","◆","◇","▲","◆"];

// ─── PROFILE EDITOR ──────────────────────────────────────────────────────────
function ProfileEditor({ profile, onSave, onClose }) {
  const [name, setName]     = useState(profile.name);
  const [state, setState]   = useState(profile.state);
  const [avatar, setAvatar] = useState(profile.avatar || "★");
  const [tier, setTier]     = useState(profile.tier);
  const STATES = ["NSW","VIC","QLD","SA","WA","TAS","NT","ACT"];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:NAVY3, border:`1px solid ${BLUE_BORDER}`, borderRadius:24, padding:40, width:"100%", maxWidth:480, boxShadow:`0 0 60px rgba(43,159,232,0.25)` }}>
        <div style={{ fontSize:20, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase", marginBottom:28 }}>Edit Profile</div>

        {/* Avatar picker */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5, marginBottom:12 }}>Choose Avatar</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
            {AVATARS.map(a => (
              <button key={a} onClick={() => setAvatar(a)} style={{ fontSize:28, background: avatar===a ? BLUE_DIM : NAVY4, border:`2px solid ${avatar===a ? BLUE : "transparent"}`, borderRadius:12, padding:"10px 0", cursor:"pointer", transition:"all 0.15s" }}>{a}</button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>Display Name</div>
          <input value={name} onChange={e=>setName(e.target.value)} style={{ width:"100%", background:NAVY4, border:`1px solid ${BORDER2}`, borderRadius:8, padding:"12px 16px", color:TEXT, fontSize:15, outline:"none" }} />
        </div>

        {/* State */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>State</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {STATES.map(s => (
              <button key={s} onClick={() => setState(s)} style={{ background: state===s ? BLUE_DIM : NAVY4, border:`1px solid ${state===s ? BLUE_BORDER : BORDER}`, borderRadius:8, padding:"8px 14px", color: state===s ? BLUE_BRIGHT : TEXT2, fontSize:13, fontWeight: state===s ? 700 : 400, cursor:"pointer" }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Tier */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>Membership Tier</div>
          <div style={{ display:"flex", gap:8 }}>
            {Object.entries(TIERS).map(([key,t]) => (
              <button key={key} onClick={() => setTier(key)} style={{ flex:1, background: tier===key ? `${t.color}18` : NAVY4, border:`2px solid ${tier===key ? t.color+"66" : BORDER}`, borderRadius:10, padding:"10px 8px", color: tier===key ? t.color : TEXT3, fontSize:13, fontWeight:900, cursor:"pointer", fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{t.name}</button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", gap:12 }}>
          <BlueBtn onClick={() => onSave({ ...profile, name, state, avatar, tier })} full>Save Profile</BlueBtn>
          <button onClick={onClose} style={{ background:"transparent", color:TEXT2, border:`1px solid ${BORDER}`, borderRadius:8, padding:"14px 24px", fontSize:15, cursor:"pointer", whiteSpace:"nowrap" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── WINNER CAROUSEL ─────────────────────────────────────────────────────────
// Shows last N winners per prize tier as rotating cards — never a long scroll
function WinnerCarousel({ winFeed, prizes, profile }) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Group winners by prize name, keep last 5 per tier
  const byPrize = {};
  for (const p of prizes) byPrize[p.name] = [];
  for (const w of winFeed) {
    if (byPrize[w.prize.name] !== undefined) {
      if (byPrize[w.prize.name].length < 5) byPrize[w.prize.name].push(w);
    }
  }
  const tiers = prizes.map(p => ({ prize: p, winners: byPrize[p.name] || [] }));
  const active = tiers[activeIdx] || tiers[0];
  const totalWinners = winFeed.length;

  return (
    <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, padding:"18px 16px" }}>
      <div style={{ fontSize:11, fontWeight:700, color:TEXT3, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:3, height:14, background:`linear-gradient(${BLUE_BRIGHT},${BLUE})`, borderRadius:2 }} />
        Live Winners
        {totalWinners > 0 && <span style={{ marginLeft:"auto", fontSize:11, color:BLUE_BRIGHT, fontWeight:700 }}>{totalWinners} total</span>}
      </div>

      {/* Prize tier tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:14, flexWrap:"wrap" }}>
        {tiers.map((t, i) => {
          const won = t.prize.qty - t.prize.remaining;
          return (
            <button key={t.prize.name} onClick={() => setActiveIdx(i)} style={{
              flex:1, minWidth:0, background: activeIdx===i ? `${t.prize.color}22` : "transparent",
              border:`1px solid ${activeIdx===i ? t.prize.color+"66" : BORDER}`,
              borderRadius:8, padding:"6px 4px", cursor:"pointer", textAlign:"center",
            }}>
              <div style={{ fontSize:16 }}>{t.prize.emoji || "★"}</div>
              <div style={{ fontSize:9, color: activeIdx===i ? t.prize.color : TEXT3, fontWeight:700, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {won}/{t.prize.qty}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active prize info */}
      <div style={{ background:NAVY4, borderRadius:10, padding:"12px 14px", marginBottom:12, borderLeft:`3px solid ${active.prize.color}` }}>
        <div style={{ fontSize:11, color:active.prize.color, textTransform:"uppercase", letterSpacing:1.5, fontWeight:700, marginBottom:4 }}>{active.prize.label || active.prize.name}</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13, color:TEXT2 }}>
            {active.prize.qty - active.prize.remaining} won · {active.prize.remaining} remaining
          </div>
          <div style={{ width:60, height:4, background:"rgba(255,255,255,0.08)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${((active.prize.qty-active.prize.remaining)/active.prize.qty)*100}%`, background:active.prize.color, borderRadius:2, transition:"width 0.4s" }} />
          </div>
        </div>
      </div>

      {/* Winner list for this tier — max 5, no scroll */}
      {active.winners.length === 0 ? (
        <div style={{ textAlign:"center", padding:"20px 0", color:TEXT3, fontSize:13 }}>
          {totalWinners === 0 ? "Start the draw to see winners" : "No winners yet for this prize"}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {active.winners.map((w, i) => (
            <div key={w.id} style={{ display:"flex", alignItems:"center", gap:10, background:w.isMine?"rgba(73,217,255,0.07)":NAVY, borderRadius:8, padding:"9px 12px", border:`1px solid ${w.isMine?"rgba(73,217,255,0.18)":"transparent"}`, animation:"feedSlide 0.25s ease-out" }}>
              <div style={{ fontSize:18, flexShrink:0 }}>{w.prize.emoji || "★"}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:w.isMine?BLUE_BRIGHT:TEXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {w.isMine ? `🎉 ${profile.name}` : `${w.tier} Member #${w.member}`}
                </div>
                <div style={{ fontSize:10, color:TEXT3 }}>#{w.tile} · {w.state}</div>
              </div>
              {w.isMine && <span style={{ fontSize:10, background:"rgba(73,217,255,0.18)", color:BLUE_BRIGHT, padding:"2px 6px", borderRadius:4, fontWeight:700, flexShrink:0 }}>YOU!</span>}
            </div>
          ))}
          {active.prize.qty - active.prize.remaining > 5 && (
            <div style={{ textAlign:"center", fontSize:11, color:TEXT3, paddingTop:4 }}>
              + {active.prize.qty - active.prize.remaining - 5} more winners
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PRIZE ANIMATION HELPERS ─────────────────────────────────────────────────
function getPrizeAnimation(prize) {
  if (!prize) return { tile:"prizeTileFlash 0.5s ease-out", banner:"bannerPetrol 0.3s ease-out", duration: prize?.pause||800 };
  const v = prize.value;
  const n = prize.name;
  if (v >= 1000000 || n === "Millionaire Maker")
    return { tile:"prizeFlashMillion 0.8s cubic-bezier(0.36,0.07,0.19,0.97)", banner:"bannerMillion 0.6s cubic-bezier(0.36,0.07,0.19,0.97)", confetti:true };
  if (n === "Car Prize" || n === "Major Prize" && v >= 100000)
    return { tile:"prizeFlashCar 0.6s cubic-bezier(0.36,0.07,0.19,0.97)", banner:"bannerCar 0.5s ease-out" };
  if (n === "Holiday Pack" || n === "Big Prize" || v >= 10000)
    return { tile:"prizeFlashHoliday 0.55s ease-out", banner:"bannerHoliday 0.45s ease-out" };
  if (n === "Tech Pack" || n === "Mid Prize" || v >= 1000)
    return { tile:"prizeFlashTech 0.5s ease-out", banner:"bannerTech 0.4s ease-out" };
  // Petrol / instant win — quick
  return { tile:"prizeFlashPetrol 0.35s ease-out", banner:"bannerPetrol 0.25s ease-out" };
}

// Confetti particles for the million dollar moment
function Confetti() {
  const pieces = Array.from({length:24}, (_,i) => ({
    left: `${Math.random()*100}%`,
    delay: `${Math.random()*0.5}s`,
    duration: `${1.5+Math.random()*1.5}s`,
    color: [GOLD,"#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8"][i%8],
    size: `${8+Math.floor(Math.random()*10)}px`,
    shape: Math.random()>0.5?"50%":"2px",
  }));
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:10 }}>
      {pieces.map((p,i) => (
        <div key={i} style={{
          position:"absolute", top:"-20px", left:p.left,
          width:p.size, height:p.size, borderRadius:p.shape,
          background:p.color,
          animation:`confettiDrop ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ─── TILE PACK DATA ──────────────────────────────────────────────────────────
// TILE_PACKS removed — no tile purchases
const TILE_PACKS = [
  { id:"starter", name:"Starter",  tiles:10,  price:9.99,  pricePerTile:"$1.00", color:SILVER, popular:false, desc:"A quick top-up" },
  { id:"booster", name:"Booster",  tiles:30,  price:24.99, pricePerTile:"$0.83", color:"#2B9FE8", popular:true,  desc:"Most popular choice" },
  { id:"power",   name:"Power",    tiles:75,  price:49.99, pricePerTile:"$0.67", color:"#00BFFF", popular:false, desc:"Serious contender" },
  { id:"elite",   name:"Elite",    tiles:200, price:99.99, pricePerTile:"$0.50", color:GOLD, popular:false, desc:"Maximum tiles, minimum price per tile" },
];
const PACK_CAP = 200; // max add-on tiles per member per draw

// ─── WINNER FEED LIST ────────────────────────────────────────────────────────
function WinnerFeedList({ winFeed, profile }) {
  const [order, setOrder] = useState("newest"); // "newest" | "oldest"
  const feedRef = useRef(null);

  const sorted = order === "oldest" ? [...winFeed].reverse() : winFeed;

  // Auto-scroll to top when newest winner added (newest mode only)
  useEffect(() => {
    if (order === "newest" && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [winFeed.length, order]);

  return (
    <div>
      {/* Sort toggle + count */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ fontSize:10, color:TEXT3 }}>{winFeed.length} winner{winFeed.length!==1?"s":""}</div>
        <div style={{ display:"flex", gap:4 }}>
          <button onClick={()=>setOrder("newest")} style={{ background:order==="newest"?BLUE_DIM:"transparent", border:`1px solid ${order==="newest"?BLUE_BORDER:BORDER}`, borderRadius:6, padding:"3px 10px", color:order==="newest"?BLUE_BRIGHT:TEXT3, fontSize:10, fontWeight:order==="newest"?700:400, cursor:"pointer" }}>
            Newest ↑
          </button>
          <button onClick={()=>setOrder("oldest")} style={{ background:order==="oldest"?BLUE_DIM:"transparent", border:`1px solid ${order==="oldest"?BLUE_BORDER:BORDER}`, borderRadius:6, padding:"3px 10px", color:order==="oldest"?BLUE_BRIGHT:TEXT3, fontSize:10, fontWeight:order==="oldest"?700:400, cursor:"pointer" }}>
            Oldest ↓
          </button>
        </div>
      </div>

      {/* Scrollable winner list — all winners, no cap */}
      <div ref={feedRef} style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:340, overflowY:"auto", paddingRight:2 }}>
        {sorted.map((w, idx) => (
          <div key={w.id} style={{
            display:"flex", alignItems:"center", gap:8,
            borderLeft:`3px solid ${w.isMine?BLUE_BRIGHT:w.prize.color}`,
            background: w.isMine?"rgba(73,217,255,0.08)":NAVY4,
            borderRadius:"0 8px 8px 0", padding:"6px 10px",
            animation: idx===0 && order==="newest" ? "feedSlide 0.2s ease-out" : "none",
            flexShrink:0,
          }}>
            <span style={{ fontSize:14, flexShrink:0 }}>{w.prize.emoji||"★"}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, fontWeight:700, color:w.isMine?BLUE_BRIGHT:w.prize.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>
                  {w.prize.isProduct?(w.prize.label||w.prize.name):fmtMoney(w.prize.value)}
                </span>
                {w.isMine && (
                  <span style={{ fontSize:9, background:"rgba(0,230,118,0.25)", color:BLUE_BRIGHT, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>YOU!</span>
                )}
              </div>
              <div style={{ fontSize:10, color:TEXT3, marginTop:1 }}>
                {w.isMine ? profile.name : `${w.tier} #${w.member}`} · {w.state} · #{w.tile} · {w.ts}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LIVE DRAW ────────────────────────────────────────────────────────────────
const GRID_COLS = 25;
const GRID_ROWS = 16;
const GRID_SIZE = GRID_COLS * GRID_ROWS; // 400 cells

function LiveDraw({ boardType, onNav, profile, onEditProfile, onDrawStateChange }) {
  const prizes = boardType === "bonus" ? MONTHLY_PRIZES : MONTHLY_PRIZES; // always monthly main prizes
  const [prizeState, setPrizeState]   = useState(() => prizes.map(p => ({ ...p })));
  // Reset prize cabinet when board type changes
  useEffect(() => {
    setPrizeState(prizes.map(p => ({ ...p })));
    // Also reset draw state when switching boards
    runningRef.current = false;
    revealedRef.current = 0;
    if (scanRef.current) clearInterval(scanRef.current);
    setTilesRevealed(0); setDrawState("idle"); setWinFeed([]);
    setCurrentPrize(null); setScanLine(0);
    setGrid(Array.from({ length: GRID_SIZE }, () => ({ state:"pending", prize:null })));
    setMemberTileHits({});
    setBoardNum(b => b + 1);
    onDrawStateChange?.(false);
  }, [boardType]);
  const [drawState, setDrawState]     = useState("idle");
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const [tilesRevealed, setTilesRevealed] = useState(0);
  const [winFeed, setWinFeed]         = useState([]);
  const [currentPrize, setCurrentPrize] = useState(null);
  const [grid, setGrid]               = useState(() => Array.from({ length: GRID_SIZE }, () => ({ state:"pending", prize:null })));
  const [boardNum, setBoardNum]       = useState(1);
  const [scanLine, setScanLine]       = useState(0);
  const [memberTiles, setMemberTiles]  = useState(() => genTiles(profile.tier, boardType));
  // Regenerate tiles when tier or boardType changes, reset draw
  useEffect(() => {
    setMemberTiles(genTiles(profile.tier, boardType));
    setMemberTileHits({});
  }, [profile.tier, boardType]);
  const [memberTileHits, setMemberTileHits] = useState({});
  const [liveViewers,   setLiveViewers]     = useState(() => 8400 + Math.floor(Math.random()*3200));
  useEffect(() => {
    const iv = setInterval(() => setLiveViewers(v => Math.max(5000, v + Math.floor((Math.random()-0.45)*120))), 3000);
    return () => clearInterval(iv);
  }, []);
  const [addonTiles]   = useState([]); // no addon tiles — kept for legacy compat
  const [addonSpend]   = useState(0);

  // Total tiles = base member allocation only
  const addonTileCount = 0; // no addon purchases
  const baseTiles      = TOTAL_TILES;
  const totalTiles     = baseTiles;
  const basePool       = 5000000;
  const prizePoolTotal = basePool;

  const allMyTiles = memberTiles; // no addon tiles
  const tier = TIERS[profile.tier];

  const runningRef  = useRef(false);
  const revealedRef = useRef(0);
  const scanRef     = useRef(null);

  const stopDraw = useCallback(() => {
    runningRef.current = false;
    setDrawState("done"); onDrawStateChange?.(false);
    if (scanRef.current) clearInterval(scanRef.current);
  }, []);

  const resetDraw = useCallback(() => {
    runningRef.current = false;
    revealedRef.current = 0;
    if (scanRef.current) clearInterval(scanRef.current);
    setTilesRevealed(0); setDrawState("idle"); setWinFeed([]); onDrawStateChange?.(false);
    setPrizeState(prizes.map(p => ({ ...p }))); setCurrentPrize(null);
    setGrid(Array.from({ length: GRID_SIZE }, () => ({ state:"pending", prize:null })));
    setMemberTileHits({});
    setBoardNum(b => b + 1); setScanLine(0);
  }, [prizes]);

  const triggerWin = useCallback((prize, isMine) => {
    const states = ["NSW","VIC","QLD","SA","WA","TAS","NT","ACT"];
    const tierNames = ["Bronze","Silver","Gold"];
    const now = new Date();
    const aest = new Date(now.getTime() + 10*60*60*1000);
    const ts = aest.toISOString().slice(11,19) + " AEST";
    const win = {
      id: Date.now() + Math.random(),
      tile: String(Math.floor(Math.random() * totalTiles)+1).padStart(7,"0"),
      member: isMine ? profile.name : String(Math.floor(Math.random()*200000)+1).padStart(6,"0"),
      state: isMine ? profile.state : states[Math.floor(Math.random()*states.length)],
      tier: isMine ? tier.name : tierNames[Math.floor(Math.random()*3)],
      prize, isMine, ts,
    };
    setWinFeed(f => [win, ...f].slice(0, 80));
    const idx = Math.floor(Math.random() * GRID_SIZE);
    setGrid(g => { const ng=[...g]; ng[idx]={ state:"prize", prize, mine:isMine }; return ng; });
  }, [totalTiles, profile, tier]);

  const runDraw = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setDrawState("running");
    setCurrentPrize(null);
    onDrawStateChange?.(true);

    let sl = 0;
    scanRef.current = setInterval(() => { sl=(sl+1)%GRID_ROWS; setScanLine(sl); }, 60);

    const tilesPerSec = calcDrawSpeed(totalTiles);
    const BATCH    = Math.max(10, Math.ceil(tilesPerSec / 50));
    const INTERVAL = 20;
    let localPrizes = prizes.map(p => ({ ...p }));
    let allP = [];
    for (const p of localPrizes) for (let i=0; i<p.qty; i++) allP.push({ ...p });
    const prizePositions = buildSpreadPrizePositions(allP, totalTiles);

    const memberTileSet = new Set(memberTiles);
    const memberWonRef  = { count: 0 }; // track how many prizes member has won this draw

    const revealStep = () => {
      if (!runningRef.current) return;
      for (let b = 0; b < BATCH; b++) {
        revealedRef.current++;
        const tileNum = revealedRef.current;
        const gridIdx = tileNum % GRID_SIZE;
        const isMemberTile = memberTileSet.has(tileNum);

        if (prizePositions.has(tileNum)) {
          const prize = prizePositions.get(tileNum);
          const pi = localPrizes.findIndex(p => p.name===prize.name && p.remaining>0);
          if (pi >= 0) {
            localPrizes[pi].remaining--;
            setPrizeState(localPrizes.map(p => ({ ...p })));
            // Member tile wins — max 1 prize per draw
            const isMine = isMemberTile && memberWonRef.count === 0;
            if (isMine) {
              memberWonRef.count++;
              setMemberTileHits(h => ({ ...h, [tileNum]: { prize } }));
            } else if (isMemberTile) {
              // Member tile checked but already won — mark as no prize
              setMemberTileHits(h => ({ ...h, [tileNum]: { prize: null } }));
            }
            triggerWin(prize, isMine);
            setTilesRevealed(revealedRef.current);
            if (prize.silent) {
              setGrid(g => { const ng=[...g]; ng[gridIdx]={ state:"prize", prize }; return ng; });
            } else {
              setCurrentPrize({ ...prize, isMine });
              setDrawState("paused");
              if (scanRef.current) clearInterval(scanRef.current);
              setTimeout(() => {
                if (!runningRef.current) return;
                setCurrentPrize(null);
                setDrawState("running");
                scanRef.current = setInterval(() => { sl=(sl+1)%GRID_ROWS; setScanLine(sl); }, 60);
                setTimeout(revealStep, INTERVAL);
              }, prize.pause);
              return;
            }
          }
        } else {
          // Non-prize tile — if it's a member tile, mark it as checked (no prize)
          if (isMemberTile) {
            setMemberTileHits(h => ({ ...h, [tileNum]: { prize: null } }));
          }
          setGrid(g => { const ng=[...g]; ng[gridIdx]={ state:"empty", prize:null }; return ng; });
        }
      }
      setTilesRevealed(revealedRef.current);
      if (revealedRef.current >= totalTiles || !runningRef.current) { stopDraw(); return; }
      setTimeout(revealStep, INTERVAL);
    };
    setTimeout(revealStep, INTERVAL);
  }, [prizes, totalTiles, triggerWin, stopDraw, memberTiles]);

  const simulateWin = useCallback((overridePrize) => {
    const isMine = Math.random()>0.5;
    const prize = overridePrize || prizes[Math.floor(Math.random()*prizes.length)];
    triggerWin(prize, isMine); setCurrentPrize({...prize,isMine});
    setTimeout(()=>setCurrentPrize(null), prize.pause);
    setDemoPickerOpen(false);
  }, [prizes, triggerWin]);

  const pct = Math.min(100,(tilesRevealed/totalTiles)*100);
  const remainingPrizes = prizeState.reduce((s,p)=>s+p.remaining,0);
  const totalPrizesCount = prizes.reduce((s,p)=>s+p.qty,0);
  const prizePool = prizes.reduce((s,p)=>s+p.value*p.qty,0);

  const myHitCount = Object.keys(memberTileHits).length;
  const myWinCount = Object.values(memberTileHits).filter(h=>h.prize).length;
  const myWinTotal = Object.values(memberTileHits).filter(h=>h.prize).reduce((s,h)=>s+(h.prize?.value||0),0);

  const isMillionaire = currentPrize?.value >= 1000000;

  return (
    <div style={{ background:`radial-gradient(ellipse at 50% 0%, #0D2040 0%, ${NAVY} 70%)`, minHeight:"100vh", color:TEXT }}>
      <style>{`
        @keyframes tileFlip {
          0%  { transform:scaleY(1); opacity:1; }
          30% { transform:scaleY(0); opacity:0.5; }
          60% { transform:scaleY(0); opacity:0.5; }
          100%{ transform:scaleY(1); opacity:0.3; }
        }
        @keyframes tileReveal {
          0%  { transform:scale(0.5) rotateY(90deg); opacity:0; }
          60% { transform:scale(1.2) rotateY(-5deg); opacity:1; }
          100%{ transform:scale(1) rotateY(0deg); opacity:1; }
        }
        @keyframes myTileReveal {
          0%  { transform:scale(0.6); opacity:0; }
          50% { transform:scale(1.3); }
          100%{ transform:scale(1); }
        }
        /* PETROL — quick double-blink */
        @keyframes prizeFlashPetrol {
          0%  { transform:scale(1);   opacity:1; }
          20% { transform:scale(1.5); opacity:1; }
          35% { transform:scale(1);   opacity:0.5; }
          50% { transform:scale(1.3); opacity:1; }
          100%{ transform:scale(1);   opacity:1; }
        }
        /* TECH — bounce pop */
        @keyframes prizeFlashTech {
          0%  { transform:scale(0.3) rotate(-10deg); opacity:0; }
          50% { transform:scale(1.5) rotate(3deg);  opacity:1; }
          70% { transform:scale(0.9) rotate(-2deg); }
          85% { transform:scale(1.15) rotate(1deg); }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }
        /* HOLIDAY — float up */
        @keyframes prizeFlashHoliday {
          0%  { transform:scale(0.5) translateY(20px); opacity:0; }
          60% { transform:scale(1.2) translateY(-8px); opacity:1; }
          80% { transform:scale(0.95) translateY(3px); }
          100%{ transform:scale(1) translateY(0); opacity:1; }
        }
        /* CAR — zoom in from left */
        @keyframes prizeFlashCar {
          0%  { transform:scale(0.2) translateX(-40px) rotate(-5deg); opacity:0; }
          55% { transform:scale(1.3) translateX(5px) rotate(1deg); opacity:1; }
          75% { transform:scale(0.95) translateX(-2px); }
          100%{ transform:scale(1) translateX(0) rotate(0deg); opacity:1; }
        }
        /* MILLION — full epic sequence */
        @keyframes prizeFlashMillion {
          0%  { transform:scale(0.1); opacity:0; filter:brightness(3); }
          30% { transform:scale(1.4); opacity:1; filter:brightness(2); }
          50% { transform:scale(0.95); filter:brightness(1.5); }
          65% { transform:scale(1.15); }
          80% { transform:scale(0.98); }
          100%{ transform:scale(1); filter:brightness(1); opacity:1; }
        }
        @keyframes myTileWin {
          0%  { transform:scale(0.5); opacity:0; }
          40% { transform:scale(1.7); }
          65% { transform:scale(0.85); }
          80% { transform:scale(1.2); }
          100%{ transform:scale(1); }
        }
        /* Banner entry animations per tier */
        @keyframes bannerPetrol {
          0%  { transform:translateY(-10px); opacity:0; }
          100%{ transform:translateY(0); opacity:1; }
        }
        @keyframes bannerTech {
          0%  { transform:scale(0.9) translateY(-12px); opacity:0; }
          70% { transform:scale(1.02); opacity:1; }
          100%{ transform:scale(1); opacity:1; }
        }
        @keyframes bannerHoliday {
          0%  { transform:scale(0.85) translateY(-16px); opacity:0; }
          65% { transform:scale(1.03); opacity:1; }
          100%{ transform:scale(1); opacity:1; }
        }
        @keyframes bannerCar {
          0%  { transform:scale(0.8) translateX(-20px); opacity:0; }
          60% { transform:scale(1.04) translateX(4px); opacity:1; }
          100%{ transform:scale(1) translateX(0); opacity:1; }
        }
        @keyframes bannerMillion {
          0%  { transform:scale(0.7); opacity:0; filter:brightness(3); }
          40% { transform:scale(1.08); opacity:1; filter:brightness(1.8); }
          70% { transform:scale(0.97); filter:brightness(1.2); }
          100%{ transform:scale(1); filter:brightness(1); opacity:1; }
        }
        @keyframes millionPulse {
          0%,100%{ box-shadow:0 0 40px #D8B45A88, 0 0 80px #D8B45A44; }
          50%    { box-shadow:0 0 80px #D8B45Acc, 0 0 160px #C8A75666, 0 0 240px #D8B45A33; }
        }
        @keyframes confettiDrop {
          0%  { transform:translateY(-20px) rotate(0deg); opacity:1; }
          100%{ transform:translateY(60px) rotate(360deg); opacity:0; }
        }
        @keyframes scanPulse  { 0%{opacity:0.1} 100%{opacity:0.35} }
        @keyframes feedSlide  { 0%{transform:translateY(-10px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes goldRain   { 0%,100%{text-shadow:0 0 20px #D8B45A} 50%{text-shadow:0 0 80px #D8B45A,0 0 140px #C8A756} }
        @keyframes shimmer    { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes prizePop   { 0%{transform:scale(0.85);opacity:0} 55%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        /* Pokie-style tile spin — cycles through colours before landing */
        @keyframes tilePokie {
          0%  { background:#1A3A1A; transform:scaleY(1); }
          10% { background:#2B9FE8; transform:scaleY(0.1); }
          20% { background:#D8B45A; transform:scaleY(1); }
          30% { background:#FF4444; transform:scaleY(0.1); }
          40% { background:#2B9FE8; transform:scaleY(1); }
          50% { background:#49D9FF; transform:scaleY(0.1); }
          60% { background:#C8A756; transform:scaleY(1); }
          70% { background:#2B9FE8; transform:scaleY(0.1); }
          85% { background:#FF4444; transform:scaleY(1); }
          100%{ background:#1A0808; transform:scaleY(1); }
        }
        /* Red — nothing tile final state flash in */
        @keyframes tileRedFlash {
          0%  { background:#FF4444; transform:scale(1.3); box-shadow:0 0 12px #FF444488; }
          40% { background:#CC1111; transform:scale(1.1); box-shadow:0 0 6px #FF444466; }
          100%{ background:#1A0808; transform:scale(1);   box-shadow:0 0 3px #FF444422; }
        }
        /* Green — winner flash */
        @keyframes tileGreenFlash {
          0%  { background:#00FF88; transform:scale(1.6); box-shadow:0 0 20px #00FF8888; }
          40% { background:#49D9FF; transform:scale(1.3); box-shadow:0 0 14px #49D9FF66; }
          100%{ background:#49D9FF; transform:scale(1.1); box-shadow:0 0 10px #49D9FF44; }
        }
        /* Board tile active cycling while running */
        @keyframes tileCycle {
          0%  { opacity:0.5; background:#0D1D35; }
          25% { opacity:1;   background:#1A3060; }
          50% { opacity:0.7; background:#0D1D35; }
          75% { opacity:1;   background:#162444; }
          100%{ opacity:0.5; background:#0D1D35; }
        }

        /* Member tile flip — revealed empty */
        @keyframes tileCardFlip {
          0%   { transform:rotateY(0deg) scale(1); }
          25%  { transform:rotateY(90deg) scale(0.9); }
          50%  { transform:rotateY(180deg) scale(0.9); }
          75%  { transform:rotateY(270deg) scale(0.95); }
          100% { transform:rotateY(360deg) scale(1); }
        }
        /* Member tile win — spin + glow + bounce */
        @keyframes tileCardWin {
          0%   { transform:scale(0.6) rotate(-8deg); opacity:0; }
          30%  { transform:scale(1.5) rotate(4deg);  opacity:1; }
          50%  { transform:scale(0.9) rotate(-2deg); }
          65%  { transform:scale(1.25) rotate(1deg); }
          80%  { transform:scale(0.95); }
          100% { transform:scale(1.1) rotate(0deg); }
        }
        /* Win tile persistent pulse */
        @keyframes tileWinPulse {
          0%,100%{ box-shadow:0 0 8px #49D9FF66, 0 0 16px #49D9FF33; transform:scale(1.1); }
          50%    { box-shadow:0 0 16px #49D9FFcc, 0 0 32px #49D9FF66; transform:scale(1.15); }
        }
        /* Checking flash on member tile */
        @keyframes tileCardCheck {
          0%   { transform:scale(1); background:rgba(43,159,232,0.08); }
          40%  { transform:scale(1.1); background:rgba(43,159,232,0.5); box-shadow:0 0 12px rgba(43,159,232,0.6); }
          100% { transform:scale(1); background:rgba(43,159,232,0.08); box-shadow:none; }
        }
      `}</style>

      {/* Sub-nav */}
      <DrawCycleBar />
      <div style={{ background:"rgba(10,15,30,0.9)", backdropFilter:"blur(12px)", borderBottom:`1px solid ${BORDER}`, padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <button onClick={()=>onNav("home")} style={{ background:"transparent", border:`1px solid ${BORDER2}`, borderRadius:6, padding:"6px 14px", color:TEXT2, cursor:"pointer", fontSize:13 }}>← Back</button>
        <div style={{ display:"flex", gap:8 }}>
          <GhostBtn active={boardType==="monthly"} onClick={()=>onNav("draw-monthly")}>◆ Monthly Millionaire</GhostBtn>
          <button onClick={()=>onNav("bonus")} style={{ background:"rgba(255,215,0,0.08)", border:`1px solid ${GOLD}44`, borderRadius:8, padding:"8px 18px", color:GOLD, fontSize:14, fontWeight:700, cursor:"pointer" }}>★ Gold Bonus Draw</button>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(73,217,255,0.08)", border:"1px solid rgba(73,217,255,0.18)", borderRadius:20, padding:"4px 12px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:BLUE_BRIGHT, animation:"livePulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize:12, color:BLUE_BRIGHT, fontWeight:700 }}>{liveViewers.toLocaleString()} watching</span>
          </div>
          <span style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5 }}>Board #{String(boardNum).padStart(3,"0")}</span>
          <div style={{ display:"flex", alignItems:"center", gap:6, background: BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:20, padding:"4px 14px" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background: drawState==="running"?BLUE_BRIGHT:drawState==="paused"?GOLD:"#555", display:"inline-block", animation: drawState==="running"?"blink 1s ease-in-out infinite":"none" }} />
            <span style={{ fontSize:12, color: drawState==="running"?BLUE_BRIGHT:drawState==="paused"?GOLD:TEXT3, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
              {drawState==="running"?"● LIVE":drawState==="paused"?"★ PRIZE HIT":drawState==="done"?"✓ COMPLETE":"READY"}
            </span>
          </div>
          {/* Profile chip */}
          <button onClick={onEditProfile} title="Edit your profile" style={{ display:"flex", alignItems:"center", gap:8, background:NAVY3, border:`1px solid ${tier.color}44`, borderRadius:20, padding:"4px 12px 4px 6px", cursor:"pointer", position:"relative" }}>
            <div style={{ position:"relative" }}>
              <span style={{ fontSize:22 }}>{profile.avatar||"★"}</span>
              <span style={{ position:"absolute", bottom:-2, right:-4, fontSize:9, background:BLUE, color:"#fff", borderRadius:6, padding:"1px 4px", fontWeight:700 }}>✎</span>
            </div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:12, fontWeight:700, color:tier.color, lineHeight:1 }}>{profile.name.split(" ")[0]}</div>
              <div style={{ fontSize:10, color:TEXT3, lineHeight:1, marginTop:2 }}>{tier.name} · {memberTiles.length} tiles</div>
            </div>
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1280, margin:"0 auto", padding:"20px 24px" }}>

        {/* MILLIONAIRE OVERLAY */}
        {isMillionaire && currentPrize && (
          <div style={{ background:"rgba(0,0,0,0.97)", border:`3px solid ${GOLD}`, borderRadius:20, padding:"48px 40px", marginBottom:20, textAlign:"center", animation:"bannerMillion 0.6s cubic-bezier(0.36,0.07,0.19,0.97)", position:"relative", overflow:"hidden", boxShadow:`0 0 120px ${GOLD}88, inset 0 0 80px ${GOLD}11`, animationName:"millionPulse", animationDuration:"2s", animationIterationCount:"infinite", animationDelay:"0.6s" }}>
            <Confetti />
            <div style={{ fontSize:32, marginBottom:12, animation:"myTileWin 0.8s ease-out" }}>🎊★🎊</div>
            <div style={{ fontSize:14, color:GOLD, letterSpacing:5, textTransform:"uppercase", marginBottom:16, fontWeight:700 }}>WE HAVE A MILLIONAIRE</div>
            <div style={{ fontSize:"clamp(56px,9vw,96px)", fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", color:GOLD, lineHeight:1, animation:"goldRain 1.5s ease-in-out infinite" }}>$1,000,000</div>
            {currentPrize.isMine && (
              <div style={{ fontSize:28, fontWeight:900, color:BLUE_BRIGHT, marginTop:20, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", animation:"prizePop 0.5s ease-out 0.3s both" }}>
                🎉 THAT'S YOU, {profile.name.split(" ")[0].toUpperCase()}! 🎉
              </div>
            )}
          </div>
        )}

        {/* Prize flash (non-millionaire) */}
        {currentPrize && !isMillionaire && (() => {
          const pa = getPrizeAnimation(currentPrize);
          const pc = currentPrize.isMine ? BLUE_BRIGHT : currentPrize.color;
          const isBig = currentPrize.value >= 10000 || currentPrize.name === "Car Prize" || currentPrize.name === "Major Prize";
          return (
            <div style={{
              background: `${pc}12`,
              border:`${isBig?"3px":"2px"} solid ${pc}`,
              borderRadius:18, padding: isBig?"28px 36px":"18px 28px",
              marginBottom:16, display:"flex", alignItems:"center", gap:24,
              animation: pa.banner, position:"relative", overflow:"hidden",
              boxShadow:`0 0 ${isBig?80:40}px ${pc}${isBig?"66":"44"}, inset 0 0 30px ${pc}0A`,
            }}>
              {pa.confetti && <Confetti />}
              <div style={{ fontSize: isBig?56:40, animation:`${pa.tile.split(" ")[0]} ${isBig?"0.6s":"0.35s"} ease-out`, flexShrink:0, position:"relative", zIndex:1 }}>{currentPrize.emoji||"★"}</div>
              <div style={{ flex:1, position:"relative", zIndex:1 }}>
                <div style={{ fontSize:10, color:pc, textTransform:"uppercase", letterSpacing:3, marginBottom:6, fontWeight:700, animation:"shimmer 1.2s ease-in-out infinite" }}>
                  {currentPrize.isMine ? "🎉 YOUR TILE HIT!" : "★  PRIZE HIT — BOARD PAUSED"}
                </div>
                <div style={{ fontSize:`clamp(${isBig?"36px":"24px"},${isBig?"5":"4"}vw,${isBig?"66px":"44px"})`, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", color:pc, lineHeight:1, textShadow:`0 0 ${isBig?50:25}px ${pc}` }}>
                  {currentPrize.isProduct ? (currentPrize.label||currentPrize.name) : fmtMoney(currentPrize.value)}
                </div>
                <div style={{ fontSize:14, color:TEXT2, marginTop:8 }}>
                  {currentPrize.isProduct ? "Prize Pack Winner!" : currentPrize.name}
                  {!currentPrize.isMine && <span style={{ color:TEXT3 }}> — Draw resuming shortly...</span>}
                </div>
              </div>
              {currentPrize.isMine && <div style={{ fontSize:isBig?72:52, animation:"myTileWin 0.7s ease-out", position:"relative", zIndex:1 }}>🎊</div>}
            </div>
          );
        })()}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, alignItems:"start" }}>
          {/* ── MAIN BOARD AREA ── */}
          <div>
            {/* Progress + speed */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 20px", marginBottom:14, display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:12 }}>
                  <span style={{ color:TEXT3 }}>Live Draw in Progress</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ background:"rgba(0,102,255,0.15)", border:`1px solid ${BLUE_BORDER}`, borderRadius:10, padding:"2px 8px", fontSize:10, color:BLUE_BRIGHT, fontWeight:700 }}>DEMO MODE</span>
                    <span style={{ color:TEXT3, fontFamily:"monospace" }}>{pct.toFixed(1)}% complete</span>
                  </div>
                </div>
                <div style={{ height:5, background:NAVY4, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:pct+"%", background:"linear-gradient(90deg,#0066FF,#00C3FF)", borderRadius:3, transition:"width 0.15s", boxShadow:`0 0 10px ${BLUE}` }} />
                </div>
              </div>
              <div style={{ fontSize:22, fontWeight:900, color:BLUE_BRIGHT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", minWidth:52, textAlign:"right" }}>{pct.toFixed(1)}%</div>
            </div>

            {/* THE BOARD GRID */}
            <div style={{ background:"#030810", border:`1px solid rgba(43,159,232,0.2)`, borderRadius:16, padding:14, marginBottom:14, position:"relative", overflow:"hidden", boxShadow:"inset 0 0 60px rgba(0,0,0,0.5)" }}>
              {/* Scan line + active column highlight */}
              {drawState==="running" && (
                <>
                  <div style={{ position:"absolute", left:14, right:14, height:`${100/GRID_ROWS}%`, top:`calc(14px + ${scanLine}*(${100/GRID_ROWS}%))`, background:`linear-gradient(180deg, transparent 0%, rgba(43,159,232,0.25) 40%, rgba(43,159,232,0.35) 50%, rgba(43,159,232,0.25) 60%, transparent 100%)`, pointerEvents:"none", animation:"scanPulse 0.4s ease-in-out alternate infinite", zIndex:2, borderTop:`1px solid rgba(43,159,232,0.4)`, borderBottom:`1px solid rgba(43,159,232,0.4)` }} />
                  <div style={{ position:"absolute", top:14, bottom:14, left:14, right:14, background:`radial-gradient(ellipse at 50% ${(scanLine/GRID_ROWS)*100}%, rgba(43,159,232,0.06) 0%, transparent 60%)`, pointerEvents:"none", zIndex:1 }} />
                </>
              )}
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${GRID_COLS},1fr)`, gap:2.5, position:"relative", zIndex:1 }}>
                {grid.map((cell, i) => {
                  const isPrize    = cell.state === "prize";
                  const isEmpty    = cell.state === "empty";
                  const isRunning  = drawState === "running" || drawState === "paused";
                  const prizeColor = cell.prize?.color || BLUE_BRIGHT;

                  // Two states only:
                  // 1. Running — random blue flash cycling
                  // 2. Prize hit — bright prize colour glow
                  let bg, shadow, border, anim;
                  if (isPrize) {
                    bg     = prizeColor;
                    shadow = `0 0 14px ${prizeColor}, 0 0 28px ${prizeColor}88`;
                    border = `2px solid ${prizeColor}`;
                    anim   = "prizeTileFlash 0.5s cubic-bezier(0.36,0.07,0.19,0.97)";
                  } else if (isEmpty) {
                    bg     = "#080C14";
                    shadow = "none";
                    border = "none";
                    anim   = "none";
                  } else {
                    bg     = "#0D1D35";
                    shadow = "none";
                    border = "none";
                    anim   = isRunning ? `tileCycle ${1.2 + (i%12)*0.1}s ease-in-out infinite` : "none";
                  }

                  return (
                    <div key={i} style={{
                      aspectRatio:"1", borderRadius:2,
                      background:bg, boxShadow:shadow, border, animation:anim,
                    }} />
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:12 }}>
              {drawState==="idle"||drawState==="done" ? (
                <BlueBtn onClick={()=>drawState==="done"?resetDraw():runDraw()}>{drawState==="done"?"⟳ NEW DRAW":"▶ START DRAW"}</BlueBtn>
              ) : (
                <button onClick={stopDraw} style={{ background:"transparent", color:"#FF6060", border:"2px solid #FF606044", borderRadius:8, padding:"14px 32px", fontWeight:700, fontSize:15, cursor:"pointer" }}>■ Stop</button>
              )}
              <button onClick={()=>setDemoPickerOpen(o=>!o)} style={{ background:BLUE_DIM, color:BLUE_BRIGHT, border:`1px solid ${BLUE_BORDER}`, borderRadius:8, padding:"14px 22px", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                ✦ DEMO: TRIGGER WIN {demoPickerOpen?"▲":"▼"}
              </button>
              {drawState!=="idle" && <button onClick={resetDraw} style={{ background:"transparent", color:TEXT2, border:`1px solid ${BORDER}`, borderRadius:8, padding:"14px 24px", fontSize:15, cursor:"pointer" }}>Reset</button>}
            </div>

            {/* Demo note */}
            <div style={{ background:"rgba(0,102,255,0.05)", border:`1px solid ${BLUE_BORDER}`, borderRadius:10, padding:"10px 16px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:14 }}>ℹ️</span>
              <div style={{ fontSize:11, color:TEXT3 }}>
                <strong style={{color:TEXT2}}>Demo mode</strong> — prize quantities reduced for presentation speed (~2 min).
                Real monthly draw: 50 cars · 100 holidays · 500 tech · 10,000 vouchers · $1M cash. Runs server-side.
              </div>
            </div>

            {/* Demo prize picker */}
            {demoPickerOpen && (
              <div style={{ background:NAVY3, border:`1px solid ${BLUE_BORDER}`, borderRadius:14, padding:"16px 20px", marginBottom:16 }}>
                <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:2, marginBottom:14, fontWeight:700 }}>Select a prize to preview its animation:</div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {prizes.map(p => (
                    <button key={p.name} onClick={()=>simulateWin(p)} style={{
                      display:"flex", alignItems:"center", gap:8,
                      background:`${p.color}18`, border:`1.5px solid ${p.color}55`,
                      borderRadius:10, padding:"10px 16px", cursor:"pointer",
                      transition:"all 0.15s",
                    }}
                      onMouseOver={e=>{e.currentTarget.style.background=`${p.color}30`; e.currentTarget.style.borderColor=p.color;}}
                      onMouseOut={e=>{e.currentTarget.style.background=`${p.color}18`; e.currentTarget.style.borderColor=`${p.color}55`;}}
                    >
                      <span style={{ fontSize:22 }}>{p.emoji||"★"}</span>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontSize:13, fontWeight:900, color:p.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>
                          {p.isProduct ? p.label : fmtMoney(p.value)}
                        </div>
                        <div style={{ fontSize:10, color:TEXT3 }}>{p.pause/1000}s pause</div>
                      </div>
                    </button>
                  ))}
                  <button onClick={()=>{ const p={...prizes[0], isMine:true}; simulateWin(p); }} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,230,118,0.1)", border:"1.5px solid rgba(0,230,118,0.4)", borderRadius:10, padding:"10px 16px", cursor:"pointer" }}>
                    <span style={{ fontSize:22 }}>🎉</span>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ fontSize:13, fontWeight:900, color:BLUE_BRIGHT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>YOUR TILE WINS</div>
                      <div style={{ fontSize:10, color:TEXT3 }}>Personal win animation</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── MY TILES PANEL (below board) ── */}
            <div style={{ background:NAVY3, border:`1px solid ${tier.color}33`, borderRadius:16, padding:"22px 24px", boxShadow:`0 0 30px ${tier.glow}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                <span style={{ fontSize:32 }}>{profile.avatar||"★"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:tier.color, textTransform:"uppercase", letterSpacing:2, fontWeight:700, fontFamily:"'Arial Black',Arial,sans-serif" }}>{tier.name} Member</div>
                  <div style={{ fontSize:18, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{profile.name}</div>
                  <div style={{ fontSize:12, color:TEXT3 }}>{profile.state} · #{profile.id}</div>
                </div>
                <div style={{ display:"flex", gap:12 }}>
                  <div style={{ textAlign:"center", background:NAVY4, borderRadius:10, padding:"10px 16px" }}>
                    <div style={{ fontSize:24, fontWeight:900, color:tier.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{allMyTiles.length}</div>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1 }}>
                      My Tiles
                      {0 > 0 && <span style={{ color:GOLD, display:"block" }}>+{0} pack</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:"center", background:NAVY4, borderRadius:10, padding:"10px 16px" }}>
                    <div style={{ fontSize:24, fontWeight:900, color: myHitCount>0?BLUE_BRIGHT:TEXT3, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{myHitCount}</div>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1 }}>Revealed</div>
                  </div>
                  {myWinCount>0 && (
                    <div style={{ textAlign:"center", background:"rgba(73,217,255,0.08)", border:"1px solid rgba(0,230,118,0.25)", borderRadius:10, padding:"10px 16px" }}>
                      <div style={{ fontSize:24, fontWeight:900, color:BLUE_BRIGHT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{fmtMoney(myWinTotal)}</div>
                      <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1 }}>Won!</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tile pack purchase panel */}
              {drawState === "idle" && tier.bonusAccess && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:10, padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:16 }}>★</span>
                      <div>
                        <div style={{ fontSize:12, color:BLUE_BRIGHT, fontWeight:700 }}>$1M Gold Bonus Draw — Same Night</div>
                        <div style={{ fontSize:11, color:TEXT3 }}>40 bonus tiles allocated · Gold members only · No extra payment</div>
                      </div>
                    </div>
                    <button onClick={()=>onNav("bonus")} style={{ background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:8, padding:"6px 14px", color:BLUE_BRIGHT, fontSize:12, fontWeight:700, cursor:"pointer" }}>View →</button>
                  </div>
                </div>
              )}

              {/* MY TILES — bingo card style */}
              <div style={{ marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5, fontWeight:700 }}>My Tiles — Monthly Millionaire Draw</div>
                <div style={{ fontSize:11, color:TEXT3 }}>
                  {drawState !== "idle" && (
                    <span>{Object.keys(memberTileHits).length} of {memberTiles.length} revealed</span>
                  )}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))", gap:6 }}>
                {memberTiles.map((t, idx) => {
                  const hit     = memberTileHits[t];
                  const isWin   = !!hit?.prize;
                  const isChecked = hit !== undefined;
                  const prizeEmoji = hit?.prize?.emoji || "★";
                  const prizeColor = hit?.prize?.color || BLUE_BRIGHT;
                  const prizeName  = hit?.prize?.label || hit?.prize?.name || "";

                  if (isWin) {
                    return (
                      <div key={t} style={{ borderRadius:10, padding:"8px 10px", background:`${prizeColor}22`, border:`2px solid ${prizeColor}`, boxShadow:`0 0 12px ${prizeColor}66`, animation:"tileWinPulse 1.4s ease-in-out infinite", textAlign:"center" }}>
                        <div style={{ fontSize:20, marginBottom:4 }}>{prizeEmoji}</div>
                        <div style={{ fontSize:9, color:prizeColor, fontWeight:900, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2 }}>WINNER</div>
                        <div style={{ fontSize:10, color:prizeColor, fontWeight:700, lineHeight:1.3 }}>{prizeName}</div>
                        <div style={{ fontSize:9, color:`${prizeColor}99`, marginTop:3, fontFamily:"monospace" }}>#{String(t).padStart(7,"0")}</div>
                      </div>
                    );
                  } else if (isChecked) {
                    return (
                      <div key={t} style={{ borderRadius:8, padding:"8px 10px", background:"rgba(255,255,255,0.02)", border:`1px solid ${BORDER}`, textAlign:"center", opacity:0.4 }}>
                        <div style={{ fontSize:14, marginBottom:2, opacity:0.3 }}>✗</div>
                        <div style={{ fontSize:9, color:TEXT3, fontFamily:"monospace" }}>#{String(t).padStart(7,"0")}</div>
                        <div style={{ fontSize:9, color:TEXT3, marginTop:2 }}>no prize</div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={t} style={{ borderRadius:8, padding:"8px 10px", background:NAVY4, border:`1px solid ${BORDER}`, textAlign:"center" }}>
                        <div style={{ fontSize:14, marginBottom:2 }}>◇</div>
                        <div style={{ fontSize:9, color:TEXT3, fontFamily:"monospace" }}>#{String(t).padStart(7,"0")}</div>
                        <div style={{ fontSize:9, color:TEXT3, marginTop:2 }}>{drawState==="idle" ? "pending" : "in draw"}</div>
                      </div>
                    );
                  }
                })}
              </div>
              {drawState==="idle" && (
                <div style={{ marginTop:12, fontSize:12, color:TEXT3, fontStyle:"italic", textAlign:"center", padding:"12px 0" }}>
                  ◇ Start the draw to watch your tiles reveal in real time
                </div>
              )}
              {drawState==="done" && Object.values(memberTileHits).filter(h=>h?.prize).length === 0 && (
                <div style={{ marginTop:12, background:"rgba(255,96,96,0.06)", border:"1px solid rgba(255,96,96,0.2)", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#FF6060", textAlign:"center" }}>
                  No prizes this draw — better luck next month!
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Prize cabinet — simple totals only */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, padding:"18px 18px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:TEXT3, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${BLUE_BRIGHT},${BLUE})`, borderRadius:2 }} />
                Prize Cabinet
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {prizeState.map(p => {
                  const allGone = p.remaining === 0;
                  return (
                    <div key={p.name} style={{ display:"flex", alignItems:"center", gap:10, background:NAVY4, borderRadius:10, padding:"9px 12px", opacity:allGone?0.35:1 }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{p.emoji}</span>
                      <div style={{ flex:1, fontSize:13, fontWeight:700, color:allGone?TEXT3:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {(p.isProduct||p.value===0)?(p.label||p.name):fmtMoney(p.value)}
                      </div>
                      {/* Simple total — just how many prizes */}
                      <div style={{ fontSize:15, fontWeight:900, color:allGone?BLUE_BRIGHT:p.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", flexShrink:0 }}>
                        {allGone ? "✓" : `× ${p.realQty ? p.realQty.toLocaleString() : p.qty}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Winner feed — running tally per prize with won/available */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, padding:"18px 18px", flex:1 }}>
              <div style={{ fontSize:11, fontWeight:700, color:TEXT3, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${BLUE_BRIGHT},${BLUE})`, borderRadius:2 }} />
                Live Winners
                {winFeed.length > 0 && (
                  <span style={{ marginLeft:"auto", background:BLUE_DIM, color:BLUE_BRIGHT, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>{winFeed.length}</span>
                )}
              </div>

              {/* Prize scoreboard — always visible from draw start */}
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:12 }}>
                {prizeState.map(p => {
                  const won = p.qty - p.remaining;
                  const allGone = p.remaining === 0;
                  return (
                    <div key={p.name} style={{ display:"flex", alignItems:"center", gap:8, background:NAVY4, borderRadius:8, padding:"6px 10px", opacity: drawState==="idle" ? 0.5 : 1 }}>
                      <span style={{ fontSize:13, flexShrink:0 }}>{p.emoji}</span>
                      <div style={{ flex:1, fontSize:11, color: allGone ? BLUE_BRIGHT : TEXT2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {(p.isProduct||p.value===0)?(p.label||p.name):fmtMoney(p.value)}
                      </div>
                      {/* won / total — always shown */}
                      <div style={{ flexShrink:0, display:"flex", alignItems:"baseline", gap:1 }}>
                        <span style={{ fontSize:15, fontWeight:900, color: allGone ? BLUE_BRIGHT : won > 0 ? p.color : TEXT3, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", transition:"color 0.3s" }}>{won}</span>
                        <span style={{ fontSize:11, color:TEXT3 }}>/{p.qty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ height:1, background:BORDER, marginBottom:10 }} />

              {/* Winner feed below scoreboard */}
              {winFeed.length === 0 ? (
                <div style={{ textAlign:"center", padding:"16px 0", color:TEXT3, fontSize:12 }}>
                  {drawState === "idle" ? "Start the draw to see winners" : "Watching for prize hits..."}
                </div>
              ) : (
                <WinnerFeedList winFeed={winFeed} profile={profile} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WINNERS PAGE ────────────────────────────────────────────────────────────
// Monthly draw: 50 cars + 100 holidays + 500 tech + 10,000 vouchers + $1M cash
const WEEKLY_RECENT = [
  { name: "Jason M.",    state: "QLD", prize: "▰ Brand New Car",  tier: "Gold",   avatar: "★", color: GOLD },
  { name: "Priya S.",    state: "VIC", prize: "✦ Holiday Package", tier: "Silver", avatar: "✦", color: "#00BFFF" },
  { name: "Dave H.",     state: "NSW", prize: "✦ Holiday Package", tier: "Gold",   avatar: "✦", color: "#00BFFF" },
  { name: "Mel T.",      state: "WA",  prize: "✦ Holiday Package", tier: "Silver", avatar: "◆", color: "#00BFFF" },
  { name: "Chris B.",    state: "SA",  prize: "✦ Holiday Package", tier: "Bronze", avatar: "✦", color: "#00BFFF" },
  { name: "Anh N.",      state: "VIC", prize: "✦ Holiday Package", tier: "Gold",   avatar: "◆", color: "#00BFFF" },
  { name: "Rebecca F.",  state: "QLD", prize: "◇ Tech Bundle",     tier: "Silver", avatar: "◆", color: "#2B9FE8" },
  { name: "Marcus T.",   state: "QLD", prize: "◇ Tech Bundle",     tier: "Bronze", avatar: "▲", color: "#2B9FE8" },
  { name: "Jess L.",     state: "WA",  prize: "◇ Tech Bundle",     tier: "Silver", avatar: "◆", color: "#2B9FE8" },
  { name: "Daniel P.",   state: "SA",  prize: "◇ Tech Bundle",     tier: "Entry",  avatar: "◇", color: "#2B9FE8" },
  { name: "Sarah K.",    state: "NSW", prize: "◇ Tech Bundle",     tier: "Gold",   avatar: "◆", color: "#2B9FE8" },
  { name: "Tom W.",      state: "VIC", prize: "◇ Tech Bundle",     tier: "Silver", avatar: "✦", color: "#2B9FE8" },
  { name: "Amy R.",      state: "NSW", prize: "◇ Tech Bundle",     tier: "Gold",   avatar: "✦", color: "#2B9FE8" },
  { name: "Ben K.",      state: "QLD", prize: "◇ Tech Bundle",     tier: "Bronze", avatar: "◆", color: "#2B9FE8" },
  { name: "Lisa M.",     state: "VIC", prize: "◇ Tech Bundle",     tier: "Silver", avatar: "✦", color: "#2B9FE8" },
  { name: "Ryan O.",     state: "SA",  prize: "◇ Tech Bundle",     tier: "Gold",   avatar: "★", color: "#2B9FE8" },
  { name: "Chloe T.",    state: "WA",  prize: "◇ Tech Bundle",     tier: "Silver", avatar: "◆", color: "#2B9FE8" },
  { name: "Noah P.",     state: "NSW", prize: "◇ Tech Bundle",     tier: "Bronze", avatar: "◆", color: "#2B9FE8" },
  { name: "Emma S.",     state: "VIC", prize: "◇ Tech Bundle",     tier: "Silver", avatar: "▲", color: "#2B9FE8" },
  { name: "Jack H.",     state: "QLD", prize: "◇ Tech Bundle",     tier: "Gold",   avatar: "◆", color: "#2B9FE8" },
  { name: "Mia C.",      state: "SA",  prize: "◇ Tech Bundle",     tier: "Bronze", avatar: "◇", color: "#2B9FE8" },
  { name: "Liam B.",     state: "WA",  prize: "◇ Tech Bundle",     tier: "Silver", avatar: "✦", color: "#2B9FE8" },
  { name: "Olivia F.",   state: "NSW", prize: "◇ Tech Bundle",     tier: "Gold",   avatar: "◆", color: "#2B9FE8" },
  { name: "Ethan G.",    state: "VIC", prize: "◇ Tech Bundle",     tier: "Bronze", avatar: "✦", color: "#2B9FE8" },
  { name: "Sophie N.",   state: "QLD", prize: "◇ Tech Bundle",     tier: "Silver", avatar: "◆", color: "#2B9FE8" },
  { name: "Lucas D.",    state: "SA",  prize: "◇ Tech Bundle",     tier: "Gold",   avatar: "✦", color: "#2B9FE8" },
];

// Millionaire draw: 1×$1M + 5×$100K + 20×$25K = 26 major prize winners
const MILLIONAIRE_RECENT = [
  { name: "Adrian P.",   state: "VIC", prize: "◆ $1,000,000",  tier: "Gold",   avatar: "◆", color: GOLD },
  { name: "Sharon W.",   state: "NSW", prize: "▰ Brand New Car",    tier: "Gold",   avatar: "★", color: "#2B9FE8" },
  { name: "Benny K.",    state: "QLD", prize: "▰ Brand New Car",    tier: "Silver", avatar: "✦", color: "#2B9FE8" },
  { name: "Tran L.",     state: "WA",  prize: "▰ Brand New Car",    tier: "Gold",   avatar: "✦", color: "#2B9FE8" },
  { name: "Kerrie M.",   state: "SA",  prize: "▰ Brand New Car",    tier: "Gold",   avatar: "◆", color: "#2B9FE8" },
  { name: "Raj P.",      state: "VIC", prize: "▰ Brand New Car",    tier: "Silver", avatar: "✦", color: "#2B9FE8" },
  { name: "Amy F.",      state: "NSW", prize: "✦ Holiday Package",     tier: "Gold",   avatar: "◆", color: "#00BFFF" },
  { name: "Tom R.",      state: "VIC", prize: "✦ Holiday Package",     tier: "Silver", avatar: "◆", color: "#00BFFF" },
  { name: "Jess O.",     state: "QLD", prize: "✦ Holiday Package",     tier: "Gold",   avatar: "▲", color: "#00BFFF" },
  { name: "Mike B.",     state: "WA",  prize: "✦ Holiday Package",     tier: "Bronze", avatar: "◆", color: "#00BFFF" },
  { name: "Sara N.",     state: "SA",  prize: "✦ Holiday Package",     tier: "Silver", avatar: "◇", color: "#00BFFF" },
  { name: "Dan C.",      state: "NSW", prize: "✦ Holiday Package",     tier: "Gold",   avatar: "✦", color: "#00BFFF" },
  { name: "Lisa H.",     state: "VIC", prize: "✦ Holiday Package",     tier: "Silver", avatar: "◆", color: "#00BFFF" },
  { name: "Ryan M.",     state: "QLD", prize: "✦ Holiday Package",     tier: "Bronze", avatar: "✦", color: "#00BFFF" },
  { name: "Chloe K.",    state: "WA",  prize: "✦ Holiday Package",     tier: "Gold",   avatar: "◆", color: "#00BFFF" },
  { name: "Noah T.",     state: "SA",  prize: "✦ Holiday Package",     tier: "Silver", avatar: "✦", color: "#00BFFF" },
  { name: "Emma P.",     state: "NSW", prize: "✦ Holiday Package",     tier: "Gold",   avatar: "★", color: "#00BFFF" },
  { name: "Jack S.",     state: "VIC", prize: "✦ Holiday Package",     tier: "Bronze", avatar: "◆", color: "#00BFFF" },
  { name: "Mia L.",      state: "QLD", prize: "✦ Holiday Package",     tier: "Silver", avatar: "◆", color: "#00BFFF" },
  { name: "Liam W.",     state: "WA",  prize: "✦ Holiday Package",     tier: "Gold",   avatar: "▲", color: "#00BFFF" },
  { name: "Olivia G.",   state: "SA",  prize: "✦ Holiday Package",     tier: "Bronze", avatar: "◆", color: "#00BFFF" },
  { name: "Ethan F.",    state: "NSW", prize: "✦ Holiday Package",     tier: "Silver", avatar: "◇", color: "#00BFFF" },
  { name: "Sophie B.",   state: "VIC", prize: "✦ Holiday Package",     tier: "Gold",   avatar: "✦", color: "#00BFFF" },
  { name: "Lucas R.",    state: "QLD", prize: "✦ Holiday Package",     tier: "Bronze", avatar: "◆", color: "#00BFFF" },
  { name: "Hannah C.",   state: "WA",  prize: "✦ Holiday Package",     tier: "Silver", avatar: "✦", color: "#00BFFF" },
  { name: "Oscar N.",    state: "SA",  prize: "✦ Holiday Package",     tier: "Gold",   avatar: "◆", color: "#00BFFF" },
];

const MILLIONAIRE_WINNERS = [
  { name: "Adrian P.",   state: "VIC", amount: "$1,000,000", draw: "Millionaire Draw #012", date: "April 2025",    tier: "Gold",   avatar: "◆", story: "Gold member for 8 months. 100 tiles on the board." },
  { name: "Sharon W.",   state: "NSW", amount: "$1,000,000", draw: "Millionaire Draw #011", date: "March 2025",   tier: "Gold",   avatar: "★", story: "Joined on a whim. Won on her first monthly draw." },
  { name: "Benny K.",    state: "QLD", amount: "$1,000,000", draw: "Millionaire Draw #010", date: "February 2025",tier: "Silver", avatar: "✦", story: "Silver member. Tile #1,847,203 hit the jackpot." },
  { name: "Tran L.",     state: "WA",  amount: "$1,000,000", draw: "Millionaire Draw #009", date: "January 2025", tier: "Gold",   avatar: "✦", story: "Watched it live on his phone. Couldn't believe it." },
  { name: "Kerrie M.",   state: "SA",  amount: "$1,000,000", draw: "Millionaire Draw #008", date: "December 2024",tier: "Gold",   avatar: "◆", story: "Loyal Gold member since launch. Long time coming." },
  { name: "Raj P.",      state: "VIC", amount: "$1,000,000", draw: "Millionaire Draw #007", date: "November 2024",tier: "Silver", avatar: "✦", story: "Never missed a monthly draw. Number finally came up." },
];

const TIER_COLORS = { Gold: GOLD, Silver: SILVER, Bronze: BRONZE };

function WinnersPage({ onNav }) {
  const [drawTab, setDrawTab] = useState("monthly");
  const winners = MILLIONAIRE_RECENT;
  const drawLabel = "Millionaire Draw #012";
  const drawDate  = "Saturday 17 May 2025";

  return (
    <div style={{ background:`radial-gradient(ellipse at 50% 0%, #0D2040 0%, ${NAVY} 70%)`, minHeight:"100vh", padding:"56px 28px" }}>
      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:40 }}>
          <SectionHead>Winners</SectionHead>
          <p style={{ color:TEXT2, fontSize:16, marginLeft:14, marginTop:8 }}>
            Real prizes. Real members. Every Friday and every month on a Saturday. Top prize $1,000,000 cash.
          </p>
        </div>

        {/* Draw tab selector */}
        <div style={{ display:"flex", gap:10, marginBottom:28 }}>
          <div style={{ flex:1, background:"rgba(255,215,0,0.08)", border:`2px solid ${GOLD}66`, borderRadius:12, padding:"14px 20px" }}>
            <div style={{ fontSize:10, color:GOLD, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:4 }}>Every Month — Saturday Night</div>
            <div style={{ fontSize:16, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Monthly Millionaire Draw</div>
            <div style={{ fontSize:12, color:TEXT3, marginTop:2 }}>50 cars · 100 holidays · $1,000,000 cash · 10,000+ winners</div>
          </div>
        </div>

        {/* Winners list — scrollable, all 26 major prizes, no petrol */}
        <div style={{ marginBottom:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ width:3, height:20, background: drawTab==="millionaire"?`linear-gradient(${GOLD},#A9893F)`:`linear-gradient(${BLUE_BRIGHT},${BLUE})`, borderRadius:2 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:900, color: drawTab==="millionaire"?GOLD:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase" }}>{drawLabel}</div>
              <div style={{ fontSize:12, color:TEXT3, marginTop:2 }}>{drawDate} — Major prize winners only</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:520, overflowY:"auto", paddingRight:4 }}>
            {winners.map((w, i) => (
              <div key={i} style={{ background:NAVY3, border:`1px solid ${i===0&&drawTab==="millionaire"?GOLD+"44":BORDER}`, borderRadius:12, padding:"13px 20px", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background: i===0&&drawTab==="millionaire"?"rgba(255,215,0,0.15)":BLUE_DIM, border:`1.5px solid ${i===0&&drawTab==="millionaire"?GOLD+"66":BLUE_BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{w.avatar}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:TEXT }}>{w.name} <span style={{ fontSize:11, color:TEXT3, fontWeight:400 }}>· {w.state}</span></div>
                  <div style={{ fontSize:11, color:TEXT3, marginTop:1 }}><span style={{ color:TIER_COLORS[w.tier]||TEXT2, fontWeight:700 }}>{w.tier}</span> Member</div>
                </div>
                <div style={{ fontSize:15, fontWeight:900, color:w.color||BLUE_BRIGHT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{w.prize}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:12, fontSize:12, color:TEXT3 }}>
            + Thousands of $100 instant cash card winners not shown
          </div>
        </div>

        {/* Millionaire Hall of Fame */}
        <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:48 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
            <div style={{ width:3, height:20, background:`linear-gradient(${GOLD}, #A9893F)`, borderRadius:2 }} />
            <div>
              <div style={{ fontSize:18, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase" }}>◆ Millionaire Hall of Fame</div>
              <div style={{ fontSize:12, color:TEXT3, marginTop:2 }}>One $1,000,000 cash winner every month — from a $5,000,000 prize event</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:16 }}>
            {MILLIONAIRE_WINNERS.map((w, i) => (
              <div key={i} style={{ background: i===0 ? "rgba(255,215,0,0.07)" : NAVY3, border:`${i===0?"2px":"1px"} solid ${i===0?GOLD+"55":BORDER}`, borderRadius:18, padding:"24px 22px", position:"relative", overflow:"hidden" }}>
                {i === 0 && (
                  <div style={{ position:"absolute", top:0, right:0, background:GOLD, color:"#000", fontSize:9, fontWeight:900, padding:"5px 14px 5px 20px", clipPath:"polygon(12px 0,100% 0,100% 100%,0 100%)", letterSpacing:1 }}>MOST RECENT</div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ width:52, height:52, borderRadius:"50%", background: i===0?"rgba(255,215,0,0.15)":BLUE_DIM, border:`2px solid ${i===0?GOLD+"66":BLUE_BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{w.avatar}</div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{w.name}</div>
                    <div style={{ fontSize:12, color:TEXT3 }}>{w.state} · <span style={{ color:TIER_COLORS[w.tier]||TEXT2, fontWeight:700 }}>{w.tier}</span></div>
                  </div>
                </div>
                <div style={{ fontSize:32, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", lineHeight:1, marginBottom:6 }}>{w.amount}</div>
                <div style={{ fontSize:11, color:TEXT3, marginBottom:10 }}>{w.draw} · {w.date}</div>
                <div style={{ fontSize:13, color:TEXT2, lineHeight:1.55, fontStyle:"italic" }}>"{w.story}"</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop:40, background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:16, padding:"28px 32px", display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase", marginBottom:6 }}>Your name could be next.</div>
              <div style={{ fontSize:14, color:TEXT2 }}>Every active LMCT+ member gets tiles on the board. Every month on a Saturday we give away $5,000,000 in prizes — 50 cars, 100 holidays, tech bundles, partner vouchers and $1,000,000 cash.</div>
            </div>
            <BlueBtn onClick={() => onNav("tiers")}>VIEW MEMBERSHIP TIERS →</BlueBtn>
          </div>
        </div>

      </div>
    </div>
  );
}


// ─── PRIZE CATALOGUE (RRP vs wholesale cost) ──────────────────────────────────
const PRIZE_CATALOGUE = [
  { id:"car",      emoji:"▰", name:"Brand New Car",          rrp:50000, cost:40000, minTier:100000 },
  { id:"holiday",  emoji:"✦", name:"Holiday Package",         rrp:5000,  cost:4000,  minTier:10000  },
  { id:"tech",     emoji:"◇", name:"Tech Bundle",             rrp:1000,  cost:800,   minTier:10000  },
  { id:"voucher",  emoji:"•", name:"LMCT+ Partner Voucher",   rrp:100,   cost:80,    minTier:10000  },
];

// Tiered prize templates — 80% announced, 50% actual cost
const PRIZE_TEMPLATES = {
  spark:  { label:"✦ Spark",  min:10000,   prizes:[{id:"holiday",qty:2},{id:"tech",qty:10},{id:"voucher",qty:100}] },
  bronze: { label:"🥉 Bronze", min:100000,  prizes:[{id:"car",qty:1},{id:"holiday",qty:5},{id:"tech",qty:20},{id:"voucher",qty:500}] },
  silver: { label:"🥈 Silver", min:300000,  prizes:[{id:"car",qty:2},{id:"holiday",qty:10},{id:"tech",qty:50},{id:"voucher",qty:2000}] },
  gold:   { label:"🥇 Gold",   min:600000,  prizes:[{id:"car",qty:5},{id:"holiday",qty:20},{id:"tech",qty:100},{id:"voucher",qty:5000}] },
  elite:  { label:"◆ Elite",  min:900000,  prizes:[{id:"car",qty:10},{id:"holiday",qty:50},{id:"tech",qty:200},{id:"voucher",qty:10000}] },
};

function calcPrizes(template) {
  return template.prizes.map(p => {
    const cat = PRIZE_CATALOGUE.find(c=>c.id===p.id);
    return { ...cat, qty:p.qty, totalRrp:cat.rrp*p.qty, totalCost:cat.cost*p.qty };
  });
}

function getActiveTier(tilesSold) {
  const revenue = tilesSold * 0.75; // blended avg price per tile
  if (revenue >= 900000) return "elite";
  if (revenue >= 600000) return "gold";
  if (revenue >= 300000) return "silver";
  if (revenue >= 100000) return "bronze";
  if (revenue >= 10000)  return "spark";
  return null;
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
const MEMBER_SCENARIOS = [
  { label:"✅ Base Case (200K)",  bronze:90000,  silver:50000,  gold:60000  },
  { label:"Growth (250K)",        bronze:120000, silver:60000,  gold:70000  },
  { label:"500K Conservative",    bronze:250000, silver:150000, gold:100000 },
  { label:"500K Gold-Heavy",      bronze:150000, silver:175000, gold:175000 },
];

// New pricing with $10 uplift
const PRICES = { bronze: 29.99, silver: 59.99, gold: 109.99 };
// Main pool contributions (% of price)
// Bronze: 20% of $29.99 = $6.00
// Silver: 25% of $59.99 = $15.00
// Gold:   25% of $109.99 = $27.50  ← main pool
//         25% of $109.99 = $27.50  ← bonus pool (Gold exclusive)
//         TOTAL Gold to pools: 50% = $55.00
// Bronze 30% · Silver 40% · Gold 38.6% main + 11.4% bonus = 50% total
const POOL_CONTRIB      = { bronze: 9.00,  silver: 24.00, gold: 42.50 };
const MAIN_CONTRIB      = POOL_CONTRIB; // alias — same values
const BONUS_CONTRIB_GOLD = 12.50; // Gold → $750K pool → $1M RRP prizes
const POOL_CONTRIB_PCT  = { bronze: 30, silver: 40, gold: 39 }; // % to MAIN pool
const BONUS_CONTRIB_PCT = { gold: 11 }; // Gold bonus %

function AdminPanel({ onNav }) {
  const [tileSales, setTileSales]       = useState(1000000);
  const [prizeTab, setPrizeTab]         = useState("auto");
  const [customPrizes, setCustomPrizes] = useState([]);
  const [addItem, setAddItem]           = useState(PRIZE_CATALOGUE[0].id);
  const [addQty, setAddQty]             = useState(1);
  const [boardNum, setBoardNum]         = useState(48);
  const [locked, setLocked]             = useState(false);
  const [adminTab, setAdminTab]         = useState("membership");

  // Membership model inputs
  const [bronze, setBronze]  = useState(90000); // locked
  const [silver, setSilver]  = useState(50000);
  const [gold,   setGold]    = useState(60000);

  // Calculated board stats
  const bronzeTiles     = bronze * 10;
  const silverTiles     = silver * 40;
  const goldTiles       = gold * 100;
  const totalMembers    = bronze + silver + gold;
  const totalBoardTiles = bronzeTiles + silverTiles + goldTiles;
  // Admin shows REAL tile counts — draw board uses demo cap separately
  const realDrawSpeed   = Math.round(totalBoardTiles / 3600); // ~1hr real draw
  const drawSpeed       = realDrawSpeed;
  const drawDuration    = Math.round(totalBoardTiles / Math.max(realDrawSpeed,1) / 60);

  // New pricing with $10 uplift
  const bronzeRev       = bronze * PRICES.bronze;
  const silverRev       = silver * PRICES.silver;
  const goldRev         = gold   * PRICES.gold;
  const totalMemberRev  = bronzeRev + silverRev + goldRev;

  // Tiered prize pool contributions
  const bronzePool      = bronze * POOL_CONTRIB.bronze;  // $9/member
  const silverPool      = silver * POOL_CONTRIB.silver;  // $24/member
  const goldPool        = gold   * POOL_CONTRIB.gold;    // $42.50/member
  // NOTE: $10 uplift is already baked into the new prices ($29.99/$59.99/$109.99)
  // The % contributions already capture it — DO NOT add uplift separately
  const tieredPoolTotal = bronzePool + silverPool + goldPool;
  const uplift          = 0; // $10 uplift already baked into prices — no separate addition
  const totalPrizePool  = tieredPoolTotal;
  const basePool20pct   = tieredPoolTotal;
  // MAIN_CONTRIB alias for display in tables
  const MAIN_CONTRIB    = POOL_CONTRIB;

  // Pool split across the month
  const monthlyDrawPool  = totalPrizePool;                    // 100% → one monthly draw
  const weeklyDrawPool   = 0;                                  // no weekly draw
  const perWeekPool      = 0;
  const monthlyRRP       = 5000000;                            // locked: $5M monthly RRP
  const weeklyRRPperDraw = 0;

  // Bonus pool — Gold ONLY. Silver gets access but does NOT contribute.
  const bonusBoardPool  = gold * BONUS_CONTRIB_GOLD;        // $27.50 × Gold members only
  const bonusRRP        = Math.round(bonusBoardPool / 0.80);// at 80% cost = announced RRP ($1M)

  // LMCT retention per tier (after pool deductions)
  const lmctPerBronze   = PRICES.bronze - POOL_CONTRIB.bronze;                          // $20.99
  const lmctPerSilver   = PRICES.silver - POOL_CONTRIB.silver;                          // $35.99
  const lmctPerGold     = PRICES.gold   - POOL_CONTRIB.gold - BONUS_CONTRIB_GOLD;       // $54.99 (109.99 - 42.50 - 12.50)
  const lmctBaseRetained = (bronze * lmctPerBronze) + (silver * lmctPerSilver) + (gold * lmctPerGold);

  // Prize procurement margin (75% cost — LMCT buys prizes at 75% of RRP)
  // LMCT has TWO income streams:
  // 1. Membership retention = gross - prize pools
  // 2. Prize procurement margin = RRP announced - actual cost (75% avg, except $1M cash)

  // Stream 1 — already in lmctBaseRetained (gross minus pool contributions)

  // Stream 2 — procurement margin
  // $1M cash: paid in full — $0 margin
  // Monthly physical ($3.5M RRP): cost $2,625,000 → margin $875,000
  // Weekly × 3 ($500K RRP each = $1.5M): cost $1,125,000 → margin $375,000
  // Gold bonus ($1M RRP): cost $750,000 → margin $250,000
  const cashMargin          = 0;        // $1M cash — no margin
  const monthlyPhysMargin   = 800000;   // Monthly physical at 80% cost: $4M cost → $5M RRP → $1M margin
  const weeklyMarginTotal   = 0;        // no weekly draw
  const bonusMarginAmt      = 200000;   // Gold bonus at 80% cost: $800K cost → $1M RRP → $200K margin
  const totalProcMargin     = cashMargin + monthlyPhysMargin + weeklyMarginTotal + bonusMarginAmt; // $1,000,000
  const lmctActualTotal     = lmctBaseRetained + totalProcMargin;
  const lmctAnnual          = lmctActualTotal * 12;

  // Conversion value per upgrade
  const bronzeToGoldPoolGain   = POOL_CONTRIB.gold + BONUS_CONTRIB_GOLD - POOL_CONTRIB.bronze; // +$49
  const silverToGoldPoolGain   = POOL_CONTRIB.gold + BONUS_CONTRIB_GOLD - POOL_CONTRIB.silver; // +$40

  // Your upgrade revenue (50% of incremental)
  const bronzeToSilverUpgrades = Math.round(bronze * 0.10); // assume 10% upgrade
  const silverToGoldUpgrades   = Math.round(silver * 0.05); // assume 5% upgrade
  const upgradeRevBtoS  = bronzeToSilverUpgrades * (PRICES.silver - PRICES.bronze);
  const upgradeRevStoG  = silverToGoldUpgrades   * (PRICES.gold   - PRICES.silver);
  const yourUpgradeRev  = (upgradeRevBtoS + upgradeRevStoG) * 0.50;

  // LMCT net after prize pool (retains rest)
  const lmctRetained    = totalMemberRev - totalPrizePool - bonusBoardPool;

  const bonusMargin     = bonusBoardPool; // all goes to prizes — your rev is from upgrades

  const revenue        = tileSales * 0.75;
  const announcedPool  = revenue * 0.80;
  const actualCost     = revenue * 0.50;
  const margin         = revenue - actualCost;
  const activeTierKey  = getActiveTier(tileSales);
  const activeTier     = activeTierKey ? PRIZE_TEMPLATES[activeTierKey] : null;
  const autoPrizes     = activeTier ? calcPrizes(activeTier) : [];
  const prizes         = prizeTab === "auto" ? autoPrizes : customPrizes;

  const totalRrp       = prizes.reduce((s,p)=>s+(p.totalRrp||0),0);
  const totalCost      = prizes.reduce((s,p)=>s+(p.totalCost||0),0);
  const totalWinners   = prizes.reduce((s,p)=>s+(p.qty||0),0);
  const remainingBudget = actualCost - totalCost;

  const addCustomPrize = () => {
    const cat = PRIZE_CATALOGUE.find(c=>c.id===addItem);
    if (!cat) return;
    setCustomPrizes(prev => {
      const existing = prev.findIndex(p=>p.id===addItem);
      if (existing>=0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty:updated[existing].qty+Number(addQty), totalRrp:updated[existing].rrp*(updated[existing].qty+Number(addQty)), totalCost:updated[existing].cost*(updated[existing].qty+Number(addQty)) };
        return updated;
      }
      return [...prev, { ...cat, qty:Number(addQty), totalRrp:cat.rrp*Number(addQty), totalCost:cat.cost*Number(addQty) }];
    });
  };

  const tiers = Object.entries(PRIZE_TEMPLATES);
  const revenueThresholds = [10000, 100000, 300000, 600000, 900000];

  return (
    <div style={{ background:`radial-gradient(ellipse at 50% 0%, #0D2040 0%, ${NAVY} 70%)`, minHeight:"100vh", padding:"40px 28px" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
          <button onClick={()=>onNav("home")} style={{ background:"transparent", border:`1px solid ${BORDER2}`, borderRadius:8, padding:"8px 16px", color:TEXT2, cursor:"pointer", fontSize:13 }}>← Back</button>
          <div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <div style={{ width:4, height:24, background:`linear-gradient(${BLUE_BRIGHT},${BLUE})`, borderRadius:2 }} />
              <h1 style={{ fontSize:28, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase", margin:0 }}>PrizeTile Admin</h1>
            </div>
            <div style={{ fontSize:13, color:TEXT3, marginLeft:10, marginTop:4 }}>Pitch model · 200,000 members · Board #{String(boardNum).padStart(3,"0")}</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
            {locked && (
              <button onClick={()=>onNav("bonus")} style={{ background:`linear-gradient(135deg,${GOLD},#A9893F)`, border:"none", borderRadius:10, padding:"12px 24px", color:"#000", fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:14, cursor:"pointer" }}>
                ◇ RUN BONUS DRAW →
              </button>
            )}
            {locked
              ? <div style={{ background:"rgba(0,230,118,0.1)", border:"1px solid rgba(0,230,118,0.3)", borderRadius:10, padding:"10px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:12, color:BLUE_BRIGHT, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>✓ Board Locked</div>
                  <div style={{ fontSize:11, color:TEXT3 }}>Prize structure confirmed</div>
                </div>
              : <button onClick={()=>setLocked(true)} style={{ background:BLUE, border:"none", borderRadius:10, padding:"12px 28px", color:TEXT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:14, cursor:"pointer" }}>
                  LOCK PRIZE STRUCTURE →
                </button>
            }
          </div>
        </div>

        {/* Model summary — locked numbers for pitch */}
        <div style={{ background:"rgba(0,230,118,0.04)", border:"1px solid rgba(73,217,255,0.18)", borderRadius:14, padding:"16px 24px", marginBottom:24, display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:12 }}>
          {[
            { label:"Bronze",        val:"90,000",      sub:"× $29.99 · 30% pool",           color:BRONZE },
            { label:"Silver",        val:"50,000",      sub:"× $59.99 · 40% pool",           color:SILVER },
            { label:"Gold",          val:"60,000",      sub:"× $109.99 · 50% pool",          color:GOLD },
            { label:"Monthly Draw",  val:"$5,000,000",  sub:"$1M cash · 50 cars · RRP",      color:BLUE_BRIGHT },
            { label:"Gold Bonus",    val:"$1,000,000",  sub:"Gold only · 10,000 vouchers",   color:CHAMPAGNE },
            { label:"Total Prizes",  val:"$6,000,000",  sub:"Per month RRP · all draws",     color:BLUE_BRIGHT },
            { label:"LMCT Total",    val:"$8,338,000",  sub:"$100M/yr · membership + margin",color:BLUE_BRIGHT },
          ].map(s=>(
            <div key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4, fontWeight:700 }}>{s.label}</div>
              <div style={{ fontSize:14, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
              <div style={{ fontSize:9, color:TEXT3, marginTop:3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Draw selector — big toggle like a pitch slide */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:28 }}>
          {[
            { id:"membership", emoji:"◆", label:"Main Draw",    sub:"Weekly & Monthly member board", color:BLUE_BRIGHT, active:BLUE_DIM, border:BLUE_BORDER },
            { id:"bonus",      emoji:"◇", label:"Bonus Board",  sub:"Tile pack draw — separate pool", color:GOLD,        active:"rgba(255,215,0,0.1)", border:`${GOLD}66` },
            { id:"combined",   emoji:"▦", label:"Full Picture", sub:"Both draws — total impact",      color:BLUE_BRIGHT,   active:"rgba(0,230,118,0.1)", border:"rgba(0,230,118,0.4)" },
            { id:"growth",     emoji:"↗", label:"Growth Table", sub:"200K → 500K membership",         color:CHAMPAGNE,   active:"rgba(216,180,90,0.10)", border:"rgba(255,140,0,0.4)" },
            { id:"operations", emoji:"⚙", label:"Operations",   sub:"Draw cycle, board reset & rules", color:SILVER,  active:"rgba(200,216,232,0.08)", border:"rgba(200,216,232,0.25)" },
          ].map(t => (
            <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{
              background: adminTab===t.id ? t.active : NAVY3,
              border: `2px solid ${adminTab===t.id ? t.border : BORDER}`,
              borderRadius:14, padding:"18px 20px", cursor:"pointer", textAlign:"left",
              transition:"all 0.15s",
            }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{t.emoji}</div>
              <div style={{ fontSize:16, fontWeight:900, color:adminTab===t.id?t.color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase", marginBottom:4 }}>{t.label}</div>
              <div style={{ fontSize:11, color:TEXT3 }}>{t.sub}</div>
            </button>
          ))}
        </div>

        {/* ── MEMBERSHIP MODEL TAB ── */}
        {adminTab === "membership" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* ── Stat cards — LMCT view ── */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
              {[
                { label:"Total Members",    val:fmtNum(totalMembers),                            sub:`$${fmtNum(Math.round(totalMemberRev))}/month gross revenue`,  color:TEXT },
                { label:"Main Prize Pool",  val:`$${fmtNum(tieredPoolTotal)}`,                   sub:"Funded by all member subscriptions",                         color:BLUE_BRIGHT },
                { label:"Gold Bonus Pool",  val:`$${fmtNum(Math.round(bonusBoardPool+50000))}`,  sub:"60K Gold × $12.50 + $50K LMCT top-up",                      color:CHAMPAGNE },
                { label:"Total Prizes RRP", val:"$6,000,000",                                    sub:"$5M monthly draw + $1M Gold bonus — one Saturday night",     color:GOLD },
              ].map(s=>(
                <div key={s.label} style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:700 }}>{s.label}</div>
                  <div style={{ fontSize:20, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
                  <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* ── WHERE THE PRIZE MONEY COMES FROM ── */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ background:NAVY4, padding:"14px 20px", borderBottom:`1px solid ${BORDER}` }}>
                <div style={{ fontSize:13, fontWeight:700, color:TEXT, textTransform:"uppercase", letterSpacing:2 }}>Where The Prize Money Comes From</div>
                <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>Every dollar is funded by member subscriptions — no tickets, no lottery</div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:NAVY4 }}>
                      {["Tier","Members","Price/mo","Prize Pool %","$/member/mo","→ Prize Pool","Draw Access"].map(h=>(
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, color:TEXT3, fontWeight:700, textTransform:"uppercase", letterSpacing:1, borderBottom:`2px solid ${BORDER}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:"13px 16px", color:BRONZE, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:15 }}>Bronze</td>
                      <td style={{ padding:"13px 16px", color:TEXT, fontWeight:700 }}>90,000</td>
                      <td style={{ padding:"13px 16px", color:TEXT2 }}>$29.99</td>
                      <td style={{ padding:"13px 16px", color:BRONZE, fontWeight:700 }}>30%</td>
                      <td style={{ padding:"13px 16px", color:BLUE_BRIGHT, fontWeight:700 }}>$9.00</td>
                      <td style={{ padding:"13px 16px", color:BRONZE, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$810,000</td>
                      <td style={{ padding:"13px 16px", color:TEXT3, fontSize:12 }}>Monthly Millionaire Draw</td>
                    </tr>
                    <tr style={{ borderBottom:`1px solid ${BORDER}`, background:"rgba(255,255,255,0.02)" }}>
                      <td style={{ padding:"13px 16px", color:SILVER, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:15 }}>Silver</td>
                      <td style={{ padding:"13px 16px", color:TEXT, fontWeight:700 }}>50,000</td>
                      <td style={{ padding:"13px 16px", color:TEXT2 }}>$59.99</td>
                      <td style={{ padding:"13px 16px", color:SILVER, fontWeight:700 }}>40%</td>
                      <td style={{ padding:"13px 16px", color:BLUE_BRIGHT, fontWeight:700 }}>$24.00</td>
                      <td style={{ padding:"13px 16px", color:SILVER, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,200,000</td>
                      <td style={{ padding:"13px 16px", color:TEXT3, fontSize:12 }}>Monthly Millionaire Draw</td>
                    </tr>
                    <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:"10px 16px 4px 16px", color:GOLD, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:15 }}>Gold</td>
                      <td style={{ padding:"10px 16px 4px 16px", color:TEXT, fontWeight:700 }}>60,000</td>
                      <td style={{ padding:"10px 16px 4px 16px", color:TEXT2 }}>$109.99</td>
                      <td style={{ padding:"10px 16px 4px 16px", color:GOLD, fontWeight:700 }}>39% → main pool</td>
                      <td style={{ padding:"10px 16px 4px 16px", color:BLUE_BRIGHT, fontWeight:700 }}>$42.50</td>
                      <td style={{ padding:"10px 16px 4px 16px", color:GOLD, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$2,550,000</td>
                      <td style={{ padding:"10px 16px 4px 16px", color:BLUE_BRIGHT, fontSize:12 }}>✅ Monthly Millionaire Draw</td>
                    </tr>
                    <tr style={{ borderBottom:`1px solid ${BORDER}`, background:"rgba(255,215,0,0.03)" }}>
                      <td style={{ padding:"4px 16px 10px 32px", color:GOLD, fontWeight:700, fontSize:12, fontStyle:"italic" }}>↳ bonus contribution</td>
                      <td style={{ padding:"4px 16px 10px 16px", color:TEXT3, fontSize:12 }}>60,000</td>
                      <td style={{ padding:"4px 16px 10px 16px", color:TEXT3, fontSize:12 }}>included</td>
                      <td style={{ padding:"4px 16px 10px 16px", color:CHAMPAGNE, fontWeight:700, fontSize:12 }}>11% → bonus pool</td>
                      <td style={{ padding:"4px 16px 10px 16px", color:CHAMPAGNE, fontWeight:700, fontSize:12 }}>$12.50</td>
                      <td style={{ padding:"4px 16px 10px 16px", color:CHAMPAGNE, fontWeight:700, fontSize:13, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$750,000</td>
                      <td style={{ padding:"4px 16px 10px 16px", color:CHAMPAGNE, fontSize:12 }}>★ Gold Bonus Draw (exclusive)</td>
                    </tr>
                    <tr style={{ borderBottom:`2px solid ${BORDER}`, background:"rgba(255,140,0,0.02)" }}>
                      <td style={{ padding:"6px 16px 8px 32px", color:CHAMPAGNE, fontWeight:700, fontSize:12, fontStyle:"italic" }}>↳ LMCT top-up</td>
                      <td colSpan={4} style={{ padding:"6px 16px", color:TEXT3, fontSize:12 }}>$50,000 from LMCT operational revenue — rounds bonus pool to $1M RRP</td>
                      <td style={{ padding:"6px 16px", color:CHAMPAGNE, fontWeight:700, fontSize:12 }}>$50,000</td>
                      <td style={{ padding:"6px 16px", color:TEXT3, fontSize:12 }}>Funded by LMCT</td>
                    </tr>
                    <tr style={{ background:"rgba(255,255,255,0.04)" }}>
                      <td style={{ padding:"14px 16px", color:TEXT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontSize:14 }}>TOTAL</td>
                      <td style={{ padding:"14px 16px", color:TEXT, fontWeight:900 }}>200,000</td>
                      <td colSpan={3} style={{ padding:"14px 16px", color:TEXT3 }}>—</td>
                      <td style={{ padding:"14px 16px" }}>
                        <div style={{ color:GOLD, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:16 }}>$4,560,000 <span style={{fontSize:11,color:TEXT3}}>main</span></div>
                        <div style={{ color:CHAMPAGNE, fontWeight:700, fontSize:13, marginTop:3 }}>+ $800,000 bonus</div>
                      </td>
                      <td style={{ padding:"14px 16px" }}>
                        <div style={{ color:GOLD, fontWeight:700, fontSize:13 }}>$5,000,000 RRP monthly</div>
                        <div style={{ color:CHAMPAGNE, fontWeight:700, fontSize:13, marginTop:2 }}>$1,000,000 RRP Gold bonus</div>
                        <div style={{ color:BLUE_BRIGHT, fontWeight:900, fontSize:15, marginTop:4 }}>= $6,000,000 total</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Prize breakdown table ── */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ background:NAVY4, padding:"14px 20px", borderBottom:`1px solid ${BORDER}` }}>
                <div style={{ fontSize:13, fontWeight:700, color:TEXT, textTransform:"uppercase", letterSpacing:2 }}>Monthly Saturday Draw — Prize Breakdown</div>
                <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>Prizes procured at 80% of RRP — members are announced the RRP value</div>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:NAVY4 }}>
                    {["Prize","Qty","RRP Each","Total RRP","Our Cost"].map(h=>(
                      <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, color:TEXT3, fontWeight:700, textTransform:"uppercase", letterSpacing:1, borderBottom:`2px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { prize:"◆ $1,000,000 Cash", qty:"× 1",      rrp:"$1,000,000", trrp:"$1,000,000", cost:"$1,000,000" },
                    { prize:"▰ Brand New Car",    qty:"× 50",     rrp:"$50,000",    trrp:"$2,500,000", cost:"$2,000,000" },
                    { prize:"✦ Holiday Package",   qty:"× 100",    rrp:"$5,000",     trrp:"$500,000",   cost:"$400,000"   },
                    { prize:"◇ Tech Bundle",       qty:"× 500",    rrp:"$1,000",     trrp:"$500,000",   cost:"$400,000"   },
                    { prize:"• Partner Voucher",   qty:"× 10,000", rrp:"$100",       trrp:"$1,000,000", cost:"$800,000"   },
                  ].map((r,i)=>(
                    <tr key={r.prize} style={{ borderBottom:`1px solid ${BORDER}`, background:i%2===0?"transparent":"rgba(255,255,255,0.02)" }}>
                      <td style={{ padding:"11px 16px", color:TEXT }}>{r.prize}</td>
                      <td style={{ padding:"11px 16px", color:TEXT2 }}>{r.qty}</td>
                      <td style={{ padding:"11px 16px", color:TEXT2 }}>{r.rrp}</td>
                      <td style={{ padding:"11px 16px", color:BLUE_BRIGHT, fontWeight:700 }}>{r.trrp}</td>
                      <td style={{ padding:"11px 16px", color:TEXT2 }}>{r.cost}</td>
                    </tr>
                  ))}
                  <tr style={{ background:"rgba(255,255,255,0.04)", borderTop:`2px solid ${BORDER}` }}>
                    <td colSpan={3} style={{ padding:"12px 16px", color:TEXT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontSize:14 }}>MONTHLY DRAW TOTAL</td>
                    <td style={{ padding:"12px 16px", color:GOLD, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontSize:16 }}>$5,500,000</td>
                    <td style={{ padding:"12px 16px", color:TEXT2, fontWeight:700 }}>$4,600,000</td>
                  </tr>
                  <tr style={{ background:"rgba(216,180,90,0.05)", borderTop:`1px solid ${BORDER}` }}>
                    <td style={{ padding:"10px 16px", color:CHAMPAGNE, fontWeight:700 }}>★ Gold Bonus Draw — Partner Voucher</td>
                    <td style={{ padding:"10px 16px", color:TEXT2, fontSize:12 }}>× 10,000</td>
                    <td style={{ padding:"10px 16px", color:TEXT2, fontSize:12 }}>$100</td>
                    <td style={{ padding:"10px 16px", color:CHAMPAGNE, fontWeight:700 }}>$1,000,000</td>
                    <td style={{ padding:"10px 16px", color:TEXT2 }}>$800,000</td>
                  </tr>
                  <tr style={{ background:"rgba(0,230,118,0.04)", borderTop:`2px solid ${BORDER}` }}>
                    <td colSpan={3} style={{ padding:"13px 16px", color:BLUE_BRIGHT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontSize:15 }}>TOTAL — ONE SATURDAY NIGHT</td>
                    <td style={{ padding:"13px 16px", color:BLUE_BRIGHT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontSize:18 }}>$6,500,000 RRP</td>
                    <td style={{ padding:"13px 16px", color:TEXT2, fontWeight:700 }}>$5,400,000</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Gold breakdown ── */}
            <div style={{ background:NAVY3, border:`1px solid ${GOLD}22`, borderRadius:16, padding:"20px 24px" }}>
              <div style={{ fontSize:11, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:16, fontWeight:700 }}>Where Gold's $109.99 Goes Every Month</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { label:"39% → Main Prize Pool",  val:"$42.50/mo", sub:"All 200K members compete · monthly draw",  color:BLUE_BRIGHT, pct:39 },
                  { label:"11% → Gold Bonus Pool",  val:"$12.50/mo", sub:"Gold-only draw · 10,000 × $100 vouchers",  color:CHAMPAGNE,   pct:11 },
                  { label:"50% → LMCT Retained",    val:"$54.99/mo", sub:"Operational revenue — membership value",    color:GOLD,        pct:50 },
                ].map(s=>(
                  <div key={s.label} style={{ background:NAVY4, borderRadius:12, padding:"18px 18px" }}>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:700 }}>{s.label}</div>
                    <div style={{ fontSize:24, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
                    <div style={{ fontSize:11, color:TEXT3, marginTop:6 }}>{s.sub}</div>
                    <div style={{ marginTop:10, height:4, background:NAVY3, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${s.pct}%`, background:s.color, borderRadius:2 }} />
                    </div>
                    <div style={{ fontSize:11, color:s.color, marginTop:4, fontWeight:700 }}>{s.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Board tile calculation ── */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ background:NAVY4, padding:"14px 20px", borderBottom:`1px solid ${BORDER}` }}>
                <div style={{ fontSize:13, fontWeight:700, color:TEXT, textTransform:"uppercase", letterSpacing:2 }}>Board Tile Calculation</div>
                <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>More tiles = more chances — drives upgrade behaviour</div>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:NAVY4 }}>
                    {["Tier","Members","Tiles Each","Total Tiles","% of Board"].map(h=>(
                      <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, color:TEXT3, fontWeight:700, textTransform:"uppercase", letterSpacing:1, borderBottom:`2px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tier:"Bronze", color:BRONZE, members:bronze, tiles:10,  total:bronzeTiles },
                    { tier:"Silver", color:SILVER, members:silver, tiles:40,  total:silverTiles },
                    { tier:"Gold",   color:GOLD,      members:gold,   tiles:100, total:goldTiles   },
                  ].map(r=>(
                    <tr key={r.tier} style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:"11px 16px", color:r.color, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{r.tier}</td>
                      <td style={{ padding:"11px 16px", color:TEXT }}>{fmtNum(r.members)}</td>
                      <td style={{ padding:"11px 16px", color:TEXT2 }}>{r.tiles}</td>
                      <td style={{ padding:"11px 16px", color:r.color, fontWeight:700 }}>{fmtNum(r.total)}</td>
                      <td style={{ padding:"11px 16px", color:TEXT3 }}>{((r.total/totalBoardTiles)*100).toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr style={{ background:"rgba(255,255,255,0.04)", borderTop:`2px solid ${BORDER}` }}>
                    <td style={{ padding:"12px 16px", color:TEXT, fontWeight:900 }}>TOTAL</td>
                    <td style={{ padding:"12px 16px", color:TEXT, fontWeight:900 }}>{fmtNum(totalMembers)}</td>
                    <td style={{ padding:"12px 16px", color:TEXT3 }}>—</td>
                    <td style={{ padding:"12px 16px", color:BLUE_BRIGHT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:16 }}>{fmtNum(totalBoardTiles)}</td>
                    <td style={{ padding:"12px 16px", color:BLUE_BRIGHT, fontWeight:700 }}>100%</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ padding:"16px 20px", borderTop:`1px solid ${BORDER}`, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { label:"Total Board Tiles",  val:fmtNum(totalBoardTiles),            color:BLUE_BRIGHT },
                  { label:"Server Draw Speed",  val:`${fmtNum(drawSpeed)} tiles/sec`,   color:TEXT },
                  { label:"Full Draw Duration", val:`~${drawDuration} min`,             color:TEXT },
                ].map(s=>(
                  <div key={s.label} style={{ background:NAVY4, borderRadius:8, padding:"12px 14px" }}>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:s.color, fontFamily:"monospace" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {adminTab === "bonus" && (
          <div>
            {/* Header stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
              {[
                { label:"Gold Members",    val:"60,000",      sub:"× $109.99/month",          color:GOLD },
                { label:"Bonus Pool",      val:"$750,000",    sub:"60K × $12.50 (11%)",       color:BLUE_BRIGHT },
                { label:"LMCT Top-up",     val:"$50,000",     sub:"From gross — rounds to $1M",color:BLUE },
                { label:"Prize Pool RRP",  val:"$1,000,000",  sub:"10,000 × $100 vouchers",   color:BLUE_BRIGHT },
              ].map(s=>(
                <div key={s.label} style={{ background:NAVY3, border:`1px solid ${GOLD}22`, borderRadius:14, padding:"18px 20px" }}>
                  <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
                  <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Pool breakdown */}
            <div style={{ background:NAVY3, border:`1px solid ${GOLD}33`, borderRadius:16, padding:"24px 28px", marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:20 }}>Gold Bonus Draw — Pool Breakdown</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                <div>
                  {[
                    { label:"Gold members",             val:"60,000" },
                    { label:"Bonus contribution (11%)", val:"$12.50/member/month" },
                    { label:"Pool from members",        val:"$750,000" },
                    { label:"LMCT top-up",              val:"$50,000" },
                    { label:"Total pool",               val:"$800,000" },
                  ].map(r=>(
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${BORDER}` }}>
                      <span style={{ fontSize:13, color:TEXT2 }}>{r.label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:TEXT }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:NAVY4, borderRadius:12, padding:"20px" }}>
                  <div style={{ fontSize:11, color:GOLD, textTransform:"uppercase", letterSpacing:1.5, marginBottom:16, fontWeight:700 }}>Prize Pack — Gold Bonus Draw</div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                    <span style={{ fontSize:36 }}>•</span>
                    <div>
                      <div style={{ fontSize:18, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>LMCT+ Partner Voucher</div>
                      <div style={{ fontSize:12, color:TEXT3 }}>$100 RRP · $80 cost · 10,000 winners</div>
                    </div>
                  </div>
                  {[
                    { label:"Quantity",      val:"10,000 vouchers" },
                    { label:"RRP each",      val:"$100" },
                    { label:"Cost each",     val:"$80 (80% of RRP)" },
                    { label:"Total cost",    val:"$800,000" },
                    { label:"Total RRP",     val:"$1,000,000" },
                    { label:"Margin",        val:"$200,000" },
                  ].map(r=>(
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${BORDER}` }}>
                      <span style={{ fontSize:12, color:TEXT3 }}>{r.label}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:TEXT }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Retention value */}
            <div style={{ background:"rgba(255,215,0,0.05)", border:`2px solid ${GOLD}33`, borderRadius:16, padding:"24px 28px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:16 }}>Why This Works — Retention Mechanic</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {[
                  { emoji:"★", title:"1 in 6 chance",       desc:"Every Gold member has a meaningful chance of winning their membership back every single month", color:GOLD },
                  { emoji:"◆", title:"$100 voucher value",  desc:"One win nearly covers the full month's Gold subscription of $109.99 — felt immediately", color:CHAMPAGNE },
                  { emoji:"🔒", title:"Near-zero churn",     desc:"Members winning regularly don't cancel. 10,000 winners every month = 10,000 retention moments", color:BLUE_BRIGHT },
                ].map(c=>(
                  <div key={c.title} style={{ background:NAVY3, borderRadius:12, padding:"18px" }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>{c.emoji}</div>
                    <div style={{ fontSize:14, fontWeight:900, color:c.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", marginBottom:8 }}>{c.title}</div>
                    <div style={{ fontSize:12, color:TEXT2, lineHeight:1.6 }}>{c.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:20, background:NAVY4, borderRadius:10, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:13, color:TEXT2 }}>Gold revenue vs Gold bonus cost</div>
                <div style={{ display:"flex", gap:24 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:TEXT3 }}>Gold gross/month</div>
                    <div style={{ fontSize:16, fontWeight:900, color:GOLD }}>$6,599,400</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:TEXT3 }}>Bonus cost/month</div>
                    <div style={{ fontSize:16, fontWeight:900, color:BLUE_BRIGHT }}>$800,000</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:TEXT3 }}>% of Gold revenue</div>
                    <div style={{ fontSize:16, fontWeight:900, color:BLUE_BRIGHT }}>12.1%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )} {/* end bonus tab */}

        {/* ── COMBINED / FULL PICTURE TAB ── */}
        {adminTab === "combined" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* Header */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, padding:"22px 28px" }}>
              <div style={{ fontSize:11, color:BLUE_BRIGHT, textTransform:"uppercase", letterSpacing:2.5, fontWeight:700, marginBottom:8 }}>Full Picture — One Saturday Night</div>
              <div style={{ fontSize:28, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", marginBottom:6 }}>$6,000,000 In Prizes</div>
              <div style={{ fontSize:14, color:TEXT2 }}>Monthly Millionaire Draw + Gold Bonus Draw · Last Saturday every month · 8PM AEST</div>
            </div>

            {/* Two draws side by side */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

              {/* Monthly Millionaire */}
              <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, overflow:"hidden" }}>
                <div style={{ background:BLUE_DIM, borderBottom:`1px solid ${BLUE_BORDER}`, padding:"16px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:10, color:BLUE_BRIGHT, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:4 }}>All 200,000 Members</div>
                    <div style={{ fontSize:20, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Monthly Millionaire Draw</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Announced Prize Pool</div>
                    <div style={{ fontSize:24, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$5,000,000</div>
                  </div>
                </div>
                <div style={{ padding:"18px 22px" }}>
                  {[
                    { prize:"◆ $1,000,000 Cash",  qty:"× 1",      rrp:"$1,000,000", cost:"$1,000,000", note:"Paid in full" },
                    { prize:"▰ Brand New Car",     qty:"× 50",     rrp:"$2,500,000", cost:"$2,000,000", note:"80% of RRP" },
                    { prize:"✦ Holiday Package",    qty:"× 100",    rrp:"$500,000",   cost:"$400,000",   note:"80% of RRP" },
                    { prize:"◇ Tech Bundle",        qty:"× 500",    rrp:"$500,000",   cost:"$400,000",   note:"80% of RRP" },
                    { prize:"• Partner Voucher",    qty:"× 10,000", rrp:"$1,000,000", cost:"$800,000",   note:"80% of RRP" },
                  ].map((r,i)=>(
                    <div key={r.prize} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 0", borderBottom:`1px solid ${BORDER}` }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:TEXT }}>{r.prize}</div>
                        <div style={{ fontSize:11, color:TEXT3, marginTop:2 }}>{r.qty} · {r.note}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:13, color:BLUE_BRIGHT, fontWeight:700 }}>{r.rrp} RRP</div>
                        <div style={{ fontSize:11, color:TEXT3 }}>{r.cost} cost</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ background:NAVY4, borderRadius:8, padding:"10px 14px" }}>
                      <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Total RRP</div>
                      <div style={{ fontSize:18, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$5,500,000</div>
                    </div>
                    <div style={{ background:NAVY4, borderRadius:8, padding:"10px 14px" }}>
                      <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Our Cost</div>
                      <div style={{ fontSize:18, fontWeight:900, color:BLUE_BRIGHT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$4,600,000</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gold Bonus */}
              <div style={{ background:NAVY3, border:`2px solid ${GOLD}44`, borderRadius:16, overflow:"hidden" }}>
                <div style={{ background:"rgba(255,215,0,0.08)", borderBottom:`1px solid ${GOLD}33`, padding:"16px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:10, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:4 }}>60,000 Gold Members Only</div>
                    <div style={{ fontSize:20, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Gold Bonus Draw</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Announced Prize Pool</div>
                    <div style={{ fontSize:24, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000</div>
                  </div>
                </div>
                <div style={{ padding:"18px 22px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 0", borderBottom:`1px solid ${BORDER}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:TEXT }}>• LMCT+ Partner Voucher</div>
                      <div style={{ fontSize:11, color:TEXT3, marginTop:2 }}>× 10,000 · 80% of RRP · Gold exclusive</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, color:CHAMPAGNE, fontWeight:700 }}>$1,000,000 RRP</div>
                      <div style={{ fontSize:11, color:TEXT3 }}>$800,000 cost</div>
                    </div>
                  </div>
                  <div style={{ marginTop:16, background:"rgba(255,215,0,0.05)", border:`1px solid ${GOLD}22`, borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ fontSize:12, color:GOLD, fontWeight:700, marginBottom:8 }}>Retention mechanic</div>
                    <div style={{ fontSize:12, color:TEXT2, lineHeight:1.7 }}>
                      10,000 vouchers across 60,000 Gold members — every Gold member has a meaningful chance of winning their membership back every single month.
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
                      <div style={{ background:NAVY4, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Pool source</div>
                        <div style={{ fontSize:13, fontWeight:700, color:GOLD }}>$750K member + $50K LMCT</div>
                      </div>
                      <div style={{ background:NAVY4, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Our cost</div>
                        <div style={{ fontSize:13, fontWeight:700, color:CHAMPAGNE }}>$800,000</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Combined night summary */}
            <div style={{ background:"rgba(0,230,118,0.05)", border:"2px solid rgba(0,230,118,0.25)", borderRadius:16, padding:"22px 28px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:BLUE_BRIGHT, textTransform:"uppercase", letterSpacing:2, marginBottom:20 }}>One Saturday Night — Total Impact</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
                {[
                  { emoji:"◆", label:"Cash Winner",       val:"1",          sub:"$1,000,000 paid in full",        color:GOLD },
                  { emoji:"▰", label:"Cars Given Away",   val:"50",         sub:"Monthly draw · $50K RRP each",   color:BLUE_BRIGHT },
                  { emoji:"✦", label:"Holidays",           val:"100",        sub:"Monthly draw · $5K RRP each",    color:BLUE_BRIGHT },
                  { emoji:"◇", label:"Tech Bundles",       val:"500",        sub:"Monthly draw · $1K RRP each",    color:BLUE_BRIGHT },
                  { emoji:"•", label:"Partner Vouchers",   val:"20,000",     sub:"10K monthly + 10K Gold bonus",   color:CHAMPAGNE },
                ].map(s=>(
                  <div key={s.label} style={{ textAlign:"center", background:NAVY3, borderRadius:12, padding:"16px 12px" }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>{s.emoji}</div>
                    <div style={{ fontSize:24, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:TEXT2, marginTop:4 }}>{s.label}</div>
                    <div style={{ fontSize:10, color:TEXT3, marginTop:4, lineHeight:1.4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                {[
                  { label:"Total RRP Announced",  val:"$6,500,000", color:GOLD,        sub:"What members see" },
                  { label:"We Say",               val:"$6,000,000", color:BLUE_BRIGHT,   sub:"Our headline number" },
                  { label:"Our Actual Cost",       val:"$5,400,000", color:BLUE_BRIGHT, sub:"What we spend" },
                ].map(s=>(
                  <div key={s.label} style={{ background:NAVY3, borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
                    <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:700 }}>{s.label}</div>
                    <div style={{ fontSize:26, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
                    <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {adminTab === "growth" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* Header */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, padding:"20px 24px" }}>
              <div style={{ fontSize:11, color:BLUE_BRIGHT, textTransform:"uppercase", letterSpacing:2.5, fontWeight:700, marginBottom:8 }}>Growth Projection — 200K to 500K Members</div>
              <div style={{ fontSize:14, color:TEXT2 }}>Fixed tier mix: 45% Bronze · 25% Silver · 30% Gold · Prize pools scale automatically with membership</div>
              <div style={{ display:"flex", gap:20, marginTop:12 }}>
                {[
                  { label:"Bronze", pct:"45%", contrib:"$9.00/mo → main pool",  color:BRONZE },
                  { label:"Silver", pct:"25%", contrib:"$24.00/mo → main pool", color:SILVER },
                  { label:"Gold",   pct:"30%", contrib:"$42.50 main + $12.50 bonus → pool", color:GOLD },
                ].map(t=>(
                  <div key={t.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:t.color, flexShrink:0 }} />
                    <span style={{ fontSize:13, color:t.color, fontWeight:700 }}>{t.pct} {t.label}</span>
                    <span style={{ fontSize:11, color:TEXT3 }}>{t.contrib}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth table */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:NAVY4 }}>
                      {["Members","Bronze","Silver","Gold","Gross Revenue","Main Pool","Monthly Draw","Gold Bonus","Total Prizes","LMCT Retained","LMCT / Year"].map(h=>(
                        <th key={h} style={{ padding:"10px 14px", textAlign:"right", fontSize:9, color:TEXT3, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, borderBottom:`2px solid ${BORDER}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { total:200000, b:90000,  s:50000,  g:60000,  gross:12298000, main:4560000,  monthly:5000000,  bonus:1000000,  prizes:6000000,  lmct:7988000,  lmctYr:95.9  },
                      { total:250000, b:112500, s:62500,  g:75000,  gross:15372500, main:5700000,  monthly:6000000,  bonus:1250000,  prizes:7250000,  lmct:9985000,  lmctYr:119.8 },
                      { total:300000, b:135000, s:75000,  g:90000,  gross:18447000, main:6840000,  monthly:7500000,  bonus:1500000,  prizes:9000000,  lmct:12082000, lmctYr:145.0 },
                      { total:350000, b:157500, s:87500,  g:105000, gross:21521500, main:7980000,  monthly:9000000,  bonus:1750000,  prizes:10750000, lmct:14179000, lmctYr:170.1 },
                      { total:400000, b:180000, s:100000, g:120000, gross:24596000, main:9120000,  monthly:10000000, bonus:2000000,  prizes:12000000, lmct:16176000, lmctYr:194.1 },
                      { total:450000, b:202500, s:112500, g:135000, gross:27670500, main:10260000, monthly:11000000, bonus:2250000,  prizes:13250000, lmct:18173000, lmctYr:218.1 },
                      { total:500000, b:225000, s:125000, g:150000, gross:30745000, main:11400000, monthly:12500000, bonus:2500000,  prizes:15000000, lmct:20270000, lmctYr:243.2 },
                    ].map((r,i)=>{
                      const isBase = r.total === 200000;
                      const bg = isBase ? "rgba(0,102,255,0.08)" : i%2===0 ? "transparent" : "rgba(255,255,255,0.02)";
                      const fmt = n => "$" + n.toLocaleString();
                      return (
                        <tr key={r.total} style={{ background:bg, borderBottom:`1px solid ${BORDER}` }}>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:isBase?BLUE_BRIGHT:TEXT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", whiteSpace:"nowrap" }}>
                            {r.total.toLocaleString()}{isBase ? " ✅" : ""}
                          </td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:BRONZE }}>{r.b.toLocaleString()}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:SILVER }}>{r.s.toLocaleString()}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:GOLD }}>{r.g.toLocaleString()}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:TEXT, fontWeight:700 }}>{fmt(r.gross)}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:BLUE_BRIGHT }}>{fmt(r.main)}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:GOLD, fontWeight:700 }}>{fmt(r.monthly)}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:CHAMPAGNE }}>{fmt(r.bonus)}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:BLUE_BRIGHT, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{fmt(r.prizes)}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:GOLD, fontWeight:700 }}>{fmt(r.lmct)}</td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:GOLD, fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", whiteSpace:"nowrap" }}>${r.lmctYr}M</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:"12px 20px", borderTop:`1px solid ${BORDER}`, background:NAVY4, display:"flex", gap:20, flexWrap:"wrap" }}>
                {[
                  { dot:BLUE_BRIGHT, label:"Main Pool — funds the monthly $5M draw (scales with members)" },
                  { dot:GOLD,        label:"Monthly Draw — what members see as RRP" },
                  { dot:CHAMPAGNE,   label:"Gold Bonus — 10,000 vouchers × $100 RRP (Gold only)" },
                  { dot:BLUE_BRIGHT,   label:"Total Prizes — combined monthly + bonus (RRP)" },
                ].map(l=>(
                  <div key={l.label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:TEXT3 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:l.dot, flexShrink:0 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
              {[
                { label:"200K members",  monthly:"$5,000,000",  bonus:"$1,000,000", total:"$6M/mo",  lmct:"$96M/yr",  color:BLUE_BRIGHT },
                { label:"300K members",  monthly:"$7,500,000",  bonus:"$1,500,000", total:"$9M/mo",  lmct:"$145M/yr", color:CHAMPAGNE },
                { label:"400K members",  monthly:"$10,000,000", bonus:"$2,000,000", total:"$12M/mo", lmct:"$194M/yr", color:GOLD },
                { label:"500K members",  monthly:"$12,500,000", bonus:"$2,500,000", total:"$15M/mo", lmct:"$243M/yr", color:BLUE_BRIGHT },
              ].map(s=>(
                <div key={s.label} style={{ background:NAVY3, border:`1px solid ${s.color}33`, borderRadius:14, padding:"18px 18px" }}>
                  <div style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:12, fontWeight:700 }}>{s.label}</div>
                  <div style={{ fontSize:12, color:TEXT2, marginBottom:4 }}>Monthly draw: <strong style={{color:s.color}}>{s.monthly}</strong></div>
                  <div style={{ fontSize:12, color:TEXT2, marginBottom:8 }}>Gold bonus: <strong style={{color:s.color}}>{s.bonus}</strong></div>
                  <div style={{ fontSize:18, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.total} in prizes</div>
                  <div style={{ fontSize:12, color:TEXT3, marginTop:4 }}>LMCT retains: <strong style={{color:s.color}}>{s.lmct}</strong></div>
                </div>
              ))}
            </div>

          </div>
        )}

        {adminTab === "operations" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* ── Monthly Draw Cycle ── */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:18, overflow:"hidden" }}>
              <div style={{ background:BLUE_DIM, borderBottom:`1px solid ${BLUE_BORDER}`, padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ fontSize:28 }}>📅</div>
                <div>
                  <div style={{ fontSize:11, color:BLUE_BRIGHT, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:2 }}>Monthly Draw Cycle</div>
                  <div style={{ fontSize:18, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Last Saturday of Every Month — 8PM AEST</div>
                </div>
              </div>
              <div style={{ padding:"28px 28px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:0, marginBottom:28 }}>
                  {[
                    { day:"1st of month",  time:"",            event:"Entries Open",       detail:"All active members automatically entered · Tiles allocated based on tier",                               icon:"◇", color:BLUE_BRIGHT },
                    { day:"Mid month",     time:"",            event:"Entries Continue",   detail:"New members joining are included · Existing members retain their tiles",                                  icon:"📋", color:BLUE_BRIGHT },
                    { day:"Last Friday",   time:"5:00 PM AEST",event:"Board Locks",        detail:"Member snapshot taken · Tiles cryptographically sealed · No changes after this point",                   icon:"🔒", color:CHAMPAGNE },
                    { day:"Last Saturday", time:"8:00 PM AEST",event:"Draw Night",         detail:"$5M Monthly Millionaire Draw · $1M Gold Bonus Draw · Independent licensed draw manager · Live on screen", icon:"◆", color:GOLD },
                    { day:"Sunday +48hrs", time:"",            event:"Results Close",      detail:"48hrs results visible to all members · Winners confirmed · Prize fulfilment begins · New cycle starts",   icon:"✅", color:BLUE_BRIGHT },
                  ].map((d,i)=>(
                    <div key={d.day} style={{ textAlign:"center", position:"relative", padding:"0 8px" }}>
                      {i < 4 && <div style={{ position:"absolute", top:22, left:"75%", right:"-25%", height:2, background:`linear-gradient(90deg,${d.color}44,transparent)`, zIndex:0 }} />}
                      <div style={{ width:44, height:44, borderRadius:"50%", background:`${d.color}22`, border:`2px solid ${d.color}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, margin:"0 auto 10px", position:"relative", zIndex:1 }}>{d.icon}</div>
                      <div style={{ fontSize:12, fontWeight:900, color:d.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{d.day}</div>
                      {d.time && <div style={{ fontSize:10, color:d.color, marginTop:2, fontWeight:700 }}>{d.time}</div>}
                      <div style={{ fontSize:11, color:TEXT, fontWeight:700, marginTop:6 }}>{d.event}</div>
                      <div style={{ fontSize:10, color:TEXT3, marginTop:4, lineHeight:1.5 }}>{d.detail}</div>
                    </div>
                  ))}
                </div>

                {/* Key rules */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                  {[
                    { icon:"🔒", title:"Board Lock Rule", color:BLUE_BRIGHT,
                      body:"Friday 5PM AEST — a snapshot of all active members is taken from the LMCT+ database. Tiles are allocated from this snapshot and cryptographically sealed. No membership changes after 5PM affect this draw." },
                    { icon:"★", title:"Two Draws — One Night", color:GOLD,
                      body:"The Monthly Millionaire Draw ($5M) and Gold Bonus Draw ($1M) both run on the same Saturday night. Main draw is all 200K members. Gold Bonus is exclusive to 60K Gold members." },
                    { icon:"◆", title:"Independent Draw Manager", color:BLUE_BRIGHT,
                      body:"Both draws are conducted by an independent licensed third party. Results are cryptographically verifiable. Winners are notified immediately. Prize fulfilment begins within 48 hours." },
                  ].map(c=>(
                    <div key={c.title} style={{ background:NAVY4, borderRadius:12, padding:"18px 18px" }}>
                      <div style={{ fontSize:20, marginBottom:8 }}>{c.icon}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:c.color, marginBottom:8 }}>{c.title}</div>
                      <div style={{ fontSize:12, color:TEXT2, lineHeight:1.7 }}>{c.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Who Gets Tiles ── */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:18, overflow:"hidden" }}>
              <div style={{ background:"rgba(255,140,0,0.08)", borderBottom:"1px solid rgba(255,140,0,0.2)", padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ fontSize:28 }}>👤</div>
                <div>
                  <div style={{ fontSize:11, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:2 }}>Membership Entry Rules</div>
                  <div style={{ fontSize:18, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Who Gets Tiles This Draw?</div>
                </div>
              </div>
              <div style={{ padding:"24px 28px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
                  <div style={{ background:"rgba(0,230,118,0.06)", border:"1px solid rgba(0,230,118,0.25)", borderRadius:14, padding:"20px 20px" }}>
                    <div style={{ fontSize:14, fontWeight:900, color:BLUE_BRIGHT, marginBottom:12 }}>✅ Included in draw</div>
                    {[
                      "Active member at Friday 5PM board lock",
                      "Cancelled AFTER Friday 5PM lock — included in this draw",
                      "Upgraded tier before lock — gets new tier tile count",
                      "Downgraded tier before lock — gets new lower tile count",
                      "New member joined before Friday 5PM lock",
                    ].map(r=>(
                      <div key={r} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8 }}>
                        <span style={{ color:BLUE_BRIGHT, flexShrink:0, marginTop:1 }}>✓</span>
                        <span style={{ fontSize:13, color:TEXT2, lineHeight:1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:"rgba(255,96,96,0.06)", border:"1px solid rgba(255,96,96,0.25)", borderRadius:14, padding:"20px 20px" }}>
                    <div style={{ fontSize:14, fontWeight:900, color:"#FF6060", marginBottom:12 }}>❌ Not included in draw</div>
                    {[
                      "Cancelled BEFORE Friday 5PM lock",
                      "Payment failed before Friday 5PM lock",
                      "Account suspended before Friday 5PM lock",
                      "New member joined after Friday 5PM lock",
                    ].map(r=>(
                      <div key={r} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8 }}>
                        <span style={{ color:"#FF6060", flexShrink:0, marginTop:1 }}>✗</span>
                        <span style={{ fontSize:13, color:TEXT2, lineHeight:1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background:NAVY4, borderRadius:12, padding:"16px 18px", display:"flex", gap:14, alignItems:"flex-start" }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>ID</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:TEXT, marginBottom:6 }}>Identity Verification</div>
                    <div style={{ fontSize:13, color:TEXT2, lineHeight:1.7 }}>
                      Identity is verified at sign-up via a licensed third-party KYC provider (e.g. GreenID / Jumio). One membership per verified identity — no exceptions. Winners do not need to verify again at prize claim — they are already verified members.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Gold Bonus Draw — Operations ── */}
            <div style={{ background:NAVY3, border:`2px solid ${GOLD}33`, borderRadius:18, overflow:"hidden" }}>
              <div style={{ background:"rgba(255,215,0,0.08)", borderBottom:`1px solid ${GOLD}22`, padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ fontSize:28 }}>★</div>
                <div>
                  <div style={{ fontSize:11, color:GOLD, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:2 }}>Gold Bonus Draw — Operations</div>
                  <div style={{ fontSize:18, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000 in Vouchers — Gold Members Only</div>
                </div>
              </div>
              <div style={{ padding:"24px 28px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
                  {[
                    { label:"Prize",        val:"LMCT+ Partner Voucher",  sub:"10,000 vouchers × $100 each",          color:GOLD },
                    { label:"Eligible",     val:"Gold members only",       sub:"60,000 Gold members · 40 tiles each",  color:CHAMPAGNE },
                    { label:"Draw night",   val:"Same Saturday night",     sub:"Runs after Monthly Millionaire Draw",  color:BLUE_BRIGHT },
                  ].map(s=>(
                    <div key={s.label} style={{ background:NAVY4, borderRadius:12, padding:"16px 18px" }}>
                      <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:6, fontWeight:700 }}>{s.label}</div>
                      <div style={{ fontSize:16, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
                      <div style={{ fontSize:11, color:TEXT3, marginTop:4 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div style={{ background:NAVY4, borderRadius:12, padding:"18px 18px" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:GOLD, marginBottom:12 }}>How the pool is funded</div>
                    {[
                      { label:"Gold members contribute",   val:"60,000 × $12.50 = $750,000" },
                      { label:"LMCT top-up",               val:"$50,000 from operational revenue" },
                      { label:"Total pool",                val:"$800,000 cost" },
                      { label:"Prize RRP announced",       val:"$1,000,000 to members" },
                      { label:"Prize type",                val:"Vouchers only — no pack purchases" },
                    ].map(r=>(
                      <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${BORDER}` }}>
                        <span style={{ fontSize:12, color:TEXT3 }}>{r.label}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:TEXT }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:NAVY4, borderRadius:12, padding:"18px 18px" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:GOLD, marginBottom:12 }}>Retention impact</div>
                    <div style={{ fontSize:12, color:TEXT2, lineHeight:1.8, marginBottom:12 }}>
                      10,000 vouchers across 60,000 Gold members means every Gold member has a meaningful chance of winning their full monthly subscription back every single month.
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      {[
                        { label:"Gold subscription", val:"$109.99/mo" },
                        { label:"Voucher value",     val:"$100" },
                        { label:"Net cost if win",   val:"~$9.99/mo" },
                        { label:"Winners/month",     val:"10,000" },
                      ].map(s=>(
                        <div key={s.label} style={{ background:NAVY3, borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{s.label}</div>
                          <div style={{ fontSize:14, fontWeight:700, color:GOLD }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Prize fulfilment ── */}
            <div style={{ background:NAVY3, border:`1px solid ${BORDER}`, borderRadius:18, overflow:"hidden" }}>
              <div style={{ background:BLUE_DIM, borderBottom:`1px solid ${BLUE_BORDER}`, padding:"16px 24px", display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ fontSize:28 }}>📦</div>
                <div>
                  <div style={{ fontSize:11, color:BLUE_BRIGHT, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:2 }}>Prize Fulfilment</div>
                  <div style={{ fontSize:18, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>How Prizes Are Delivered</div>
                </div>
              </div>
              <div style={{ padding:"24px 28px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
                  {[
                    { icon:"◆", prize:"$1M Cash",        how:"Direct bank transfer to verified winner · Processed within 5 business days",          color:GOLD },
                    { icon:"▰", prize:"Brand New Car",   how:"Winner selects colour/model from agreed range · Delivered to winner's address",       color:BLUE_BRIGHT },
                    { icon:"✦", prize:"Holiday Package",  how:"Travel voucher issued · Redeemable with LMCT+ travel partner · 12 month expiry",      color:BLUE_BRIGHT },
                    { icon:"•", prize:"Partner Voucher",  how:"Digital voucher code emailed immediately · Redeemable at LMCT+ partner network",      color:CHAMPAGNE },
                  ].map(p=>(
                    <div key={p.prize} style={{ background:NAVY4, borderRadius:12, padding:"16px 16px" }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>{p.icon}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:p.color, marginBottom:8 }}>{p.prize}</div>
                      <div style={{ fontSize:11, color:TEXT2, lineHeight:1.6 }}>{p.how}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        
)} {/* end operations tab */}

      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const DEFAULT_PROFILE = { id:"00001", name:"Paul R.", state:"VIC", tier:"elite", avatar:"★" };

export default function App() {
  const [page, setPage]             = useState("home");
  const [profile, setProfile]       = useState(DEFAULT_PROFILE);
  const [editingProfile, setEditingProfile] = useState(false);
  const [drawActive, setDrawActive] = useState(false);
  const onNav = (p) => setPage(p);
  const boardType = page.includes("monthly") ? "monthly" : "weekly";

  return (
    <div style={{ fontFamily:"Arial, sans-serif", background:NAVY, minHeight:"100vh" }}>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        button { font-family:inherit; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width:8px; }
        ::-webkit-scrollbar-track { background:rgba(255,255,255,0.04); border-radius:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(0,102,255,0.5); border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(0,195,255,0.8); }
        input:focus { border-color: rgba(43,159,232,0.6) !important; box-shadow: 0 0 0 2px rgba(43,159,232,0.15); }
      `}</style>
      {editingProfile && <ProfileEditor profile={profile} onSave={p=>{setProfile(p);setEditingProfile(false);}} onClose={()=>setEditingProfile(false)} />}
      <NavBar page={page} onNav={onNav} drawActive={drawActive} />
      {page==="home"    && <Landing onNav={onNav} />}
      {page==="tiers"   && <TierCards onNav={onNav} />}
      {(page==="draw"||page==="draw-monthly"||page==="draw-weekly") && <LiveDraw boardType={boardType} onNav={onNav} profile={profile} onEditProfile={()=>setEditingProfile(true)} onDrawStateChange={setDrawActive} />}
      {page==="members" && <WinnersPage onNav={onNav} />}
      {page==="bonus"   && <BonusDraw onNav={onNav} profile={profile} onDrawStateChange={setDrawActive} />}
      {page==="admin"   && <AdminPanel onNav={onNav} />}
    </div>
  );
}

// ─── BONUS DRAW ───────────────────────────────────────────────────────────────
// Gold members only · 10,000 LMCT+ Partner Vouchers · $1,000,000 in prizes

// DEMO: 20 vouchers shown — real draw: 10,000 vouchers
// At 20 × 3000ms = 60s pauses + 15s board = ~75s demo, smooth and dramatic
const BONUS_PRIZES = [
  { name:"LMCT+ Partner Voucher", emoji:"•", qty:30, remaining:30, color:CHAMPAGNE, pause:0, isProduct:true, realQty:10000, silent:true },
];

function BonusDraw({ onNav, profile, onDrawStateChange }) {
  const tier = TIERS[profile?.tier] || TIERS.elite;

  // Stable bonus tile IDs — generated once on mount, never change
  const [myBonusTiles] = useState(() =>
    tier.bonusAccess
      ? Array.from({ length: tier.bonusTiles }, (_, i) => ({
          id: `B${String(Math.floor(Math.random() * 999999) + 1).padStart(6,"0")}`,
          // Pre-reveal some tiles for demo: first 8 = checked (no prize), tile #3 = winner
          status: i === 2 ? "win" : i < 8 ? "checked" : "pending",
        }))
      : []
  );

  const [prizeState, setPrizeState]   = useState(() => BONUS_PRIZES.map(p => ({ ...p })));
  const [liveViewers, setLiveViewers] = useState(() => 3200 + Math.floor(Math.random()*1800));
  useEffect(() => {
    const iv = setInterval(() => setLiveViewers(v => Math.max(2000, v + Math.floor((Math.random()-0.45)*80))), 3000);
    return () => clearInterval(iv);
  }, []);
  const [drawState,  setDrawState]    = useState("idle");
  const [tilesRevealed, setTilesRevealed] = useState(0);
  const [winFeed,    setWinFeed]      = useState([]);
  const [currentPrize, setCurrentPrize] = useState(null);
  const [grid,       setGrid]         = useState(() => Array.from({ length: GRID_SIZE }, () => ({ state:"pending", prize:null })));
  const [boardNum,   setBoardNum]     = useState(1);
  const [scanLine,   setScanLine]     = useState(0);
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);

  // Gold members only — total bonus board tiles = 60,000 Gold × 40 tiles = 2,400,000
  // Use TOTAL_TILES cap for demo
  const totalTiles = Math.min(TOTAL_TILES, 2400000);
  const drawSpeed  = calcDrawSpeed(totalTiles);

  const runningRef = useRef(false);
  const revealedRef = useRef(0);
  const scanRef = useRef(null);

  const stopDraw = useCallback(() => {
    runningRef.current = false;
    setDrawState("done");
    onDrawStateChange?.(false);
    if (scanRef.current) clearInterval(scanRef.current);
  }, []);

  const resetDraw = useCallback(() => {
    runningRef.current = false;
    revealedRef.current = 0;
    if (scanRef.current) clearInterval(scanRef.current);
    setTilesRevealed(0);
    setDrawState("idle");
    setWinFeed([]);
    onDrawStateChange?.(false);
    setPrizeState(BONUS_PRIZES.map(p => ({ ...p })));
    setCurrentPrize(null);
    setGrid(Array.from({ length: GRID_SIZE }, () => ({ state:"pending", prize:null })));
    setBoardNum(b => b + 1);
    setScanLine(0);
  }, []);

  const triggerWin = useCallback((prize) => {
    const states = ["NSW","VIC","QLD","SA","WA","TAS","NT","ACT"];
    const now = new Date();
    const aest = new Date(now.getTime() + 10*60*60*1000);
    const ts = aest.toISOString().slice(11,19) + " AEST";
    const win = {
      id: Date.now() + Math.random(),
      tile: String(Math.floor(Math.random() * totalTiles) + 1).padStart(7,"0"),
      member: String(Math.floor(Math.random() * 60000) + 1).padStart(5,"0"),
      state: states[Math.floor(Math.random() * states.length)],
      tier: "Gold",
      prize, ts,
    };
    setWinFeed(f => [win, ...f].slice(0, 200));
    const idx = Math.floor(Math.random() * GRID_SIZE);
    setGrid(g => { const ng=[...g]; ng[idx]={ state:"prize", prize }; return ng; });
  }, [totalTiles]);

  const runDraw = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setDrawState("running");
    setCurrentPrize(null);
    onDrawStateChange?.(true);
    const BATCH    = Math.max(10, Math.ceil(drawSpeed / 50));
    const INTERVAL = 20;
    let localPrizes = BONUS_PRIZES.map(p => ({ ...p }));
    let allP = [];
    for (const p of localPrizes) for (let i=0; i<p.qty; i++) allP.push({ ...p });
    const prizePositions = buildSpreadPrizePositions(allP, totalTiles);
    let sl = 0;
    scanRef.current = setInterval(() => { sl = (sl+1) % GRID_ROWS; setScanLine(sl); }, 60);

    const revealStep = () => {
      if (!runningRef.current) return;
      for (let b=0; b<BATCH; b++) {
        revealedRef.current++;
        const tileNum = revealedRef.current;
        const gridIdx = tileNum % GRID_SIZE;
        if (prizePositions.has(tileNum)) {
          const prize = prizePositions.get(tileNum);
          const pi = localPrizes.findIndex(p => p.name===prize.name && p.remaining>0);
          if (pi >= 0) {
            localPrizes[pi].remaining--;
            setPrizeState(localPrizes.map(p => ({ ...p })));
            triggerWin(prize);
            setTilesRevealed(revealedRef.current);
            // Vouchers are always silent — just feed update, no popup
            setGrid(g => { const ng=[...g]; ng[gridIdx]={ state:"prize", prize }; return ng; });
          }
        } else {
          setGrid(g => { const ng=[...g]; ng[gridIdx]={ state:"empty", prize:null }; return ng; });
        }
      }
      setTilesRevealed(revealedRef.current);
      if (revealedRef.current >= totalTiles || !runningRef.current) { stopDraw(); return; }
      setTimeout(revealStep, INTERVAL);
    };
    setTimeout(revealStep, INTERVAL);
  }, [totalTiles, drawSpeed, triggerWin, stopDraw]);

  const simulateWin = useCallback(() => {
    const prize = BONUS_PRIZES[0];
    triggerWin(prize);
    setCurrentPrize(prize);
    setTimeout(() => setCurrentPrize(null), prize.pause);
    setDemoPickerOpen(false);
  }, [triggerWin]);

  const pct = Math.min(100, (tilesRevealed / totalTiles) * 100);
  const vouchersWon = BONUS_PRIZES[0].qty - prizeState[0].remaining;
  const vouchersLeft = prizeState[0].remaining;

  if (!tier.bonusAccess) {
    return (
      <div style={{ background:`radial-gradient(ellipse at 50% 0%, #1A0D00 0%, ${NAVY} 70%)`, minHeight:"100vh", color:TEXT, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center", maxWidth:480, padding:40 }}>
          <div style={{ fontSize:48, marginBottom:20 }}>★</div>
          <div style={{ fontSize:28, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", marginBottom:16 }}>Gold Members Only</div>
          <div style={{ fontSize:16, color:TEXT2, marginBottom:32, lineHeight:1.7 }}>The $1,000,000 Gold Bonus Draw is exclusive to Gold members. Upgrade to Gold to access 40 bonus tiles and compete in 10,000 vouchers given away every month.</div>
          <button onClick={() => onNav("tiers")} style={{ background:`linear-gradient(135deg,${GOLD},#A9893F)`, border:"none", borderRadius:12, padding:"16px 40px", color:"#000", fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:18, cursor:"pointer" }}>
            UPGRADE TO GOLD →
          </button>
          <div style={{ marginTop:16 }}>
            <button onClick={() => onNav("draw")} style={{ background:"transparent", color:TEXT3, border:"none", fontSize:13, cursor:"pointer" }}>← Back to Main Draw</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:`radial-gradient(ellipse at 50% 0%, #1A0D00 0%, ${NAVY} 70%)`, minHeight:"100vh", color:TEXT }}>
      <style>{`@keyframes bonusGlow { 0%,100%{box-shadow:0 0 20px ${GOLD}44} 50%{box-shadow:0 0 50px ${GOLD}88,0 0 80px ${GOLD}44} }`}</style>

      {/* Sub-nav */}
      <div style={{ background:"rgba(10,15,30,0.95)", backdropFilter:"blur(12px)", borderBottom:`1px solid ${GOLD}33`, padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <button onClick={() => onNav("draw")} style={{ background:"transparent", border:`1px solid ${BORDER2}`, borderRadius:6, padding:"6px 14px", color:TEXT2, cursor:"pointer", fontSize:13 }}>← Main Draw</button>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,215,0,0.08)", border:`1px solid ${GOLD}44`, borderRadius:20, padding:"6px 16px" }}>
          <span style={{ fontSize:14 }}>★</span>
          <span style={{ fontSize:13, color:GOLD, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5 }}>$1M Gold Bonus Draw</span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(73,217,255,0.08)", border:"1px solid rgba(73,217,255,0.18)", borderRadius:20, padding:"4px 12px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:BLUE_BRIGHT, animation:"livePulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize:12, color:BLUE_BRIGHT, fontWeight:700 }}>{liveViewers.toLocaleString()} watching</span>
          </div>
          <span style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5 }}>Board #{String(boardNum).padStart(3,"0")}</span>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:drawState==="paused"?"rgba(255,215,0,0.15)":BLUE_DIM, border:`1px solid ${drawState==="paused"?`${GOLD}44`:BLUE_BORDER}`, borderRadius:20, padding:"4px 14px" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:drawState==="running"?BLUE_BRIGHT:drawState==="paused"?GOLD:"#555", display:"inline-block" }} />
            <span style={{ fontSize:12, color:drawState==="running"?BLUE_BRIGHT:drawState==="paused"?GOLD:TEXT3, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
              {drawState==="running"?"● LIVE":drawState==="paused"?"★ WINNER!":drawState==="done"?"✓ COMPLETE":"READY"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1280, margin:"0 auto", padding:"20px 24px" }}>

        {/* Header strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
          {[
            { label:"Draw",          val:"Gold Bonus Draw",  color:GOLD },
            { label:"Prize Pool",    val:"$1,000,000",       color:CHAMPAGNE },
            { label:"Vouchers",      val:"10,000 × $100",    color:BLUE_BRIGHT },
            { label:"Your Tiles",    val:`${tier.bonusTiles} tiles`, color:GOLD },
          ].map(s => (
            <div key={s.label} style={{ background:NAVY3, border:`1px solid ${GOLD}22`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:10, color:TEXT3, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:16, fontWeight:900, color:s.color, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Silent wins — no popup. Winner count shown in progress bar */}
        {vouchersWon > 0 && drawState === "paused" && null /* never pauses for vouchers */}


        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20, alignItems:"start" }}>
          {/* Board */}
          <div>
            {/* Progress bar with live winner count */}
            <div style={{ background:NAVY3, border:`1px solid ${GOLD}22`, borderRadius:12, padding:"14px 20px", marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:12, color:TEXT3 }}>Gold Bonus Draw in Progress</span>
                  {vouchersWon > 0 && (
                    <div style={{ background:`${GOLD}22`, border:`1px solid ${GOLD}44`, borderRadius:20, padding:"3px 12px", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:14 }}>•</span>
                      <span style={{ fontSize:13, color:GOLD, fontWeight:900 }}>{vouchersWon.toLocaleString()} vouchers won</span>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ background:"rgba(255,215,0,0.1)", border:`1px solid ${GOLD}44`, borderRadius:10, padding:"2px 8px", fontSize:10, color:GOLD, fontWeight:700 }}>DEMO MODE</span>
                  <span style={{ color:TEXT3, fontSize:12 }}>{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div style={{ height:5, background:NAVY4, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:pct+"%", background:`linear-gradient(90deg,${GOLD},#C8A756)`, borderRadius:3, transition:"width 0.2s", boxShadow:`0 0 8px ${GOLD}88` }} />
              </div>
            </div>

            {/* Grid */}
            <div style={{ background:"#0A0800", border:`1px solid ${GOLD}22`, borderRadius:16, padding:14, marginBottom:14, position:"relative", overflow:"hidden" }}>
              {drawState==="running" && (
                <div style={{ position:"absolute", left:14, right:14, height:`${100/GRID_ROWS}%`, top:`calc(14px + ${scanLine}*(${100/GRID_ROWS}%))`, background:`linear-gradient(180deg,transparent,rgba(255,215,0,0.15),transparent)`, pointerEvents:"none", zIndex:2 }} />
              )}
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${GRID_COLS},1fr)`, gap:2.5, position:"relative", zIndex:1 }}>
                {grid.map((cell,i) => {
                  const isPrize = cell.state==="prize";
                  const isEmpty = cell.state==="empty";
                  const isRunning = drawState==="running" || drawState==="paused";
                  return (
                    <div key={i} style={{
                      aspectRatio:"1", borderRadius:2,
                      background: isPrize ? GOLD : isEmpty ? "#080600" : "#0F0C00",
                      boxShadow: isPrize ? `0 0 10px ${GOLD}88` : "none",
                      animation: isPrize ? "none" : isRunning ? `tileCycle ${1.2+(i%12)*0.1}s ease-in-out infinite` : "none",
                    }} />
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
              {drawState==="idle" || drawState==="done" ? (
                <button onClick={() => drawState==="done" ? resetDraw() : runDraw()} style={{ background:`linear-gradient(135deg,${GOLD},#A9893F)`, border:"none", borderRadius:8, padding:"14px 36px", color:"#000", fontWeight:900, fontSize:16, cursor:"pointer", fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>
                  {drawState==="done" ? "⟳ NEW DRAW" : "★ START GOLD BONUS DRAW"}
                </button>
              ) : (
                <button onClick={stopDraw} style={{ background:"transparent", color:"#FF6060", border:"2px solid #FF606044", borderRadius:8, padding:"14px 32px", fontWeight:700, fontSize:15, cursor:"pointer" }}>■ Stop</button>
              )}
              <button onClick={() => { simulateWin(); setDemoPickerOpen(false); }} style={{ background:"rgba(255,215,0,0.1)", color:GOLD, border:`1px solid ${GOLD}44`, borderRadius:8, padding:"14px 22px", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                ✦ DEMO: TRIGGER WIN
              </button>
              {drawState !== "idle" && <button onClick={resetDraw} style={{ background:"transparent", color:TEXT2, border:`1px solid ${BORDER}`, borderRadius:8, padding:"14px 24px", fontSize:15, cursor:"pointer" }}>Reset</button>}
            </div>

            {/* Demo note */}
            <div style={{ background:"rgba(255,215,0,0.04)", border:`1px solid ${GOLD}33`, borderRadius:10, padding:"10px 16px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:14 }}>ℹ️</span>
              <div style={{ fontSize:11, color:TEXT3 }}>
                <strong style={{color:TEXT2}}>Demo mode</strong> — showing 100 voucher winners (~1 min). 
                Real Gold Bonus Draw: 10,000 LMCT+ Partner Vouchers given away. Runs server-side.
              </div>
            </div>

            {/* My bonus tiles */}
            <div style={{ background:NAVY3, border:`1px solid ${GOLD}33`, borderRadius:14, padding:"18px 20px" }}>
              <div style={{ fontSize:11, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${GOLD},#A9893F)`, borderRadius:2 }} />
                My Gold Bonus Tiles — {tier.bonusTiles} allocated
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {myBonusTiles.slice(0, 40).map((t,i) => {
                  const isWin     = t.status === "win";
                  const isChecked = t.status === "checked";
                  if (isWin) return (
                    <div key={i} style={{ background:`${GOLD}22`, border:`2px solid ${GOLD}`, borderRadius:8, padding:"6px 10px", fontSize:11, color:GOLD, fontFamily:"monospace", fontWeight:700, boxShadow:`0 0 10px ${GOLD}66`, animation:"tileWinPulse 1.4s ease-in-out infinite", display:"flex", flexDirection:"column", alignItems:"center", gap:2, minWidth:90, textAlign:"center" }}>
                      <span style={{ fontSize:16 }}>•</span>
                      <span style={{ fontSize:9, color:GOLD, fontWeight:900, textTransform:"uppercase", letterSpacing:0.5 }}>WINNER</span>
                      <span style={{ fontSize:10, color:GOLD, fontWeight:700 }}>Partner Voucher</span>
                      <span style={{ fontSize:10, color:CHAMPAGNE, fontWeight:900 }}>$100</span>
                      <span style={{ fontSize:8, color:`${GOLD}88`, marginTop:2 }}>#{t.id}</span>
                    </div>
                  );
                  if (isChecked) return (
                    <div key={i} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${BORDER}`, borderRadius:6, padding:"5px 10px", fontSize:11, color:TEXT3, fontFamily:"monospace", opacity:0.45, textDecoration:"line-through" }}>
                      #{t.id}
                    </div>
                  );
                  return (
                    <div key={i} style={{ background:NAVY4, border:`1px solid ${GOLD}33`, borderRadius:6, padding:"5px 10px", fontSize:11, color:GOLD, fontFamily:"monospace", fontWeight:700 }}>
                      #{t.id}
                    </div>
                  );
                })}
                {tier.bonusTiles > 40 && <div style={{ fontSize:11, color:TEXT3, alignSelf:"center" }}>+{tier.bonusTiles-40} more</div>}
              </div>
              <div style={{ marginTop:12, fontSize:11, color:TEXT3 }}>
                Tiles randomly allocated · Gold Bonus Draw · Same Saturday night as Monthly Millionaire
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Prize cabinet — vouchers only */}
            <div style={{ background:NAVY3, border:`1px solid ${GOLD}33`, borderRadius:16, padding:"18px 18px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${GOLD},#A9893F)`, borderRadius:2 }} />
                Prize Cabinet
              </div>
              <div style={{ background:NAVY4, borderRadius:10, padding:"14px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:24 }}>•</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>LMCT+ Partner Voucher</div>
                    <div style={{ fontSize:11, color:TEXT3 }}>$100 value each</div>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:11, color:TEXT3 }}>Won so far</div>
                  <div style={{ fontSize:18, fontWeight:900, color:vouchersWon>0?BLUE_BRIGHT:TEXT3, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>{vouchersWon.toLocaleString()} / 10,000</div>
                </div>
                <div style={{ height:4, background:NAVY3, borderRadius:2, marginTop:8, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(vouchersWon/10000)*100}%`, background:`linear-gradient(90deg,${GOLD},#C8A756)`, borderRadius:2 }} />
                </div>
                <div style={{ fontSize:11, color:TEXT3, marginTop:6, textAlign:"right" }}>{vouchersLeft.toLocaleString()} remaining</div>
              </div>
              <div style={{ marginTop:10, background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:8, padding:"8px 12px", fontSize:11, color:GOLD, textAlign:"center" }}>
                $1,000,000 in vouchers · Gold members only
              </div>
            </div>

            {/* Live winners */}
            <div style={{ background:NAVY3, border:`1px solid ${GOLD}33`, borderRadius:16, padding:"18px 18px", flex:1 }}>
              <div style={{ fontSize:11, fontWeight:700, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${GOLD},#A9893F)`, borderRadius:2 }} />
                Live Winners
                {winFeed.length > 0 && <span style={{ marginLeft:"auto", background:"rgba(255,215,0,0.15)", color:GOLD, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>{winFeed.length}</span>}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:TEXT3, marginBottom:10, padding:"6px 10px", background:NAVY4, borderRadius:8 }}>
                <span>• Vouchers won</span>
                <span style={{ color:vouchersWon>0?GOLD:TEXT3, fontWeight:700 }}>{vouchersWon.toLocaleString()} / 10,000</span>
              </div>
              {winFeed.length === 0 ? (
                <div style={{ textAlign:"center", padding:"16px 0", color:TEXT3, fontSize:12 }}>
                  {drawState==="idle" ? "Start the draw to see winners" : "Watching for winners..."}
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:400, overflowY:"auto" }}>
                  {winFeed.map((w,idx) => (
                    <div key={w.id} style={{ display:"flex", alignItems:"center", gap:8, borderLeft:`3px solid ${GOLD}`, background:NAVY4, borderRadius:"0 8px 8px 0", padding:"7px 10px", animation:idx===0?"feedSlide 0.2s ease-out":"none" }}>
                      <span style={{ fontSize:14 }}>•</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Partner Voucher · $100</div>
                        <div style={{ fontSize:10, color:TEXT3 }}>Gold #{w.member} · {w.state} · tile #{w.tile} · {w.ts}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
