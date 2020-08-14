import { WebSocketContext } from "@fanoutio/grip";

export default interface IRequestGrip {
    isProxied: boolean;
    isSigned: boolean;
    needsSigned: boolean;
    wsContext: WebSocketContext | null;
}
