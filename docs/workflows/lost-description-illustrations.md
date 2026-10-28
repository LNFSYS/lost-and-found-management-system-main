# Anh minh hoa cho bai LOST

Tinh nang tao anh minh hoa chi dung Cloudflare Workers AI; khong can `GEMINI_API_KEY`.
Gemini van co the duoc dung boi cac chuc nang phan tich anh khac, khong lien quan toi luong nay.

## Luong xu ly

1. Server kiem tra danh muc va truy xuat tai lieu tham chieu noi bo; danh muc/mieu ta khong phu hop bi tu choi.
2. Cloudflare Llama kiem tra loai vat pham va dich cac dac diem duoc neu ro sang tieng Anh trong cung mot request. FLUX va Moondream chi nhan cac dac diem da chuan hoa; khong nhan ten danh muc/mo ta tieng Viet goc. Bai dang va fingerprint idempotency van giu nguyen noi dung nguoi dung.
3. Cloudflare FLUX tao anh minh hoa. Cloudflare Moondream kiem tra anh; ket qua khong ro rang se bi tu choi.
4. Anh duoc validate, luu rieng tu va chi chu bai co the doc/chon de gan vao bai LOST.

RAG chi gioi han yeu cau theo danh muc va tai lieu tham chieu; AI co the sai, nen anh chi la minh hoa, khong phai anh that hay bang chung so huu. Khong dua contact, serial, ma QR, khuon mat, chat/evidence rieng tu vao prompt.

Danh muc con `Vat dung khac` cho phep truy xuat loai vat pham tu mo ta, nhung chi trong corpus tham chieu hien co. Vi du binh nuoc LocknLock mau trang kem, nap den duoc truy xuat thanh `bottle`. Cac danh muc cu the van phai khop loai vat pham. Truy xuat dung ten vat pham day du, khong tach `trang suc` thanh tu `trang` de nhan nham mau trang. Llama van kiem tra ngu nghia va Moondream van duyet anh; khong bo qua kiem tra an toan. Loi truy xuat truoc khi cap luot khong tieu hao luot tao anh.

## Cau hinh

Them vao `.env` o thu muc goc:

```dotenv
LOST_ILLUSTRATION_ENABLED=true
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_IMAGE_STEPS=4
CLOUDFLARE_ILLUSTRATION_TEXT_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
CLOUDFLARE_ILLUSTRATION_VISION_MODEL=@cf/moondream/moondream3.1-9B-A2B
CLOUDFLARE_ILLUSTRATION_TIMEOUT_MS=90000
```

Token can quyen Workers AI. Khoi dong lai API sau khi sua `.env`. Khong dua token vao frontend hoac commit. Cac model text/vision cung su dung quota Workers AI cua tai khoan.

