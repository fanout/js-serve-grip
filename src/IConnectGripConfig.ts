import { IGripConfig } from "@fanoutio/grip";

export default interface IConnectGripConfig {
    gripProxies?: IGripConfig[];
    gripProxyRequired?: boolean;
    gripPrefix?: string;
}
