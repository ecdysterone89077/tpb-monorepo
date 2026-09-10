import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, RolesGuard } from "./auth";
import { AuditInterceptor } from "./audit";
import { AuthController } from "./controllers/auth.controller";
import { ContentController } from "./controllers/content.controller";
import { PostsController } from "./controllers/posts.controller";
import { PmbController } from "./controllers/pmb.controller";
import { PublicController } from "./controllers/public.controller";
import { AdminController } from "./controllers/admin.controller";

const jwtSecret = process.env.JWT_ACCESS_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("JWT_ACCESS_SECRET wajib di production."); })() : "development-only-secret");
const accessTtlSeconds = Number(process.env.JWT_ACCESS_TTL_SECONDS || 900);

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), JwtModule.register({ secret: jwtSecret, signOptions: { expiresIn: accessTtlSeconds } })],
  controllers: [AuthController, ContentController, PostsController, PmbController, PublicController, AdminController],
  providers: [PrismaService, JwtAuthGuard, RolesGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
