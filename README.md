## js-serve-grip

GRIP library for Node.js, provided as `connect`-compatible middleware.

Therefore, this library is usable with frameworks such as the following:

* [connect](https://github.com/senchalabs/Connect)
* [Express](https://expressjs.com/)
* [Next.js](https://nextjs.org/)
* [Koa](https://koajs.org/) *experimental support

Supported GRIP servers include:

* [Pushpin](http://pushpin.org/)
* [Fastly Fanout](https://docs.fastly.com/products/fanout)

This library also supports legacy services hosted by [Fanout](https://fanout.io/) Cloud.

Authors: Katsuyuki Omuro <komuro@fastly.com>, Konstantin Bokarius <kon@fanout.io>

### Introduction

[GRIP](https://pushpin.org/docs/protocols/grip/) is a protocol that enables a web service to
delegate realtime push behavior to a proxy component, using HTTP and headers.

`@fanoutio/serve-grip` is a server middleware that works with frameworks such as Express and
Next.js. It:
* gives a simple and straightforward way to configure these frameworks against your GRIP proxy
* parses the `Grip-Sig` header in any requests to detect if they came through a Grip proxy
* provides your route handler with tools to handle such requests, such as:
  * access to information about whether the current request is proxied or is signed
  * methods you can call to issue any instructions to the GRIP proxy
* provides access to the the publisher object, enabling your application to publish messages through
  the GRIP publisher.

Additionally, `serve-grip` also handles
[WebSocket-Over-HTTP processing](https://pushpin.org/docs/protocols/websocket-over-http/) so
that WebSocket connections managed by the GRIP proxy can be controlled by your route handlers.

### Installation

Install the library.

```sh
npm install @fanoutio/serve-grip
```

#### Installation in Connect / Express

Import the `ServeGrip` class and instantiate the middleware. Then install it before your routes.

Example:
```javascript
import express from 'express';
import { ServeGrip } from '@fanoutio/serve-grip';

const app = express();

const serveGrip = new ServeGrip(/* config */);
app.use( serveGrip ); 

app.use( '/path', (res, req) => {

    if (req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        res.end('[stream open]\n');
    }

});

app.listen(3000);
```

#### Installation in Koa (experimental)

Import the `ServeGrip` class and instantiate it. The Koa middleware is available
as the `.koa` property on the object. Install it before your routes.

Example:
```javascript
import Koa from 'koa';
import Router from '@koa/router';
import { ServeGrip } from '@fanoutio/serve-grip';

const app = new Koa();

const serveGrip = new ServeGrip(/* config */);
app.use( serveGrip.koa );

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

Import the `ServeGrip` class and instantiate the middleware, and then run it in your handler
before your application logic by calling the async function `serveGrip.run()`.

Example:
`/lib/grip.js`:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip';
export const serveGrip = new ServeGrip(/* config */);
```

`/pages/api/path.js`:
```javascript
import { serveGrip } from '/lib/grip';

export default async(req, res) => {
    // Run the middleware
    if (!(await serveGrip.run(req, res))) {
        // If serveGrip.run() has returned false, it means the middleware has already
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

Note: In Next.js, you must specifically call the middleware from each of your applicable API routes.
This is because in Next.js, your API routes will typically run on a serverless platform, and objects
will be recycled after each request. You are advised to construct a singleton instance of the
middleware in a shared location and reference it from your API routes.  

### Configuration

`@fanoutio/serve-grip` exports a constructor function, `ServeGrip`.  This constructor takes a
configuration object that can be used to configure the instance, such as the GRIP proxies to use
for publishing or whether incoming requests should require a GRIP proxy.

The following is an example of configuration against Pushpin running on localhost:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip';
const serveGrip = new ServeGrip({
    grip: {
        control_uri: 'https://localhost:5561/',   // Control URI for Pushpin publisher
        control_iss: '<issuer>',                  // (opt.) iss needed for publishing, if required by Pushpin
        key: '<publish-key>',                     // (opt.) key needed for publishing, if required by Pushpin
    },
    isGripProxyRequired: true,
});
```

The following is an example of configuration against Fastly Fanout:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip';
const serveGrip = new ServeGrip({
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
import { ServeGrip } from '@fanoutio/serve-grip';

const serveGrip = new ServeGrip({
    grip: process.env.GRIP_URL,
    gripVerifyKey: process.env.GRIP_VERIFY_KEY,
    isGripProxyRequired: true,
});
```

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

To publish messages, call `serveGrip.getPublisher()` to obtain a
`Publisher`. Use it to publish messages using the endpoints and 
prefix specified to the `ServeGrip` constructor.

| Key                        | Description                                                                                                                                                                                |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `serveGrip.getPublisher()` | Returns an instance of `Publisher`, which can be used to publish messages to the provided publishing endpoints using the provided prefix. See `@fanoutio/grip` for details on `Publisher`. |

### Examples

This repository contains examples to illustrate the use of `serve-grip` in Connect / Express
and Next.js, which can be found in the `examples` directory.  For details on each example, please
read the `README.md` files in the corresponding directories.  

### Advanced

#### Next.js alternative invocation

As an alternative method of running `serveGrip` in a Next.js API route, since `serveGrip` is
`connect`-compatible, you may use the process described in
[API Middlewares](https://nextjs.org/docs/api-routes/api-middlewares#connectexpress-middleware-support).
This may be useful for example if you have multiple middlewares and you wish to call them in a
uniform manner.

Example:
`/lib/grip.js`:
```javascript
import { ServeGrip } from '@fanoutio/serve-grip';
export const serveGrip = new ServeGrip(/* config */);

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
// https://nextjs.org/docs/api-routes/api-middlewares#connectexpress-middleware-support
export function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result)
            }

            return resolve(result)
        })
    })
}
```

`/pages/api/path.js`:
```javascript
import { serveGrip, runMiddleware } from '/lib/grip';

export default async(req, res) => {

    // Run the middleware
    await runMiddleware(req, res, serveGrip);

    if (req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        res.end('[stream open]\n');
    }

}
```

#### Changes from `express-grip`

If you have used `express-grip` in the past, you will notice that this library no longer
requires the use of pre-route and post-route middlewares.  Consequently, you do not need to
call `next()` for route handlers that complete their work.  In fact, you should follow the
standard practice of calling `res.end()` at the end of each of your route handlers.
