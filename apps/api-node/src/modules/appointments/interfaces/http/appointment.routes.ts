import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { createAppointmentUseCases } from "../../application/appointment.use-cases.js";

const uuid = z.string().uuid();
const proposal = z.object({ claimId: uuid, proposedAt: z.string().datetime({ offset: true }),
  handoverPointId: uuid.optional(), customLocation: z.string().trim().min(3).max(255).regex(/^[^\u0000-\u001f\u007f]+$/).optional(),
  requestKey: uuid }).strict().refine(input => Boolean(input.handoverPointId) !== (input.customLocation !== undefined),
  { message: "Chọn một điểm bàn giao hoặc nhập địa điểm riêng", path: ["customLocation"] });
const decision = z.object({ action: z.enum(["ACCEPT","REJECT","CANCEL","CONFIRM","DISPUTE","NO_SHOW"]), version: z.number().int().min(1), requestKey: uuid, physicallyChecked: z.boolean().optional(), reason:z.string().trim().max(500).optional() }).strict();

const acceptShortcutSchema = z.object({
  version: z.number().int().min(1).optional(),
  requestKey: uuid.optional()
}).strict().default({});

const rejectShortcutSchema = z.object({
  version: z.number().int().min(1).optional(),
  requestKey: uuid.optional(),
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional()
}).strict().default({});

const cancelShortcutSchema = z.object({
  version: z.number().int().min(1).optional(),
  requestKey: uuid.optional(),
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional()
}).strict().default({});

const confirmHandoverShortcutSchema = z.object({
  version: z.number().int().min(1).optional(),
  requestKey: uuid.optional(),
  physicallyChecked: z.boolean().optional(),
  reason: z.string().trim().max(500).optional()
}).strict().default({});

export function createAppointmentRoutes(service: ReturnType<typeof createAppointmentUseCases>, auth: AuthMiddleware) {
  const routes = Router(); routes.use(auth.requireAuth);
  routes.use((_req,res,next) => { res.set("Cache-Control","private, no-store"); res.vary("Authorization"); next(); });
  routes.get("/", (req,res,next) => { const run = async () => {
    const query = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), claimId: uuid.optional() }).parse(req.query);
    res.json(await service.list(req.auth!.sub,query.page,query.claimId)); }; void run().catch(next); });
  routes.get("/:id", (req,res,next) => { const run = async () => res.json(await service.get(req.auth!.sub,uuid.parse(req.params.id))); void run().catch(next); });
  routes.post("/", (req,res,next) => { const run = async () => res.status(201).json(await service.create(req.auth!.sub,proposal.parse(req.body))); void run().catch(next); });
  async function performAction(
    req: Request,
    appointmentId: string,
    action: "ACCEPT" | "REJECT" | "CANCEL" | "CONFIRM",
    validatedData: { version?: number; requestKey?: string; reason?: string; physicallyChecked?: boolean } = {}
  ) {
    const userId = req.auth!.sub;
    let version = validatedData.version;
    if (typeof version !== "number") {
      const current = await service.get(userId, appointmentId);
      version = current.version;
    }
    const headerKey = req.header("Idempotency-Key")?.trim();
    const requestKey = (headerKey && uuid.safeParse(headerKey).success)
      ? headerKey
      : (validatedData.requestKey || randomUUID());

    return service.act(userId, appointmentId, {
      action,
      version,
      requestKey,
      ...(validatedData.physicallyChecked !== undefined ? { physicallyChecked: validatedData.physicallyChecked } : {}),
      ...(validatedData.reason !== undefined ? { reason: validatedData.reason } : {})
    });
  }
  routes.post("/:id/actions", (req,res,next) => { const run = async () => res.json(await service.act(req.auth!.sub,uuid.parse(req.params.id),decision.parse(req.body))); void run().catch(next); });
  routes.post("/:id/accept", (req, res, next) => {
    const run = async () => {
      const body = acceptShortcutSchema.parse(req.body ?? {});
      res.json(await performAction(req, uuid.parse(req.params.id), "ACCEPT", body));
    };
    void run().catch(next);
  });
  routes.post("/:id/reject", (req, res, next) => {
    const run = async () => {
      const body = rejectShortcutSchema.parse(req.body ?? {});
      const reason = body.reason || body.note || "Từ chối lịch hẹn";
      res.json(await performAction(req, uuid.parse(req.params.id), "REJECT", { ...body, reason }));
    };
    void run().catch(next);
  });
  routes.post("/:id/cancel", (req, res, next) => {
    const run = async () => {
      const body = cancelShortcutSchema.parse(req.body ?? {});
      const reason = body.reason || body.note || "Hủy lịch hẹn đã đặt";
      res.json(await performAction(req, uuid.parse(req.params.id), "CANCEL", { ...body, reason }));
    };
    void run().catch(next);
  });
  routes.post("/:id/confirm-handover", (req, res, next) => {
    const run = async () => {
      const body = confirmHandoverShortcutSchema.parse(req.body ?? {});
      res.json(await performAction(req, uuid.parse(req.params.id), "CONFIRM", { ...body, physicallyChecked: body.physicallyChecked ?? true }));
    };
    void run().catch(next);
  });
  return routes;
}
