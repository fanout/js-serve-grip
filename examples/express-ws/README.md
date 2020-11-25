# express-ws

Example for using serve-grip with WebSockets-over-HTTP in Express.

1. To run the example, first build `serve-grip` by typing the following _in the root directory_
of this repository.
```
npm install
npm run build
```

2. Also, you will need to obtain and install Pushpin (https://pushpin.org/). Make sure that the
Pushpin `routes` file looks like this:
```
* localhost:3000,over_http
```

3. You will also need to obtain `wscat` to test WebSockets connections.
```
npm install -g wscat
```

4. Next, switch to this example's directory and then type
```
npm install
```

This will install the dependencies for this project, including `serve-grip` and Express.

5. Start the example application.
```
npm run dev
```

6. In another Terminal window, start Pushpin.
```
pushpin
```

7. In yet another Terminal window, issue a WebSocket request.
```
wscat --connect ws://localhost:7999/api/websocket
```

You should see a prompt where you may enter a message.  This application acts as an
echo server, and any text you enter will be repeated back to you.

8. Finally, in another Terminal window, post a message.
```
curl -i -H 'Content-Type: text/plain' -d 'foo' http://localhost:7999/api/broadcast
```

9. In the Terminal window from step 7, you will see the message appear. 
