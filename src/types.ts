import { IRequestGrip } from './IRequestGrip.js';
import { IResponseGrip } from './IResponseGrip.js';

export type GripRequest<TRequest> = TRequest & {
  grip?: IRequestGrip;
};

export type GripResponse<TResponse> = TResponse & {
  grip?: IResponseGrip;
};
