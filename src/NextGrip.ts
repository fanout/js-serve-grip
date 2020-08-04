import { OutgoingHttpHeaders } from "http";

import { GripInstruct, IGripConfig, IPublisherConfig, PrefixedPublisher, Publisher, validateSig } from "@fanoutio/grip";
import INextGripConfig from "./INextGripConfig";
import IRequestGrip from "./IRequestGrip";

import { NextGripApiResponse } from "./NextGripApiResponse";
import { NextGripApiRequest } from "./NextGripApiRequest";
import { NextGripApiHandler } from "./NextGripApiHandler";
import IResponseGrip from "./IResponseGrip";

function flattenHeader(value: undefined | string | string[]) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}

export default class NextGrip {
    gripProxies?: IGripConfig[];
    pubServers?: IPublisherConfig[];
    prefix: string = '';
    isGripProxyRequired: boolean = false;
    _publisher?: PrefixedPublisher;

    constructor(config?: INextGripConfig) {
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

    createGripHandler(fn: NextGripApiHandler) {
        return async (req: NextGripApiRequest, res: NextGripApiResponse) => {

            // Initialize the API request and response with
            // NextGrip fields.

            const requestGrip: IRequestGrip = {
                isProxied: false,
                isSigned: false,
            };
            Object.assign(req, { grip: requestGrip });

            const responseGrip: IResponseGrip = {
            };
            Object.assign(req, { grip: requestGrip });

            // Set request GRIP values
            Object.assign(requestGrip, this.checkGripStatus(req));

            // Set response GRIP values
            if (requestGrip.isProxied) {

                const gripInstruct = new GripInstruct();

                const resWriteHead = res.writeHead;

                // This overrides a writeHead, a function with a complex type declaration.
                // @ts-ignore
                res.writeHead = (statusCode: number, reason?: string, obj?: OutgoingHttpHeaders) => {

                    console.log("writeHead", statusCode, reason, obj);

                    if (typeof reason === 'string') {
                        // assume this was called like this:
                        // writeHead(statusCode, reasonPhrase[, headers])
                    } else {
                        // this was called like this:
                        // writeHead(statusCode[, headers])
                        obj = reason;
                    }

                    obj = Object.assign({}, obj, gripInstruct.toHeaders());

                    if (typeof reason === 'string') {
                        resWriteHead.call(res, statusCode, reason, obj);
                    } else {
                        resWriteHead.call(res, statusCode, obj);
                    }
                };

                responseGrip.gripInstruct = gripInstruct;
            } else {
                // NOT PROXIED, needs to fail now
                if (this.isGripProxyRequired) {
                    res.statusCode = 501;
                    res.end('Not Implemented.\n');
                    return;
                }
            }

            await fn(req, res);

        };
    }
}




