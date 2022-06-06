import { IApiRequest } from "@fanoutio/grip";
import { IRequestGrip } from "./IRequestGrip";

export interface IGripApiRequest<T> extends IApiRequest<T> {
  getGrip(): IRequestGrip | undefined;
  setGrip(grip: IRequestGrip): void;
}
