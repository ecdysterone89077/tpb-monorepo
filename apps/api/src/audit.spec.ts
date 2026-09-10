import { AuditInterceptor } from "./audit";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";

const makeCtx = (opts: { method: string; url?: string; routePath?: string; body?: unknown; user?: { id: string }; params?: Record<string, string>; ip?: string }) => {
  const req: any = {
    method: opts.method,
    url: opts.url ?? "/v1/x",
    route: opts.routePath ? { path: opts.routePath } : undefined,
    body: opts.body,
    user: opts.user,
    params: opts.params,
    headers: opts.ip ? { "x-forwarded-for": opts.ip } : {},
    socket: { remoteAddress: "127.0.0.1" },
  };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
};

const makePrisma = () => ({ auditLog: { create: jest.fn().mockResolvedValue({}) } });

const run = async (interceptor: AuditInterceptor, ctx: ExecutionContext) => {
  const next: CallHandler = { handle: () => of("response") };
  return new Promise((resolve) => {
    interceptor.intercept(ctx, next).subscribe({ next: resolve });
  });
};

describe("AuditInterceptor", () => {
  it("GET tidak menghasilkan audit", async () => {
    const prisma = makePrisma();
    const i = new AuditInterceptor(prisma as any);
    await run(i, makeCtx({ method: "GET", routePath: "/v1/posts" }));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("POST tercatat dengan action entity entityId", async () => {
    const prisma = makePrisma();
    const i = new AuditInterceptor(prisma as any);
    await run(i, makeCtx({ method: "POST", routePath: "/v1/posts", body: { title: "x" }, user: { id: "u1" } }));
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const args = prisma.auditLog.create.mock.calls[0][0];
    expect(args.data.action).toBe("POST /v1/posts");
    expect(args.data.userId).toBe("u1");
  });

  it("password di body di-redaksi", async () => {
    const prisma = makePrisma();
    const i = new AuditInterceptor(prisma as any);
    await run(i, makeCtx({ method: "PUT", routePath: "/v1/users/:id", body: { password: "supersecret", name: "A" }, params: { id: "u9" } }));
    const md = prisma.auditLog.create.mock.calls[0][0].data.metadata;
    expect(md.password).toBe("[redacted]");
    expect(md.name).toBe("A");
  });

  it("nested passwordHash + token di-redaksi", async () => {
    const prisma = makePrisma();
    const i = new AuditInterceptor(prisma as any);
    await run(i, makeCtx({ method: "POST", routePath: "/v1/x", body: { nested: { passwordHash: "h", token: "t", keep: 1 } } }));
    const md = prisma.auditLog.create.mock.calls[0][0].data.metadata;
    expect(md.nested.passwordHash).toBe("[redacted]");
    expect(md.nested.token).toBe("[redacted]");
    expect(md.nested.keep).toBe(1);
  });

  it("body /pmb tidak pernah dipersist (PII message)", async () => {
    const prisma = makePrisma();
    const i = new AuditInterceptor(prisma as any);
    await run(i, makeCtx({ method: "POST", url: "/v1/pmb", routePath: "/pmb", body: { name: "x", message: "PII" } }));
    const args = prisma.auditLog.create.mock.calls[0][0];
    expect(args.data.metadata).toBeNull();
  });

  it("body /auth tidak pernah dipersist (kredensial)", async () => {
    const prisma = makePrisma();
    const i = new AuditInterceptor(prisma as any);
    await run(i, makeCtx({ method: "POST", routePath: "/auth/login", body: { email: "a@b.c", password: "x" } }));
    const args = prisma.auditLog.create.mock.calls[0][0];
    expect(args.data.metadata).toBeNull();
  });

  it("kegagalan audit tidak menggagalkan request (fire-and-forget)", async () => {
    const prisma = { auditLog: { create: jest.fn().mockRejectedValue(new Error("db down")) } };
    const i = new AuditInterceptor(prisma as any);
    const captured = await run(i, makeCtx({ method: "POST", routePath: "/v1/posts", body: {} }));
    expect(captured).toBe("response");
  });
});
