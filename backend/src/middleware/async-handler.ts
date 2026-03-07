import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRouteHandler<TRequest extends Request = Request> = (
  request: TRequest,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler<TRequest extends Request = Request>(
  handler: AsyncRouteHandler<TRequest>
): RequestHandler {
  return (request, response, next) => {
    void handler(request as TRequest, response, next).catch(next);
  };
}
