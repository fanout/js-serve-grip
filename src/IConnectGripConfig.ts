import {
    IGripConfig,
    Publisher,
} from "@fanoutio/grip";

export default interface IConnectGripConfig {
    grip?: string | IGripConfig | IGripConfig[] | Publisher;
    gripProxyRequired?: boolean;
    prefix?: string;
}
