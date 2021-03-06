var expect = chai.expect;

describe('Angular offline', function () {
  var $http, $rootScope, $httpBackend, $cacheFactory, offline, startOffline, connectionStatus;

  beforeEach(module('offline', function (offlineProvider, $provide) {
    this.offlineProvider = offlineProvider;
    this.offlineProvider.debug(true);
    $provide.value('connectionStatus', {
      isOnline: function () {
        return this.online;
      },
      $on: function () {}
    });
  }));

  beforeEach(inject(function ($injector) {
    $http = $injector.get('$http');
    $rootScope = $injector.get('$rootScope');
    $cacheFactory = $injector.get('$cacheFactory');
    $httpBackend = $injector.get('$httpBackend');
    offline = $injector.get('offline');
    connectionStatus = $injector.get('connectionStatus');
    $httpBackend.whenGET('/test').respond(200);
    $httpBackend.whenPOST('/test').respond(201);

    startOffline = function () {
      offline.start($http);
    };

    this.mockCache = {
      get: function (key) {
        return this[key];
      },
      info: function () {
        return {
          id: 'test'
        };
      },
      put: function (key, value) {
      },
      remove: function (key) {
      }
    }
  }));

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  describe('GET request', function () {
    describe('with offline config', function () {
      it('should not cache request when no offline flag', function () {
        startOffline();

        $http.get('/test');

        $http.get('/test');

        // We expect two request to be flushed, as there should be no caching
        $httpBackend.flush(2);
      });

      it('should not cache request when offline flag is false', function () {
        startOffline();

        $http.get('/test', {
          offline: false
        });

        $http.get('/test', {
          offline: false
        });

        // We expect two request to be flushed, as there should be no caching
        $httpBackend.flush(2);
      });

      it('should cache request when using offline flag', function () {
        startOffline();

        $http.get('/test', {
          offline: true
        });

        $http.get('/test', {
          offline: true
        });

        // We flush only one request, if cache didn't work
        // we had to flush two.
        $httpBackend.flush(1);
      });

      it('should cache request when using alwaysOffline setting and no offline flag', function () {
        offlineProvider.alwaysOffline(true);
        startOffline();

        $http.get('/test');

        $http.get('/test');

        // We flush only one request, if cache didn't work
        // we had to flush two.
        $httpBackend.flush(1);
      });

      it('should cache request when using alwaysOffline setting and explicit offline true', function () {
        offlineProvider.alwaysOffline(true);
        startOffline();

        $http.get('/test', {
          offline: true
        });

        $http.get('/test', {
          offline: true
        });

        // We expect two request to be flushed, as there should be no caching
        $httpBackend.flush(1);
      });

      it('should not cache request when using alwaysOffline setting and explicit offline false', function () {
        offlineProvider.alwaysOffline(true);
        startOffline();

        $http.get('/test', {
          offline: false
        });

        $http.get('/test', {
          offline: false
        });

        // We expect two request to be flushed, as there should be no caching
        $httpBackend.flush(2);
      });

    });

    describe('with excludeCacheIDs', function () {

      it('should not cache request when using alwaysOffline setting and excluding specific cache id', function () {
        offlineProvider.alwaysOffline(true);
        offlineProvider.excludeCacheIds([
          'test'
        ]);
        startOffline();

        $http.get('/test', {
          cache: this.mockCache
        });

        $http.get('/test', {
          cache: this.mockCache
        });

        // We expect two request to be flushed, as there should be no caching
        $httpBackend.flush(2);
      });

      it('should not cache request when using using offline flag and excluding specific cache id', function () {
        offlineProvider.excludeCacheIds([
          'test'
        ]);
        startOffline();

        $http.get('/test', {
          offline: true,
          cache: this.mockCache
        });

        $http.get('/test', {
          offline: true,
          cache: this.mockCache
        });

        // We expect two request to be flushed, as there should be no caching
        $httpBackend.flush(2);
      });

    });

    describe('online', function () {
      beforeEach(function () {
        connectionStatus.online = true;
      });

      it('should clean the expired cache if we are online', function (done) {
        startOffline();

        $http.get('/test', {
          offline: true,
          cache: {
            get: function (key) {
              return this[key];
            },
            info: function () {
              return {isExpired: true};
            },
            put: function (key, value) {
              this[key] = value;
            },
            remove: function (key) {
              expect(key).to.equal('/test');
              done();
            }
          }
        });

        $httpBackend.flush(1);
      });

      it('should not clean unexpired caches if we are online', function (done) {
        startOffline();

        var hasRemoved = false;

        $http.get('/test', {
          offline: true,
          cache: {
            get: function (key) {
              return this[key];
            },
            info: function () {
              return {isExpired: false};
            },
            put: function (key, value) {
              this[key] = value;
            },
            remove: function (key) {
              hasRemoved = true;
            }
          }
        });

        $httpBackend.flush(1);
        expect(hasRemoved).to.equal(false);
        done();
      });

      it('should clean all caches if we are online and using alwaysRefresh setting', function (done) {
        offlineProvider.alwaysRefresh(true);
        startOffline();

        $http.get('/test', {
          offline: true,
          cache: {
            get: function (key) {
              return this[key];
            },
            info: function () {
              return {isExpired: false};
            },
            put: function (key, value) {
              this[key] = value;
            },
            remove: function (key) {
              expect(key).to.equal('/test');
              done();
            }
          }
        });

        $httpBackend.flush(1);
      });

    });
  });

  describe('POST request offline', function () {
    beforeEach(function () {
      connectionStatus.offline = true;
      $cacheFactory.get('offline-request-stack').remove('stack');
    });

    it('should stack request and return an error', function (done) {
      startOffline();

      $http.post('/test', {}, {
        offline: true
      })
      .catch(function (err) {
        expect(err.message).to.equal('request queued');
        var stack = $cacheFactory.get('offline-request-stack').get('stack');
        expect(stack).to.length(1);
        done();
      });

      $rootScope.$digest();
    });

    it('should process requests', function () {
      startOffline();

      $http.post('/test', {}, {
        offline: true
      });

      $http.post('/test', {}, {
        offline: true
      });

      $rootScope.$digest();

      connectionStatus.online = true;
      offline.processStack();

      // First request.
      $httpBackend.flush(1);

      // Second request.
      $httpBackend.flush(1);
    });
  });
});
