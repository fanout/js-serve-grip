import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http';
import CallableInstance from 'callable-instance';

import {
    GripInstruct,
    IGripConfig,
    Publisher,
    WebSocketContext,
    decodeWebSocketEvents,
    encodeWebSocketEvents,
    validateSig,
    Auth,
    Channel,
} from '@fanoutio/grip';

import IServeGripConfig from './IServeGripConfig';

import { ServeGripApiResponse } from './ServeGripApiResponse';
import { ServeGripApiRequest } from './ServeGripApiRequest';

import GripInstructNotAvailableException from './GripInstructNotAvailableException';
import GripInstructAlreadyStartedException from './GripInstructAlreadyStartedException';

import PrefixedPublisher from './PrefixedPublisher';

const CONTENT_TYPE_WEBSOCKET_EVENTS = 'application/websocket-events';

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

    constructor(config?: IServeGripConfig) {
        super('exec');
        this.applyConfig(config);
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
        if (this._publisher == null) {
            let publisher: Publisher;
            if (this.gripProxies instanceof Publisher) {
                publisher = this.gripProxies;
            } else {
                publisher = new Publisher();
                if (this.gripProxies != null) {
                    publisher.applyConfig(this.gripProxies);
                }
            }
            this._publisher = new PrefixedPublisher(publisher, this.prefix);
        }
        return this._publisher;
    }

    exec(req: IncomingMessage, res: ServerResponse, fn: NextFunction) {
        let err: Error | undefined;
        this.run(req as ServeGripApiRequest, res as ServeGripApiResponse)
            .catch((ex) => (err = ex))
            .then(() => {
                if (err !== undefined) {
                    fn(err);
                } else {
                    fn();
                }
            });
    }

    async run(req: ServeGripApiRequest, res: ServeGripApiResponse) {
        if (req.grip != null) {
            // This would indicate that we are already running for this request.
            // We don't install ourselves multiple times.
            return;
        }

        try {
            // ## Set up req.grip

            const gripSigHeader = flattenHeader(req.headers['grip-sig']);

            let isProxied = false;
            let isSigned = false;
            let needsSigned = false;
            if (gripSigHeader !== undefined) {
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

            if (!isProxied && this.isGripProxyRequired) {
                // If we require a GRIP proxy but we detect there is
                // not one, we needs to fail now
                res.statusCode = 501;
                res.end('Not Implemented.\n');
                return;
            }

            let contentTypeHeader = flattenHeader(req.headers['content-type']);
            if (contentTypeHeader != null) {
                const at = contentTypeHeader.indexOf(';');
                if (at >= 0) {
                    contentTypeHeader = contentTypeHeader.substring(0, at);
                }
            }

            const acceptTypesHeader = flattenHeader(req.headers['accept']);
            const acceptTypes = acceptTypesHeader?.split(',').map((item) => item.trim());

            let wsContext: WebSocketContext | null = null;

            if (
                req.method === 'POST' &&
                (contentTypeHeader === CONTENT_TYPE_WEBSOCKET_EVENTS ||
                    acceptTypes?.includes(CONTENT_TYPE_WEBSOCKET_EVENTS))
            ) {
                const cid = flattenHeader(req.headers['connection-id']);
                if (cid == null) {
                    res.statusCode = 400;
                    res.end('WebSocket event missing connection-id header.\n');
                    return;
                }

                // Handle meta keys
                const meta = {};
                for (const [key, value] of Object.entries(req.headers)) {
                    const lKey = key.toLowerCase();
                    if (lKey.startsWith('meta-')) {
                        meta[lKey.substring(5)] = value;
                    }
                }

                if (req.body == null) {
                    req.body = await new Promise((resolve) => {
                        const bodySegments: any[] = [];
                        req.on('data', (chunk) => {
                            bodySegments.push(chunk);
                        });
                        req.on('end', () => {
                            const bodyBuffer = Buffer.concat(bodySegments);
                            resolve(bodyBuffer);
                        });
                    });
                }

                let events = null;
                try {
                    events = decodeWebSocketEvents(req.body!);
                } catch (err) {
                    res.statusCode = 400;
                    res.end('Error parsing WebSocket events.\n');
                    return;
                }
                wsContext = new WebSocketContext(cid, meta, events, this.prefix);
            }

            Object.assign(req, {
                grip: {
                    isProxied,
                    isSigned,
                    needsSigned,
                    wsContext,
                },
            });

            // ## Set up res.grip

            let gripInstruct: GripInstruct | null = null;
            Object.assign(res, {
                grip: {
                    startInstruct() {
                        if (isProxied) {
                            if (gripInstruct != null) {
                                throw new GripInstructAlreadyStartedException();
                            }
                            gripInstruct = new GripInstruct();
                            return gripInstruct;
                        } else {
                            throw new GripInstructNotAvailableException();
                        }
                    },
                },
            });

            // ## Monkey-patch res methods

            if (isProxied) {
                const resWriteHead = res.writeHead;
                // @ts-ignore
                res.writeHead = (statusCode: number, reason?: string, obj?: OutgoingHttpHeaders) => {
                    if (typeof reason === 'string') {
                        // assume this was called like this:
                        // writeHead(statusCode, reasonPhrase[, headers])
                    } else {
                        // this was called like this:
                        // writeHead(statusCode[, headers])
                        obj = reason;
                    }

                    if (statusCode === 200 && wsContext != null) {
                        obj = Object.assign({}, obj, wsContext.toHeaders());
                    } else {
                        if (gripInstruct != null) {
                            if (statusCode === 304) {
                                // Code 304 only allows certain headers.
                                // Some web servers strictly enforce this.
                                // In that case we won't be able to use
                                // Grip- headers to talk to the proxy.
                                // Switch to code 200 and use Grip-Status
                                // to specify intended status.
                                statusCode = 200;
                                reason = 'OK';
                                gripInstruct.setStatus(304);
                            }
                            // Apply prefix to channel names
                            gripInstruct.channels = gripInstruct.channels.map(
                                (ch) => new Channel(this.prefix + ch.name, ch.prevId),
                            );
                            obj = Object.assign({}, obj, gripInstruct.toHeaders());
                        }
                    }

                    if (typeof reason === 'string') {
                        // @ts-ignore
                        resWriteHead.call(res, statusCode, reason, obj);
                    } else {
                        resWriteHead.call(res, statusCode, obj);
                    }
                };

                const resEnd = res.end;
                // @ts-ignore
                res.end = (chunk: any, encoding: BufferEncoding, callback: NextFunction) => {
                    if (res.statusCode === 200 && wsContext != null) {
                        const events = wsContext.getOutgoingEvents();
                        res.write(encodeWebSocketEvents(events));
                    }

                    // @ts-ignore
                    resEnd.call(res, chunk, encoding, callback);
                };
            }
        } catch (ex) {
            throw ex instanceof Error ? ex : new Error(ex);
        }
    }
}
