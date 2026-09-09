import type { Request, Response } from "express";
import type { SystemConfigUseCases } from "../../application/system-config.use-cases.js";
import { configHistoryQuerySchema, configIdParamSchema, createConfigSchema, listConfigsQuerySchema, updateConfigSchema } from "./system-config.validator.js";

export function createSystemConfigController({ systemConfigService }: {
  systemConfigService: SystemConfigUseCases;
}) {
  function routeId(request: Request) {
    return configIdParamSchema.parse(request.params).id;
  }
  function actorId(request: Request) {
    return request.auth!.sub;
  }
  const systemConfigController = {
    async listConfigs(request: Request, response: Response) {
      response.json(await systemConfigService.listConfigs(listConfigsQuerySchema.parse(request.query)));
    },

    async getConfig(request: Request, response: Response) {
      response.json(await systemConfigService.getConfig(routeId(request)));
    },

    async listHistory(request: Request, response: Response) {
      response.json(await systemConfigService.listHistory(routeId(request), configHistoryQuerySchema.parse(request.query)));
    },

    async createConfig(request: Request, response: Response) {
      response.status(201).json(await systemConfigService.createConfig(actorId(request), createConfigSchema.parse(request.body)));
    },

    async updateConfig(request: Request, response: Response) {
      response.json(await systemConfigService.updateConfig(actorId(request), routeId(request), updateConfigSchema.parse(request.body)));
    },

    async deleteConfig(request: Request, response: Response) {
      const reason = typeof request.body?.reason === "string" ? request.body.reason : null;
      await systemConfigService.deleteConfig(actorId(request), routeId(request), reason);
      response.status(204).send();
    },

    async getPublicConfig(_request: Request, response: Response) {
      response.json(await systemConfigService.listPublicConfigs());
    }
  };
  return systemConfigController;
}
export type SystemConfigController = ReturnType<typeof createSystemConfigController>;
