import CallableInstance from 'callable-instance';

import debug from './debug';

import {
    GripInstruct,
    IGripConfig,
    Publisher,
    PublisherBase,
    WebSocketContext,
    getWebSocketContextFromApiRequest,
    isApiRequestWsOverHttp,
    validateSig,
    ConnectionIdMissingException,
    WebSocketDecodeEventException,
} from '@fanoutio/grip';

import { IServeGripConfig } from './IServeGripConfig';

import { GripInstructNotAvailableException } from './GripInstructNotAvailableException';
import { GripInstructAlreadyStartedException } from './GripInstructAlreadyStartedException';

import { PrefixedPublisher } from './PrefixedPublisher';
import { IGripApiResponse } from "./IGripApiResponse";
import { IGripApiRequest } from "./IGripApiRequest";

type NextFunction = (e?: Error) => void;

export abstract class ServeGripBase<TRequest, TResponse> extends CallableInstance<[TRequest, TResponse, NextFunction], void> {
    gripProxies?: string | IGripConfig | IGripConfig[] | PublisherBase<any>;
    prefix: string = '';
    isGripProxyRequired: boolean = false;
    _publisherClass?: { new(): PublisherBase<any> };
    _publisher?: PublisherBase<any>;

    protected constructor(config?: IServeGripConfig, fn: string = 'run') {
        super(fn);
        this.applyConfig(config);
    }

    applyConfig(config: IServeGripConfig = {}) {
        const { grip, gripVerifyKey, gripProxyRequired = false, prefix = '' } = config;

        if (this._publisher != null) {
            throw new Error('applyConfig called on ServeGrip that already has an instantiated publisher.');
        }

        let gripProxies: string | IGripConfig[] | PublisherBase<any> | undefined = undefined;
        if (grip != null) {
            if (grip instanceof PublisherBase) {
                // by reference
                gripProxies = grip;
            } else if (typeof grip === 'string') {
                if (gripVerifyKey != null) {
                    // Add gripVerifyKey to GRIP URL if verify-key doesn't already exist on it
                    const url = new URL(grip);
                    if (url.searchParams.get('verify-key') == null) {
                        const verifyKeyValue = gripVerifyKey instanceof Buffer ? 'base64:' + gripVerifyKey.toString('base64') : gripVerifyKey;
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
            let publisher: PublisherBase<any>;
            if (this.gripProxies == null) {
                debug('ServeGrip#getPublisher - ERROR - no grip proxies specified');
                throw new Error('No Grip configuration provided. Provide one to the constructor of ServeGrip, or call applyConfig() with a Grip configuration, before calling getPublisher().');
            }
            if (this.gripProxies instanceof PublisherBase) {
                debug('ServeGrip#getPublisher - initializing with existing publisher');
                publisher = this.gripProxies;
            } else {
                debug('ServeGrip#getPublisher - initializing with grip settings', this.gripProxies);
                publisher = new (this._publisherClass ?? Publisher)();
                publisher.applyConfig(this.gripProxies);
            }
            debug('ServeGrip#getPublisher - instantiating prefixed publisher')
            this._publisher = new PrefixedPublisher(publisher, this.prefix);
        } else {
            debug('returning publisher');
        }
        debug('ServeGrip#getPublisher - end');
        return this._publisher;
    }

    abstract platformRequestToApiRequest(req: TRequest): IGripApiRequest<TRequest>;
    abstract platformResponseToApiResponse(res: TResponse): IGripApiResponse<TResponse>;

    async run(platformRequest: TRequest, platformResponse: TResponse): Promise<boolean> {
        const req = this.platformRequestToApiRequest(platformRequest);
        const res = this.platformResponseToApiResponse(platformResponse);

        debug('ServeGrip#run - start');
        if (req.getGrip() != null) {
            // This would indicate that we are already running for this request.
            // We don't install ourselves multiple times.
            debug('Already ran for this request, returning true');
            return true;
        }

        try {
            // Config check
            if (this.gripProxies == null) {
                debug('ERROR - No Grip configuration provided. Send error, returning false');
                res.setStatus(500);
                res.end('No Grip configuration provided.\n');
                return false;
            }

            debug("gripProxies", this.gripProxies);

            // ## Set up req.grip
            debug('Set up req.grip - start');

            const gripSigHeader = req.getHeaderValue('grip-sig');

            let isProxied = false;
            let isSigned = false;
            let needsSigned = false;
            if (gripSigHeader !== undefined) {
                debug('grip-sig header exists');
                const publisher = this.getPublisher();
                const clients = publisher.clients;

                if (clients.length > 0) {
                    if (clients.every((client) => client.getVerifyKey() != null)) {
                        needsSigned = true;
                        // If all proxies have keys, then only consider the request
                        // signed if at least one of them has signed it
                        if (
                            clients.some((client) =>
                                validateSig(gripSigHeader, client.getVerifyKey()!, client.getVerifyIss())
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
                res.setStatus(501);
                res.end('Not Implemented.\n');
                return false;
            }

            let wsContext: WebSocketContext | null = null;

            if (isApiRequestWsOverHttp(req)) {
                try {
                    wsContext = await getWebSocketContextFromApiRequest(req);
                } catch(ex) {
                    if (ex instanceof ConnectionIdMissingException) {
                        debug("ERROR - connection-id header needed. Send Error, returning false");
                        res.setStatus(400);
                        res.end('WebSocket event missing connection-id header.\n');
                        return false;
                    }
                    if (ex instanceof WebSocketDecodeEventException) {
                        debug("ERROR - error parsing websocket events. Send Error, returning false");
                        res.setStatus(400);
                        res.end('Error parsing WebSocket events.\n');
                        return false;
                    }
                    debug("ERROR - unknown exception getting web socket context from request");
                    debug(ex);
                    res.setStatus(400);
                    res.end('Error getting web socket Context.\n');
                    return false;
                }
            }

            req.setGrip({
                isProxied,
                isSigned,
                needsSigned,
                wsContext,
            });

            debug('Set up req.grip - end');

            // ## Set up res.grip
            debug('Set up res.grip - start');

            let gripInstruct: GripInstruct | null = null;
            res.setGrip({
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

            // ## Monkey-patch res methods
            if (wsContext != null) {
                debug('Monkey-patch res methods for WS-over-HTTP - start');

                this.monkeyPatchResMethodsForWebSocket(res, wsContext);

                debug('Monkey-patch res methods for WS-over-HTTP - end');

            } else {

                debug('Monkey-patch res methods for GripInstruct - start');

                this.monkeyPatchResMethodsForGripInstruct(res, () => gripInstruct);

                debug('Monkey-patch res methods for GripInstruct - end');
            }

        } catch (ex) {
            throw ex instanceof Error ? ex : new Error(String(ex));
        }

        debug('ServeGrip#run - end');
        return true;
    }

    abstract monkeyPatchResMethodsForWebSocket(res: IGripApiResponse<any>, wsContext: WebSocketContext): void;
    abstract monkeyPatchResMethodsForGripInstruct(res: IGripApiResponse<any>, gripInstructGetter: () => GripInstruct | null): void;
}
