var validate = require('sourcemap-validator')
  , fs = require('fs')
  , assert = require('assert')
  , raw = fs.readFileSync('dist/ember-runtime.js', 'utf8')
  , map = fs.readFileSync('dist/ember-runtime.map', 'utf8');

validate(raw, map);
