import { ServerResponse } from 'http';
import { IResponseGrip } from './IResponseGrip';

export type ServeGripApiResponse = ServerResponse & {
    grip: IResponseGrip;
};
