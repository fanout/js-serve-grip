import { NextApiResponse } from "next";
import IResponseGrip from "./IResponseGrip";

export type NextGripApiResponse = NextApiResponse & {
    grip: IResponseGrip;
}
