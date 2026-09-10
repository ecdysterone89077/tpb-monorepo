import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import express from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  const mediaDir = resolve(process.env.MEDIA_DIR || "uploads");
  mkdirSync(mediaDir, { recursive: true });
  app.use("/media", express.static(mediaDir));
  app.use((req: any, res: any, next: () => void) => { req.id = req.headers["x-request-id"] || randomUUID(); res.setHeader("x-request-id", req.id); next(); });
  const configuredOrigins = process.env.CORS_ORIGINS;
  if (process.env.NODE_ENV === "production" && !configuredOrigins) throw new Error("CORS_ORIGINS wajib di production.");
  const origins = (configuredOrigins || "http://localhost:5173").split(",").map((x) => x.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder().setTitle("TPB API").setVersion("1").addBearerAuth().build();
    SwaggerModule.setup("v1/docs", app, SwaggerModule.createDocument(app, config));
  }
  await app.listen(Number(process.env.PORT || 3000));
}
bootstrap();
