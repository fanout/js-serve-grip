import { CHANNEL_NAME, serveGripMiddleware } from '../../lib/grip';

export default async (req, res) => {

    await serveGripMiddleware.run(req, res);

    const { method } = req;
    if (method === 'POST') {

        const data = req.body;

        // Publish stream data to subscribers
        const publisher = serveGripMiddleware.getPublisher();
        await publisher.publishHttpStream(CHANNEL_NAME, data + '\n');

        res.setHeader('Content-Type', 'text/plain');
        res.end('Ok\n');

    } else {

        res.statusCode = 405;
        res.end();

    }

};
