import { IncomingMessage } from "http";
import IRequestGrip from "./IRequestGrip";

export type NextGripApiRequest = IncomingMessage & {
    grip: IRequestGrip;
    body?: Buffer | string;
}
