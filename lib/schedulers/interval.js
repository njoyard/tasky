/*jshint node:true*/
'use strict';

var moment = require('moment');
var util = require('../util');

function IntervalScheduler(config) {
  var intervals = this.intervals = {};

  // Build allowed intervals for each weekday
  config.allowed.forEach(function(interval) {
    interval.dow = interval.dow || '*';
    interval.start = interval.start || '00:00';
    interval.end = interval.end || '23:59';

    var start = interval.start.split(':');
    var end = interval.end.split(':');

    util.matchingDays(interval.dow).forEach(function(dow) {
      intervals[dow] = intervals[dow] || [];

      var i = {
        startHour: Number(start[0]),
        startMinute: Number(start[1]),
        endHour: Number(end[0]),
        endMinute: Number(end[1])
      };

      i.start = i.startHour * 60 + i.startMinute;
      i.end = i.endHour * 60 + i.endMinute;

      intervals[dow].push(i);
    });
  });

  // Merge overlapping intervals
  Object.keys(intervals).forEach(function(dow) {
    intervals[dow] = intervals[dow]
      .sort(function(a, b) {
        return a.start - b.start;
      })
      .reduce(function(merged, interval) {
        if (merged.length) {
          var prev = merged[merged.length - 1];
          if (interval.start <= prev.end) {
            if (interval.end <= prev.end) {
              // Contained in the previous one, do nothing
              return merged;
            } else {
              // Continues after the previous one, extend it
              prev.end = interval.end;
              return merged;
            }
          }
        }

        merged.push(interval);
        return merged;
      }, []);
  });
}

IntervalScheduler.prototype.next = function() {
  var now = moment();
  var currentDay = now.day();
  var currentTime = now.hour() * 60 + now.minute();

  // Find next interval that ends in the future
  for (var day = currentDay; day < currentDay + 7; day++) {
    var intervals = this.intervals[day % 7] || [];

    if (day === currentDay) {
      intervals = intervals.filter(function(interval) {
        return interval.end > currentTime;
      });
    }

    if (intervals.length) {
      var interval = intervals[0];
      var start = now.clone().add('days', day - currentDay).hour(interval.startHour).minute(interval.startMinute);

      if (start.isBefore(now)) {
        // Interval has started already, next event is stop
        return {
          time: start.clone().hour(interval.endHour).minute(interval.endMinute),
          event: 'stop'
        };
      } else {
        // Interval has not started yet, next event is start
        return {
          time: start,
          event: 'start'
        };
      }
    }
  }
};

module.exports = IntervalScheduler;