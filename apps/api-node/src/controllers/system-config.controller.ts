import type { Request, Response } from "express";
import { systemConfigService } from "../services/system-config.service.js";
import { configIdParamSchema, createConfigSchema, listConfigsQuerySchema, updateConfigSchema } from "../validators/system-config.validator.js";

function routeId(request: Request) {
  return configIdParamSchema.parse(request.params).id;
}

function actorId(request: Request) {
  return request.auth!.sub;
}

export const systemConfigController = {
  async listConfigs(request: Request, response: Response) {
    response.json(await systemConfigService.listConfigs(listConfigsQuerySchema.parse(request.query)));
  },

  async getConfig(request: Request, response: Response) {
    response.json(await systemConfigService.getConfig(routeId(request)));
  },

  async createConfig(request: Request, response: Response) {
    response.status(201).json(await systemConfigService.createConfig(actorId(request), createConfigSchema.parse(request.body)));
  },

  async updateConfig(request: Request, response: Response) {
    response.json(await systemConfigService.updateConfig(actorId(request), routeId(request), updateConfigSchema.parse(request.body)));
  },

  async deleteConfig(request: Request, response: Response) {
    await systemConfigService.deleteConfig(actorId(request), routeId(request));
    response.status(204).send();
  },

  async getPublicConfig(_request: Request, response: Response) {
    response.json(await systemConfigService.listPublicConfigs());
  }
};
