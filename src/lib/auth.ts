import { SignJWT, jwtVerify } from "jose";
import { User, UserPermissions } from "./types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "avp-system-secret-key-change-in-production"
);

const TOKEN_EXPIRY = "8h";

export async function createToken(user: User): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    permissoes: user.permissoes,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{
  userId: string;
  email: string;
  nome: string;
  perfil: string;
  permissoes: UserPermissions;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as any;
  } catch {
    return null;
  }
}

export function isAdmin(perfil: string): boolean {
  return perfil === "Admin";
}

export function hasPermission(
  permissoes: UserPermissions,
  page: keyof UserPermissions
): boolean {
  return permissoes[page] === true;
}
