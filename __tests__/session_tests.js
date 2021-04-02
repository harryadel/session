import { Session } from '../src/session';

test('session - setDefault', function () {
  Session.setDefault('def', "argyle");
  expect(Session.get('def')).toEqual("argyle");
  Session.set('def', "noodle");
  expect(Session.get('def')).toEqual("noodle");
  Session.set('nondef', "potato");
  expect(Session.get('nondef')).toEqual("potato");
  Session.setDefault('nondef', "eggs");
  expect(Session.get('nondef')).toEqual("potato");
  // This is so the test passes the next time, after hot code push.  I know it
  // doesn't return it to the completely untouched state, but we don't have
  // Session.clear() yet.  When we do, this should be that.
  delete Session.keys['def'];
  delete Session.keys['nondef'];
});

test('session - get/set/equals types', function () {
  expect(Session.get('u')).toEqual(undefined);
  expect(Session.equals('u', undefined)).toEqual(true);
  expect(Session.equals('u', null)).toEqual(false);
  expect(Session.equals('u', 0)).toEqual(false);
  expect(Session.equals('u', '')).toEqual(false);

  Session.set('u', undefined);
  expect(Session.get('u')).toEqual(undefined);
  expect(Session.equals('u', undefined)).toEqual(true);
  expect(Session.equals('u', null)).toEqual(false);
  expect(Session.equals('u', 0)).toEqual(false);
  expect(Session.equals('u', '')).toEqual(false);
  expect(Session.equals('u', 'undefined')).toEqual(false);
  test.isFalse(Session.equals('u', 'null'));

  Session.set('n', null);
  test.equal(Session.get('n'), null);
  test.isFalse(Session.equals('n', undefined));
  test.isTrue(Session.equals('n', null));
  test.isFalse(Session.equals('n', 0));
  test.isFalse(Session.equals('n', ''));
  test.isFalse(Session.equals('n', 'undefined'));
  test.isFalse(Session.equals('n', 'null'));

  Session.set('t', true);
  test.equal(Session.get('t'), true);
  test.isTrue(Session.equals('t', true));
  test.isFalse(Session.equals('t', false));
  test.isFalse(Session.equals('t', 1));
  test.isFalse(Session.equals('t', 'true'));

  Session.set('f', false);
  test.equal(Session.get('f'), false);
  test.isFalse(Session.equals('f', true));
  test.isTrue(Session.equals('f', false));
  test.isFalse(Session.equals('f', 1));
  test.isFalse(Session.equals('f', 'false'));

  Session.set('num', 0);
  test.equal(Session.get('num'), 0);
  test.isTrue(Session.equals('num', 0));
  test.isFalse(Session.equals('num', false));
  test.isFalse(Session.equals('num', '0'));
  test.isFalse(Session.equals('num', 1));

  Session.set('str', 'true');
  test.equal(Session.get('str'), 'true');
  test.isTrue(Session.equals('str', 'true'));
  test.isFalse(Session.equals('str', true));

  Session.set('arr', [1, 2, {a: 1, b: [5, 6]}]);
  test.equal(Session.get('arr'), [1, 2, {b: [5, 6], a: 1}]);
  test.isFalse(Session.equals('arr', 1));
  test.isFalse(Session.equals('arr', '[1,2,{"a":1,"b":[5,6]}]'));
  test.throws(function () {
    Session.equals('arr', [1, 2, {a: 1, b: [5, 6]}]);
  });

  Session.set('obj', {a: 1, b: [5, 6]});
  test.equal(Session.get('obj'), {b: [5, 6], a: 1});
  test.isFalse(Session.equals('obj', 1));
  test.isFalse(Session.equals('obj', '{"a":1,"b":[5,6]}'));
  test.throws(function() { Session.equals('obj', {a: 1, b: [5, 6]}); });


  Session.set('date', new Date(1234));
  test.equal(Session.get('date'), new Date(1234));
  test.isFalse(Session.equals('date', new Date(3455)));
  test.isTrue(Session.equals('date', new Date(1234)));

  Session.set('oid', new Mongo.ObjectID('ffffffffffffffffffffffff'));
  test.equal(Session.get('oid'),  new Mongo.ObjectID('ffffffffffffffffffffffff'));
  test.isFalse(Session.equals('oid',  new Mongo.ObjectID('fffffffffffffffffffffffa')));
  test.isTrue(Session.equals('oid', new Mongo.ObjectID('ffffffffffffffffffffffff')));
});

