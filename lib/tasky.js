/*jshint node:true*/
'use strict';

var argv = require('optimist').argv;

if (argv.daemon) {
  require('daemon')();

  if (process.getgid() === 0) {
    process.setgid(argv.group || 'nobody');
    process.setuid(argv.user || 'nobody');
  }
}

var logger = require('log4js').getLogger('main');
var moment = require('moment');
var config = require('./config');
var Task = require('./task');
var schedulers = {
  interval: require('./schedulers/interval'),
  recurring: require('./schedulers/recurring')
};

var schedules = {};
var tasks = [];
var queue = [];
var nextTimeout;


function createSchedule(cfg) {
  if (!(cfg.type in schedulers)) {
    throw new Error('unknown scheduler type "' + cfg.type + '"');
  }

  return new schedulers[cfg.type](cfg);
}


function run() {
  // Sort queue
  queue.sort(function(a, b) {
    if (a.time.isBefore(b.time)) {
      return -1;
    } else if (a.time.isAfter(b.time)) {
      return 1;
    } else {
      return 0;
    }
  });

  // Create timeout for next event in queue
  if (queue.length) {
    var event = queue.shift();
    var now = moment();
    var timeout = event.time.isBefore(now) ? 1 : event.time.unix() - now.unix();

    logger.debug('Next event in queue: task "%s" at %s (will run in %s seconds)', event.task.config.id, event.time.toString(), timeout);

    nextTimeout = setTimeout(function() {
      event.what();
      var next = event.task.next();
      if (next) {
        queue.push({
          task: event.task,
          time: next.time,
          what: next.what
        });
      }

      run();
    }, timeout * 1000);
  }
}


// Stop everything on SIGINT
process.on('SIGINT', function() {
  logger.info('Received SIGINT, stopping all tasks');

  clearTimeout(nextTimeout);
  tasks.forEach(function(task) {
    task.stop();
  });

  process.exit(0);
});


function createTasks(cfg) {
  cfg.jobs.forEach(function(job) {
    var scheduler;
    if (typeof job.schedule === 'string') {
      // Job schedule is a named schedule

      if (!(job.schedule in schedules)) {
        // Named schedule not created yet, create it

        if (!(job.schedule in cfg.schedules)) {
          logger.warn('Could not create task "%s": unknown schedule "%s"', job.id, job.schedule);
          return;
        }

        try {
          schedules[job.schedule] = createSchedule(cfg.schedules[job.schedule]);
        } catch(e) {
          logger.warn('Could not create task "%s": %s', job.id, e.message);
          return;
        }
      }

      scheduler = schedules[job.schedule];
    } else {
      // Job schedule is job-specific
      try {
        scheduler = createSchedule(job.schedule);
      } catch(e) {
        logger.warn('Could not create task "%s": %s', job.id, e.message);
        return;
      }
    }

    // Create task
    logger.info('Creating task "%s"', job.id);
    var task = new Task(job, scheduler);
    tasks.push(task);

    // Enqueue next task event
    var next = task.next();
    if (next) {
      queue.push({
        task: task,
        time: next.time,
        what: next.what
      });
    }
  });

  run();
}


config.on('config', function(cfg) {
  cfg.jobs = cfg.jobs || [];
  cfg.schedules = cfg.schedules || {};

  // Stop and remove all tasks
  logger.info('Configuration changed, stopping all tasks');
  tasks.forEach(function(task) {
    task.stop();
  });
  tasks = [];

  // Cancel run timeout and empty queue
  clearTimeout(nextTimeout);
  queue = [];

  // Remove all schedules
  schedules = {};

  // Create all tasks after a cooldown time
  setTimeout(function() { createTasks(cfg); }, cfg.cooldown || 1000);
});

