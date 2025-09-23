const express = require( 'express' );
const { ServeGrip } = require( '@fanoutio/serve-grip' );

const PORT = 3000;
const CHANNEL_NAME = 'test';
const PUSHPIN_URL = 'http://localhost:5561/';

const app = express();

const serveGripMiddleware = new ServeGrip({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});

app.use(serveGripMiddleware);

app.get('/api/stream', async function(req, res) {

    if (req.grip.isProxied) {

        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel(CHANNEL_NAME);
        gripInstruct.setHoldStream();

        res.setHeader('Content-Type', 'text/plain');
        res.end('[stream open]\n');

    } else {

        res.setHeader('Content-Type', 'text/plain');
        res.end("[not proxied]\n");

    }

});

app.post('/api/publish', express.text({ type: '*/*' }), async function(req, res, next) {

    const data = req.body;

    const publisher = serveGripMiddleware.getPublisher();
    await publisher.publishHttpStream(CHANNEL_NAME, data + '\n');

    res.setHeader('Content-Type', 'text/plain');
    res.end('Ok\n');

});

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))
