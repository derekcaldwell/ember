'use strict';
const Funnel = require('broccoli-funnel');
const MergeTrees = require('broccoli-merge-trees');
const StringReplace = require('broccoli-string-replace');
const Babel = require('broccoli-babel-transpiler');const path = require('path');
const fs = require('fs');
const Rollup = require('broccoli-rollup');
const WriteFile = require('broccoli-file-creator');
const moduleResolve = require('amd-name-resolver').moduleResolve;

const FEATURES = require('./broccoli/features');
const EMBER_VERSION = require('./broccoli/version');
const VERSION_PLACEHOLDER = /VERSION_STRING_PLACEHOLDER/g;
const REMOVE_LIB = /^([^\/]+\/)lib\//;

module.exports = function () {
  let esTree = new Funnel(new MergeTrees([
    rsvpES(),
    routerES(),
    routeRecognizerES(),
    backburnerES(),
    emberDebugES(),
    emberBabelDebugES(),
    emberFeaturesES(),
    emberVersionES()
  ], {
    annotation: 'es tree'
  }), {
    include: ['**/*.js'],
    destDir: 'es',
    annotation: 'es tree'
  });

  return new MergeTrees([
    esTree,
    qunit(),
    jquery(),
    testIndexHTML(),
    packageManagerJSONs()
  ], {
    annotation: 'dist'
  });
};

function emberBabelDebugES() {
  return new Funnel('packages/external-helpers/lib', {
    files: ['external-helpers-dev.js'],
    getDestinationPath() {
      return 'ember-babel.js';
    }
  });
}

function emberDebugES() {
  return processES2015(new Funnel('packages', {
    include: ['*/lib/**/*.js'],
    exclude: ['loader/**', 'external-helpers/**', 'internal-test-helpers/**'],
    getDestinationPath(relativePath) {
      return relativePath.replace(REMOVE_LIB, "$1");
    },
    annotation: 'packages ES6'
  }));
}

function emberVersionES() {
  let content = 'export default ' + JSON.stringify(EMBER_VERSION) + ';\n';
  return new WriteFile('ember/version.js', content, {
    annotation: 'ember/version'
  });
}

function emberFeaturesES() {
  let content = 'export default ' + JSON.stringify(FEATURES.DEBUG) + ';\n';
  return new WriteFile('ember/features.js', content, {
    annotation: 'ember/features (DEBUG)'
  });
}

function backburnerES() {
  let dist = path.dirname(require.resolve('backburner.js'));
  dist = path.join(dist, 'es6');
  return new Funnel(dist, {
    files: ['backburner.js']
  });
}

function rsvpES() {
  // TODO upstream
  let version = require('./bower_components/rsvp/package').version;
  let banner = fs.readFileSync(
    path.resolve(__dirname, 'bower_components/rsvp/config/versionTemplate.txt'),
    'utf8');
  let rollup = new Rollup('bower_components/rsvp/lib', {
    rollup: {
      entry: 'rsvp.js',
      targets: [{
        banner: banner.replace('VERSION_PLACEHOLDER_STRING', version),
        dest: 'rsvp.js',
        format: 'es'
      }]
    },
    annotation: 'rsvp.js'
  });
  return rollup;
}

function routerES() {
  // TODO upstream this to router.js and publish on npm
  return new Rollup('bower_components/router.js/lib', {
    rollup: {
      plugins: [{
        transform(code, id) {
          if (/\/router\/handler-info\/[^\/]+\.js$/.test(id)) {
            code = code.replace(/\'router\//g, '\'../');
          }
          code = code.replace(/import\ Promise\ from \'rsvp\/promise\'/g, 'import { Promise } from \'rsvp\'')
          return {
            code: code,
            map: { mappings: '' }
          };
        }
      }],
      external: ['route-recognizer', 'rsvp'],
      entry: 'router.js',
      targets: [{
        dest: 'router.js',
        format: 'es'
      }]
    },
    annotation: 'router.js'
  });
}

function routeRecognizerES() {
  let dist = path.dirname(require.resolve('route-recognizer'));
  let es6 = path.join(dist, 'es6');
  return new Funnel(es6, {
    files: ['route-recognizer.js']
  });
}

// non bundled vendor
function jquery() {
  let jquery = require.resolve('jquery');
  return new Funnel(path.dirname(jquery), {
    files: ['jquery.js'],
    destDir: 'jquery',
    annotation: 'jquery/jquery.js'
  });
}

// TEST files
function qunit() {
  var qunitjs = require.resolve('qunitjs');
  return new Funnel(path.dirname(qunitjs), {
    files: ['qunit.js', 'qunit.css'],
    destDir: 'qunit',
    annotation: 'qunit/qunit.{js|css}'
  });
}

function testIndexHTML() {
  let index = new Funnel('tests', {
    files: ['index.html'],
    destDir: 'tests',
    annotation: 'tests/index.html'
  });
  index = new StringReplace(index, {
    files: ['tests/index.html'],
    patterns: [{
      match: /\{\{DEV_FEATURES\}\}/g,
      replacement: JSON.stringify(FEATURES.DEBUG)
    }, {
      match: /\{\{PROD_FEATURES\}\}/g,
      replacement: JSON.stringify(FEATURES.RELEASE)
    }],
  });
  index._annotation = 'tests/index.html FEATURES';
  return index;
}

function packageManagerJSONs() {
  var packageJsons = new Funnel('config/package_manager_files', {
    include: ['*.json'],
    destDir: '/',
    annotation: 'package.json'
  });
  packageJsons = new StringReplace(packageJsons, {
    patterns: [{
      match: VERSION_PLACEHOLDER,
      replacement: EMBER_VERSION
    }],
    files: ['*.json']
  });
  packageJsons._annotation = 'package.json VERSION';
  return packageJsons;
}

function processES2015(tree) {
  var options = {
    passPerPreset: true,
    plugins: [
      function (opts) {
        let t = opts.types;
        return {
          pre(file) {
            file.set("helperGenerator", function (name) {
              return file.addImport(`ember-babel`, name, name);
            });
          }
        };
      },
      ['transform-es2015-template-literals', {loose: true}],
      ['transform-es2015-arrow-functions'],
      ['transform-es2015-destructuring', {loose: true}],
      ['transform-es2015-spread', {loose: true}],
      ['transform-es2015-parameters'],
      ['transform-es2015-computed-properties', {loose: true}],
      ['transform-es2015-shorthand-properties'],
      ['transform-es2015-block-scoping'],
      ['check-es2015-constants'],
      ['transform-es2015-classes', {loose: true}],
      ['transform-proto-to-assign']
    ]
  };
  let babel = new Babel(tree, options);
  let origKey = babel.cacheKey;
  babel.cacheKey = function () {
    let key = origKey.apply(this, arguments);
    return key + "sdsdfsf";
  };
  return babel;
}
