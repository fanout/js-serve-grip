import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http';
import CallableInstance from 'callable-instance';

import debug from './debug';

import {
    GripInstruct,
    IGripConfig,
    Publisher,
    WebSocketContext,
    getWebSocketContextFromReq,
    encodeWebSocketEvents,
    isWsOverHttp,
    validateSig,
    Auth,
    Channel,
    ConnectionIdMissingException,
    WebSocketDecodeEventException,
} from '@fanoutio/grip';

import IServeGripConfig from './IServeGripConfig';

import { ServeGripApiResponse } from './ServeGripApiResponse';
import { ServeGripApiRequest } from './ServeGripApiRequest';

import GripInstructNotAvailableException from './GripInstructNotAvailableException';
import GripInstructAlreadyStartedException from './GripInstructAlreadyStartedException';

import PrefixedPublisher from './PrefixedPublisher';

type NextFunction = (e?: Error) => void;

function flattenHeader(value: undefined | string | string[]) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}

export default class ServeGrip extends CallableInstance<[IncomingMessage, ServerResponse, NextFunction], void> {
    gripProxies?: string | IGripConfig | IGripConfig[] | Publisher;
    prefix: string = '';
    isGripProxyRequired: boolean = false;
    _publisher?: Publisher;

    koa: (ctx: any, next: () => Promise<void>) => Promise<void>;

    constructor(config?: IServeGripConfig) {
        super('exec');
        this.applyConfig(config);
        this.koa = async (ctx: any, next: () => Promise<void>) => {
            await this.run(ctx.req, ctx.res);
            await next();
        };
    }

    applyConfig(config: IServeGripConfig = {}) {
        const { grip, gripProxyRequired = false, prefix = '' } = config;

        if (this._publisher != null) {
            throw new Error('applyConfig called on ServeGrip that already has an instantiated publisher.');
        }

        this.gripProxies = grip;
        this.isGripProxyRequired = gripProxyRequired;
        this.prefix = prefix;
    }

    getPublisher(): Publisher {
        debug('ServeGrip#getPublisher - start');
        if (this._publisher == null) {
            let publisher: Publisher;
            if (this.gripProxies == null) {
                debug('ServeGrip#getPublisher - ERROR - no grip proxies specified');
                throw new Error('No Grip configuration provided. Provide one to the constructor of ServeGrip, or call applyConfig() with a Grip configuration, before calling getPublisher().');
            }
            if (this.gripProxies instanceof Publisher) {
                debug('ServeGrip#getPublisher - initializing with existing publisher');
                publisher = this.gripProxies;
            } else {
                debug('ServeGrip#getPublisher - initializing with grip settings', this.gripProxies);
                publisher = new Publisher();
                publisher.applyConfig(this.gripProxies);
            }
            this._publisher = new PrefixedPublisher(publisher, this.prefix);
        } else {
            debug('returning publisher');
        }
        debug('ServeGrip#getPublisher - end');
        return this._publisher;
    }

