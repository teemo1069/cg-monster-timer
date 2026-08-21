"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MAX_STORAGE_CHARS,
  MAX_TIMERS,
  MULTIPLIERS,
  SERVERS,
  isSafeTimestamp,
  sanitizeMonster,
  sanitizeTimers,
  type Server,
  type Timer,
} from "./timer-data";

const THREE_HOURS = 10_800_000;
const STORAGE_KEY = "waterblue-monster-timers-v1";
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-TW", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function localValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function timerId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function dateTime(ms: number) {
  if (!isSafeTimestamp(ms)) return "時間異常";
  try {
    return DATE_TIME_FORMATTER.format(ms);
  } catch {
    return "時間異常";
  }
}

function readStoredTimers() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { timers: [] as Timer[], received: 0 };
  if (raw.length > MAX_STORAGE_CHARS) throw new Error("stored_data_too_large");

  const parsed: unknown = JSON.parse(raw);
  return {
    timers: sanitizeTimers(parsed),
    received: Array.isArray(parsed) ? parsed.length : 0,
  };
}

export default function Home() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [server, setServer] = useState<Server>(SERVERS[0]);
  const [monster, setMonster] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [appeared, setAppeared] = useState("");
  const [error, setError] = useState("");
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [autoRepair, setAutoRepair] = useState(false);
  const [diagnostic, setDiagnostic] = useState("系統尚未執行診斷");
  const hydrated = useRef(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const frame = requestAnimationFrame(() => {
      setNow(Date.now());
      setAppeared(localValue());
      try {
        setTimers(readStoredTimers().timers);
      } catch {
        setDiagnostic("偵測到過大或異常的本機紀錄，請執行修復");
      }
      hydrated.current = true;
      setReady(true);
      interval = setInterval(() => setNow(Date.now()), 1000);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    } catch {
      queueMicrotask(() => setDiagnostic("瀏覽器儲存空間不足，最新變更無法保存"));
    }
  }, [timers]);

  useEffect(() => {
    if (!hydrated.current || !autoRepair) return;
    const interval = setInterval(() => {
      setTimers((current) => sanitizeTimers(current));
      setDiagnostic(`自動檢查完成・${dateTime(Date.now())}・未發現異常`);
    }, 15_000);
    return () => clearInterval(interval);
  }, [autoRepair]);

  const ordered = useMemo(
    () =>
      [...timers].sort(
        (a, b) =>
          b.multiplier - a.multiplier ||
          b.appearedAt + THREE_HOURS - now - (a.appearedAt + THREE_HOURS - now),
      ),
    [timers, now],
  );

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return setError("候時錄載入中，請稍候一瞬");
    if (timers.length >= MAX_TIMERS) return setError(`最多保留 ${MAX_TIMERS} 筆計時紀錄`);

    const safeMonster = sanitizeMonster(monster);
    const appearedAt = new Date(appeared).getTime();
    if (!safeMonster) return setError("請輸入魔物名稱");
    if (!isSafeTimestamp(appearedAt)) return setError("請輸入正確的日期與時間");
    if (appearedAt > Date.now() + 60_000) return setError("出現時間不可晚於現在");

    setTimers((current) =>
      sanitizeTimers([
        ...current,
        {
          id: timerId(),
          server,
          monster: safeMonster,
          multiplier,
          appearedAt,
          createdAt: Date.now(),
        },
      ]),
    );
    setMonster("");
    setAppeared(localValue());
    setError("");
  };

  const repair = () => {
    try {
      const stored = readStoredTimers();
      const removed = Math.max(0, stored.received - stored.timers.length);
      setTimers(stored.timers);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.timers));
      setDiagnostic(`修復完成・保留 ${stored.timers.length} 筆・清除 ${removed} 筆異常資料`);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setTimers([]);
      setDiagnostic("已清除無法安全讀取的異常紀錄");
    }
  };

  const active = timers.filter((timer) => timer.appearedAt + THREE_HOURS > now).length;

  return (
    <main className="site-shell">
      <div className="paper-grain" />
      <div className="content-wrap">
        <header className="masthead">
          <div className="brand">
            <span className="brand-seal">水藍</span>
            <b>魔力寶貝</b>
          </div>
          <button
            className="ghost"
            type="button"
            aria-expanded={maintenanceOpen}
            aria-controls="maintenance-panel"
            onClick={() => setMaintenanceOpen((current) => !current)}
          >
            資料修復
          </button>
        </header>

        <section className="hero">
          <div className="poster-stage">
            <div
              className="poster-current"
              role="img"
              aria-label="短身冒險者對抗骷髏、喪屍與幽靈的復古城鎮海報"
            />
            <div className="hero-copy">
              <h1>
                魔物重生
                <br />
                計時器
              </h1>
            </div>
          </div>

          <form className="timer-form" onSubmit={add}>
            <div className="form-head">
              <b>登錄魔物</b>
              <button type="button" onClick={() => setAppeared(localValue())}>
                填入現在時間
              </button>
            </div>
            <div className="fields">
              <label>
                <span>伺服器</span>
                <select value={server} onChange={(event) => setServer(event.target.value as Server)}>
                  {SERVERS.map((item, index) => (
                    <option key={item} value={item}>
                      {index + 1}. {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>魔物名稱</span>
                <input
                  value={monster}
                  onChange={(event) => setMonster(event.target.value)}
                  placeholder="例如：大象"
                  maxLength={30}
                />
              </label>
              <label>
                <span>經驗值倍率</span>
                <select
                  value={multiplier}
                  onChange={(event) => setMultiplier(Number(event.target.value))}
                >
                  {MULTIPLIERS.map((item) => (
                    <option key={item} value={item}>
                      {item.toFixed(2)} 倍
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>出現時間</span>
                <input
                  type="datetime-local"
                  value={appeared}
                  min="2000-01-01T00:00"
                  max={appeared ? localValue() : undefined}
                  onChange={(event) => setAppeared(event.target.value)}
                />
              </label>
              <button className="primary" disabled={!ready}>
                {ready ? "開始\n倒數" : "載入中"}
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>

        {maintenanceOpen && (
          <section className="admin-panel" id="maintenance-panel">
            <div className="repair">
              <div>
                <p className="kicker">LOCAL DATA</p>
                <h3>本機資料修復</h3>
                <p aria-live="polite">{diagnostic}</p>
                <p>所有計時紀錄只保存在這台裝置，不會上傳。</p>
              </div>
              <div className="repair-actions">
                <button className="dark" type="button" onClick={repair}>
                  立即修復
                </button>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={autoRepair}
                    onChange={(event) => setAutoRepair(event.target.checked)}
                  />
                  <span className="switch" />
                  自動檢查
                </label>
                <button
                  className="logout"
                  type="button"
                  onClick={() => {
                    setAutoRepair(false);
                    setMaintenanceOpen(false);
                  }}
                >
                  關閉
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="queue">
          <div className="section-head">
            <h3>重生候時錄</h3>
            <div className="summary">
              <span>
                <b>{active}</b> 計時中
              </span>
              <i />
              <span>
                <b>{timers.length}</b> 全部
              </span>
            </div>
          </div>

          <div className="queue-layout">
            <div className="servers">
              {SERVERS.map((item, index) => (
                <span key={item}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  {item}
                </span>
              ))}
            </div>

            <div className="timer-list">
              {ordered.length === 0 ? (
                <div className="empty">
                  <span>空</span>
                  <h4>尚無狩獵紀錄</h4>
                  <p>輸入魔物出現時間，三小時重生倒數便會在此展開。</p>
                </div>
              ) : (
                ordered.map((timer, index) => {
                  const end = timer.appearedAt + THREE_HOURS;
                  const left = Math.max(0, end - now);
                  const expired = left <= 0;
                  const progress = Math.min(100, (left / THREE_HOURS) * 100);

                  return (
                    <article
                      className={`timer-card ${expired ? "expired" : ""}`}
                      key={timer.id}
                      style={{ "--progress": `${progress}%` } as CSSProperties}
                    >
                      <div className="card-top">
                        <div className="rank">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="monster-meta">
                          <span>{timer.server}</span>
                          <b>{timer.multiplier.toFixed(2)} 倍經驗</b>
                        </div>
                        <button
                          className="remove"
                          type="button"
                          onClick={() =>
                            setTimers((current) => current.filter((item) => item.id !== timer.id))
                          }
                          aria-label={`刪除 ${timer.monster}`}
                        >
                          ×
                        </button>
                      </div>
                      <div className="card-body">
                        <div className="monster">
                          <h4>{timer.monster}</h4>
                          <p>
                            <span>現身</span>
                            {dateTime(timer.appearedAt)}
                          </p>
                          <p>
                            <span>重生</span>
                            {dateTime(end)}
                          </p>
                        </div>
                        <div className="count">
                          <div className="count-orbit">
                            <div>
                              <span>{expired ? "已可重生" : "距離重生"}</span>
                              <strong>{clock(left)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
