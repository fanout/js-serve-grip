import { IGripConfig, IPublisherConfig } from "@fanoutio/grip";

export default interface INextGripConfig {
    gripProxies?: IGripConfig[];
    gripPubServers?: IPublisherConfig[];
    gripProxyRequired?: boolean;
    gripPrefix?: string;
}
