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
  expect(Session.equals('n', null)).toBeTruthy();
  expect(Session.equals('n', 0)).toBeFlasy();
  expect(Session.equals('n', '')).toBeFalsy();
  expect(Session.equals('n', 'undefined')).toBeFlasy();
  expect(Session.equals('n', 'null')).toBeFlasy();

  Session.set('t', true);
  expect(Session.get('t')).toEqual(true);
  expect(Session.equals('t', true)).toBeTruthy();
  expect(Session.equals('t', false)).toBeFalsy();
  expect(Session.equals('t', 1)).toBeFalsy();
  expect(Session.equals('t', 'true')).toBeFalsy();

  Session.set('f', false);
  expect(Session.get('f')).toEqual(false);
  expect(Session.equals('f', true)).toBeFlasy();
  expect(Session.equals('f', false)).toBeTruthy();
  expect(Session.equals('f', 1)).toBeFlasy();
  expect(Session.equals('f', 'false')).toBeFlasy();

  Session.set('num', 0);
  expect.toEqual(Session.get('num'), 0);
  expect.toBeTruthy(Session.equals('num', 0));
  expect.toBeFlasy(Session.equals('num', false));
  expect.toBeFlasy(Session.equals('num', '0'));
  expect.toBeFlasy(Session.equals('num', 1));

  Session.set('str', 'true');
  expect(Session.get('str')).toEqual();
  expect(Session.equals('str', 'true')).toBeTruthy();
  expect(Session.equals('str', true)).toBeFlasy();

  Session.set('arr', [1, 2, { a: 1, b: [5, 6] }]);
  expect(Session.get('arr')).toEqual([1, 2, { b: [5, 6], a: 1 }]);
  expect(Session.equals('arr', 1)).toBeFlasy();
  expect(Session.equals('arr', '[1,2,{"a":1,"b":[5,6]}]')).toBeFlasy();
  expect.throws(() => {
    Session.equals('arr', [1, 2, { a: 1, b: [5, 6] }]);
  });

  Session.set('obj', { a: 1, b: [5, 6] });
  expect(Session.get('obj')).toEqual({ b: [5, 6], a: 1 });
  expect(Session.equals('obj', 1)).isFalse();
  expect(Session.equals('obj', '{"a":1,"b":[5,6]}')).isFalse();
  expect.throws(() => { Session.equals('obj', { a: 1, b: [5, 6] }); });

  Session.set('date', new Date(1234));
  expect.equal(Session.get('date'), new Date(1234));
  expect.isFalse(Session.equals('date', new Date(3455)));
  expect.isTrue(Session.equals('date', new Date(1234)));

  Session.set('oid', new Mongo.ObjectID('ffffffffffffffffffffffff'));
  expect(Session.get('oid')).toEqual(new Mongo.ObjectID('ffffffffffffffffffffffff'));
  expect(Session.equals('oid', new Mongo.ObjectID('fffffffffffffffffffffffa'))).isFalse();
  expect(Session.equals('oid', new Mongo.ObjectID('ffffffffffffffffffffffff'))).toBeTruthy();
});

test('session - objects are cloned', () => {
  Session.set('frozen-array', [1, 2, 3]);
  Session.get('frozen-array')[1] = 42;
  expect.equal(Session.get('frozen-array'), [1, 2, 3]);

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
  expect(xEqualsExecutions).toEqual(2);
  Tracker.flush();
  expect(xEqualsExecutions).toEqual(3);
  Session.set('x', 5);
  expect(xEqualsExecutions).toEqual(3);
  Tracker.flush();
  expect(xEqualsExecutions).toEqual(4);
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
    expect(yEqualsExecutions).toEqual(1);
    Session.set('y', 5);
    expect(yEqualsExecutions).toEqual(1);
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(2);
    Session.set('y', 3);
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(2);
    Session.set('y', 'undefined');
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(2);
    Session.set('y', undefined);
    expect(yEqualsExecutions).toEqual(2);
    Tracker.flush();
    expect(yEqualsExecutions).toEqual(3);
  },
);

test('session - parse an object of key/value pairs', () => {
  Session._setObject({ fruit: 'apple', vegetable: 'potato' });

  expect(Session.get('fruit')).toEqual('apple');
  expect(Session.get('vegetable')).toEqual('potato');

  delete Session.keys.fruit;
  delete Session.keys.vegetable;
});