test('session - objects are cloned', function () {
  Session.set('frozen-array', [1, 2, 3]);
  Session.get('frozen-array')[1] = 42;
  test.equal(Session.get('frozen-array'), [1, 2, 3]);

  Session.set('frozen-object', {a: 1, b: 2});
  Session.get('frozen-object').a = 43;
  test.equal(Session.get('frozen-object'), {a: 1, b: 2});
});

test('session - context invalidation for get', function () {
  var xGetExecutions = 0;
  Tracker.autorun(function () {
    ++xGetExecutions;
    Session.get('x');
  });
  test.equal(xGetExecutions, 1);
  Session.set('x', 1);
  // Invalidation shouldn't happen until flush time.
  test.equal(xGetExecutions, 1);
  Tracker.flush();
  test.equal(xGetExecutions, 2);
  // Setting to the same value doesn't re-run.
  Session.set('x', 1);
  Tracker.flush();
  test.equal(xGetExecutions, 2);
  Session.set('x', '1');
  Tracker.flush();
  test.equal(xGetExecutions, 3);
});

test('session - context invalidation for equals', function () {
  var xEqualsExecutions = 0;
  Tracker.autorun(function () {
    ++xEqualsExecutions;
    Session.equals('x', 5);
  });
  test.equal(xEqualsExecutions, 1);
  Session.set('x', 1);
  Tracker.flush();
  // Changing undefined -> 1 shouldn't affect equals(5).
  test.equal(xEqualsExecutions, 1);
  Session.set('x', 5);
  // Invalidation shouldn't happen until flush time.
  test.equal(xEqualsExecutions, 1);
  Tracker.flush();
  test.equal(xEqualsExecutions, 2);
  Session.set('x', 5);
  Tracker.flush();
  // Setting to the same value doesn't re-run.
  test.equal(xEqualsExecutions, 2);
  Session.set('x', '5');
  test.equal(xEqualsExecutions, 2);
  Tracker.flush();
  test.equal(xEqualsExecutions, 3);
  Session.set('x', 5);
  test.equal(xEqualsExecutions, 3);
  Tracker.flush();
  test.equal(xEqualsExecutions, 4);
});

test(
  'session - context invalidation for equals with undefined',
  function () {
    // Make sure the special casing for equals undefined works.
    var yEqualsExecutions = 0;
    Tracker.autorun(function () {
      ++yEqualsExecutions;
      Session.equals('y', undefined);
    });
    test.equal(yEqualsExecutions, 1);
    Session.set('y', undefined);
    Tracker.flush();
    test.equal(yEqualsExecutions, 1);
    Session.set('y', 5);
    test.equal(yEqualsExecutions, 1);
    Tracker.flush();
    test.equal(yEqualsExecutions, 2);
    Session.set('y', 3);
    Tracker.flush();
    test.equal(yEqualsExecutions, 2);
    Session.set('y', 'undefined');
    Tracker.flush();
    test.equal(yEqualsExecutions, 2);
    Session.set('y', undefined);
    test.equal(yEqualsExecutions, 2);
    Tracker.flush();
    test.equal(yEqualsExecutions, 3);
  });

test('session - parse an object of key/value pairs', function () {
  Session._setObject({fruit: 'apple', vegetable: 'potato'});

  expect(Session.get('fruit')).toEqual('apple');
  expect(Session.get('vegetable')).toEqual('potato');

  delete Session.keys['fruit'];
  delete Session.keys['vegetable'];
});
