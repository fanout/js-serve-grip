import { Hono } from 'hono';
import { buildFire } from '@fastly/hono-fastly-compute';

import { WebSocketMessageFormat } from '@fanoutio/grip';
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

// Websocket-over-HTTP is translated to HTTP POST
app.post('/api/websocket', async (c) => {

    const { wsContext } = c.var.grip;
    if (wsContext == null) {
        return c.text('[not a websocket request]\n', 400);
    }

    // If this is a new connection, accept it and subscribe it to a channel
    if (wsContext.isOpening()) {
        wsContext.accept();
        wsContext.subscribe(CHANNEL_NAME);
    }

    while (wsContext.canRecv()) {
        const message = wsContext.recv();

        if (message == null) {
            // If return value is undefined then connection is closed
            wsContext.close();
            break;
        }

        // Echo the message
        wsContext.send(message);
    }

    // In Hono, by not returning anything we effectively return a response
    // with a 200 status code and an empty body.

    // This signals to the middleware to send a response that
    // encodes the WebSocket context's outgoing events.
});

app.post('/api/broadcast', async (c) => {

    const data = await c.req.text();

    const publisher = c.var.grip.getPublisher();
    await publisher.publishFormats(CHANNEL_NAME, new WebSocketMessageFormat(data));

    return c.text('Ok\n');

});

fire(app);
