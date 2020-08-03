import { Publisher, Item, GripInstruct, validateSig, IGripConfig, IPublisherConfig, IFormat } from "@fanoutio/grip";
import INextGripConfig from "./INextGripConfig";
import {NextGripApiResponse} from "./NextGripApiResponse";
import {NextGripApiRequest} from "./NextGripApiRequest";
import {NextGripApiHandler} from "./NextGripApiHandler";
import { OutgoingHttpHeaders } from "http";

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
    _publisher?: Publisher;

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

        let gripProxied = false;
        let gripSigned = false;
        if (gripSigHeader !== undefined && Array.isArray(this.gripProxies) && this.gripProxies.length > 0) {
            if (this.gripProxies.every(proxy => proxy.key)) {
                // If all proxies have keys, then only consider the request
                // signed if at least one of them has signed it
                if (this.gripProxies.some(proxy => validateSig(gripSigHeader, proxy.key))) {
                    gripProxied = true;
                    gripSigned = true;
                }
            } else {
                gripProxied = true;
            }
        }
        return {
            gripProxied,
            gripSigned,
        };
    }

    _getPublisher() {
        if (this._publisher == null) {
            this._publisher = new Publisher();
            if (this.gripProxies != null) {
                this._publisher.applyConfig(this.gripProxies);
            }
            if (this.pubServers != null) {
                this._publisher.applyConfig(this.pubServers);
            }
        }
        return this._publisher;
    }

    createGripHandler(fn: NextGripApiHandler) {
        return async (req: NextGripApiRequest, res: NextGripApiResponse) => {

            Object.assign(req, this.checkGripStatus(req));

            if (req.gripProxied) {

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

                res.gripInstruct = gripInstruct;
            } else {
                // NOT PROXIED, needs to fail now
                if (this.isGripProxyRequired) {
                    res.statusCode = 501;
                    res.end('Not Implemented.\n');
                    return;
                }
            }

            res.gripPublish = async (channel: string, formats: IFormat | IFormat[], id?: string, prevId?: string) => {
                const pubControl = this._getPublisher();
                await pubControl.publish(
                    this.prefix + channel,
                    new Item(formats, id, prevId)
                );
            };

            await fn(req, res);

        };
    }
}




