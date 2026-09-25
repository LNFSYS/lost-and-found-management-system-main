import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { DispositionController } from "./disposition.controller.js";

export function createDispositionRoutes({
  dispositionController,
  auth
}: {
  dispositionController: DispositionController;
  auth: AuthMiddleware;
}) {
  const router = Router();

  // Overdue monitoring & eligibility (Staff & Admin)
  router.get(
    "/staff/warehouse/overdue",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => dispositionController.listOverdueItems(req, res).catch(next)
  );
  router.get(
    "/staff/warehouse/items/:id/overdue-detail",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => dispositionController.getOverdueItemDetail(req, res).catch(next)
  );
  router.get(
    "/staff/warehouse/items/:id/disposition-eligibility",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => dispositionController.checkEligibility(req, res).catch(next)
  );

  // Legal holds (Admin only)
  router.post(
    "/admin/warehouse/items/:id/legal-hold",
    auth.requireAuth,
    auth.requireAnyRole("ADMIN"),
    (req, res, next) => dispositionController.applyLegalHold(req, res).catch(next)
  );
  router.post(
    "/admin/warehouse/items/:id/legal-hold/:holdId/release",
    auth.requireAuth,
    auth.requireAnyRole("ADMIN"),
    (req, res, next) => dispositionController.releaseLegalHold(req, res).catch(next)
  );

  // Disposition Orders
  router.post(
    "/admin/disposition-orders",
    auth.requireAuth,
    auth.requireAnyRole("ADMIN"),
    (req, res, next) => dispositionController.createDispositionOrder(req, res).catch(next)
  );
  router.get(
    "/staff/disposition-orders",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => dispositionController.listDispositionOrders(req, res).catch(next)
  );
  router.get(
    "/staff/disposition-orders/:id",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => dispositionController.getDispositionOrderDetail(req, res).catch(next)
  );
  router.post(
    "/admin/disposition-orders/:id/approve",
    auth.requireAuth,
    auth.requireAnyRole("ADMIN"),
    (req, res, next) => dispositionController.approveDispositionOrder(req, res).catch(next)
  );
  router.post(
    "/admin/disposition-orders/:id/reject",
    auth.requireAuth,
    auth.requireAnyRole("ADMIN"),
    (req, res, next) => dispositionController.rejectDispositionOrder(req, res).catch(next)
  );
  router.post(
    "/admin/disposition-orders/:id/cancel",
    auth.requireAuth,
    auth.requireAnyRole("ADMIN"),
    (req, res, next) => dispositionController.cancelDispositionOrder(req, res).catch(next)
  );
  router.post(
    "/staff/disposition-orders/:id/execute",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => dispositionController.executeDisposition(req, res).catch(next)
  );

  return router;
}
