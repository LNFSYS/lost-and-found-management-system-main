import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bot, ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { api, type WarehouseConversationExtraction, type WarehouseConversationMessage, type WarehouseConversationMode } from "../services/api";

type AttachedImage = { file: File; previewUrl: string };
type DisplayMessage = WarehouseConversationMessage & { images?: string[]; pending?: boolean };
const maxChatImages = 3;
const maxChatImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function WarehouseConversationChat({ mode, warehouseItemId, onExtraction, disabled = false, allowImages = false }: {
  mode: WarehouseConversationMode;
  warehouseItemId?: string;
  onExtraction: (result: WarehouseConversationExtraction) => void;
  disabled?: boolean;
  allowImages?: boolean;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyWithImages, setBusyWithImages] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const busyRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    const list = messageList.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);

  function selectImages(files: FileList | null) {
    if (!files?.length || !allowImages || disabled || busyRef.current) return;
    const selected = Array.from(files);
    if (attachments.length + selected.length > maxChatImages) {
      setError(`Mỗi lượt chat chỉ đính kèm tối đa ${maxChatImages} ảnh.`);
      return;
    }
    const invalid = selected.find(file => !allowedImageTypes.has(file.type) || file.size > maxChatImageBytes);
    if (invalid) {
      setError(invalid.size > maxChatImageBytes ? "Mỗi ảnh chat không được vượt quá 5 MB." : "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.");
      return;
    }
    setError("");
    const next = selected.map(file => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      return { file, previewUrl };
    });
    setAttachments(previous => [...previous, ...next]);
  }

  function removeImage(image: AttachedImage) {
    URL.revokeObjectURL(image.previewUrl);
    objectUrls.current.delete(image.previewUrl);
    setAttachments(previous => previous.filter(item => item !== image));
  }

  async function sendMessage() {
    const content = draft.trim() || (attachments.length ? "Vui lòng kiểm tra ảnh vật phẩm và ghi nhận tình trạng bên ngoài." : "");
    if ((!content && !attachments.length) || busyRef.current || disabled) return;
    if (content.length > 2000) { setError("Mỗi tin nhắn tối đa 2.000 ký tự."); return; }
    const submittedDraft = draft;
    const submittedAttachments = attachments;
    const pendingMessage: DisplayMessage = { role: "user", content, pending: true, ...(attachments.length ? { images: attachments.map(image => image.previewUrl) } : {}) };
    const nextMessages: DisplayMessage[] = [...messages, pendingMessage].slice(-19);
    while (nextMessages.length > 1 && nextMessages.reduce((total, message) => total + message.content.length, 0) > 12000) nextMessages.shift();
    const requestMessages = nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages(nextMessages);
    setDraft("");
    setAttachments([]);
    if (fileInput.current) fileInput.current.value = "";
    setError("");
    setStatus("");
    setWarnings([]);
    busyRef.current = true;
    setBusy(true);
    setBusyWithImages(submittedAttachments.length > 0);
    try {
      const result = await api.extractWarehouseConversation({ mode,
        ...(mode === "INTAKE" ? { intakeKind: allowImages ? "WALK_IN" as const : "CUSTODY_REQUEST" as const } : {}),
        ...(warehouseItemId ? { warehouseItemId } : {}), messages: requestMessages
      }, submittedAttachments.map(image => image.file));
      const confirmedMessages = nextMessages.map(message => message === pendingMessage ? { ...message, pending: false } : message);
      const responseMessages: DisplayMessage[] = [...confirmedMessages, { role: "assistant", content: result.assistantMessage }];
      setMessages(responseMessages.slice(-20));
      setWarnings(result.warnings);
      setStatus("Đã phân tích xong. Các gợi ý đã được điền vào biểu mẫu nếu bạn chưa sửa những ô đó; hãy rà soát trước khi lưu.");
      onExtraction(result);
    } catch (reason) {
      setMessages(messages);
      setDraft(submittedDraft);
      setAttachments(submittedAttachments);
      setStatus("");
      setError(reason instanceof Error ? `${reason.message} Thông tin biểu mẫu vẫn được giữ nguyên; bạn có thể nhập thủ công hoặc thử lại.` : "AI chưa xử lý được hội thoại. Thông tin biểu mẫu vẫn được giữ nguyên; bạn có thể nhập thủ công hoặc thử lại.");
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyWithImages(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return <div className={`warehouse-ai-widget${open ? " warehouse-ai-widget--open" : ""}`}>
    {open && <section id="warehouse-ai-chat-panel" className="warehouse-ai-chat__panel" aria-label={mode === "INTAKE" ? "Trợ lý AI tiếp nhận kho" : "Trợ lý AI trả hàng kho"}>
      <header className="warehouse-ai-chat__header">
        <span><Bot size={18} /> {mode === "INTAKE" ? "AI tiếp nhận kho" : "AI trả hàng kho"}</span>
        <button type="button" className="warehouse-ai-chat__close" aria-label="Thu nhỏ trợ lý AI" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>
      <div ref={messageList} className="warehouse-ai-chat__messages" aria-live="polite">
        {messages.map((message, index) => <div className={`warehouse-ai-chat__message warehouse-ai-chat__message--${message.role}`} key={`${index}-${message.role}`}>
          <strong>{message.role === "user" ? "Người dùng" : "Trợ lý"}</strong>
          {message.content && <span>{message.content}</span>}
          {message.images?.length ? <div className="warehouse-ai-chat__message-images">{message.images.map((src, imageIndex) => <img src={src} alt={`Ảnh vật phẩm đính kèm ${imageIndex + 1}`} key={src} />)}</div> : null}
          {message.pending && <small>Đang gửi và kiểm tra…</small>}
        </div>)}
        {busy && <p className="warehouse-ai-chat__busy" role="status"><LoaderCircle className="spin-icon" size={16} /> {busyWithImages ? "Đang kiểm tra tin nhắn và phân tích ảnh…" : "Đang kiểm tra tin nhắn và phân tích hội thoại…"}</p>}
      </div>
      {warnings.length > 0 && <ul className="warehouse-ai-chat__warnings" aria-label="Lưu ý từ trợ lý AI">{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>}
      {status && <p className="warehouse-ai-chat__status" role="status">Đã điền gợi ý. Vui lòng rà soát biểu mẫu.</p>}
      {error && <p className="field-error warehouse-ai-chat__error" role="alert">{error}</p>}
      {attachments.length > 0 && <div className="warehouse-ai-chat__attachments" aria-label="Ảnh sẽ gửi cùng tin nhắn">
        {attachments.map((image, index) => <div className="warehouse-ai-chat__attachment" key={image.previewUrl}>
          <img src={image.previewUrl} alt={`Ảnh đính kèm ${index + 1}`} />
          <button type="button" aria-label={`Xóa ảnh đính kèm ${index + 1}`} disabled={disabled || busy} onClick={() => removeImage(image)}><X size={14} /></button>
        </div>)}
        <small>Ảnh chỉ dùng để gợi ý tình trạng; vẫn cần tải ảnh chứng minh ở biểu mẫu.</small>
      </div>}
      <div className="warehouse-ai-chat__composer">
        {allowImages && <><input ref={fileInput} className="warehouse-ai-chat__file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || busy || attachments.length >= maxChatImages} onChange={event => { selectImages(event.currentTarget.files); event.currentTarget.value = ""; }} />
          <button type="button" className="warehouse-ai-chat__attach" title="Đính kèm ảnh vật phẩm" aria-label="Đính kèm ảnh vật phẩm" disabled={disabled || busy || attachments.length >= maxChatImages} onClick={() => fileInput.current?.click()}><ImagePlus size={19} /></button></>}
        <textarea value={draft} maxLength={2000} rows={2} disabled={disabled || busy} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown}
          placeholder="Nhập tin nhắn…" aria-label="Tin nhắn cho trợ lý AI" />
        <button type="button" className="secondary-button" disabled={disabled || busy || (!draft.trim() && !attachments.length)} onClick={() => void sendMessage()}><Send size={16} /> Gửi</button>
      </div>
    </section>}
    <button type="button" className="warehouse-ai-widget__launcher" title={open ? "Trợ lý AI đang mở" : "Mở trợ lý AI"}
      aria-label={open ? "Trợ lý AI đang mở" : "Mở trợ lý AI kho"} aria-expanded={open} aria-controls="warehouse-ai-chat-panel" disabled={disabled}
      onClick={() => setOpen(value => !value)}><Bot size={29} strokeWidth={2.4} /><span>AI</span></button>
  </div>;
}
