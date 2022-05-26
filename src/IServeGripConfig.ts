import { IGripConfig, PublisherBase } from '@fanoutio/grip';

export interface IServeGripConfig {
    grip?: string | IGripConfig | IGripConfig[] | PublisherBase<any>;
    gripProxyRequired?: boolean;
    prefix?: string;
    publisherClass?: { new(): PublisherBase<any> }
}
