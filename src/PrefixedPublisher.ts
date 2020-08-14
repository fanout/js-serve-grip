import {
    IItem,
    Publisher,
} from "@fanoutio/grip";

export default class PrefixedPublisher extends Publisher {

    private readonly prefix: string;

    constructor(
        base: Publisher,
        prefix: string
    ) {
        super();
        this.clients = base.clients;
        this.prefix = prefix;
    }

    public async publish(channel: string, item: IItem) {
        await super.publish(
            this.prefix + channel,
            item
        );
    };

}