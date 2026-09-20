import { AlertTriangle, ArrowLeft, Pencil, Plus, Send, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type ClaimRecord, type ClaimVerificationState, type VerificationTemplatesResponse } from "../services/api";

interface Props {
  claim: ClaimRecord;
  verification: ClaimVerificationState;
  templates: VerificationTemplatesResponse | null;
  onClose: () => void;
  onSuccess: (verification: ClaimVerificationState) => void;
}

export function ClaimVerificationQuestionModal({ claim, verification, templates, onClose, onSuccess }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    try {
      const result = await api.sendClaimVerificationQuestion(claim.id, {
        templateId: templates.template.id,
        templateVersion: templates.template.version,
        promptKey: selectedKey,
        prompt: prompt.trim(),
        idempotencyKey: crypto.randomUUID()
      });
      onSuccess(result);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi câu hỏi");
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop verification-modal-backdrop" onClick={onClose}>
    <div className="modal verification-modal" onClick={(e) => e.stopPropagation()}>
      <header>
        <h3>Gửi câu hỏi xác minh</h3>
        <button type="button" onClick={onClose} title="Đóng"><X /></button>
      </header>
      {!templates ? <div className="verification-modal-empty">
        <p>Không có mẫu câu hỏi nào.</p>
      </div> : !selectedKey ? <div className="verification-questions-list">
        {templates.template.prompts.map((item) => (
          <button type="button" key={item.key} onClick={() => choosePrompt(item.key, item.prompt)}>
            {item.prompt}
          </button>
        ))}
        <button type="button" className="custom" onClick={chooseCustom}><Plus /> Tạo câu hỏi tùy chỉnh</button>
      </div> : <form className="verification-question-form" onSubmit={sendQuestion}>
        <label>Câu hỏi</label>
        {editing ? (
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} minLength={10} maxLength={500} autoFocus required />
        ) : (
          <blockquote>{prompt}</blockquote>
        )}
        <div className="verification-form-actions">
          <button type="button" className="secondary" onClick={() => setSelectedKey(null)}><ArrowLeft /> Quay lại</button>
          <button type="button" className="secondary" onClick={() => setEditing((value) => !value)}><Pencil /> {editing ? "Xong" : "Chỉnh sửa"}</button>
          <button type="submit" disabled={busy || !prompt.trim()}><Send /> {busy ? "Đang gửi" : "Gửi câu hỏi"}</button>
        </div>
      </form>}
      {error && <div className="verification-modal-error"><AlertTriangle /> {error}</div>}
      <footer><small>Nội dung xác minh chỉ hiển thị trong conversation này.</small></footer>
    </div>
  </div>;
}
