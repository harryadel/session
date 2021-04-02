
Package.onUse(function (api) {
  'reactive-dict', 'ejson'

  // Session can work with or without reload, but if reload is present
  // it should load first so we can detect it at startup and populate
  // the session.
  api.use('reload', 'client', {weak: true});

  api.export('Session', 'client');
  api.mainModule('session.js', 'client');
});

Package.onTest(function (api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('session', 'client');
  api.use('tracker');
  api.use('mongo');
  api.addFiles('session_tests.js', 'client');
});