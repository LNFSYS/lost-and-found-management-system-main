import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { createActivityUseCases } from "../../application/activity.use-cases.js";
const filters = z.object({ query:z.string().max(100).optional(),source:z.enum(["ADMIN","CLAIM","CUSTODY","WAREHOUSE","REPORT","MODERATION","APPOINTMENT"]).optional(),
  actorId:z.string().uuid().optional(),targetId:z.string().uuid().optional(),from:z.string().datetime({offset:true}).optional(),to:z.string().datetime({offset:true}).optional(),page:z.coerce.number().int().min(1).max(10000).default(1) })
  .refine(q=>!q.from||!q.to||new Date(q.from)<=new Date(q.to),{path:["to"],message:"Ngày kết thúc phải sau ngày bắt đầu"});
export function createActivityRoutes(service: ReturnType<typeof createActivityUseCases>, auth: AuthMiddleware) {
  const routes = Router();
  const privateResponse: RequestHandler = (_req,res,next) => { res.set("Cache-Control","private, no-store");res.vary("Authorization");next(); };
  routes.get("/posts/:id/journey",auth.requireAuth,privateResponse,(req,res,next) => { const run=async() => {
    const q=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),asOf:z.string().datetime({offset:true}).optional()}).parse(req.query);
    res.json(await service.journey(req.auth!,z.string().uuid().parse(req.params.id),q.page,q.asOf)); };void run().catch(next); });
  routes.get("/admin/audit",auth.requireAuth,auth.requireAnyRole("ADMIN"),privateResponse,(req,res,next) => {const run=async()=>res.json(await service.audit(req.auth!,filters.parse(req.query)));void run().catch(next);});
  routes.get("/admin/audit/export",auth.requireAuth,auth.requireAnyRole("ADMIN"),privateResponse,(req,res,next)=>{const run=async()=>{
    const format=z.enum(["csv","json"]).default("csv").parse(req.query.format);
    const content=await service.exportAudit(req.auth!,filters.parse(req.query),format);
    res.set("Content-Disposition",`attachment; filename="lnfs-audit.${format}"`).type(format==="csv" ? "text/csv; charset=utf-8" : "application/json").send(content);
  };void run().catch(next);});
  return routes;
}
