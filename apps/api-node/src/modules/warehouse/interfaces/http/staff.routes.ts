import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { CustodyRequestController } from "./custody-request.controller.js";
import type { WarehouseController } from "./warehouse.controller.js";

export function createStaffRoutes({ warehouseController, custodyRequestController, auth }: {
  warehouseController: WarehouseController;
  custodyRequestController: CustodyRequestController;
  auth: AuthMiddleware;
}) {
  const { requireAnyRole, requireAuth } = auth;
  const staffRoutes = Router();

  // Allow any authenticated user (Finder / Staff / Admin) to create custody requests
  staffRoutes.post("/custody-requests", requireAuth, (req, res, next) => custodyRequestController.createRequest(req, res).catch(next));
  staffRoutes.get("/custody-requests/mine/post/:postId", requireAuth, (req, res, next) => custodyRequestController.getMyRequestByPost(req, res).catch(next));
  staffRoutes.get("/custody-requests/:id", requireAuth, (req, res, next) => custodyRequestController.getRequest(req, res).catch(next));
  staffRoutes.patch("/custody-requests/:id/cancel", requireAuth, (req, res, next) => custodyRequestController.cancelRequest(req, res).catch(next));

  // Restricted routes for Staff and Admin only
  staffRoutes.use(requireAuth, requireAnyRole("STAFF", "ADMIN"));

  // Warehouse items
  const proofUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 }
  });

  function uploadProofMiddleware(request: Request, response: Response, next: NextFunction) {
    proofUpload.single("file")(request, response, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        return next(new HttpError(
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          error.code === "LIMIT_FILE_SIZE" ? "Ảnh bằng chứng không được vượt quá 5 MB" : "Tệp ảnh bằng chứng không hợp lệ"
        ));
      }
      next(error);
    });
  }

  staffRoutes.get("/warehouse-items/catalog", (req, res, next) => warehouseController.getCatalog(req, res).catch(next));
  staffRoutes.get("/warehouse-items", (req, res, next) => warehouseController.listItems(req, res).catch(next));
  staffRoutes.post("/warehouse-items", (req, res, next) => warehouseController.createItem(req, res).catch(next));
  staffRoutes.post("/warehouse-items/upload-proof", uploadProofMiddleware, (req, res, next) => warehouseController.uploadProof(req, res).catch(next));
  staffRoutes.get("/warehouse-proofs/:id", (req, res, next) => warehouseController.getProof(req, res).catch(next));
  staffRoutes.post("/warehouse-items/:id/reserve", (req, res, next) => warehouseController.reserveItem(req, res).catch(next));
  staffRoutes.post("/warehouse-items/:id/release-reservation", (req, res, next) => warehouseController.releaseReservation(req, res).catch(next));
  staffRoutes.post("/warehouse-items/:id/legal-hold", (req, res, next) => warehouseController.legalHold(req, res).catch(next));
  staffRoutes.post("/warehouse-items/:id/disposition", (req, res, next) => warehouseController.requestDisposition(req, res).catch(next));
  staffRoutes.post("/warehouse-approvals/:id/approve", (req, res, next) => warehouseController.approveDisposition(req, res).catch(next));
  staffRoutes.post("/warehouse-approvals/:id/execute", (req, res, next) => warehouseController.executeDisposition(req, res).catch(next));
  staffRoutes.patch("/warehouse-items/:id", (req, res, next) => warehouseController.updateItem(req, res).catch(next));
  staffRoutes.post("/warehouse-items/:id/return", (req, res, next) => warehouseController.returnItem(req, res).catch(next));
  staffRoutes.get("/warehouse-items/:id/return-recipients", (req, res, next) => warehouseController.returnRecipients(req, res).catch(next));
  staffRoutes.get("/warehouse-items/:id/logs", (req, res, next) => warehouseController.listLogs(req, res).catch(next));

  // Custody request management
  staffRoutes.get("/custody-requests", (req, res, next) => custodyRequestController.listRequests(req, res).catch(next));
  staffRoutes.patch("/custody-requests/:id/accept", (req, res, next) => custodyRequestController.acceptRequest(req, res).catch(next));
  staffRoutes.patch("/custody-requests/:id/reject", (req, res, next) => custodyRequestController.rejectRequest(req, res).catch(next));
  staffRoutes.post("/custody-requests/:id/intake", (req, res, next) => custodyRequestController.confirmIntake(req, res).catch(next));

  return staffRoutes;
}
