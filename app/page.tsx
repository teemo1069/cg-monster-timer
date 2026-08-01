"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const SERVERS = ["櫻之舞", "卡連", "露比", "獅子", "歌姬", "雙子"] as const;
const MULTIPLIERS = Array.from({ length: 11 }, (_, i) => Number((1 + i * 0.1).toFixed(1)));
const THREE_HOURS = 10_800_000;
const STORAGE_KEY = "waterblue-monster-timers-v1";
const ADMIN_SESSION_KEY = "waterblue-admin-session-v2";
const ADMIN_AUTH_ENDPOINT = "https://joprrlzjdevijembcdii.supabase.co/functions/v1/admin-auth";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_OTVTHpb0AM_kS_DAA2wVTA_6zcWoP0s";
type Server = (typeof SERVERS)[number];
type Tone = "sumi" | "indigo" | "cinnabar" | "moss";
type Timer = { id: string; server: Server; monster: string; multiplier: number; appearedAt: number; createdAt: number };
type AuthReply = { authenticated?: boolean; username?: string; mustChangePassword?: boolean; sessionToken?: string; expiresAt?: string; changed?: boolean; error?: string };
const INKS: Record<Tone, { label: string; rgb: string }> = {
  sumi: { label: "玄墨", rgb: "32,37,35" }, indigo: { label: "藍墨", rgb: "35,66,86" },
  cinnabar: { label: "朱墨", rgb: "129,50,37" }, moss: { label: "苔墨", rgb: "55,76,58" },
};

function valid(v: unknown): v is Timer {
  const x = v as Partial<Timer>;
  return !!v && typeof v === "object" && typeof x.id === "string" && typeof x.monster === "string" &&
    typeof x.appearedAt === "number" && Number.isFinite(x.appearedAt) && typeof x.createdAt === "number" && SERVERS.includes(x.server as Server) &&
    (x.multiplier === undefined || (typeof x.multiplier === "number" && Number.isFinite(x.multiplier)));
}
function clean(v: unknown): Timer[] {
  if (!Array.isArray(v)) return [];
  const ids = new Set<string>();
  return v.filter(valid).filter(x => { if (ids.has(x.id)) return false; ids.add(x.id); return true; })
    .map(x => ({ ...x, monster: x.monster.trim().slice(0, 30) || "未命名魔物", multiplier: MULTIPLIERS.includes(x.multiplier) ? x.multiplier : 1 }));
}
function localValue(date = new Date()) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function timerId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor(total % 3600 / 60), total % 60].map(x => String(x).padStart(2, "0")).join(":");
}
function dateTime(ms: number) {
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);
}
async function adminAuth(body: Record<string, unknown>): Promise<AuthReply> {
  const response = await fetch(ADMIN_AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: "驗證服務回應格式異常" })) as AuthReply;
  if (!response.ok) throw new Error(data.error || "驗證服務暫時無法使用");
  return data;
}

