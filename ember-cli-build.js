/* jshint node: true */
var Funnel     = require('broccoli-funnel');
var Concat     = require('broccoli-concat');
var Transpiler = require('broccoli-babel-transpiler');
var Creator    = require('broccoli-file-creator');
var MergeTrees = require('broccoli-merge-trees');
var babel      = require('babel-core');
var resolveModules = require('amd-name-resolver').resolveModules;
var moduleResolver = resolveModules({ throwOnRootAccess: false });
var fs = require('fs');

function transpile(input, annotation) {
  plugin = new Transpiler(input, {
    loose: true,
    moduleId: true,
 //externalHelpers: true,
    modules: 'amdStrict',
    sourceMaps: 'inline',
    nonStandard: false,
    resolveModuleSource: moduleResolver,
    plugins: [{
      transformer: enifedFormatter,
      position: 'after'
    }, {
      transformer: replaceDefaultFeatures,
      position: 'after'
    }],
    whitelist: [
      'es6.templateLiterals',
      'es6.arrowFunctions',
      'es6.destructuring',
      'es6.spread',
      'es6.parameters',
      'es6.properties.computed',
      'es6.properties.shorthand',
      'es6.blockScoping',
      'es6.constants',
      'es6.modules',
      'es6.classes',
      'spec.protoToAssign'
    ]
  });
  // can't seem to annotate transpiler
  // plugin.annotation = annotation;
  return plugin;
}

function es6PackageLib(name) {
  return new Funnel('packages/'+name+'/lib', {
    annotation: name,
    include: ['**/*.js'],
    destDir: name
  });
}

function loader() {
  return new Funnel('packages/loader/lib', {
    annotation: 'loader',
    include: ['index.js'],
    destDir: 'loader'
  });
}

module.exports = function () {
  var backburnerModules         = transpile(
    new Funnel('bower_components/backburner/lib', {
      include: ['backburner.js', 'backburner/**/*.js'],
      destDir: '/',
      annotation: 'backburner'
    }), 'backburner'
  );
  var rsvpModules         = transpile(
    new Funnel('bower_components/rsvp/lib', {
      include: ['rsvp.js', 'rsvp/**/*.js'],
      destDir: '/',
      annotation: 'rsvp'
    }), 'rsvp'
  );
  var containerModules     = transpile(es6PackageLib('container'), 'container');
  var consoleModules       = transpile(es6PackageLib('ember-console'), 'ember-console');
  var debugModules         = transpile(es6PackageLib('ember-debug'), 'ember-debug');
  var environmentModules   = transpile(es6PackageLib('ember-environment'), 'ember-environment');
  var metalModules         = transpile(es6PackageLib('ember-metal'), 'ember-metal');
  var runtimeModules       = transpile(es6PackageLib('ember-runtime'), 'ember-runtime');

  var merged = new MergeTrees([
    loader(),
    backburnerModules,
    containerModules,
    rsvpModules,
    consoleModules,
    debugModules,
    environmentModules,
    metalModules,
    runtimeModules
  ], {
    annotation: 'modules'
  });

  return new Concat(merged, {
    // sourceMapConfig: {
    //   enabled: true
    // },
    header: ';(function() {',
    headerFiles: ['loader/index.js'],
    inputFiles: ['**/*.js'],
    footer: 'requireModule("ember-runtime") }());',
    outputFile: 'ember-runtime.js',
    allowNone: false,
    annotation: 'ember-runtime.js'
  });

  // var whitelist = null;
  // var babelhelpers = babel.buildExternalHelpers(whitelist, 'var');

  // return mergedModules;
}

function replaceDefaultFeatures(babel) {
  var t = babel.types;
  return new babel.Plugin('replace-default-features', {
    visitor: {
      VariableDeclarator: function(node) {
        if (node.id.name === 'KNOWN_FEATURES' &&
            node.init.name === 'DEFAULT_FEATURES') {
          var features = JSON.parse(fs.readFileSync('features.json', 'utf8')).features;
          var keys = Object.keys(features);
          node.init = t.objectExpression(keys.map(function (key) {
            return t.property('init', t.literal(key), t.literal(features[key]));
          }));
        }
      }
    }
  });
}

function enifedFormatter(babel) {
  var t = babel.types;
  return new babel.Plugin('define-to-enifed', {
    visitor: {
      CallExpression: function(node){
        if (t.isIdentifier(node.callee, {name: 'define'})){
          node.callee = t.identifier('enifed');
        }
      },
      BlockStatement: function(){
        this.skip();
      }
    }
  });
};
