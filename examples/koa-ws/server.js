const Koa = require( 'koa' );
const Router = require( '@koa/router' );
const KoaBody = require( 'koa-body' );
const { ServeGrip } = require( '@fanoutio/serve-grip' );
const { WebSocketMessageFormat } = require( '@fanoutio/grip' );

const PORT = 3000;
const CHANNEL_NAME = 'test';
const PUSHPIN_URL = 'http://localhost:5561/';

const app = new Koa();

const serveGripMiddleware = new ServeGrip({
    grip: {
        control_uri: PUSHPIN_URL,
    },
});

app.use(serveGripMiddleware.koa);

const router = new Router();

// Websocket-over-HTTP is translated to HTTP POST
router.post('/api/websocket', ctx => {

    const { wsContext } = ctx.req.grip;
    if (wsContext == null) {
        ctx.status = 400;
        ctx.body = '[not a websocket request]\n';
        return;
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

    // In Koa, specifically set the response body to null so that
    // it doesn't return 404
    ctx.body = null;

});

router.post('/api/broadcast', KoaBody(), async ctx => {

    const publisher = serveGripMiddleware.getPublisher();
    await publisher.publishFormats(CHANNEL_NAME, new WebSocketMessageFormat(ctx.request.body));

    ctx.set('Content-Type', 'text/plain');
    ctx.body = 'Ok\n';

});

app.use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
