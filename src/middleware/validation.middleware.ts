import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { BadRequestError } from '../utils/errors';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

interface IValidationRequest {
  body?: z.Schema;
  query?: z.Schema;
  params?: z.Schema;
}

export const validateRequest = (schemas: IValidationRequest) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as ParsedQs;
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as ParamsDictionary;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        next(new BadRequestError(`Validation failed: ${message}`));
      } else {
        next(new BadRequestError('An unknown validation error occurred.'));
      }
    }
};