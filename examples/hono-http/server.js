import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { serveGrip } from '@fanoutio/serve-grip/hono';

const app = new Hono();

const PORT = 3000;
const CHANNEL_NAME = 'test';
const PUSHPIN_URL = 'http://localhost:5561/';

const serveGripMiddleware = serveGrip({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});

app.use(serveGripMiddleware);

app.get('/api/stream', async (c) => {

    if (!c.var.grip.isProxied) {
        return c.text('[not proxied]\n', 400);
    }
    if (c.var.grip.needsSigned && !c.var.grip.isSigned) {
        return c.text('[not signed]\n', 400);
    }

    const gripInstruct = c.var.grip.startInstruct();
    gripInstruct.addChannel(CHANNEL_NAME);
    gripInstruct.setHoldStream();

    return c.text('[stream open]\n');

});

app.post('/api/publish', async (c) => {

    const data = await c.req.text();

    const publisher = c.var.grip.getPublisher();
    await publisher.publishHttpStream(CHANNEL_NAME, data + '\n');

    return c.text('Ok\n');

});

serve({ fetch: app.fetch, port: PORT }, (addr) => {
    console.log(`Example app listening on port ${addr.port}!`)
});
