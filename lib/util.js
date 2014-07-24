/*jshint node:true*/
'use strict';

function matching(pattern, modulus) {
  if (pattern === '*') pattern = '0-' + (modulus - 1);

  var matches = [];
  pattern.split(',').forEach(function(interval) {
    var match, item;

    match = interval.match(/^(\d+)-(\d+)$/);
    if (match) {
      var min = Number(match[1]);
      var max = Number(match[2]);

      while (min > max) {
        min += modulus;
      }

      for (var i = min; i < max; i++) {
        item = i % modulus;
        if (matches.indexOf(item) === -1) {
          matches.push(item);
        }
      }

      return;
    }

    match = interval.match(/^(\d+)$/);
    if (match) {
      item = Number(match[1]) % modulus;
      if (matches.indexOf(item) === -1) {
        matches.push(item);
      }
    }
  });

  return matches.sort();
}

module.exports = {
  matchingDays: function(pattern) {
    return matching(pattern, 7);
  },

  matchingHours: function(pattern) {
    return matching(pattern, 60);
  },

  matchingMinutes: function(pattern) {
    return matching(pattern, 60);
  },

  matchingSeconds: function(pattern) {
    return matching(pattern, 60);
  }
};
