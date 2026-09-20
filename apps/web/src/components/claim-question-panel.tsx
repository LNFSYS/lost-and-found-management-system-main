import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, LockKeyhole, Pencil, Plus, Send, Sparkles } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { api, type ClaimRecord, type ClaimVerificationState, type VerificationTemplatesResponse } from "../services/api";

interface Props {
  claim: ClaimRecord;
  verification: ClaimVerificationState | null;
  templates: VerificationTemplatesResponse | null;
  onVerificationChange: (value: ClaimVerificationState) => void;
}

export function ClaimQuestionPanel({ claim, verification, templates, onVerificationChange }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retryKey = useRef<string | null>(null);
  const active = verification?.status === "CONVERSATION_OPEN" || verification?.status === "NEED_MORE_INFO";
  const finder = verification?.participantRole === "FINDER";
  const activeQuestion = useMemo(
    () => verification?.questions.find((question) => question.status !== "DISABLED" && !question.answer) ?? null,
    [verification]
  );

  function choosePrompt(key: string, value: string) {
    setSelectedKey(key);
    setPrompt(value);
    setEditing(false);
    setError("");
  }

  function chooseCustom() {
    setSelectedKey("custom");
    setPrompt("");
    setEditing(true);
    setError("");
  }

  async function sendQuestion(event: FormEvent) {
    event.preventDefault();
    if (!templates || !selectedKey || !prompt.trim()) return;
    setBusy(true);
    setError("");
    retryKey.current ??= crypto.randomUUID();
    try {
      const result = await api.sendClaimVerificationQuestion(claim.id, {
        templateId: templates.template.id,
        templateVersion: templates.template.version,
        promptKey: selectedKey,
        prompt: prompt.trim(),
        idempotencyKey: retryKey.current
      });
      retryKey.current = null;
      setSelectedKey(null);
      setPrompt("");
      onVerificationChange(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi câu hỏi");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!activeQuestion || !answer.trim()) return;
    setBusy(true);
    setError("");
    retryKey.current ??= crypto.randomUUID();
    try {
      const result = await api.answerClaimVerificationQuestion(claim.id, activeQuestion.id, answer.trim(), retryKey.current);
      retryKey.current = null;
      setAnswer("");
      onVerificationChange(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi câu trả lời");
    } finally {
      setBusy(false);
    }
  }

  if (!verification) return null;

  return <section className={`chat-question-panel ${expanded ? "is-expanded" : "is-collapsed"}`} id="verification-questions">
    <button type="button" className="chat-question-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
      <span><Sparkles /><strong>Câu hỏi xác minh</strong></span>
      <small>{activeQuestion ? "Đang chờ trả lời" : templates ? `${templates.category} · v${templates.template.version}` : "Private"}</small>
      {expanded ? <ChevronUp /> : <ChevronDown />}
    </button>
    {expanded && <>{activeQuestion ? <div className="chat-active-question">
      <strong>{activeQuestion.prompt}</strong>
      {activeQuestion.answer ? <small>Đã nhận câu trả lời riêng</small> : finder
        ? <small>Đang chờ claimant trả lời</small>
        : <form onSubmit={submitAnswer}>
          <label htmlFor={`answer-${activeQuestion.id}`}>Câu trả lời riêng</label>
          <div><input id={`answer-${activeQuestion.id}`} type="text" autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={500} required /><button type="submit" disabled={busy || !answer.trim()} title="Gửi câu trả lời"><Send /></button></div>
        </form>}
    </div> : finder && templates ? <>
      {!selectedKey ? <div className="chat-question-suggestions">
        {templates.template.prompts.map((item) => <button type="button" key={item.key} onClick={() => choosePrompt(item.key, item.prompt)}>{item.prompt}</button>)}
        <button type="button" className="custom" onClick={chooseCustom}><Plus /> Tạo câu hỏi tùy chỉnh</button>
      </div> : <form className="chat-question-editor" onSubmit={sendQuestion}>
        <label>Câu hỏi</label>
        {editing ? <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={10} maxLength={500} autoFocus required /> : <blockquote>{prompt}</blockquote>}
        <div><button type="button" className="secondary" onClick={() => setSelectedKey(null)}><ArrowLeft /> Quay lại</button><button type="button" className="secondary" onClick={() => setEditing((value) => !value)}><Pencil /> {editing ? "Xong" : "Chỉnh sửa"}</button><button type="submit" disabled={busy || !prompt.trim()}><Send /> {busy ? "Đang gửi" : "Gửi câu hỏi"}</button></div>
      </form>}
    </> : null}
    <footer><LockKeyhole /> Nội dung xác minh chỉ hiển thị trong conversation này.</footer>
    {error && <div className="chat-question-error"><AlertTriangle /> {error}</div>}
    </>}
  </section>;
}
