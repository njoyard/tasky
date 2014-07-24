/*jshint node:true*/
'use strict';

var moment = require('moment');
var util = require('../util');

function RecurringScheduler(config) {
  var self = this;

  this.on = {
    dow: '*',
    hour: '*',
    minute: '*',
    second: '*'
  };

  Object.keys(config.on).forEach(function(key) {
    self.on[key] = config.on[key];
  });
}

RecurringScheduler.prototype.next = function() {
  var self = this;
  var now = moment();

  try {
    util.matchingDays(self.on.dow).forEach(function(dow) {
      var offset = (7 + dow - now.day()) % 7;

      util.matchingHours(self.on.hour).forEach(function(hour) {
        util.matchingMinutes(self.on.minute).forEach(function(minute) {
          util.matchingSeconds(self.on.second).forEach(function(second) {
            var candidate = moment().add('days', offset).hours(hour).minute(minute).second(second);
            if (candidate.isAfter(now)) {
              throw candidate;
            }
          });
        });
      });
    });
  } catch(e) {
    if (moment.isMoment(e)) {
      return { time: e, event: 'start' };
    } else {
      throw e;
    }
  }
};

module.exports = RecurringScheduler;