import { IApiResponse } from "@fanoutio/grip";
import { IResponseGrip } from './IResponseGrip';

export interface IGripApiResponse<T> extends IApiResponse<T> {
    getGrip(): IResponseGrip | undefined;
    setGrip(grip: IResponseGrip): void;
}
