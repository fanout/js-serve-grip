## js-serve-grip

GRIP library for JavaScript, provided as `express` and `hono` compatible middleware.

This library is designed to assist the creation of backend server applications
written in JavaScript that utilize [GRIP](https://pushpin.org/docs/protocols/grip/).
This library is usable with the following frameworks:

* [Express](https://expressjs.com/)
* [Hono](https://hono.dev/)
* [Next.js](https://nextjs.org/)
* [connect](https://github.com/senchalabs/Connect)
* [Koa](https://koajs.org/) *experimental support

Supported GRIP servers include:

* [Pushpin](http://pushpin.org/)
* [Fastly Fanout](https://docs.fastly.com/products/fanout)

Authors: Katsuyuki Omuro <komuro@fastly.com>, Konstantin Bokarius <kon@fanout.io>

## New for v3

### Breaking changes

- `ServeGripBase` no longer declares `monkeyPatchResMethodsForWebSocket` and
  `monkeyPatchResMethodsForGripInstruct` abstract methods. Instead,
  at the end of the `run` method, the `onAfterSetup()` method is called.

### Enhancements

- Now adds support for [Hono](https://hono.dev/) framework.

## Usage

### Introduction

[GRIP](https://pushpin.org/docs/protocols/grip/) is a protocol that enables a web service to
delegate realtime push behavior to a proxy component, using HTTP and headers.

`@fanoutio/serve-grip` is a server middleware that works with frameworks such as Express and
Hono. It:
* gives a simple and straightforward way to configure these frameworks against your GRIP proxy
* parses the `Grip-Sig` header in any requests to detect if they came through a Grip proxy
* provides your route handler with tools to handle such requests, such as:
  * access to information about whether the current request is proxied or is signed
  * methods you can call to issue any instructions to the GRIP proxy
* provides access to the `Publisher` object, enabling your application to publish messages through
  the GRIP publisher.

Additionally, `serve-grip` also handles
[WebSocket-Over-HTTP processing](https://pushpin.org/docs/protocols/websocket-over-http/) so
that WebSocket connections managed by the GRIP proxy can be controlled by your route handlers.

### Installation

Install the library.

```sh
npm install @fanoutio/serve-grip
```

#### Installation in Express / Connect

Import the `ServeGrip` class from `@fanoutio/serve-grip/node` and instantiate the middleware. Then install it before
your routes.

Example:
```javascript
import express from 'express';
import { ServeGrip } from '@fanoutio/serve-grip/node';

const app = express();

const serveGripMiddleware = new ServeGrip(/* config */);
app.use(serveGripMiddleware); 

app.use('/path', (res, req) => {

    if (req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        res.end('[stream open]\n');
    }

});

app.listen(3000);
```

#### Installation in Hono

> [!NOTE]
> It's strongly recommended to use [TypeScript](https://www.typescriptlang.org) when working with Hono.

Import the `serveGrip` function from `@fanoutio/serve-grip/hono` instantiate the middleware. Then install it before
your routes.

Additionally, import the `Env` type and use it when instantiating `Hono`. This enables type
checking for the `c.var.grip` context variable.

Example:
```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveGrip, type Env } from '@fanoutio/serve-grip/hono';

const app = new Hono<Env>();

const serveGripMiddleware = serveGrip(/* config */);
app.use(serveGripMiddleware);

app.use( '/path', async (c) => {

    if (c.var.grip.isProxied) {
        const gripInstruct = c.var.grip.startInstruct();
        gripInstruct.addChannel(CHANNEL_NAME);
        gripInstruct.setHoldStream();
        return c.text('[stream open]\n');
    }

});

serve({ fetch: app.fetch, port: 3000 }, (addr) => {
    console.log(`Example app listening on port ${addr.port}!`)
});
```

> [!NOTE]
> The above example is for Hono running on Node.js. Hono can be used with
> other server platforms as well. For details on adapting the application to
> other platforms, see [Hono's guide](https://hono.dev/docs/getting-started/basic).
>
> For examples of using this library with Hono on a backend application running
> on Fastly Compute, check out the following example applications:
> - [hono-compute-http](./examples/hono-compute-http)
> - [hono-compute-ws](./examples/hono-compute-ws)

#### Installation in Koa (experimental)

Import the `ServeGrip` class from `@fanoutio/serve-grip/node` and instantiate it. The Koa middleware is available
as the `.koa` property on the object. Install it before your routes.

Example:
```javascript
import Koa from 'koa';
import Router from '@koa/router';
import { ServeGrip } from '@fanoutio/serve-grip/node';

const app = new Koa();

const serveGripMiddleware = new ServeGrip(/* config */);
app.use(serveGripMiddleware.koa);

const router = new Router();

router.use( '/path', ctx => {

    if (ctx.req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        ctx.body = '[stream open]\n';
    }

});

app.use(router.routes())
    .use(router.allowedMethods());

app.listen(3000);
```

#### Installation in Next.js

You may use this library to add GRIP functionality to your
[Next.js API Routes](https://nextjs.org/docs/api-routes/introduction).

Import the `ServeGrip` class from `@fanoutio/serve-grip/node` and instantiate the middleware, and then run it in
your handler before your application logic by calling the async function `serveGripMiddleware.run()`.

Example:
`/lib/grip.js`:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip/node';
export const serveGripMiddleware = new ServeGrip(/* config */);
```

`/pages/api/path.js`:
```javascript
import { serveGripMiddleware } from '/lib/grip';

export default async(req, res) => {
    // Run the middleware
    if (!(await serveGripMiddleware.run(req, res))) {
        // If serveGripMiddleware.run() has returned false, it means the middleware has already
        // sent and ended the response, usually due to an error.  
        return;
    }

    if (req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        res.end('[stream open]\n');
    }

}
```

> [!NOTE]
> In Next.js, you must specifically call the middleware from each of your applicable API routes.
> This is because in Next.js, your API routes will typically run on a serverless platform, and objects
> will be recycled after each request. You are advised to construct a singleton instance of the
> middleware in a shared location and reference it from your API routes.  

### Configuration

`@fanoutio/serve-grip/node` exports a class constructor named `ServeGrip`.  This constructor takes a
configuration object that can be used to configure the instance, such as the GRIP proxies to use
for publishing or whether incoming requests should require a GRIP proxy.

The following is an example of configuration when the GRIP proxy is an instance of
Pushpin running on localhost:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip/node';
const serveGripMiddleware = new ServeGrip({
    grip: {
        control_uri: 'https://localhost:5561/',   // Control URI for Pushpin publisher
        control_iss: '<issuer>',                  // (opt.) iss needed for publishing, if required by Pushpin
        key: '<publish-key>',                     // (opt.) key needed for publishing, if required by Pushpin
    },
    isGripProxyRequired: true,
});
```

The following is an example of configuration when the GRIP proxy is Fastly Fanout:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip/node';
const serveGripMiddleware = new ServeGrip({
    grip: {
        control_uri: 'https://api.fastly.com/service/<service-id>/',   // Control URI
        key: '<fastly-api-token>',             // Authorization key for publishing (Fastly API Token)
        verify_iss: 'fastly:<service-id>',     // Fastly issuer used for validating Grip-Sig
        verify_key: '<verify-key>',            // Fastly public key used for validating Grip-Sig
    },
    isGripProxyRequired: true,
});
```

Often the configuration is done using a `GRIP_URL` (and if needed, `GRIP_VERIFY_KEY`), allowing for configuration using simple strings. This allows for configuration from environment variables:

```
GRIP_URL="https://api.fastly.com/service/<service-id>/?verify-iss=fastly:<service-id>&key=<fastly-api-token>"
GRIP_VERIFY_KEY="base64:LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFQ0tvNUExZWJ5RmNubVZWOFNFNU9uKzhHODFKeQpCalN2Y3J4NFZMZXRXQ2p1REFtcHBUbzN4TS96ejc2M0NPVENnSGZwLzZsUGRDeVlqanFjK0dNN3N3PT0KLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t"
```

```javascript
import { ServeGrip } from '@fanoutio/serve-grip/node';

const serveGripMiddleware = new ServeGrip({
    grip: process.env.GRIP_URL,
    gripVerifyKey: process.env.GRIP_VERIFY_KEY,
    isGripProxyRequired: true,
});
```

> [!NOTE]
> When used with Hono, `@fanoutio/serve-grip/hono` exports a function named `serveGrip` rather than a constructor.
> This function takes the same parameters as the `ServeGrip` constructor described above.
> 
> Example:
> ```typescript
> import { serveGrip } from '@fanoutio/serve-grip/hono';
> 
> const serveGripMiddleware = serveGrip({
>   grip: process.env.GRIP_URL,
>   gripVerifyKey: process.env.GRIP_VERIFY_KEY,
>   isGripProxyRequired: true,
> });
> ```

Available options:

| Key                 | Value                                                                                                                                                                                                                                                                                              |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `grip`              | A definition of GRIP proxies used to publish messages, or a preconfigured Publisher object from `@fanoutio/grip`. See below for details.                                                                                                                                                           |
| `gripVerifyKey`     | (optional) A string or Buffer that can be used to specify the `verify-key` component of the GRIP configuration.<br />Applies only if -<br />* `grip` is provided as a string, configuration object, or array of configuration objects<br />* `grip` does not already contain a `verify_key` value. |
| `gripProxyRequired` | (optional) A boolean value representing whether all incoming requests should require that they be called behind a GRIP proxy.  If this is true and a GRIP proxy is not detected, then a `501 Not Implemented` error will be issued. Defaults to `false`.                                           |
| `prefix`            | (optional) A string that will be prepended to the name of channels being published to. This can be used for namespacing. Defaults to `''`.                                                                                                                                                         |

In most cases your application will construct a singleton instance of this class and use it as
the middleware.

The `grip` parameter may be provided as any of the following:

1. An object with the following fields:

   | Field         | Description                                                                                       |
   |---------------|---------------------------------------------------------------------------------------------------|
   | `control_uri` | The Control URI of the GRIP client.                                                               |
   | `control_iss` | (optional) The Control ISS, if required by the GRIP client.                                       |
   | `key`         | (optional) string or Buffer. The key to use with the Control ISS, if required by the GRIP client. |
   | `verify_iss`  | (optional) The ISS to use when validating a GRIP signature.                                       |
   | `verify_key`  | (optional) string or Buffer. The key to use when validating a GRIP signature.                     |

2. An array of such objects.

3. A GRIP URI, which is a string that encodes the above as a single string.

4. (advanced) A `Publisher` object that you have instantiated and configured yourself, from `@fanoutio/grip`.

### Handling a route

After the middleware has run, your handler will receive `req` and `res` objects that have been
extended with `grip` properties.  These provide access to the following:

| Key                  | Description                                                                                                                                                                         |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `req.grip.isProxied` | A boolean value indicating whether the current request has been called via a GRIP proxy.                                                                                            |
| `req.grip.isSigned`  | A boolean value indicating whether the current request is a signed request called via a GRIP proxy.                                                                                 |
| `req.grip.wsContext` | If the current request has been made through WebSocket-Over-HTTP, then a `WebSocketContext` object for the current request. See `@fanoutio/grip` for details on `WebSocketContext`. |

| Key                        | Description                                                                                                                                                               |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `res.grip.startInstruct()` | Returns an instance of `GripInstruct`, which can be used to issue instructions to the GRIP proxy to hold connections. See `@fanoutio/grip` for details on `GripInstruct`. |

> [!NOTE]
> When used with Hono, `grip` is available via `c.var.grip`, and contains all the properties of both `req.grip` and `res.grip`.

To publish messages, call `serveGripMiddleware.getPublisher()` to obtain a
`Publisher`. Use it to publish messages using the endpoints and 
prefix specified to the `ServeGrip` constructor.

| Key                                  | Description                                                                                                                                                                                |
|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `serveGripMiddleware.getPublisher()` | Returns an instance of `Publisher`, which can be used to publish messages to the provided publishing endpoints using the provided prefix. See `@fanoutio/grip` for details on `Publisher`. |

### Examples

This repository contains examples to illustrate the use of `serve-grip` in Connect / Express
and Next.js, which can be found in the `examples` directory.  For details on each example, please
read the `README.md` files in the corresponding directories.  

### Advanced

#### Fastly Compute

[Fastly Compute](https://www.fastly.com/documentation/guides/compute/getting-started-with-compute/) is an advanced edge
computing platform offered by [Fastly](https://www.fastly.com) that runs code in your favorite language (compiled to
WebAssembly) on its global edge network.

When using Fastly Compute, it is possible to use a single application both to issue GRIP instructions and to invoke the
GRIP proxy, by specifying the application itself as the _backend_.

> [!HINT]
> The Fastly Compute examples in this repository are configured to illustrate this setup with
> [Fastly Fanout local testing](https://www.fastly.com/documentation/guides/concepts/real-time-messaging/fanout/#run-the-service-locally):
> 
> - [hono-compute-http](./examples/hono-compute-http)
> - [hono-compute-ws](./examples/hono-compute-ws)

When deploying these projects to your Fastly account, you will need to enable Fastly Fanout on
your service, as well as set up the backend on your service to point to itself.
See [deploy to a Fastly Service](https://www.fastly.com/documentation/guides/concepts/real-time-messaging/fanout/#deploy-to-a-fastly-service)
in the Fastly documentation for details.

## License

(C) 2015, 2020 Fanout, Inc.  
(C) 2025 Fastly, Inc.
Licensed under the MIT License, see file LICENSE.md for details.
