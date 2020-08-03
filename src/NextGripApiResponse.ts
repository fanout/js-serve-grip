import { NextApiResponse } from "next";
import { GripInstruct, IFormat } from "@fanoutio/grip";

export type NextGripApiResponse = NextApiResponse & {
    gripInstruct?: GripInstruct;
    gripPublish?: (channel: string, formats: IFormat | IFormat[], id?: string, prevId?: string) => Promise<void>;
}