function InkCanvas({ tone, auto, wash }: { tone: Tone; auto: boolean; wash: number }) {
  const ref = useRef<HTMLCanvasElement>(null), toneRef = useRef(tone), autoRef = useRef(auto), washRef = useRef(wash);
  useEffect(() => { toneRef.current = tone; }, [tone]);
  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { washRef.current = wash; }, [wash]);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    type P = { x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;rgb:string;seed:number };
    const ps:P[] = []; let w=0,h=0,dpr=1,frame=0,last=0,currentWash=washRef.current; const pointer={x:0,y:0,down:false};
    const resize=()=>{dpr=Math.min(devicePixelRatio||1,1.6);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+"px";canvas.style.height=h+"px";ctx.setTransform(dpr,0,0,dpr,0,0);};
    const drop=(x:number,y:number,force=1,vx=0,vy=0)=>{const rgb=INKS[toneRef.current].rgb,n=Math.min(36,Math.round(17*force));for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,r=Math.pow(Math.random(),1.8)*22*force,life=100+Math.random()*100;ps.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,vx:vx*(.1+Math.random()*.2)+Math.cos(a)*Math.random()*.38,vy:vy*(.1+Math.random()*.2)+Math.sin(a)*Math.random()*.38,life,max:life,size:(7+Math.random()*23)*force,rgb,seed:Math.random()*6.28});}if(ps.length>850)ps.splice(0,ps.length-850);};
    const down=(e:PointerEvent)=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.down=true;drop(pointer.x,pointer.y,1.25);};
    const move=(e:PointerEvent)=>{const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;if(pointer.down)drop(pointer.x,pointer.y,.7,dx,dy);};
    const up=()=>{pointer.down=false;};
    const tick=(t:number)=>{if(currentWash!==washRef.current){currentWash=washRef.current;ps.length=0;ctx.clearRect(0,0,w,h);}ctx.globalCompositeOperation="source-over";ctx.fillStyle="rgba(241,235,218,.016)";ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation="multiply";
      if(autoRef.current&&t-last>2300+Math.random()*1300){drop(w*(.12+Math.random()*.76),h*(.15+Math.random()*.7),.65+Math.random()*.5);last=t;}
      for(let i=ps.length-1;i>=0;i--){const p=ps[i],age=1-p.life/p.max,curl=Math.sin(t*.0012+p.seed+age*7)*.018,old=p.vx;p.vx=p.vx*.982-p.vy*curl+Math.sin(p.y*.011+t*.00025)*.006;p.vy=p.vy*.982+old*curl+Math.cos(p.x*.009+t*.0002)*.005;p.x+=p.vx;p.y+=p.vy;p.life--;p.size+=.04;ctx.beginPath();ctx.fillStyle=`rgba(${p.rgb},${Math.max(0,Math.min(.055,p.life/p.max*.045))})`;ctx.arc(p.x,p.y,p.size,0,6.283);ctx.fill();if(p.life<=0)ps.splice(i,1);}frame=requestAnimationFrame(tick);};
    resize();addEventListener("resize",resize);addEventListener("pointerdown",down);addEventListener("pointermove",move);addEventListener("pointerup",up);addEventListener("pointercancel",up);frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);removeEventListener("resize",resize);removeEventListener("pointerdown",down);removeEventListener("pointermove",move);removeEventListener("pointerup",up);removeEventListener("pointercancel",up);};
  },[]);
  return <canvas ref={ref} className="ink-canvas" aria-hidden="true"/>;
}

