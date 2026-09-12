import type { Request, Response } from "express";
import { HttpError } from "../../../../shared/interfaces/http/http-error.js";
import type { ImageAnalysisUseCases } from "../../application/image-analysis.use-cases.js";
import type { PostUseCases } from "../../application/post.use-cases.js";
import {
  analyzePostImageSchema,
  createPostSchema,
  idParamSchema,
  listOwnPostsQuerySchema,
  listPostsQuerySchema,
  mediaParamSchema,
  updatePostSchema,
  uploadMediaSchema
} from "./post.validator.js";

export function createPostController({ postService, geminiImageService }: {
  postService: PostUseCases;
  geminiImageService: ImageAnalysisUseCases;
}) {
  function routeId(request: Request) {
    return idParamSchema.parse(request.params).id;
  }
  function uploadedAnalysisFiles(request: Request) {
    if (request.file) return [request.file];
    if (!request.files) return [];
    if (Array.isArray(request.files)) return request.files;
    return [...(request.files.files ?? []), ...(request.files.file ?? [])];
  }
  const postController = {
    async analyzeImage(request: Request, response: Response) {
      const files = uploadedAnalysisFiles(request);
      if (!files.length) throw new HttpError(400, "Cần gửi ít nhất một ảnh vật phẩm với field name là files.");
      const input = analyzePostImageSchema.parse(request.body);
      response.json(await geminiImageService.analyzePostImages(files, input.type));
    },

    async getFormCatalog(_request: Request, response: Response) {
      response.json(await postService.getFormCatalog());
    },

    async listBoard(request: Request, response: Response) {
      response.json(await postService.listBoard(listPostsQuerySchema.parse(request.query), request.auth));
    },

    async listMine(request: Request, response: Response) {
      response.json(await postService.listMine(request.auth!.sub, listOwnPostsQuerySchema.parse(request.query)));
    },

    async getPost(request: Request, response: Response) {
      response.json(await postService.getPost(routeId(request), request.auth));
    },

    async listMatches(request: Request, response: Response) {
      response.json(await postService.listPostMatches(routeId(request), request.auth!));
    },

    async recalculateMatches(request: Request, response: Response) {
      response.json(await postService.recalculatePostMatches(routeId(request), request.auth!));
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
      response.type(media.contentType).send(media.body);
    },

    async deleteMedia(request: Request, response: Response) {
      const params = mediaParamSchema.parse(request.params);
      await postService.deleteMedia(params.postId, params.mediaId, request.auth!.sub);
      response.status(204).send();
    }
  };
  return postController;
}
export type PostController = ReturnType<typeof createPostController>;
