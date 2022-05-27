import { IApiResponse } from "@fanoutio/grip";
import { IResponseGrip } from './IResponseGrip';

export interface IGripApiResponse<T> extends IApiResponse<T> {
    grip: IResponseGrip;
}
