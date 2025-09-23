const Koa = require( 'koa' );
const Router = require( '@koa/router' );
const KoaBody = require( 'koa-body' );
const { ServeGrip } = require( '@fanoutio/serve-grip' );

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

router.get('/api/stream', ctx => {

    if (ctx.req.grip.isProxied) {

        const gripInstruct = ctx.res.grip.startInstruct();
        gripInstruct.addChannel(CHANNEL_NAME);
        gripInstruct.setHoldStream();

        ctx.set('Content-Type', 'text/plain');
        ctx.body = '[stream open]\n';

    } else {

        ctx.set('Content-Type', 'text/plain');
        ctx.body = '[not proxied]\n';

    }

});

router.post('/api/publish', KoaBody(), async ctx => {

    const data = ctx.request.body;

    const publisher = serveGripMiddleware.getPublisher();
    await publisher.publishHttpStream(CHANNEL_NAME, data + '\n');

    ctx.set('Content-Type', 'text/plain');
    ctx.body = 'Ok\n';

});

app.use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
