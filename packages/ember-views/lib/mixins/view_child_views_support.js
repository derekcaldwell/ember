/**
@module ember
@submodule ember-views
*/
import { assert } from 'ember-metal/debug';
import { Mixin } from 'ember-metal/mixin';
import { get } from 'ember-metal/property_get';
import { set } from 'ember-metal/property_set';
import setProperties from 'ember-metal/set_properties';
import { A as emberA } from 'ember-runtime/system/native_array';
import { getOwner, setOwner, OWNER } from 'container/owner';

var EMPTY_ARRAY = [];

export function removeChildView(parentView, childView) {
  // If we're destroying, the entire subtree will be
  // freed, and the DOM will be handled separately,
  // so no need to mess with childViews.
  if (parentView.isDestroying) { return; }

  // update parent node
  parentView.unlinkChild(childView);

  // remove view from childViews array.
  var childViews = get(parentView, 'childViews');

  var index = childViews.indexOf(childView);
  if (index !== -1) { childViews.splice(index, 1); }

  return parentView;
}

export function createChildView(parentView, maybeViewClass, _attrs) {
  if (!maybeViewClass) {
    throw new TypeError('createChildView\'s first argument must exist');
  }

  let owner = getOwner(parentView);

  if (maybeViewClass.isView && maybeViewClass.parentView === parentView && getOwner(maybeViewClass) === owner) {
    return maybeViewClass;
  }

  var attrs = _attrs || {};
  var view;

  attrs.parentView = parentView;
  attrs.renderer = parentView.renderer;
  attrs._viewRegistry = parentView._viewRegistry;

  if (maybeViewClass.isViewFactory) {
    setOwner(attrs, owner);

    view = maybeViewClass.create(attrs);

    if (view.viewName) {
      set(parentView, view.viewName, view);
    }
  } else if ('string' === typeof maybeViewClass) {
    var fullName = 'view:' + maybeViewClass;
    var ViewKlass = owner._lookupFactory(fullName);

    assert('Could not find view: \'' + fullName + '\'', !!ViewKlass);

    view = ViewKlass.create(attrs);
  } else {
    view = maybeViewClass;
    assert('You must pass instance or subclass of View', view.isView);

    setOwner(attrs, owner);
    setProperties(view, attrs);
  }

  parentView.linkChild(view);

  return view;
}

let _createChildView = createChildView;

export default Mixin.create({
  /**
    Array of child views. You should never edit this array directly.
    Instead, use `appendChild` and `removeFromParent`.

    @property childViews
    @type Array
    @default []
    @private
  */
  childViews: EMPTY_ARRAY,

  init() {
    this._super(...arguments);

    // setup child views. be sure to clone the child views array first
    // 2.0TODO: Remove Ember.A() here
    this.childViews = emberA(this.childViews.slice());
    this.ownerView = this.ownerView || this;
  },

  appendChild(view) {
    this.linkChild(view);
    this.childViews.push(view);
  },

  destroyChild(view) {
    view.destroy();
  },

  /**
    Removes the child view from the parent view.

    @method removeChild
    @param {Ember.View} view
    @return {Ember.View} receiver
    @private
  */
  removeChild(view) {
    return removeChildView(this, view);
  },

  /**
    Instantiates a view to be added to the childViews array during view
    initialization. You generally will not call this method directly unless
    you are overriding `createChildViews()`. Note that this method will
    automatically configure the correct settings on the new view instance to
    act as a child of the parent.

    @method createChildView
    @param {Class|String} viewClass
    @param {Object} [attrs] Attributes to add
    @return {Ember.View} new instance
    @private
  */
  createChildView(maybeViewClass, _attrs) {
    return _createChildView(this, maybeViewClass, _attrs);
  },

  linkChild(instance) {
    if (!instance[OWNER]) {
      setOwner(instance, getOwner(this));
    }

    instance.parentView = this;
    instance.ownerView = this.ownerView;
  },

  unlinkChild(instance) {
    instance.parentView = null;
  }
});
