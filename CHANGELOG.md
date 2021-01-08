# js-serve-grip Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
