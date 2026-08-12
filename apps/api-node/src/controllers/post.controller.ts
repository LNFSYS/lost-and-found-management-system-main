import type { Request, Response } from "express";
import { postService } from "../services/post.service.js";
import {
  createPostSchema,
  idParamSchema,
  listOwnPostsQuerySchema,
  listPostsQuerySchema,
  mediaParamSchema,
  updatePostSchema,
  uploadMediaSchema
} from "../validators/post.validator.js";
import { HttpError } from "../utils/http-error.js";

function routeId(request: Request) {
  return idParamSchema.parse(request.params).id;
}

export const postController = {
  async listBoard(request: Request, response: Response) {
    response.json(await postService.listBoard(listPostsQuerySchema.parse(request.query), request.auth));
  },

  async listMine(request: Request, response: Response) {
    response.json(await postService.listMine(request.auth!.sub, listOwnPostsQuerySchema.parse(request.query)));
  },

  async getPost(request: Request, response: Response) {
    response.json(await postService.getPost(routeId(request), request.auth));
  },

  async createPost(request: Request, response: Response) {
    response.status(201).json(await postService.createPost(request.auth!.sub, createPostSchema.parse(request.body), request.auth!));
  },

  async updatePost(request: Request, response: Response) {
    response.json(await postService.updatePost(routeId(request), request.auth!.sub, updatePostSchema.parse(request.body), request.auth!));
  },

  async softDeletePost(request: Request, response: Response) {
    await postService.softDeletePost(routeId(request), request.auth!.sub);
    response.status(204).send();
  },

  async uploadMedia(request: Request, response: Response) {
    const file = request.file;
    if (!file) throw new HttpError(400, "Can gui file anh voi field name la file");
    response.status(201).json(await postService.uploadMedia(
      routeId(request),
      request.auth!.sub,
      uploadMediaSchema.parse(request.body),
      file,
      request.auth!
    ));
  },

  async getMedia(request: Request, response: Response) {
    const params = mediaParamSchema.parse(request.params);
    const media = await postService.getMediaFile(params.postId, params.mediaId, request.auth);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.type(media.contentType).sendFile(media.filePath);
  },

  async deleteMedia(request: Request, response: Response) {
    const params = mediaParamSchema.parse(request.params);
    await postService.deleteMedia(params.postId, params.mediaId, request.auth!.sub);
    response.status(204).send();
  }
};
