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
const GOLD       = "#00F5A0";          // electric emerald accent for Gold tier — no muddy gold/brown
const CHAMPAGNE  = "#7CFFE1";          // luminous mint highlight
const STEEL      = "#9BADCA";
const BRONZE     = "#6FA8FF";          // cool blue-steel for Bronze tier to avoid brown/orange
const GREEN      = "#00F5A0";
const GREEN_DIM  = "rgba(0,245,160,0.10)";
const GREEN_BORDER = "rgba(0,245,160,0.30)";

const TIERS = {
  bronze: { name: "Bronze", price: 29.99,  weeklyTiles: 10,  monthlyTiles: 10,  bonusTiles: 0,  bonusAccess: false, poolPct: 30, color: BRONZE, accent: "#B9D0FF", glow: "rgba(111,168,255,0.18)" },
  silver: { name: "Silver", price: 59.99,  weeklyTiles: 40,  monthlyTiles: 40,  bonusTiles: 0,  bonusAccess: false, poolPct: 40, color: SILVER, accent: "#FFFFFF", glow: "rgba(200,216,232,0.2)" },
  gold:   { name: "Gold",   price: 109.99, weeklyTiles: 100, monthlyTiles: 100, bonusTiles: 40, bonusAccess: true,  poolPct: 50, color: GOLD,   accent: CHAMPAGNE, glow: "rgba(0,245,160,0.24)" },
};

// Bonus board tile allocation by tier
// Gold premium over Bronze ($80/mo) funds the bonus board pool
// Silver premium over Bronze ($30/mo) gets partial access
const BONUS_POOL_SOURCES = {
  goldPremium:   { perMember: 80,  members: 10000 },  // Gold $109.99 vs Bronze $29.99
  silverPremium: { perMember: 30,  members: 30000 },  // Silver $59.99 vs Bronze $29.99
};

const MEMBER_POOL = { bronze: 90000, silver: 50000, gold: 60000 }; // 90K Bronze · 50K Silver · 60K Gold
// DEMO: tiles capped at 500K for browser performance — real system uses full 8.9M
const ACTUAL_TILES = MEMBER_POOL.entry * 10 + MEMBER_POOL.premium * 40 + MEMBER_POOL.elite * 100; // 8.9M real
const TOTAL_TILES  = 10000;  // demo cap — smooth browser draw

