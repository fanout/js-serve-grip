# @fanoutio/serve-grip Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Planned for 1.0.0]

### To be Added
- Add demos that can be run out of the box, for http and ws, for both express and Next.js.
  These are designed to be used with pushpin (https://pushpin.org).

## [0.1.0-beta.1] - 2020-08-06
Initial Version.  Replaces `@fanoutio/express-grip`.

### Added
- Added this Changelog file.
- Adds support for [Next.js](https://nextjs.org/).
- Added a shimmed `Buffer` object to browser build, as it is needed during JWT authorization.

### Changed
- Distributed as `@fanouio/connect-grip` to replace `@fanouio/express-grip`.
- Uses Rollup (https://rollupjs.org/) to build bundles for consumption as CommonJS and in
  the Browser.
- Rewritten in TypeScript for IDE completion and static type checking, and provides types
  for consumption in other TypeScript projects.
- The default export is no longer a single global instance that represents the middleware.
  Instead, this package exports a named ES6 class `ConnectGrip` that accepts the options to
  define the instance's behavior.
- Source files moved from `/lib` to `/src`
- Improved README by being more straightforward with the basic use case.

### Removed
- Unlike express-grip, no longer requires the use of pre- and post- middlewares.  A single
  middleware is able to provide the necessary headers and content after routes have run.
