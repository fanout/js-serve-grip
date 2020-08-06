## connect-grip

Grip library for Node.js, provided as `connect`-compatible _middleware_.

Therefore, this library is usable with frameworks such as the following:

* [connect](https://github.com/senchalabs/Connect)
* [Express](https://expressjs.com/)
* [Next.js](https://nextjs.org/)

Supported Grip servers include:

* [Pushpin](http://pushpin.org/)
* [Fanout Cloud](https://fanout.io/cloud/)

Authors: Katsuyuki Ohmuro <kats@fanout.io>, Konstantin Bokarius <kon@fanout.io>

### Installation

Install the library.

```sh
npm install @fanoutio/connect-grip
```

#### Installation in Connect / Express

Import the `ConnectGrip` class and instantiate the middleware. Then install it before your routes.

Example:
```javascript
import { ConnectGrip } from '@fanoutio/connect-grip';
const connectGrip = new ConnectGrip(/* config */);

app.use( connectGrip ); 

app.use( '/path', (res, req) => {

    if (req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        res.send('[stream open]\n');
    }

});
```

#### Installation in Next.js

You may use this library to add Grip functionality to your
[Next.js API Routes](https://nextjs.org/docs/api-routes/introduction).

Import the `ConnectGrip` class and instantiate the middleware, and then use the process described in
[API Middlewares](https://nextjs.org/docs/api-routes/api-middlewares) to add the processing to your
API route.

Example:

`/lib/grip.js`:
```javascript
import { ConnectGrip } from '@fanoutio/connect-grip';
export const connectGrip = new ConnectGrip(/* config */);
```

`/pages/api/path.js`:
```javascript
import { connectGrip } from '/lib/grip';

export default async(req, res) => {
    // Run the middleware
    // See this function defined at https://nextjs.org/docs/api-routes/api-middlewares
    await runMiddleware(req, res, connectGrip)

    if (req.grip.isProxied) {
        const gripInstruct = res.grip.startInstruct();
        gripInstruct.addChannel('test');
        gripInstruct.setHoldStream();
        res.send('[stream open]\n');
    }

}
```

In Next.js, you must specifically call the middleware from each of your applicable API routes.
This is because in Next.js, your API routes will typically run on a serverless platform, and objects
will be recycled after each request. You are advised to construct a singleton instance of the
middleware in a shared location and reference it from your API routes.  

#### Changes from `express-grip`

If you have used `express-grip` in the past, you will notice that this library no longer
requires the use of a pre-route and post-route middle.  Consequently, you do not need to
call `next()` for route handlers that complete their work.  In fact, you should follow the
standard practice of calling `res.end()` at the end of each of your route handlers.

### Usage

`connect-grip` parses the `Grip-Sig` header in any requests to detect if they came from a Grip
proxy, and provide your route handler with status information about whether the current request
is proxied or is signed, as well as allow it to issue any hold instructions to the Grip proxy.

Additionally, `connect-grip` also handles
[WebSocket-Over-HTTP processing](https://pushpin.org/docs/protocols/websocket-over-http/) so
that WebSockets managed by the Grip proxy can be controlled by your route handlers.

#### Configuration

`connect-grip` exports a constructor function, `ConnectGrip`.  This constructor takes a
configuration object that can be used to configure the instance, such as the Grip proxies to use
for publishing or whether incoming requests should require a Grip proxy.

```javascript
import { ConnectGrip } from '@fanoutio/connect-grip';
const connectGrip = new ConnectGrip({
    gripProxies: [{
        control_uri: 'https://api.fanout.io/realm/<realm-name>/publish/', // Publishing endpoint
        control_iss: '<realm-name>', // (optional) Needed for servers that require authorization
        key: '<realm-key>',          // (optinoal) Needed for servers that require authorization
    }],
    isGripProxyRequired: true,
});
```

Available options:
| Key | Value |
| --- | --- |
| `gripProxies` | An array of objects that define Grip proxies, used to publish messages. See above for an example. |
| `gripProxyRequired` | A boolean value representing whether all incoming requests should require that they be called behind a Grip proxy.  If this is true and a Grip proxy is not detected, then a `501 Not Implemented` error will be issued. Defaults to `false`. |
| `gripPrefix` | An optional string that will be prepended to the name of channels being published to. This can be used for namespacing. Defaults to `''`. |
| `gripPubServers` | (advanced) An array of objects that define additional publishing endpoints that can be used to publish messages. See the advanced section below for an example. |

In most cases your application will construct a singleton instance of this class and use it as
the middleware.

#### Handling a route

After the middleware has run, your handler will receive `req` and `res` objects that have been
extended with `grip` properties.  These provide access to the following:

| Key | Description |
| --- | --- |
| `req.isProxied` | A boolean value indicating whether the current request has been called via a Grip proxy. |
| `req.isSigned` | A boolean value indicating whether the current request is a signed request called via a Grip proxy. |
| `req.wsContext` | If the current request has been made through WebSocket-Over-HTTP, then a `WebSocketContext` object for the current request. See `@fanoutio/grip` for details on `WebSocketContext`. |

| Key | Description |
| --- | --- |
| `res.startInstruct()` | A function that returns an instance of `GripInstruct`, which can be used to issue instructions to the Grip proxy to hold connections. See `@fanoutio/grip` for details on `GripInstruct`. |

Additionally, you can publish messages to the publishing endpoints that you used when constructing
`ConnectGrip`, by calling the `getPublisher()` function.

| Key | Description |
| --- | --- |
| `connectGrip.getPublisher()` | A function that returns an instance of `Publisher`, which can be used to publish messages to the provided publishing endpoints using the provided prefix. See `@fanoutio/grip` for details on `Publisher`. |

### Examples

(under construction)

This repository will contain examples to illustrate the use of `connect-grip` in Connect / Express
and Next.js.  Please read the `README.md` files in the corresponding folders for details about each
example.  

### Advanced

#### Using additional publishing endpoints

You may publish to additional publishing endpoints by providing them as the `gripPubServers` array
when constructing `ConnectGrip`.

```javascript
import { ConnectGrip } from '@fanoutio/connect-grip';
const connectGrip = new ConnectGrip({
    gripPubServers: [{
        uri: 'https://example.com/path/to/endpoint', // Publishing endpoint
        iss: '<iss>',  // (optional) Needed for servers that require authorization
        key: '<key>',  // (optional) Needed for servers that require authorization
    }],
});
```
