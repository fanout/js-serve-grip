import {
    HttpResponseFormat,
    HttpStreamFormat,
    IFormat,
    IItem,
    Publisher,
} from "@fanoutio/grip";

export default class PrefixedPublisher {

    private readonly publisher: Publisher;
    private readonly prefix: string;

    constructor(
        publisher: Publisher,
        prefix: string
    ) {
        this.publisher = publisher;
        this.prefix = prefix;
    }

    public async publish(channel: string, item: IItem) {
        await this.publisher.publish(
            this.prefix + channel,
            item
        );
    };

    public async publishFormats(channel: string, formats: IFormat | IFormat[], id?: string, prevId?: string) {
        await this.publisher.publishFormats(
            this.prefix + channel,
            formats,
            id,
            prevId
        );
    };

    public async publishHttpResponse(channel: string, data: HttpResponseFormat | string, id?: string, prevId?: string) {
        await this.publisher.publishHttpResponse(
            this.prefix + channel,
            data,
            id,
            prevId
        );
    }

    public async publishHttpStream(channel: string, data: HttpStreamFormat | string, id?: string, prevId?: string) {
        await this.publisher.publishHttpStream(
            this.prefix + channel,
            data,
            id,
            prevId,
        );
    }
}