import { ServerResponse } from "http";
import IResponseGrip from "./IResponseGrip";

export type NextGripApiResponse = ServerResponse & {
    grip: IResponseGrip;
}
