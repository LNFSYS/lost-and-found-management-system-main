import type { Request, Response } from "express";
import { adminUserService } from "../services/admin-user.service.js";
import {
  adminUserIdParamSchema,
  createAdminUserSchema,
  deleteAdminUserSchema,
  listAdminUsersQuerySchema,
  updateAdminUserRoleSchema,
  updateAdminUserSchema,
  updateAdminUserStatusSchema
} from "../validators/admin-user.validator.js";

function routeId(request: Request) {
  return adminUserIdParamSchema.parse(request.params).id;
}

function actorId(request: Request) {
  return request.auth!.sub;
}

export const adminUserController = {
  async listUsers(request: Request, response: Response) {
    response.json(await adminUserService.listUsers(listAdminUsersQuerySchema.parse(request.query)));
  },

  async getUser(request: Request, response: Response) {
    response.json(await adminUserService.getUser(routeId(request)));
  },

  async createUser(request: Request, response: Response) {
    response.status(201).json(await adminUserService.createUser(actorId(request), createAdminUserSchema.parse(request.body)));
  },

  async updateUser(request: Request, response: Response) {
    response.json(await adminUserService.updateUser(actorId(request), routeId(request), updateAdminUserSchema.parse(request.body)));
  },

  async changeRole(request: Request, response: Response) {
    response.json(await adminUserService.changeRole(actorId(request), routeId(request), updateAdminUserRoleSchema.parse(request.body)));
  },

  async changeStatus(request: Request, response: Response) {
    response.json(await adminUserService.changeStatus(actorId(request), routeId(request), updateAdminUserStatusSchema.parse(request.body)));
  },

  async deleteUser(request: Request, response: Response) {
    const input = deleteAdminUserSchema.parse(request.body ?? {});
    await adminUserService.deleteUser(actorId(request), routeId(request), input.reason);
    response.status(204).send();
  }
};
