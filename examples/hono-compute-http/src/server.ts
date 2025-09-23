import { createFanoutHandoff } from 'fastly:fanout';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { fire } from 'hono/service-worker'

import { serveGrip, type Env } from '@fanoutio/serve-grip/hono';

const app = new Hono<Env>();

const CHANNEL_NAME = 'test';
const PUSHPIN_URL = 'http://localhost:5561/';

const serveGripMiddleware = serveGrip({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});

app.use(serveGripMiddleware);

app.get('/api/*', createMiddleware(async (c, next) => {
    if (!c.var.grip.isProxied) {
        c.res = null;
        c.res = createFanoutHandoff(c.req.raw, 'self');
        return;
    }
    await next();
}));

app.get('/api/stream', async (c) => {

    if (c.var.grip.isProxied) {

        const gripInstruct = c.var.grip.startInstruct();
        gripInstruct.addChannel(CHANNEL_NAME);
        gripInstruct.setHoldStream();

        return c.text('[stream open]\n');

    } else {

        return c.text('[not proxied]\n');

    }

});

app.post('/api/publish', async (c) => {

    const data = await c.req.text();

    const publisher = serveGripMiddleware.getPublisher();
    await publisher.publishHttpStream(CHANNEL_NAME, data + '\n');

    return c.text('Ok\n');

});

fire(app as unknown as Hono);
