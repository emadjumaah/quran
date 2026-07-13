/**
 * نِبراس — a research chat over مشكاة's own data. It retrieves from the Qur'an
 * (verses by meaning, roots + their lexical sense) and, on request, drafts a
 * منشور / خطبة / محاضرة / تلخيص FROM that gathered material — a grounded draft for
 * a scholar to build on, never tafsir or fatwa. Multi-chat, on-device, no account.
 *
 * Flow: /api/chat plans (which local tool, or compose, or answer) → the tools run
 * here for free → /api/compose writes only from what this chat gathered.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUILang, num, useUILang } from "../i18n";
import {
  addMessage, chatMaterial, createChat, deleteChat, getChat, patchMessage, renameChat, useChats,
  type ChatAyah, type ChatMsg,
} from "../chat";
import { toolRootInfo, toolSearchMeaning } from "../lib/muinTools";
import { retrieveBooks, hasBooks, bookLabel } from "../rag";
import { surahNameAr } from "../db";

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const EXAMPLES_AR = [
  "ابحث عن آياتٍ في الصبر على البلاء",
  "ما معنى جذر «رحم» ومواضعه؟",
  "اجمع آياتٍ عن العدل، ثم اكتب منشورًا موجزًا منها",
  "آيات في شكر النعمة، ثم مسوّدة خطبة",
];

function Bubble({ m }: { m: ChatMsg }) {
  const ar = getUILang() === "ar";
  const copy = () => navigator.clipboard?.writeText(m.draft || m.text || "");
  return (
    <div className={`mu-msg ${m.role}`}>
      {m.role === "user" ? (
        <div className="mu-user">{m.text}</div>
      ) : (
        <div className="mu-asst">
          {m.pending ? (
            <div className="mu-typing"><span /><span /><span /></div>
          ) : (
            <>
              {m.text && <div className={`mu-reply${m.error ? " err" : ""}`}>{m.text}</div>}
              {m.ayahs && m.ayahs.length > 0 && (
                <div className="mu-ayahs">
                  {m.ayahs.map((a) => {
                    const [s, n] = a.ref.split(":");
                    return (
                      <Link key={a.ref} to={`/read/${s}/${n}`} className="mu-ayah">
                        <span className="quran mu-ayah-t">{a.text}</span>
                        <span className="muted mu-ayah-r">{ar ? "الآية" : ""} {a.ref}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              {m.roots && m.roots.length > 0 && (
                <div className="mu-roots">
                  {m.roots.map((r) => (
                    <span key={r.root} className="mu-root">
                      <Link to={`/journey/${encodeURIComponent(r.root)}`} className="quran mu-root-w">{r.root}</Link>
                      <span className="muted"> · {num(r.occ)}</span>
                      {r.gloss && <div className="mu-root-g">{r.gloss}</div>}
                    </span>
                  ))}
                </div>
              )}
              {m.books && m.books.length > 0 && (
                <div className="mu-books">
                  <div className="mu-books-h muted">{ar ? "من المصادر (مذكورةً):" : "from the sources (cited):"}</div>
                  {m.books.map((b, i) => (
                    <div key={i} className="mu-book">
                      <div className="mu-book-src">◆ {bookLabel(b.source)}{b.ref ? ` · ${b.ref}` : ""}</div>
                      <div className="mu-book-t">{b.text}</div>
                    </div>
                  ))}
                </div>
              )}
              {m.draft && (
                <div className="mu-draft">
                  <div className="mu-draft-note muted">{ar ? "مسوّدةٌ محسوبةٌ من الآيات أعلاه — راجِعْها." : "A computed draft from the verses above — review it."}</div>
                  <div className="mu-draft-body">{m.draft}</div>
                  <button className="chip mu-copy" onClick={copy}>{ar ? "نسخ" : "copy"} ⧉</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Assistant() {
  useUILang();
  const ar = getUILang() === "ar";
  const chats = useChats();
  const { id } = useParams();
  const navigate = useNavigate();
  const chat = chats.find((c) => c.id === id) ?? null;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // resizable chat-list column (drag the divider) — persisted, RTL-aware
  const [listW, setListW] = useState<number>(() => { const v = Number(localStorage.getItem("nibras-listw")); return v >= 180 && v <= 460 ? v : 250; });
  const wRef = useRef(listW);
  const dragging = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const onResizeMove = (e: React.PointerEvent) => {
    if (!dragging.current || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const w = getUILang() === "ar" ? rect.right - e.clientX : e.clientX - rect.left;
    const clamped = Math.max(180, Math.min(460, Math.round(w)));
    wRef.current = clamped;
    setListW(clamped);
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat?.messages.length, busy]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    let cid = chat?.id;
    if (!cid) { cid = createChat(); navigate(`/assistant/${cid}`); }
    const existing = getChat(cid);
    if (existing && existing.messages.length === 0) renameChat(cid, text.slice(0, 42));
    addMessage(cid, { role: "user", text });
    setInput("");
    const aid = addMessage(cid, { role: "assistant", text: "", pending: true });
    setBusy(true);
    try {
      const cur = getChat(cid)!;
      const mat = chatMaterial(cur);
      const plan = await postJson("/api/chat", {
        messages: cur.messages.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text })),
        material: { ayahs: mat.ayahs.map((a) => ({ ref: a.ref, text: a.text })), roots: mat.roots.map((r) => ({ root: r.root })) },
      });
      const patch: Partial<ChatMsg> = { pending: false, text: plan.reply || "" };
      if (plan.action === "search_meaning" && plan.query) {
        patch.ayahs = await toolSearchMeaning(plan.query);
        if (hasBooks()) { const bks = await retrieveBooks(plan.query); if (bks.length) patch.books = bks; }
        if (!patch.ayahs.length) patch.text = (plan.reply || "") + (ar ? " (لم أجد آياتٍ مطابقة.)" : "");
      } else if (["search_root", "root_info", "similar_roots"].includes(plan.action) && plan.query) {
        const r = await toolRootInfo(plan.query);
        patch.roots = r.roots; patch.ayahs = r.ayahs;
        if (!r.roots.length) patch.text = (plan.reply || "") + (ar ? " (لم أجد هذا الجذر.)" : "");
      } else if (plan.action === "compose" || plan.action === "search_compose") {
        const cur2 = getChat(cid)!;
        const prior = chatMaterial(cur2);
        // gather now if asked in one message (search_compose), or if nothing's gathered yet
        let fresh: ChatAyah[] = [];
        const q = plan.query || plan.subject || "";
        if ((plan.action === "search_compose" || prior.ayahs.length === 0) && q) {
          fresh = await toolSearchMeaning(q);
          if (fresh.length) patch.ayahs = fresh;
        }
        // union of freshly-found + already-gathered verses (dedupe by ref)
        const seen = new Set<string>();
        const ayahs: ChatAyah[] = [];
        for (const a of [...fresh, ...prior.ayahs]) if (!seen.has(a.ref)) { seen.add(a.ref); ayahs.push(a); }
        if (!ayahs.length) {
          patch.text = ar ? "لم أجدْ آياتٍ في هذا الموضوع لأبني عليها — جرّبْ صياغةً أخرى للطلب، أو ابحثْ أوّلًا ثمّ اطلبِ الكتابة." : "No verses found to build on — try rephrasing, or search first then compose.";
        } else {
          // the most recent draft in this chat — so «وسّع / نقّح» continues it, not restarts
          const prev = [...cur2.messages].reverse().find((mm) => mm.draft)?.draft || "";
          // gather cited book/tafsir passages from the server corpus (inert until a source is registered)
          const books = hasBooks() ? await retrieveBooks(q || plan.subject || text, { topK: 6 }) : [];
          if (books.length) patch.books = books;
          const composed = await postJson("/api/compose", {
            task: plan.task || "post", subject: plan.subject || text, length: plan.length || "long",
            ayahs: ayahs.slice(0, 16).map((a) => {
              const [s, n] = a.ref.split(":");
              return { ref: `${surahNameAr(Number(s))} ${n}`, text: a.text };
            }),
            roots: prior.roots.slice(0, 12).map((r) => ({ root: r.root, gloss: r.gloss })),
            books: books.slice(0, 8).map((b) => ({ source: bookLabel(b.source), ref: b.ref, text: b.text })),
            instruction: text, previous: prev,
          });
          patch.text = plan.reply || (ar ? "إليك مسوّدةً تبني عليها:" : "A draft to build on:");
          patch.draft = composed.text;
          patch.composed = true;
        }
      }
      patchMessage(cid, aid, patch);
    } catch {
      patchMessage(cid, aid, { pending: false, error: true, text: ar ? "تعذّر إتمام الطلب — تأكّد من الاتصال وحاوِل ثانيةً." : "Request failed — check your connection and retry." });
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const empty = !chat || chat.messages.length === 0;
  const composer = (
    <div className="mu-input">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        placeholder={ar ? "اكتبْ ما تريد…" : "write anything…"}
        aria-label={ar ? "رسالة" : "message"}
      />
      <button className="mu-send" onClick={() => void send()} disabled={busy || !input.trim()} aria-label={ar ? "إرسال" : "send"}>
        {busy ? (
          <span aria-hidden>…</span>
        ) : (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
        )}
      </button>
    </div>
  );

  return (
    <div className="mu-page" ref={pageRef} style={{ "--mu-listw": `${listW}px` } as React.CSSProperties}>
      {/* chat list */}
      <aside className={`mu-list${listOpen ? " open" : ""}`}>
        <button className="mu-new" onClick={() => { navigate("/assistant"); setInput(""); setListOpen(false); }}>
          <span className="mu-new-plus" aria-hidden>＋</span> {ar ? "محادثة جديدة" : "New chat"}
        </button>
        <div className="mu-chats">
          {chats.map((c) => (
            <div key={c.id} className={`mu-chat${c.id === id ? " on" : ""}`}>
              <Link to={`/assistant/${c.id}`} className="mu-chat-t" onClick={() => setListOpen(false)}>{c.title}</Link>
              <button className="mu-chat-x" aria-label={ar ? "حذف" : "delete"} onClick={() => { if (confirm(ar ? "حذف المحادثة؟" : "Delete chat?")) { deleteChat(c.id); if (c.id === id) navigate("/assistant"); } }}>✕</button>
            </div>
          ))}
        </div>
      </aside>
      <div
        className="mu-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={ar ? "تغيير عرض القائمة" : "resize list"}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); dragging.current = true; }}
        onPointerMove={onResizeMove}
        onPointerUp={() => { if (dragging.current) { dragging.current = false; localStorage.setItem("nibras-listw", String(wRef.current)); } }}
      />
      {listOpen && <div className="mu-list-bg" onClick={() => setListOpen(false)} />}

      {/* thread */}
      <main className="mu-main">
        <div className="mu-topbar">
          <button className="mu-list-btn" onClick={() => setListOpen((v) => !v)} aria-label={ar ? "المحادثات" : "chats"}>☰</button>
          <span className="mu-title">{chat?.title || (ar ? "نِبراس" : "Nibras")}</span>
        </div>

        <div className={`mu-thread${empty ? " empty" : ""}`}>
          {empty ? (
            <div className="mu-hero">
              <div className="mu-empty-mark"><span className="ai-spark" aria-hidden /></div>
              <h1 className="mu-empty-h">{ar ? "بمَ نبدأ؟" : "Where shall we begin?"}</h1>
              <p className="mu-hero-sub">
                {ar
                  ? "نِبراس — بحثٌ بالمعنى ومحادثةٌ من نصّ القرآن وبياناته. اكتبْ موضوعًا، أو معنى جذر، أو اطلبْ صياغةً من الآيات."
                  : "Nibras — meaning-search & chat over the Qur'an's data. Ask for a theme, a root's sense, or a draft from the verses."}
              </p>
              {composer}
              <div className="mu-examples">
                {EXAMPLES_AR.slice(0, 4).map((ex) => (
                  <button key={ex} className="mu-ex" onClick={() => void send(ex)}>{ex}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chat.messages.map((m) => <Bubble key={m.id} m={m} />)}
              <div ref={endRef} />
            </>
          )}
        </div>

        {!empty && (
          <div className="mu-inputbar">
            {composer}
            <div className="mu-foot muted">{ar ? "نِبراس يجمع ويصوغ من بيانات القرآن — مسوّداتٌ للباحث." : "Grounded drafts from the Qur'an's data — for research."}</div>
          </div>
        )}
      </main>
    </div>
  );
}
