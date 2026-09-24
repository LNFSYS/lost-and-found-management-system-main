import { KeyRound } from "lucide-react";

export function OtpCodeInput({ value, onChange, label = "Mã OTP gồm 6 số" }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return <label className="otp-field">
    <span><KeyRound size={17} />{label}</span>
    <input
      className="otp-field__input"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      pattern="[0-9]{6}"
      placeholder="••••••"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      required
    />
    <small>Nhập mã trong email. Mã chỉ dùng một lần và có thời hạn.</small>
  </label>;
}
