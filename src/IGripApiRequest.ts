import { IApiRequest } from "@fanoutio/grip";
import { IRequestGrip } from "./IRequestGrip";

export interface IGripApiRequest<T> extends IApiRequest<T> {
  grip: IRequestGrip;
}
