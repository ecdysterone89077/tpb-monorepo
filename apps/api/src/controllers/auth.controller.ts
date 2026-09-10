import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash } from "@node-rs/argon2";
import type { Request, Response } from "express";
import { BootstrapSchema, LoginSchema, type Role } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, RequestUser, hashToken, newRefreshToken, safeUser, verifyPassword } from "../auth";
import { parse } from "../zod";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CookieRequest = Request & { user?: RequestUser };

@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax" as const,
      path: "/v1/auth",
      domain: process.env.COOKIE_DOMAIN || undefined,
      maxAge: REFRESH_TTL_MS,
    };
  }

  private async issueTokens(user: { id: string; email: string; role: Role; name: string | null }, res: Response) {
    const rawRefresh = newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { tokenHash: hashToken(rawRefresh), userId: user.id, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    const accessToken = await this.jwt.signAsync(safeUser(user));
    res.cookie(process.env.COOKIE_NAME || "tpb_refresh", rawRefresh, this.cookieOptions());
    return { token: accessToken, expiresIn: ACCESS_TTL_SECONDS, user };
  }

  @Post("bootstrap")
  async bootstrap(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { name, email, password } = parse(BootstrapSchema, body);
    if ((await this.prisma.user.count()) > 0) throw new UnauthorizedException("Akun admin sudah terdaftar.");
    const user = await this.prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash: await hash(password), role: "ADMIN" },
    });
    return this.issueTokens({ id: user.id, email: user.email, role: user.role as Role, name: user.name }, res);
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { email, password } = parse(LoginSchema, body);
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedException("Email atau kata sandi salah.");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens({ id: user.id, email: user.email, role: user.role as Role, name: user.name }, res);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const name = process.env.COOKIE_NAME || "tpb_refresh";
    const raw = req.cookies?.[name] as string | undefined;
    if (!raw) throw new UnauthorizedException("Refresh token diperlukan.");
    const current = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
    if (!current || current.revokedAt || current.expiresAt <= new Date() || !current.user.isActive) {
      throw new UnauthorizedException("Refresh token tidak valid.");
    }
    const nextRaw = newRefreshToken();
    const next = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({ data: { tokenHash: hashToken(nextRaw), userId: current.userId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } });
      await tx.refreshToken.update({ where: { id: current.id }, data: { revokedAt: new Date(), replacedById: created.id } });
      return created;
    });
    void next;
    const user = safeUser(current.user);
    const accessToken = await this.jwt.signAsync(user);
    res.cookie(name, nextRaw, this.cookieOptions());
    return { token: accessToken, expiresIn: ACCESS_TTL_SECONDS, user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const name = process.env.COOKIE_NAME || "tpb_refresh";
    const raw = req.cookies?.[name] as string | undefined;
    if (raw) await this.prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(raw), revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(name, this.cookieOptions());
    return { ok: true };
  }

  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logoutAll(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    if (req.user) await this.prisma.refreshToken.updateMany({ where: { userId: req.user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(process.env.COOKIE_NAME || "tpb_refresh", this.cookieOptions());
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: CookieRequest) {
    const user = req.user;
    if (!user) throw new UnauthorizedException("Sesi tidak berlaku.");
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !dbUser.isActive) throw new UnauthorizedException("Sesi tidak berlaku.");
    return { user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, isActive: dbUser.isActive } };
  }
}