import { NextApiRequest } from "next";

export type NextGripApiRequest = NextApiRequest & {
    gripProxied?: boolean;

}