// DEMO prizes — board runs ~3 min, dramatic pauses for big prizes, silent for vouchers
// Real monthly draw: $1M cash × 1, Cars × 50, Holidays × 100, Tech × 500, Vouchers × 10,000
const MONTHLY_PRIZES = [
  { name: "Millionaire Maker", value: 1000000, label: "$1,000,000 CASH",       qty: 1,  remaining: 1,  pause: 6000, color: GOLD,        emoji: "💰", isCash: true,    realQty: 1,     silent: false },
  { name: "Car Prize",         value: 0,       label: "Brand New Car",          qty: 3,  remaining: 3,  pause: 4000, color: BLUE,        emoji: "🏎️", isProduct: true, realQty: 50,    silent: false },
  { name: "Holiday Package",   value: 0,       label: "Holiday Package",        qty: 5,  remaining: 5,  pause: 3000, color: BLUE_BRIGHT, emoji: "✈️", isProduct: true, realQty: 100,   silent: false },
  { name: "Tech Bundle",       value: 0,       label: "Tech Bundle",            qty: 8,  remaining: 8,  pause: 2000, color: STEEL,   emoji: "💻", isProduct: true, realQty: 500,   silent: false },
  { name: "Partner Voucher",   value: 0,       label: "LMCT+ Partner Voucher",  qty: 30, remaining: 30, pause: 0,    color: BLUE_BRIGHT,   emoji: "🛒", isProduct: true, realQty: 10000, silent: true  },
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
    <img src="/prizetile-logo.png" alt="PrizeTile" style={{ height:44, width:"auto", objectFit:"contain" }} />
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
      <div style={{ background:`linear-gradient(135deg, rgba(0,245,160,0.08) 0%, rgba(73,217,255,0.05) 50%, transparent 100%)`, border:`2px solid ${GOLD}44`, borderRadius:24, padding:"48px 40px", textAlign:"center", position:"relative", overflow:"hidden" }}>
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
                <div style={{ background:"rgba(0,245,160,0.06)", border:`1px solid rgba(0,245,160,0.38)`, borderRadius:16, padding:"18px 24px", minWidth:90 }}>
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
            { emoji:"💰", label:"$1,000,000 Cash",   color:GOLD },
            { emoji:"🏎️", label:"50 Brand New Cars",  color:BLUE_BRIGHT },
            { emoji:"✈️", label:"100 Holidays",        color:BLUE_BRIGHT },
            { emoji:"💻", label:"500 Tech Bundles",    color:STEEL },
            { emoji:"🛒", label:"10,000 Vouchers",     color:BLUE_BRIGHT },
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
              { tier: "Bronze", price: "$29.99/mo", tiles: 10,  pct:30, color: BRONZE, glow: "rgba(111,168,255,0.18)",   tagline: "Get started", bonusAccess: false },
              { tier: "Silver", price: "$59.99/mo", tiles: 40,  pct:25, color: SILVER, glow: "rgba(200,216,232,0.12)", tagline: "4× more chances every draw", bonusAccess: false },
              { tier: "Gold",   price: "$109.99/mo",tiles: 100, pct:50, color: GOLD, glow: "rgba(0,245,160,0.16)",    tagline: "10× tiles + exclusive $1M Bonus Draw", bonusAccess: true },
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
                  { emoji: "💰", prize: "$1,000,000 Cash",         desc: "1 member becomes a millionaire — every month",   color: GOLD },
                  { emoji: "🏎️", prize: "Brand New Car",           desc: "50 winners — brand new car each",                color: BLUE },
                  { emoji: "✈️", prize: "Holiday Package",          desc: "100 winners — flights, accommodation & more",    color: BLUE_BRIGHT },
                  { emoji: "💻", prize: "Tech Bundle",              desc: "500 winners — latest tech gear",                 color: STEEL },
                  { emoji: "🛒", prize: "LMCT+ Partner Voucher",    desc: "10,000 winners every month",                    color: BLUE_BRIGHT },
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
            <div style={{ background: NAVY3, border: `2px solid rgba(0,245,160,0.28)`, borderRadius: 18, overflow: "hidden", boxShadow: "0 0 40px rgba(0,245,160,0.10)", gridColumn: "1 / -1" }}>
              <div style={{ background: "rgba(0,245,160,0.10)", borderBottom: "1px solid rgba(0,245,160,0.22)", padding: "18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize: 11, color: CHAMPAGNE, textTransform: "uppercase", letterSpacing: 2.5, fontWeight: 700, marginBottom: 4 }}>Every Month — Gold Members Only</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: TEXT, fontFamily: "'Arial Black',Arial,sans-serif", fontStyle: "italic" }}>$1,000,000 Gold Bonus Draw</div>
                  <div style={{ fontSize: 13, color: TEXT2, marginTop: 4 }}>10,000 LMCT+ Partner Vouchers — Gold members only. Included with your Gold subscription. No extra payment ever required.</div>
                </div>
                <div style={{ background:"rgba(0,245,160,0.12)", border:"1px solid rgba(0,245,160,0.25)", borderRadius:14, padding:"14px 28px", textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:10, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Prize Pool</div>
                  <div style={{ fontSize:32, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000</div>
                  <div style={{ fontSize:10, color:TEXT3, marginTop:2 }}>In prizes every month · Gold only</div>
                </div>
              </div>
              <div style={{ padding: "20px 28px" }}>
                {[
                  { emoji: "🛒", prize: "LMCT+ Partner Voucher", desc: "10,000 winners — $100 each · Gold members only", color: CHAMPAGNE },
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
              <div style={{ padding:"12px 28px", borderTop:`1px solid ${BORDER}`, display:"flex", alignItems:"center", gap:10, background:"rgba(0,245,160,0.05)" }}>
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
                <div style={{ position: "absolute", top: 0, right: 0, background: `linear-gradient(135deg, ${GREEN}, ${BLUE_BRIGHT})`, color: "#000", fontSize: 11, fontWeight: 900, padding: "6px 20px 6px 30px", clipPath: "polygon(16px 0,100% 0,100% 100%,0 100%)", fontFamily: "'Arial Black',Arial,sans-serif", letterSpacing: 1 }}>TOP TIER</div>
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
        <div style={{ background:"linear-gradient(135deg, rgba(11,99,255,0.10), rgba(0,245,160,0.055))", border:"1px solid rgba(73,217,255,0.28)", borderRadius:18, overflow:"hidden", marginBottom:24 }}>
          <div style={{ background:"linear-gradient(90deg, rgba(73,217,255,0.12), rgba(0,245,160,0.08))", borderBottom:"1px solid rgba(73,217,255,0.22)", padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:2.5, fontWeight:700, marginBottom:4 }}>Every Month — Gold Members Only</div>
              <div style={{ fontSize:22, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000 Gold Bonus Draw</div>
              <div style={{ fontSize:13, color:TEXT2, marginTop:4 }}>10,000 LMCT+ Partner Vouchers — Gold members only. Included with your Gold subscription. No extra payment ever required.</div>
            </div>
            <div style={{ background:"rgba(0,245,160,0.12)", border:"1px solid rgba(0,245,160,0.25)", borderRadius:14, padding:"14px 28px", textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:10, color:CHAMPAGNE, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Prize Pool</div>
              <div style={{ fontSize:28, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>$1,000,000</div>
              <div style={{ fontSize:10, color:TEXT3, marginTop:2 }}>Gold members only · every month</div>
            </div>
          </div>
          <div style={{ padding:"18px 28px", display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:32 }}>🛒</span>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:CHAMPAGNE, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>LMCT+ Partner Voucher</div>
              <div style={{ fontSize:13, color:TEXT3, marginTop:4 }}>10,000 winners — $100 each · Every Gold member has a meaningful chance of winning their membership back every month</div>
            </div>
          </div>
          <div style={{ padding:"12px 28px", borderTop:`1px solid ${BORDER}`, background:"rgba(0,245,160,0.05)", display:"flex", alignItems:"center", gap:10 }}>
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
                Each LMCT+ membership is linked to a verified identity. One account per person — no exceptions. Identity is verified at sign-up so prizes can be paid quickly to verified members.
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
              <div style={{ fontSize:16 }}>{t.prize.emoji || "🏆"}</div>
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
              <div style={{ fontSize:18, flexShrink:0 }}>{w.prize.emoji || "🏆"}</div>
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
  { id:"bronze", name:"Starter",  tiles:10,  price:9.99,  pricePerTile:"$1.00", color:SILVER, popular:false, desc:"A quick top-up" },
  { id:"silver", name:"Booster",  tiles:30,  price:24.99, pricePerTile:"$0.83", color:"#2B9FE8", popular:true,  desc:"Most popular choice" },
  { id:"gold",   name:"Power",    tiles:75,  price:49.99, pricePerTile:"$0.67", color:"#00BFFF", popular:false, desc:"Serious contender" },
  { id:"elite",   name:"Elite",    tiles:200, price:99.99, pricePerTile:"$0.50", color:GOLD, popular:false, desc:"Maximum tiles, minimum price per tile" },
];

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
            <span style={{ fontSize:14, flexShrink:0 }}>{w.prize.emoji||"🏆"}</span>
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
          0%,100%{ box-shadow:0 0 40px #00F5A088, 0 0 80px #00F5A044; }
          50%    { box-shadow:0 0 80px #00F5A0cc, 0 0 160px #8CEBFF66, 0 0 240px #00F5A033; }
        }
        @keyframes confettiDrop {
          0%  { transform:translateY(-20px) rotate(0deg); opacity:1; }
          100%{ transform:translateY(60px) rotate(360deg); opacity:0; }
        }
        @keyframes scanPulse  { 0%{opacity:0.1} 100%{opacity:0.35} }
        @keyframes feedSlide  { 0%{transform:translateY(-10px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes goldRain   { 0%,100%{text-shadow:0 0 20px #00F5A0} 50%{text-shadow:0 0 80px #00F5A0,0 0 140px #8CEBFF} }
        @keyframes shimmer    { 0%,100%{opacity:0.7} 50%{opacity:1} }
        @keyframes prizePop   { 0%{transform:scale(0.85);opacity:0} 55%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        /* Pokie-style tile spin — cycles through colours before landing */
        @keyframes tilePokie {
          0%  { background:#1A3A1A; transform:scaleY(1); }
          10% { background:#2B9FE8; transform:scaleY(0.1); }
          20% { background:#00F5A0; transform:scaleY(1); }
          30% { background:#FF4444; transform:scaleY(0.1); }
          40% { background:#2B9FE8; transform:scaleY(1); }
          50% { background:#49D9FF; transform:scaleY(0.1); }
          60% { background:#8CEBFF; transform:scaleY(1); }
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
          <button onClick={()=>onNav("bonus")} style={{ background:"rgba(0,245,160,0.06)", border:`1px solid rgba(0,245,160,0.38)`, borderRadius:8, padding:"8px 18px", color:GOLD, fontSize:14, fontWeight:700, cursor:"pointer" }}>★ Gold Bonus Draw</button>
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
              <div style={{ fontSize: isBig?56:40, animation:`${pa.tile.split(" ")[0]} ${isBig?"0.6s":"0.35s"} ease-out`, flexShrink:0, position:"relative", zIndex:1 }}>{currentPrize.emoji||"🏆"}</div>
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
                      <span style={{ fontSize:22 }}>{p.emoji||"🏆"}</span>
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
                  const prizeEmoji = hit?.prize?.emoji || "🏆";
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
  { name: "Jason M.",    state: "QLD", prize: "🏎️ Brand New Car",  tier: "Gold",   avatar: "🏆", color: GOLD },
  { name: "Priya S.",    state: "VIC", prize: "✈️ Holiday Package", tier: "Silver", avatar: "✈️", color: "#00BFFF" },
  { name: "Dave H.",     state: "NSW", prize: "✈️ Holiday Package", tier: "Gold",   avatar: "✈️", color: "#00BFFF" },
  { name: "Mel T.",      state: "WA",  prize: "✈️ Holiday Package", tier: "Silver", avatar: "💰", color: "#00BFFF" },
  { name: "Chris B.",    state: "SA",  prize: "✈️ Holiday Package", tier: "Bronze", avatar: "✈️", color: "#00BFFF" },
  { name: "Anh N.",      state: "VIC", prize: "✈️ Holiday Package", tier: "Gold",   avatar: "💰", color: "#00BFFF" },
  { name: "Rebecca F.",  state: "QLD", prize: "💻 Tech Bundle",     tier: "Silver", avatar: "💰", color: "#2B9FE8" },
  { name: "Marcus T.",   state: "QLD", prize: "💻 Tech Bundle",     tier: "Bronze", avatar: "🏎️", color: "#2B9FE8" },
  { name: "Jess L.",     state: "WA",  prize: "💻 Tech Bundle",     tier: "Silver", avatar: "💰", color: "#2B9FE8" },
  { name: "Daniel P.",   state: "SA",  prize: "💻 Tech Bundle",     tier: "Entry",  avatar: "💻", color: "#2B9FE8" },
  { name: "Sarah K.",    state: "NSW", prize: "💻 Tech Bundle",     tier: "Gold",   avatar: "💰", color: "#2B9FE8" },
  { name: "Tom W.",      state: "VIC", prize: "💻 Tech Bundle",     tier: "Silver", avatar: "✈️", color: "#2B9FE8" },
  { name: "Amy R.",      state: "NSW", prize: "💻 Tech Bundle",     tier: "Gold",   avatar: "✈️", color: "#2B9FE8" },
  { name: "Ben K.",      state: "QLD", prize: "💻 Tech Bundle",     tier: "Bronze", avatar: "💰", color: "#2B9FE8" },
  { name: "Lisa M.",     state: "VIC", prize: "💻 Tech Bundle",     tier: "Silver", avatar: "✈️", color: "#2B9FE8" },
  { name: "Ryan O.",     state: "SA",  prize: "💻 Tech Bundle",     tier: "Gold",   avatar: "🏆", color: "#2B9FE8" },
  { name: "Chloe T.",    state: "WA",  prize: "💻 Tech Bundle",     tier: "Silver", avatar: "💰", color: "#2B9FE8" },
  { name: "Noah P.",     state: "NSW", prize: "💻 Tech Bundle",     tier: "Bronze", avatar: "💰", color: "#2B9FE8" },
  { name: "Emma S.",     state: "VIC", prize: "💻 Tech Bundle",     tier: "Silver", avatar: "🏎️", color: "#2B9FE8" },
  { name: "Jack H.",     state: "QLD", prize: "💻 Tech Bundle",     tier: "Gold",   avatar: "💰", color: "#2B9FE8" },
  { name: "Mia C.",      state: "SA",  prize: "💻 Tech Bundle",     tier: "Bronze", avatar: "💻", color: "#2B9FE8" },
  { name: "Liam B.",     state: "WA",  prize: "💻 Tech Bundle",     tier: "Silver", avatar: "✈️", color: "#2B9FE8" },
  { name: "Olivia F.",   state: "NSW", prize: "💻 Tech Bundle",     tier: "Gold",   avatar: "💰", color: "#2B9FE8" },
  { name: "Ethan G.",    state: "VIC", prize: "💻 Tech Bundle",     tier: "Bronze", avatar: "✈️", color: "#2B9FE8" },
  { name: "Sophie N.",   state: "QLD", prize: "💻 Tech Bundle",     tier: "Silver", avatar: "💰", color: "#2B9FE8" },
  { name: "Lucas D.",    state: "SA",  prize: "💻 Tech Bundle",     tier: "Gold",   avatar: "✈️", color: "#2B9FE8" },
];

// Millionaire draw: 1×$1M + 5×$100K + 20×$25K = 26 major prize winners
const MILLIONAIRE_RECENT = [
  { name: "Adrian P.",   state: "VIC", prize: "◆ $1,000,000",  tier: "Gold",   avatar: "💰", color: GOLD },
  { name: "Sharon W.",   state: "NSW", prize: "🏎️ Brand New Car",    tier: "Gold",   avatar: "🏆", color: "#2B9FE8" },
  { name: "Benny K.",    state: "QLD", prize: "🏎️ Brand New Car",    tier: "Silver", avatar: "✈️", color: "#2B9FE8" },
  { name: "Tran L.",     state: "WA",  prize: "🏎️ Brand New Car",    tier: "Gold",   avatar: "✈️", color: "#2B9FE8" },
  { name: "Kerrie M.",   state: "SA",  prize: "🏎️ Brand New Car",    tier: "Gold",   avatar: "💰", color: "#2B9FE8" },
  { name: "Raj P.",      state: "VIC", prize: "🏎️ Brand New Car",    tier: "Silver", avatar: "✈️", color: "#2B9FE8" },
  { name: "Amy F.",      state: "NSW", prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "💰", color: "#00BFFF" },
  { name: "Tom R.",      state: "VIC", prize: "✈️ Holiday Package",     tier: "Silver", avatar: "💰", color: "#00BFFF" },
  { name: "Jess O.",     state: "QLD", prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "🏎️", color: "#00BFFF" },
  { name: "Mike B.",     state: "WA",  prize: "✈️ Holiday Package",     tier: "Bronze", avatar: "💰", color: "#00BFFF" },
  { name: "Sara N.",     state: "SA",  prize: "✈️ Holiday Package",     tier: "Silver", avatar: "💻", color: "#00BFFF" },
  { name: "Dan C.",      state: "NSW", prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "✈️", color: "#00BFFF" },
  { name: "Lisa H.",     state: "VIC", prize: "✈️ Holiday Package",     tier: "Silver", avatar: "💰", color: "#00BFFF" },
  { name: "Ryan M.",     state: "QLD", prize: "✈️ Holiday Package",     tier: "Bronze", avatar: "✈️", color: "#00BFFF" },
  { name: "Chloe K.",    state: "WA",  prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "💰", color: "#00BFFF" },
  { name: "Noah T.",     state: "SA",  prize: "✈️ Holiday Package",     tier: "Silver", avatar: "✈️", color: "#00BFFF" },
  { name: "Emma P.",     state: "NSW", prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "🏆", color: "#00BFFF" },
  { name: "Jack S.",     state: "VIC", prize: "✈️ Holiday Package",     tier: "Bronze", avatar: "💰", color: "#00BFFF" },
  { name: "Mia L.",      state: "QLD", prize: "✈️ Holiday Package",     tier: "Silver", avatar: "💰", color: "#00BFFF" },
  { name: "Liam W.",     state: "WA",  prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "🏎️", color: "#00BFFF" },
  { name: "Olivia G.",   state: "SA",  prize: "✈️ Holiday Package",     tier: "Bronze", avatar: "💰", color: "#00BFFF" },
  { name: "Ethan F.",    state: "NSW", prize: "✈️ Holiday Package",     tier: "Silver", avatar: "💻", color: "#00BFFF" },
  { name: "Sophie B.",   state: "VIC", prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "✈️", color: "#00BFFF" },
  { name: "Lucas R.",    state: "QLD", prize: "✈️ Holiday Package",     tier: "Bronze", avatar: "💰", color: "#00BFFF" },
  { name: "Hannah C.",   state: "WA",  prize: "✈️ Holiday Package",     tier: "Silver", avatar: "✈️", color: "#00BFFF" },
  { name: "Oscar N.",    state: "SA",  prize: "✈️ Holiday Package",     tier: "Gold",   avatar: "💰", color: "#00BFFF" },
];

const MILLIONAIRE_WINNERS = [
  { name: "Adrian P.",   state: "VIC", amount: "$1,000,000", draw: "Millionaire Draw #012", date: "April 2025",    tier: "Gold",   avatar: "💰", story: "Gold member for 8 months. 100 tiles on the board." },
  { name: "Sharon W.",   state: "NSW", amount: "$1,000,000", draw: "Millionaire Draw #011", date: "March 2025",   tier: "Gold",   avatar: "🏆", story: "Joined on a whim. Won on her first monthly draw." },
  { name: "Benny K.",    state: "QLD", amount: "$1,000,000", draw: "Millionaire Draw #010", date: "February 2025",tier: "Silver", avatar: "✈️", story: "Silver member. Tile #1,847,203 hit the jackpot." },
  { name: "Tran L.",     state: "WA",  amount: "$1,000,000", draw: "Millionaire Draw #009", date: "January 2025", tier: "Gold",   avatar: "✈️", story: "Watched it live on his phone. Couldn't believe it." },
  { name: "Kerrie M.",   state: "SA",  amount: "$1,000,000", draw: "Millionaire Draw #008", date: "December 2024",tier: "Gold",   avatar: "💰", story: "Loyal Gold member since launch. Long time coming." },
  { name: "Raj P.",      state: "VIC", amount: "$1,000,000", draw: "Millionaire Draw #007", date: "November 2024",tier: "Silver", avatar: "✈️", story: "Never missed a monthly draw. Number finally came up." },
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
          <div style={{ flex:1, background:"rgba(0,245,160,0.06)", border:`2px solid ${GOLD}66`, borderRadius:12, padding:"14px 20px" }}>
            <div style={{ fontSize:10, color:GOLD, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:4 }}>Every Month — Saturday Night</div>
            <div style={{ fontSize:16, fontWeight:900, color:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>Monthly Millionaire Draw</div>
            <div style={{ fontSize:12, color:TEXT3, marginTop:2 }}>50 cars · 100 holidays · $1,000,000 cash · 10,000+ winners</div>
          </div>
        </div>

        {/* Winners list — scrollable, all 26 major prizes, no petrol */}
        <div style={{ marginBottom:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ width:3, height:20, background: drawTab==="millionaire"?`linear-gradient(${BLUE_BRIGHT},${GOLD})`:`linear-gradient(${BLUE_BRIGHT},${BLUE})`, borderRadius:2 }} />
            <div>
              <div style={{ fontSize:17, fontWeight:900, color: drawTab==="millionaire"?GOLD:TEXT, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase" }}>{drawLabel}</div>
              <div style={{ fontSize:12, color:TEXT3, marginTop:2 }}>{drawDate} — Major prize winners only</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:520, overflowY:"auto", paddingRight:4 }}>
            {winners.map((w, i) => (
              <div key={i} style={{ background:NAVY3, border:`1px solid ${i===0&&drawTab==="millionaire"?GOLD+"44":BORDER}`, borderRadius:12, padding:"13px 20px", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background: i===0&&drawTab==="millionaire"?"rgba(0,245,160,0.14)":BLUE_DIM, border:`1.5px solid ${i===0&&drawTab==="millionaire"?GOLD+"66":BLUE_BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{w.avatar}</div>
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
            <div style={{ width:3, height:20, background:`linear-gradient(${GOLD}, #19B7FF)`, borderRadius:2 }} />
            <div>
              <div style={{ fontSize:18, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", textTransform:"uppercase" }}>◆ Millionaire Hall of Fame</div>
              <div style={{ fontSize:12, color:TEXT3, marginTop:2 }}>One $1,000,000 cash winner every month — from a $5,000,000 prize event</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:16 }}>
            {MILLIONAIRE_WINNERS.map((w, i) => (
              <div key={i} style={{ background: i===0 ? "rgba(0,245,160,0.06)" : NAVY3, border:`${i===0?"2px":"1px"} solid ${i===0?GOLD+"55":BORDER}`, borderRadius:18, padding:"24px 22px", position:"relative", overflow:"hidden" }}>
                {i === 0 && (
                  <div style={{ position:"absolute", top:0, right:0, background:GOLD, color:"#000", fontSize:9, fontWeight:900, padding:"5px 14px 5px 20px", clipPath:"polygon(12px 0,100% 0,100% 100%,0 100%)", letterSpacing:1 }}>MOST RECENT</div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ width:52, height:52, borderRadius:"50%", background: i===0?"rgba(0,245,160,0.14)":BLUE_DIM, border:`2px solid ${i===0?GOLD+"66":BLUE_BORDER}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{w.avatar}</div>
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

function BonusDraw({ onNav, profile, onDrawStateChange }) {
  const tier = TIERS[profile?.tier] || TIERS.gold;

  // Stable bonus tile IDs — generated once on mount, never change
  const makeBonusTiles = () =>
    tier.bonusAccess
      ? Array.from({ length: tier.bonusTiles }, (_, i) => ({
          id: `B${String(Math.floor(Math.random() * 999999) + 1).padStart(6,"0")}`,
          status: i === 2 ? "win" : i < 8 ? "checked" : "pending",
        }))
      : [];
  const [myBonusTiles, setMyBonusTiles] = useState(makeBonusTiles);

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
    // Reset member tiles — fresh tile IDs and statuses for new draw
    setMyBonusTiles(makeBonusTiles());
  }, [tier.bonusTiles]);

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
      <div style={{ background:`radial-gradient(ellipse at 50% 0%, #08213D 0%, #050912 70%)`, minHeight:"100vh", color:TEXT, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center", maxWidth:480, padding:40 }}>
          <div style={{ fontSize:48, marginBottom:20 }}>★</div>
          <div style={{ fontSize:28, fontWeight:900, color:GOLD, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", marginBottom:16 }}>Gold Members Only</div>
          <div style={{ fontSize:16, color:TEXT2, marginBottom:32, lineHeight:1.7 }}>The $1,000,000 Gold Bonus Draw is exclusive to Gold members. Upgrade to Gold to access 40 bonus tiles and compete in 10,000 vouchers given away every month.</div>
          <button onClick={() => onNav("tiers")} style={{ background:`linear-gradient(135deg,${BLUE_BRIGHT},${GOLD})`, border:"none", borderRadius:12, padding:"16px 40px", color:"#000", fontWeight:900, fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic", fontSize:18, cursor:"pointer" }}>
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
    <div style={{ background:`radial-gradient(ellipse at 50% 0%, #08213D 0%, #050912 70%)`, minHeight:"100vh", color:TEXT }}>
      <style>{`@keyframes bonusGlow { 0%,100%{box-shadow:0 0 20px ${GOLD}44} 50%{box-shadow:0 0 50px ${GOLD}88,0 0 80px ${GOLD}44} }`}</style>

      {/* Sub-nav */}
      <div style={{ background:"rgba(10,15,30,0.95)", backdropFilter:"blur(12px)", borderBottom:`1px solid ${BLUE_BORDER}`, padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <button onClick={() => onNav("draw")} style={{ background:"transparent", border:`1px solid ${BORDER2}`, borderRadius:6, padding:"6px 14px", color:TEXT2, cursor:"pointer", fontSize:13 }}>← Main Draw</button>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(0,245,160,0.06)", border:`1px solid rgba(0,245,160,0.38)`, borderRadius:20, padding:"6px 16px" }}>
          <span style={{ fontSize:14 }}>★</span>
          <span style={{ fontSize:13, color:GOLD, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5 }}>$1M Gold Bonus Draw</span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(73,217,255,0.08)", border:"1px solid rgba(73,217,255,0.18)", borderRadius:20, padding:"4px 12px" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:BLUE_BRIGHT, animation:"livePulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize:12, color:BLUE_BRIGHT, fontWeight:700 }}>{liveViewers.toLocaleString()} watching</span>
          </div>
          <span style={{ fontSize:11, color:TEXT3, textTransform:"uppercase", letterSpacing:1.5 }}>Board #{String(boardNum).padStart(3,"0")}</span>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:drawState==="paused"?"rgba(0,245,160,0.14)":BLUE_DIM, border:`1px solid ${drawState==="paused"?`${GOLD}44`:BLUE_BORDER}`, borderRadius:20, padding:"4px 14px" }}>
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
            <div key={s.label} style={{ background:NAVY3, border:`1px solid rgba(73,217,255,0.18)`, borderRadius:12, padding:"14px 16px" }}>
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
            <div style={{ background:NAVY3, border:`1px solid rgba(73,217,255,0.18)`, borderRadius:12, padding:"14px 20px", marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:12, color:TEXT3 }}>Gold Bonus Draw in Progress</span>
                  {vouchersWon > 0 && (
                    <div style={{ background:`${GOLD}22`, border:`1px solid rgba(0,245,160,0.38)`, borderRadius:20, padding:"3px 12px", display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:14 }}>🛒</span>
                      <span style={{ fontSize:13, color:GOLD, fontWeight:900 }}>{vouchersWon.toLocaleString()} vouchers won</span>
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ background:"rgba(0,245,160,0.075)", border:`1px solid rgba(0,245,160,0.38)`, borderRadius:10, padding:"2px 8px", fontSize:10, color:GOLD, fontWeight:700 }}>DEMO MODE</span>
                  <span style={{ color:TEXT3, fontSize:12 }}>{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div style={{ height:5, background:NAVY4, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:pct+"%", background:`linear-gradient(90deg,${BLUE_BRIGHT},${GOLD},${BLUE})`, borderRadius:3, transition:"width 0.2s", boxShadow:`0 0 8px ${GOLD}88` }} />
              </div>
            </div>

            {/* Grid */}
            <div style={{ background:"#030913", border:`1px solid rgba(73,217,255,0.18)`, borderRadius:16, padding:14, marginBottom:14, position:"relative", overflow:"hidden" }}>
              {drawState==="running" && (
                <div style={{ position:"absolute", left:14, right:14, height:`${100/GRID_ROWS}%`, top:`calc(14px + ${scanLine}*(${100/GRID_ROWS}%))`, background:`linear-gradient(180deg,transparent,rgba(73,217,255,0.24),rgba(0,245,160,0.12),transparent)`, pointerEvents:"none", zIndex:2 }} />
              )}
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${GRID_COLS},1fr)`, gap:2.5, position:"relative", zIndex:1 }}>
                {grid.map((cell,i) => {
                  const isPrize = cell.state==="prize";
                  const isEmpty = cell.state==="empty";
                  const isRunning = drawState==="running" || drawState==="paused";
                  return (
                    <div key={i} style={{
                      aspectRatio:"1", borderRadius:2,
                      background: isPrize ? GOLD : isEmpty ? "#03070F" : "#0B1626",
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
                <button onClick={() => drawState==="done" ? resetDraw() : runDraw()} style={{ background:`linear-gradient(135deg,${BLUE_BRIGHT},${GOLD})`, border:"none", borderRadius:8, padding:"14px 36px", color:"#000", fontWeight:900, fontSize:16, cursor:"pointer", fontFamily:"'Arial Black',Arial,sans-serif", fontStyle:"italic" }}>
                  {drawState==="done" ? "⟳ NEW DRAW" : "★ START GOLD BONUS DRAW"}
                </button>
              ) : (
                <button onClick={stopDraw} style={{ background:"transparent", color:"#FF6060", border:"2px solid #FF606044", borderRadius:8, padding:"14px 32px", fontWeight:700, fontSize:15, cursor:"pointer" }}>■ Stop</button>
              )}
              <button onClick={() => { simulateWin(); setDemoPickerOpen(false); }} style={{ background:"rgba(0,245,160,0.075)", color:GOLD, border:`1px solid rgba(0,245,160,0.38)`, borderRadius:8, padding:"14px 22px", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                ✦ DEMO: TRIGGER WIN
              </button>
              {drawState !== "idle" && <button onClick={resetDraw} style={{ background:"transparent", color:TEXT2, border:`1px solid ${BORDER}`, borderRadius:8, padding:"14px 24px", fontSize:15, cursor:"pointer" }}>Reset</button>}
            </div>

            {/* Demo note */}
            <div style={{ background:"rgba(0,245,160,0.04)", border:`1px solid rgba(73,217,255,0.22)`, borderRadius:10, padding:"10px 16px", marginBottom:14, display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:14 }}>ℹ️</span>
              <div style={{ fontSize:11, color:TEXT3 }}>
                <strong style={{color:TEXT2}}>Demo mode</strong> — showing 100 voucher winners (~1 min). 
                Real Gold Bonus Draw: 10,000 LMCT+ Partner Vouchers given away. Runs server-side.
              </div>
            </div>

            {/* My bonus tiles */}
            <div style={{ background:NAVY3, border:`1px solid rgba(73,217,255,0.22)`, borderRadius:14, padding:"18px 20px" }}>
              <div style={{ fontSize:11, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${BLUE_BRIGHT},${GOLD})`, borderRadius:2 }} />
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
                    <div key={i} style={{ background:NAVY4, border:`1px solid rgba(73,217,255,0.22)`, borderRadius:6, padding:"5px 10px", fontSize:11, color:GOLD, fontFamily:"monospace", fontWeight:700 }}>
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
            <div style={{ background:NAVY3, border:`1px solid rgba(73,217,255,0.22)`, borderRadius:16, padding:"18px 18px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${BLUE_BRIGHT},${GOLD})`, borderRadius:2 }} />
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
                  <div style={{ height:"100%", width:`${(vouchersWon/10000)*100}%`, background:`linear-gradient(90deg,${BLUE_BRIGHT},${GOLD},${BLUE})`, borderRadius:2 }} />
                </div>
                <div style={{ fontSize:11, color:TEXT3, marginTop:6, textAlign:"right" }}>{vouchersLeft.toLocaleString()} remaining</div>
              </div>
              <div style={{ marginTop:10, background:BLUE_DIM, border:`1px solid ${BLUE_BORDER}`, borderRadius:8, padding:"8px 12px", fontSize:11, color:GOLD, textAlign:"center" }}>
                $1,000,000 in vouchers · Gold members only
              </div>
            </div>

            {/* Live winners */}
            <div style={{ background:NAVY3, border:`1px solid rgba(73,217,255,0.22)`, borderRadius:16, padding:"18px 18px", flex:1 }}>
              <div style={{ fontSize:11, fontWeight:700, color:GOLD, textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:3, height:14, background:`linear-gradient(${BLUE_BRIGHT},${GOLD})`, borderRadius:2 }} />
                Live Winners
                {winFeed.length > 0 && <span style={{ marginLeft:"auto", background:"rgba(0,245,160,0.10)", color:GOLD, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>{winFeed.length}</span>}
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
                      <span style={{ fontSize:14 }}>🛒</span>
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
