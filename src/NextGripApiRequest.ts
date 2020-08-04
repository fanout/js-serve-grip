import { NextApiRequest } from "next";
import IRequestGrip from "./IRequestGrip";

export type NextGripApiRequest = NextApiRequest & {
    grip: IRequestGrip;
}
