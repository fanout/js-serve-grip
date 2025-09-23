# hono-compute-http

Example for using serve-grip with HTTP formats in Hono running on Fastly Compute.

> [!NOTE]
> When using Fastly Compute, it is possible to use the single application both to issue GRIP
> instructions and to invoke the GRIP proxy, by specifying the application itself as the _backend_.
> This example is configured to illustrate this setup with
> [Fastly Fanout local testing](https://www.fastly.com/documentation/guides/concepts/real-time-messaging/fanout/#run-the-service-locally).
> When deploying this project to your Fastly account, you will need to enable Fastly Fanout on
> your service, as well as set up the backend on your service to point to itself.
> See [deploy to a Fastly Service](https://www.fastly.com/documentation/guides/concepts/real-time-messaging/fanout/#deploy-to-a-fastly-service)
> in the Fastly documentation for details.

1. To run the example, first build `serve-grip` by typing the following _in the root directory_
of this repository.
   ```
   npm install
   npm run build
   ```

2. Obtain and install Pushpin (https://pushpin.org/), and make sure that
  `pushpin` is available on the system path.

3. Next, switch to this example's directory and then type
   ```
   npm install
   ```

   This will install the dependencies for this project, including `serve-grip`, Hono, and the Fastly CLI.

4. Start the example application.
   ```
   npm run dev
   ```

   This will start your application as well as an instance of Pushpin in the background.

   **NOTE:** Unlike some of the other examples, the Fastly Compute example runs on port 7676.

5. In another Terminal window, issue an HTTP request.
   ```
   curl -i http://localhost:7676/api/stream
   ```

   **NOTE:** Fanout local testing makes the realtime endpoint available on port 7676, the same port as the backend application.

6. Finally, in another Terminal window, post a message.
   ```
   curl -i -d 'foo' http://localhost:7676/api/publish
   ```

7. In the Terminal window from step 5, you will see the message appear. 
