import { JwtAuthGuard, RolesGuard, hashToken, newRefreshToken, safeUser } from "./auth";
import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Role } from "@tpb/contracts";

describe("hashToken", () => {
  it("menghasilkan SHA-256 hex 64 karakter yang deterministik", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("newRefreshToken", () => {
  it("menghasilkan token acak yang unik dan cukup panjang", () => {
    const a = newRefreshToken();
    const b = newRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(48);
  });
});

describe("safeUser", () => {
  it("hanya mengekspos id, email, role, name — tidak pernah passwordHash", () => {
    const out = safeUser({ id: "u1", email: "a@b.c", role: "ADMIN" as Role, name: "A", passwordHash: "secret-hash", isActive: true });
    expect(out).toEqual({ id: "u1", email: "a@b.c", role: "ADMIN", name: "A" });
    expect("passwordHash" in out).toBe(false);
  });
});

describe("JwtAuthGuard", () => {
  const makeCtx = (authHeader?: string) => {
    const req: any = { headers: authHeader ? { authorization: authHeader } : {} };
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  };

  it("menolak tanpa header Authorization", () => {
    const guard = new JwtAuthGuard({ verify: jest.fn() } as any);
    expect(() => guard.canActivate(makeCtx())).toThrow(UnauthorizedException);
  });

  it("menolak token invalid", () => {
    const guard = new JwtAuthGuard({ verify: () => { throw new Error("bad"); } } as any);
    expect(() => guard.canActivate(makeCtx("Bearer nope"))).toThrow(UnauthorizedException);
  });

  it("menerima token valid dan menempel user ke request", () => {
    const user = { id: "u1", email: "a@b.c", role: "ADMIN" as Role, name: "A" };
    const guard = new JwtAuthGuard({ verify: () => user } as any);
    const ctx = makeCtx("Bearer good");
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual(user);
  });
});

describe("RolesGuard", () => {
  const makeCtx = (roles: Role[] | undefined, user?: { role: Role }) => {
    const handler = () => {};
    if (roles) Reflect.defineMetadata("roles", roles, handler);
    const req: any = { user };
    return { getHandler: () => handler, switchToHttp: () => ({ getRequest: () => req }) } as any;
  };

  it("lolos jika endpoint tidak menuntut role", () => {
    const guard = new RolesGuard();
    expect(guard.canActivate(makeCtx(undefined, undefined))).toBe(true);
  });

  it("menolak user tanpa role yang cukup", () => {
    const guard = new RolesGuard();
    expect(() => guard.canActivate(makeCtx(["ADMIN"], { role: "OPERATOR" }))).toThrow(ForbiddenException);
  });

  it("menerima role yang diizinkan", () => {
    const guard = new RolesGuard();
    expect(guard.canActivate(makeCtx(["ADMIN", "EDITOR"], { role: "EDITOR" }))).toBe(true);
  });

  it("menolak request tanpa user saat role dituntut", () => {
    const guard = new RolesGuard();
    expect(() => guard.canActivate(makeCtx(["ADMIN"], undefined))).toThrow(ForbiddenException);
  });
});
