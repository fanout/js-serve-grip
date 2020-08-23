import { IncomingMessage } from 'http';
import IRequestGrip from './IRequestGrip';

export type ServeGripApiRequest = IncomingMessage & {
    grip: IRequestGrip;
    body?: Buffer | string;
};
