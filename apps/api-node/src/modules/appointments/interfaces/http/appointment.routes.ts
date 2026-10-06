import { Router } from "express";
import { z } from "zod";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { createAppointmentUseCases } from "../../application/appointment.use-cases.js";

const uuid = z.string().uuid();
const proposal = z.object({ claimId: uuid, proposedAt: z.string().datetime({ offset: true }), handoverPointId: uuid, requestKey: uuid }).strict();
const decision = z.object({ action: z.enum(["ACCEPT","REJECT","CANCEL","CONFIRM","DISPUTE","NO_SHOW"]), version: z.number().int().min(1), requestKey: uuid, physicallyChecked: z.boolean().optional(), reason:z.string().trim().max(500).optional() }).strict();
export function createAppointmentRoutes(service: ReturnType<typeof createAppointmentUseCases>, auth: AuthMiddleware) {
  const routes = Router(); routes.use(auth.requireAuth);
  routes.use((_req,res,next) => { res.set("Cache-Control","private, no-store"); res.vary("Authorization"); next(); });
  routes.get("/", (req,res,next) => { const run = async () => {
    const query = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), claimId: uuid.optional() }).parse(req.query);
    res.json(await service.list(req.auth!.sub,query.page,query.claimId)); }; void run().catch(next); });
  routes.get("/:id", (req,res,next) => { const run = async () => res.json(await service.get(req.auth!.sub,uuid.parse(req.params.id))); void run().catch(next); });
  routes.post("/", (req,res,next) => { const run = async () => res.status(201).json(await service.create(req.auth!.sub,proposal.parse(req.body))); void run().catch(next); });
  routes.post("/:id/actions", (req,res,next) => { const run = async () => res.json(await service.act(req.auth!.sub,uuid.parse(req.params.id),decision.parse(req.body))); void run().catch(next); });
  return routes;
}
