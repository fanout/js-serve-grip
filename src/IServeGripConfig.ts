import {
    type IGripConfig,
    Publisher,
} from '@fanoutio/grip';

export interface IServeGripConfig {
    grip?: string | IGripConfig | IGripConfig[] | Publisher;
    gripVerifyKey?: string | Buffer;
    gripProxyRequired?: boolean;
    prefix?: string;
    publisherClass?: { new(): Publisher }
}
