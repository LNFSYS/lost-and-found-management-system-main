import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { hashToken, id, randomOtp, randomToken } from "../../../shared/infrastructure/security.js";
import type { AuthSecurity } from "../application/auth-security.port.js";

export function createAuthSecurity(options: {
  bcryptSaltRounds: number;
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
}): AuthSecurity {
  return {
    id,
    hashToken,
    randomOtp,
    randomToken,
    hashPassword: (value) => bcrypt.hash(value, options.bcryptSaltRounds),
    comparePassword: (value, hash) => bcrypt.compare(value, hash),
    signAccessToken: (payload) => jwt.sign(payload, options.jwtAccessSecret, { expiresIn: options.jwtAccessExpiresIn } as SignOptions)
  };
}
