'use strict';

/**
 * Simple in-memory conversation state store.
 * One Map per role keeps things isolated.
 *
 * state shape:
 *   { step: String, ...extraFields }
 */
class StateStore {
  constructor() {
    this._map = new Map();
  }

  get(userId)             { return this._map.get(userId) || null; }
  set(userId, state)      { this._map.set(userId, state); }
  update(userId, patch)   { this._map.set(userId, { ...this.get(userId), ...patch }); }
  clear(userId)           { this._map.delete(userId); }
  has(userId)             { return this._map.has(userId); }
}

const adminState   = new StateStore();
const teacherState = new StateStore();
const studentState = new StateStore();

function clearAll(userId) {
  adminState.clear(userId);
  teacherState.clear(userId);
  studentState.clear(userId);
}

module.exports = { adminState, teacherState, studentState, clearAll };
