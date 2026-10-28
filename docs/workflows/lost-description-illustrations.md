# Anh minh hoa cho bai LOST

Tinh nang tao anh minh hoa chi dung Cloudflare Workers AI; khong can `GEMINI_API_KEY`.
Gemini van co the duoc dung boi cac chuc nang phan tich anh khac, khong lien quan toi luong nay.

## Luong xu ly

1. Server kiem tra danh muc va truy xuat tai lieu tham chieu noi bo; danh muc/mieu ta khong phu hop bi tu choi.
2. Cloudflare Llama trich xuat vat pham va cac dac diem duoc neu ro trong mo ta.
3. Cloudflare FLUX tao anh minh hoa. Cloudflare Moondream kiem tra anh; ket qua khong ro rang se bi tu choi.
4. Anh duoc validate, luu rieng tu va chi chu bai co the doc/chon de gan vao bai LOST.

RAG chi gioi han yeu cau theo danh muc va tai lieu tham chieu; AI co the sai, nen anh chi la minh hoa, khong phai anh that hay bang chung so huu. Khong dua contact, serial, ma QR, khuon mat, chat/evidence rieng tu vao prompt.

## Cau hinh

Them vao `.env` o thu muc goc:

```dotenv
LOST_ILLUSTRATION_ENABLED=true
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_IMAGE_STEPS=4
CLOUDFLARE_ILLUSTRATION_TEXT_MODEL=@cf/meta/llama-3.2-3b-instruct
CLOUDFLARE_ILLUSTRATION_VISION_MODEL=@cf/moondream/moondream3.1-9B-A2B
CLOUDFLARE_ILLUSTRATION_TIMEOUT_MS=90000
```

Token can quyen Workers AI. Khoi dong lai API sau khi sua `.env`. Khong dua token vao frontend hoac commit. Cac model text/vision cung su dung quota Workers AI cua tai khoan.

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
