import CallableInstance from 'callable-instance';

import debug from './debug.js';

import {
    GripInstruct,
    IGripConfig,
    Publisher,
    WebSocketContext,
    validateSig,
    ConnectionIdMissingException,
    WebSocketDecodeEventException,
    encodeBytesToBase64String,
} from '@fanoutio/grip';

import { IServeGripConfig } from './IServeGripConfig.js';

import { GripInstructNotAvailableException } from './GripInstructNotAvailableException.js';
import { GripInstructAlreadyStartedException } from './GripInstructAlreadyStartedException.js';

import type { IRequestGrip } from "./IRequestGrip.js";
import type { IResponseGrip } from "./IResponseGrip.js";

export type OnAfterSetupParams<TRequest, TResponse> = {
    req: TRequest;
    res: TResponse;
    wsContext: WebSocketContext | null;
    gripInstructGetter: () => GripInstruct | null;
};

type NextFunction = (e?: Error) => void;

export abstract class ServeGripBase<TRequest, TResponse> extends CallableInstance<[TRequest, TResponse, NextFunction], void> {
    gripProxies?: string | IGripConfig | IGripConfig[] | Publisher;
    prefix: string = '';
    isGripProxyRequired: boolean = false;
    _publisherClass?: { new(): Publisher };
    _publisher?: Publisher;

    protected constructor(config?: IServeGripConfig, fn: string = 'run') {
        super(fn);
        this.applyConfig(config);
    }

