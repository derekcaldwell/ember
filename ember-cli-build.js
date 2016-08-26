'use strict';
const Funnel = require('broccoli-funnel');
const MergeTrees = require('broccoli-merge-trees');
const StringReplace = require('broccoli-string-replace');
const Babel = require('broccoli-babel-transpiler');
const getGitInfo = require('git-repo-info');
const path = require('path');
const fs = require('fs');
const Rollup = require('broccoli-rollup');
const moduleResolver = require('amd-name-resolver').resolveModules({
  throwOnRootAccess: true
});

const EMBER_VERSION = getVersion();
const VERSION_PLACEHOLDER = /VERSION_STRING_PLACEHOLDER/g;
const RAW_FEATURES = fs.readFileSync('./features.json', {
  encoding: 'utf8'
});
const PROD_FEATURES = getFeatures('production');
const DEBUG_FEATURES = getFeatures('development');
const REMOVE_LIB = /^([^\/]+\/)lib\//;

module.exports = function () {
  // let emberAMDLib = es6ToNamedAMD(emberES6LibPackages());
  // return new MergeTrees([
  //   packageManagerJsonFiles(),
  //   jquery(),
  //   qunit(),
  //   testIndex(),
  //   rsvpES(),
  //   emberAMDLib
  // ], {
  //   annotation: 'dist'
  // });
  return rsvpES();
};

function rsvpES() {
  let rsvp = new Rollup('bower_components/rsvp', {
    rollup: {
      entry: 'lib/rsvp.js',
      targets: [{
        banner: '/*!\n * @overview RSVP - a tiny implementation of Promises/A+.\n * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors\n * @license   Licensed under MIT license\n *            See https://raw.githubusercontent.com/tildeio/rsvp.js/master/LICENSE\n * @version   3.2.1\n */',
        dest: 'rvsp.js',
        format: 'amd',
        moduleId: 'rsvp'
      }]
    }
  });
  return rsvp;
}

function emberES6LibPackages() {
  let removeLib = /^([^\/]+\/)lib\//;
  return new Funnel('packages', {
    include: ['*/lib/**/*.js'],
    exclude: ['loader/**'],
    getDestinationPath(relativePath) {
      // TODO const regex
      return relativePath.replace(removeLib, "$1");
    },
    annotation: 'packages ES6'
  });
}

function es6ToNamedAMD(tree) {
  var options = {
    passPerPreset: true,
    moduleIds: true,

    resolveModuleSource: moduleResolver,

    plugins: [
      function (opts) {
        let t = opts.types;
        return {
          pre(file) {
            file.set("helpersNamespace", t.identifier("EmBabel"));
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
      ['transform-proto-to-assign'],
      ['transform-es2015-modules-amd']
    ]
  };
  let babel = new Babel(tree, options);
  babel._annotation = 'packages named AMD';
  return babel;
}

function jquery() {
  let jquery = require.resolve('jquery');
  return new Funnel(path.dirname(jquery), {
    files: ['jquery.js'],
    destDir: 'jquery',
    annotation: 'jquery/jquery.js'
  });
}

function qunit() {
  var qunitjs = require.resolve('qunitjs');
  return new Funnel(path.dirname(qunitjs), {
    files: ['qunit.js', 'qunit.css'],
    destDir: 'qunit',
    annotation: 'qunit/qunit.{js|css}'
  });
}

function testIndex() {
  let index = new Funnel('tests', {
    files: ['index.html'],
    destDir: 'tests',
    annotation: 'tests/index.html'
  });
  index = new StringReplace(index, {
    files: ['tests/index.html'],
    patterns: [{
      match: /\{\{DEV_FEATURES\}\}/g,
      replacement: JSON.stringify(DEBUG_FEATURES)
    }, {
      match: /\{\{PROD_FEATURES\}\}/g,
      replacement: JSON.stringify(PROD_FEATURES)
    }],
  });
  index._annotation = 'tests/index.html FEATURES';
  return index;
}

function packageManagerJsonFiles() {
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

function getVersion() {
  var projectPath = process.cwd();
  var info = getGitInfo(projectPath);
  if (info.tag) {
    return info.tag.replace(/^v/, '');
  }

  var packageVersion  = require(path.join(projectPath, 'package.json')).version;
  var sha = info.sha || '';
  var prefix = packageVersion + '-' + (process.env.BUILD_TYPE || info.branch);

  return prefix + '+' + sha.slice(0, 8);
}

function getFeatures(environment) {
  var features = JSON.parse(RAW_FEATURES).features;
  var featureName;

  if (process.env.BUILD_TYPE === 'alpha') {
    for (featureName in features) {
      if (features[featureName] === null) {
        features[featureName] = false;
      }
    }
  }

  if (process.env.OVERRIDE_FEATURES) {
    var forcedFeatures = process.env.OVERRIDE_FEATURES.split(',');
    for (var i = 0; i < forcedFeatures.length; i++) {
      featureName = forcedFeatures[i];

      features[featureName] = true;
    }
  }

  features['ember-glimmer-allow-backtracking-rerender'] = false;

  if (process.env.ALLOW_BACKTRACKING) {
    features['ember-glimmer-allow-backtracking-rerender'] = true;
    features['ember-glimmer-detect-backtracking-rerender'] = false;
  }

  var isDevelopment = (environment === 'development');
  var isProduction = (environment === 'production');

  features['mandatory-setter'] = isDevelopment;
  features['ember-glimmer-detect-backtracking-rerender'] = isDevelopment;

  return features;
}
