import { WebSocketMessageFormat } from '@fanoutio/grip';
import { CHANNEL_NAME, serveGrip } from '../../lib/grip';

export default async (req, res) => {

    if (!(await serveGrip.run(req, res))) {
        return;
    }

    const { method } = req;
    if (method === 'POST') {

        const publisher = serveGrip.getPublisher();
        await publisher.publishFormats(CHANNEL_NAME, new WebSocketMessageFormat(req.body));

        res.setHeader('Content-Type', 'text/plain');
        res.end('Ok\n');

    } else {

        res.statusCode = 405;
        res.end();

    }


};
