/*! Angular offline v0.1.0 | (c) 2016 Greg Bergé | License MIT */
angular
.module('offline', [])
.service('connectionStatus', ['$window', '$rootScope', function ($window, $rootScope) {

  /**
   * Test if the connection is online.
   *
   * @returns {boolean}
   */

  this.isOnline = function () {
    return $window.navigator.onLine;
  };

  /**
   * Listen online and offline events.
   *
   * @param {string} event
   * @param {function} listener
   */

  this.$on = function (event, listener) {
    $window.addEventListener(event, function () {
      $rootScope.$apply(listener);
    });
  };
}])
.provider('offline', function () {
  var offlineProvider = this;
  var $requester;

  /**
   * Enable or disable debug mode.
   *
   * @param {boolean} value
   * @returns {offlineProvider}
   */

  offlineProvider.debug = function (value) {
    this._debug = value;
    return this;
  };

  /**
   * Enable or disable always refreshing when online
   *
   * @param {boolean} value
   * @returns {offlineProvider}
   */

  offlineProvider.alwaysRefresh = function (value) {
    this._alwaysRefresh = value;
    return this;
  };

  /**
   * Enable or disable always using offline
   *
   * @param {boolean} value
   * @returns {offlineProvider}
   */

  offlineProvider.alwaysOffline = function (value) {
    this._alwaysOffline = value;
    return this;
  };

  /**
   * Provide a blacklist of cache keys to exclude from offline
   *
   * @param {array} cacheList
   * @returns {offlineProvider}
   */

  offlineProvider.excludeCacheIds = function (cacheList) {
    this._excludeCacheIds = cacheList;
    return this;
  };

  this.$get = ['$q', '$rootScope', '$window', '$log', 'connectionStatus', '$cacheFactory',
  function ($q, $rootScope, $window, $log, connectionStatus, $cacheFactory) {
    var offline = {
      ERRORS: {
        EMPTY_STACK: 'empty stack',
        REQUEST_QUEUED: 'request queued'
      }
    };
    var defaultStackCache = $cacheFactory('offline-request-stack');

    /**
     * Log in debug mode.
     *
     * @param {...*} logs
     */

    function log() {
      if (!offlineProvider._debug)
        return;

      return $log.debug.apply($log, ['%cOffline', 'font-weight: bold'].concat([].slice.call(arguments)));
    }

    /**
     * Return cache/default cache
     *
     * @param {object} cache Cache
     * @returns {object} Cache
     */

    function getCache (cache) {
      if (cache === true)
        cache = $requester.defaults.cache || $cacheFactory.get('$http');
      return cache;
    }

    /**
     * Clean cache key
     *
     * @param {object} cache Cache
     * @param {string} key Cache key
     */

    function clean(cache, key) {
      cache = getCache(cache);
      var info = cache.info(key);

      if (offlineProvider._alwaysRefresh || (info && info.isExpired)) {
        cache.remove(key);
      }
    }

    /**
     * Get stack cache.
     *
     * @returns {object} Cache
     */

    function getStackCache() {
      return offline.stackCache || defaultStackCache;
    }

    /**
     * Get stack.
     *
     * @returns {object[]}
     */

    function getStack() {
      var cache = getStackCache();
      return cache.get('stack') || [];
    }

    /**
     * Set stack.
     *
     * @param {[]object} stack
     */

    function saveStack(stack) {
      var cache = getStackCache();
      cache.put('stack', stack);
    }

    /**
     * Push a request to the stack.
     *
     * @param {object} request
     */

    function stackPush(request) {
      var stack = getStack();
      stack.push(request);
      saveStack(stack);
    }

    /**
     * Shift a request from the stack.
     *
     * @returns {object} request
     */

    function stackShift() {
      var stack = getStack();
      var request = stack.shift();
      saveStack(stack);
      return request;
    }

    /**
     * Store request to be played later.
     *
     * @param {object} config Request config
     */

    function storeRequest(config) {
      stackPush({
        url: config.url,
        data: config.data,
        headers: config.headers,
        method: config.method,
        offline: config.offline,
        timeout: angular.isNumber(config.timeout) ? config.timeout : undefined
      });
    }

    /**
     * Process next request from the stack.
     *
     * @returns {Promise|null}
     */

    function processNextRequest() {
      var request = stackShift();

      if (!request)
        return $q.reject(new Error(offline.ERRORS.EMPTY_STACK));

      log('will process request', request);

      return $requester(request)
        .then(function (response) {
          log('request success', response);
          $rootScope.$broadcast('offline-request:success', response, request);
          return response;
        }, function (error) {
          log('request error', error);
          $rootScope.$broadcast('offline-request:error', error, request);
          return $q.reject(error);
        });
    }

    /**
     * Process all the stack.
     *
     * @returns {Promise}
     */

    offline.processStack = function () {
      if (!connectionStatus.isOnline())
        return;

      return processNextRequest()
      .then(offline.processStack)
      .catch(function (error) {
        if (error && error.message === offline.ERRORS.EMPTY_STACK) {
          log('all requests completed');
          return;
        }

        if (error && error.message === offline.ERRORS.REQUEST_QUEUED) {
          log('request has been queued, stop');
          return;
        }

        return offline.processStack();
      });
    };

    /**
     * Run offline using a requester ($http).
     *
     * @param {$http} requester
     */

    offline.start = function (requester) {
      $requester = requester;
      connectionStatus.$on('online', offline.processStack);
      offline.processStack();
    };

    /**
     * Expose interceptors.
     */

    offline.interceptors = {
      request: function (config) {

        // If the request is explicitly marked as not offline, do nothing
        if (config.offline === false) {
          return config;
        }

        if (config.offline !== true) {
          // config is neither true or false, so we need to check if always offline is set
          if (!offlineProvider._alwaysOffline) {
            // neither config or always offline indicate we should offline this
            //  request, so we do nothing
            return config;
          }
        }

        log('intercept request', config);

        // Automatically set cache to true.
        if (!config.cache)
          config.cache = true;

        var cache = getCache(config.cache);
        var cacheInfo = cache.info();
        var cacheKey = cacheInfo.id;
        if (cacheKey && offlineProvider._excludeCacheIds) {
          if (offlineProvider._excludeCacheIds.indexOf(cacheKey) !== -1) {
            // the cache is in the exclude list, so do nothing
            return config;
          }
        }

        // For GET method, Angular will handle it.
        if (config.method === 'GET') {
          // Online we clean the cache.
          if (connectionStatus.isOnline()) {
            clean(config.cache, config.url);
          }

          return config;
        }

        // For other methods in offline mode, we will put them in wait.
        if (!connectionStatus.isOnline()) {
          storeRequest(config);
          return $q.reject(new Error(offline.ERRORS.REQUEST_QUEUED));
        }

        return config;
      }
    };

    return offline;
  }];
})
.config(['$provide', '$httpProvider', function ($provide, $httpProvider) {
  $provide.factory('offlineInterceptor', ['offline', function (offline) {
    return offline.interceptors;
  }]);

  $httpProvider.interceptors.push('offlineInterceptor');
}]);
