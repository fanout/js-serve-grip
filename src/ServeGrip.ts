import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http';

import debug from './debug';

import {
    GripInstruct,
    WebSocketContext,
    encodeWebSocketEvents,
    Channel,
    IApiResponse,
    NodeApiRequest,
    NodeApiResponse,
} from '@fanoutio/grip';

import { IServeGripConfig } from './IServeGripConfig';
import { ServeGripBase } from "./ServeGripBase";
import { IGripApiResponse } from "./IGripApiResponse";
import { IGripApiRequest } from "./IGripApiRequest";
import { GripRequest, GripResponse } from "./types";

type NextFunction = (e?: Error) => void;

export class ServeGrip extends ServeGripBase<IncomingMessage, ServerResponse> {
    koa: (ctx: any, next: () => Promise<void>) => Promise<void>;

    constructor(config?: IServeGripConfig, fn: string = 'exec') {
        super(config, fn);
        this.koa = async (ctx: any, next: () => Promise<void>) => {
            await this.run(ctx.req, ctx.res);
            await next();
        };
    }

    exec(platformRequest: IncomingMessage, platformResponse: ServerResponse, fn: NextFunction) {
        debug('ServeGrip#exec - serveGrip invoked as Middleware function');
        let err: Error | undefined;
        this.run(platformRequest, platformResponse)
            .catch((ex) => (err = ex))
            .then((result) => {
                if (err !== undefined) {
                    fn(err);
                } else {
                    if (result) {
                        fn();
                    }
                }
            });
    }

    platformRequestToApiRequest(req: IncomingMessage) {
        const apiRequest = NodeApiRequest.for(req) as IGripApiRequest<IncomingMessage>;
        if(apiRequest.getGrip == null) {
            apiRequest.getGrip = () => {
                return (req as GripRequest<IncomingMessage>).grip;
            };
        }
        if(apiRequest.setGrip == null) {
            apiRequest.setGrip = (grip) => {
                (req as GripRequest<IncomingMessage>).grip = grip;
            };
        }
        return apiRequest;
    }

    platformResponseToApiResponse(res: ServerResponse) {
        const apiResponse = NodeApiResponse.for(res) as IGripApiResponse<ServerResponse>;
        if(apiResponse.getGrip == null) {
            apiResponse.getGrip = () => {
                return (res as GripResponse<ServerResponse>).grip;
            };
        }
        if(apiResponse.setGrip == null) {
            apiResponse.setGrip = (grip) => {
                (res as GripResponse<ServerResponse>).grip = grip;
            };
        }
        return apiResponse;
    }

    monkeyPatchResMethodsForWebSocket(apiResponse: IGripApiResponse<ServerResponse>, wsContext: WebSocketContext) {
        const res = apiResponse.getWrapped();

        debug('res.removeHeader');
        const resRemoveHeader = res.removeHeader;
        // @ts-ignore
        res.removeHeader = (name) => {
            debug('res.removeHeader - start');
            // If we have a WsContext, then we don't want to allow removing
            // the following headers.
            let skip = false;
            if (name != null) {
                const nameLower = name.toLowerCase();
                if (nameLower === 'content-type' ||
                  nameLower === 'content-length' ||
                  nameLower === 'transfer-encoding'
                ) {
                    // turn into a no-op
                    skip = true;
                }
            }
            if (!skip) {
                debug('not skipping removeHeader', name);
                resRemoveHeader.call(res, name);
            } else {
                debug('skipping removeHeader', name);
            }
            debug('res.removeHeader - end');
        };

        debug('res.writeHead');
        const resWriteHead = res.writeHead;
        // @ts-ignore
        res.writeHead = (statusCode: number, reason?: string, obj?: OutgoingHttpHeaders) => {
            debug('res.writeHead - start');
            if (typeof reason === 'string') {
                // assume this was called like this:
                // writeHead(statusCode, reasonPhrase[, headers])
            } else {
                // this was called like this:
                // writeHead(statusCode[, headers])
                obj = reason;
            }

            debug('res.statusCode', res.statusCode);

            if (statusCode === 200 || statusCode === 204) {
                const wsContextHeaders = wsContext!.toHeaders();
                debug("Adding wsContext headers", wsContextHeaders);
                obj = Object.assign({}, obj, wsContextHeaders);
                // Koa will set status code 204 when the body has been set to
                // null. This is probably fine since the main stream
                // for WS-over-HTTP is supposed to have an empty
                // body anyway.  However, we will be adding WebSocket
                // events into the body, so change it to a 200.
                statusCode = 200;
                reason = 'OK';
            }
            debug('res.writeHead - end');

            if (typeof reason === 'string') {
                // @ts-ignore
                resWriteHead.call(res, statusCode, reason, obj);
            } else {
                resWriteHead.call(res, statusCode, obj);
            }
        };

        debug('res.end');
        const resEnd = res.end;
        // @ts-ignore
        res.end = (chunk: any, encoding: BufferEncoding, callback: NextFunction) => {
            debug('res.end - start');
            debug('res.statusCode', res.statusCode);
            if (res.statusCode === 200 || res.statusCode === 204) {
                debug('Getting outgoing events' );
                const events = wsContext!.getOutgoingEvents();
                debug('Encoding and writing events', events );
                res.write(encodeWebSocketEvents(events));
            }
            debug('res.end - end');

            // @ts-ignore
            resEnd.call(res, chunk, encoding, callback);
        };

    }

    monkeyPatchResMethodsForGripInstruct(apiResponse: IApiResponse<ServerResponse>, gripInstructGetter: () => GripInstruct | null) {

        const res = apiResponse.getWrapped();

        debug('res.writeHead');
        const resWriteHead = res.writeHead;
        // @ts-ignore
        res.writeHead = (statusCode: number, reason?: string, obj?: OutgoingHttpHeaders) => {
            debug('res.writeHead - start');
            if (typeof reason === 'string') {
                // assume this was called like this:
                // writeHead(statusCode, reasonPhrase[, headers])
            } else {
                // this was called like this:
                // writeHead(statusCode[, headers])
                obj = reason;
            }

            debug('res.statusCode', res.statusCode);

            const gripInstruct = gripInstructGetter();
            if (gripInstruct != null) {
                debug("GripInstruct present");
                if (statusCode === 304) {
                    // Code 304 only allows certain headers.
                    // Some web servers strictly enforce this.
                    // In that case we won't be able to use
                    // Grip- headers to talk to the proxy.
                    // Switch to code 200 and use Grip-Status
                    // to specify intended status.
                    debug("Using gripInstruct setStatus header to handle 304");
                    statusCode = 200;
                    reason = 'OK';
                    gripInstruct.setStatus(304);
                }
                // Apply prefix to channel names
                gripInstruct.channels = gripInstruct.channels.map(
                  (ch) => new Channel(this.prefix + ch.name, ch.prevId),
                );
                const gripInstructHeaders = gripInstruct.toHeaders();
                debug("Adding GripInstruct headers", gripInstructHeaders);
                obj = Object.assign({}, obj, gripInstructHeaders);
            } else {
                debug("GripInstruct not present");
            }
            debug('res.writeHead - end');

            if (typeof reason === 'string') {
                // @ts-ignore
                resWriteHead.call(res, statusCode, reason, obj);
            } else {
                resWriteHead.call(res, statusCode, obj);
            }
        };

    }
}
