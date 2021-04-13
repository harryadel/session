import { Tracker } from 'standalone-tracker';
import { Session } from '../src/session';

test('session - setDefault', () => {
  Session.setDefault('def', 'argyle');
  expect(Session.get('def')).toEqual('argyle');
  Session.set('def', 'noodle');
  expect(Session.get('def')).toEqual('noodle');
  Session.set('nondef', 'potato');
  expect(Session.get('nondef')).toEqual('potato');
  Session.setDefault('nondef', 'eggs');
  expect(Session.get('nondef')).toEqual('potato');
  // This is so the test passes the next time, after hot code push.  I know it
  // doesn't return it to the completely untouched state, but we don't have
  // Session.clear() yet.  When we do, this should be that.
  delete Session.keys.def;
  delete Session.keys.nondef;
});

test('session - get/set/equals types', () => {
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
  expect(Session.equals('u', 'null')).toBeFalsy();

  Session.set('n', null);
  expect(Session.get('n')).toEqual(null);
  expect(Session.equals('n', undefined)).toBeFalsy();
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

  Session.set('arr', [1, 2, { a: 1, b: [5, 6] }]);
  test.equal(Session.get('arr'), [1, 2, { b: [5, 6], a: 1 }]);
  test.isFalse(Session.equals('arr', 1));
  test.isFalse(Session.equals('arr', '[1,2,{"a":1,"b":[5,6]}]'));
  test.throws(() => {
    Session.equals('arr', [1, 2, { a: 1, b: [5, 6] }]);
  });

  Session.set('obj', { a: 1, b: [5, 6] });
  test.equal(Session.get('obj'), { b: [5, 6], a: 1 });
  test.isFalse(Session.equals('obj', 1));
  test.isFalse(Session.equals('obj', '{"a":1,"b":[5,6]}'));
  test.throws(() => { Session.equals('obj', { a: 1, b: [5, 6] }); });

  Session.set('date', new Date(1234));
  test.equal(Session.get('date'), new Date(1234));
  test.isFalse(Session.equals('date', new Date(3455)));
  test.isTrue(Session.equals('date', new Date(1234)));

  Session.set('oid', new Mongo.ObjectID('ffffffffffffffffffffffff'));
  test.equal(Session.get('oid'), new Mongo.ObjectID('ffffffffffffffffffffffff'));
  test.isFalse(Session.equals('oid', new Mongo.ObjectID('fffffffffffffffffffffffa')));
  test.isTrue(Session.equals('oid', new Mongo.ObjectID('ffffffffffffffffffffffff')));
});

test('session - objects are cloned', () => {
  Session.set('frozen-array', [1, 2, 3]);
  Session.get('frozen-array')[1] = 42;
  test.equal(Session.get('frozen-array'), [1, 2, 3]);

  Session.set('frozen-object', { a: 1, b: 2 });
  Session.get('frozen-object').a = 43;
  expect(Session.get('frozen-object')).toEqual({ a: 1, b: 2 });
});

test('session - context invalidation for get', () => {
  let xGetExecutions = 0;
  Tracker.autorun(() => {
    ++xGetExecutions;
    Session.get('x');
  });
  expect(xGetExecutions).toEqual(1);
  Session.set('x', 1);
  // Invalidation shouldn't happen until flush time.
  expect(xGetExecutions).toEqual(1);
  Tracker.flush();
  expect(xGetExecutions).toEqual(2);
  // Setting to the same value doesn't re-run.
  Session.set('x', 1);
  Tracker.flush();
  expect(xGetExecutions).toEqual(2);
  Session.set('x', '1');
  Tracker.flush();
  expect(xGetExecutions).toEqual(3);
});

test('session - context invalidation for equals', () => {
  let xEqualsExecutions = 0;
  Tracker.autorun(() => {
    ++xEqualsExecutions;
    Session.equals('x', 5);
  });
  expect(xEqualsExecutions).toEqual(1);
  Session.set('x', 1);
  Tracker.flush();
  // Changing undefined -> 1 shouldn't affect equals(5).
  expect(xEqualsExecutions).toEqual(1);
  Session.set('x', 5);
  // Invalidation shouldn't happen until flush time.
  expect(xEqualsExecutions).toEqual(1);
  Tracker.flush();
  expect(xEqualsExecutions).toEqual(2);
  Session.set('x', 5);
  Tracker.flush();
  // Setting to the same value doesn't re-run.
  expect(xEqualsExecutions).toEqual(2);
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
  () => {
    // Make sure the special casing for equals undefined works.
    let yEqualsExecutions = 0;
    Tracker.autorun(() => {
      ++yEqualsExecutions;
      Session.equals('y', undefined);
    });
    expect(yEqualsExecutions).toEqual(1);
    Session.set('y', undefined);
    Tracker.flush();
    expect(yEqualsExecutions.toEqual(, 1);
    Session.set('y', 5);
    expect(yEqualsExecutions).toEqual(1);
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(2);
    Session.set('y', 3);
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(2);
    Session.set('y', 'undefined');
    Tracker.flush();
    expect(yEqualsExecution).toEqual(2);
    Session.set('y', undefined);
    expect(yEqualsExecutions).toEqual(2);
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(3);
  }
);

test('session - parse an object of key/value pairs', () => {
  Session._setObject({ fruit: 'apple', vegetable: 'potato' });

  expect(Session.get('fruit')).toEqual('apple');
  expect(Session.get('vegetable')).toEqual('potato');

  delete Session.keys.fruit;
  delete Session.keys.vegetable;
});
