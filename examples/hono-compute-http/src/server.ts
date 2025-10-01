import { ConfigStore } from 'fastly:config-store';
import { Hono } from 'hono';
import { fire } from 'hono/service-worker'

import { serveGrip, fanoutSelfHandoffMiddleware, type Variables } from '@fanoutio/serve-grip/hono';

type Env = {
    Variables: Variables,
};
const app = new Hono<Env>();

const CHANNEL_NAME = 'test';

const serveGripMiddleware = serveGrip(() => {
    return {
        grip: new ConfigStore('grip').get('GRIP_URL') ?? 'http://localhost:5561/',
    };
});

app.use(serveGripMiddleware);

app.get('/api/*', fanoutSelfHandoffMiddleware());

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

    const publisher = c.var.grip.getPublisher();
    await publisher.publishHttpStream(CHANNEL_NAME, data + '\n');

    return c.text('Ok\n');

});

fire(app);
