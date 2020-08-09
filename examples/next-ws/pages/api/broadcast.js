import { WebSocketMessageFormat } from "@fanoutio/grip";
import { CHANNEL_NAME, connectGrip } from "../../lib/grip";

export default async (req, res) => {

    await connectGrip.run(req, res);

    const { method } = req;
    if (method === 'POST') {

        const publisher = connectGrip.getPublisher();
        await publisher.publishFormats(CHANNEL_NAME, new WebSocketMessageFormat(req.body));

        res.setHeader('Content-Type', 'text/plain');
        res.end('Ok\n');

    } else {

        res.statusCode = 405;
        res.end();

    }


};