    applyConfig(config: IServeGripConfig = {}) {
        const { grip, gripVerifyKey, gripProxyRequired = false, prefix = '' } = config;

        if (this._publisher != null) {
            throw new Error('applyConfig called on ServeGrip that already has an instantiated publisher.');
        }

        let gripProxies: string | IGripConfig[] | Publisher | undefined = undefined;
        if (grip != null) {
            if (grip instanceof Publisher) {
                // by reference
                gripProxies = grip;
            } else if (typeof grip === 'string') {
                if (gripVerifyKey != null) {
                    // Add gripVerifyKey to GRIP URL if verify-key doesn't already exist on it
                    const url = new URL(grip);
                    if (url.searchParams.get('verify-key') == null) {
                        const verifyKeyValue = gripVerifyKey instanceof Uint8Array ? 'base64:' + encodeBytesToBase64String(gripVerifyKey) : gripVerifyKey;
                        url.searchParams.set('verify-key', verifyKeyValue);
                    }
                    gripProxies = url.toString();
                } else {
                    // copy the GRIP URL directly
                    gripProxies = grip;
                }
            } else {
                gripProxies = (Array.isArray(grip) ? grip : [ grip ]).map(config => {
                    const gripProxy = {...config};
                    if (gripProxy.verify_key == null && gripVerifyKey != null) {
                        gripProxy.verify_key = gripVerifyKey;
                    }
                    return gripProxy;
                });
            }
        }

        this.gripProxies = gripProxies;
        this.isGripProxyRequired = gripProxyRequired;
        this.prefix = prefix;
        this._publisherClass = config.publisherClass;
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
                publisher = new (this._publisherClass ?? Publisher)(undefined, { prefix: this.prefix });
                publisher.applyConfigs(this.gripProxies);
            }
            debug('ServeGrip#getPublisher - instantiating prefixed publisher')
            this._publisher = publisher;
        } else {
            debug('returning publisher');
        }
        debug('ServeGrip#getPublisher - end');
        return this._publisher;
    }

    abstract getRequestGrip(req: TRequest): IRequestGrip | undefined;
    abstract setRequestGrip(req: TRequest, grip: IRequestGrip): void;
    abstract isRequestWsOverHttp(req: TRequest): boolean;
    abstract getRequestWebSocketContext(req: TRequest): Promise<WebSocketContext>;
    abstract getRequestHeaderValue(req: TRequest, key: string): string | undefined;

    abstract setResponseGrip(res: TResponse, grip: IResponseGrip): void;
    abstract setResponseStatus(res: TResponse, code: number): void;
    abstract endResponse(res: TResponse, chunk: string): TResponse;

    abstract onAfterSetup(params: OnAfterSetupParams<TRequest, TResponse>): void;

    async run(req: TRequest, res: TResponse): Promise<boolean> {

        debug('ServeGrip#run - start');
        if (this.getRequestGrip(req) != null) {
            // This would indicate that we are already running for this request.
            // We don't install ourselves multiple times.
            debug('Already ran for this request, returning true');
            return true;
        }

        try {
            // Config check
            if (this.gripProxies == null) {
                debug('ERROR - No Grip configuration provided. Send error, returning false');
                this.setResponseStatus(res, 500);
                this.endResponse(res, 'No Grip configuration provided.\n');
                return false;
            }

            debug("gripProxies", this.gripProxies);

            // ## Set up req.grip
            debug('Set up req.grip - start');

            const gripSigHeader = this.getRequestHeaderValue(req, 'grip-sig');

            let isProxied = false;
            let isSigned = false;
            let needsSigned = false;
            if (gripSigHeader !== undefined) {
                debug('grip-sig header exists');
                const publisher = this.getPublisher();
                const clients = publisher.clients;

                if (clients.length > 0) {
                    if (clients.every((client) => client.getVerifyKey?.() != null)) {
                        needsSigned = true;
                        // If all proxies have keys, then only consider the request
                        // signed if at least one of them has signed it
                        if (await anyTrue(clients.map((client) =>
                            validateSig(gripSigHeader, client.getVerifyKey?.() ?? '', client.getVerifyIss?.())
                        ))) {
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
                this.setResponseStatus(res, 501);
                this.endResponse(res, 'Not Implemented.\n');
                return false;
            }

            let wsContext: WebSocketContext | null = null;

            if (this.isRequestWsOverHttp(req)) {
                try {
                    wsContext = await this.getRequestWebSocketContext(req);
                } catch(ex) {
                    if (ex instanceof ConnectionIdMissingException) {
                        debug("ERROR - connection-id header needed. Send Error, returning false");
                        this.setResponseStatus(res, 400);
                        this.endResponse(res, 'WebSocket event missing connection-id header.\n');
                        return false;
                    }
                    if (ex instanceof WebSocketDecodeEventException) {
                        debug("ERROR - error parsing websocket events. Send Error, returning false");
                        this.setResponseStatus(res, 400);
                        this.endResponse(res, 'Error parsing WebSocket events.\n');
                        return false;
                    }
                    debug("ERROR - unknown exception getting web socket context from request");
                    debug(ex);
                    this.setResponseStatus(res, 400);
                    this.endResponse(res, 'Error getting web socket Context.\n');
                    return false;
                }
            }

            this.setRequestGrip(req, {
                isProxied,
                isSigned,
                needsSigned,
                wsContext,
            });

            debug('Set up req.grip - end');

            // ## Set up res.grip
            debug('Set up res.grip - start');

            let gripInstruct: GripInstruct | null = null;
            this.setResponseGrip(res, {
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
            });

            debug('Set up res.grip - end');

            this.onAfterSetup({
                req,
                res,
                wsContext,
                gripInstructGetter: () => gripInstruct,
            });

        } catch (ex) {
            throw ex instanceof Error ? ex : new Error(String(ex));
        }

        debug('ServeGrip#run - end');
        return true;
    }
}

async function anyTrue(promises: Promise<boolean>[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
        let remaining = promises.length;
        if (remaining === 0) {
            resolve(false);
            return;
        }
        for (const p of promises) {
            p.then(value => {
                if (value) {
                    resolve(true);
                } else {
                    remaining--;
                    if (remaining === 0) {
                        resolve(false);
                    }
                }
            }).catch(reject);
        }
    });
}
