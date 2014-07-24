/*jshint node:true*/
'use strict';

var log4js = require('log4js');
var spawn = require('child_process').spawn;
var moment = require('moment');

function Task(config, scheduler) {
  this.scheduler = scheduler;
  this.config = config;
  this.logger = log4js.getLogger(config.id);

  this.running = false;
  this.process = null;
  this.isNew = true;

  if ('restart' in config) {
    if (config.restart === false) {
      delete config.restart;
    } else if (typeof config.restart !== 'number') {
      config.restart = 0;
    }
  }
}

Task.prototype.start = function() {
  this.logger.info('Starting task');
  this.running = true;
  this.spawn();
};

Task.prototype.stop = function() {
  this.logger.info('Stopping task');
  this.running = false;
  this.kill();
};

Task.prototype.spawn = function() {
  var self = this;

  if (!this.running) {
    return;
  }

  this.logger.debug('Spawning task');
  var process = this.process = spawn(
    this.config.command,
    this.config.args || []
  );

  process.on('error', function(err) {
    self.logger.error('Could not spawn task: %s', err.message);
  });

  process.on('exit', function(code, signal) {
    if (process.taskKilled) {
      self.logger.info('Task was killed successfully');
    } else if (signal) {
      self.logger.warn('Task was killed with signal %s', signal);
    } else if (code) {
      self.logger.warn('Task ended with exit code %s', code);
    } else {
      self.logger.info('Task finished successfully');
    }

    self.process = null;

    if (self.running && ('restart' in self.config)) {
      self.logger.debug('Scheduling restart in %s seconds', self.config.restart);
      setTimeout(self.spawn.bind(self), self.config.restart * 1000);
    }
  });
};

Task.prototype.kill = function() {
  if (this.process) {
    this.logger.debug('Killing task');
    this.process.taskKilled = true;
    this.process.kill();
    this.process = null;
  }
};

Task.prototype.next = function() {
  var next = this.scheduler.next();

  if (next) {
    this.logger.debug('Next event: "%s" on %s', next.event, next.time.toString());

    switch (next.event) {
    case 'start':
      return {
        time: next.time,
        what: this.start.bind(this)
      };

    case 'stop':
      if (this.isNew) {
        // Task has not run yet, we may start it now
        this.isNew = false;

        return {
          time: moment(),
          what: this.start.bind(this)
        };
      }

      return {
        time: next.time,
        what: this.stop.bind(this)
      };

    default:
      this.logger.warn('Scheduler returned unknown event: "%s"', next.event);
    }
  }
};

module.exports = Task;
