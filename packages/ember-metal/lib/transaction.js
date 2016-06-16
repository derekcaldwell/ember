import { meta as metaFor } from './meta';
import { has } from 'require';
import { deprecate } from 'ember-metal/debug';
import isEnabled from 'ember-metal/features';

let runInTransaction, didRender, assertNotRendered;

if (isEnabled('ember-glimmer-allow-two-way-reflush')) {
  let hasGlimmer = has('glimmer-reference');
  let counter = 0;
  let inTransaction = false;
  let shouldReflush;

  if (hasGlimmer) {
    runInTransaction = function(callback) {
      shouldReflush = false;
      inTransaction = true;
      callback();
      inTransaction = false;
      counter++;
      return shouldReflush;
    };

    didRender = function(object, key, _meta) {
      if (!inTransaction) { return; }

      let meta = _meta || metaFor(object);
      let lastRendered = meta.writableLastRendered();
      lastRendered[key] = counter;
    };

    assertNotRendered = function(object, key, _meta) {
      let meta = _meta || metaFor(object);
      let lastRendered = meta.readableLastRendered();

      if (lastRendered && lastRendered[key] === counter) {
        deprecate(
          `You modified wrapper.${key} twice in a single render. This was unreliable in Ember 1.x and will be removed in Ember 3.0`,
          false,
          { id: 'ember-views.render-double-modify', until: '3.0.0' }
        );

        shouldReflush = true;
      }
    };
  } else {
    runInTransaction = function() {
      throw new Error('Cannot call runInTransaction without Glimmer');
    };

    didRender = function() {
      throw new Error('Cannot call didRender without Glimmer');
    };

    assertNotRendered = function() {
      throw new Error('Cannot call assertNotRendered without Glimmer');
    };
  }
}

export { runInTransaction as default, didRender, assertNotRendered };
