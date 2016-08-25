'use strict';
const Funnel = require('broccoli-funnel');
const MergeTrees = require('broccoli-merge-trees');
const StringReplace = require('broccoli-string-replace');
const getGitInfo = require('git-repo-info');
const path = require('path');
const fs = require('fs');

const EMBER_VERSION = getVersion();
const VERSION_PLACEHOLDER = /VERSION_STRING_PLACEHOLDER/g;
const RAW_FEATURES = fs.readFileSync('./features.json', {
  encoding: 'utf8'
});
const PROD_FEATURES = getFeatures('production');
const DEBUG_FEATURES = getFeatures('development');

module.exports = function () {
  return new MergeTrees([
    packageManagerJsonFiles(),
    jquery(),
    qunit(),
    testIndex()
  ], {
    annotation: 'dist'
  });
};

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
  var index = new Funnel('tests', {
    files: ['index.html'],
    destDir: 'tests',
    annotation: 'tests/index.html'
  });
  return new StringReplace(index, {
    files: ['tests/index.html'],
    patterns: [{
      match: /\{\{DEV_FEATURES\}\}/g,
      replacement: JSON.stringify(DEBUG_FEATURES)
    }, {
      match: /\{\{PROD_FEATURES\}\}/g,
      replacement: JSON.stringify(PROD_FEATURES)
    }],
    annotation: 'DEV_FEATURES | PROD_FEATURES'
  });
}

function packageManagerJsonFiles() {
  var packageJsons = new Funnel('config/package_manager_files', {
    include: ['*.json'],
    destDir: '/',
    annotation: '*.json'
  });
  packageJsons = new StringReplace(packageJsons, {
    patterns: [{
      match: VERSION_PLACEHOLDER,
      replacement: EMBER_VERSION
    }],
    files: ['*.json'],
    annotation: 'VERSION_STRING_PLACEHOLDER'
  });

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
