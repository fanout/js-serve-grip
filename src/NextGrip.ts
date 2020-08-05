import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from "http";
import * as CallableInstance from "callable-instance";

import {
    GripInstruct,
    IGripConfig,
    IPublisherConfig,
    PrefixedPublisher,
    Publisher,
    WebSocketContext,
    decodeWebSocketEvents,
    encodeWebSocketEvents,
    validateSig,
} from "@fanoutio/grip";

import INextGripConfig from "./INextGripConfig";
import IRequestGrip from "./IRequestGrip";

import { NextGripApiResponse } from "./NextGripApiResponse";
import { NextGripApiRequest } from "./NextGripApiRequest";
import { NextGripApiHandler } from "./NextGripApiHandler";
import IResponseGrip from "./IResponseGrip";
import GripInstructNotAvailableException from "./data/GripInstructNotAvailableException";
import GripInstructAlreadyStartedException from "./data/GripInstructAlreadyStartedException";

function flattenHeader(value: undefined | string | string[]) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}

// @ts-ignore
export default class NextGrip extends CallableInstance<[IncomingMessage, ServerResponse, Function], void> {
    gripProxies?: IGripConfig[];
    pubServers?: IPublisherConfig[];
    prefix: string = '';
    isGripProxyRequired: boolean = false;
    _publisher?: PrefixedPublisher;

    constructor(config?: INextGripConfig) {
        super('exec');
        this.applyConfig(config);
    }

    applyConfig(config: INextGripConfig = {}) {

        const { gripProxies, gripPubServers, gripProxyRequired = false, gripPrefix = '' } = config;

        this.gripProxies = gripProxies;
        this.pubServers = gripPubServers;
        this.isGripProxyRequired = gripProxyRequired;
        this.prefix = gripPrefix;

    }

    checkGripStatus(req: NextGripApiRequest) {
        const gripSigHeader = flattenHeader(req.headers['grip-sig']);

        let isProxied = false;
        let isSigned = false;
        if (gripSigHeader !== undefined && Array.isArray(this.gripProxies) && this.gripProxies.length > 0) {
            if (this.gripProxies.every(proxy => proxy.key)) {
                // If all proxies have keys, then only consider the request
                // signed if at least one of them has signed it
                if (this.gripProxies.some(proxy => validateSig(gripSigHeader, proxy.key))) {
                    isProxied = true;
                    isSigned = true;
                }
            } else {
                isProxied = true;
            }
        }
        return {
            isProxied,
            isSigned,
        };
    }

    getPublisher(): PrefixedPublisher {
        if (this._publisher == null) {
            const publisher = new Publisher();
            if (this.gripProxies != null) {
                publisher.applyConfig(this.gripProxies);
            }
            if (this.pubServers != null) {
                publisher.applyConfig(this.pubServers);
            }
            this._publisher = publisher.buildPrefixedPublisher(this.prefix) as PrefixedPublisher;
        }
        return this._publisher;
    }

    exec(req: IncomingMessage, res: ServerResponse, fn: Function) {

        this.handle(req as NextGripApiRequest, res as NextGripApiResponse)
            .then(() => fn());

    }

    async handle(req: NextGripApiRequest, res: NextGripApiResponse) {

        // Initialize the API request and response with
        // NextGrip fields.

        const requestGrip: IRequestGrip = {
            isProxied: false,
            isSigned: false,
            wsContext: null,
        };
        Object.assign(req, { grip: requestGrip });

        const responseGrip: IResponseGrip = {
            startInstruct: () => {
                throw new GripInstructNotAvailableException();
            },
        };
        Object.assign(res, { grip: responseGrip });

        // Set request GRIP values
        Object.assign(requestGrip, this.checkGripStatus(req));

        const webSocketEventContentType = 'application/websocket-events';

        let contentTypeHeader = flattenHeader(req.headers['content-type']);
        if (contentTypeHeader != null) {
            const at = contentTypeHeader.indexOf(';');
            if (at >= 0) {
                contentTypeHeader = contentTypeHeader.substring(0, at);
            }
        }

        const acceptTypesHeader = flattenHeader(req.headers['accept']);
        const acceptTypes = acceptTypesHeader?.split(',')
            .map(item => item.trim());

        let wsContext: WebSocketContext | null = null;

        if (req.method === 'POST' && (
            contentTypeHeader === webSocketEventContentType ||
            acceptTypes?.includes(webSocketEventContentType)
        )) {
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

            let events = null;
            try {
                events = decodeWebSocketEvents(req.body);
            } catch (err) {
                res.statusCode = 400;
                res.end('Error parsing WebSocket events.\n');
                return;
            }
            wsContext = new WebSocketContext(cid, meta, events, this.prefix);
            requestGrip.wsContext = wsContext;
        }

        // Set response GRIP values
        if (requestGrip.isProxied) {

            let gripInstruct: GripInstruct | null = null;
            responseGrip.startInstruct = () => {
                if (gripInstruct != null) {
                    throw new GripInstructAlreadyStartedException();
                }
                gripInstruct = new GripInstruct();
                return gripInstruct;
            }

            // This overrides a writeHead, a function with a complex type declaration.
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
                }

                if (gripInstruct != null) {
                    obj = Object.assign({}, obj, gripInstruct.toHeaders());
                }

                if (typeof reason === 'string') {
                    resWriteHead.call(res, statusCode, reason, obj);
                } else {
                    resWriteHead.call(res, statusCode, obj);
                }
            };

            const resEnd = res.end;
            // @ts-ignore
            res.end = (chunk, encoding, callback) => {

                if (res.statusCode === 200 && wsContext != null) {

                    const events = wsContext.getOutgoingEvents();
                    res.write(encodeWebSocketEvents(events));

                }

                resEnd.call(res, chunk, encoding, callback);
            }

        } else {

            if (this.isGripProxyRequired) {
                // NOT PROXIED, needs to fail now
                res.statusCode = 501;
                res.end('Not Implemented.\n');
                return;
            }

        }

    }

    createGripHandler(fn: NextGripApiHandler) {
        return async (req: NextGripApiRequest, res: NextGripApiResponse) => {

            await this.handle(req, res);
            await fn(req, res);

        };
    }
}




