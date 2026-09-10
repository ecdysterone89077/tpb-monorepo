import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import { verify } from "@node-rs/argon2";
import type { Role } from "@tpb/contracts";
import { PrismaService } from "./prisma.service";

export type RequestUser = { id: string; email: string; role: Role; name: string | null };
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newRefreshToken = () => randomBytes(48).toString("base64url");

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<any>();
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Token akses diperlukan.");
    try {
      const payload = this.jwt.verify<{ id?: string }>(token);
      if (!payload.id) throw new Error("subject missing");
      const user = await this.prisma.user.findUnique({ where: { id: payload.id } });
      if (!user?.isActive) throw new UnauthorizedException("Akun tidak aktif.");
      req.user = safeUser(user);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Token akses tidak valid atau kedaluwarsa.");
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const required = Reflect.getMetadata("roles", ctx.getHandler()) as Role[] | undefined;
    if (!required?.length) return true;
    const user = ctx.switchToHttp().getRequest<any>().user as RequestUser | undefined;
    if (!user || !required.includes(user.role)) throw new ForbiddenException("Role tidak memiliki akses.");
    return true;
  }
}

export const Roles = (...roles: Role[]) => (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
  if (descriptor) Reflect.defineMetadata("roles", roles, descriptor.value);
};
export const safeUser = (u: any): RequestUser => ({ id: u.id, email: u.email, role: u.role, name: u.name });
export const verifyPassword = (hash: string, password: string) => verify(hash, password);