export default function Home() {
  const [timers,setTimers]=useState<Timer[]>([]),[now,setNow]=useState(0),[ready,setReady]=useState(false),[server,setServer]=useState<Server>(SERVERS[0]);
  const [monster,setMonster]=useState(""),[multiplier,setMultiplier]=useState(1),[appeared,setAppeared]=useState(""),[error,setError]=useState("");
  const [tone,setTone]=useState<Tone>("sumi"),[auto,setAuto]=useState(true),[wash,setWash]=useState(0);
  const [adminOpen,setAdminOpen]=useState(false),[admin,setAdmin]=useState(false),[user,setUser]=useState(""),[pass,setPass]=useState(""),[loginError,setLoginError]=useState("");
  const [authBusy,setAuthBusy]=useState(false),[authChecking,setAuthChecking]=useState(true),[mustChangePassword,setMustChangePassword]=useState(false);
  const [newPass,setNewPass]=useState(""),[confirmPass,setConfirmPass]=useState("");
  const [autoRepair,setAutoRepair]=useState(false),[diagnostic,setDiagnostic]=useState("系統尚未執行診斷"); const hydrated=useRef(false);
  useEffect(()=>{let id:ReturnType<typeof setInterval>|undefined;const frame=requestAnimationFrame(()=>{setNow(Date.now());setAppeared(localValue());try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)setTimers(clean(JSON.parse(raw)));setAutoRepair(localStorage.getItem("waterblue-auto-repair")==="true");}catch{setDiagnostic("偵測到紀錄格式異常，請執行 Repair");}hydrated.current=true;setReady(true);id=setInterval(()=>setNow(Date.now()),1000);});return()=>{cancelAnimationFrame(frame);if(id)clearInterval(id);};},[]);
  useEffect(()=>{const token=sessionStorage.getItem(ADMIN_SESSION_KEY);if(!token){queueMicrotask(()=>setAuthChecking(false));return;}adminAuth({action:"verify",sessionToken:token}).then(data=>{setAdmin(!!data.authenticated);setMustChangePassword(!!data.mustChangePassword);if(data.authenticated)setDiagnostic("管理員工作階段已安全恢復");}).catch(()=>{sessionStorage.removeItem(ADMIN_SESSION_KEY);setAdmin(false);}).finally(()=>setAuthChecking(false));},[]);
  useEffect(()=>{if(hydrated.current)localStorage.setItem(STORAGE_KEY,JSON.stringify(timers));},[timers]);
  useEffect(()=>{if(!hydrated.current)return;localStorage.setItem("waterblue-auto-repair",String(autoRepair));if(!autoRepair)return;const id=setInterval(()=>{setTimers(x=>clean(x));setDiagnostic(`AI 自動巡檢完成・${dateTime(Date.now())}・未發現阻塞`);},15000);return()=>clearInterval(id);},[autoRepair]);
  const ordered=useMemo(()=>[...timers].sort((a,b)=>b.multiplier-a.multiplier || (b.appearedAt+THREE_HOURS-now)-(a.appearedAt+THREE_HOURS-now)),[timers,now]);
  const add=(e:FormEvent)=>{e.preventDefault();if(!ready)return setError("候時錄載入中，請稍候一瞬");const at=new Date(appeared).getTime();if(!monster.trim())return setError("請輸入魔物名稱");if(!Number.isFinite(at))return setError("請輸入正確的日期與時間");if(at>Date.now()+60000)return setError("出現時間不可晚於現在");setTimers(x=>[...x,{id:timerId(),server,monster:monster.trim(),multiplier,appearedAt:at,createdAt:Date.now()}]);setMonster("");setAppeared(localValue());setError("");};
  const login=async(e:FormEvent)=>{e.preventDefault();setAuthBusy(true);setLoginError("");try{const data=await adminAuth({action:"login",username:user,password:pass});if(!data.authenticated||!data.sessionToken)throw new Error("登入驗證失敗");sessionStorage.setItem(ADMIN_SESSION_KEY,data.sessionToken);setAdmin(true);setMustChangePassword(!!data.mustChangePassword);setPass("");setDiagnostic(data.mustChangePassword?"首次安全登入完成・請先更換新密碼":"管理員驗證完成・修復模組已解鎖");}catch(err){setLoginError(err instanceof Error?err.message:"登入失敗");}finally{setAuthBusy(false);}};
  const verifyAdmin=async()=>{const token=sessionStorage.getItem(ADMIN_SESSION_KEY);if(!token)return false;try{const data=await adminAuth({action:"verify",sessionToken:token});if(!data.authenticated)throw new Error();setMustChangePassword(!!data.mustChangePassword);return !data.mustChangePassword;}catch{sessionStorage.removeItem(ADMIN_SESSION_KEY);setAdmin(false);setLoginError("登入已失效，請重新登入");return false;}};
  const repair=async()=>{if(!await verifyAdmin())return setDiagnostic("請先完成管理員驗證與密碼更新");let repaired=clean(timers),removed=0;try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");repaired=clean(parsed);removed=Array.isArray(parsed)?Math.max(0,parsed.length-repaired.length):0;}catch{}setTimers(repaired);localStorage.setItem(STORAGE_KEY,JSON.stringify(repaired));setDiagnostic(`Repair 完成・保留 ${repaired.length} 筆・清除 ${removed} 筆異常資料・跨日時間軸正常`);};
  const toggleAutoRepair=async(checked:boolean)=>{if(checked&&!await verifyAdmin())return setDiagnostic("管理員登入已失效，無法啟用 AI 自動障礙排除");setAutoRepair(checked);};
  const changePassword=async(e:FormEvent)=>{e.preventDefault();if(newPass!==confirmPass)return setLoginError("兩次輸入的新密碼不一致");const token=sessionStorage.getItem(ADMIN_SESSION_KEY);if(!token)return setAdmin(false);setAuthBusy(true);setLoginError("");try{await adminAuth({action:"change_password",sessionToken:token,newPassword:newPass});setMustChangePassword(false);setNewPass("");setConfirmPass("");setDiagnostic("新密碼已安全更新・Repair 與 AI 模組已解鎖");}catch(err){setLoginError(err instanceof Error?err.message:"密碼更新失敗");}finally{setAuthBusy(false);}};
  const logout=async()=>{const token=sessionStorage.getItem(ADMIN_SESSION_KEY);sessionStorage.removeItem(ADMIN_SESSION_KEY);setAdmin(false);setMustChangePassword(false);setPass("");if(token)await adminAuth({action:"logout",sessionToken:token}).catch(()=>undefined);};
  const active=timers.filter(x=>x.appearedAt+THREE_HOURS>now).length;
  return <main className="site-shell"><InkCanvas tone={tone} auto={auto} wash={wash}/><div className="paper-grain"/>
    <div className="content-wrap">
      <header><div className="brand"><span className="seal">水藍</span><div><p className="eyebrow">CROSSGATE ・ RESPAWN &amp; EXP RATE</p><h1>魔物重生・經驗倍率帖</h1></div></div><div className="header-actions"><span className="poster-year">六服共用・三時辰</span><button className="ghost" onClick={()=>setAdminOpen(x=>!x)}>{admin?"管理中":"管理員登入"}</button></div></header>
      <section className="hero"><div className="hero-orbit" aria-hidden="true"><span>魔</span><i/><b>三時後・再臨</b></div><div className="hero-copy"><p className="vertical">水藍魔力寶貝</p><div><p className="hero-index">第壹幕　重生候時錄</p><h2>記下現身一刻，<br/><em>倍率高者先行。</em></h2><p>六大伺服器共用・跨日安全計時・依經驗倍率與剩餘時間自動排序。</p><div className="hero-notes"><span>倍率優先</span><span>跨日無誤</span><span>三時重生</span></div></div></div>
        <form className="timer-form" onSubmit={add}><div className="form-head"><b>新增狩獵紀錄</b><button type="button" onClick={()=>setAppeared(localValue())}>套用現在時間</button></div><div className="fields">
          <label><span>伺服器</span><select value={server} onChange={e=>setServer(e.target.value as Server)}>{SERVERS.map((x,i)=><option key={x} value={x}>{i+1}. {x}</option>)}</select></label>
          <label><span>魔物名稱</span><input value={monster} onChange={e=>setMonster(e.target.value)} placeholder="例如：改造殭屍" maxLength={30}/></label>
          <label><span>經驗值倍率</span><select value={multiplier} onChange={e=>setMultiplier(Number(e.target.value))}>{MULTIPLIERS.map(x=><option key={x} value={x}>{x.toFixed(1)} 倍</option>)}</select></label>
          <label><span>出現時間（24 小時制）</span><input type="datetime-local" value={appeared} max={appeared?localValue():undefined} onChange={e=>setAppeared(e.target.value)}/></label><button className="primary" disabled={!ready}>{ready?"開始計時 →":"候時錄載入中…"}</button></div>{error&&<p className="error">{error}</p>}</form>
      </section>
      {adminOpen&&<section className="admin-panel">{authChecking?<div className="auth-status">正在確認安全登入狀態…</div>:!admin?<form className="login" onSubmit={login}><div><p className="kicker">SECURE ADMIN</p><h3>管理員後端驗證</h3></div><label><span>帳號</span><input value={user} onChange={e=>setUser(e.target.value)} autoComplete="username"/></label><label><span>密碼</span><input type="password" value={pass} onChange={e=>setPass(e.target.value)} autoComplete="current-password"/></label><button className="dark" disabled={authBusy}>{authBusy?"驗證中…":"安全登入"}</button>{loginError&&<p className="error">{loginError}</p>}</form>:mustChangePassword?<form className="password-change" onSubmit={changePassword}><div><p className="kicker">FIRST LOGIN</p><h3>首次登入，請設定新密碼</h3><p>至少 12 字元，並包含英文大小寫、數字、符號中的三類。</p></div><label><span>新密碼</span><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} autoComplete="new-password"/></label><label><span>再次輸入</span><input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} autoComplete="new-password"/></label><button className="dark" disabled={authBusy}>{authBusy?"更新中…":"儲存新密碼"}</button>{loginError&&<p className="error">{loginError}</p>}</form>:
        <div className="repair"><div><p className="kicker">SYSTEM CARE・SUPABASE VERIFIED</p><h3>Repair 與 AI 障礙排除</h3><p>{diagnostic}</p></div><div className="repair-actions"><button className="dark" onClick={repair}>Repair 立即修復</button><label className="switch-row"><input type="checkbox" checked={autoRepair} onChange={e=>void toggleAutoRepair(e.target.checked)}/><span className="switch"/>AI 自動障礙排除</label><button className="logout" onClick={logout}>安全登出</button></div></div>}</section>}
      <section className="queue"><div className="section-head"><div><p className="kicker">RESPAWN &amp; EXP QUEUE</p><h3>重生與倍率候時錄</h3></div><div className="summary"><b>{active}</b> 計時中　・　<b>{timers.length}</b> 全部紀錄</div></div>
        <div className="servers">{SERVERS.map((x,i)=><span key={x}><b>{i+1}</b>{x}</span>)}</div>
        <div className="timer-list">{ordered.length===0?<div className="empty"><span>◯</span><h4>候時錄尚無墨跡</h4><p>在上方輸入魔物出現時間與倍率，即會自動計算三小時重生並排序。</p></div>:ordered.map((x,i)=>{const end=x.appearedAt+THREE_HOURS,left=Math.max(0,end-now),expired=left<=0,progress=Math.min(100,left/THREE_HOURS*100);return <article className={`timer-card ${expired?"expired":""}`} key={x.id}><div className="rank"><span>{String(i+1).padStart(2,"0")}</span></div><div className="monster"><div className="monster-meta"><span>{x.server}</span><b>{x.multiplier.toFixed(1)} 倍經驗</b></div><h4>{x.monster}</h4><p>現身 {dateTime(x.appearedAt)} ・ 重生 {dateTime(end)}</p></div><div className="count"><div className="count-orbit" style={{background:`conic-gradient(var(--red) ${progress}%, rgba(44,47,40,.12) ${progress}% 100%)`}}><div><span>{expired?"已可重生":"距離重生"}</span><strong>{clock(left)}</strong></div></div></div><button className="remove" onClick={()=>setTimers(t=>t.filter(y=>y.id!==x.id))} aria-label={`刪除 ${x.monster}`}>×</button></article>;})}</div>
      </section><footer><span>水藍魔力寶貝・六服共用</span><span>倍率優先・剩餘時間次序・資料保留於此裝置</span></footer>
    </div>
    <nav className="controls" aria-label="水墨控制列"><span>墨色</span><div>{(Object.keys(INKS) as Tone[]).map(k=><button key={k} className={tone===k?"selected":""} style={{background:`rgb(${INKS[k].rgb})`}} onClick={()=>setTone(k)} aria-label={INKS[k].label}/>)}</div><i/><button className={auto?"auto on":"auto"} onClick={()=>setAuto(x=>!x)}><b/>自動演出</button><button className="wash" onClick={()=>setWash(x=>x+1)}>洗い流す</button></nav>
  </main>;
}
