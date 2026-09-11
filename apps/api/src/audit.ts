import { Injectable } from "@nestjs/common";
import { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { PrismaService } from "./prisma.service";

// Kunci yang selalu di-redaksi; PMB `message` adalah PII dan tidak pernah di-log.
const REDACT_KEYS = new Set(["password", "passwordhash", "token", "refreshtoken", "accesstoken", "secret", "authorization"]);

const redact = (obj: unknown, depth = 0): unknown => {
  if (depth > 4 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, 5).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest<any>();
    const method = (req.method || "").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next.handle();
    const route = String(req.route?.path ?? req.url ?? "unknown");
    // Body /pmb dan /auth tidak pernah dipersist (PII + kredensial).
    const skipBody = route.includes("/pmb") || route.includes("/auth");
    return next.handle().pipe(
      tap({
        next: () => {
          const user = req.user as { id?: string } | undefined;
          this.prisma.auditLog
            .create({
              data: {
                userId: user?.id ?? null,
                action: `${method} ${route}`,
                entity: route,
                entityId: (req.params?.id as string) ?? null,
                metadata: skipBody ? null : (redact(req.body) as any),
                ip: req.ip || req.socket?.remoteAddress || null,
              },
            })
            .catch(() => {});
        },
      }),
    );
  }
}