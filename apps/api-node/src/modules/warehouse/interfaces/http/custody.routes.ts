import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { CustodyController } from "./custody.controller.js";

export function createCustodyRoutes({
  custodyController,
  auth
}: {
  custodyController: CustodyController;
  auth: AuthMiddleware;
}) {
  const router = Router();

  // Finder endpoints (Authenticated user)
  router.post(
    "/custody-requests",
    auth.requireAuth,
    (req, res, next) => custodyController.createCustodyRequest(req, res).catch(next)
  );
  router.get(
    "/custody-requests/my",
    auth.requireAuth,
    (req, res, next) => custodyController.listMyCustodyRequests(req, res).catch(next)
  );
  router.get(
    "/custody-requests/:id",
    auth.requireAuth,
    (req, res, next) => custodyController.getCustodyRequestDetail(req, res).catch(next)
  );
  router.post(
    "/custody-requests/:id/cancel",
    auth.requireAuth,
    (req, res, next) => custodyController.cancelCustodyRequest(req, res).catch(next)
  );

  // Staff / Admin endpoints
  router.get(
    "/staff/custody-requests",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => custodyController.listStaffCustodyRequests(req, res).catch(next)
  );
  router.post(
    "/staff/custody-requests/:id/accept",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => custodyController.acceptCustodyRequest(req, res).catch(next)
  );
  router.post(
    "/staff/custody-requests/:id/reject",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => custodyController.rejectCustodyRequest(req, res).catch(next)
  );
  router.post(
    "/staff/custody-requests/:id/intake",
    auth.requireAuth,
    auth.requireAnyRole("STAFF", "ADMIN"),
    (req, res, next) => custodyController.confirmStaffIntake(req, res).catch(next)
  );

  return router;
}
