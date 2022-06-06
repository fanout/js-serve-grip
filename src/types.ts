import { IRequestGrip } from "./IRequestGrip";
import { IResponseGrip } from "./IResponseGrip";

export type GripRequest<TRequest> = TRequest & {
  grip?: IRequestGrip;
};

export type GripResponse<TResponse> = TResponse & {
  grip?: IResponseGrip;
};
