# hono-http

Example for using serve-grip with HTTP formats in Hono running on Node.js.

1. To run the example, first build `serve-grip` by typing the following _in the root directory_
of this repository.
```
npm install
npm run build
```

2. Also, you will need to obtain and install Pushpin (https://pushpin.org/). Make sure that the
Pushpin `routes` file looks like this:
```
* localhost:3000
```

3. Next, switch to this example's directory and then type
```
npm install
```

This will install the dependencies for this project, including `serve-grip` and Hono.

4. Start the example application.
```
npm run dev
```

5. In another Terminal window, start Pushpin.
```
pushpin
```

6. In yet another Terminal window, issue an HTTP request.
```
curl -i http://localhost:7999/api/stream
```

7. Finally, in another Terminal window, post a message.
```
curl -i -H 'Content-Type: text/plain' -d 'foo' http://localhost:7999/api/publish
```

8. In the Terminal window from step 6, you will see the message appear. 
