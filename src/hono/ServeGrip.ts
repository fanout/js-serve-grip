import { type HonoRequest } from 'hono';
import { createMiddleware } from 'hono/factory'
import {
    type WebSocketContext,
    type GripInstruct,
    Channel,
    getWebSocketContextFromReq,
    isWsOverHttp,
    encodeWebSocketEvents,
} from '@fanoutio/grip';

import debug from '../debug.js';
import type { IResponseGrip } from '../IResponseGrip.js';
import type { IRequestGrip } from '../IRequestGrip.js';
import type { IServeGripConfig } from '../IServeGripConfig.js';
import { type OnAfterSetupParams, ServeGripBase } from '../ServeGripBase.js';

export type Variables = {
    grip: IRequestGrip & IResponseGrip,
};

export type Env = {
    Variables: Variables,
};

type RequestState = {
    request: HonoRequest,
    grip: IRequestGrip | undefined,
};

type ResponseState = {
    grip: IResponseGrip | undefined,
    status: number | undefined,
    endChunk: string | undefined,
    getGripInstruct: (() => GripInstruct | null) | undefined,
};

class ServeGrip extends ServeGripBase<RequestState, ResponseState> {
    public constructor(config?: IServeGripConfig) {
        super(config);
    }

    getRequestGrip(req: RequestState): IRequestGrip | undefined {
        return req.grip;
    }

    setRequestGrip(req: RequestState, grip: IRequestGrip): void {
        req.grip = grip;
    }

    isRequestWsOverHttp(req: RequestState): boolean {
        return isWsOverHttp(req.request.raw);
    }

    getRequestWebSocketContext(req: RequestState): Promise<WebSocketContext> {
        return getWebSocketContextFromReq(req.request.raw);
    }

    getRequestHeaderValue(req: RequestState, key: string): string | undefined {
        return req.request.raw.headers.get(key) ?? undefined;
    }

    setResponseGrip(res: ResponseState, grip: IResponseGrip): void {
        res.grip = grip;
    }

    setResponseStatus(res: ResponseState, code: number): void {
        res.status = code;
    }

    endResponse(res: ResponseState, chunk: string): ResponseState {
        res.endChunk = chunk;
        return res;
    }

    onAfterSetup(params: OnAfterSetupParams<RequestState, ResponseState>): void {
        params.res.getGripInstruct = params.gripInstructGetter;
    }
}

export type ServeGripMiddleware = ReturnType<typeof createMiddleware<Env>> &
    {
        getPublisher: ServeGrip['getPublisher'],
    };

export function serveGrip(config?: IServeGripConfig): ServeGripMiddleware {

    const serveGripInstance = new ServeGrip(config);

    const serveGripMiddleware = createMiddleware<Env>(async (c, next) => {

        const requestState: RequestState = {
            request: c.req,
            grip: undefined,
        };

        const responseState: ResponseState = {
            grip: undefined,
            status: undefined,
            endChunk: undefined,
            getGripInstruct: undefined,
        };

        const result = await serveGripInstance.run(requestState, responseState);
        if (!result) {
            // serveGripInstance.run returns false if there was an error.
            c.res = new Response(
                responseState.endChunk ?? 'Error in serveGrip middleware.',
                {
                    status: responseState.status ?? 500,
                }
            );
            return;
        }

        const grip = Object.assign({}, requestState.grip, responseState.grip);
        c.set('grip', grip);

        await next();

        if (grip.wsContext != null) {

            if (c.res.status === 200 || c.res.status === 204) {
                const wsContextHeaders = grip.wsContext.toHeaders();
                const events = grip.wsContext.getOutgoingEvents();

                c.res = new Response(
                    encodeWebSocketEvents(events),
                    {
                        status: 200,
                        headers: wsContextHeaders,
                    },
                );
            }

        } else {

            const gripInstruct = responseState.getGripInstruct?.();
            if (gripInstruct != null) {
                if (c.res.status === 304) {
                    // Code 304 only allows certain headers.
                    // Some web servers strictly enforce this.
                    // In that case we won't be able to use
                    // Grip-* headers to talk to the proxy.
                    // Switch to code 200 and use Grip-Status
                    // to specify intended status.
                    debug("Using gripInstruct setStatus header to handle 304");
                    c.status(200);
                    gripInstruct.setStatus(304);
                }

                // Apply prefix to channel names
                gripInstruct.channels = gripInstruct.channels.map(
                    (ch) => new Channel(serveGripInstance.prefix + ch.name, ch.prevId),
                );

                for (const [key, value] of Object.entries(gripInstruct.toHeaders())) {
                    c.res.headers.set(key, value);
                }
            }

        }

    });

    return Object.assign(
        serveGripMiddleware,
        {
            getPublisher() {

                return serveGripInstance.getPublisher();

            },
        }
    );
}