Llama 3.3 70B is the English-normalization default; it uses more Workers AI quota than the earlier 8B model. The selected `-fast` variant remains active in [Cloudflare's model lifecycle notice](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/). A custom `CLOUDFLARE_ILLUSTRATION_TEXT_MODEL` overrides the default and must support JSON schema output. Only category identity is passed as retrieval context: generic example attributes are not translated into invented item details. Brand names remain unchanged. Translation is model-assisted, not a guarantee of exact image lettering or perfect semantic fidelity.

## Gioi han tao lai

Moi ban nhap LOST co toi da 4 luot: 1 lan tao ban dau va 3 lan tao lai. Replay cung `requestId` khong goi model lan nua; luot va trang thai duoc quan ly trong database. Neu provider that bai sau khi da cap luot, luot van duoc tinh de tranh tao request trung lap khong chac chan.

## Chay va kiem thu

```powershell
npm run migrate:preflight
npm run migrate
npm run dev
```

Dang nhap, mo `/home`, chon LOST, nhap danh muc va mo ta vat pham cu the, tao anh roi chon anh de dang bai. Neu khong co Cloudflare credential/Workers AI quota, UI van cho phep dang bai bang anh that hoac khong co anh.

```powershell
npm --workspace @lnfs/api-node test -- --test-name-pattern="Cloudflare.*illustration"
npm run build --workspace @lnfs/api-node
```

Test provider dung mock; can mot smoke test rieng voi Cloudflare account de xac nhan token/quota/model va upload storage thuc te.

## Provider verification - 28/10/2026

- Live probe reproduced a successful HTTP envelope with an empty Moondream `result` when streaming was not explicitly disabled. The old parser incorrectly classified this as an irrelevant image.
- Set `stream: false` and `reasoning: false`. REST returns the completed answer at `result.result.answer`; the adapter also accepts the direct answer shape.
- A concise visual question avoids echoing the specification JSON. Only complete YES/NO answers produce a content decision. Empty, uncertain, contradictory or truncated output raises a provider error and records FAILED, not REJECTED; no unverified image is selectable.
- Live description extraction and FLUX generation produced a synthetic black fabric wallet (209522-byte JPEG). The corrected adapter accepted the matching wallet description and rejected a red metal water bottle description for the same image.
- These probes did not access the application database, consume draft attempts, publish posts or upload to Cloudinary. Live storage/publication and browser end-to-end flow were not tested by these probes.

### Follow-up: exhausted wallet draft

- Read-only inspection confirmed four REJECTED attempts and no saved assets for the affected draft. The latest attempt was made after the parser fix, so reloading/restarting alone cannot restore its quota or prove that every generated image will pass review.
- Generation now uses only extracted attributes and the selected category, not generic reference examples that can introduce undescribed accessories. Review checks item type, main color/material/shape and unsafe content; it does not require exact small logo lettering or photographic lighting. The UI identifies the image as an approximation and warns about small details.
- Two live samples using the affected draft's exact title/description/category were accepted (134392 and 254283 bytes). Wrong-item and wrong-main-color controls were rejected. These diagnostic calls did not spend draft attempts or write application data.
- The UI restores the latest attempt outcome after refresh/reload, distinguishes provider failures from content rejection, and does not suggest another generation or a selectable image when all four attempts are exhausted with none READY.
- Focused backend/HTTP tests: 18 passed. Playwright illustration flow: 12 passed, including mobile/desktop publication, quota restoration and exhausted/failed attempts. API/web builds passed; Vite retains its existing large-bundle warning. Browser tests use mocked API/provider responses, separate from the live provider probes.
- Recovery of the exhausted shared-database draft requires explicit operator approval. Preserve its attempt history; do not raise the four-attempt limit or add an unrestricted user reset endpoint.

### English normalization verification

- The Llama request now validates and translates visible attributes into English in one call. The original user title, description and category remain untouched for persistence and idempotency. FLUX receives only the translated object specification, not the Vietnamese category label or retrieval examples.
- Live Vietnamese input describing a small black fabric Camelia wallet with a white logo at the bottom right produced `wallet`, `black`, `fabric` and `Camelia logo in white at bottom right corner`. Equivalent English input also retained the material, brand and logo position. No unspecified zipper or rectangular shape appeared in these final samples.
- FLUX produced a 252552-byte JPEG and Moondream accepted it. Captured downstream requests did not contain the original Vietnamese attributes. This probe used no application database or draft attempts.
- Focused provider/use-case/HTTP suite: 19 passed; API TypeScript build passed. These observations are sample evidence, not a guarantee that model translation or generation will always be exact.

### Other-items bottle regression

- Reproduced the LocknLock description rejection in a failing retrieval test: `Vat dung khac` had no item keyword, so the request failed before Llama or quota reservation.
- Added explicit catch-all retrieval using complete item aliases while keeping specific-category matching and downstream semantic/image verification.
- Focused retrieval/provider/use-case/HTTP suite: 23 passed; API TypeScript build passed.
- A live probe with the reported Vietnamese bottle description retrieved `bottle`, normalized cream-white body, black lid, 500 ml and 20 cm, generated a 92833-byte JPEG and passed vision verification. The sample omitted the brand from its structured output, so exact brand/logo fidelity is not established. No application database writes, draft charges or storage uploads occurred. Browser publication was not rerun for this backend change.
