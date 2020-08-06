import { ConnectGripApiRequest } from "./ConnectGripApiRequest";
import { ConnectGripApiResponse } from "./ConnectGripApiResponse";

export type ConnectGripApiHandler = (req: ConnectGripApiRequest, res: ConnectGripApiResponse) => void | Promise<void>;
