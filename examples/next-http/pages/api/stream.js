import { CHANNEL_NAME, serveGrip } from '../../lib/grip';

export default async (req, res) => {

    await serveGrip.run(req, res);

    const { method } = req;
    if (method === 'GET') {

        if (req.grip.isProxied) {

            const gripInstruct = res.grip.startInstruct();
            gripInstruct.addChannel(CHANNEL_NAME);
            gripInstruct.setHoldStream();

            res.setHeader('Content-Type', 'text/plain');
            res.end("[open stream]\n");

        } else {

            res.setHeader('Content-Type', 'text/plain');
            res.end("[not proxied]\n");

        }

    } else {

        res.statusCode = 405; // Method not allowed.
        res.end();

    }

};
