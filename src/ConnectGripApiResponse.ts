import { ServerResponse } from "http";
import IResponseGrip from "./IResponseGrip";

export type ConnectGripApiResponse = ServerResponse & {
    grip: IResponseGrip;
}
