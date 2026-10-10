import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { MedicineStore } from "./infrastructure/medicine-store";
import {
  DomainError,
  type Package,
  type PreparedPhoto,
  type Source,
  type Command,
} from "./domain/medicine";
export const store = new MedicineStore();
type Clue = Awaited<ReturnType<typeof store.clue>>;
const title = (p: Package) => p.medicineName + (p.label ? " · " + p.label : "");
const date = (s: string) =>
  new Date(s).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const sources: Record<Source, string> = {
  manual: "手工记录",
  "ai-confirmed": "AI 整理后确认",
  "mock-confirmed": "演示解析后确认",
};
const errors: Record<string, string> = {
  DUPLICATE_PACKAGE:
    "已有同名包装。请填写不同的包装标签，或从已有记录更新位置。",
  STALE_RECORD: "这条记录已在其他页面更新。请返回查看最新线索后再操作。",
  STORAGE_FULL: "本机空间不足。请释放空间后重试，或移除照片后保存。",
  SAVE_FAILED: "保存未完成，内容仍保留。请重试。",
  PHOTO_INVALID: "照片无法保存，请重新选择。",
  VALIDATION_ERROR: "请检查必填内容和长度。",
};
function message(e: unknown) {
  return e instanceof DomainError
    ? (errors[e.code] ?? "操作未完成，请重试。")
    : e instanceof Error
      ? e.message
      : "操作未完成，请重试。";
}
function Screen({
  heading,
  sub,
  children,
  actions,
  home = false,
}: {
  heading: string;
  sub?: string;
  children: ReactNode;
  actions?: ReactNode;
  home?: boolean;
}) {
  const nav = useNavigate();
  return (
    <main className="screen">
      <header>
        {home ? (
          <span className="eyebrow">家庭药箱 / 位置线索</span>
        ) : (
          <button className="back" onClick={() => nav("/")}>
            ‹ 返回首页
          </button>
        )}
        <h1>{heading}</h1>
        {sub && <p className="subtitle">{sub}</p>}
      </header>
      <section className="content">{children}</section>
      {actions && <footer className="actions">{actions}</footer>}
    </main>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={secondary ? "button secondary" : "button primary"}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  max = 200,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Notice({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={warning ? "notice warning" : "notice"}>{children}</div>
  );
}
function PhotoView({ photo }: { photo: PreparedPhoto }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo.blob]);
  return (
    <>
      <button
        className="photo"
        aria-label="查看位置照片"
        onClick={() => setOpen(true)}
      >
        <img src={url} alt="用户记录的位置照片" />
        <span>查看大图 ↗</span>
      </button>
      <p className="caption">
        {photo.capturedAt ? `拍摄于 ${date(photo.capturedAt)}` : "拍摄时间未知"}{" "}
        · 添加于 {date(photo.addedAt)}
      </p>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="位置照片"
          className="lightbox"
        >
          <button
            autoFocus
            className="button secondary"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            关闭照片
          </button>
          <img src={url} alt="位置照片大图" />
        </div>
      )}
    </>
  );
}
async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("请选择 20 MB 以内的 JPG、PNG 或 WebP 照片。");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("当前浏览器无法处理照片。");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("照片处理失败，请换一张。"))),
      "image/jpeg",
      0.82,
    ),
  );
  if (blob.size > 2 * 1024 * 1024)
    throw new Error("处理后的照片仍过大，请选择较小的照片。");
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return {
    blob,
    sha256: Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    mimeType: "image/jpeg",
    width: canvas.width,
    height: canvas.height,
    byteSize: blob.size,
    addedAt: new Date().toISOString(),
    capturedAt: null,
  };
}
function PhotoInput({
  photo,
  onChange,
  onProcessing,
}: {
  photo: PreparedPhoto | null;
  onChange: (p: PreparedPhoto | null) => void;
  onProcessing: (busy: boolean) => void;
}) {
  const camera = useRef<HTMLInputElement>(null),
    album = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function select(file?: File) {
    if (!file) return;
    setBusy(true);
    onProcessing(true);
    setError("");
    try {
      onChange(await preparePhoto(file));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      onProcessing(false);
    }
  }
  return (
    <div className="card photo-input">
      {photo && <PhotoView photo={photo} />}
      <div className="row">
        <button
          disabled={busy}
          className="small-button"
          onClick={() => camera.current?.click()}
        >
          拍照
        </button>
        <button
          disabled={busy}
          className="small-button"
          onClick={() => album.current?.click()}
        >
          {photo ? "更换照片" : "从相册选图"}
        </button>
        {photo && (
          <button className="small-button" onClick={() => onChange(null)}>
            移除
          </button>
        )}
      </div>
      <input
        ref={camera}
        hidden
        aria-label="拍摄位置照片"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(e) => {
          void select(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={album}
        hidden
        aria-label="选择位置照片"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          void select(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="caption">
        {busy ? "正在处理照片…" : "每条位置可附 1 张照片，仅保存在本机。"}
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <Screen home heading="找药" sub="知道药名，就从已有线索开始。">
      <div className="card fields">
        <Field label="要找的药名" value={q} onChange={setQ} max={120} />
      </div>
      <Button
        disabled={!q.trim()}
        onClick={() => nav("/search?q=" + encodeURIComponent(q))}
      >
        查找位置
      </Button>
      <div className="section-heading">
        <h2>整理时，顺手记下来</h2>
        <p>给下一次查找，留一个起点。</p>
      </div>
      <button
        className="card record-link"
        aria-label="记一个位置"
        onClick={() => nav("/record")}
      >
        <strong>＋ 记一个位置</strong>
        <span>一句话或手工填写，可添加位置照片。</span>
      </button>
      <Notice>
        <strong>从记录出发</strong>
        <p>位置线索不是实时库存。</p>
      </Notice>
      <p className="caption bottom-note">
        无需登录 · 数据保存在当前浏览器
        <br />
        清除网站数据会删除记录和照片。
      </p>
    </Screen>
  );
}
function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const nav = useNavigate();
  const [items, setItems] = useState<Package[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    store
      .search(q, 0, 100)
      .then((p) => {
        if (alive) {
          if (p.length === 1) nav("/clue/" + p[0].id, { replace: true });
          else setItems(p);
        }
      })
      .catch((e) => setError(message(e)));
    return () => {
      alive = false;
    };
  }, [q, nav]);
  return (
    <Screen
      heading={
        items?.length ? "选择哪一盒" : items ? "暂无位置线索" : "正在查找…"
      }
      sub={q}
      actions={<Button onClick={() => nav("/record")}>记一个位置</Button>}
    >
      {error && <p role="alert">{error}</p>}
      {items?.length
        ? items.map((p) => (
            <button
              key={p.id}
              className="card package"
              aria-label={title(p)}
              onClick={() => nav("/clue/" + p.id)}
            >
              {title(p)}
              <span>查看这盒药的记录 ›</span>
            </button>
          ))
        : items && (
            <Notice>还没有找到对应的记录。这不代表家里没有这盒药。</Notice>
          )}
    </Screen>
  );
}
function Record() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("package");
  const [pack, setPack] = useState<Package | null>(null);
  const [step, setStep] = useState<
    "describe" | "manual" | "review" | "parse-error"
  >(id ? "manual" : "describe");
  const [raw, setRaw] = useState(""),
    [name, setName] = useState(""),
    [label, setLabel] = useState(""),
    [location, setLocation] = useState(""),
    [photo, setPhoto] = useState<PreparedPhoto | null>(null),
    [source, setSource] = useState<Source>("manual"),
    [mode, setMode] = useState("unknown"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [issues, setIssues] = useState("");
  const request = useRef<AbortController | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const command = useRef<Command | null>(null);
  useEffect(() => {
    fetch("/api/v1/capabilities")
      .then((r) => r.json())
      .then((r) => setMode(r.data.parseMode))
      .catch(() => setMode("unavailable"));
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (id)
      store
        .clue(id)
        .then((c) => {
          setPack(c.package);
          setName(c.package.medicineName);
          setLabel(c.package.label);
        })
        .catch((e) => setError(message(e)));
  }, [id]);
  function edit(setter: (v: string) => void, v: string) {
    command.current = null;
    setter(v);
    setError("");
  }
  async function parse() {
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/v1/parse-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw }),
        signal: ctrl.signal,
      });
      if (!r.ok)
        throw new Error("解析服务暂时不可用。原文已保留，可以重试或手工填写。");
      const { data } = await r.json();
      if (ctrl.signal.aborted) return;
      if (data.status === "out-of-scope")
        throw new Error("这里只整理药品位置，不提供诊断、用药推荐或剂量建议。");
      setName(data.candidate.medicineName ?? "");
      setLocation(data.candidate.locationText ?? "");
      setSource(data.mode === "mock" ? "mock-confirmed" : "ai-confirmed");
      setIssues(
        data.status === "needs-confirmation"
          ? "描述中有信息不明确，请补全药名和具体位置。"
          : "",
      );
      command.current = null;
      setStep("review");
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(message(e));
        setStep("parse-error");
      }
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  function manual() {
    request.current?.abort();
    setBusy(false);
    setError("");
    setSource("manual");
    setStep("manual");
  }
  function review() {
    if (!name.trim() || !location.trim()) {
      setError("请填写药名和具体位置。");
      return;
    }
    setError("");
    setStep("review");
  }
  async function save() {
    if (!name.trim() || !location.trim())
      return setError("请补全药名和具体位置后再保存。");
    setBusy(true);
    setError("");
    try {
      if (!command.current)
        command.current = pack
          ? {
              kind: "record-location",
              commandId: crypto.randomUUID(),
              packageId: pack.id,
              expectedRevision: pack.revision,
              locationText: location,
              source,
              photo,
            }
          : {
              kind: "create-record",
              commandId: crypto.randomUUID(),
              medicineName: name,
              label,
              locationText: location,
              source,
              photo,
            };
      const receipt = await store.execute(command.current);
      nav("/clue/" + receipt.packageId, { replace: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const heading =
    step === "describe"
      ? "记下放在哪里"
      : step === "parse-error"
        ? "暂时无法整理"
        : step === "review"
          ? "核对这条线索"
          : id
            ? "补充新位置"
            : "手工记一个位置";
  return (
    <Screen
      heading={heading}
      sub={
        step === "review"
          ? "确认后，才会成为已保存的记录。"
          : step === "describe"
            ? "一句话描述，稍后核对。"
            : id
              ? "记录你这次找到的位置。"
              : "只记录你知道的内容。"
      }
      actions={
        step === "describe" ? (
          <>
            <Button
              onClick={() => void parse()}
              disabled={busy || photoBusy || !raw.trim()}
            >
              {busy ? "正在整理…" : "整理为待核对记录"}
            </Button>
            <Button secondary onClick={manual}>
              直接手工填写
            </Button>
            <p className="caption">
              {mode === "mock"
                ? "当前为演示解析 · 未调用真实 AI"
                : mode === "live"
                  ? "AI 仅整理文字，保存前需要你核对。"
                  : "解析服务连接中，可直接手工填写。"}
            </p>
          </>
        ) : step === "parse-error" ? (
          <>
            <Button onClick={() => void parse()} disabled={busy}>
              重新整理
            </Button>
            <Button secondary onClick={manual}>
              改为手工填写
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={busy || photoBusy || Boolean(id && !pack)}
              onClick={() => (step === "review" ? void save() : review())}
            >
              {busy
                ? "正在保存…"
                : step === "review"
                  ? "确认并保存"
                  : "继续核对"}
            </Button>
            <Button
              secondary
              disabled={busy}
              onClick={() => {
                command.current = null;
                setStep(step === "review" ? "manual" : "describe");
              }}
            >
              返回{step === "review" ? "编辑" : "描述"}，保留草稿
            </Button>
            <p className="caption">{sources[source]} · 只保存在本机</p>
          </>
        )
      }
    >
      {error && (
        <Notice warning>
          <p role="alert">{error}</p>
        </Notice>
      )}
      {issues && step === "review" && <Notice warning>{issues}</Notice>}
      {step === "describe" ? (
        <label className="card description">
          <span>你的描述</span>
          <textarea
            aria-label="你的描述"
            value={raw}
            maxLength={1000}
            placeholder="例如：这盒布洛芬放在黑色背包前袋"
            onChange={(e) => setRaw(e.target.value)}
          />
        </label>
      ) : step === "parse-error" ? (
        <div className="card">
          <span className="caption">你的原文</span>
          <p>{raw}</p>
        </div>
      ) : (
        <>
          {raw && step === "manual" && <p className="caption">{raw}</p>}
          <div className="card fields">
            {pack ? (
              <div className="field">
                <span>这盒药</span>
                <strong>{title(pack)}</strong>
              </div>
            ) : (
              <>
                <Field
                  label="药名"
                  value={name}
                  onChange={(v) => edit(setName, v)}
                  max={120}
                />
                <Field
                  label="包装标签"
                  value={label}
                  onChange={(v) => edit(setLabel, v)}
                  max={40}
                />
              </>
            )}
            <Field
              label={id ? "找到的位置" : "具体位置"}
              value={location}
              onChange={(v) => edit(setLocation, v)}
            />
          </div>
          <p className="caption">
            {id
              ? "新位置会成为最新线索，原有位置和照片仍保留在历史中。"
              : "同名药品有多盒时，用“家用盒”“随身盒”等标签区分。"}
          </p>
        </>
      )}
      {step !== "parse-error" && (
        <PhotoInput
          photo={photo}
          onProcessing={setPhotoBusy}
          onChange={(p) => {
            command.current = null;
            setPhoto(p);
          }}
        />
      )}
    </Screen>
  );
}
function CluePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [clue, setClue] = useState<Clue | null>(null),
    [photo, setPhoto] = useState<PreparedPhoto | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const c = await store.clue(id!);
      setClue(c);
      setPhoto(
        c.observation?.photoId
          ? ((await store.photo(c.observation.photoId)) ?? null)
          : null,
      );
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function feedback(outcome: "found" | "not-found") {
    if (!clue?.observation) return;
    setBusy(true);
    try {
      await store.execute({
        kind: "feedback",
        commandId: crypto.randomUUID(),
        packageId: clue.package.id,
        expectedRevision: clue.package.revision,
        observationId: clue.observation.id,
        outcome,
      });
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const miss = clue?.state === "not-found",
    found = clue?.state === "found-at-time";
  return (
    <Screen
      heading={miss ? "这里没找到" : found ? "已记录这次找到" : "位置线索"}
      sub={clue ? title(clue.package) : "正在读取本机记录…"}
      actions={
        clue && (
          <>
            {miss ? (
              <>
                <Button onClick={() => nav("/record?package=" + id)}>
                  在别处找到了，更新位置
                </Button>
                <Button secondary onClick={() => nav("/")}>
                  暂时结束查找
                </Button>
              </>
            ) : found ? (
              <>
                <Button onClick={() => nav("/")}>回到首页</Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void feedback("not-found")}
                >
                  这里没找到
                </Button>
                <Button secondary onClick={() => nav("/record?package=" + id)}>
                  位置变了，更新记录
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={() => void feedback("found")}>
                  在这里找到了
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void feedback("not-found")}
                >
                  这里没找到
                </Button>
              </>
            )}
            <button
              className="text-button"
              onClick={() => nav("/history/" + id)}
            >
              查看这盒药的历史
            </button>
          </>
        )
      }
    >
      {error && <p role="alert">{error}</p>}
      {clue?.observation && (
        <>
          <div className="card">
            <span className="caption">最近记录位置</span>
            <h2>{clue.observation.locationText}</h2>
            <p className="caption">
              记录于 {date(clue.observation.confirmedAt)}
              <br />
              {sources[clue.observation.source]}
            </p>
          </div>
          {miss && (
            <Notice warning>
              <strong>本次未找到</strong>
              <p>
                {date(clue.latestFeedback!.recordedAt)} · 这不代表已经用完。
              </p>
            </Notice>
          )}
          {found && (
            <Notice>
              <strong>已保存找到反馈</strong>
              <p>这只代表本次查找结果，不代表实时库存。</p>
            </Notice>
          )}
          {photo && (
            <div className="card">
              <PhotoView photo={photo} />
            </div>
          )}
          <Notice>这是过去记录的位置，当前是否还在这里，需要你确认。</Notice>
        </>
      )}
    </Screen>
  );
}
function History() {
  const { id } = useParams();
  const [items, setItems] = useState<Awaited<ReturnType<typeof store.history>>>(
      [],
    ),
    [photos, setPhotos] = useState<Record<string, PreparedPhoto>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    store
      .history(id!, Infinity, 100)
      .then(async (rows) => {
        setItems(rows);
        const result: Record<string, PreparedPhoto> = {};
        for (const row of rows)
          if (row.type === "location" && row.photoId) {
            const p = await store.photo(row.photoId);
            if (p) result[row.photoId] = p;
          }
        setPhotos(result);
      })
      .catch((e) => setError(message(e)));
  }, [id]);
  return (
    <Screen heading="历史线索" sub="保留每次记录，也保留每次查找的结果。">
      {error && <p role="alert">{error}</p>}
      {items.map((e, i) => (
        <article
          className={
            "card history " +
            (e.type === "feedback" && e.outcome === "not-found"
              ? "warning"
              : "")
          }
          key={e.id}
        >
          <span className="caption">
            {e.type === "location"
              ? i === 0
                ? "最新位置记录"
                : "历史位置记录"
              : e.outcome === "found"
                ? "本次找到"
                : "本次未找到"}
          </span>
          <h2>{e.locationText}</h2>
          <p className="caption">
            {date(e.type === "location" ? e.confirmedAt : e.recordedAt)}
            {e.type === "location" ? " · " + sources[e.source] : ""}
          </p>
          {e.type === "location" && e.photoId && photos[e.photoId] && (
            <PhotoView photo={photos[e.photoId]} />
          )}
        </article>
      ))}
      <Notice>历史位置供回顾，不代表药品现在仍在那里。</Notice>
    </Screen>
  );
}
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/record" element={<Record />} />
      <Route path="/clue/:id" element={<CluePage />} />
      <Route path="/history/:id" element={<History />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
