import { IGripConfig, IPublisherConfig } from "@fanoutio/grip";

export default interface IConnectGripConfig {
    gripProxies?: IGripConfig[];
    gripPubServers?: IPublisherConfig[];
    gripProxyRequired?: boolean;
    gripPrefix?: string;
}
