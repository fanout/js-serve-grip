import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveGrip } from '@fanoutio/serve-grip/hono';
import { WebSocketMessageFormat } from "@fanoutio/grip";

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

// Websocket-over-HTTP is translated to HTTP POST
app.post('/api/websocket', async (c) => {

    const { wsContext } = c.var.grip;
    if (wsContext == null) {
        c.status(400);
        return c.text('[not a websocket request]\n');
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

    const publisher = serveGripMiddleware.getPublisher();
    await publisher.publishFormats(CHANNEL_NAME, new WebSocketMessageFormat(data));

    return c.text('Ok\n');

});

serve({ fetch: app.fetch, port: PORT }, (addr) => {
    console.log(`Example app listening on port ${addr.port}!`)
});
