import { WebSocketMessageFormat } from '@fanoutio/grip';
import { CHANNEL_NAME, serveGripMiddleware } from '../../lib/grip';

export default async (req, res) => {

    if (!(await serveGripMiddleware.run(req, res))) {
        return;
    }

    const { method } = req;
    if (method === 'POST') {

        const publisher = serveGripMiddleware.getPublisher();
        await publisher.publishFormats(CHANNEL_NAME, new WebSocketMessageFormat(req.body));

        res.setHeader('Content-Type', 'text/plain');
        res.end('Ok\n');

    } else {

        res.statusCode = 405;
        res.end();

    }


};
