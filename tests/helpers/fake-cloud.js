'use strict';

// wx-server-sdk 的内存版替身，让云函数能在本地跑集成测试。
// 支持 where（neq / and / or / in / exists / 正则）、orderBy、skip、limit、
// count、doc 读写、add、aggregate 分组，以及集合不存在时的报错。
// 通过 Module._resolveFilename 伪装成 wx-server-sdk 注入。

const COLLECTION_MISSING = 'collection not exists';

function createCommand() {
  const single = (name) => (value) => ({ __op: name, value });
  return {
    eq: single('eq'),
    neq: single('neq'),
    lt: single('lt'),
    lte: single('lte'),
    gt: single('gt'),
    gte: single('gte'),
    in: single('in'),
    nin: single('nin'),
    exists: single('exists'),
    and: function (items) {
      return { __op: 'and', value: Array.isArray(items) ? items : Array.prototype.slice.call(arguments) };
    },
    or: function (items) {
      return { __op: 'or', value: Array.isArray(items) ? items : Array.prototype.slice.call(arguments) };
    }
  };
}

function matchesField(value, cond) {
  if (cond && typeof cond === 'object') {
    if (cond.__regexp) {
      return new RegExp(cond.__regexp, cond.__options || '').test(String(value === undefined || value === null ? '' : value));
    }
    switch (cond.__op) {
      case 'eq': return value === cond.value;
      case 'neq': return value !== cond.value;
      case 'lt': return value < cond.value;
      case 'lte': return value <= cond.value;
      case 'gt': return value > cond.value;
      case 'gte': return value >= cond.value;
      case 'in': return Array.isArray(cond.value) && cond.value.indexOf(value) !== -1;
      case 'exists': return cond.value ? value !== undefined : value === undefined;
      default: throw new Error('测试替身不支持的查询操作符：' + cond.__op);
    }
  }
  return value === cond;
}

function matches(doc, where) {
  if (where === null || where === undefined) return true;
  if (where.__op === 'and') return (where.value || []).every((item) => matches(doc, item));
  if (where.__op === 'or') return (where.value || []).some((item) => matches(doc, item));
  return Object.keys(where).every((key) => matchesField(doc[key], where[key]));
}