    exec(req: IncomingMessage, res: ServerResponse, fn: NextFunction) {
        debug('ServeGrip#exec - serveGrip invoked as Middleware function');
        let err: Error | undefined;
        this.run(req as ServeGripApiRequest, res as ServeGripApiResponse)
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

    async run(req: ServeGripApiRequest, res: ServeGripApiResponse): Promise<boolean> {
        debug('ServeGrip#run - start');
        if (req.grip != null) {
            // This would indicate that we are already running for this request.
            // We don't install ourselves multiple times.
            debug('Already ran for this request, returning true');
            return true;
        }

        try {
            // Config check
            if (this.gripProxies == null) {
                debug('ERROR - No Grip configuration provided. Send error, returning false');
                res.statusCode = 500;
                res.end('No Grip configuration provided.\n');
                return false;
            }

            debug("gripProxies", this.gripProxies);

            // ## Set up req.grip
            debug('Set up req.grip - start');

            const gripSigHeader = flattenHeader(req.headers['grip-sig']);

            let isProxied = false;
            let isSigned = false;
            let needsSigned = false;
            if (gripSigHeader !== undefined) {
                debug('grip-sig header exists');
                const publisher = this.getPublisher();
                const clients = publisher.clients;

                if (clients.length > 0) {
                    if (clients.every((client) => client.auth instanceof Auth.Jwt && client.auth.key != null)) {
                        needsSigned = true;
                        // If all proxies have keys, then only consider the request
                        // signed if at least one of them has signed it
                        if (
                            clients.some((client) =>
                                validateSig(gripSigHeader, (client.auth as Auth.Jwt).key as Buffer),
                            )
                        ) {
                            isProxied = true;
                            isSigned = true;
                        }
                    } else {
                        isProxied = true;
                    }
                }
            }

            if (isProxied) {
                debug('Request is proxied');
            } else {
                debug('Request is not proxied');
            }
            if (isSigned) {
                debug('Request is signed');
            } else {
                debug('Request is not signed');
            }

            if (!isProxied && this.isGripProxyRequired) {
                // If we require a GRIP proxy but we detect there is
                // not one, we needs to fail now
                debug('ERROR - isGripProxyRequired is true, but is not proxied. Send error, returning false.');
                res.statusCode = 501;
                res.end('Not Implemented.\n');
                return false;
            }

            let wsContext: WebSocketContext | null = null;

            if (isWsOverHttp(req)) {
                try {
                    wsContext = await getWebSocketContextFromReq(req, this.prefix);
                } catch(ex) {
                    if (ex instanceof ConnectionIdMissingException) {
                        debug("ERROR - connection-id header needed. Send Error, returning false");
                        res.statusCode = 400;
                        res.end('WebSocket event missing connection-id header.\n');
                        return false;
                    }
                    if (ex instanceof WebSocketDecodeEventException) {
                        debug("ERROR - error parsing websocket events. Send Error, returning false");
                        res.statusCode = 400;
                        res.end('Error parsing WebSocket events.\n');
                        return false;
                    }
                    debug("ERROR - unknown exception getting web socket context from request");
                    debug(ex);
                    res.statusCode = 400;
                    res.end('Error getting web socket Context.\n');
                    return false;
                }
            }

            Object.assign(req, {
                grip: {
                    isProxied,
                    isSigned,
                    needsSigned,
                    wsContext,
                },
            });

            debug('Set up req.grip - end');

            // ## Set up res.grip
            debug('Set up res.grip - start');

            let gripInstruct: GripInstruct | null = null;
            Object.assign(res, {
                grip: {
                    startInstruct() {
                        try {
                            debug('startInstruct - start');
                            // In WebSocket-over-HTTP or if request is not proxied,
                            // startInstruct is not available.
                            if (wsContext == null && isProxied) {
                                if (gripInstruct != null) {
                                    debug('ERROR - GripInstruct is already started');
                                    throw new GripInstructAlreadyStartedException();
                                }
                                debug('Creating GripInstruct');
                                gripInstruct = new GripInstruct();
                                return gripInstruct;
                            } else {
                                debug('ERROR - GripInstruct is not available');
                                throw new GripInstructNotAvailableException();
                            }
                        } finally {
                            debug('startInstruct - end');
                        }
                    },
                },
            });

            debug('Set up res.grip - end');

            // ## Monkey-patch res methods
            if (wsContext != null) {
                debug('Monkey-patch res methods for WS-over-HTTP - start');

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

                debug('Monkey-patch res methods for WS-over-HTTP - end');

            } else {

                debug('Monkey-patch res methods for GripInstruct - start');

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

                debug('Monkey-patch res methods for GripInstruct - end');
            }

        } catch (ex) {
            throw ex instanceof Error ? ex : new Error(String(ex));
        }

        debug('ServeGrip#run - end');
        return true;
    }
}
