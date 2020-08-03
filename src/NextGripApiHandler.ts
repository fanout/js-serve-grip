import { NextGripApiRequest } from "./NextGripApiRequest";
import { NextGripApiResponse } from "./NextGripApiResponse";

export type NextGripApiHandler = (req: NextGripApiRequest, res: NextGripApiResponse) => void | Promise<void>;
