import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { ReportController } from "./report.controller.js";

export function createReportRoutes({ controller, auth }: { controller: ReportController; auth: AuthMiddleware }) {
  const routes = Router();
  routes.use(auth.requireAuth);
  routes.post("/", (req, res, next) => controller.submit(req, res).catch(next));
  routes.get("/mine", (req, res, next) => controller.listMine(req, res).catch(next));
  routes.get("/mine/:id", (req, res, next) => controller.getMine(req, res).catch(next));
  routes.post("/mine/:id/withdraw", (req, res, next) => controller.withdraw(req, res).catch(next));
  return routes;
}
