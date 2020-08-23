import { IGripConfig, Publisher } from '@fanoutio/grip';

export default interface IServeGripConfig {
    grip?: string | IGripConfig | IGripConfig[] | Publisher;
    gripProxyRequired?: boolean;
    prefix?: string;
}
