import { WebSocketContext } from '@fanoutio/grip';

export interface IRequestGrip {
    isProxied: boolean;
    isSigned: boolean;
    needsSigned: boolean;
    wsContext: WebSocketContext | null;
}
