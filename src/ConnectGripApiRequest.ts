import { IncomingMessage } from "http";
import IRequestGrip from "./IRequestGrip";

export type ConnectGripApiRequest = IncomingMessage & {
    grip: IRequestGrip;
    body?: Buffer | string;
}
