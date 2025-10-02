# js-serve-grip Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

- Update Hono examples for 4.1.0
- Update README for Hono

## [4.1.0] - 2025-10-02

- Allow Hono middleware config param to be typed
- Allow Hono middleware config param to be async

## [4.0.0] - 2025-10-01

- BREAKING: Restructure hono middleware for lazy config
- Add fanoutSelfHandoffMiddleware in fastly export
- Export Variables type

## [3.0.0] - 2025-09-23

- BREAKING: Add "after setup" hook to `ServeGripBase`
- Add Hono support

## [2.0.1] - 2025-01-06

- Release to npmjs using CI workflow

## [2.0.0] - 2024-10-14

- Major update improving simplicity
- Simplified build, now exported as ESM modules only.
- Separated out Node.js support into its own export, `"@fanoutio/serve-grip/node"`.
  - This exports a version of `ServeGrip` that works with Node.js's `IncomingMessage` objects.
  - Added conditional export "node" that makes this available on the main `@fanoutio/serve-grip`
    export as well when the condition `"node"` is present when resolving imports.
- Removed `IGripApiRequest` and `IGripApiResponse` interfaces.
  - Subclasses of `ServeGripBase` are now to work directly with the TRequest and TResponse objects.

## [1.3.1] - 2023-09-14
- Bump dependency versions

## [1.3.0] - 2023-09-04
- Revert to npm instead of pnpm
- Support Fastly Fanout
- Use `getVerifyKey` and `getVerifyIss` to validate `Grip-Sig`
- Allow use of `gripVerifyKey` during configuration
- README updates

## [1.2.0] - 2022-06-06
- Use pnpm
- Add extension points so that other implementations can be created by extending `ServeGripBase` with implementations of `IGripApiRequest` and `IGripApiResponse`.

## [1.1.7] - 2021-01-07
- Added Koa support and examples

## [1.0.0] - 2020-08-24
- Initial Version.  Replaces `@fanoutio/express-grip`.
- Rewritten in TypeScript and exporting types files to enable static type checking and
  IDE completion. 
- CommonJS and ESM builds are standard TypeScript builds, so that they can be imported in
  Node and in modern bundlers that offer features such as tree shaking.
- Source code formatted with Prettier. 

### Added
- Added this Changelog file.
- Adds support for [Next.js](https://nextjs.org/).
- Added a shimmed `Buffer` object to browser build, as it is needed during JWT authorization.
- Added demos that can be run out of the box, for http and ws, for both express and Next.js.
  These are designed to be used with pushpin (https://pushpin.org).

### Changed
- Distributed as `@fanouio/serve-grip` to replace `@fanouio/express-grip`.
- The default export is no longer a single global instance that represents the middleware.
  Instead, this package exports a named ES6 class `ServeGrip` that accepts the options to
  define the instance's behavior.
- Source files moved from `/lib` to `/src`
- Improved README by being more straightforward with the basic use case.

### Removed
- Unlike express-grip, no longer requires the use of pre- and post- middlewares.  A single
  middleware is able to provide the necessary headers and content after routes have run.

[unreleased]: https://github.com/fanout/js-serve-grip/compare/v4.1.0...HEAD
[4.1.0]: https://github.com/fanout/js-serve-grip/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/fanout/js-serve-grip/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/fanout/js-serve-grip/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/fanout/js-serve-grip/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/fanout/js-serve-grip/compare/v1.3.1...v2.0.0
[1.3.1]: https://github.com/fanout/js-serve-grip/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/fanout/js-serve-grip/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fanout/js-serve-grip/compare/v1.1.7...v1.2.0
[1.1.7]: https://github.com/fanout/js-serve-grip/compare/v1.0.0...v1.1.7
[1.0.0]: https://github.com/fanout/js-serve-grip/releases/tag/v1.0.0