function compare(a, b) {
  const left = a === undefined || a === null ? null : a;
  const right = b === undefined || b === null ? null : b;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

class Query {
  constructor(db, name) {
    this.db = db;
    this.name = name;
    this._where = {};
    this._fields = null;
    this._sorts = [];
    this._skip = 0;
    this._limit = Infinity;
  }

  where(where) {
    this._where = where || {};
    return this;
  }

  field(fields) {
    this._fields = fields;
    return this;
  }

  orderBy(key, direction) {
    this._sorts.push([key, direction === 'desc' ? -1 : 1]);
    return this;
  }

  skip(value) {
    this._skip = Number(value) || 0;
    return this;
  }

  limit(value) {
    this._limit = value === 0 ? Infinity : (Number(value) || Infinity);
    return this;
  }

  _rows() {
    const table = this.db.state[this.name];
    if (!table) {
      const error = new Error(COLLECTION_MISSING);
      error.errMsg = COLLECTION_MISSING;
      throw error;
    }
    let rows = Object.keys(table).map((id) => Object.assign({ _id: id }, table[id]));
    rows = rows.filter((row) => matches(row, this._where));
    this._sorts.forEach((sort) => {
      const [key, direction] = sort;
      rows.sort((a, b) => compare(a[key], b[key]) * direction);
    });
    rows = rows.slice(this._skip, this._skip + this._limit);
    if (this._fields) {
      rows = rows.map((row) => {
        const picked = {};
        Object.keys(this._fields).forEach((key) => {
          if (this._fields[key] && row[key] !== undefined) picked[key] = row[key];
        });
        picked._id = row._id;
        return picked;
      });
    }
    return rows;
  }

  async get() {
    return { data: this._rows().map((row) => Object.assign({}, row)) };
  }

  async count() {
    return { total: this._rows().length };
  }

  async remove() {
    const table = this.db.state[this.name];
    const rows = this._rows();
    rows.forEach((row) => {
      delete table[row._id];
    });
    return { stats: { removed: rows.length } };
  }

  async update(options) {
    const table = this.db.state[this.name];
    const rows = this._rows();
    rows.forEach((row) => {
      table[row._id] = Object.assign({}, table[row._id], (options && options.data) || {});
    });
    return { stats: { updated: rows.length } };
  }

  doc(id) {
    return new DocumentReference(this.db, this.name, id);
  }

  async add(options) {
    const table = this.db.state[this.name];
    const id = 'auto_' + (this.db.sequence += 1);
    table[id] = Object.assign({}, (options && options.data) || {});
    return { _id: id };
  }

  aggregate() {
    return new Aggregate(this.db, this.name);
  }
}

class DocumentReference {
  constructor(db, name, id) {
    this.db = db;
    this.name = name;
    this.id = id;
  }

  _table() {
    const table = this.db.state[this.name];
    if (!table) {
      const error = new Error(COLLECTION_MISSING);
      error.errMsg = COLLECTION_MISSING;
      throw error;
    }
    return table;
  }

  async get() {
    const table = this._table();
    if (!table[this.id]) {
      const error = new Error('document.get:fail document with _id ' + this.id + ' does not exist');
      error.errMsg = error.message;
      throw error;
    }
    return { data: Object.assign({ _id: this.id }, table[this.id]) };
  }

  async set(options) {
    this._table()[this.id] = Object.assign({}, (options && options.data) || {});
    return { _id: this.id };
  }

  async update(options) {
    const table = this._table();
    if (!table[this.id]) {
      const error = new Error('document.update:fail document with _id ' + this.id + ' does not exist');
      error.errMsg = error.message;
      throw error;
    }
    table[this.id] = Object.assign({}, table[this.id], (options && options.data) || {});
    return { stats: { updated: 1 } };
  }

  async remove() {
    delete this._table()[this.id];
    return { stats: { removed: 1 } };
  }
}

class Aggregate {
  constructor(db, name) {
    this.db = db;
    this.name = name;
    this._match = {};
    this._group = null;
  }

  match(where) {
    this._match = where || {};
    return this;
  }

  group(spec) {
    this._group = spec;
    return this;
  }

  async end() {
    const table = this.db.state[this.name];
    if (!table) {
      const error = new Error(COLLECTION_MISSING);
      error.errMsg = COLLECTION_MISSING;
      throw error;
    }
    const rows = Object.keys(table)
      .map((id) => Object.assign({ _id: id }, table[id]))
      .filter((row) => matches(row, this._match));
    if (!this._group) return { list: rows };
    const key = String(this._group._id || '').replace(/^\$/, '');
    const buckets = {};
    rows.forEach((row) => {
      const value = String(row[key] === undefined ? '' : row[key]);
      buckets[value] = (buckets[value] || 0) + 1;
    });
    return { list: Object.keys(buckets).map((value) => ({ _id: value, count: buckets[value] })) };
  }
}

class Transaction {
  constructor(db) {
    this.db = db;
  }

  collection(name) {
    return new Query(this.db, name);
  }
}

function createFakeCloud(options) {
  const settings = options || {};
  const command = createCommand();
  const db = {
    state: settings.state || {},
    sequence: 0,
    command,
    RegExp: (spec) => ({ __regexp: spec.regexp, __options: spec.options }),
    serverDate: () => ({ __serverDate: true, offset: 0 }),
    collection: (name) => new Query(db, name),
    createCollection: async (name) => {
      if (!db.state[name]) db.state[name] = {};
      return {};
    },
    runTransaction: async (handler) => handler(new Transaction(db))
  };
  db.command.aggregate = { sum: (value) => ({ __agg: 'sum', value }) };

  return {
    db,
    state: db.state,
    DYNAMIC_CURRENT_ENV: 'fake-env',
    init: () => {},
    database: () => db,
    getWXContext: () => ({ OPENID: settings.openid || 'openid_test_user' }),
    deleteFile: async () => ({ fileList: [] })
  };
}

module.exports = { createFakeCloud };
