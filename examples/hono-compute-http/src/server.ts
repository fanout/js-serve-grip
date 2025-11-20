import { Hono } from 'hono';
import { buildFire } from '@fastly/hono-fastly-compute';

import { serveGrip, fanoutSelfHandoffMiddleware, type Variables } from '@fanoutio/serve-grip/hono';
import { type IServeGripConfig } from '@fanoutio/serve-grip';

const fire = buildFire({
    grip: "ConfigStore",
});

type Env = {
    Variables: Variables,
    Bindings: typeof fire.Bindings,
};
const app = new Hono<Env>();

const CHANNEL_NAME = 'test';

const serveGripMiddleware = serveGrip<Env>((c) => {
    return {
        grip: c.env.grip.get('GRIP_URL') ?? 'http://localhost:5561/',
        gripVerifyKey: c.env.grip.get('GRIP_VERIFY_KEY'),
    } satisfies IServeGripConfig;
});

app.use(serveGripMiddleware);

app.get('/api/*', fanoutSelfHandoffMiddleware());

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

fire(app);
