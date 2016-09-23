# angular-offline

# This plugin is no longer actively maintained, you can still use it but issues will not be resolved. If you want the npm name, you can contact me by email.

[![Build Status](https://travis-ci.org/incuna/angular-offline.svg?branch=master)](https://travis-ci.org/incuna/angular-offline)
[![Dependency Status](https://david-dm.org/incuna/angular-offline.svg?theme=shields.io)](https://david-dm.org/incuna/angular-offline)
[![devDependency Status](https://david-dm.org/incuna/angular-offline/dev-status.svg?theme=shields.io)](https://david-dm.org/incuna/angular-offline#info=devDependencies)

Offline support for AngularJS applications.

## Install

### Using npm

```
npm install angular-offline
```

### Using bower

```
bower install angular-offline
```

## Usage

```js
module.run(function (offline, $http) {
  offline.start($http);

  $http.get('/test.json', {offline: true})
  .then(...);
});
```

### $http

Puting the offline flag to true in $http config will have for effect to activate the angular cache for this request and to add offline behaviour to the request.

### offlineProvider.debug(value)

Start or stop debug mode. It adds a lot of additional logs to understand how offline works.

```js
module.config(function (offlineProvider) {
  offlineProvider.debug(true);
});
```

### offlineProvider.alwaysRefresh(value)

Enable or disable always refreshing. When this is `true`, the cache is always refreshed for GET request when online. This enables you to set a very long cache `maxAge`, but still always update the cache when online. Without this, long cache lifetime requests will always be served from the cache, even when online.

```js
module.config(function (offlineProvider) {
  offlineProvider.alwaysRefresh(true);
});
```

### offlineProvider.alwaysOnline(value)

Enable or disable applying offline functionality to all requests. When this is false, requests will only be offlined by explicitly adding the `offline: false` property to the request config. If you want to enable offline functionality for the majority or all of the requests in the application, adding the offline flag to every request is not ideal. Setting `alwaysOnline` to `true`, means that offline functionality will be applied to every request, except those that explicitly set `offline: false` in their individual request configurations, or caches that are excluded (see excludeCacheIds).

```js
module.config(function (offlineProvider) {
  offlineProvider.alwaysOnline(true);
});
```


### offlineProvider.excludeCacheIds(array)

Allows you to provide a list of cache ids which are to be excluded from offline functionality. This is most often helpful in conjunction with the `alwaysOnline` setting. You can set `alwaysOnline(true);` and then exclude requests using specific caches you do not want to apply offline functionality to. The setting takes an array of string cache ids to exclude.

```js
module.config(function (offlineProvider) {
  offlineProvider.excludeCacheIds([
    'templates'
  ]);
});
```

### offline.start(requester)

Start offline with the requester ($http). Usually you will call this method in `.run` of your application.

```js
module.run(function (offline, $http) {
  offline.start($http);
});
```

### offline.stackCache

Specify a cache to use to stack requests (POST, PUT, DELETE...).

```js
module.run(function (offline, $cacheFactory) {
  offline.stackCache = $cacheFactory('custom-cache');
});
```

### connectionStatus.isOnline()

Test if the navigator is online.

```js
module.run(function (connectionStatus, $log) {
  if (connectionStatus.isOnline())
    $log.info('We have internet!');
});
```

### connectionStatus.$on(event, listener)

Listen "online" and "offline" events to get notified when the navigator become "online" or "offline". A `$rootScope.$apply` is automatically done.

```js
module.run(function (connectionStatus) {
  connectionStatus.$on('online', function () {
    $log.info('We are now online');
  });

  connectionStatus.$on('offline', function () {
    $log.info('We are now offline');
  });
});
```

## Use with angular-cache

If you want to build an application completely offline, you will need a cache that can be stored in the localStorage. To do that, the recommended method is to use [angular-cache](https://github.com/jmdobry/angular-cache).

### Specify a TTL for a GET request

You must use maxAge to specify your TTL.
If you specify deleteOnExpire to "none", the cache will be served even if your TTL is exceeded.

```js
module.run(function ($http, CacheFactory) {
  $http.get('/test.json', {
    offline: true,
    cache: CacheFactory.createCache('bookCache', {
      deleteOnExpire: 'none',
      maxAge: 60000,
      storageMode: 'localStorage'
    })
  });
});
```

### Specify a default cache for all GET requests

To get more details about this, you can read [the official documentation](https://docs.angularjs.org/api/ng/service/$http#caching).

```js
module.run(function ($http, CacheFactory) {
  $http.defaults.cache = CacheFactory.createCache('bookCache', {
      deleteOnExpire: 'none',
      maxAge: 60000,
      storageMode: 'localStorage'
    })
  });
});
```

### Use a persistent storage for POST request

You can specify the storageMode to "localStorage" to have a persistent storage for the stack.

```js
module.run(function ($http, CacheFactory) {
  offline.stackCache = CacheFactory.createCache('offlineStack', {
    storageMode: 'localStorage'
  });
});
```

## Play with example

To play with the example, you can start it using the command `npm run example`, then opening the console and try.

## Workflow

```
- Request GET
  -> interceptor.request
    -> has offline flag and is online
      -> clean cache
- Other requests
  -> interceptor.request
    -> has offline flag and is offline
      -> push request in stack
      -> reject

- "online" event
  -> process stack
```

## Browser support

This library require the [online status feature](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine) activated, you can refer to [caniuse](http://caniuse.com/#feat=online-status) to see exactly what browsers are supported.

## License

MIT
