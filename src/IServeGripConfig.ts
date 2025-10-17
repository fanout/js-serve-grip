import {
    type IGripConfig,
    Publisher,
} from '@fanoutio/grip';

export interface IServeGripConfig {
    grip?: string | IGripConfig | IGripConfig[] | Publisher;
    gripVerifyKey?: string | Uint8Array;
    gripProxyRequired?: boolean;
    prefix?: string;
    publisherClass?: { new(): Publisher }
}
